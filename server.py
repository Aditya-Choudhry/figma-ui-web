#!/usr/bin/env python3
"""
Simple web server for capturing website content for Figma plugin
"""

import json
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from bs4 import BeautifulSoup
import urllib.parse
import re

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

def parse_css_value(value):
    """Parse CSS pixel values and return numeric value"""
    if not value or value == 'auto':
        return 0
    match = re.search(r'(\d+(?:\.\d+)?)', str(value))
    return float(match.group(1)) if match else 0

def parse_color(color_str):
    """Parse CSS color values"""
    if not color_str:
        return None
    
    # Handle rgb/rgba
    rgb_match = re.match(r'rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)', color_str)
    if rgb_match:
        r, g, b = map(int, rgb_match.groups()[:3])
        return f'rgb({r}, {g}, {b})'
    
    return color_str

def extract_element_data(element, depth=0):
    """Extract relevant data from a BeautifulSoup element"""
    if not element.name:
        return None
    
    # Skip script, style, and other non-visual elements
    skip_tags = ['script', 'style', 'meta', 'link', 'title', 'head', 'noscript']
    if element.name.lower() in skip_tags:
        return None
    
    # Get text content
    text_content = element.get_text(strip=True) if element.get_text(strip=True) else ''
    
    # Extract basic attributes
    element_data = {
        'id': f'element_{depth}_{element.name}',
        'tagName': element.name.upper(),
        'className': element.get('class', []),
        'textContent': text_content[:200] if text_content else '',
        'layout': {
            'x': 0,  # Will be set by client-side positioning
            'y': 0,
            'width': 100,  # Default values
            'height': 20 if text_content else 50
        },
        'visual': {
            'backgroundColor': 'transparent',
            'color': '#000000',
            'borderRadius': '0px'
        },
        'typography': {
            'fontSize': '16px',
            'fontFamily': 'Arial, sans-serif',
            'fontWeight': 'normal'
        },
        'depth': depth
    }
    
    return element_data

@app.route('/api/capture', methods=['POST'])
def capture_website():
    """Capture website content and return structured data"""
    try:
        data = request.get_json()
        if not data or 'url' not in data:
            return jsonify({'error': 'URL is required'}), 400
        
        url = data['url']
        
        # Validate URL
        parsed_url = urllib.parse.urlparse(url)
        if not parsed_url.scheme or not parsed_url.netloc:
            return jsonify({'error': 'Invalid URL format'}), 400
        
        print(f"Capturing website: {url}")
        
        # Set headers to mimic a real browser
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        }
        
        # Fetch the webpage
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        
        # Parse HTML
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Extract page information
        page_data = {
            'url': url,
            'title': soup.title.string if soup.title else 'Untitled',
            'viewport': {
                'width': 1200,  # Default viewport
                'height': 800
            },
            'scrollSize': {
                'width': 1200,
                'height': 2000  # Estimated
            }
        }
        
        # Extract elements
        elements = []
        
        # Get body content
        body = soup.find('body')
        if not body:
            body = soup
        
        # Extract elements with basic hierarchy
        def process_element(elem, depth=0, max_depth=10):
            if depth > max_depth:
                return
            
            element_data = extract_element_data(elem, depth)
            if element_data:
                # Adjust position based on depth for visual hierarchy
                element_data['layout']['x'] = depth * 20
                element_data['layout']['y'] = len(elements) * 30
                
                # Adjust size based on content
                if element_data['textContent']:
                    element_data['layout']['width'] = min(800, len(element_data['textContent']) * 8)
                    element_data['layout']['height'] = 25
                else:
                    element_data['layout']['width'] = 200 - (depth * 10)
                    element_data['layout']['height'] = 50
                
                elements.append(element_data)
            
            # Process children
            if hasattr(elem, 'children'):
                for child in elem.children:
                    if hasattr(child, 'name') and child.name:
                        process_element(child, depth + 1, max_depth)
        
        # Process body and its children
        process_element(body)
        
        # Limit elements for performance
        elements = elements[:100]
        
        print(f"Extracted {len(elements)} elements from {url}")
        
        return jsonify({
            'page': page_data,
            'elements': elements,
            'images': [],
            'textStyles': [],
            'colors': [],
            'fonts': []
        })
        
    except requests.RequestException as e:
        print(f"Request error: {e}")
        return jsonify({'error': f'Failed to fetch website: {str(e)}'}), 400
    except Exception as e:
        print(f"Processing error: {e}")
        return jsonify({'error': f'Failed to process website: {str(e)}'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'message': 'Website capture server is running'})

@app.route('/', methods=['GET'])
def index():
    """Root endpoint with API information"""
    return jsonify({
        'name': 'Website to Figma Capture Server',
        'version': '1.0.0',
        'endpoints': {
            '/api/capture': 'POST - Capture website content',
            '/health': 'GET - Health check'
        }
    })

if __name__ == '__main__':
    print("Starting Website Capture Server...")
    print("Server will be available at: http://localhost:5000")
    print("Health check: http://localhost:5000/health")
    print("API endpoint: http://localhost:5000/api/capture")
    
    app.run(host='0.0.0.0', port=5000, debug=True)