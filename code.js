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
    if (!element || !element.layout) {
      return null;
    }

    var layout = element.layout;
    var visual = element.visual_styles || {};
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