// Enhanced Figma plugin with both website capture and JSON-to-Figma conversion
console.log('Enhanced Figma plugin loaded with JSON support');

// Load the enhanced UI
figma.showUI(__html__, { width: 450, height: 500 });

// Listen for messages from the plugin UI
figma.ui.onmessage = function(msg) {
  console.log('Received message:', msg);

  if (msg.type === 'createFromJSON') {
    console.log('Creating Figma design from JSON input');
    createFigmaFromJSON(msg.jsonData)
      .then(function() {
        figma.ui.postMessage({ 
          type: 'captureComplete', 
          success: true,
          message: 'JSON design created successfully!'
        });
        figma.notify('JSON to Figma conversion complete!', { timeout: 3000 });
      })
      .catch(function(error) {
        console.error('Error creating from JSON:', error);
        figma.ui.postMessage({ 
          type: 'captureComplete', 
          success: false,
          error: 'JSON conversion failed: ' + error.message
        });
        figma.notify('JSON conversion failed: ' + error.message, { error: true });
      });
      
  } else if (msg.type === 'captureResponsive') {
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
      console.error('Error during responsive capture:', error);
      figma.ui.postMessage({ 
        type: 'captureComplete', 
        success: false,
        error: 'Capture failed: ' + error.message
      });
      figma.notify('Capture failed: ' + error.message, { error: true });
    });
  }
};

function createResponsiveFigmaLayouts(data) {
  return new Promise(function(resolve) {
    console.log('Creating responsive Figma layouts...');

    var url = data.url;
    var viewports = data.viewports;
    var mainSectionName = extractDomainName(url);

    // Create a main section to organize all responsive layouts
    var mainSection = figma.createSection();
    mainSection.name = '🌐 ' + mainSectionName + ' - Responsive Layouts';
    figma.currentPage.appendChild(mainSection);

    var frameSpacing = 100;
    var currentX = 0;

    // Create layout for each viewport
    for (var viewportName in viewports) {
      var viewportData = viewports[viewportName];
      console.log('Creating layout for ' + viewportName + '...');
      
      if (!viewportData || !viewportData.device) {
        console.warn('Skipping invalid viewport data for ' + viewportName);
        continue;
      }

      var page = viewportData.page || {};
      var elements = viewportData.elements || [];
      var scaleFactor = page.scale_factor || 1;
      
      var isDesktop = viewportData.device === 'Desktop';
      var frameWidth = isDesktop ? 1440 : (viewportData.viewport && viewportData.viewport.width ? viewportData.viewport.width : 375);
      var frameHeight = Math.max(page.viewport_height || 900, 800);

      // Create viewport frame
      var viewportFrame = figma.createFrame();
      viewportFrame.name = '📱 ' + viewportData.device + ' (' + frameWidth + 'px)';
      viewportFrame.resize(frameWidth, frameHeight);
      viewportFrame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
      viewportFrame.x = currentX;
      viewportFrame.y = 0;
      viewportFrame.layoutMode = 'NONE';
      viewportFrame.clipsContent = true;

      mainSection.appendChild(viewportFrame);

      // Create elements with improved error handling
      createElementsInFrame(viewportFrame, elements);

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
  
  var sortedElements = elements.slice().sort(function(a, b) {
    var aZ = (a.visual_hierarchy && a.visual_hierarchy.zIndex) || 0;
    var bZ = (b.visual_hierarchy && b.visual_hierarchy.zIndex) || 0;
    if (aZ !== bZ) return aZ - bZ;
    return ((a.visual_hierarchy && a.visual_hierarchy.depth) || 0) - ((b.visual_hierarchy && b.visual_hierarchy.depth) || 0);
  });

  var created = 0;
  for (var i = 0; i < Math.min(sortedElements.length, 50); i++) {
    var element = sortedElements[i];
    try {
      var node = createNodeFromElement(element);
      if (node) {
        parentFrame.appendChild(node);
        created++;
      }
    } catch (error) {
      console.warn('Failed to create node for element:', element.tagName || 'unknown', error);
    }
  }

  console.log('Successfully created ' + created + ' nodes from ' + sortedElements.length + ' elements');
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
      // Create text node with improved font handling
      node = figma.createText();
      
      try {
        node.characters = textContent.trim().substring(0, 200);
        if (element.typography && element.typography.fontSize) {
          node.fontSize = Math.max(parseFloat(element.typography.fontSize) || 16, 8);
        } else {
          node.fontSize = 16;
        }
      } catch (fontError) {
        console.warn('Font error, using defaults:', fontError);
        node.characters = textContent.trim().substring(0, 200);
        node.fontSize = 16;
      }
    } else {
      // Create rectangle node
      node = figma.createRectangle();
    }

    // Set position and size with safe defaults
    node.x = layout.x || 0;
    node.y = layout.y || 0;
    var width = Math.max(layout.width || 100, 1);
    var height = Math.max(layout.height || 20, 1);
    node.resize(width, height);

    // Apply basic styling
    if (visual.backgroundColor && visual.backgroundColor !== 'rgba(0, 0, 0, 0)' && visual.backgroundColor !== 'transparent') {
      var bgColor = parseColor(visual.backgroundColor);
      if (bgColor) {
        node.fills = [{ type: 'SOLID', color: bgColor }];
      }
    } else if (node.type === 'RECTANGLE') {
      // Give rectangles a light background if no background is specified
      node.fills = [{ type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.95 } }];
    }

    // Set descriptive name
    var elementName = element.tagName || 'Element';
    if (element.className) {
      elementName += '.' + element.className.split(' ')[0];
    }
    if (textContent && textContent.trim()) {
      elementName += ' (' + textContent.trim().substring(0, 20) + ')';
    }
    node.name = elementName;

    console.log('Created node: ' + elementName + ' at (' + node.x + ', ' + node.y + ') size ' + width + 'x' + height);
    return node;
    
  } catch (error) {
    console.warn('Error in createNodeFromElement:', error);
    return null;
  }
}

function parseColor(colorString) {
  if (!colorString) return null;

  // Handle hex colors
  if (colorString.startsWith('#')) {
    var hex = colorString.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map(function(c) { return c + c; }).join('');
    }
    if (hex.length === 6) {
      var r = parseInt(hex.substr(0, 2), 16) / 255;
      var g = parseInt(hex.substr(2, 2), 16) / 255;
      var b = parseInt(hex.substr(4, 2), 16) / 255;
      return { r: r, g: g, b: b };
    }
  }

  // Handle rgb/rgba colors
  var rgbMatch = colorString.match(/rgba?\(([^)]+)\)/);
  if (rgbMatch) {
    var values = rgbMatch[1].split(',').map(function(v) { return parseFloat(v.trim()); });
    if (values.length >= 3) {
      return {
        r: values[0] / 255,
        g: values[1] / 255,
        b: values[2] / 255
      };
    }
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

// JSON to Figma conversion functions
function createFigmaFromJSON(jsonData) {
  return new Promise(function(resolve, reject) {
    try {
      console.log('Creating Figma design from JSON structure...');
      
      // Create main frame
      var mainFrame = figma.createFrame();
      mainFrame.name = jsonData.name || 'JSON Generated Design';
      mainFrame.resize(jsonData.width || 800, jsonData.height || 600);
      mainFrame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
      
      figma.currentPage.appendChild(mainFrame);
      
      // Process children elements
      if (jsonData.children && jsonData.children.length > 0) {
        processJSONChildren(mainFrame, jsonData.children);
      }
      
      // Focus on the created frame
      figma.viewport.scrollAndZoomIntoView([mainFrame]);
      
      console.log('JSON to Figma conversion complete - created ' + (jsonData.children ? jsonData.children.length : 0) + ' elements');
      resolve();
      
    } catch (error) {
      console.error('Error in createFigmaFromJSON:', error);
      reject(error);
    }
  });
}

function processJSONChildren(parentFrame, children) {
  var yOffset = 20;
  var created = 0;
  
  for (var i = 0; i < children.length; i++) {
    var child = children[i];
    var node = null;
    
    try {
      if (child.type === 'text') {
        node = figma.createText();
        node.characters = child.content || 'Sample Text';
        node.fontSize = Math.max(child.fontSize || 16, 8);
        
        if (child.color) {
          var textColor = parseColor(child.color);
          if (textColor) {
            node.fills = [{ type: 'SOLID', color: textColor }];
          }
        }
        
        // Set text size
        var textWidth = child.width || Math.max(node.characters.length * 8, 100);
        var textHeight = Math.max(child.height || 30, node.fontSize * 1.2);
        node.resize(textWidth, textHeight);
        
      } else if (child.type === 'rectangle') {
        node = figma.createRectangle();
        node.resize(child.width || 200, child.height || 100);
        
        if (child.color) {
          var rectColor = parseColor(child.color);
          if (rectColor) {
            node.fills = [{ type: 'SOLID', color: rectColor }];
          }
        } else {
          // Default light background for rectangles
          node.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.95 } }];
        }
        
        if (child.cornerRadius) {
          node.cornerRadius = child.cornerRadius;
        }
        
      } else if (child.type === 'frame') {
        node = figma.createFrame();
        node.resize(child.width || 300, child.height || 200);
        
        if (child.backgroundColor) {
          var bgColor = parseColor(child.backgroundColor);
          if (bgColor) {
            node.fills = [{ type: 'SOLID', color: bgColor }];
          }
        }
        
        // Process nested children
        if (child.children && child.children.length > 0) {
          processJSONChildren(node, child.children);
        }
      }
      
      if (node) {
        // Position the node
        node.x = child.x !== undefined ? child.x : 20;
        node.y = child.y !== undefined ? child.y : yOffset;
        node.name = child.name || (child.type + '_' + (i + 1));
        
        parentFrame.appendChild(node);
        created++;
        
        // Update y offset for next element if no specific position
        if (child.y === undefined) {
          yOffset += (child.height || 50) + 20;
        }
        
        console.log('Created JSON node: ' + node.name + ' at (' + node.x + ', ' + node.y + ')');
      }
      
    } catch (error) {
      console.warn('Failed to create JSON element:', child, error);
    }
  }
  
  console.log('Processed ' + created + ' children in frame: ' + parentFrame.name);
}