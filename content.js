// Content script for website capture functionality
console.log('🚀 CONTENT: Content script loaded on:', window.location.href);

class WebsiteCapture {
    constructor() {
        this.isCapturing = false;
        console.log('🔧 CONTENT: WebsiteCapture instance created');
        this.setupMessageListener();
    }
    
    setupMessageListener() {
        console.log('🎧 CONTENT: Setting up message listener...');
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('📨 CONTENT: Message received:', request);
            
            if (request.action === 'captureWebsite') {
                console.log('🔄 CONTENT: Starting website capture...');
                this.captureWebsite().then(result => {
                    console.log('✅ CONTENT: Capture completed, sending response:', result);
                    sendResponse(result);
                }).catch(error => {
                    console.error('❌ CONTENT: Capture failed:', error);
                    sendResponse({ success: false, error: error.message });
                });
                return true; // Indicates we will send a response asynchronously
            }
            
            console.log('❓ CONTENT: Unknown action:', request.action);
        });
        
        console.log('✅ CONTENT: Message listener ready');
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
        this.gradients = new Set();
        this.shadows = new Set();
        this.animations = new Set();
        this.transforms = new Set();
        this.mediaQueries = new Set();
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
            gradients: Array.from(this.gradients),
            shadows: Array.from(this.shadows),
            animations: Array.from(this.animations),
            transforms: Array.from(this.transforms),
            mediaQueries: Array.from(this.mediaQueries),
            capturedAt: new Date().toISOString(),
            comprehensiveCapture: true,
            captureVersion: '2.0'
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
        
        // Extract comprehensive element data based on the document requirements
        const elementData = {
            // 1. Structural & Semantic Info
            id: id,
            tagName: element.tagName,
            className: element.className,
            elementId: element.id,
            attributes: this.extractAllAttributes(element),
            role: element.getAttribute('role'),
            ariaLabel: element.getAttribute('aria-label'),
            ariaDescribedBy: element.getAttribute('aria-describedby'),
            textContent: element.textContent ? element.textContent.trim().substring(0, 200) : '',
            innerHTML: element.innerHTML ? element.innerHTML.substring(0, 500) : '',
            
            // 2. Geometry & Layout
            position: absolutePosition,
            boundingRect: {
                x: rect.left,
                y: rect.top,
                width: rect.width,
                height: rect.height,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
                left: rect.left
            },
            boxModel: this.extractBoxModel(style),
            layout: this.extractLayoutProperties(style),
            
            // 3. Typography
            typography: this.extractTypographyData(style),
            
            // 4. Color & Visual Styles
            colors: this.extractColorData(style),
            visual: this.extractVisualStyles(style),
            
            // 5. Backgrounds & Images
            backgrounds: this.extractBackgroundData(style, element),
            
            // 6. Transforms & Animations
            transforms: this.extractTransformData(style),
            animations: this.extractAnimationData(style),
            
            // 7. Responsive & Media Queries
            responsive: this.extractResponsiveData(style),
            
            // 8. Fonts & Icon Sets
            fonts: this.extractFontData(style),
            
            // 9. Pseudo-Elements & Pseudo-Classes
            pseudoElements: this.extractPseudoElementData(element),
            
            // 10. Interactivity Metadata
            interactivity: this.extractInteractivityData(element),
            
            // Hierarchy information
            depth: depth,
            parent: parent ? parent.id : null,
            zIndex: this.parseNumericValue(style.zIndex),
            
            // Element type classification
            elementType: this.classifyElementType(element),
            isContainer: this.isContainerElement(element, style),
            hasChildren: element.children.length > 0,
            
            // Additional metadata
            computedStyles: this.extractComputedStyles(style),
            capturedAt: new Date().toISOString()
        };
        
        return elementData;
    }
    
    generateUniqueId(element) {
        const timestamp = performance.now();
        const random = Math.random().toString(36).substr(2, 9);
        const tagName = element.tagName.toLowerCase();
        return `${tagName}_${timestamp}_${random}`;
    }
    
    // Helper methods for comprehensive data extraction
    extractAllAttributes(element) {
        const attributes = {};
        for (let i = 0; i < element.attributes.length; i++) {
            const attr = element.attributes[i];
            attributes[attr.name] = attr.value;
        }
        return attributes;
    }
    
    extractBoxModel(style) {
        return {
            margin: {
                top: this.parsePixelValue(style.marginTop),
                right: this.parsePixelValue(style.marginRight),
                bottom: this.parsePixelValue(style.marginBottom),
                left: this.parsePixelValue(style.marginLeft)
            },
            border: {
                width: {
                    top: this.parsePixelValue(style.borderTopWidth),
                    right: this.parsePixelValue(style.borderRightWidth),
                    bottom: this.parsePixelValue(style.borderBottomWidth),
                    left: this.parsePixelValue(style.borderLeftWidth)
                },
                style: {
                    top: style.borderTopStyle,
                    right: style.borderRightStyle,
                    bottom: style.borderBottomStyle,
                    left: style.borderLeftStyle
                },
                color: {
                    top: style.borderTopColor,
                    right: style.borderRightColor,
                    bottom: style.borderBottomColor,
                    left: style.borderLeftColor
                },
                radius: {
                    topLeft: this.parsePixelValue(style.borderTopLeftRadius),
                    topRight: this.parsePixelValue(style.borderTopRightRadius),
                    bottomLeft: this.parsePixelValue(style.borderBottomLeftRadius),
                    bottomRight: this.parsePixelValue(style.borderBottomRightRadius)
                }
            },
            padding: {
                top: this.parsePixelValue(style.paddingTop),
                right: this.parsePixelValue(style.paddingRight),
                bottom: this.parsePixelValue(style.paddingBottom),
                left: this.parsePixelValue(style.paddingLeft)
            }
        };
    }
    
    extractLayoutProperties(style) {
        return {
            display: style.display,
            position: style.position,
            top: style.top,
            left: style.left,
            right: style.right,
            bottom: style.bottom,
            float: style.float,
            clear: style.clear,
            overflow: style.overflow,
            overflowX: style.overflowX,
            overflowY: style.overflowY,
            zIndex: style.zIndex,
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
            gridColumnGap: style.gridColumnGap,
            gridRowGap: style.gridRowGap,
            gridColumn: style.gridColumn,
            gridRow: style.gridRow,
            gridArea: style.gridArea,
            justifySelf: style.justifySelf,
            alignSelf: style.alignSelf
        };
    }
    
    extractTypographyData(style) {
        const typography = {
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            fontStyle: style.fontStyle,
            lineHeight: style.lineHeight,
            letterSpacing: style.letterSpacing,
            wordSpacing: style.wordSpacing,
            textAlign: style.textAlign,
            textDecoration: style.textDecoration,
            textTransform: style.textTransform,
            color: style.color,
            textShadow: style.textShadow,
            whiteSpace: style.whiteSpace,
            wordBreak: style.wordBreak,
            textOverflow: style.textOverflow
        };
        
        // Add to fonts collection
        if (style.fontFamily) {
            this.fonts.add(style.fontFamily);
        }
        
        return typography;
    }
    
    extractColorData(style) {
        const colors = {
            color: style.color,
            backgroundColor: style.backgroundColor,
            borderColor: style.borderColor,
            outlineColor: style.outlineColor
        };
        
        // Add colors to collection
        Object.values(colors).forEach(color => {
            if (color && color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)') {
                this.colors.add(color);
            }
        });
        
        return colors;
    }
    
    extractVisualStyles(style) {
        const visual = {
            opacity: parseFloat(style.opacity) || 1,
            visibility: style.visibility,
            boxShadow: style.boxShadow,
            textShadow: style.textShadow,
            outline: style.outline,
            filter: style.filter,
            backdropFilter: style.backdropFilter,
            mixBlendMode: style.mixBlendMode,
            clipPath: style.clipPath,
            mask: style.mask,
            cursor: style.cursor,
            pointerEvents: style.pointerEvents
        };
        
        // Collect shadows for analysis
        if (style.boxShadow && style.boxShadow !== 'none') {
            this.shadows.add(style.boxShadow);
        }
        
        return visual;
    }
    
    extractBackgroundData(style, element) {
        const background = {
            backgroundColor: style.backgroundColor,
            backgroundImage: style.backgroundImage,
            backgroundPosition: style.backgroundPosition,
            backgroundSize: style.backgroundSize,
            backgroundRepeat: style.backgroundRepeat,
            backgroundAttachment: style.backgroundAttachment,
            backgroundClip: style.backgroundClip,
            backgroundOrigin: style.backgroundOrigin
        };
        
        // Collect gradients
        if (style.backgroundImage && style.backgroundImage.includes('gradient')) {
            this.gradients.add(style.backgroundImage);
        }
        
        // Handle image elements
        if (element.tagName === 'IMG' && element.src) {
            background.imageSrc = element.src;
            background.imageAlt = element.alt;
            background.imageNaturalWidth = element.naturalWidth;
            background.imageNaturalHeight = element.naturalHeight;
        }
        
        return background;
    }
    
    extractTransformData(style) {
        const transform = {
            transform: style.transform,
            transformOrigin: style.transformOrigin,
            transformStyle: style.transformStyle,
            perspective: style.perspective,
            perspectiveOrigin: style.perspectiveOrigin,
            backfaceVisibility: style.backfaceVisibility
        };
        
        // Collect transforms
        if (style.transform && style.transform !== 'none') {
            this.transforms.add(style.transform);
        }
        
        return transform;
    }
    
    extractAnimationData(style) {
        const animation = {
            animationName: style.animationName,
            animationDuration: style.animationDuration,
            animationTimingFunction: style.animationTimingFunction,
            animationDelay: style.animationDelay,
            animationIterationCount: style.animationIterationCount,
            animationDirection: style.animationDirection,
            animationFillMode: style.animationFillMode,
            animationPlayState: style.animationPlayState,
            transition: style.transition,
            transitionProperty: style.transitionProperty,
            transitionDuration: style.transitionDuration,
            transitionTimingFunction: style.transitionTimingFunction,
            transitionDelay: style.transitionDelay
        };
        
        // Collect animations
        if (style.animationName && style.animationName !== 'none') {
            this.animations.add(style.animationName);
        }
        
        return animation;
    }
    
    extractResponsiveData(style) {
        return {
            width: style.width,
            height: style.height,
            minWidth: style.minWidth,
            minHeight: style.minHeight,
            maxWidth: style.maxWidth,
            maxHeight: style.maxHeight,
            aspectRatio: style.aspectRatio,
            objectFit: style.objectFit,
            objectPosition: style.objectPosition
        };
    }
    
    extractFontData(style) {
        return {
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            fontStyle: style.fontStyle,
            fontVariant: style.fontVariant,
            fontStretch: style.fontStretch,
            fontSizeAdjust: style.fontSizeAdjust,
            fontKerning: style.fontKerning,
            fontFeatureSettings: style.fontFeatureSettings,
            fontVariationSettings: style.fontVariationSettings
        };
    }
    
    extractPseudoElementData(element) {
        const pseudoData = {};
        
        try {
            // Try to get pseudo-element styles (limited by browser security)
            const beforeStyle = window.getComputedStyle(element, '::before');
            const afterStyle = window.getComputedStyle(element, '::after');
            
            if (beforeStyle.content !== 'none') {
                pseudoData.before = {
                    content: beforeStyle.content,
                    display: beforeStyle.display,
                    position: beforeStyle.position,
                    width: beforeStyle.width,
                    height: beforeStyle.height
                };
            }
            
            if (afterStyle.content !== 'none') {
                pseudoData.after = {
                    content: afterStyle.content,
                    display: afterStyle.display,
                    position: afterStyle.position,
                    width: afterStyle.width,
                    height: afterStyle.height
                };
            }
        } catch (e) {
            // Pseudo-element access may be restricted
        }
        
        return pseudoData;
    }
    
    extractInteractivityData(element) {
        const interactivity = {
            href: element.href,
            target: element.target,
            type: element.type,
            value: element.value,
            placeholder: element.placeholder,
            disabled: element.disabled,
            checked: element.checked,
            selected: element.selected,
            tabIndex: element.tabIndex,
            contentEditable: element.contentEditable,
            draggable: element.draggable,
            clickable: this.isClickableElement(element),
            focusable: this.isFocusableElement(element),
            formElement: this.isFormElement(element),
            dataAttributes: this.extractDataAttributes(element)
        };
        
        return interactivity;
    }
    
    extractComputedStyles(style) {
        // Extract essential computed styles for Figma compatibility
        const computedStyles = {};
        const importantProperties = [
            'display', 'position', 'float', 'clear', 'overflow', 'visibility',
            'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
            'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
            'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
            'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
            'borderTopStyle', 'borderRightStyle', 'borderBottomStyle', 'borderLeftStyle',
            'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
            'borderRadius', 'color', 'backgroundColor', 'backgroundImage',
            'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight',
            'textAlign', 'textDecoration', 'textTransform', 'letterSpacing',
            'opacity', 'zIndex', 'transform', 'boxShadow', 'textShadow'
        ];
        
        importantProperties.forEach(prop => {
            if (style[prop]) {
                computedStyles[prop] = style[prop];
            }
        });
        
        return computedStyles;
    }
    
    classifyElementType(element) {
        const tagName = element.tagName.toLowerCase();
        
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
            return 'heading';
        } else if (['p', 'span', 'em', 'strong', 'i', 'b'].includes(tagName)) {
            return 'text';
        } else if (['img', 'svg', 'canvas', 'video', 'audio'].includes(tagName)) {
            return 'media';
        } else if (['button', 'input', 'select', 'textarea', 'form'].includes(tagName)) {
            return 'interactive';
        } else if (['div', 'section', 'article', 'header', 'footer', 'nav', 'main', 'aside'].includes(tagName)) {
            return 'container';
        } else if (['ul', 'ol', 'li', 'dl', 'dt', 'dd'].includes(tagName)) {
            return 'list';
        } else if (['table', 'tr', 'td', 'th', 'thead', 'tbody', 'tfoot'].includes(tagName)) {
            return 'table';
        } else if (tagName === 'a') {
            return 'link';
        } else {
            return 'other';
        }
    }
    
    isContainerElement(element, style) {
        const containerTags = ['div', 'section', 'article', 'header', 'footer', 'nav', 'main', 'aside'];
        const isFlexOrGrid = style.display === 'flex' || style.display === 'grid' || style.display === 'inline-flex' || style.display === 'inline-grid';
        
        return containerTags.includes(element.tagName.toLowerCase()) || isFlexOrGrid || element.children.length > 0;
    }
    
    isClickableElement(element) {
        const clickableTags = ['a', 'button', 'input', 'select', 'textarea'];
        return clickableTags.includes(element.tagName.toLowerCase()) || 
               element.onclick || 
               element.getAttribute('onclick') || 
               element.style.cursor === 'pointer';
    }
    
    isFocusableElement(element) {
        const focusableTags = ['a', 'button', 'input', 'select', 'textarea'];
        return focusableTags.includes(element.tagName.toLowerCase()) || 
               element.tabIndex >= 0 || 
               element.contentEditable === 'true';
    }
    
    isFormElement(element) {
        const formTags = ['form', 'input', 'select', 'textarea', 'button', 'fieldset', 'legend', 'label'];
        return formTags.includes(element.tagName.toLowerCase());
    }
    
    extractDataAttributes(element) {
        const dataAttributes = {};
        for (let i = 0; i < element.attributes.length; i++) {
            const attr = element.attributes[i];
            if (attr.name.startsWith('data-')) {
                dataAttributes[attr.name] = attr.value;
            }
        }
        return dataAttributes;
    }
    
    parsePixelValue(value) {
        if (!value || value === 'auto') return 0;
        const match = value.match(/^(\d+(?:\.\d+)?)/);
        return match ? parseFloat(match[1]) : 0;
    }
    
    parseNumericValue(value) {
        if (!value || value === 'auto') return 0;
        return parseFloat(value) || 0;
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
console.log('🔧 CONTENT: Initializing WebsiteCapture...');
const websiteCapture = new WebsiteCapture();
console.log('✅ CONTENT: WebsiteCapture initialized successfully');
