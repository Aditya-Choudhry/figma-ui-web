// Ultra-simple test to verify basic functionality
document.addEventListener('DOMContentLoaded', () => {
    const captureBtn = document.getElementById('captureBtn');
    const status = document.getElementById('status');
    
    captureBtn.addEventListener('click', async () => {
        try {
            console.log('Button clicked!');
            status.textContent = 'Testing...';
            
            // Get current tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            console.log('Tab found:', tab);
            
            if (!tab) {
                throw new Error('No tab found');
            }
            
            console.log('Attempting script injection...');
            
            // Try the simplest possible script injection
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    // Return something very simple
                    return {
                        success: true,
                        url: window.location.href,
                        title: document.title,
                        hasBody: !!document.body,
                        elementCount: document.querySelectorAll('*').length
                    };
                }
            });
            
            console.log('Results:', results);
            
            if (results && results[0] && results[0].result) {
                status.textContent = `Success! Found ${results[0].result.elementCount} elements`;
                console.log('SUCCESS:', results[0].result);
            } else {
                status.textContent = 'Failed: No results returned';
                console.log('FAILED: No results');
            }
            
        } catch (error) {
            console.error('Error:', error);
            status.textContent = `Error: ${error.message}`;
        }
    });
});