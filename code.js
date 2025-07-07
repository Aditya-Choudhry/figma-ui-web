// Figma plugin main code - handles communication with UI and Figma API
console.log('Figma plugin loaded');

// Show the plugin UI with inline HTML (no external file dependencies)
var simpleHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Website to Figma</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      min-height: 260px;
    }
    .container { max-width: 360px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 24px; }
    .header h1 { margin: 0 0 8px 0; font-size: 24px; font-weight: 600; }
    .header p { margin: 0; opacity: 0.9; font-size: 14px; }
    .tabs { display: flex; margin-bottom: 20px; border-radius: 8px; background: rgba(255,255,255,0.1); }
    .tab { flex: 1; padding: 8px 12px; text-align: center; cursor: pointer; transition: all 0.2s; }
    .tab.active { background: rgba(255,255,255,0.2); border-radius: 6px; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; margin-bottom: 6px; font-weight: 500; font-size: 14px; }
    .form-group input { width: 100%; padding: 12px; border: none; border-radius: 6px; font-size: 14px; box-sizing: border-box; }
    .btn { width: 100%; padding: 12px 16px; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; margin-bottom: 12px; }
    .btn-primary { background: rgba(255, 255, 255, 0.2); color: white; border: 1px solid rgba(255, 255, 255, 0.3); }
    .btn-primary:hover { background: rgba(255, 255, 255, 0.3); }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .status { margin-top: 12px; padding: 8px 12px; border-radius: 4px; font-size: 13px; text-align: center; }
    .status.error { background: rgba(220, 38, 38, 0.2); border: 1px solid rgba(220, 38, 38, 0.3); }
    .status.success { background: rgba(34, 197, 94, 0.2); border: 1px solid rgba(34, 197, 94, 0.3); }
    .status.loading { background: rgba(59, 130, 246, 0.2); border: 1px solid rgba(59, 130, 246, 0.3); }
    .checkbox-group { display: flex; flex-direction: column; gap: 8px; }
    .checkbox-label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; padding: 8px; border-radius: 6px; background: rgba(255, 255, 255, 0.1); transition: background 0.2s ease; }
    .checkbox-label:hover { background: rgba(255, 255, 255, 0.2); }
    .checkbox-label input[type="checkbox"] { margin: 0; width: 16px; height: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Website to Figma</h1>
      <p>Capture and convert any website to Figma</p>
    </div>
    <div class="form-group">
      <label for="websiteUrl">Website URL</label>
      <input type="url" id="websiteUrl" placeholder="https://example.com" value="https://example.com">
    </div>
    <div class="form-group">
      <label>Capture Viewports</label>
      <div class="checkbox-group">
        <label class="checkbox-label">
          <input type="checkbox" id="desktop" checked>
          Desktop (1440px)
        </label>
        <label class="checkbox-label">
          <input type="checkbox" id="tablet" checked>
          Tablet (768px)
        </label>
        <label class="checkbox-label">
          <input type="checkbox" id="mobile" checked>
          Mobile (375px)
        </label>
      </div>
    </div>
    <button id="captureBtn" class="btn btn-primary">Capture Responsive Views</button>
    <div id="status" class="status">Enter a website URL and click capture to start</div>
  </div>
  <script>
    console.log('Compatible UI loaded - no await syntax');
    var captureBtn = document.getElementById('captureBtn');
    var urlInput = document.getElementById('websiteUrl');
    var status = document.getElementById('status');

    captureBtn.onclick = function() {
      var url = urlInput.value.trim();
      if (!url) {
        updateStatus('Please enter a website URL', 'error');
        return;
      }
      if (url.indexOf('http://') !== 0 && url.indexOf('https://') !== 0) {
        updateStatus('Please enter a valid URL (starting with http:// or https://)', 'error');
        return;
      }
      var selectedViewports = [];
      if (document.getElementById('desktop').checked) selectedViewports.push('desktop');
      if (document.getElementById('tablet').checked) selectedViewports.push('tablet');
      if (document.getElementById('mobile').checked) selectedViewports.push('mobile');
      if (selectedViewports.length === 0) {
        updateStatus('Please select at least one viewport', 'error');
        return;
      }
      captureBtn.disabled = true;
      updateStatus('Starting capture for ' + selectedViewports.length + ' viewports...', 'loading');
      parent.postMessage({ pluginMessage: { type: 'captureResponsive', url: url, viewports: selectedViewports } }, '*');
    };

    window.onmessage = function(event) {
      if (!event.data.pluginMessage) return;
      var messageData = event.data.pluginMessage;
      if (messageData.type === 'captureComplete') {
        captureBtn.disabled = false;
        if (messageData.success) {
          updateStatus(messageData.message || 'Website captured successfully!', 'success');
        } else {
          updateStatus(messageData.error || 'Capture failed', 'error');
        }
      }
    };

    function updateStatus(message, type) {
      status.textContent = message;
      status.className = 'status ' + (type || 'info');
    }
  </script>
</body>
</html>
`;

figma.showUI(simpleHTML, { width: 450, height: 400 });

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
    var var element = sortedElements[i];
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
      // Create text node with proper font loading
      node = figma.createText();

      // Set text content immediately with default font
      try {
        node.characters = textContent.trim().substring(0, 200); // Limit text length
        if (element.typography && element.typography.fontSize) {
          node.fontSize = Math.max(parseFloat(element.typography.fontSize) || 16, 8);
        } else {
          node.fontSize = 16;
        }
      } catch (fontError) {
        console.warn('Font loading failed, using default:', fontError);
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

    // Apply comprehensive color styling
    var hasAppliedFill = false;

    // Check background color
    if (visual.backgroundColor && visual.backgroundColor !== 'rgba(0, 0, 0, 0)' && visual.backgroundColor !== 'transparent') {
      var bgColor = parseColor(visual.backgroundColor);
      if (bgColor) {
        node.fills = [{ type: 'SOLID', color: bgColor }];
        hasAppliedFill = true;
      }
    }

    // Check for border colors
    var borderColors = [
      visual.borderColor,
      visual.borderTopColor,
      visual.borderRightColor,
      visual.borderBottomColor,
      visual.borderLeftColor
    ];

    for (var i = 0; i < borderColors.length; i++) {
      var borderColor = borderColors[i];
      if (borderColor && borderColor !== 'rgba(0, 0, 0, 0)' && borderColor !== 'transparent' && borderColor !== 'currentColor') {
        var bColor = parseColor(borderColor);
        if (bColor && !hasAppliedFill) {
          node.fills = [{ type: 'SOLID', color: bColor }];
          hasAppliedFill = true;
          break;
        }
      }
    }

    // Check text color for text nodes
    if (node.type === 'TEXT' && visual.color && visual.color !== 'rgba(0, 0, 0, 0)') {
      var textColor = parseColor(visual.color);
      if (textColor) {
        node.fills = [{ type: 'SOLID', color: textColor }];
        hasAppliedFill = true;
      }
    }

    // Default styling if no colors found
    if (!hasAppliedFill) {
      if (node.type === 'RECTANGLE') {
        node.fills = [{ type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.95 } }];
      } else if (node.type === 'TEXT') {
        node.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
      }
    }

    // Set name with more descriptive info
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

      console.log('JSON to Figma conversion complete');
      resolve();

    } catch (error) {
      console.error('Error in createFigmaFromJSON:', error);
      reject(error);
    }
  });
}

function processJSONChildren(parentFrame, children) {
  var yOffset = 20;

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

        // Auto-size text width, set minimum height
        var textWidth = child.width || 200;
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
        node.name = child.name || (child.type + '_' + i);

        parentFrame.appendChild(node);

        // Update y offset for next element if no specific position
        if (child.y === undefined) {
          yOffset += (child.height || 50) + 20;
        }

        console.log('Created JSON node:', node.name, 'at (' + node.x + ', ' + node.y + ')');
      }

    } catch (error) {
      console.warn('Failed to create JSON element:', child, error);
    }
  }
}