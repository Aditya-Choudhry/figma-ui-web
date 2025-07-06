// Ultra-simple test to verify basic functionality
console.log('Popup script loaded!');

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, setting up event listeners');
    
    const captureBtn = document.getElementById('captureBtn');
    const status = document.getElementById('status');
    
    if (!captureBtn) {
        console.error('Capture button not found!');
        return;
    }
    
    if (!status) {
        console.error('Status element not found!');
        return;
    }
    
    console.log('Elements found, adding click listener');
    
    captureBtn.addEventListener('click', async () => {
        console.log('=== BUTTON CLICKED ===');
        status.textContent = 'Testing...';
        
        try {
            // Test if chrome.tabs exists
            if (!chrome || !chrome.tabs) {
                throw new Error('Chrome tabs API not available');
            }
            console.log('Chrome tabs API available');
            
            // Test if chrome.scripting exists
            if (!chrome.scripting) {
                throw new Error('Chrome scripting API not available');
            }
            console.log('Chrome scripting API available');
            
            // Get current tab
            console.log('Getting current tab...');
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            console.log('Tabs query result:', tabs);
            
            if (!tabs || tabs.length === 0) {
                throw new Error('No active tab found');
            }
            
            const tab = tabs[0];
            console.log('Active tab:', tab);
            
            if (!tab.id) {
                throw new Error('Tab has no ID');
            }
            
            // Check tab URL
            console.log('Tab URL:', tab.url);
            if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
                throw new Error('Cannot inject into browser pages');
            }
            
            console.log('Attempting script injection to tab ID:', tab.id);
            
            // Try the simplest possible script injection
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    console.log('Script executing in page context!');
                    return {
                        success: true,
                        url: window.location.href,
                        title: document.title,
                        hasBody: !!document.body,
                        elementCount: document.querySelectorAll('*').length
                    };
                }
            });
            
            console.log('Script injection completed. Results:', results);
            
            if (!results) {
                throw new Error('No results returned from script injection');
            }
            
            if (!results[0]) {
                throw new Error('Results array is empty');
            }
            
            if (results[0].error) {
                throw new Error(`Script execution error: ${results[0].error}`);
            }
            
            if (!results[0].result) {
                throw new Error('No result data returned');
            }
            
            const result = results[0].result;
            console.log('SUCCESS! Result data:', result);
            status.textContent = `Success! Found ${result.elementCount} elements on ${result.title}`;
            
        } catch (error) {
            console.error('=== ERROR ===', error);
            status.textContent = `Error: ${error.message}`;
        }
    });
    
    console.log('Event listener added successfully');
});