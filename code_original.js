// Figma plugin main code - handles communication with UI and Figma API
console.log('Figma plugin loaded');

// Listen for messages from the plugin UI
figma.ui.onmessage = (msg) => {
  console.log('Received message:', msg);

  if (msg.type === 'sandboxCaptureComplete') {
    // Handle sandbox iframe capture data directly
    figma.notify('Processing sandbox capture data...', { timeout: 2000 });
    
    console.log('Received sandbox capture data:', msg.data);
    
    // Process the captured data for each viewport using Promises
    createResponsiveFigmaLayouts(msg.data)
      .then(() => {
        figma.notify('Sandbox capture successful! Created responsive layouts.', { timeout: 3000 });
      })
      .catch((error) => {
        console.error('Sandbox capture processing error:', error);
        figma.notify('Error processing sandbox capture: ' + error.message, { error: true });
      });
  } else if (msg.type === 'captureResponsive') {
    const { url, viewports } = msg;

    figma.notify(`Starting responsive capture for ${viewports.length} viewports...`, { timeout: 2000 });

    // Send URL and viewports to our enhanced capture server
    console.log('Fetching responsive website data from server...');
    fetch('http://localhost:5000/api/capture-responsive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, viewports }),
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log('Received responsive data from server:', data);

      if (data.error) {
        throw new Error(data.error);
      }

      // Process the captured data for each viewport
      return createResponsiveFigmaLayouts(data);
    })
    .then(() => {
      figma.ui.postMessage({ 
        type: 'captureComplete', 
        success: true,
        message: `Responsive capture complete! Created ${viewports.length} viewport layouts.`
      });

      figma.notify(`Responsive capture successful! Created ${viewports.length} layouts.`, { timeout: 3000 });
    })
    .catch((error) => {
      console.error('Responsive capture error:', error);
      figma.ui.postMessage({ 
        type: 'captureComplete', 
        success: false,
        error: error.message 
      });
      figma.notify(`Responsive capture failed: ${error.message}`, { error: true });
    });
  }

  // Backward compatibility for single capture
  if (msg.type === 'captureWebsite') {
    const { url } = msg;

    figma.notify('Starting website capture...', { timeout: 2000 });

    fetch('http://localhost:5000/api/capture', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.error) {
        throw new Error(data.error);
      }
      return createFigmaNodesFromWebData(data);
    })
    .then(() => {
      figma.ui.postMessage({ 
        type: 'captureComplete', 
        success: true,
        message: 'Website captured and converted to Figma!'
      });

      figma.notify('Website successfully captured!', { timeout: 3000 });
    })
    .catch((error) => {
      console.error('Capture error:', error);
      figma.ui.postMessage({ 
        type: 'captureComplete', 
        success: false,
        error: error.message 
      });
      figma.notify(`Capture failed: ${error.message}`, { error: true });
    });
  }
};

function createResponsiveFigmaLayouts(data) {
  return new Promise((resolve) => {
    console.log('Creating pixel-perfect responsive Figma layouts with assets...');

    const { url, viewports } = data;
    const mainSectionName = extractDomainName(url);

  // Create a main section to organize all responsive layouts
  const mainSection = figma.createSection();
  mainSection.name = `🌐 ${mainSectionName} - Pixel Perfect Layouts`;
  figma.currentPage.appendChild(mainSection);

  const frameSpacing = 100; // Space between frames
  let currentX = 0;

  // Create layout for each viewport
  for (const [viewportName, viewportData] of Object.entries(viewports)) {
    console.log(`Creating precise layout for ${viewportName} with assets...`);
    
    // Validate viewport data structure
    if (!viewportData || !viewportData.device) {
      console.warn(`Skipping invalid viewport data for ${viewportName}:`, viewportData);
      continue;
    }

    // Extract data with comprehensive fallbacks
    const page = viewportData.page || {};
    const elements = viewportData.elements || [];
    const assets = viewportData.assets || [];
    const scaleFactor = page.scale_factor || 1;
    
    // Ensure 1440px for desktop
    const isDesktop = viewportData.device === 'Desktop';
    const frameWidth = isDesktop ? 1440 : (viewportData.viewport && viewportData.viewport.width ? viewportData.viewport.width : 375);
    const frameHeight = Math.max(page.viewport_height || 900, 800);

    // Create viewport frame with precise dimensions
    const viewportFrame = figma.createFrame();
    viewportFrame.name = `📱 ${viewportData.device} (${frameWidth}px)${scaleFactor !== 1 ? ` - Scaled ${scaleFactor.toFixed(2)}x` : ''}`;
    viewportFrame.resize(frameWidth, frameHeight);
    viewportFrame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    viewportFrame.x = currentX;
    viewportFrame.y = 0;

    // Disable auto layout for precise positioning
    viewportFrame.layoutMode = 'NONE';
    viewportFrame.clipsContent = true;

    mainSection.appendChild(viewportFrame);

    // Add metadata as comments
    if (assets.length > 0) {
      const assetComment = `Assets captured: ${assets.length} images\nScale factor: ${scaleFactor}\nOriginal width: ${page.actual_width || frameWidth}px`;
      // Note: figma.createComment is not available in plugins, but we can add this info to frame name
      viewportFrame.name += ` (${assets.length} assets)`;
    }

    // Create elements with asset support
    createElementsInFrame(viewportFrame, elements, assets);

    // Update X position for next frame
    currentX += frameWidth + frameSpacing;

    console.log(`Created ${viewportName} layout: ${elements.length} elements, ${assets.length} assets`);
  }

  // Focus on the created section
  figma.viewport.scrollAndZoomIntoView([mainSection]);

  console.log(`Created pixel-perfect layouts for ${Object.keys(viewports).length} viewports with comprehensive asset support`);
  
  resolve();
  });
}

async function createElementsInFrame(parentFrame, elements, assets) {
  console.log(`Creating ${elements.length} elements with ${assets.length} assets...`);
  
  // Sort elements by z-index and depth for proper layering
  const sortedElements = [...elements].sort((a, b) => {
    const aZ = (a.visual_hierarchy && a.visual_hierarchy.zIndex) || 0;
    const bZ = (b.visual_hierarchy && b.visual_hierarchy.zIndex) || 0;
    if (aZ !== bZ) return aZ - bZ;
    return ((a.visual_hierarchy && a.visual_hierarchy.depth) || 0) - ((b.visual_hierarchy && b.visual_hierarchy.depth) || 0);
  });

  // Create elements in proper order
  for (const element of sortedElements.slice(0, 50)) { // Limit for performance
    try {
      const node = await createAdvancedNodeFromElement(element, assets);
      if (node) {
        parentFrame.appendChild(node);
        console.log(`Created node: ${node.name} at (${node.x}, ${node.y})`);
      }
    } catch (error) {
      console.warn('Failed to create node for element:', element.tagName, error);
    }
  }
  
  console.log(`Successfully created ${parentFrame.children.length} nodes in frame`);
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
  // Enhanced color parsing for CSS colors (compatible version)
  if (!colorString) return { r: 0, g: 0, b: 0 };
  
  // Handle hex colors
  if (colorString.indexOf('#') === 0) {
    const hex = colorString.substring(1);
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;
      return { r: r, g: g, b: b };
    }
  }
  
  // Handle rgb/rgba colors - use indexOf instead of modern regex
  if (colorString.indexOf('rgb') === 0) {
    const start = colorString.indexOf('(');
    const end = colorString.indexOf(')');
    if (start !== -1 && end !== -1) {
      const values = colorString.substring(start + 1, end).split(',');
      if (values.length >= 3) {
        return {
          r: parseInt(values[0].trim()) / 255,
          g: parseInt(values[1].trim()) / 255,
          b: parseInt(values[2].trim()) / 255
        };
      }
    }
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
  
  const lowerColor = colorString.toLowerCase();
  if (namedColors[lowerColor]) {
    return namedColors[lowerColor];
  }
  
  return { r: 0, g: 0, b: 0 };
}

async function createAdvancedNodeFromElement(element, assets) {
  try {
    console.log(`Creating pixel-perfect node for ${element.tagName} with assets...`);
    
    // Determine the appropriate Figma node type based on enhanced analysis
    const nodeType = determineAdvancedNodeType(element);
    
    if (nodeType === 'TEXT') {
      return await createPreciseTextNode(element);
    } else if (nodeType === 'IMAGE') {
      return await createPreciseImageNode(element, assets);
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
    textNode.fontName = { family: fontFamily, style: fontWeight };
  } catch (error) {
    console.warn(`Font loading failed for ${fontFamily}, using Inter Regular:`, error);
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
    textNode.fontName = { family: 'Inter', style: 'Regular' };
  }
  
  // Set text content after font is loaded
  const textContent = (element.textContent && element.textContent.trim()) || (element.innerText && element.innerText.trim()) || 'Sample Text';
  textNode.characters = textContent;
  // Apply typography settings
  const fontSize = parseFloat((element.typography && element.typography.fontSize) || '16');
  textNode.fontSize = Math.max(fontSize, 8);
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

async function createPreciseImageNode(element, assets) {
  try {
    // Find the corresponding asset for this element
    const elementAsset = assets.find(asset => asset.elementId === element.id);
    
    if (elementAsset && elementAsset.base64) {
      // Create rectangle for image
      const imageNode = figma.createRectangle();
      imageNode.name = `${element.tagName}: ${(element.attributes && element.attributes.alt) || 'Image'}`;
      
      // Set precise dimensions
      imageNode.resize(
        Math.max((element.position && element.position.width) || 100, 1),
        Math.max((element.position && element.position.height) || 100, 1)
      );
      
      // Set precise position
      imageNode.x = (element.position && element.position.x) || 0;
      imageNode.y = (element.position && element.position.y) || 0;
      
      try {
        // Convert base64 to image
        const base64Data = elementAsset.base64.split(',')[1];
        const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const imageHash = figma.createImage(imageBytes).hash;
        
        // Apply image fill
        imageNode.fills = [{
          type: 'IMAGE',
          imageHash: imageHash,
          scaleMode: (element.computedStyles && element.computedStyles.objectFit === 'cover') ? 'CROP' : 'FIT'
        }];
        
        console.log(`Successfully applied image asset for ${element.id}`);
        
      } catch (imageError) {
        console.warn('Failed to apply image asset, using placeholder:', imageError);
        // Fallback to placeholder
        imageNode.fills = [{ 
          type: 'SOLID', 
          color: parseColor('#f0f0f0') 
        }];
      }
      
      // Apply border radius from computed styles
      if (element.computedStyles && element.computedStyles.borderRadius) {
        const radius = parseFloat(element.computedStyles.borderRadius) || 0;
        if (radius > 0) {
          imageNode.cornerRadius = radius;
        }
      }
      
      // Apply other visual properties
      if (element.visual && element.visual.opacity && element.visual.opacity < 1) {
        imageNode.opacity = Math.max(element.visual.opacity, 0.01);
      }
      
      return imageNode;
      
    } else {
      // Create placeholder frame when no asset available
      const frame = figma.createFrame();
      frame.name = `${element.tagName} Image Placeholder`;
      
      frame.resize(
        Math.max((element.position && element.position.width) || 100, 20),
        Math.max((element.position && element.position.height) || 100, 20)
      );
      
      frame.x = (element.position && element.position.x) || 0;
      frame.y = (element.position && element.position.y) || 0;
      
      // Placeholder styling
      frame.fills = [{ 
        type: 'SOLID', 
        color: { r: 0.9, g: 0.9, b: 0.9 } 
      }];
      
      // Add placeholder text
      const placeholderText = figma.createText();
      await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
      placeholderText.characters = '🖼️ ' + ((element.attributes && element.attributes.alt) || 'Image');
      placeholderText.fontSize = 12;
      placeholderText.fills = [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }];
      placeholderText.textAlignHorizontal = 'CENTER';
      placeholderText.textAlignVertical = 'CENTER';
      
      frame.appendChild(placeholderText);
      
      return frame;
    }
    
  } catch (error) {
    console.error('Error creating precise image node:', error);
    return null;
  }
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
  } catch (error) {
    return 'Website';
  }
}

async function applyRealStyling(figmaNode, element) {
  console.log('Applying real CSS styling to', element.tagName);
  
  try {
    // Apply visual properties from actual CSS
    if (element.visual) {
      const visual = element.visual;
      
      // Apply background color
      if (visual.backgroundColor && visual.backgroundColor !== 'transparent') {
        const bgColor = parseColor(visual.backgroundColor);
        if (bgColor && figmaNode.fills) {
          figmaNode.fills = [{
            type: 'SOLID',
            color: bgColor
          }];
        }
      }
      
      // Apply border radius
      if (visual.borderRadius && visual.borderRadius !== '0px') {
        const radius = parsePixelValue(visual.borderRadius);
        if (radius > 0 && figmaNode.cornerRadius !== undefined) {
          figmaNode.cornerRadius = radius;
        }
      }
      
      // Apply opacity
      if (visual.opacity && visual.opacity !== '1') {
        const opacityValue = parseFloat(visual.opacity);
        if (!isNaN(opacityValue) && figmaNode.opacity !== undefined) {
          figmaNode.opacity = Math.max(0, Math.min(1, opacityValue));
        }
      }
    }
    
    // Apply typography for text nodes
    if (element.typography && figmaNode.fontName) {
      const typography = element.typography;
      
      // Ensure font is loaded
      await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
      figmaNode.fontName = { family: 'Inter', style: 'Regular' };
      
      // Apply font size
      if (typography.fontSize) {
        const fontSize = parsePixelValue(typography.fontSize);
        if (fontSize > 0) {
          figmaNode.fontSize = Math.max(8, Math.min(200, fontSize));
        }
      }
      
      // Apply text color
      if (typography.color) {
        const textColor = parseColor(typography.color);
        if (textColor && figmaNode.fills) {
          figmaNode.fills = [{
            type: 'SOLID',
            color: textColor
          }];
        }
      }
      
      // Apply line height
      if (typography.lineHeight && typography.lineHeight !== '1.5') {
        const lineHeight = parseLineHeight(typography.lineHeight);
        if (lineHeight > 0) {
          figmaNode.lineHeight = { value: lineHeight, unit: 'PIXELS' };
        }
      }
      
      // Apply text alignment
      if (typography.textAlign) {
        const alignment = mapTextAlign(typography.textAlign);
        figmaNode.textAlignHorizontal = alignment;
      }
    }
    
    // Apply layout properties for containers
    if (element.layout_detection) {
      const layout = element.layout_detection;
      
      // Apply flex properties if it's a flex container
      if (layout.isFlexContainer && figmaNode.layoutMode !== undefined) {
        figmaNode.layoutMode = 'HORIZONTAL'; // Default to horizontal
        figmaNode.itemSpacing = 10;
        figmaNode.paddingLeft = 10;
        figmaNode.paddingRight = 10;
        figmaNode.paddingTop = 10;
        figmaNode.paddingBottom = 10;
      }
    }
    
  } catch (error) {
    console.error('Error applying real styling:', error);
  }
}

// Utility functions for precise styling

function mapWebFontToFigma(webFont) {
  // Use Inter for maximum compatibility - it's always available in Figma
  return 'Inter';
}

function mapFontWeight(weight) {
  // Use Regular for maximum compatibility - it's always available
  return 'Regular';
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