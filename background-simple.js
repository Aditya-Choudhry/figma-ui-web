// Minimal background service worker
console.log('Background service worker loaded');

// Basic installation handler
chrome.runtime.onInstalled.addListener((details) => {
    console.log('Extension installed:', details.reason);
    
    if (details.reason === 'install') {
        // Set default settings
        chrome.storage.local.set({
            extensionSettings: {
                captureImages: true,
                maxImageSize: 1920,
                includeHiddenElements: false,
                exportFormat: 'figma-json'
            }
        });
    }
});

// Handle extension icon badge
chrome.action.setBadgeBackgroundColor({ color: '#667eea' });

console.log('Background service worker ready');