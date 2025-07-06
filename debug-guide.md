# Debug Guide for Chrome Extension

## Debugging the "Connection Error"

The error "Could not establish connection. Receiving end does not exist" typically means the content script isn't responding. Here's how to debug:

### Step 1: Check Extension Loading

1. **Go to** `chrome://extensions/`
2. **Find your extension** "Website to Figma Exporter"
3. **Check for errors** in the extension card
4. **Click "Reload"** if you made any changes

### Step 2: Check Service Worker

1. **In** `chrome://extensions/`
2. **Click "service worker"** link under your extension
3. **Look for console logs** starting with `🔧 BACKGROUND:`
4. **You should see:**
   ```
   🔧 BACKGROUND: Service worker starting...
   🔧 BACKGROUND: ExtensionBackground instance created
   ✅ BACKGROUND: All handlers setup complete
   ```

### Step 3: Check Content Script Loading

1. **Navigate to any website** (e.g., `https://example.com`)
2. **Open Developer Tools** (F12)
3. **Go to Console tab**
4. **Look for content script logs:**
   ```
   🚀 CONTENT: Content script loaded on: https://example.com/
   🔧 CONTENT: WebsiteCapture instance created
   🎧 CONTENT: Setting up message listener...
   ✅ CONTENT: Message listener ready
   ✅ CONTENT: WebsiteCapture initialized successfully
   ```

### Step 4: Check Popup Console

1. **Right-click the extension icon** → "Inspect"
2. **Go to Console tab in the popup inspector**
3. **Click "Capture Page"**
4. **Look for popup logs:**
   ```
   🔄 POPUP: Starting capture process...
   🔍 POPUP: Getting active tab...
   ✅ POPUP: Active tab found: {id: 123, url: "...", title: "..."}
   📨 POPUP: Sending message to content script...
   📥 POPUP: Received response from content script: {...}
   ```

## Common Issues and Solutions

### Issue 1: Content Script Not Loading

**Symptoms:** No content script logs in browser console

**Solutions:**
1. **Check manifest.json** - ensure content_scripts section is correct
2. **Reload extension** in chrome://extensions/
3. **Refresh the webpage** after reloading extension
4. **Check URL restrictions** - some sites block content scripts

### Issue 2: Content Script Loads But No Message Response

**Symptoms:** Content script logs appear but no response to messages

**Solutions:**
1. **Check for JavaScript errors** in content script
2. **Verify message listener setup** 
3. **Try refreshing the webpage**

### Issue 3: Permission Denied

**Symptoms:** Extension can't access certain pages

**Solutions:**
1. **Check URL** - cannot capture chrome://, chrome-extension://, or edge:// pages
2. **Navigate to regular website** like https://example.com
3. **Ensure activeTab permission** is in manifest

## Step-by-Step Debug Process

### When you get the connection error:

1. **Open 3 console windows:**
   - Popup console (right-click extension icon → Inspect)
   - Content script console (F12 on webpage)
   - Background console (chrome://extensions/ → service worker)

2. **Click "Capture Page" and watch all 3 consoles**

3. **Expected flow:**
   ```
   POPUP: 🔄 Starting capture process...
   POPUP: 📨 Sending message to content script...
   CONTENT: 📨 Message received: {action: "captureWebsite"}
   CONTENT: 🔄 Starting website capture...
   CONTENT: ✅ Capture completed, sending response
   POPUP: 📥 Received response from content script
   ```

4. **Find where the flow breaks** and focus debugging there

## Manual Test Commands

### Test content script manually:
```javascript
// Run this in webpage console
if (typeof websiteCapture !== 'undefined') {
    console.log('✅ Content script loaded');
    websiteCapture.captureWebsite().then(console.log);
} else {
    console.log('❌ Content script not loaded');
}
```

### Test message passing manually:
```javascript
// Run this in popup console
chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {action: 'captureWebsite'}, (response) => {
        console.log('Manual test response:', response);
    });
});
```

## Network Tab Analysis

The Python server you're running serves static files only. It's NOT involved in the extension's runtime communication. The server logs show:

```
GET /manifest.json
GET /popup.html
GET /popup.css
GET /popup.js
```

These are just Chrome loading the extension files. The actual capture happens entirely within Chrome using JavaScript - no cloud or server communication.

## Final Checklist

- [ ] Extension shows in chrome://extensions/ without errors
- [ ] Service worker console shows background script logs
- [ ] Content script console shows initialization logs
- [ ] Popup console shows capture attempt logs
- [ ] Testing on a regular website (not chrome:// pages)
- [ ] Extension reloaded after any code changes
- [ ] Webpage refreshed after extension reload