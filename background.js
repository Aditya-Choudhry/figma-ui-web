// Background service worker for the extension
class ExtensionBackground {
    constructor() {
        this.setupInstallHandler();
        this.setupMessageHandlers();
        this.setupContextMenus();
    }
    
    setupInstallHandler() {
        chrome.runtime.onInstalled.addListener((details) => {
            console.log('Extension installed:', details);
            
            if (details.reason === 'install') {
                // Set default settings
                chrome.storage.local.set({
                    extensionSettings: {
                        captureImages: true,
                        maxImageSize: 1920, // Max width/height for images
                        includeHiddenElements: false,
                        exportFormat: 'figma-json'
                    }
                });
                
                // Open welcome page or popup
                chrome.tabs.create({
                    url: chrome.runtime.getURL('popup.html')
                });
            }
        });
    }
    
    setupMessageHandlers() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            switch (request.action) {
                case 'captureWebsite':
                    this.handleCaptureWebsite(sender.tab.id)
                        .then(sendResponse)
                        .catch(error => sendResponse({ success: false, error: error.message }));
                    return true; // Indicates async response
                    
                case 'exportData':
                    this.handleExportData(request.data)
                        .then(sendResponse)
                        .catch(error => sendResponse({ success: false, error: error.message }));
                    return true;
                    
                case 'getSettings':
                    this.getExtensionSettings()
                        .then(sendResponse)
                        .catch(error => sendResponse({ success: false, error: error.message }));
                    return true;
                    
                case 'updateSettings':
                    this.updateExtensionSettings(request.settings)
                        .then(sendResponse)
                        .catch(error => sendResponse({ success: false, error: error.message }));
                    return true;
                    
                default:
                    console.warn('Unknown action:', request.action);
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        });
    }
    
    setupContextMenus() {
        chrome.contextMenus.create({
            id: 'captureWebsite',
            title: 'Capture Website for Figma',
            contexts: ['page']
        });
        
        chrome.contextMenus.onClicked.addListener((info, tab) => {
            if (info.menuItemId === 'captureWebsite') {
                this.handleCaptureWebsite(tab.id);
            }
        });
    }
    
    async handleCaptureWebsite(tabId) {
        try {
            console.log('Starting website capture for tab:', tabId);
            
            // Check if tab is accessible
            const tab = await chrome.tabs.get(tabId);
            if (!tab || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
                throw new Error('Cannot capture this type of page');
            }
            
            // Send message to content script
            const response = await chrome.tabs.sendMessage(tabId, {
                action: 'captureWebsite'
            });
            
            if (!response.success) {
                throw new Error(response.error || 'Capture failed');
            }
            
            // Store captured data
            await chrome.storage.local.set({
                lastCaptureData: response.data,
                lastCaptureUrl: tab.url,
                lastCaptureTime: Date.now()
            });
            
            console.log('Capture completed successfully');
            return { success: true, data: response.data };
            
        } catch (error) {
            console.error('Capture failed:', error);
            throw error;
        }
    }
    
    async handleExportData(data) {
        try {
            // Process data for export
            const exportData = this.prepareExportData(data);
            
            // Create filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `figma-export-${timestamp}.json`;
            
            // Create blob and download
            const jsonString = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            // Trigger download
            const downloadId = await chrome.downloads.download({
                url: url,
                filename: filename,
                saveAs: true
            });
            
            // Clean up URL after download
            chrome.downloads.onChanged.addListener(function cleanup(delta) {
                if (delta.id === downloadId && delta.state?.current === 'complete') {
                    URL.revokeObjectURL(url);
                    chrome.downloads.onChanged.removeListener(cleanup);
                }
            });
            
            return { success: true, downloadId: downloadId };
            
        } catch (error) {
            console.error('Export failed:', error);
            throw error;
        }
    }
    
    prepareExportData(rawData) {
        // Add metadata and format for Figma compatibility
        const exportData = {
            version: '1.0.0',
            generator: 'Website to Figma Exporter',
            exportedAt: new Date().toISOString(),
            ...rawData
        };
        
        // Add Figma-specific formatting
        exportData.figmaCompatible = true;
        exportData.exportFormat = 'figma-json';
        
        return exportData;
    }
    
    async getExtensionSettings() {
        const result = await chrome.storage.local.get(['extensionSettings']);
        return result.extensionSettings || {};
    }
    
    async updateExtensionSettings(newSettings) {
        const currentSettings = await this.getExtensionSettings();
        const updatedSettings = { ...currentSettings, ...newSettings };
        
        await chrome.storage.local.set({
            extensionSettings: updatedSettings
        });
        
        return { success: true, settings: updatedSettings };
    }
}

// Initialize background script
new ExtensionBackground();

// Handle extension lifecycle
chrome.runtime.onSuspend.addListener(() => {
    console.log('Extension suspending...');
});

chrome.runtime.onStartup.addListener(() => {
    console.log('Extension starting up...');
});

// Error handling
chrome.runtime.onSuspendCanceled.addListener(() => {
    console.log('Extension suspend canceled');
});

// Badge updates
chrome.action.setBadgeBackgroundColor({ color: '#667eea' });

// Update badge when capture is completed
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.lastCaptureData) {
        chrome.action.setBadgeText({ text: '✓' });
        
        // Clear badge after 3 seconds
        setTimeout(() => {
            chrome.action.setBadgeText({ text: '' });
        }, 3000);
    }
});
