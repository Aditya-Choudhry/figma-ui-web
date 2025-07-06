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
            console.log('🔄 POPUP: Starting capture process...');
            this.updateStatus('Initializing capture...', 'loading');
            this.showProgress(0);
            this.captureBtn.disabled = true;
            
            // Get active tab
            console.log('🔍 POPUP: Getting active tab...');
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab) {
                throw new Error('No active tab found');
            }
            
            console.log('✅ POPUP: Active tab found:', {
                id: tab.id,
                url: tab.url,
                title: tab.title
            });
            
            // Check if we can access this tab
            if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://')) {
                throw new Error('Cannot capture browser internal pages. Please navigate to a regular website.');
            }
            
            // First, test if content script injection works at all
            console.log('🧪 POPUP: Testing content script injection...');
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['test-content.js']
                });
                
                // Test basic communication
                const testResponse = await chrome.tabs.sendMessage(tab.id, { action: 'test' });
                console.log('🧪 POPUP: Test response:', testResponse);
                
                if (testResponse && testResponse.success) {
                    console.log('✅ POPUP: Content script injection works!');
                } else {
                    throw new Error('Content script test failed');
                }
            } catch (testError) {
                console.error('❌ POPUP: Content script test failed:', testError);
                throw new Error('Cannot inject content scripts on this page. Please try a different website.');
            }
            
            this.updateStatus('Analyzing page structure...', 'loading');
            this.showProgress(20);
            
            console.log('📨 POPUP: Sending message to content script...');
            
            if (!tab) {
                throw new Error('No active tab found');
            }
            
            console.log('✅ POPUP: Active tab found:', {
                id: tab.id,
                url: tab.url,
                title: tab.title
            });
            
            // Check if we can access this tab
            if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://')) {
                throw new Error('Cannot capture browser internal pages. Please navigate to a regular website.');
            }
            
            this.updateStatus('Analyzing page structure...', 'loading');
            this.showProgress(20);
            
            console.log('📨 POPUP: Sending message to content script...');
            
            // Send message to content script to capture page data
            try {
                const response = await chrome.tabs.sendMessage(tab.id, {
                    action: 'captureWebsite'
                });
                
                console.log('📥 POPUP: Received response from content script:', response);
                
                if (!response || !response.success) {
                    throw new Error((response && response.error) || 'Failed to capture page data');
                }
                
                this.updateStatus('Processing elements...', 'loading');
                this.showProgress(60);
                
                const capturedData = response.data;
                console.log('✅ POPUP: Captured data received:', {
                    elements: (capturedData && capturedData.elements && capturedData.elements.length) || 0,
                    images: (capturedData && capturedData.images && capturedData.images.length) || 0
                });
                
            } catch (messageError) {
                console.error('❌ POPUP: Message sending failed:', messageError);
                console.log('🔄 POPUP: Attempting to inject content script manually...');
                
                // Try to inject content script manually
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['content.js']
                    });
                    
                    console.log('✅ POPUP: Content script injected manually, retrying...');
                    
                    // Wait a moment for script to initialize
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // Retry the message
                    const retryResponse = await chrome.tabs.sendMessage(tab.id, {
                        action: 'captureWebsite'
                    });
                    
                    console.log('📥 POPUP: Retry response:', retryResponse);
                    
                    if (!retryResponse || !retryResponse.success) {
                        throw new Error((retryResponse && retryResponse.error) || 'Failed to capture page data after retry');
                    }
                    
                    this.updateStatus('Processing elements...', 'loading');
                    this.showProgress(60);
                    
                    const capturedData = retryResponse.data;
                    console.log('✅ POPUP: Captured data received after retry:', {
                        elements: (capturedData && capturedData.elements && capturedData.elements.length) || 0,
                        images: (capturedData && capturedData.images && capturedData.images.length) || 0
                    });
                    
                } catch (retryError) {
                    console.error('❌ POPUP: Manual injection also failed:', retryError);
                    throw new Error('Content script not responding. Please:\n1. Refresh the webpage\n2. Make sure you\'re not on a chrome:// page\n3. Try again');
                }
            }
            
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
