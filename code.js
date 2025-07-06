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
  const { tagName, textContent, figma_node_type, layout, visual, typography } = element;
  
  let node;
  
  try {
    // Create appropriate node type based on content and structure
    if (figma_node_type === 'TEXT' && textContent && textContent.trim()) {
      node = figma.createText();
      
      // Load font (with fallback)
      const fontFamily = element.figma_fonts && element.figma_fonts[0] || 'Inter';
      const fontStyle = typography?.fontWeight === 'bold' ? 'Bold' : 'Regular';
      
      try {
        await figma.loadFontAsync({ family: fontFamily, style: fontStyle });
        node.fontName = { family: fontFamily, style: fontStyle };
      } catch (fontError) {
        await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
        node.fontName = { family: 'Inter', style: 'Regular' };
      }
      
      node.characters = textContent.trim().substring(0, 500);
      node.fontSize = element.figma_font_size || 16;
      
      // Apply text color
      if (element.figma_text_color) {
        node.fills = [{ type: 'SOLID', color: element.figma_text_color }];
      }
      
      // Set text alignment
      if (typography?.textAlign) {
        const alignMap = { 'left': 'LEFT', 'center': 'CENTER', 'right': 'RIGHT' };
        node.textAlignHorizontal = alignMap[typography.textAlign] || 'LEFT';
      }
      
    } else if (figma_node_type === 'FRAME' || element.isFlexContainer || element.isGridContainer) {
      node = figma.createFrame();
      
      // Apply auto layout for flex containers
      if (element.isFlexContainer && layout?.flexDirection) {
        node.layoutMode = layout.flexDirection === 'row' ? 'HORIZONTAL' : 'VERTICAL';
        
        // Apply flex properties
        if (layout.justifyContent) {
          const justifyMap = {
            'flex-start': 'MIN',
            'center': 'CENTER', 
            'flex-end': 'MAX',
            'space-between': 'SPACE_BETWEEN'
          };
          node.primaryAxisAlignItems = justifyMap[layout.justifyContent] || 'MIN';
        }
        
        if (layout.alignItems) {
          const alignMap = {
            'flex-start': 'MIN',
            'center': 'CENTER',
            'flex-end': 'MAX'
          };
          node.counterAxisAlignItems = alignMap[layout.alignItems] || 'MIN';
        }
        
        // Apply gap
        if (layout.gap) {
          node.itemSpacing = element.parse_pixel_value?.(layout.gap) || 0;
        }
      }
      
    } else {
      node = figma.createRectangle();
    }
    
    // Set node name
    const className = element.className ? `.${element.className.split(' ')[0]}` : '';
    node.name = `${tagName}${className}`;
    
    // Apply positioning and dimensions
    node.x = element.figma_x || 0;
    node.y = element.figma_y || 0;
    node.resize(element.figma_width || 100, element.figma_height || 20);
    
    // Apply background color
    if (element.figma_bg_color && node.fills !== undefined) {
      node.fills = [{ type: 'SOLID', color: element.figma_bg_color }];
    }
    
    // Apply border radius
    if (visual?.borderRadius && node.cornerRadius !== undefined) {
      const radius = element.parse_pixel_value?.(visual.borderRadius) || 0;
      node.cornerRadius = radius;
    }
    
    // Apply opacity
    if (visual?.opacity && visual.opacity !== '1') {
      node.opacity = parseFloat(visual.opacity) || 1;
    }
    
    return node;
    
  } catch (error) {
    console.warn('Error creating advanced node:', error);
    return null;
  }
}

function extractDomainName(url) {
  try {
    const domain = new URL(url).hostname;
    return domain.replace('www.', '').split('.')[0];
  } catch {
    return 'Website';
  }
}

// Show the plugin UI
figma.showUI(__html__, { width: 400, height: 350 });