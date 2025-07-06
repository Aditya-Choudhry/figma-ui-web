class DebugPopupController {
    constructor() {
        this.captureBtn = document.getElementById('captureBtn');
        this.status = document.getElementById('status');
        this.init();
    }
    
    init() {
        this.captureBtn.addEventListener('click', () => this.debugCapture());
    }
    
    async debugCapture() {
        try {
            console.log('Starting debug capture...');
            this.updateStatus('Running basic tests...', 'loading');
            
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            console.log('Tab:', tab);
            
            if (!tab) {
                throw new Error('No active tab found');
            }
            
            // Test 1: Minimal script injection
            console.log('Test 1: Minimal script injection');
            const test1 = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    return 'test-success';
                }
            });
            console.log('Test 1 result:', test1);
            
            // Test 2: Basic DOM access
            console.log('Test 2: Basic DOM access');
            const test2 = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    return {
                        hasBody: !!document.body,
                        bodyTag: document.body ? document.body.tagName : null,
                        childCount: document.body ? document.body.children.length : 0,
                        title: document.title,
                        url: window.location.href
                    };
                }
            });
            console.log('Test 2 result:', test2);
            
            // Test 3: Simple element query
            console.log('Test 3: Simple element query');
            const test3 = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    const allElements = document.querySelectorAll('*');
                    return {
                        totalElements: allElements.length,
                        firstFew: Array.from(allElements).slice(0, 5).map(el => ({
                            tag: el.tagName,
                            id: el.id,
                            className: el.className
                        }))
                    };
                }
            });
            console.log('Test 3 result:', test3);
            
            // Test 4: Style computation
            console.log('Test 4: Style computation test');
            const test4 = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    const body = document.body;
                    if (!body) return { error: 'No body element' };
                    
                    const style = window.getComputedStyle(body);
                    return {
                        display: style.display,
                        backgroundColor: style.backgroundColor,
                        width: style.width,
                        height: style.height
                    };
                }
            });
            console.log('Test 4 result:', test4);
            
            this.updateStatus('Debug tests completed - check console', 'success');
            
        } catch (error) {
            console.error('Debug error:', error);
            this.updateStatus(`Debug error: ${error.message}`, 'error');
        }
    }
    
    updateStatus(message, type = 'info') {
        this.status.textContent = message;
        this.status.className = `status ${type}`;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new DebugPopupController();
});