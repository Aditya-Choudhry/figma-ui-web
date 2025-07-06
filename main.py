#!/usr/bin/env python3
"""
Main entry point for the Enhanced Website to Figma Capture Server
"""

from server_enhanced import app

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)