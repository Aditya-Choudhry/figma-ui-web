// Figma export utilities and formatting
class FigmaExporter {
    constructor() {
        this.nodeIdCounter = 0;
        this.figmaDocument = null;
    }
    
    convertToFigmaFormat(capturedData) {
        console.log('Converting captured data to Figma format...');
        
        // Create root document structure
        this.figmaDocument = {
            name: this.sanitizeName(capturedData.page.title) || 'Captured Website',
            type: 'DOCUMENT',
            children: [],
            version: '1.0.0',
            metadata: {
                ...capturedData.page,
                capturedAt: capturedData.capturedAt,
                generator: 'Website to Figma Exporter',
                totalElements: capturedData.elements.length,
                totalImages: capturedData.images.length
            }
        };
        
        // Create main page
        const mainPage = {
            id: this.generateNodeId(),
            name: 'Page 1',
            type: 'PAGE',
            children: [],
            backgroundColor: { r: 1, g: 1, b: 1, a: 1 }
        };
        
        // Create root frame
        const rootFrame = this.createRootFrame(capturedData.page);
        
        // Convert all elements to Figma nodes
        const convertedElements = this.convertElements(capturedData.elements, capturedData.images);
        rootFrame.children = convertedElements;
        
        mainPage.children.push(rootFrame);
        this.figmaDocument.children.push(mainPage);
        
        // Add styles
        this.figmaDocument.textStyles = this.convertTextStyles(capturedData.textStyles);
        this.figmaDocument.colorStyles = this.convertColorStyles(capturedData.colors);
        this.figmaDocument.images = this.processImages(capturedData.images);
        
        return this.figmaDocument;
    }
    
    createRootFrame(pageData) {
        return {
            id: this.generateNodeId(),
            name: 'Website Capture',
            type: 'FRAME',
            x: 0,
            y: 0,
            width: pageData.scrollSize.width,
            height: pageData.scrollSize.height,
            backgroundColor: { r: 1, g: 1, b: 1, a: 1 },
            fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 1 }],
            strokes: [],
            strokeWeight: 0,
            cornerRadius: 0,
            children: [],
            clipsContent: false,
            layoutMode: 'NONE',
            constraints: {
                horizontal: 'MIN',
                vertical: 'MIN'
            }
        };
    }
    
    convertElements(elements, images) {
        const figmaNodes = [];
        const processedElements = new Set();
        
        // Sort elements by z-index and depth for proper layering
        const sortedElements = [...elements].sort((a, b) => {
            if (a.layout.zIndex !== b.layout.zIndex) {
                return a.layout.zIndex - b.layout.zIndex;
            }
            return a.depth - b.depth;
        });
        
        for (const element of sortedElements) {
            if (processedElements.has(element.id)) continue;
            
            const figmaNode = this.convertElementToFigmaNode(element, images);
            if (figmaNode) {
                figmaNodes.push(figmaNode);
                processedElements.add(element.id);
            }
        }
        
        return figmaNodes;
    }
    
    convertElementToFigmaNode(element, images) {
        // Determine node type based on element characteristics
        const nodeType = this.determineNodeType(element, images);
        
        const baseNode = {
            id: this.generateNodeId(),
            name: this.generateNodeName(element),
            type: nodeType,
            x: element.layout.x,
            y: element.layout.y,
            width: Math.max(element.layout.width, 1),
            height: Math.max(element.layout.height, 1),
            opacity: element.visual.opacity,
            visible: true,
            locked: false,
            constraints: {
                horizontal: 'MIN',
                vertical: 'MIN'
            }
        };
        
        // Add type-specific properties
        switch (nodeType) {
            case 'TEXT':
                return this.createTextNode(baseNode, element);
            case 'IMAGE':
                return this.createImageNode(baseNode, element, images);
            case 'FRAME':
                return this.createFrameNode(baseNode, element);
            case 'RECTANGLE':
                return this.createRectangleNode(baseNode, element);
            default:
                return this.createFrameNode(baseNode, element);
        }
    }
    
    determineNodeType(element, images) {
        // Check if it's an image
        if (element.tagName === 'img' || 
            images.find(img => img.elementId === element.id)) {
            return 'IMAGE';
        }
        
        // Check if it has significant text content
        if (element.textContent && element.textContent.length > 0) {
            // If it has children or complex styling, make it a frame with text
            if (element.children && element.children.length > 0) {
                return 'FRAME';
            }
            return 'TEXT';
        }
        
        // Check if it's a container element
        const containerTags = ['div', 'section', 'article', 'header', 'footer', 'nav', 'main', 'aside'];
        if (containerTags.includes(element.tagName)) {
            return 'FRAME';
        }
        
        // Default to rectangle for other elements
        return 'RECTANGLE';
    }
    
    createTextNode(baseNode, element) {
        const textNode = {
            ...baseNode,
            type: 'TEXT',
            characters: element.textContent || '',
            fontSize: this.parsePixelValue(element.typography.fontSize) || 16,
            fontName: {
                family: this.extractFontFamily(element.typography.fontFamily),
                style: this.determineFontStyle(element.typography)
            },
            textAlign: this.convertTextAlign(element.typography.textAlign),
            fills: [this.convertColorToFigmaFill(element.visual.color)],
            lineHeight: this.convertLineHeight(element.typography.lineHeight),
            letterSpacing: this.parsePixelValue(element.typography.letterSpacing) || 0,
            textCase: this.convertTextTransform(element.typography.textTransform),
            textDecoration: this.convertTextDecoration(element.typography.textDecoration)
        };
        
        return textNode;
    }
    
    createImageNode(baseNode, element, images) {
        const imageData = images.find(img => img.elementId === element.id);
        
        const imageNode = {
            ...baseNode,
            type: 'IMAGE',
            fills: [],
            imageHash: imageData ? this.generateImageHash(imageData) : null,
            imageData: imageData || null
        };
        
        return imageNode;
    }
    
    createFrameNode(baseNode, element) {
        const frameNode = {
            ...baseNode,
            type: 'FRAME',
            fills: this.convertFills(element.visual),
            strokes: this.convertStrokes(element.visual),
            strokeWeight: this.parsePixelValue(element.visual.border.width) || 0,
            cornerRadius: this.parsePixelValue(element.visual.border.radius) || 0,
            children: [],
            clipsContent: false,
            layoutMode: this.determineLayoutMode(element),
            paddingTop: element.spacing.padding.top,
            paddingRight: element.spacing.padding.right,
            paddingBottom: element.spacing.padding.bottom,
            paddingLeft: element.spacing.padding.left
        };
        
        // Add flex/grid properties if applicable
        if (element.layout.display === 'flex') {
            frameNode.layoutMode = 'FLEX';
            frameNode.primaryAxisSizingMode = 'AUTO';
            frameNode.counterAxisSizingMode = 'AUTO';
            frameNode.primaryAxisAlignItems = this.convertFlexAlignment(element.flexGrid.justifyContent);
            frameNode.counterAxisAlignItems = this.convertFlexAlignment(element.flexGrid.alignItems);
            frameNode.itemSpacing = 0; // Could be enhanced to detect gaps
        }
        
        return frameNode;
    }
    
    createRectangleNode(baseNode, element) {
        const rectangleNode = {
            ...baseNode,
            type: 'RECTANGLE',
            fills: this.convertFills(element.visual),
            strokes: this.convertStrokes(element.visual),
            strokeWeight: this.parsePixelValue(element.visual.border.width) || 0,
            cornerRadius: this.parsePixelValue(element.visual.border.radius) || 0
        };
        
        return rectangleNode;
    }
    
    convertFills(visual) {
        const fills = [];
        
        // Add background color fill
        if (visual.backgroundColor && visual.backgroundColor !== 'rgba(0, 0, 0, 0)') {
            const fill = this.convertColorToFigmaFill(visual.backgroundColor);
            if (fill) fills.push(fill);
        }
        
        // Add background image if present
        if (visual.backgroundImage && visual.backgroundImage !== 'none') {
            // This would need additional processing for background images
            // For now, we'll skip background images
        }
        
        return fills;
    }
    
    convertStrokes(visual) {
        const strokes = [];
        
        if (visual.border.width && visual.border.width !== '0px' && 
            visual.border.color && visual.border.color !== 'rgba(0, 0, 0, 0)') {
            const stroke = this.convertColorToFigmaFill(visual.border.color);
            if (stroke) strokes.push(stroke);
        }
        
        return strokes;
    }
    
    convertColorToFigmaFill(colorString) {
        if (!colorString || colorString === 'rgba(0, 0, 0, 0)' || colorString === 'transparent') {
            return null;
        }
        
        const color = this.parseColor(colorString);
        return {
            type: 'SOLID',
            color: {
                r: color.r / 255,
                g: color.g / 255,
                b: color.b / 255
            },
            opacity: color.a
        };
    }
    
    parseColor(colorString) {
        // Handle RGB
        if (colorString.startsWith('rgb(')) {
            const match = colorString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            return match ? {
                r: parseInt(match[1]),
                g: parseInt(match[2]),
                b: parseInt(match[3]),
                a: 1
            } : { r: 0, g: 0, b: 0, a: 1 };
        }
        
        // Handle RGBA
        if (colorString.startsWith('rgba(')) {
            const match = colorString.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
            return match ? {
                r: parseInt(match[1]),
                g: parseInt(match[2]),
                b: parseInt(match[3]),
                a: parseFloat(match[4])
            } : { r: 0, g: 0, b: 0, a: 1 };
        }
        
        // Handle HEX
        if (colorString.startsWith('#')) {
            const hex = colorString.substring(1);
            const r = parseInt(hex.substr(0, 2), 16);
            const g = parseInt(hex.substr(2, 2), 16);
            const b = parseInt(hex.substr(4, 2), 16);
            return { r, g, b, a: 1 };
        }
        
        // Handle named colors (basic implementation)
        const namedColors = {
            'black': { r: 0, g: 0, b: 0, a: 1 },
            'white': { r: 255, g: 255, b: 255, a: 1 },
            'red': { r: 255, g: 0, b: 0, a: 1 },
            'green': { r: 0, g: 128, b: 0, a: 1 },
            'blue': { r: 0, g: 0, b: 255, a: 1 }
        };
        
        return namedColors[colorString.toLowerCase()] || { r: 0, g: 0, b: 0, a: 1 };
    }
    
    convertTextStyles(textStylesArray) {
        return textStylesArray.map(([key, style]) => ({
            id: key,
            name: `${this.extractFontFamily(style.fontFamily)} ${style.fontSize}`,
            fontName: {
                family: this.extractFontFamily(style.fontFamily),
                style: this.determineFontStyle(style)
            },
            fontSize: this.parsePixelValue(style.fontSize) || 16,
            lineHeight: this.convertLineHeight(style.lineHeight),
            fills: [this.convertColorToFigmaFill(style.color)],
            textAlign: this.convertTextAlign(style.textAlign),
            usageCount: style.count || 0
        }));
    }
    
    convertColorStyles(colorsArray) {
        return colorsArray.map((color, index) => ({
            id: `color_${index}`,
            name: color,
            fills: [this.convertColorToFigmaFill(color)]
        }));
    }
    
    processImages(imagesArray) {
        return imagesArray.map(image => ({
            id: this.generateImageHash(image),
            name: image.alt || 'Captured Image',
            base64: image.base64,
            width: image.width,
            height: image.height,
            originalSrc: image.src,
            fileSize: image.fileSize
        }));
    }
    
    // Utility functions
    generateNodeId() {
        return `node_${++this.nodeIdCounter}_${Date.now()}`;
    }
    
    generateImageHash(imageData) {
        // Simple hash based on src and dimensions
        const str = `${imageData.src}_${imageData.width}_${imageData.height}`;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return `img_${Math.abs(hash)}`;
    }
    
    sanitizeName(name) {
        return name ? name.replace(/[^\w\s-]/g, '').trim() : '';
    }
    
    generateNodeName(element) {
        let name = element.tagName;
        
        if (element.attributes.id) {
            name += `#${element.attributes.id}`;
        } else if (element.attributes.class) {
            const classes = element.attributes.class.split(' ').slice(0, 2).join('.');
            if (classes) name += `.${classes}`;
        }
        
        if (element.textContent && element.textContent.length > 0) {
            const text = element.textContent.substring(0, 30);
            name += `: ${text}${element.textContent.length > 30 ? '...' : ''}`;
        }
        
        return this.sanitizeName(name) || element.tagName;
    }
    
    parsePixelValue(value) {
        if (!value || value === 'auto' || value === 'normal') return 0;
        return parseFloat(value) || 0;
    }
    
    extractFontFamily(fontFamily) {
        if (!fontFamily) return 'Inter';
        
        // Extract first font family name, removing quotes
        const firstFont = fontFamily.split(',')[0].trim();
        return firstFont.replace(/['"]/g, '') || 'Inter';
    }
    
    determineFontStyle(typography) {
        const weight = typography.fontWeight;
        const style = typography.fontStyle;
        
        if (style === 'italic') {
            if (weight === 'bold' || parseInt(weight) >= 700) {
                return 'Bold Italic';
            }
            return 'Italic';
        }
        
        if (weight === 'bold' || parseInt(weight) >= 700) {
            return 'Bold';
        } else if (weight === 'lighter' || parseInt(weight) <= 300) {
            return 'Light';
        }
        
        return 'Regular';
    }
    
    convertTextAlign(textAlign) {
        const alignMap = {
            'left': 'LEFT',
            'center': 'CENTER',
            'right': 'RIGHT',
            'justify': 'JUSTIFIED'
        };
        return alignMap[textAlign] || 'LEFT';
    }
    
    convertLineHeight(lineHeight) {
        if (!lineHeight || lineHeight === 'normal') {
            return { unit: 'AUTO' };
        }
        
        const value = parseFloat(lineHeight);
        if (lineHeight.includes('px')) {
            return { unit: 'PIXELS', value };
        } else if (lineHeight.includes('%')) {
            return { unit: 'PERCENT', value };
        } else {
            // Unitless values are treated as multipliers
            return { unit: 'PERCENT', value: value * 100 };
        }
    }
    
    convertTextTransform(textTransform) {
        const transformMap = {
            'uppercase': 'UPPER',
            'lowercase': 'LOWER',
            'capitalize': 'TITLE'
        };
        return transformMap[textTransform] || 'ORIGINAL';
    }
    
    convertTextDecoration(textDecoration) {
        if (textDecoration.includes('underline')) return 'UNDERLINE';
        if (textDecoration.includes('line-through')) return 'STRIKETHROUGH';
        return 'NONE';
    }
    
    determineLayoutMode(element) {
        if (element.layout.display === 'flex') {
            return 'FLEX';
        } else if (element.layout.display === 'grid') {
            return 'GRID'; // Note: Grid support in Figma is limited
        }
        return 'NONE';
    }
    
    convertFlexAlignment(alignValue) {
        const alignMap = {
            'flex-start': 'MIN',
            'flex-end': 'MAX',
            'center': 'CENTER',
            'space-between': 'SPACE_BETWEEN',
            'space-around': 'SPACE_AROUND',
            'space-evenly': 'SPACE_EVENLY'
        };
        return alignMap[alignValue] || 'MIN';
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FigmaExporter;
}
