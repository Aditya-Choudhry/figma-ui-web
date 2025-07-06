// Simple test content script to verify injection works
console.log('🧪 TEST: Simple content script loaded successfully on:', window.location.href);

// Test message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('🧪 TEST: Message received:', request);
    
    if (request.action === 'test') {
        console.log('🧪 TEST: Responding to test message');
        sendResponse({ success: true, message: 'Content script is working!' });
        return true;
    }
});

console.log('🧪 TEST: Content script setup complete');