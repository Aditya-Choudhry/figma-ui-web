// Figma plugin main code - handles communication with UI and Figma API
console.log('Figma plugin loaded');

// Listen for messages from the plugin UI
figma.ui.onmessage = (msg) => {
  console.log('Received message:', msg);

  if (msg.type === 'sandboxCaptureComplete') {
    figma.notify('Processing sandbox capture data...', { timeout: 2000 });
    console.log('Received sandbox capture data:', msg.data);
    
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
  return new Promise((resolve, reject) => {
    try {
      console.log('Creating responsive Figma layouts...');

      const { url, viewports } = data;
      const mainSectionName = extractDomainName(url);

      const mainSection = figma.createSection();
      mainSection.name = `🌐 ${mainSectionName} - Responsive Layouts`;
      figma.currentPage.appendChild(mainSection);

      const frameSpacing = 100;
      let currentX = 0;

      for (const [viewportName, viewportData] of Object.entries(viewports)) {
        console.log(`Creating layout for ${viewportName}...`);
        
        if (!viewportData || !viewportData.device) {
          console.warn(`Skipping invalid viewport data for ${viewportName}`);
          continue;
        }

        const page = viewportData.page || {};
        const elements = viewportData.elements || [];
        const assets = viewportData.assets || [];
        
        const isDesktop = viewportData.device === 'Desktop';
        const frameWidth = isDesktop ? 1440 : (page.viewport_width || 375);
        const frameHeight = page.viewport_height || 800;

        const viewportFrame = figma.createFrame();
        viewportFrame.name = `📱 ${viewportData.device} (${frameWidth}×${frameHeight})`;
        viewportFrame.resize(frameWidth, frameHeight);
        viewportFrame.x = currentX;
        viewportFrame.y = 0;
        
        viewportFrame.backgrounds = [{
          type: 'SOLID',
          color: { r: 1, g: 1, b: 1 }
        }];
        viewportFrame.clipsContent = true;

        mainSection.appendChild(viewportFrame);

        // Create elements without async complexity
        createElementsInFrame(viewportFrame, elements, assets);

        if (assets.length > 0) {
          viewportFrame.name += ` (${assets.length} assets)`;
        }

        currentX += frameWidth + frameSpacing;
      }

      figma.currentPage.selection = [mainSection];
      figma.viewport.scrollAndZoomIntoView([mainSection]);
      
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

function createElementsInFrame(parentFrame, elements, assets) {
  // Simplified synchronous element creation
  return new Promise((resolve) => {
    try {
      figma.loadFontAsync({ family: "Inter", style: "Regular" })
        .then(() => {
          for (const element of elements) {
            try {
              if (element && element.position) {
                const node = createNodeFromElement(element);
                if (node) {
                  parentFrame.appendChild(node);
                }
              }
            } catch (error) {
              console.warn('Error creating element:', error);
            }
          }
          resolve();
        })
        .catch(() => {
          // Fallback without font loading
          for (const element of elements) {
            try {
              if (element && element.position) {
                const node = createNodeFromElement(element);
                if (node) {
                  parentFrame.appendChild(node);
                }
              }
            } catch (error) {
              console.warn('Error creating element:', error);
            }
          }
          resolve();
        });
    } catch (error) {
      resolve(); // Always resolve to prevent blocking
    }
  });
}

function createFigmaNodesFromWebData(data) {
  return new Promise((resolve) => {
    try {
      console.log('Creating Figma nodes from web data...');
      
      figma.loadFontAsync({ family: "Inter", style: "Regular" })
        .then(() => {
          const elements = data.elements || [];
          
          for (const element of elements) {
            try {
              const node = createNodeFromElement(element);
              if (node) {
                figma.currentPage.appendChild(node);
              }
            } catch (error) {
              console.warn('Error creating node:', error);
            }
          }
          resolve();
        })
        .catch(() => {
          resolve(); // Always resolve even if font loading fails
        });
    } catch (error) {
      resolve();
    }
  });
}

function createNodeFromElement(element) {
  try {
    // Load font synchronously if possible
    figma.loadFontAsync({ family: "Inter", style: "Regular" }).catch(() => {});
    
    if (element.tag === 'img' || element.type === 'image') {
      const rect = figma.createRectangle();
      rect.name = element.alt || 'Image';
      
      if (element.position && element.position.width && element.position.height) {
        rect.resize(Math.max(1, element.position.width), Math.max(1, element.position.height));
        rect.x = element.position.x || 0;
        rect.y = element.position.y || 0;
      }
      
      rect.fills = [{
        type: 'SOLID',
        color: { r: 0.9, g: 0.9, b: 0.9 }
      }];
      
      return rect;
    }
    
    if (element.textContent && element.textContent.trim()) {
      const text = figma.createText();
      text.name = 'Text';
      text.characters = element.textContent.trim().substring(0, 200);
      
      if (element.position) {
        text.x = element.position.x || 0;
        text.y = element.position.y || 0;
        if (element.position.width) {
          text.resize(Math.max(1, element.position.width), text.height);
        }
      }
      
      return text;
    }
    
    // Default to rectangle for other elements
    const rect = figma.createRectangle();
    rect.name = element.tag || 'Element';
    
    if (element.position && element.position.width && element.position.height) {
      rect.resize(Math.max(1, element.position.width), Math.max(1, element.position.height));
      rect.x = element.position.x || 0;
      rect.y = element.position.y || 0;
    }
    
    rect.fills = [{
      type: 'SOLID',
      color: { r: 0.95, g: 0.95, b: 0.95 }
    }];
    
    return rect;
    
  } catch (error) {
    console.warn('Error in createNodeFromElement:', error);
    return null;
  }
}

function parseColor(colorString) {
  if (!colorString) return { r: 0, g: 0, b: 0 };
  
  if (colorString.startsWith('#')) {
    const hex = colorString.substring(1);
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    return { r, g, b };
  }
  
  return { r: 0, g: 0, b: 0 };
}

function extractDomainName(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'Website';
  }
}