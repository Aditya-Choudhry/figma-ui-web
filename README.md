
# Website to Figma Exporter Plugin

A Figma plugin that captures any website's structure and converts it into native Figma elements with proper hierarchy and styling.

## ✨ Features

- **Live Website Capture**: Fetch any website's HTML structure
- **Native Figma Integration**: Creates real Figma frames, text, and rectangle nodes
- **Multi-Viewport Support**: Captures desktop (1440px), tablet (768px), and mobile (375px) layouts
- **Advanced CSS Extraction**: Complete style preservation with computed styles
- **Auto Layout Detection**: Automatically applies Figma Auto Layout for flex containers
- **Font Mapping**: Maps web fonts to Figma-compatible alternatives

## 🏗️ Architecture

The plugin consists of two main components:

### 1. Figma Plugin (`code.js` + `ui.html`)
- Clean interface for entering website URLs and selecting viewports
- Handles Figma API interactions and node creation
- Communicates with backend server for website content

### 2. Python Backend Server (`server_enhanced.py`)
- Flask web server with advanced website capture capabilities
- Selenium WebDriver for complete page rendering
- Comprehensive CSS parsing and element extraction
- Multi-viewport responsive capture

## 🚀 Quick Start

### 1. Start the Backend Server

The enhanced Python server runs on port 5000:

```bash
# Server starts automatically via Replit workflow
# Access at: http://localhost:5000
```

**Health Check**: Visit `http://localhost:5000/health` to verify server status

### 2. Install the Figma Plugin

1. **Open Figma Desktop App**
2. **Go to Plugins** → **Development** → **Import plugin from manifest**
3. **Select** the `manifest.json` file from this project
4. **Plugin will appear** in your plugins list

### 3. Use the Plugin

1. **Open any Figma file**
2. **Go to Plugins** → **Website to Figma Exporter**
3. **Enter a website URL** (e.g., https://example.com)
4. **Select viewport sizes** (desktop, tablet, mobile)
5. **Click "Capture Website"**
6. **Watch as Figma elements are created** in real-time

## 📋 API Endpoints

### Backend Server (http://localhost:5000)

- **GET** `/health` - Health check
- **POST** `/api/capture` - Capture website content
  ```json
  {
    "url": "https://example.com",
    "viewports": ["desktop", "tablet", "mobile"]
  }
  ```

## 🔧 Configuration

### Network Access
The plugin is configured to access:
- `http://localhost:5000` (local development)
- `https://website-capture-server.replit.app` (cloud deployment)

### Supported Websites
- Any publicly accessible HTTP/HTTPS website
- Static and dynamic content with JavaScript rendering
- No authentication required sites

## 📁 Project Structure

```
/
├── manifest.json          # Figma plugin configuration
├── code.js               # Main plugin logic (Figma environment)
├── ui.html               # Plugin user interface
├── server_enhanced.py    # Enhanced Python backend server
├── pyproject.toml        # Python dependencies
├── README.md            # This file
└── FEATURES.md          # Detailed feature documentation
```

## 🛠️ Development

### Backend Development
```bash
# Dependencies install automatically via pyproject.toml
# Server runs via Enhanced Figma Server workflow
```

### Plugin Development
1. Make changes to `code.js` or `ui.html`
2. In Figma: **Plugins** → **Development** → **Reload plugin**
3. Test changes immediately

## 🧪 Testing

### Test Backend Server
```bash
# Health check
curl http://localhost:5000/health

# Test website capture
curl -X POST -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","viewports":["desktop"]}' \
  http://localhost:5000/api/capture
```

### Test Plugin
1. Use `https://example.com` for reliable testing
2. Check Figma console for debugging information
3. Verify elements are created in current page

## 🚨 Troubleshooting

### Common Issues

**Server Not Running**
- Check workflow status in Replit
- Verify port 5000 is available
- Restart the "Enhanced Figma Server" workflow

**Plugin Network Error**
- Ensure server is running on port 5000
- Check `manifest.json` has correct allowed domains
- Verify CORS is enabled on server

**No Elements Created**
- Check website is publicly accessible
- Try with `https://example.com` first
- Look for errors in Figma console

**Chrome Driver Issues**
- Server automatically installs Chrome driver
- Check console for WebDriver errors
- Ensure sufficient system resources

## 📦 Deployment

### Server Deployment
The Python server is configured for Replit deployment:
- Automatic dependency installation
- Port 5000 forwarding configured
- Production-ready Flask server

### Plugin Distribution
For sharing the plugin:
1. Package `manifest.json`, `code.js`, and `ui.html` in a ZIP
2. Share the ZIP file
3. Recipients import via Figma's plugin developer tools

## 🔐 Security Notes

- Plugin only accesses allowed domains specified in manifest
- Server fetches public websites only
- No authentication or user data storage
- CORS properly configured for security

## 📈 Performance

- **Server Response**: ~3-5 seconds per viewport
- **Element Limit**: Max 100 elements per viewport (configurable)
- **Memory Usage**: Optimized for Figma performance
- **Multi-Viewport**: Parallel processing for faster capture

## 🎯 Use Cases

- **Design Research**: Analyze competitor layouts across devices
- **Rapid Prototyping**: Import existing designs as starting points
- **Responsive Design**: Study how designs adapt to different screen sizes
- **Design System Creation**: Extract components from live sites

## 🤝 Contributing

1. Fork the repository
2. Make your changes
3. Test thoroughly with various websites
4. Submit a pull request

## 📄 License

MIT License - feel free to use and modify
