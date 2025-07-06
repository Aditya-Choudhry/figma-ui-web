# Website to Figma Exporter

## Overview

This is a Chrome browser extension that captures the visual structure of any live website and converts it into a Figma-compatible format. The extension analyzes DOM elements, extracts design properties (fonts, colors, positions, spacing), and generates structured JSON data that can be imported into Figma while preserving the editable design structure.

## System Architecture

### Chrome Extension Architecture
The extension follows the Manifest V3 architecture with three main components:
- **Background Service Worker** (`background.js`): Handles extension lifecycle, settings management, and message routing
- **Content Script** (`content.js`): Injected into web pages to perform DOM analysis and capture
- **Popup Interface** (`popup.html/js/css`): User interface for triggering captures and exports

### Data Processing Pipeline
1. **DOM Traversal**: Content script analyzes page structure and elements
2. **Style Extraction**: Captures computed CSS properties, fonts, colors, and layout data
3. **Image Processing**: Extracts and processes images (base64 or downloadable URLs)
4. **Figma Conversion**: Transforms captured data into Figma-compatible JSON structure
5. **Export Generation**: Creates downloadable JSON file for Figma import

## Key Components

### Content Script (`content.js`)
- **WebsiteCapture Class**: Main capture orchestrator
- Provides visual feedback during capture process
- Handles asynchronous DOM analysis
- Manages capture state and error handling

### Background Service Worker (`background.js`)
- **ExtensionBackground Class**: Core extension management
- Handles installation and setup of default settings
- Routes messages between popup and content script
- Manages context menus and extension lifecycle

### Figma Exporter (`figma-exporter.js`)
- **FigmaExporter Class**: Converts captured data to Figma format
- Creates hierarchical document structure (DOCUMENT → PAGE → FRAME)
- Handles node ID generation and element conversion
- Processes text styles, color styles, and images

### Popup Interface (`popup.html/js/css`)
- **PopupController Class**: Manages user interactions
- Displays capture progress and status updates
- Handles data persistence and export functionality
- Modern gradient UI with responsive design

## Data Flow

1. **User Interaction**: User clicks "Capture Page" in popup
2. **Message Passing**: Popup sends capture request to background script
3. **Content Injection**: Background script forwards request to content script
4. **DOM Analysis**: Content script performs comprehensive page analysis
5. **Data Processing**: Figma exporter converts captured data to Figma format
6. **Storage**: Captured data stored in Chrome local storage
7. **Export**: User can download Figma-compatible JSON file

## External Dependencies

### Chrome APIs
- `chrome.runtime`: Message passing and extension lifecycle
- `chrome.storage.local`: Data persistence
- `chrome.tabs`: Active tab management
- `chrome.downloads`: File export functionality

### Web APIs
- DOM manipulation and traversal
- Computed styles extraction
- Canvas API (implied for image processing)
- File and Blob APIs for export generation

### Browser Permissions
- `activeTab`: Access to current webpage
- `storage`: Local data persistence
- `downloads`: File export capability

## Deployment Strategy

### Chrome Web Store Distribution
- Manifest V3 compliant for current Chrome standards
- Extension packaged with all assets and icons
- Permissions minimized for security approval

### File Structure
```
/
├── manifest.json          # Extension configuration
├── background.js          # Service worker
├── content.js            # Content script
├── figma-exporter.js     # Figma conversion logic
├── popup.html/js/css     # User interface
└── icons/                # Extension icons
```

### Settings Management
- Default capture settings stored in local storage
- Configurable image size limits and capture options
- Export format preferences

## Changelog
- July 06, 2025. Initial setup
- July 06, 2025. Added comprehensive README.md with setup instructions, testing procedures, and deployment guides

## User Preferences

Preferred communication style: Simple, everyday language.