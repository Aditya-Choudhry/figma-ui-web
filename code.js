// Figma plugin main code - handles communication with UI and Figma API
console.log('Figma plugin loaded');

// Listen for messages from the plugin UI
figma.ui.onmessage = async (msg) => {
  console.log('Received message:', msg);

  if (msg.type === 'captureResponsive') {
    const { url, viewports } = msg;

    try {
      figma.notify(`Starting responsive capture for ${viewports.length} viewports...`, { timeout: 2000 });

      // Send URL and viewports to our enhanced capture server
      console.log('Fetching responsive website data from server...');
      const response = await fetch('http://localhost:5000/api/capture-responsive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, viewports }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Received responsive data from server:', data);

      if (data.error) {
        throw new Error(data.error);
      }

      // Process the captured data for each viewport
      await createResponsiveFigmaLayouts(data);

      figma.ui.postMessage({ 
        type: 'captureComplete', 
        success: true,
        message: `Responsive capture complete! Created ${viewports.length} viewport layouts.`
      });

      figma.notify(`Responsive capture successful! Created ${viewports.length} layouts.`, { timeout: 3000 });

    } catch (error) {
      console.error('Responsive capture error:', error);
      figma.ui.postMessage({ 
        type: 'captureComplete', 
        success: false,
        error: error.message 
      });
      figma.notify(`Responsive capture failed: ${error.message}`, { error: true });
    }
  }

  // Backward compatibility for single capture
  if (msg.type === 'captureWebsite') {
    const { url } = msg;

    try {
      figma.notify('Starting website capture...', { timeout: 2000 });

      const response = await fetch('http://localhost:5000/api/capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      await createFigmaNodesFromWebData(data);

      figma.ui.postMessage({ 
        type: 'captureComplete', 
        success: true,
        message: 'Website captured and converted to Figma!'
      });

      figma.notify('Website successfully captured!', { timeout: 3000 });

    } catch (error) {
      console.error('Capture error:', error);
      figma.ui.postMessage({ 
        type: 'captureComplete', 
        success: false,
        error: error.message 
      });
      figma.notify(`Capture failed: ${error.message}`, { error: true });
    }
  }
};

async function createResponsiveFigmaLayouts(data) {
  console.log('Creating responsive Figma layouts...');

  const { url, viewports } = data;
  const mainSectionName = extractDomainName(url);

  // Create a main section to organize all responsive layouts
  const mainSection = figma.createSection();
  mainSection.name = `🌐 ${mainSectionName} - Responsive Layouts`;
  figma.currentPage.appendChild(mainSection);

  const frameSpacing = 100; // Space between frames
  let currentX = 0;

  // Create layout for each viewport
  for (const [viewportName, viewportData] of Object.entries(viewports)) {
    console.log(`Creating layout for ${viewportName}...`);

    const { page, elements, viewport_config } = viewportData;

    // Create viewport frame
    const viewportFrame = figma.createFrame();
    viewportFrame.name = `📱 ${viewport_config.device} (${viewport_config.width}px)`;
    viewportFrame.resize(viewport_config.width, Math.max(viewport_config.height, 800));
    viewportFrame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    viewportFrame.x = currentX;
    viewportFrame.y = 0;

    // Enable auto layout for better organization
    viewportFrame.layoutMode = 'VERTICAL';
    viewportFrame.paddingTop = 20;
    viewportFrame.paddingBottom = 20;
    viewportFrame.paddingLeft = 20;
    viewportFrame.paddingRight = 20;
    viewportFrame.itemSpacing = 10;

    mainSection.appendChild(viewportFrame);

    // Create elements in this viewport
    await createElementsInFrame(viewportFrame, elements.slice(0, 50)); // Limit for performance

    // Update X position for next frame
    currentX += viewport_config.width + frameSpacing;

    console.log(`Created ${viewportName} layout with ${elements.length} elements`);
  }

  // Focus on the created section
  figma.viewport.scrollAndZoomIntoView([mainSection]);

  console.log(`Created responsive layouts for ${Object.keys(viewports).length} viewports`);
}

async function createElementsInFrame(parentFrame, elements) {
  // Group elements by depth to maintain hierarchy
  const elementsByDepth = {};
  const maxDepth = Math.max(...elements.map(el => el.depth || 0));

  for (const element of elements) {
    const depth = element.depth || 0;
    if (!elementsByDepth[depth]) {
      elementsByDepth[depth] = [];
    }
    elementsByDepth[depth].push(element);
  }

  // Create elements starting from top level
  for (let depth = 0; depth <= Math.min(maxDepth, 5); depth++) { // Limit depth
    const elementsAtDepth = elementsByDepth[depth] || [];

    for (const element of elementsAtDepth) {
      try {
        const node = await createAdvancedNodeFromElement(element);
        if (node) {
          parentFrame.appendChild(node);
        }
      } catch (error) {
        console.warn('Failed to create advanced node:', element.tagName, error);
      }
    }
  }
}

async function createFigmaNodesFromWebData(data) {
  console.log('Creating Figma nodes from web data...');

  const { page, elements } = data;

  // Create main frame for the website
  const mainFrame = figma.createFrame();
  mainFrame.name = page.title || 'Captured Website';
  mainFrame.resize(page.viewport.width, page.viewport.height);
  mainFrame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];

  figma.currentPage.appendChild(mainFrame);

  // Process elements and create corresponding Figma nodes
  for (const element of elements.slice(0, 50)) { // Limit for performance
    try {
      const node = await createNodeFromElement(element);
      if (node) {
        mainFrame.appendChild(node);
      }
    } catch (error) {
      console.warn('Failed to create node for element:', element, error);
    }
  }

  // Center the frame in viewport
  figma.viewport.scrollAndZoomIntoView([mainFrame]);

  console.log(`Created ${elements.length} elements in Figma`);
}

async function createNodeFromElement(element) {
  const { tagName, layout, visual, typography, textContent } = element;

  // Determine node type based on element
  let node;

  if (textContent && textContent.trim()) {
    // Create text node for elements with text
    node = figma.createText();

    // Load default font
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });

    node.characters = textContent.trim().substring(0, 200); // Limit text length
    node.fontSize = parseFloat(typography.fontSize) || 16;

    // Set text color
    if (visual.color) {
      const color = parseColor(visual.color);
      if (color) {
        node.fills = [{ type: 'SOLID', color }];
      }
    }

  } else {
    // Create rectangle for container elements
    node = figma.createRectangle();

    // Set background color
    if (visual.backgroundColor && visual.backgroundColor !== 'rgba(0, 0, 0, 0)') {
      const bgColor = parseColor(visual.backgroundColor);
      if (bgColor) {
        node.fills = [{ type: 'SOLID', color: bgColor }];
      }
    } else {
      node.fills = []; // Transparent
    }
  }

  // Set name
  node.name = `${tagName}${element.className ? '.' + element.className.split(' ')[0] : ''}`;

  // Set position and size
  node.x = layout.x;
  node.y = layout.y;
  node.resize(Math.max(1, layout.width), Math.max(1, layout.height));

  // Set border radius if present
  if (visual.borderRadius && node.cornerRadius !== undefined) {
    const radius = parseFloat(visual.borderRadius);
    if (!isNaN(radius)) {
      node.cornerRadius = radius;
    }
  }

  return node;
}

function parseColor(colorString) {
  if (!colorString) return null;

  // Handle rgb/rgba colors
  const rgbaMatch = colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbaMatch) {
    const [, r, g, b, a] = rgbaMatch;
    return {
      r: parseInt(r) / 255,
      g: parseInt(g) / 255,
      b: parseInt(b) / 255
    };
  }

  // Handle hex colors
  const hexMatch = colorString.match(/^#([a-f\d]{6})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    return {
      r: parseInt(hex.substr(0, 2), 16) / 255,
      g: parseInt(hex.substr(2, 2), 16) / 255,
      b: parseInt(hex.substr(4, 2), 16) / 255
    };
  }

  return null;
}

async function createAdvancedNodeFromElement(element) {
  try {
    console.log(`Creating precise node for ${element.tagName} with comprehensive styling...`);
    
    // Determine the appropriate Figma node type based on enhanced analysis
    const nodeType = determineAdvancedNodeType(element);
    
    if (nodeType === 'TEXT') {
      return await createPreciseTextNode(element);
    } else if (nodeType === 'IMAGE') {
      return await createPreciseImageNode(element);
    } else if (nodeType === 'COMPONENT') {
      return await createComponentNode(element);
    } else {
      // Create frame with exact styling and Auto Layout
      return await createPreciseFrameNode(element);
    }
  } catch (error) {
    console.error('Error creating advanced node:', error);
    return null;
  }
}

function determineAdvancedNodeType(element) {
  // Enhanced node type determination based on comprehensive analysis
  const { tagName, layout_detection, visual_hierarchy } = element;
  
  // Text nodes - only pure text content
  if (layout_detection && layout_detection.isTextNode && element.textContent && element.textContent.trim()) {
    return 'TEXT';
  }
  
  // Image nodes
  if ((layout_detection && layout_detection.isImageElement) || (element.attributes && element.attributes.src)) {
    return 'IMAGE';
  }
  
  // Interactive components (buttons, inputs)
  if ((layout_detection && layout_detection.isInputElement) || (visual_hierarchy && visual_hierarchy.isInteractive)) {
    return 'COMPONENT';
  }
  
  // Default to frame for containers and complex elements
  return 'FRAME';
}

async function createPreciseTextNode(element) {
  const textNode = figma.createText();
  
  // Load font before setting properties
  const fontFamily = mapWebFontToFigma((element.typography && element.typography.fontFamily) || 'Arial');
  const fontWeight = mapFontWeight((element.typography && element.typography.fontWeight) || '400');
  
  try {
    await figma.loadFontAsync({ family: fontFamily, style: fontWeight });
  } catch (error) {
    console.warn(`Font loading failed for ${fontFamily}, using default:`, error);
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  }
  
  // Set text content
  textNode.characters = (element.textContent && element.textContent.trim()) || (element.innerText && element.innerText.trim()) || '';
  
  // Apply precise typography
  textNode.fontName = { family: fontFamily, style: fontWeight };
  textNode.fontSize = Math.max((element.typography && element.typography.fontSize) || 16, 8);
  textNode.lineHeight = parseLineHeight(element.typography && element.typography.lineHeight);
  textNode.letterSpacing = parseLetterSpacing(element.typography && element.typography.letterSpacing);
  
  // Text alignment
  const textAlign = (element.typography && element.typography.textAlign) || 'left';
  textNode.textAlignHorizontal = mapTextAlign(textAlign);
  
  // Text color
  textNode.fills = [{ 
    type: 'SOLID', 
    color: parseColor((element.typography && element.typography.color) || '#000000') 
  }];
  
  // Position and size
  textNode.x = (element.position && element.position.x) || 0;
  textNode.y = (element.position && element.position.y) || 0;
  textNode.resize(
    Math.max((element.position && element.position.width) || 100, 20),
    Math.max((element.position && element.position.height) || 20, 10)
  );
  
  // Auto resize
  textNode.textAutoResize = 'WIDTH_AND_HEIGHT';
  
  textNode.name = `${element.tagName} Text: "${textNode.characters.substring(0, 30)}..."`;
  
  return textNode;
}

async function createPreciseImageNode(element) {
  const frame = figma.createFrame();
  frame.name = `${element.tagName} Image`;
  
  // Set dimensions
  frame.resize(
    Math.max((element.position && element.position.width) || 100, 20),
    Math.max((element.position && element.position.height) || 100, 20)
  );
  
  // Position
  frame.x = (element.position && element.position.x) || 0;
  frame.y = (element.position && element.position.y) || 0;
  
  // Apply background if it's a background-image
  if (element.visual && element.visual.backgroundImages && element.visual.backgroundImages.length > 0) {
    // For now, create a placeholder - in production, you'd fetch and apply the image
    frame.fills = [{ 
      type: 'SOLID', 
      color: { r: 0.9, g: 0.9, b: 0.9 } 
    }];
    
    // Add a text node indicating it's an image
    const imageLabel = figma.createText();
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
    imageLabel.characters = '🖼️ ' + ((element.attributes && element.attributes.alt) || 'Image');
    imageLabel.fontSize = 12;
    imageLabel.fills = [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }];
    imageLabel.textAlignHorizontal = 'CENTER';
    imageLabel.textAlignVertical = 'CENTER';
    frame.appendChild(imageLabel);
  }
  
  // Apply border radius if present
  applyBorderRadius(frame, element.visual);
  
  return frame;
}

async function createComponentNode(element) {
  const frame = figma.createFrame();
  frame.name = `${element.tagName} Component`;
  
  // Set dimensions
  frame.resize(
    Math.max((element.position && element.position.width) || 100, 20),
    Math.max((element.position && element.position.height) || 40, 20)
  );
  
  // Position
  frame.x = (element.position && element.position.x) || 0;
  frame.y = (element.position && element.position.y) || 0;
  
  // Apply styling
  frame.fills = [{ 
    type: 'SOLID', 
    color: parseColor((element.visual && element.visual.backgroundColor) || '#f0f0f0') 
  }];
  
  // Add component indicator
  if (element.textContent && element.textContent.trim()) {
    const componentText = figma.createText();
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
    componentText.characters = element.textContent.trim();
    componentText.fontSize = (element.typography && element.typography.fontSize) || 14;
    componentText.fills = [{ 
      type: 'SOLID', 
      color: parseColor((element.typography && element.typography.color) || '#000000') 
    }];
    frame.appendChild(componentText);
  }
  
  applyBorderRadius(frame, element.visual);
  applyBorders(frame, element.visual);
  
  return frame;
}

async function createPreciseFrameNode(element) {
  const frame = figma.createFrame();
  frame.name = `${element.tagName}${element.className ? '.' + element.className.split(' ')[0] : ''}`;
  
  // Set precise dimensions
  frame.resize(
    Math.max((element.position && element.position.width) || 100, 1),
    Math.max((element.position && element.position.height) || 20, 1)
  );
  
  // Position
  frame.x = (element.position && element.position.x) || 0;
  frame.y = (element.position && element.position.y) || 0;
  
  // Apply Auto Layout if it's a flex container
  if (element.layout_detection && element.layout_detection.isFlexContainer && element.layout_detection.flexboxMapping) {
    const flexMapping = element.layout_detection.flexboxMapping;
    
    frame.layoutMode = flexMapping.figmaLayoutMode || 'HORIZONTAL';
    frame.itemSpacing = Math.max(flexMapping.figmaItemSpacing || 0, 0);
    
    // Apply padding
    if (flexMapping.figmaPadding) {
      frame.paddingTop = Math.max(flexMapping.figmaPadding.top || 0, 0);
      frame.paddingRight = Math.max(flexMapping.figmaPadding.right || 0, 0);
      frame.paddingBottom = Math.max(flexMapping.figmaPadding.bottom || 0, 0);
      frame.paddingLeft = Math.max(flexMapping.figmaPadding.left || 0, 0);
    }
    
    // Map justify-content to primaryAxisAlignItems
    frame.primaryAxisAlignItems = mapJustifyContent(flexMapping.figmaPrimaryAxis);
    frame.counterAxisAlignItems = mapAlignItems(flexMapping.figmaCounterAxis);
  }
  
  // Apply background color
  if (element.visual && element.visual.backgroundColor && element.visual.backgroundColor !== 'rgba(0, 0, 0, 0)') {
    frame.fills = [{ 
      type: 'SOLID', 
      color: parseColor(element.visual.backgroundColor) 
    }];
  } else {
    frame.fills = []; // Transparent
  }
  
  // Apply border radius
  applyBorderRadius(frame, element.visual);
  
  // Apply borders
  applyBorders(frame, element.visual);
  
  // Apply effects (shadows)
  applyEffects(frame, element.visual);
  
  // Apply opacity
  if (element.visual && element.visual.opacity !== undefined && element.visual.opacity < 1) {
    frame.opacity = Math.max(element.visual.opacity, 0.01);
  }
  
  return frame;
}

function extractDomainName(url) {
  try {
    const domain = new URL(url).hostname;
    return domain.replace('www.', '').split('.')[0];
  } catch {
    return 'Website';
  }
}

// Utility functions for precise styling

function mapWebFontToFigma(webFont) {
  // Enhanced font mapping from web fonts to Figma fonts
  const fontMap = {
    'Arial': 'Arial',
    'Helvetica': 'Arial',
    'Times': 'Times New Roman',
    'Times New Roman': 'Times New Roman',
    'Georgia': 'Georgia',
    'Verdana': 'Verdana',
    'Courier': 'Courier New',
    'Courier New': 'Courier New',
    'Impact': 'Impact',
    'Comic Sans MS': 'Comic Sans MS',
    'Trebuchet MS': 'Trebuchet MS',
    'Arial Black': 'Arial Black',
    'Palatino': 'Palatino',
    'Garamond': 'Garamond',
    'Bookman': 'Bookman',
    'Tahoma': 'Tahoma',
    'Inter': 'Inter',
    'Roboto': 'Roboto',
    'Open Sans': 'Open Sans',
    'Lato': 'Lato',
    'Montserrat': 'Montserrat',
    'Source Sans Pro': 'Source Sans Pro',
    'Poppins': 'Poppins',
    'sans-serif': 'Inter',
    'serif': 'Times New Roman',
    'monospace': 'Courier New'
  };
  
  // Extract first font family
  const firstFont = webFont.split(',')[0].trim().replace(/['"]/g, '');
  return fontMap[firstFont] || 'Inter';
}

function mapFontWeight(weight) {
  // Map CSS font weights to Figma font styles
  const weightMap = {
    '100': 'Thin',
    '200': 'Extra Light',
    '300': 'Light',
    '400': 'Regular',
    '500': 'Medium',
    '600': 'Semi Bold',
    '700': 'Bold',
    '800': 'Extra Bold',
    '900': 'Black',
    'normal': 'Regular',
    'bold': 'Bold',
    'lighter': 'Light',
    'bolder': 'Bold'
  };
  
  return weightMap[weight] || 'Regular';
}

function parseLineHeight(lineHeight) {
  if (!lineHeight || lineHeight === 'normal') {
    return { unit: 'AUTO' };
  }
  
  if (lineHeight.includes('px')) {
    return { unit: 'PIXELS', value: parseFloat(lineHeight) };
  }
  
  if (lineHeight.includes('%')) {
    return { unit: 'PERCENT', value: parseFloat(lineHeight) };
  }
  
  // Unitless values are multipliers
  const numValue = parseFloat(lineHeight);
  if (!isNaN(numValue)) {
    return { unit: 'PERCENT', value: numValue * 100 };
  }
  
  return { unit: 'AUTO' };
}

function parseLetterSpacing(letterSpacing) {
  if (!letterSpacing || letterSpacing === 'normal') {
    return { unit: 'PIXELS', value: 0 };
  }
  
  const value = parseFloat(letterSpacing);
  if (!isNaN(value)) {
    return { unit: 'PIXELS', value: value };
  }
  
  return { unit: 'PIXELS', value: 0 };
}

function mapTextAlign(textAlign) {
  const alignMap = {
    'left': 'LEFT',
    'center': 'CENTER',
    'right': 'RIGHT',
    'justify': 'JUSTIFIED',
    'start': 'LEFT',
    'end': 'RIGHT'
  };
  
  return alignMap[textAlign] || 'LEFT';
}

function parseColor(colorString) {
  // Enhanced color parsing for CSS colors
  if (!colorString) return { r: 0, g: 0, b: 0 };
  
  // Handle hex colors
  if (colorString.startsWith('#')) {
    const hex = colorString.substring(1);
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    return { r, g, b };
  }
  
  // Handle rgb/rgba colors
  const rgbMatch = colorString.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1]) / 255,
      g: parseInt(rgbMatch[2]) / 255,
      b: parseInt(rgbMatch[3]) / 255
    };
  }
  
  // Handle named colors (basic set)
  const namedColors = {
    'black': { r: 0, g: 0, b: 0 },
    'white': { r: 1, g: 1, b: 1 },
    'red': { r: 1, g: 0, b: 0 },
    'green': { r: 0, g: 1, b: 0 },
    'blue': { r: 0, g: 0, b: 1 },
    'transparent': { r: 0, g: 0, b: 0 }
  };
  
  return namedColors[colorString.toLowerCase()] || { r: 0, g: 0, b: 0 };
}

function mapJustifyContent(justifyContent) {
  const justifyMap = {
    'flex-start': 'MIN',
    'start': 'MIN',
    'center': 'CENTER',
    'flex-end': 'MAX',
    'end': 'MAX',
    'space-between': 'SPACE_BETWEEN',
    'space-around': 'CENTER', // Approximate
    'space-evenly': 'CENTER'   // Approximate
  };
  
  return justifyMap[justifyContent] || 'MIN';
}

function mapAlignItems(alignItems) {
  const alignMap = {
    'flex-start': 'MIN',
    'start': 'MIN',
    'center': 'CENTER',
    'flex-end': 'MAX',
    'end': 'MAX',
    'stretch': 'MIN', // Approximate
    'baseline': 'MIN'  // Approximate
  };
  
  return alignMap[alignItems] || 'MIN';
}

function applyBorderRadius(node, visual) {
  if (!visual || node.cornerRadius === undefined) return;
  
  const radius = parseFloat(visual.borderTopLeftRadius) || 0;
  if (radius > 0) {
    node.cornerRadius = radius;
  }
}

function applyBorders(node, visual) {
  if (!visual || node.strokes === undefined) return;
  
  const borderWidth = visual.borderTopWidth || 0;
  if (borderWidth > 0) {
    node.strokeWeight = borderWidth;
    node.strokes = [{ 
      type: 'SOLID', 
      color: parseColor(visual.borderTopColor || '#000000') 
    }];
  }
}

function applyEffects(node, visual) {
  if (!visual || !visual.boxShadow || visual.boxShadow === 'none') return;
  
  // Basic shadow application - in production, you'd parse the shadow string
  const effects = [];
  if (visual.boxShadow.includes('rgba') || visual.boxShadow.includes('rgb')) {
    effects.push({
      type: 'DROP_SHADOW',
      color: { r: 0, g: 0, b: 0, a: 0.25 },
      offset: { x: 2, y: 2 },
      radius: 4,
      visible: true
    });
  }
  
  if (effects.length > 0) {
    node.effects = effects;
  }
}

// Show the plugin UI
figma.showUI(__html__, { width: 400, height: 350 });