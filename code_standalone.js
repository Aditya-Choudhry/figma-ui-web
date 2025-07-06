// Standalone Figma Plugin - No External Server Required
// This plugin captures websites entirely within the Figma sandbox

// Show the standalone UI
figma.showUI(__html__, { width: 450, height: 700 });

// Listen for messages from the UI
figma.ui.onmessage = (msg) => {
    if (msg.type === 'IMPORT_WEBSITE_DATA') {
        processWebsiteData(msg.data)
            .then(() => {
                figma.notify('Website data processed successfully!', { timeout: 3000 });
            })
            .catch((error) => {
                console.error('Error processing website data:', error);
                figma.notify(`Error processing website data: ${error.message}`, { error: true });
            });
    }
};

function processWebsiteData(data) {
    return new Promise((resolve, reject) => {
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
                const figmaNode = createFigmaNodeFromElement(element);
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
        resolve();
        
    } catch (error) {
        console.error('Processing error:', error);
        figma.notify(`Error: ${error.message}`, { error: true });
        reject(error);
    }
    });
}

function createFigmaNodeFromElement(element) {
    try {
        const nodeType = determineAdvancedNodeType(element);
        
        switch (nodeType) {
            case 'TEXT':
                return createAdvancedTextNode(element);
            case 'IMAGE':
                return createImageNode(element);
            case 'RECTANGLE':
                return createAdvancedRectangleNode(element);
            case 'FRAME':
                return createAdvancedFrameNode(element);
            case 'AUTO_LAYOUT':
                return createAutoLayoutFrame(element);
            default:
                return createAdvancedFrameNode(element);
        }
    } catch (error) {
        console.error('Error creating node:', error);
        return null;
    }
}

function determineAdvancedNodeType(element) {
    // Text elements with comprehensive detection
    if (element.layout_detection && element.layout_detection.isTextNode && element.textContent && element.textContent.trim().length > 0) {
        return 'TEXT';
    }
    
    // Image elements
    if (element.tagName === 'IMG' || 
        (element.visual && element.visual.backgroundImage && element.visual.backgroundImage !== 'none')) {
        return 'IMAGE';
    }
    
    // Auto Layout containers (Flexbox/Grid)
    if (element.layout_detection && (element.layout_detection.isFlexContainer || element.layout_detection.isGridContainer)) {
        return 'AUTO_LAYOUT';
    }
    
    // Container elements
    if (['DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'MAIN', 'ASIDE', 'NAV'].includes(element.tagName)) {
        return 'FRAME';
    }
    
    // Interactive elements
    if (['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A'].includes(element.tagName)) {
        return 'FRAME';
    }
    
    // Default to rectangle for styled elements
    return 'RECTANGLE';
}

async function createAdvancedTextNode(element) {
    try {
        const textNode = figma.createText();
        
        // Load font with enhanced mapping
        const fontFamily = mapWebFontToFigma(element.typography.fontFamily);
        const fontStyle = mapFontStyleAndWeight(element.typography.fontWeight, element.typography.fontStyle);
        
        figma.loadFontAsync({ family: fontFamily, style: fontStyle }).catch(() => {});
        
        // Set text content
        textNode.characters = element.textContent.trim() || 'Text';
        
        // Set position and size
        textNode.x = element.position.x;
        textNode.y = element.position.y;
        textNode.resize(element.position.width, element.position.height);
        
        // Set comprehensive typography
        textNode.fontSize = parseFloat(element.typography.fontSize) || 16;
        textNode.fontName = { family: fontFamily, style: fontStyle };
        
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
        const lineHeight = parseAdvancedLineHeight(element.typography.lineHeight, textNode.fontSize);
        if (lineHeight) {
            textNode.lineHeight = lineHeight;
        }
        
        // Set letter spacing
        const letterSpacing = parseLetterSpacing(element.typography.letterSpacing);
        if (letterSpacing !== null) {
            textNode.letterSpacing = letterSpacing;
        }
        
        // Set text decoration
        if (element.typography.textDecoration && element.typography.textDecoration !== 'none') {
            textNode.textDecoration = mapTextDecoration(element.typography.textDecoration);
        }
        
        // Set text transform (case)
        if (element.typography.textTransform && element.typography.textTransform !== 'none') {
            textNode.textCase = mapTextTransform(element.typography.textTransform);
        }
        
        textNode.name = generateAdvancedNodeName(element);
        
        return textNode;
    } catch (error) {
        console.error('Error creating advanced text node:', error);
        return null;
    }
}

async function createImageNode(element) {
    try {
        const frameNode = figma.createFrame();
        
        // Set position and size
        frameNode.x = element.position.x;
        frameNode.y = element.position.y;
        frameNode.resize(element.position.width, element.position.height);
        
        // Set background for image placeholder
        frameNode.fills = [{
            type: 'SOLID',
            color: { r: 0.9, g: 0.9, b: 0.9 }
        }];
        
        // Add border radius if present
        const borderRadius = parsePixelValue(element.visual.borderRadius);
        if (borderRadius > 0) {
            frameNode.cornerRadius = borderRadius;
        }
        
        // Create placeholder text for image
        if (element.attributes && element.attributes.alt) {
            const placeholderText = figma.createText();
            figma.loadFontAsync({ family: 'Inter', style: 'Regular' }).catch(() => {});
            placeholderText.characters = `Image: ${element.attributes.alt}`;
            placeholderText.fontSize = 12;
            placeholderText.fills = [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }];
            placeholderText.x = 8;
            placeholderText.y = 8;
            frameNode.appendChild(placeholderText);
        }
        
        frameNode.name = `Image - ${element.attributes && element.attributes.alt || 'Untitled'}`;
        
        return frameNode;
    } catch (error) {
        console.error('Error creating image node:', error);
        return null;
    }
}

function createAutoLayoutFrame(element) {
    try {
        const frameNode = figma.createFrame();
        
        // Set position and size
        frameNode.x = element.position.x;
        frameNode.y = element.position.y;
        frameNode.resize(element.position.width, element.position.height);
        
        // Configure Auto Layout
        frameNode.layoutMode = mapFlexDirection(element.flex_properties.flexDirection);
        frameNode.primaryAxisSizingMode = 'AUTO';
        frameNode.counterAxisSizingMode = 'AUTO';
        
        // Set alignment
        frameNode.primaryAxisAlignItems = mapJustifyContent(element.flex_properties.justifyContent);
        frameNode.counterAxisAlignItems = mapAlignItems(element.flex_properties.alignItems);
        
        // Set spacing and padding
        frameNode.itemSpacing = parsePixelValue(element.flex_properties.gap) || 8;
        
        // Set padding from spacing properties
        const padding = parseSpacing(element.spacing);
        frameNode.paddingTop = padding.top;
        frameNode.paddingRight = padding.right;
        frameNode.paddingBottom = padding.bottom;
        frameNode.paddingLeft = padding.left;
        
        // Set background and styling
        applyAdvancedStyling(frameNode, element);
        
        frameNode.name = generateAdvancedNodeName(element);
        
        return frameNode;
    } catch (error) {
        console.error('Error creating auto layout frame:', error);
        return null;
    }
}

function createAdvancedRectangleNode(element) {
    try {
        const rectNode = figma.createRectangle();
        
        // Set position and size
        rectNode.x = element.position.x;
        rectNode.y = element.position.y;
        rectNode.resize(element.position.width, element.position.height);
        
        // Apply comprehensive styling
        applyAdvancedStyling(rectNode, element);
        
        rectNode.name = generateAdvancedNodeName(element);
        
        return rectNode;
    } catch (error) {
        console.error('Error creating advanced rectangle node:', error);
        return null;
    }
}

function createAdvancedFrameNode(element) {
    try {
        const frameNode = figma.createFrame();
        
        // Set position and size
        frameNode.x = element.position.x;
        frameNode.y = element.position.y;
        frameNode.resize(element.position.width, element.position.height);
        
        // Apply comprehensive styling
        applyAdvancedStyling(frameNode, element);
        
        frameNode.name = generateAdvancedNodeName(element);
        
        return frameNode;
    } catch (error) {
        console.error('Error creating advanced frame node:', error);
        return null;
    }
}

function applyAdvancedStyling(node, element) {
    try {
        // Set background color
        const bgColor = parseColor(element.visual.backgroundColor);
        if (bgColor && element.visual.backgroundColor !== 'transparent') {
            node.fills = [{
                type: 'SOLID',
                color: bgColor
            }];
        } else {
            node.fills = [];
        }
        
        // Set border radius
        const borderRadius = parsePixelValue(element.visual.borderRadius);
        if (borderRadius > 0) {
            node.cornerRadius = borderRadius;
        }
        
        // Set borders (strokes)
        if (element.visual.border && element.visual.border !== 'none' && element.visual.borderStyle !== 'none') {
            const borderColor = parseColor(element.visual.borderColor);
            const borderWidth = parsePixelValue(element.visual.borderWidth);
            
            if (borderColor && borderWidth > 0) {
                node.strokes = [{
                    type: 'SOLID',
                    color: borderColor
                }];
                node.strokeWeight = borderWidth;
            }
        }
        
        // Set opacity
        const opacity = parseFloat(element.visual.opacity);
        if (opacity && opacity < 1) {
            node.opacity = opacity;
        }
        
        // Set shadow effects
        if (element.visual.boxShadow && element.visual.boxShadow !== 'none') {
            const shadowEffect = parseAdvancedBoxShadow(element.visual.boxShadow);
            if (shadowEffect) {
                node.effects = [shadowEffect];
            }
        }
        
    } catch (error) {
        console.error('Error applying advanced styling:', error);
    }
}

// Enhanced utility functions
function mapWebFontToFigma(webFont) {
    if (!webFont) return 'Inter';
    
    const fontMap = {
        'Arial': 'Arial',
        'Helvetica': 'Arial',
        'Helvetica Neue': 'Arial',
        'Times': 'Times New Roman',
        'Times New Roman': 'Times New Roman',
        'Georgia': 'Georgia',
        'Verdana': 'Verdana',
        'Courier': 'Courier New',
        'Courier New': 'Courier New',
        'Roboto': 'Roboto',
        'Open Sans': 'Open Sans',
        'Inter': 'Inter',
        'SF Pro Display': 'SF Pro Display',
        'SF Pro Text': 'SF Pro Text',
        'system-ui': 'Inter',
        '-apple-system': 'SF Pro Display',
        'BlinkMacSystemFont': 'Inter',
        'Segoe UI': 'Inter'
    };
    
    // Extract first font family
    const firstFont = webFont.split(',')[0].trim().replace(/['"]/g, '');
    return fontMap[firstFont] || 'Inter';
}

function mapFontStyleAndWeight(weight, style) {
    const isItalic = style === 'italic';
    const weightNumber = parseInt(weight) || (weight === 'bold' ? 700 : 400);
    
    // Map weight to Figma font styles
    if (weightNumber <= 100) return isItalic ? 'Thin Italic' : 'Thin';
    if (weightNumber <= 200) return isItalic ? 'Extra Light Italic' : 'Extra Light';
    if (weightNumber <= 300) return isItalic ? 'Light Italic' : 'Light';
    if (weightNumber <= 400) return isItalic ? 'Italic' : 'Regular';
    if (weightNumber <= 500) return isItalic ? 'Medium Italic' : 'Medium';
    if (weightNumber <= 600) return isItalic ? 'Semi Bold Italic' : 'Semi Bold';
    if (weightNumber <= 700) return isItalic ? 'Bold Italic' : 'Bold';
    if (weightNumber <= 800) return isItalic ? 'Extra Bold Italic' : 'Extra Bold';
    return isItalic ? 'Black Italic' : 'Black';
}

function parseAdvancedLineHeight(lineHeight, fontSize) {
    if (!lineHeight || lineHeight === 'normal') return null;
    
    // Handle different line-height units
    if (lineHeight.includes('px')) {
        const pixels = parseFloat(lineHeight);
        return { value: pixels, unit: 'PIXELS' };
    } else if (lineHeight.includes('%')) {
        const percent = parseFloat(lineHeight);
        return { value: percent, unit: 'PERCENT' };
    } else {
        // Unitless multiplier
        const multiplier = parseFloat(lineHeight);
        if (!isNaN(multiplier)) {
            return { value: multiplier * 100, unit: 'PERCENT' };
        }
    }
    
    return null;
}

function parseLetterSpacing(letterSpacing) {
    if (!letterSpacing || letterSpacing === 'normal') return null;
    
    const value = parseFloat(letterSpacing);
    if (isNaN(value)) return null;
    
    // Convert to percentage based on font size
    return { value: value, unit: 'PIXELS' };
}

function mapTextDecoration(textDecoration) {
    if (textDecoration.includes('underline')) return 'UNDERLINE';
    if (textDecoration.includes('line-through')) return 'STRIKETHROUGH';
    return 'NONE';
}

function mapTextTransform(textTransform) {
    const transformMap = {
        'uppercase': 'UPPER',
        'lowercase': 'LOWER',
        'capitalize': 'TITLE'
    };
    return transformMap[textTransform] || 'ORIGINAL';
}

function mapFlexDirection(direction) {
    return direction === 'row' || direction === 'row-reverse' ? 'HORIZONTAL' : 'VERTICAL';
}

function mapJustifyContent(justifyContent) {
    const alignMap = {
        'flex-start': 'MIN',
        'flex-end': 'MAX',
        'center': 'CENTER',
        'space-between': 'SPACE_BETWEEN'
    };
    return alignMap[justifyContent] || 'MIN';
}

function mapAlignItems(alignItems) {
    const alignMap = {
        'flex-start': 'MIN',
        'flex-end': 'MAX',
        'center': 'CENTER',
        'stretch': 'CENTER'
    };
    return alignMap[alignItems] || 'MIN';
}

function parseSpacing(spacing) {
    return {
        top: parsePixelValue(spacing.paddingTop) || 0,
        right: parsePixelValue(spacing.paddingRight) || 0,
        bottom: parsePixelValue(spacing.paddingBottom) || 0,
        left: parsePixelValue(spacing.paddingLeft) || 0
    };
}

function parseAdvancedBoxShadow(boxShadow) {
    if (!boxShadow || boxShadow === 'none') return null;
    
    // Enhanced box shadow parsing
    const shadowRegex = /(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+rgba?\(([^)]+)\)/;
    const match = boxShadow.match(shadowRegex);
    
    if (match) {
        const [, offsetX, offsetY, blur, spread, colorValues] = match;
        const colorParts = colorValues.split(',').map(v => parseFloat(v.trim()));
        
        return {
            type: 'DROP_SHADOW',
            color: {
                r: (colorParts[0] || 0) / 255,
                g: (colorParts[1] || 0) / 255,
                b: (colorParts[2] || 0) / 255,
                a: colorParts[3] || 1
            },
            offset: {
                x: parseFloat(offsetX),
                y: parseFloat(offsetY)
            },
            radius: parseFloat(blur),
            spread: parseFloat(spread),
            visible: true
        };
    }
    
    return null;
}

function generateAdvancedNodeName(element) {
    // Enhanced name generation
    if (element.id) {
        return element.id;
    }
    
    if (element.textContent && element.textContent.trim()) {
        return element.textContent.trim().substring(0, 25);
    }
    
    if (element.className) {
        return element.className.split(' ')[0];
    }
    
    // Generate descriptive names based on element type
    const tagName = element.tagName.toLowerCase();
    if (tagName === 'button') return 'Button';
    if (tagName === 'input') return 'Input';
    if (tagName === 'img') return 'Image';
    if (tagName === 'a') return 'Link';
    
    return tagName;
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