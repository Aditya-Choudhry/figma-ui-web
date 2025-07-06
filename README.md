# Enhanced Website to Figma Exporter

A comprehensive Figma plugin that captures websites and converts them into exact replicas in Figma. The system includes a Python Flask backend server for website capture using Selenium and Chrome WebDriver, plus an advanced Figma plugin for converting captured data into precise Figma designs with multi-viewport support.

## Features

### Advanced Website Capture
- **Multi-Viewport Responsive Capture**: Desktop (1440x900), Tablet (768x1024), Mobile (375x667)
- **Comprehensive CSS Extraction**: Captures ALL computed styles, layout properties, and visual effects
- **Flexbox/Grid to Auto Layout Mapping**: Converts modern web layouts to Figma Auto Layout
- **Font Consistency**: Maps typography across all viewports with precise font matching
- **Visual Hierarchy Preservation**: Maintains DOM relationships and Z-index ordering

### Precise Figma Replication
- **Smart Node Type Detection**: Text, Image, Component, and Frame nodes with intelligent classification
- **Exact Auto Layout Application**: Perfect Flexbox container replication with proper spacing
- **Comprehensive Typography**: Font-weight, line-height, letter-spacing, and text alignment
- **Pixel-Perfect Colors**: Hex, RGB, RGBA, and named color parsing with exact reproduction
- **Border Radius & Shadows**: Complete visual effect replication including box-shadows
- **Interactive Element Detection**: Buttons, inputs, and components with proper styling

### Enhanced Data Structure
- **Layout Detection**: Identifies flex containers, grid layouts, and text nodes
- **Visual Hierarchy Assessment**: Z-index handling and depth analysis
- **Background Image Extraction**: Captures and processes background images and IMG elements
- **Component Recognition**: Interactive element identification for component creation

## Installation & Setup

### Prerequisites

- **Figma Desktop App** (latest version)
- **Python 3.8+** with pip
- **Chrome/Chromium browser** (for headless rendering)
- **System Dependencies** (automatically installed in Replit)

### 1. Backend Server Setup

#### Install Python Dependencies:
```bash
# Core dependencies
pip install flask flask-cors selenium webdriver-manager beautifulsoup4 requests

# Optional: Enhanced parsing
pip install tinycss2 Pillow
```

#### System Dependencies (for local development):
```bash
# Ubuntu/Debian
sudo apt install chromium-browser glib2.0 nss nspr libxcb1 libx11-6 libxcomposite1 libxdamage1 libxrandr2

# macOS
brew install chromium

# Windows
# Download Chrome from official website
```

### 2. Start the Enhanced Server

#### In Replit Environment:
The server runs automatically via the "Enhanced Figma Server" workflow on port 5000.

#### For Local Development:
```bash
python server_enhanced.py
```

The enhanced server runs on `http://localhost:5000` with the following endpoints:
- `GET /health` - Server status and feature list
- `POST /api/capture-responsive` - Multi-viewport capture
- `POST /api/capture` - Single viewport capture (legacy)

### 3. Figma Plugin Installation

1. **Open Figma Desktop App**
2. **Navigate to** Plugins → Development → Import plugin from manifest
3. **Select** the `manifest.json` file from this project
4. **The plugin** will appear in your plugins list as "Website to Figma Exporter"

## Usage Guide

### Multi-Viewport Capture Workflow

1. **Start the Backend Server**:
   - In Replit: Ensure "Enhanced Figma Server" workflow is running
   - Locally: Run `python server_enhanced.py`

2. **Open Figma** and run the "Website to Figma Exporter" plugin

3. **Configure Capture Settings**:
   - Enter the website URL (must include http:// or https://)
   - Select viewports: Desktop, Tablet, and/or Mobile
   - Click "Capture Website"

4. **Processing Steps**:
   - Server launches headless Chrome browser
   - Captures website at each selected viewport
   - Extracts comprehensive CSS and layout data
   - Plugin creates precise Figma layouts with Auto Layout
   - Elements positioned with exact styling and typography

### Advanced Capture Features

#### Responsive Layout Generation
- **Desktop Layout**: 1440x900 viewport with full desktop styling
- **Tablet Layout**: 768x1024 viewport with responsive adjustments  
- **Mobile Layout**: 375x667 viewport with mobile-optimized styling

#### Auto Layout Mapping
- **Flexbox Containers** → Figma Auto Layout frames
- **CSS Grid** → Organized frame structures
- **Spacing** → Proper padding and item spacing
- **Alignment** → Precise justify-content and align-items mapping

#### Typography Replication
- **Font Mapping**: Web fonts to Figma font families
- **Weight Matching**: CSS font-weights to Figma font styles
- **Line Height**: Exact line-height preservation
- **Letter Spacing**: Precise character spacing
- **Text Alignment**: Perfect text alignment replication

## System Architecture

### Enhanced Backend (Python)
```
├── server_enhanced.py          # Main Flask server with Selenium
├── WebsiteCapture class        # Chrome WebDriver management
├── Multi-viewport capture      # Responsive design processing
├── CSS extraction engine       # Comprehensive style analysis
├── Font mapping system         # Web-to-Figma font conversion
└── Layout detection logic      # Flexbox/Grid analysis
```

### Advanced Figma Plugin (JavaScript)
```
├── code.js                     # Main plugin logic with enhanced node creation
├── createResponsiveFigmaLayouts # Multi-viewport layout generation
├── createAdvancedNodeFromElement # Sophisticated node creation
├── determineAdvancedNodeType   # Intelligent node type detection
├── Font mapping utilities      # Typography conversion functions
└── Color parsing system        # Advanced color handling
```

### Data Flow Architecture
```
Website URL → Chrome WebDriver → DOM Analysis → CSS Extraction → 
Layout Detection → Figma Plugin → Node Creation → Auto Layout Application → 
Precise Figma Replica
```

## Supported Elements & Conversions

### Element Type Mapping
| Web Element | Figma Node | Features |
|-------------|------------|----------|
| **Text Content** | Text Node | Font mapping, sizing, alignment, color |
| **IMG Elements** | Frame + Image | Background images, alt text, dimensions |
| **Flexbox Containers** | Auto Layout Frame | Direction, spacing, alignment, padding |
| **CSS Grid** | Organized Frames | Grid structure preservation |
| **Buttons/Inputs** | Component Frame | Interactive styling, hover states |
| **Divs/Containers** | Frames | Background, borders, shadows, radius |

### CSS Property Support
- **Layout**: Flexbox, Grid, positioning, dimensions, spacing
- **Typography**: Font family, size, weight, line-height, letter-spacing
- **Visual**: Colors, backgrounds, borders, border-radius, box-shadow
- **Effects**: Opacity, transforms, filters

### Font Mapping System
```javascript
Web Font → Figma Font
Arial/Helvetica → Arial
Georgia → Georgia  
Times → Times New Roman
Roboto → Roboto
Inter → Inter
Custom fonts → Closest available match
```

## Troubleshooting

### Common Issues & Solutions

#### Server Issues
1. **ChromeDriver Compatibility Error**:
   ```bash
   # Update ChromeDriver
   pip install --upgrade webdriver-manager
   ```

2. **Port 5000 Already in Use**:
   ```bash
   # Kill existing process
   lsof -ti:5000 | xargs kill -9
   ```

3. **Missing System Dependencies**:
   ```bash
   # Install required libraries (Ubuntu/Debian)
   sudo apt install libglib2.0-0 libnss3 libatk-bridge2.0-0 libxcb1
   ```

#### Plugin Issues
1. **JavaScript Syntax Errors**:
   - Check browser console in Figma
   - All modern JavaScript syntax has been made compatible

2. **Font Loading Failures**:
   - Fonts fallback to Inter automatically
   - Check Figma's available fonts list

3. **Layout Positioning Issues**:
   - Complex CSS may need manual adjustment
   - Check Auto Layout settings in Figma

### Debug Mode

Enable enhanced logging:
```python
# In server_enhanced.py
import logging
logging.basicConfig(level=logging.DEBUG)
```

```javascript
// In code.js
console.log('Debug info:', data);
figma.notify('Debug: ' + message);
```

## API Testing

Test the server endpoints:

```bash
# Health check
curl http://localhost:5000/health

# Multi-viewport capture
curl -X POST -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","viewports":["desktop","tablet","mobile"]}' \
  http://localhost:5000/api/capture-responsive

# Single viewport capture  
curl -X POST -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","viewports":["desktop"]}' \
  http://localhost:5000/api/capture
```

## Project Structure

```
/
├── manifest.json          # Figma plugin configuration
├── code.js               # Enhanced plugin logic with precise node creation
├── ui.html               # Modern plugin user interface
├── popup.html            # Alternative interface
├── popup.js              # Popup interface logic  
├── popup.css             # Interface styling
├── server_enhanced.py    # Advanced Python backend server
├── main.py              # Entry point for deployment
├── pyproject.toml       # Python dependencies
├── replit.md            # Project documentation and preferences
├── FEATURES.md          # Detailed feature documentation
└── README.md            # This file
```

## Performance & Limitations

### Performance Characteristics
- **Capture Time**: 5-15 seconds per viewport
- **Element Limit**: 50 elements per viewport (configurable)
- **Memory Usage**: ~200MB per active capture
- **Concurrent Captures**: 1 (WebDriver limitation)

### Current Limitations
- Large websites may require element limiting
- Complex CSS animations not captured
- Some modern CSS features may need manual adjustment
- Single concurrent capture due to WebDriver constraints

## Deployment

### Replit Deployment
1. The project is ready for Replit deployment
2. Start the "Enhanced Figma Server" workflow
3. Server auto-configures for Replit environment
4. Use external URLs for Figma plugin connections

### Local Production Setup
1. Use production WSGI server:
   ```bash
   pip install gunicorn
   gunicorn --bind 0.0.0.0:5000 server_enhanced:app
   ```

2. Configure reverse proxy (nginx) for HTTPS
3. Set up process monitoring (systemd, supervisor)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - See LICENSE file for details

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review server logs for error details
3. Test with simple websites first
4. Report bugs with website URLs and error messages

---

**Status**: Production Ready  
**Latest Version**: Enhanced Multi-Viewport Capture  
**Compatibility**: Figma Desktop App, Chrome/Chromium browsers