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
            console.log('Starting capture process...');
            this.updateStatus('Initializing capture...', 'loading');
            this.showProgress(0);
            this.captureBtn.disabled = true;
            
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab) {
                throw new Error('No active tab found');
            }
            
            console.log('Active tab found:', tab.url);
            
            if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
                throw new Error('Cannot capture browser internal pages. Please navigate to a regular website.');
            }
            
            this.updateStatus('Analyzing page structure...', 'loading');
            this.showProgress(20);
            
            console.log('Injecting capture function...');
            
            // First try a simple test
            const testResults = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    console.log('Simple test function executing...');
                    return {
                        test: 'success',
                        bodyExists: !!document.body,
                        bodyChildren: document.body ? document.body.children.length : 0,
                        url: window.location.href
                    };
                }
            });
            
            console.log('Test results:', testResults);
            
            if (!testResults || !testResults[0] || !testResults[0].result) {
                throw new Error('Basic script injection failed');
            }
            
            // Now try the full capture
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: this.capturePageFunction
            });
            
            console.log('Script execution results:', results);
            
            if (!results || !results[0]) {
                throw new Error('Script injection failed - no results returned');
            }
            
            if (results[0].error) {
                throw new Error(`Script execution error: ${results[0].error}`);
            }
            
            if (!results[0].result) {
                console.log('Full results object:', JSON.stringify(results, null, 2));
                throw new Error('Capture function returned no data');
            }
            
            console.log('Raw data received:', results[0].result);
            
            this.updateStatus('Processing elements...', 'loading');
            this.showProgress(60);
            
            const rawData = results[0].result;
            this.capturedData = this.processCapturedData(rawData);
            
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
    
    capturePageFunction() {
        try {
            console.log('Capture function executing...');
            
            class PageCapture {
                constructor() {
                    this.elements = [];
                    this.images = [];
                    this.textStyles = new Map();
                    this.colors = new Set();
                    this.fonts = new Set();
                }
                
                capture() {
                    try {
                        console.log('Starting DOM capture...');
                        const body = document.body;
                        const html = document.documentElement;
                        
                        console.log('Body element:', body);
                        console.log('Body children count:', body ? body.children.length : 0);
                        
                        const pageData = {
                            url: window.location.href,
                            title: document.title,
                            viewport: {
                                width: window.innerWidth,
                                height: window.innerHeight
                            },
                            scrollSize: {
                                width: Math.max(body.scrollWidth, html.scrollWidth),
                                height: Math.max(body.scrollHeight, html.scrollHeight)
                            }
                        };
                        
                        console.log('Page data:', pageData);
                        
                        this.traverseElement(body, 0);
                        
                        console.log('Elements found:', this.elements.length);
                        console.log('Sample elements:', this.elements.slice(0, 3));
                        
                        const result = {
                            page: pageData,
                            elements: this.elements,
                            images: this.images,
                            textStyles: Array.from(this.textStyles.entries()),
                            colors: Array.from(this.colors),
                            fonts: Array.from(this.fonts)
                        };
                        
                        console.log('Final capture result:', result);
                        return result;
                    } catch (error) {
                        console.error('Capture error:', error);
                        throw error;
                    }
                }
                
                traverseElement(element, depth) {
                    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
                        console.log('Skipping non-element node');
                        return;
                    }
                    
                    console.log(`Processing element: ${element.tagName} at depth ${depth}`);
                    
                    const skipTags = ['SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE', 'HEAD'];
                    if (skipTags.includes(element.tagName)) {
                        console.log(`Skipping ${element.tagName} (in skip list)`);
                        return;
                    }
                    
                    const computedStyle = window.getComputedStyle(element);
                    if (computedStyle.display === 'none' || 
                        computedStyle.visibility === 'hidden' ||
                        computedStyle.opacity === '0') {
                        console.log(`Skipping ${element.tagName} (hidden)`);
                        return;
                    }
                    
                    const rect = element.getBoundingClientRect();
                    if (rect.width === 0 && rect.height === 0) {
                        console.log(`Skipping ${element.tagName} (zero dimensions)`);
                        return;
                    }
                    
                    console.log(`Adding element: ${element.tagName}, size: ${rect.width}x${rect.height}`);
                    const elementData = this.extractElementData(element, computedStyle, rect, depth);
                    this.elements.push(elementData);
                    
                    for (const child of element.children) {
                        this.traverseElement(child, depth + 1);
                    }
                }
                
                extractElementData(element, style, rect, depth) {
                    const id = `element_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    
                    const layout = {
                        x: rect.left + window.scrollX,
                        y: rect.top + window.scrollY,
                        width: rect.width,
                        height: rect.height,
                        zIndex: style.zIndex !== 'auto' ? parseInt(style.zIndex) : depth
                    };
                    
                    const visual = {
                        backgroundColor: style.backgroundColor,
                        color: style.color,
                        borderRadius: style.borderRadius,
                        border: {
                            width: style.borderWidth,
                            style: style.borderStyle,
                            color: style.borderColor
                        },
                        opacity: parseFloat(style.opacity) || 1
                    };
                    
                    const typography = {
                        fontFamily: style.fontFamily,
                        fontSize: style.fontSize,
                        fontWeight: style.fontWeight,
                        lineHeight: style.lineHeight,
                        textAlign: style.textAlign
                    };
                    
                    // Collect styles
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
                        tagName: element.tagName.toLowerCase(),
                        className: element.className || '',
                        textContent: element.textContent ? element.textContent.trim().substring(0, 200) : '',
                        layout,
                        visual,
                        typography,
                        depth
                    };
                }
            }
            
            const capture = new PageCapture();
            const result = capture.capture();
            console.log('Capture completed successfully:', result);
            return result;
            
        } catch (error) {
            console.error('Capture function error:', error);
            throw new Error(`DOM capture failed: ${error.message}`);
        }
    }
    
    processCapturedData(rawData) {
        return {
            name: rawData.page.title || 'Captured Website',
            type: 'FRAME',
            width: rawData.page.scrollSize.width,
            height: rawData.page.scrollSize.height,
            children: rawData.elements.map(el => ({
                id: el.id,
                name: el.tagName,
                type: el.textContent ? 'TEXT' : 'RECTANGLE',
                x: el.layout.x,
                y: el.layout.y,
                width: el.layout.width,
                height: el.layout.height,
                characters: el.textContent || undefined
            })),
            metadata: {
                url: rawData.page.url,
                totalElements: rawData.elements.length,
                capturedAt: new Date().toISOString()
            }
        };
    }
    
    async exportToFigma() {
        if (!this.capturedData) {
            this.updateStatus('No data to export. Please capture a page first.', 'error');
            return;
        }
        
        try {
            const jsonString = JSON.stringify(this.capturedData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `figma-export-${timestamp}.json`;
            
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            
            URL.revokeObjectURL(url);
            this.updateStatus('Export completed successfully!', 'success');
            
        } catch (error) {
            console.error('Export error:', error);
            this.updateStatus(`Export failed: ${error.message}`, 'error');
        }
    }
    
    updateUI(hasCapturedData) {
        this.exportBtn.disabled = !hasCapturedData;
        
        if (hasCapturedData && this.capturedData) {
            this.capturedInfo.style.display = 'block';
            document.getElementById('elementCount').textContent = this.capturedData.children?.length || 0;
            document.getElementById('imageCount').textContent = '0';
            document.getElementById('textStyleCount').textContent = '0';
            document.getElementById('colorCount').textContent = '0';
        } else {
            this.capturedInfo.style.display = 'none';
        }
    }
    
    updateStatus(message, type = 'info') {
        this.status.innerHTML = `<p>${message}</p>`;
        this.status.className = `status ${type}`;
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

// Initialize popup controller
new PopupController();