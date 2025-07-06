// Content script for website capture functionality
class WebsiteCapture {
    constructor() {
        this.isCapturing = false;
        this.setupMessageListener();
    }
    
    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'captureWebsite') {
                this.captureWebsite().then(sendResponse);
                return true; // Indicates we will send a response asynchronously
            }
        });
    }
    
    async captureWebsite() {
        if (this.isCapturing) {
            return { success: false, error: 'Capture already in progress' };
        }
        
        try {
            this.isCapturing = true;
            
            // Create capture overlay
            this.showCaptureOverlay();
            
            // Perform the capture
            const captureData = await this.performCapture();
            
            // Hide overlay
            this.hideCaptureOverlay();
            
            return { success: true, data: captureData };
            
        } catch (error) {
            this.hideCaptureOverlay();
            return { success: false, error: error.message };
        } finally {
            this.isCapturing = false;
        }
    }
    
    showCaptureOverlay() {
        // Create visual feedback during capture
        const overlay = document.createElement('div');
        overlay.id = 'figma-capture-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(102, 126, 234, 0.1);
            z-index: 999999;
            pointer-events: none;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        const message = document.createElement('div');
        message.style.cssText = `
            background: white;
            padding: 20px 30px;
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            font-size: 16px;
            color: #333;
            animation: pulse 1.5s ease-in-out infinite;
        `;
        message.textContent = 'Capturing website structure...';
        
        // Add pulse animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }
        `;
        document.head.appendChild(style);
        
        overlay.appendChild(message);
        document.body.appendChild(overlay);
    }
    
    hideCaptureOverlay() {
        const overlay = document.getElementById('figma-capture-overlay');
        if (overlay) {
            overlay.remove();
        }
    }
    
    async performCapture() {
        // Scroll to top to ensure we capture from the beginning
        window.scrollTo(0, 0);
        
        // Wait for any lazy-loaded content
        await this.waitForStableDOM();
        
        // Create capture instance
        const capturer = new DOMCapturer();
        const captureResult = await capturer.capture();
        
        return captureResult;
    }
    
    async waitForStableDOM() {
        return new Promise(resolve => {
            let timeoutId;
            let lastHTML = document.documentElement.outerHTML;
            
            const checkStability = () => {
                const currentHTML = document.documentElement.outerHTML;
                if (currentHTML === lastHTML) {
                    resolve();
                } else {
                    lastHTML = currentHTML;
                    clearTimeout(timeoutId);
                    timeoutId = setTimeout(checkStability, 500);
                }
            };
            
            // Start checking
            timeoutId = setTimeout(checkStability, 500);
            
            // Maximum wait time
            setTimeout(resolve, 5000);
        });
    }
}

class DOMCapturer {
    constructor() {
        this.elements = [];
        this.images = [];
        this.textStyles = new Map();
        this.colors = new Set();
        this.fonts = new Set();
        this.processedElements = new Set();
    }
    
    async capture() {
        console.log('Starting DOM capture...');
        
        // Get page information
        const pageInfo = this.getPageInfo();
        
        // Capture all visible elements
        await this.captureElement(document.body, 0, null);
        
        // Process images
        await this.processAllImages();
        
        const result = {
            page: pageInfo,
            elements: this.elements,
            images: this.images,
            textStyles: Array.from(this.textStyles.entries()),
            colors: Array.from(this.colors),
            fonts: Array.from(this.fonts),
            capturedAt: new Date().toISOString()
        };
        
        console.log('Capture completed:', result);
        return result;
    }
    
    getPageInfo() {
        const body = document.body;
        const html = document.documentElement;
        
        return {
            url: window.location.href,
            title: document.title,
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            },
            scrollSize: {
                width: Math.max(
                    body.scrollWidth, html.scrollWidth,
                    body.offsetWidth, html.offsetWidth,
                    body.clientWidth, html.clientWidth
                ),
                height: Math.max(
                    body.scrollHeight, html.scrollHeight,
                    body.offsetHeight, html.offsetHeight,
                    body.clientHeight, html.clientHeight
                )
            },
            doctype: document.doctype ? document.doctype.name : 'html',
            lang: html.lang || 'en'
        };
    }
    
    async captureElement(element, depth, parent) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) return null;
        
        // Skip non-visual elements
        const skipTags = ['SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE', 'HEAD', 'NOSCRIPT'];
        if (skipTags.includes(element.tagName)) return null;
        
        // Avoid infinite loops
        if (this.processedElements.has(element)) return null;
        this.processedElements.add(element);
        
        const computedStyle = window.getComputedStyle(element);
        
        // Skip hidden elements
        if (this.isElementHidden(element, computedStyle)) return null;
        
        const rect = element.getBoundingClientRect();
        
        // Skip elements with no dimensions (unless they have children)
        if (rect.width === 0 && rect.height === 0 && element.children.length === 0) return null;
        
        const elementData = this.extractElementData(element, computedStyle, rect, depth, parent);
        this.elements.push(elementData);
        
        // Process children
        const children = [];
        for (const child of element.children) {
            const childData = await this.captureElement(child, depth + 1, elementData);
            if (childData) {
                children.push(childData);
            }
        }
        
        elementData.children = children;
        return elementData;
    }
    
    isElementHidden(element, style) {
        return (
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            parseFloat(style.opacity) === 0 ||
            style.clip === 'rect(0px, 0px, 0px, 0px)' ||
            (style.position === 'absolute' && (
                style.left === '-9999px' || 
                style.top === '-9999px'
            ))
        );
    }
    
    extractElementData(element, style, rect, depth, parent) {
        const id = this.generateUniqueId(element);
        
        // Calculate absolute position
        const absolutePosition = {
            x: rect.left + window.scrollX,
            y: rect.top + window.scrollY,
            width: rect.width,
            height: rect.height
        };
        
        // Extract layout properties
        const layout = {
            ...absolutePosition,
            zIndex: this.getZIndex(style, depth),
            position: style.position,
            display: style.display,
            float: style.float,
            clear: style.clear
        };
        
        // Extract spacing
        const spacing = this.extractSpacing(style);
        
        // Extract visual properties
        const visual = this.extractVisualProperties(style);
        
        // Extract typography
        const typography = this.extractTypography(style);
        
        // Extract flex/grid properties
        const flexGrid = this.extractFlexGridProperties(style);
        
        // Get text content
        const textContent = this.getElementTextContent(element);
        
        // Collect styles for export
        this.collectStylesForExport(visual, typography);
        
        const elementData = {
            id,
            tagName: element.tagName.toLowerCase(),
            className: element.className || '',
            layout,
            spacing,
            visual,
            typography,
            flexGrid,
            textContent,
            depth,
            parent: parent ? parent.id : null,
            attributes: this.extractRelevantAttributes(element),
            children: [] // Will be populated later
        };
        
        return elementData;
    }
    
    generateUniqueId(element) {
        const timestamp = performance.now();
        const random = Math.random().toString(36).substr(2, 9);
        const tagName = element.tagName.toLowerCase();
        return `${tagName}_${timestamp}_${random}`;
    }
    
    getZIndex(style, depth) {
        if (style.zIndex !== 'auto') {
            return parseInt(style.zIndex) || 0;
        }
        return depth;
    }
    
    extractSpacing(style) {
        return {
            margin: {
                top: this.parsePixelValue(style.marginTop),
                right: this.parsePixelValue(style.marginRight),
                bottom: this.parsePixelValue(style.marginBottom),
                left: this.parsePixelValue(style.marginLeft)
            },
            padding: {
                top: this.parsePixelValue(style.paddingTop),
                right: this.parsePixelValue(style.paddingRight),
                bottom: this.parsePixelValue(style.paddingBottom),
                left: this.parsePixelValue(style.paddingLeft)
            }
        };
    }
    
    extractVisualProperties(style) {
        return {
            backgroundColor: style.backgroundColor,
            color: style.color,
            opacity: parseFloat(style.opacity) || 1,
            border: {
                width: style.borderWidth,
                style: style.borderStyle,
                color: style.borderColor,
                radius: style.borderRadius
            },
            boxShadow: style.boxShadow,
            background: style.background,
            backgroundImage: style.backgroundImage,
            backgroundSize: style.backgroundSize,
            backgroundPosition: style.backgroundPosition,
            backgroundRepeat: style.backgroundRepeat
        };
    }
    
    extractTypography(style) {
        return {
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            fontStyle: style.fontStyle,
            lineHeight: style.lineHeight,
            textAlign: style.textAlign,
            textDecoration: style.textDecoration,
            textTransform: style.textTransform,
            letterSpacing: style.letterSpacing,
            wordSpacing: style.wordSpacing,
            whiteSpace: style.whiteSpace
        };
    }
    
    extractFlexGridProperties(style) {
        return {
            // Flexbox properties
            flexDirection: style.flexDirection,
            flexWrap: style.flexWrap,
            justifyContent: style.justifyContent,
            alignItems: style.alignItems,
            alignContent: style.alignContent,
            flex: style.flex,
            flexGrow: style.flexGrow,
            flexShrink: style.flexShrink,
            flexBasis: style.flexBasis,
            alignSelf: style.alignSelf,
            
            // Grid properties
            gridTemplateColumns: style.gridTemplateColumns,
            gridTemplateRows: style.gridTemplateRows,
            gridGap: style.gridGap,
            gridArea: style.gridArea,
            justifyItems: style.justifyItems,
            alignItems: style.alignItems
        };
    }
    
    getElementTextContent(element) {
        // Get direct text content, not from children
        let textContent = '';
        for (const node of element.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
                textContent += node.textContent;
            }
        }
        return textContent.trim();
    }
    
    collectStylesForExport(visual, typography) {
        // Collect colors
        if (visual.backgroundColor && visual.backgroundColor !== 'rgba(0, 0, 0, 0)') {
            this.colors.add(visual.backgroundColor);
        }
        if (visual.color && visual.color !== 'rgba(0, 0, 0, 0)') {
            this.colors.add(visual.color);
        }
        if (visual.border.color && visual.border.color !== 'rgba(0, 0, 0, 0)') {
            this.colors.add(visual.border.color);
        }
        
        // Collect fonts
        if (typography.fontFamily) {
            this.fonts.add(typography.fontFamily);
        }
        
        // Collect text styles
        const textStyleKey = `${typography.fontFamily}_${typography.fontSize}_${typography.fontWeight}_${visual.color}`;
        if (!this.textStyles.has(textStyleKey)) {
            this.textStyles.set(textStyleKey, {
                fontFamily: typography.fontFamily,
                fontSize: typography.fontSize,
                fontWeight: typography.fontWeight,
                fontStyle: typography.fontStyle,
                color: visual.color,
                lineHeight: typography.lineHeight,
                textAlign: typography.textAlign,
                count: 0
            });
        }
        this.textStyles.get(textStyleKey).count++;
    }
    
    extractRelevantAttributes(element) {
        const relevantAttrs = ['id', 'class', 'alt', 'title', 'href', 'src', 'type', 'role', 'data-*'];
        const attributes = {};
        
        for (const attr of element.attributes) {
            if (relevantAttrs.includes(attr.name) || attr.name.startsWith('data-')) {
                attributes[attr.name] = attr.value;
            }
        }
        
        return attributes;
    }
    
    parsePixelValue(value) {
        if (!value || value === 'auto') return 0;
        return parseFloat(value) || 0;
    }
    
    async processAllImages() {
        // Find all image elements in captured data
        const imageElements = this.elements.filter(el => el.tagName === 'img');
        
        for (const imgData of imageElements) {
            await this.processImageElement(imgData);
        }
    }
    
    async processImageElement(imgData) {
        try {
            // Find the actual DOM element
            const imgElement = document.querySelector(`[src="${imgData.attributes.src}"]`);
            if (!imgElement) return;
            
            // Create canvas and convert to base64
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Wait for image to load if not already loaded
            if (!imgElement.complete) {
                await new Promise((resolve, reject) => {
                    imgElement.onload = resolve;
                    imgElement.onerror = reject;
                    setTimeout(reject, 5000); // 5 second timeout
                });
            }
            
            canvas.width = imgElement.naturalWidth || imgElement.width;
            canvas.height = imgElement.naturalHeight || imgElement.height;
            
            ctx.drawImage(imgElement, 0, 0);
            
            const base64 = canvas.toDataURL('image/png', 0.8);
            
            this.images.push({
                elementId: imgData.id,
                src: imgData.attributes.src,
                alt: imgData.attributes.alt || '',
                width: canvas.width,
                height: canvas.height,
                base64: base64,
                fileSize: Math.round(base64.length * 0.75) // Approximate file size
            });
            
        } catch (error) {
            console.warn('Failed to process image:', imgData.attributes.src, error);
            
            // Add placeholder image data
            this.images.push({
                elementId: imgData.id,
                src: imgData.attributes.src,
                alt: imgData.attributes.alt || '',
                width: imgData.layout.width,
                height: imgData.layout.height,
                base64: null,
                error: error.message
            });
        }
    }
}

// Initialize the capture system
new WebsiteCapture();
