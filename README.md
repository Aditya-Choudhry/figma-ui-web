# Website to Figma Exporter

A Chrome browser extension that captures the visual structure of any live website and converts it into a Figma-compatible format. The extension analyzes DOM elements, extracts design properties (fonts, colors, positions, spacing), and generates structured JSON data that can be imported into Figma while preserving the editable design structure.

## Features

- **Complete Website Capture**: Analyzes DOM structure, computed styles, and visual elements
- **Figma-Compatible Export**: Converts captured data to Figma JSON format
- **Image Processing**: Extracts and processes images as base64 or downloadable URLs
- **Style Collection**: Automatically collects text styles, colors, and fonts
- **Professional UI**: Modern popup interface with progress indicators
- **Chrome Extension APIs**: Full integration with Chrome's extension system

## Project Structure

```
├── manifest.json          # Extension configuration (Manifest V3)
├── background.js          # Service worker for extension lifecycle
├── content.js            # Content script for DOM analysis
├── figma-exporter.js     # Figma conversion logic
├── popup.html            # Extension popup interface
├── popup.css             # Popup styling
├── popup.js              # Popup functionality
├── icons/                # Extension icons (16px, 48px, 128px)
│   ├── icon16.svg
│   ├── icon48.svg
│   └── icon128.svg
└── README.md             # This file
```

## Prerequisites

### For Local Development
- **Python 3.6+** (for local file server)
- **Google Chrome** (latest version recommended)
- **Code Editor** (VS Code, Sublime Text, etc.)

### For Replit Cloud Deployment
- **Replit Account** (free tier available)
- **Chrome browser** for testing

## Installation & Setup

### Local Development Setup

1. **Clone or Download the Project**
   ```bash
   # If using git
   git clone <repository-url>
   cd website-to-figma-exporter
   
   # Or download and extract the ZIP file
   ```

2. **Start Local Server** (for development testing)
   ```bash
   # Using Python 3
   python3 -m http.server 5000
   
   # Or using Python 2
   python -m SimpleHTTPServer 5000
   
   # Server will be available at http://localhost:5000
   ```

3. **Load Extension in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)
   - Click "Load unpacked"
   - Select the project folder containing `manifest.json`
   - The extension should appear in your extensions list

4. **Verify Installation**
   - Look for the extension icon in Chrome's toolbar
   - Click the icon to open the popup interface
   - The popup should display "Website to Figma" interface

### Replit Cloud Setup

1. **Import Project to Replit**
   - Go to [replit.com](https://replit.com)
   - Click "Create Repl" → "Import from GitHub" (or upload files)
   - Import this project

2. **Configure Replit**
   - Replit should automatically detect the project type
   - The built-in web server will serve files on port 5000
   - No additional dependencies needed

3. **Access Extension Files**
   - Use the Replit webview to access your extension files
   - The extension can be loaded from the Replit URL in Chrome

## Testing the Extension

### Frontend Testing (Popup Interface)

1. **Open Extension Popup**
   - Click the extension icon in Chrome toolbar
   - Verify the popup opens with proper styling
   - Check that both buttons are visible: "Capture Page" and "Export to Figma"

2. **UI Component Testing**
   ```
   ✓ Header displays "Website to Figma"
   ✓ Capture button shows camera icon
   ✓ Export button is initially disabled
   ✓ Status section shows "Ready to capture"
   ✓ Progress bar is hidden initially
   ✓ Footer shows version number
   ```

3. **Responsive Design Testing**
   - Popup should be 320px wide
   - All elements should be properly aligned
   - Buttons should have hover effects

### Backend Testing (Extension Logic)

1. **Service Worker Testing**
   ```bash
   # Open Chrome DevTools for the extension
   # Go to chrome://extensions/ → Click "service worker" link
   # Check console for any errors
   ```

2. **Content Script Testing**
   - Navigate to any website (e.g., `https://example.com`)
   - Open DevTools → Console tab
   - Click "Capture Page" in extension popup
   - Check for capture progress messages

3. **Storage Testing**
   ```bash
   # In Chrome DevTools Console (on any webpage):
   chrome.storage.local.get(['capturedData'], (result) => {
     console.log('Stored data:', result);
   });
   ```

### Capture Functionality Testing

1. **Basic Capture Test**
   - Navigate to a simple website (e.g., `https://example.com`)
   - Click "Capture Page" button
   - Wait for progress indicator to complete
   - Verify "Export to Figma" button becomes enabled

2. **Complex Website Testing**
   - Test on websites with:
     - Multiple images
     - Various fonts and colors
     - Complex layouts (flexbox, grid)
     - Different element types

3. **Export Testing**
   - After successful capture, click "Export to Figma"
   - Verify JSON file downloads automatically
   - Check file contains proper Figma structure

## Process Monitoring

### Browser Console Monitoring

1. **Extension Console**
   ```bash
   # Go to chrome://extensions/
   # Find your extension → Click "service worker"
   # Monitor background script logs
   ```

2. **Content Script Console**
   ```bash
   # On any webpage, open DevTools (F12)
   # Go to Console tab
   # Look for extension-related messages
   ```

3. **Popup Console**
   ```bash
   # Right-click extension popup → "Inspect"
   # Check Console tab for popup-related logs
   ```

### Performance Monitoring

1. **Capture Performance**
   - Monitor capture time for different website sizes
   - Check memory usage during large captures
   - Verify no memory leaks after multiple captures

2. **Storage Usage**
   ```bash
   # Check storage usage
   chrome.storage.local.getBytesInUse(null, (bytes) => {
     console.log('Storage used:', bytes, 'bytes');
   });
   ```

## Development Workflow

### Making Changes

1. **Edit Code**
   - Modify any `.js`, `.html`, or `.css` files
   - Save changes

2. **Reload Extension**
   - Go to `chrome://extensions/`
   - Click reload button on your extension
   - Test changes immediately

3. **Debug Issues**
   - Use Chrome DevTools for each component
   - Check browser console for errors
   - Verify manifest.json syntax

### Testing Checklist

- [ ] Extension loads without errors
- [ ] Popup interface displays correctly
- [ ] Capture button triggers DOM analysis
- [ ] Progress indicator shows during capture
- [ ] Captured data displays statistics
- [ ] Export button downloads JSON file
- [ ] JSON file has valid Figma structure
- [ ] Extension works on various websites

## Deployment to Chrome Web Store

### Prerequisites for Store Upload

1. **Chrome Web Store Developer Account** ($5 one-time fee)
2. **Extension Package**
   ```bash
   # Create ZIP file with all extension files
   zip -r website-to-figma-exporter.zip . -x "*.git*" "*.DS_Store*" "README.md"
   ```

3. **Required Assets**
   - 128x128px icon (provided in `/icons/`)
   - Screenshots of extension in use
   - Privacy policy (if collecting user data)

### Store Submission Process

1. **Developer Dashboard**
   - Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
   - Click "Add new item"

2. **Upload Package**
   - Upload your ZIP file
   - Fill in store listing details
   - Add screenshots and description

3. **Review Process**
   - Google reviews typically take 1-3 days
   - Address any feedback if rejected
   - Publish once approved

## Replit Cloud Deployment

### For Replit Hosting

1. **File Structure Check**
   ```
   ✓ All files are in root directory
   ✓ manifest.json is properly configured
   ✓ No build process required
   ```

2. **Environment Variables**
   - No API keys or secrets required
   - Extension runs entirely client-side

3. **Replit Configuration**
   ```bash
   # No additional dependencies needed
   # Static file serving is sufficient
   ```

4. **Access Extension**
   - Use Replit's provided URL
   - Load extension from hosted files
   - Perfect for sharing and testing

## Troubleshooting

### Common Issues

1. **Extension Not Loading**
   - Check manifest.json syntax
   - Verify all file paths are correct
   - Enable Developer mode in Chrome

2. **Capture Not Working**
   - Check website permissions
   - Verify content script injection
   - Look for JavaScript errors in console

3. **Export Failing**
   - Check download permissions
   - Verify JSON structure validity
   - Monitor browser console for errors

### Debug Commands

```bash
# Clear extension storage
chrome.storage.local.clear();

# Check extension permissions
chrome.runtime.getManifest();

# Test message passing
chrome.runtime.sendMessage({action: 'test'});
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:
- Check the troubleshooting section above
- Review Chrome extension documentation
- Test on multiple websites to isolate issues