#!/usr/bin/env python3
"""
Main entry point for the Enhanced Website to Figma Capture Server
"""

from server_enhanced import app

def main():
    """Main application entry point"""
    print("Starting Enhanced Website Capture Server...")
    print("Features: Responsive capture, Full CSS extraction, Font mapping")
    print("Server will be available at: http://0.0.0.0:5000")
    print("Supported viewports: desktop, tablet, mobile")
    
    app.run(host='0.0.0.0', port=5000, debug=False)

if __name__ == '__main__':
    main()