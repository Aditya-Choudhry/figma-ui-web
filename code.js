// Figma plugin main code - handles communication with UI and Figma API
console.log('Figma plugin loaded');

// Listen for messages from the plugin UI
figma.ui.onmessage = async (msg) => {
  console.log('Received message:', msg);
  
  if (msg.type === 'captureWebsite') {
    const { url } = msg;
    
    try {
      figma.notify('Starting website capture...', { timeout: 2000 });
      
      // Send URL to our capture server
      console.log('Fetching website data from server...');
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
      console.log('Received data from server:', data);
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Process the captured data and create Figma nodes
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

// Show the plugin UI
figma.showUI(__html__, { width: 400, height: 300 });