// Figma plugin main code - handles communication with UI and Figma API
console.log('Figma plugin loaded');

// Show the plugin UI
figma.showUI(__html__, { width: 450, height: 400 });

// Listen for messages from the plugin UI
figma.ui.onmessage = function(msg) {
  console.log('Received message:', msg);

  if (msg.type === 'captureResponsive') {
    var url = msg.url;
    var viewports = msg.viewports;
    
    figma.notify('Starting responsive capture for ' + viewports.length + ' viewports...', { timeout: 2000 });

    console.log('Fetching responsive website data from server...');
    fetch('http://localhost:5000/api/capture-responsive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: url, viewports: viewports }),
    })
    .then(function(response) {
      if (!response.ok) {
        throw new Error('Server error: ' + response.status);
      }
      return response.json();
    })
    .then(function(data) {
      console.log('Received responsive data from server:', data);

      if (data.error) {
        throw new Error(data.error);
      }

      return createResponsiveFigmaLayouts(data);
    })
    .then(function() {
      figma.ui.postMessage({ 
        type: 'captureComplete', 
        success: true,
        message: 'Website captured and layouts created successfully!'
      });
      figma.notify('Responsive capture complete! Created layouts for all viewports.', { timeout: 3000 });
    })
    .catch(function(error) {
      console.error('Capture error:', error);
      figma.ui.postMessage({ 
        type: 'captureComplete', 
        success: false,
        error: error.message 
      });
      figma.notify('Capture failed: ' + error.message, { error: true });
    });
  }
};

function createResponsiveFigmaLayouts(data) {
  return new Promise(function(resolve) {
    console.log('Creating pixel-perfect responsive Figma layouts...');

    var url = data.url;
    var viewports = data.viewports;
    var mainSectionName = extractDomainName(url);

    // Create a main section to organize all responsive layouts
    var mainSection = figma.createSection();
    mainSection.name = '🌐 ' + mainSectionName + ' - Responsive Layouts';
    figma.currentPage.appendChild(mainSection);

    var frameSpacing = 100; // Space between frames
    var currentX = 0;

    // Create layout for each viewport
    var viewportNames = Object.keys(viewports);
    for (var i = 0; i < viewportNames.length; i++) {
      var viewportName = viewportNames[i];
      var viewportData = viewports[viewportName];
      
      console.log('Creating layout for ' + viewportName + '...');
      
      // Validate viewport data structure
      if (!viewportData || !viewportData.device) {
        console.warn('Skipping invalid viewport data for ' + viewportName + ':', viewportData);
        continue;
      }

      // Extract data with comprehensive fallbacks
      var page = viewportData.page || {};
      var elements = viewportData.elements || [];
      var scaleFactor = page.scale_factor || 1;
      
      // Ensure proper dimensions
      var isDesktop = viewportData.device === 'Desktop';
      var frameWidth = isDesktop ? 1440 : (viewportData.viewport && viewportData.viewport.width ? viewportData.viewport.width : 375);
      var frameHeight = Math.max(page.viewport_height || 900, 800);

      // Create viewport frame with precise dimensions
      var viewportFrame = figma.createFrame();
      viewportFrame.name = '📱 ' + viewportData.device + ' (' + frameWidth + 'px)' + (scaleFactor !== 1 ? ' - Scaled ' + scaleFactor.toFixed(2) + 'x' : '');
      viewportFrame.resize(frameWidth, frameHeight);
      viewportFrame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
      viewportFrame.x = currentX;
      viewportFrame.y = 0;

      // Disable auto layout for precise positioning
      viewportFrame.layoutMode = 'NONE';
      viewportFrame.clipsContent = true;

      mainSection.appendChild(viewportFrame);

      // Create elements with asset support
      createElementsInFrame(viewportFrame, elements);

      // Update X position for next frame
      currentX += frameWidth + frameSpacing;

      console.log('Created ' + viewportName + ' layout: ' + elements.length + ' elements');
    }

    // Focus on the created section
    figma.viewport.scrollAndZoomIntoView([mainSection]);

    console.log('Created layouts for ' + Object.keys(viewports).length + ' viewports');
    resolve();
  });
}

function createElementsInFrame(parentFrame, elements) {
  console.log('Creating ' + elements.length + ' elements...');
  
  // Sort elements by z-index and depth for proper layering
  var sortedElements = elements.slice().sort(function(a, b) {
    var aZ = (a.visual_hierarchy && a.visual_hierarchy.zIndex) || 0;
    var bZ = (b.visual_hierarchy && b.visual_hierarchy.zIndex) || 0;
    if (aZ !== bZ) return aZ - bZ;
    return ((a.visual_hierarchy && a.visual_hierarchy.depth) || 0) - ((b.visual_hierarchy && b.visual_hierarchy.depth) || 0);
  });

  // Process elements with a reasonable limit for performance
  for (var i = 0; i < Math.min(sortedElements.length, 50); i++) {
    var element = sortedElements[i];
    try {
      var node = createNodeFromElement(element);
      if (node) {
        parentFrame.appendChild(node);
      }
    } catch (error) {
      console.warn('Failed to create node for element:', element, error);
    }
  }

  console.log('Created nodes for ' + Math.min(sortedElements.length, 50) + ' elements');
}

function createNodeFromElement(element) {
  try {
    if (!element) {
      return null;
    }

    // Handle both layout and position data structures
    var layout = element.layout || element.position || {};
    var visual = element.visual_styles || element.visual || {};
    var textContent = element.textContent;

    var node;

    // Create appropriate node type
    if (textContent && textContent.trim()) {
      // Create text node
      node = figma.createText();
      
      // Load default font
      figma.loadFontAsync({ family: "Inter", style: "Regular" })
        .then(function() {
          node.characters = textContent.trim().substring(0, 200); // Limit text length
          if (element.typography && element.typography.fontSize) {
            node.fontSize = parseFloat(element.typography.fontSize) || 16;
          }
        })
        .catch(function() {
          node.characters = textContent.trim().substring(0, 200);
        });
    } else {
      // Create rectangle node
      node = figma.createRectangle();
    }

    // Set position and size
    if (layout.x !== undefined) node.x = layout.x;
    if (layout.y !== undefined) node.y = layout.y;
    if (layout.width !== undefined && layout.height !== undefined) {
      node.resize(Math.max(layout.width, 1), Math.max(layout.height, 1));
    }

    // Apply basic styling
    if (visual.backgroundColor) {
      var bgColor = parseColor(visual.backgroundColor);
      node.fills = [{ type: 'SOLID', color: bgColor }];
    }

    // Set name
    node.name = element.tagName || 'Element';

    return node;
    
  } catch (error) {
    console.warn('Error in createNodeFromElement:', error);
    return null;
  }
}

function parseColor(colorString) {
  if (!colorString) return { r: 0, g: 0, b: 0 };
  
  if (colorString.indexOf('#') === 0) {
    var hex = colorString.substring(1);
    var r = parseInt(hex.substring(0, 2), 16) / 255;
    var g = parseInt(hex.substring(2, 4), 16) / 255;
    var b = parseInt(hex.substring(4, 6), 16) / 255;
    return { r: r, g: g, b: b };
  }
  
  return { r: 0, g: 0, b: 0 };
}

function extractDomainName(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch (e) {
    return 'Website';
  }
}