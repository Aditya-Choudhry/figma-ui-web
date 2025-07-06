class PopupController {
    constructor() {
        this.captureBtn = document.getElementById('captureBtn');
        this.exportBtn = document.getElementById('exportBtn');
        this.status = document.getElementById('status');
        this.progressContainer = document.getElementById('progressContainer');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.capturedInfo = document.getElementById('capturedInfo');
        
        this.capturedData = null;
        
        this.init();
    }
    
    init() {
        this.captureBtn.addEventListener('click', () => this.captureWebsite());
        this.exportBtn.addEventListener('click', () => this.exportToFigma());
        
        // Check if we have previously captured data
        this.loadCapturedData();
    }
    
    async loadCapturedData() {
        try {
            const result = await chrome.storage.local.get(['capturedData']);
            if (result.capturedData) {
                this.capturedData = result.capturedData;
                this.updateUI(true);
                this.updateStatus('Previously captured data loaded', 'success');
            }
        } catch (error) {
            console.error('Error loading captured data:', error);
        }
    }
    
    async captureWebsite() {
        try {
            this.updateStatus('Initializing capture...', 'loading');
            this.showProgress(0);
            this.captureBtn.disabled = true;
            
            // Get active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab) {
                throw new Error('No active tab found');
            }
            
            this.updateStatus('Analyzing page structure...', 'loading');
            this.showProgress(20);
            
            // Execute content script to capture page data
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: this.injectCaptureScript
            });
            
            if (!results || !results[0] || !results[0].result) {
                throw new Error('Failed to capture page data');
            }
            
            this.updateStatus('Processing elements...', 'loading');
            this.showProgress(60);
            
            const capturedData = results[0].result;
            
            this.updateStatus('Converting to Figma format...', 'loading');
            this.showProgress(80);
            
            // Process and store the captured data
            this.capturedData = this.processCapturedData(capturedData);
            
            // Save to storage
            await chrome.storage.local.set({ capturedData: this.capturedData });
            
            this.showProgress(100);
            this.updateStatus('Capture completed successfully!', 'success');
            this.updateUI(true);
            
        } catch (error) {
            console.error('Capture error:', error);
            this.updateStatus(`Error: ${error.message}`, 'error');
        } finally {
            this.captureBtn.disabled = false;
            setTimeout(() => this.hideProgress(), 2000);
        }
    }
    
    // This function will be injected into the page
    injectCaptureScript() {
        // Create a comprehensive page capture system
        class PageCapture {
            constructor() {
                this.elements = [];
                this.images = [];
                this.textStyles = new Map();
                this.colors = new Set();
                this.fonts = new Set();
            }
            
            capture() {
                // Start from body element
                const body = document.body;
                const htmlElement = document.documentElement;
                
                // Get page metadata
                const pageData = {
                    url: window.location.href,
                    title: document.title,
                    viewport: {
                        width: window.innerWidth,
                        height: window.innerHeight
                    },
                    scrollSize: {
                        width: Math.max(body.scrollWidth, htmlElement.scrollWidth),
                        height: Math.max(body.scrollHeight, htmlElement.scrollHeight)
                    }
                };
                
                // Traverse DOM and capture elements
                this.traverseElement(body, 0);
                
                return {
                    page: pageData,
                    elements: this.elements,
                    images: this.images,
                    textStyles: Array.from(this.textStyles.entries()),
                    colors: Array.from(this.colors),
                    fonts: Array.from(this.fonts)
                };
            }
            
            traverseElement(element, depth) {
                if (!element || element.nodeType !== Node.ELEMENT_NODE) return;
                
                // Skip script, style, and other non-visual elements
                const skipTags = ['SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE', 'HEAD'];
                if (skipTags.includes(element.tagName)) return;
                
                // Skip hidden elements
                const computedStyle = window.getComputedStyle(element);
                if (computedStyle.display === 'none' || 
                    computedStyle.visibility === 'hidden' ||
                    computedStyle.opacity === '0') return;
                
                const rect = element.getBoundingClientRect();
                
                // Skip elements with no dimensions
                if (rect.width === 0 && rect.height === 0) return;
                
                const elementData = this.extractElementData(element, computedStyle, rect, depth);
                this.elements.push(elementData);
                
                // Process images
                if (element.tagName === 'IMG') {
                    this.processImage(element, elementData.id);
                }
                
                // Process text content
                if (element.textContent && element.textContent.trim()) {
                    this.processTextStyles(computedStyle, element.textContent.trim());
                }
                
                // Recursively process children
                for (const child of element.children) {
                    this.traverseElement(child, depth + 1);
                }
            }
            
            extractElementData(element, style, rect, depth) {
                const id = this.generateElementId(element);
                
                // Extract positioning and layout
                const layout = {
                    x: rect.left + window.scrollX,
                    y: rect.top + window.scrollY,
                    width: rect.width,
                    height: rect.height,
                    zIndex: style.zIndex !== 'auto' ? parseInt(style.zIndex) : depth
                };
                
                // Extract spacing
                const spacing = {
                    margin: {
                        top: parseFloat(style.marginTop) || 0,
                        right: parseFloat(style.marginRight) || 0,
                        bottom: parseFloat(style.marginBottom) || 0,
                        left: parseFloat(style.marginLeft) || 0
                    },
                    padding: {
                        top: parseFloat(style.paddingTop) || 0,
                        right: parseFloat(style.paddingRight) || 0,
                        bottom: parseFloat(style.paddingBottom) || 0,
                        left: parseFloat(style.paddingLeft) || 0
                    }
                };
                
                // Extract visual styles
                const visual = {
                    backgroundColor: style.backgroundColor,
                    color: style.color,
                    borderRadius: style.borderRadius,
                    border: {
                        width: style.borderWidth,
                        style: style.borderStyle,
                        color: style.borderColor
                    },
                    boxShadow: style.boxShadow,
                    opacity: parseFloat(style.opacity) || 1
                };
                
                // Extract typography
                const typography = {
                    fontFamily: style.fontFamily,
                    fontSize: style.fontSize,
                    fontWeight: style.fontWeight,
                    lineHeight: style.lineHeight,
                    textAlign: style.textAlign,
                    textDecoration: style.textDecoration,
                    letterSpacing: style.letterSpacing
                };
                
                // Collect colors and fonts
                if (visual.backgroundColor && visual.backgroundColor !== 'rgba(0, 0, 0, 0)') {
                    this.colors.add(visual.backgroundColor);
                }
                if (visual.color) {
                    this.colors.add(visual.color);
                }
                if (typography.fontFamily) {
                    this.fonts.add(typography.fontFamily);
                }
                
                return {
                    id,
                    tagName: element.tagName,
                    className: element.className,
                    textContent: element.textContent ? element.textContent.trim().substring(0, 200) : '',
                    layout,
                    spacing,
                    visual,
                    typography,
                    depth,
                    attributes: this.extractRelevantAttributes(element)
                };
            }
            
            generateElementId(element) {
                const timestamp = Date.now();
                const random = Math.random().toString(36).substr(2, 9);
                return `element_${timestamp}_${random}`;
            }
            
            extractRelevantAttributes(element) {
                const relevant = ['id', 'class', 'alt', 'title', 'href', 'src'];
                const attrs = {};
                
                for (const attr of relevant) {
                    if (element.hasAttribute(attr)) {
                        attrs[attr] = element.getAttribute(attr);
                    }
                }
                
                return attrs;
            }
            
            async processImage(imgElement, elementId) {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Set canvas size to image size
                    canvas.width = imgElement.naturalWidth || imgElement.width;
                    canvas.height = imgElement.naturalHeight || imgElement.height;
                    
                    // Draw image to canvas
                    ctx.drawImage(imgElement, 0, 0);
                    
                    // Convert to base64
                    const base64 = canvas.toDataURL('image/png');
                    
                    this.images.push({
                        elementId,
                        src: imgElement.src,
                        alt: imgElement.alt || '',
                        base64,
                        width: canvas.width,
                        height: canvas.height
                    });
                    
                } catch (error) {
                    console.warn('Failed to process image:', imgElement.src, error);
                    // Fallback: store image info without base64
                    this.images.push({
                        elementId,
                        src: imgElement.src,
                        alt: imgElement.alt || '',
                        base64: null,
                        width: imgElement.naturalWidth || imgElement.width,
                        height: imgElement.naturalHeight || imgElement.height
                    });
                }
            }
            
            processTextStyles(style, text) {
                const styleKey = `${style.fontFamily}_${style.fontSize}_${style.fontWeight}_${style.color}`;
                
                if (!this.textStyles.has(styleKey)) {
                    this.textStyles.set(styleKey, {
                        fontFamily: style.fontFamily,
                        fontSize: style.fontSize,
                        fontWeight: style.fontWeight,
                        color: style.color,
                        lineHeight: style.lineHeight,
                        textAlign: style.textAlign,
                        samples: []
                    });
                }
                
                const styleData = this.textStyles.get(styleKey);
                if (styleData.samples.length < 3) {
                    styleData.samples.push(text.substring(0, 50));
                }
            }
        }
        
        // Execute capture
        const capture = new PageCapture();
        return capture.capture();
    }
    
    processCapturedData(rawData) {
        // Convert captured data to Figma-compatible format
        const figmaData = {
            name: rawData.page.title || 'Captured Website',
            type: 'FRAME',
            width: rawData.page.scrollSize.width,
            height: rawData.page.scrollSize.height,
            backgroundColor: { r: 1, g: 1, b: 1, a: 1 },
            children: [],
            metadata: {
                url: rawData.page.url,
                capturedAt: new Date().toISOString(),
                viewport: rawData.page.viewport,
                totalElements: rawData.elements.length,
                totalImages: rawData.images.length,
                totalTextStyles: rawData.textStyles.length,
                totalColors: rawData.colors.length
            }
        };
        
        // Convert elements to Figma nodes
        for (const element of rawData.elements) {
            const figmaNode = this.convertElementToFigmaNode(element, rawData.images);
            if (figmaNode) {
                figmaData.children.push(figmaNode);
            }
        }
        
        // Add styles
        figmaData.textStyles = this.convertTextStyles(rawData.textStyles);
        figmaData.colorStyles = this.convertColors(rawData.colors);
        figmaData.images = rawData.images;
        
        return figmaData;
    }
    
    convertElementToFigmaNode(element, images) {
        const baseNode = {
            id: element.id,
            name: this.generateNodeName(element),
            x: element.layout.x,
            y: element.layout.y,
            width: element.layout.width,
            height: element.layout.height,
            opacity: element.visual.opacity
        };
        
        // Determine node type based on element
        if (element.tagName === 'IMG') {
            const imageData = images.find(img => img.elementId === element.id);
            return {
                ...baseNode,
                type: 'IMAGE',
                imageData: imageData || null,
                fills: []
            };
        } else if (element.textContent && element.textContent.length > 0) {
            return {
                ...baseNode,
                type: 'TEXT',
                characters: element.textContent,
                fontSize: parseFloat(element.typography.fontSize) || 16,
                fontFamily: element.typography.fontFamily,
                fontWeight: element.typography.fontWeight,
                textAlign: element.typography.textAlign,
                fills: [this.convertColorToFigmaFill(element.visual.color)]
            };
        } else {
            // Frame/Rectangle
            return {
                ...baseNode,
                type: 'FRAME',
                fills: element.visual.backgroundColor ? 
                    [this.convertColorToFigmaFill(element.visual.backgroundColor)] : [],
                strokes: element.visual.border.width !== '0px' ? 
                    [this.convertColorToFigmaFill(element.visual.border.color)] : [],
                strokeWeight: parseFloat(element.visual.border.width) || 0,
                cornerRadius: parseFloat(element.visual.borderRadius) || 0,
                children: []
            };
        }
    }
    
    generateNodeName(element) {
        if (element.attributes.id) {
            return `${element.tagName}#${element.attributes.id}`;
        } else if (element.attributes.class) {
            const classes = element.attributes.class.split(' ').slice(0, 2).join('.');
            return `${element.tagName}.${classes}`;
        } else if (element.textContent && element.textContent.length > 0) {
            return `${element.tagName}: ${element.textContent.substring(0, 30)}...`;
        } else {
            return element.tagName;
        }
    }
    
    convertColorToFigmaFill(colorString) {
        if (!colorString || colorString === 'rgba(0, 0, 0, 0)') {
            return null;
        }
        
        // Parse color string and convert to Figma format
        const color = this.parseColor(colorString);
        return {
            type: 'SOLID',
            color: {
                r: color.r / 255,
                g: color.g / 255,
                b: color.b / 255
            },
            opacity: color.a || 1
        };
    }
    
    parseColor(colorString) {
        // Handle different color formats
        if (colorString.startsWith('rgb(')) {
            const match = colorString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            return match ? {
                r: parseInt(match[1]),
                g: parseInt(match[2]),
                b: parseInt(match[3]),
                a: 1
            } : { r: 0, g: 0, b: 0, a: 1 };
        } else if (colorString.startsWith('rgba(')) {
            const match = colorString.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
            return match ? {
                r: parseInt(match[1]),
                g: parseInt(match[2]),
                b: parseInt(match[3]),
                a: parseFloat(match[4])
            } : { r: 0, g: 0, b: 0, a: 1 };
        } else if (colorString.startsWith('#')) {
            const hex = colorString.substring(1);
            return {
                r: parseInt(hex.substr(0, 2), 16),
                g: parseInt(hex.substr(2, 2), 16),
                b: parseInt(hex.substr(4, 2), 16),
                a: 1
            };
        }
        
        return { r: 0, g: 0, b: 0, a: 1 };
    }
    
    convertTextStyles(textStyles) {
        return textStyles.map(([key, style]) => ({
            id: key,
            name: `${style.fontFamily} ${style.fontSize}`,
            fontFamily: style.fontFamily,
            fontSize: parseFloat(style.fontSize),
            fontWeight: style.fontWeight,
            lineHeight: style.lineHeight,
            textAlign: style.textAlign,
            color: style.color,
            samples: style.samples
        }));
    }
    
    convertColors(colors) {
        return colors.map(color => ({
            id: color,
            name: color,
            color: this.convertColorToFigmaFill(color)
        }));
    }
    
    async exportToFigma() {
        if (!this.capturedData) {
            this.updateStatus('No captured data to export', 'error');
            return;
        }
        
        try {
            this.updateStatus('Preparing export...', 'loading');
            this.exportBtn.disabled = true;
            
            // Create filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `figma-export-${timestamp}.json`;
            
            // Create download blob
            const jsonString = JSON.stringify(this.capturedData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            // Trigger download
            await chrome.downloads.download({
                url: url,
                filename: filename,
                saveAs: true
            });
            
            this.updateStatus('Export completed successfully!', 'success');
            
            // Clean up
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            
        } catch (error) {
            console.error('Export error:', error);
            this.updateStatus(`Export failed: ${error.message}`, 'error');
        } finally {
            this.exportBtn.disabled = false;
        }
    }
    
    updateUI(hasCapturedData) {
        this.exportBtn.disabled = !hasCapturedData;
        
        if (hasCapturedData && this.capturedData) {
            // Update captured info display
            document.getElementById('elementCount').textContent = 
                this.capturedData.metadata.totalElements;
            document.getElementById('imageCount').textContent = 
                this.capturedData.metadata.totalImages;
            document.getElementById('textStyleCount').textContent = 
                this.capturedData.metadata.totalTextStyles;
            document.getElementById('colorCount').textContent = 
                this.capturedData.metadata.totalColors;
            
            this.capturedInfo.style.display = 'block';
        } else {
            this.capturedInfo.style.display = 'none';
        }
    }
    
    updateStatus(message, type = 'info') {
        const statusEl = this.status.querySelector('p');
        statusEl.textContent = message;
        
        // Reset classes
        this.status.className = 'status';
        
        // Add type-specific styling
        if (type === 'loading') {
            this.status.classList.add('loading');
        } else if (type === 'error') {
            statusEl.style.color = '#dc3545';
        } else if (type === 'success') {
            statusEl.style.color = '#28a745';
        } else {
            statusEl.style.color = '#666';
        }
    }
    
    showProgress(percentage) {
        this.progressContainer.style.display = 'block';
        this.progressFill.style.width = `${percentage}%`;
        this.progressText.textContent = `${percentage}%`;
    }
    
    hideProgress() {
        this.progressContainer.style.display = 'none';
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PopupController();
});
