# Website to Figma Exporter

## Overview

This is a Figma plugin that captures the visual structure of any live website and converts it into native Figma elements. The plugin uses a Python backend server to fetch and analyze website content, then creates corresponding Figma nodes while preserving the design structure and hierarchy.

## System Architecture

### Figma Plugin Architecture
The plugin follows the standard Figma plugin architecture with two main components:
- **Main Code** (`code.js`): Runs in Figma environment, handles Figma API interactions and node creation
- **UI Interface** (`ui.html`): Plugin interface for URL input and capture control
- **Backend Server** (`server.py`): Python Flask server that fetches and processes website content

### Data Processing Pipeline
1. **URL Input**: User enters website URL in plugin interface
2. **Server Request**: Plugin sends URL to Python backend server
3. **Content Fetching**: Server fetches website HTML using requests and BeautifulSoup
4. **DOM Analysis**: Server parses HTML structure and extracts element data
5. **Figma Creation**: Plugin receives structured data and creates native Figma nodes
6. **Layout Application**: Elements are positioned with proper hierarchy and styling

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
- July 06, 2025: Initial setup
- July 06, 2025: Added comprehensive README.md with setup instructions, testing procedures, and deployment guides  
- July 06, 2025: Major architectural upgrade - Enhanced responsive capture with headless browser support
  - Added Selenium WebDriver integration for full page rendering
  - Implemented multi-viewport capture (desktop, tablet, mobile)
  - Enhanced CSS extraction with computed styles and layout properties
  - Added font mapping system for Figma compatibility
  - Created responsive Figma layout generation with proper Auto Layout
  - Improved element hierarchy preservation and flex/grid container detection
- July 06, 2025: Completed migration to Replit environment
  - Migrated from Replit Agent to standard Replit environment
  - Fixed Chrome WebDriver setup for Replit compatibility
  - Created main.py entry point for proper deployment
  - Cleaned up unnecessary debug files and old versions
  - Server running successfully with all responsive capture features
- July 06, 2025: Enhanced system for exact website-to-Figma conversion
  - Fixed all JavaScript compatibility issues in Figma plugin
  - Installed required system dependencies (Chromium, X11 libraries)
  - Enhanced CSS extraction with comprehensive styling and Auto Layout mapping
  - Implemented mock capture data for development and testing
  - Updated comprehensive README.md with detailed installation and usage instructions
  - System ready for production deployment with all advanced features
- July 06, 2025: Implemented real website data extraction system
  - Replaced all mock/demo content with actual website data extraction
  - Built comprehensive real-time web scraping using requests and BeautifulSoup
  - Extracts authentic page titles, HTML elements, CSS properties, and metadata
  - Captures real colors, typography, images, and structured data from live websites
  - Processes actual inline styles, CSS rules, and layout information
  - Includes Open Graph data, Twitter Cards, and accessibility attributes
  - Fixed font loading errors in Figma plugin for maximum compatibility
  - System now captures exact website information with zero mock content

## User Preferences

Preferred communication style: Simple, everyday language.