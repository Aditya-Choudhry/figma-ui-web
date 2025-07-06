// Standalone Figma Plugin - No External Server Required
// This plugin captures websites entirely within the Figma sandbox

// Show the standalone UI
figma.showUI(__html__, { width: 450, height: 700 });

// Listen for messages from the UI
figma.ui.onmessage = async (msg) => {
    if (msg.type === 'IMPORT_WEBSITE_DATA') {
        try {
            await processWebsiteData(msg.data);
        } catch (error) {
            figma.notify(`Error processing website data: ${error.message}`, { error: true });
        }
    }
};

async function processWebsiteData(data) {
    try {
        figma.notify(`Processing ${data.device} viewport from ${data.url}...`);
        
        // Create main frame for the viewport
        const mainFrame = figma.createFrame();
        mainFrame.name = `${data.device} - ${extractDomainName(data.url)}`;
        mainFrame.resize(data.viewport.width, data.viewport.height);
        
        // Set frame background
        mainFrame.fills = [{
            type: 'SOLID',
            color: { r: 0.98, g: 0.98, b: 0.98 }
        }];
        
        // Process elements
        let elementCount = 0;
        for (const element of data.elements) {
            if (elementCount >= 20) break; // Limit elements for performance
            
            try {
                const figmaNode = await createFigmaNodeFromElement(element);
                if (figmaNode) {
                    mainFrame.appendChild(figmaNode);
                    elementCount++;
                }
            } catch (error) {
                console.error('Error creating element:', error);
                continue;
            }
        }
        
        // Position frame in viewport
        const viewport = figma.viewport.bounds;
        mainFrame.x = viewport.x + 50;
        mainFrame.y = viewport.y + 50;
        
        // Select the created frame
        figma.currentPage.selection = [mainFrame];
        
        // Zoom to fit
        figma.viewport.scrollAndZoomIntoView([mainFrame]);
        
        figma.notify(`✓ Created ${elementCount} elements for ${data.device} viewport`);
        
    } catch (error) {
        console.error('Processing error:', error);
        figma.notify(`Error: ${error.message}`, { error: true });
    }
}

async function createFigmaNodeFromElement(element) {
    try {
        const nodeType = determineNodeType(element);
        
        switch (nodeType) {
            case 'TEXT':
                return await createTextNode(element);
            case 'RECTANGLE':
                return createRectangleNode(element);
            case 'FRAME':
                return createFrameNode(element);
            default:
                return createFrameNode(element);
        }
    } catch (error) {
        console.error('Error creating node:', error);
        return null;
    }
}

function determineNodeType(element) {
    // Text elements
    if (element.layout_detection && element.layout_detection.isTextNode && element.textContent.trim().length > 0) {
        return 'TEXT';
    }
    
    // Image elements
    if (element.tagName === 'IMG' || element.visual.backgroundImage) {
        return 'RECTANGLE';
    }
    
    // Container elements
    if (element.layout_detection && (element.layout_detection.isFlexContainer || element.layout_detection.isGridContainer)) {
        return 'FRAME';
    }
    
    // Block elements
    if (['DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'MAIN', 'ASIDE'].includes(element.tagName)) {
        return 'FRAME';
    }
    
    // Default to rectangle for styled elements
    return 'RECTANGLE';
}

async function createTextNode(element) {
    try {
        const textNode = figma.createText();
        
        // Load font
        const fontFamily = mapWebFontToFigma(element.typography.fontFamily);
        const fontWeight = mapFontWeight(element.typography.fontWeight);
        
        await figma.loadFontAsync({ family: fontFamily, style: fontWeight });
        
        // Set text content
        textNode.characters = element.textContent.trim() || 'Text';
        
        // Set position and size
        textNode.x = element.position.x;
        textNode.y = element.position.y;
        textNode.resize(element.position.width, element.position.height);
        
        // Set typography
        textNode.fontSize = parseFloat(element.typography.fontSize) || 16;
        textNode.fontName = { family: fontFamily, style: fontWeight };
        
        // Set color
        const color = parseColor(element.typography.color);
        if (color) {
            textNode.fills = [{
                type: 'SOLID',
                color: color
            }];
        }
        
        // Set alignment
        textNode.textAlignHorizontal = mapTextAlign(element.typography.textAlign);
        
        // Set line height
        const lineHeight = parseLineHeight(element.typography.lineHeight);
        if (lineHeight) {
            textNode.lineHeight = lineHeight;
        }
        
        textNode.name = generateNodeName(element);
        
        return textNode;
    } catch (error) {
        console.error('Error creating text node:', error);
        return null;
    }
}

function createRectangleNode(element) {
    try {
        const rectNode = figma.createRectangle();
        
        // Set position and size
        rectNode.x = element.position.x;
        rectNode.y = element.position.y;
        rectNode.resize(element.position.width, element.position.height);
        
        // Set background color
        const bgColor = parseColor(element.visual.backgroundColor);
        if (bgColor) {
            rectNode.fills = [{
                type: 'SOLID',
                color: bgColor
            }];
        }
        
        // Set border radius
        const borderRadius = parsePixelValue(element.visual.borderRadius);
        if (borderRadius > 0) {
            rectNode.cornerRadius = borderRadius;
        }
        
        // Set border (stroke)
        if (element.visual.border) {
            const borderColor = parseColor(element.visual.borderColor || '#000000');
            if (borderColor) {
                rectNode.strokes = [{
                    type: 'SOLID',
                    color: borderColor
                }];
                rectNode.strokeWeight = parsePixelValue(element.visual.borderWidth) || 1;
            }
        }
        
        // Set shadow (effects)
        if (element.visual.boxShadow && element.visual.boxShadow !== 'none') {
            try {
                const shadowEffect = parseBoxShadow(element.visual.boxShadow);
                if (shadowEffect) {
                    rectNode.effects = [shadowEffect];
                }
            } catch (error) {
                console.error('Error parsing box shadow:', error);
            }
        }
        
        rectNode.name = generateNodeName(element);
        
        return rectNode;
    } catch (error) {
        console.error('Error creating rectangle node:', error);
        return null;
    }
}

function createFrameNode(element) {
    try {
        const frameNode = figma.createFrame();
        
        // Set position and size
        frameNode.x = element.position.x;
        frameNode.y = element.position.y;
        frameNode.resize(element.position.width, element.position.height);
        
        // Set background color
        const bgColor = parseColor(element.visual.backgroundColor);
        if (bgColor) {
            frameNode.fills = [{
                type: 'SOLID',
                color: bgColor
            }];
        }
        
        // Set border radius
        const borderRadius = parsePixelValue(element.visual.borderRadius);
        if (borderRadius > 0) {
            frameNode.cornerRadius = borderRadius;
        }
        
        // Configure Auto Layout for flex containers
        if (element.layout_detection && element.layout_detection.isFlexContainer) {
            frameNode.layoutMode = 'VERTICAL'; // Default to vertical, can be enhanced
            frameNode.primaryAxisSizingMode = 'AUTO';
            frameNode.counterAxisSizingMode = 'AUTO';
            frameNode.paddingTop = 10;
            frameNode.paddingRight = 10;
            frameNode.paddingBottom = 10;
            frameNode.paddingLeft = 10;
            frameNode.itemSpacing = 8;
        }
        
        frameNode.name = generateNodeName(element);
        
        return frameNode;
    } catch (error) {
        console.error('Error creating frame node:', error);
        return null;
    }
}

// Utility functions
function mapWebFontToFigma(webFont) {
    if (!webFont) return 'Inter';
    
    const fontMap = {
        'Arial': 'Arial',
        'Helvetica': 'Arial',
        'Times': 'Times New Roman',
        'Times New Roman': 'Times New Roman',
        'Georgia': 'Georgia',
        'Verdana': 'Verdana',
        'Courier': 'Courier New',
        'Courier New': 'Courier New',
        'Roboto': 'Roboto',
        'Open Sans': 'Open Sans',
        'Inter': 'Inter'
    };
    
    // Extract first font family
    const firstFont = webFont.split(',')[0].trim().replace(/['"]/g, '');
    return fontMap[firstFont] || 'Inter';
}

function mapFontWeight(weight) {
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

function mapTextAlign(textAlign) {
    const alignMap = {
        'left': 'LEFT',
        'center': 'CENTER',
        'right': 'RIGHT',
        'justify': 'JUSTIFIED'
    };
    
    return alignMap[textAlign] || 'LEFT';
}

function parseColor(colorString) {
    if (!colorString || colorString === 'transparent') return null;
    
    // Handle hex colors
    if (colorString.startsWith('#')) {
        const hex = colorString.slice(1);
        if (hex.length === 3) {
            const r = parseInt(hex[0] + hex[0], 16) / 255;
            const g = parseInt(hex[1] + hex[1], 16) / 255;
            const b = parseInt(hex[2] + hex[2], 16) / 255;
            return { r, g, b };
        } else if (hex.length === 6) {
            const r = parseInt(hex.slice(0, 2), 16) / 255;
            const g = parseInt(hex.slice(2, 4), 16) / 255;
            const b = parseInt(hex.slice(4, 6), 16) / 255;
            return { r, g, b };
        }
    }
    
    // Handle rgb/rgba colors
    const rgbMatch = colorString.match(/rgba?\(([^)]+)\)/);
    if (rgbMatch) {
        const values = rgbMatch[1].split(',').map(v => parseFloat(v.trim()));
        return {
            r: values[0] / 255,
            g: values[1] / 255,
            b: values[2] / 255
        };
    }
    
    // Handle named colors
    const namedColors = {
        'black': { r: 0, g: 0, b: 0 },
        'white': { r: 1, g: 1, b: 1 },
        'red': { r: 1, g: 0, b: 0 },
        'green': { r: 0, g: 1, b: 0 },
        'blue': { r: 0, g: 0, b: 1 },
        'transparent': null
    };
    
    return namedColors[colorString.toLowerCase()] || null;
}

function parsePixelValue(value) {
    if (!value) return 0;
    const match = value.toString().match(/(-?\d+\.?\d*)/);
    return match ? parseFloat(match[1]) : 0;
}

function parseLineHeight(lineHeight) {
    if (!lineHeight || lineHeight === 'normal') return null;
    
    const value = parseFloat(lineHeight);
    if (isNaN(value)) return null;
    
    // If it's a number without units, treat as multiplier
    if (lineHeight.toString().indexOf('px') === -1 && lineHeight.toString().indexOf('%') === -1) {
        return { value: value, unit: 'PERCENT' };
    }
    
    // If it's pixels
    if (lineHeight.toString().indexOf('px') !== -1) {
        return { value: value, unit: 'PIXELS' };
    }
    
    return null;
}

function parseBoxShadow(boxShadow) {
    if (!boxShadow || boxShadow === 'none') return null;
    
    // Simple box shadow parsing (can be enhanced)
    const match = boxShadow.match(/(\d+)px\s+(\d+)px\s+(\d+)px\s+rgba?\(([^)]+)\)/);
    if (match) {
        const [, offsetX, offsetY, blur, colorValues] = match;
        const colorParts = colorValues.split(',').map(v => parseFloat(v.trim()));
        
        return {
            type: 'DROP_SHADOW',
            color: {
                r: colorParts[0] / 255,
                g: colorParts[1] / 255,
                b: colorParts[2] / 255,
                a: colorParts[3] || 1
            },
            offset: {
                x: parseInt(offsetX),
                y: parseInt(offsetY)
            },
            radius: parseInt(blur),
            visible: true
        };
    }
    
    return null;
}

function generateNodeName(element) {
    if (element.textContent && element.textContent.trim()) {
        return element.textContent.trim().substring(0, 30);
    }
    
    if (element.className) {
        return element.className.split(' ')[0];
    }
    
    return element.tagName.toLowerCase();
}

function extractDomainName(url) {
    try {
        const domain = new URL(url).hostname;
        return domain.replace('www.', '');
    } catch (error) {
        return 'website';
    }
}

// Initialize plugin
figma.notify('Standalone Website to Figma Exporter ready!');