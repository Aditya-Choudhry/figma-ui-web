# Website to Figma Exporter Plugin

A Figma plugin that captures any website's structure and converts it into native Figma elements with proper hierarchy and styling.

## ✨ Features

- **Live Website Capture**: Fetch any website's HTML structure
- **Native Figma Integration**: Creates real Figma frames, text, and rectangle nodes
- **Proper Hierarchy**: Maintains DOM element relationships
- **Style Preservation**: Captures colors, fonts, and basic styling
- **Real-time Processing**: Instant conversion from web to Figma

## 🏗️ Architecture

The plugin consists of two main components:

### 1. Figma Plugin (`code.js` + `ui.html`)
- **UI Interface**: Clean, modern interface for entering website URLs
- **Main Code**: Handles Figma API interactions and node creation
- **Network Access**: Communicates with backend server for website content

### 2. Python Backend Server (`server.py`)
- **Flask Web Server**: RESTful API for website content extraction
- **BeautifulSoup Parser**: HTML parsing and DOM analysis
- **CORS Enabled**: Allows Figma plugin to make cross-origin requests

## 🚀 Quick Start

### 1. Start the Backend Server

The Python server runs on port 5000 and handles website content fetching:

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
4. **Click "Capture Website"**
5. **Watch as Figma elements are created** in real-time

## 📋 API Endpoints

### Backend Server (http://localhost:5000)

- **GET** `/health` - Health check
- **POST** `/api/capture` - Capture website content
  ```json
  {
    "url": "https://example.com"
  }
  ```

## 🔧 Configuration

### Network Access
The plugin is configured to access:
- `http://localhost:5000` (local development)
- `https://website-capture-server.replit.app` (cloud deployment)

### Supported Websites
- Any publicly accessible HTTP/HTTPS website
- Static and basic dynamic content
- No authentication required sites

## 📁 Project Structure

```
/
├── manifest.json          # Figma plugin configuration
├── code.js               # Main plugin logic (Figma environment)
├── ui.html               # Plugin user interface
├── server.py             # Python backend server
├── requirements.txt      # Python dependencies
└── README.md            # This file
```

## 🛠️ Development

### Backend Development
```bash
# Install dependencies
pip install flask flask-cors requests beautifulsoup4

# Run development server
python server.py
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
  -d '{"url":"https://example.com"}' \
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
- Restart the "Figma Plugin Server" workflow

**Plugin Network Error**
- Ensure server is running on port 5000
- Check `manifest.json` has correct allowed domains
- Verify CORS is enabled on server

**No Elements Created**
- Check website is publicly accessible
- Try with `https://example.com` first
- Look for errors in Figma console

**Permission Denied**
- Ensure `networkAccess` is properly configured in manifest
- Check Figma has internet connectivity
- Verify backend server CORS settings

## 📦 Deployment

### Server Deployment
The Python server can be deployed to:
- **Replit** (current setup)
- **Heroku**
- **Vercel**
- **AWS Lambda**

Update `manifest.json` with your deployed server URL.

### Plugin Distribution
For sharing the plugin:
1. Package all files in a ZIP
2. Share the ZIP file
3. Recipients import via Figma's plugin developer tools

## 🔐 Security Notes

- Plugin only accesses allowed domains specified in manifest
- Server fetches public websites only
- No authentication or user data storage
- CORS properly configured for security

## 📈 Performance

- **Server Response**: ~1-3 seconds per website
- **Element Limit**: Max 100 elements per capture (configurable)
- **Memory Usage**: Minimal impact on Figma performance
- **Network**: Only fetches website content when triggered

## 🎯 Use Cases

- **Design Research**: Quickly analyze competitor layouts
- **Rapid Prototyping**: Import existing designs as starting points
- **Layout Studies**: Study design patterns and structures
- **Design System Creation**: Extract components from live sites

## 🤝 Contributing

1. Fork the repository
2. Make your changes
3. Test thoroughly with various websites
4. Submit a pull request

## 📄 License

MIT License - feel free to use and modify for your projects.

---

**Built with ❤️ for the Figma design community**