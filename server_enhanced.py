#!/usr/bin/env python3
"""
Enhanced web server for capturing website content across multiple viewports
Supports desktop, tablet, and mobile responsive capture with full CSS analysis
"""

import json
import time
from flask import Flask, request, jsonify
from flask_cors import CORS
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
import urllib.parse
import re
import base64
from io import BytesIO

app = Flask(__name__)
CORS(app)

# Viewport configurations for responsive capture
VIEWPORTS = {
    'desktop': {'width': 1440, 'height': 900, 'device': 'Desktop'},
    'tablet': {'width': 768, 'height': 1024, 'device': 'Tablet'},
    'mobile': {'width': 375, 'height': 667, 'device': 'Mobile'}
}

# Font mapping from web fonts to Figma fonts
FONT_MAPPING = {
    'Arial': 'Arial',
    'Helvetica': 'Arial',
    'Times': 'Times New Roman',
    'Georgia': 'Georgia',
    'Verdana': 'Verdana',
    'Courier': 'Courier New',
    'Impact': 'Impact',
    'Comic Sans MS': 'Comic Sans MS',
    'Trebuchet MS': 'Trebuchet MS',
    'Arial Black': 'Arial Black',
    'Palatino': 'Palatino',
    'Garamond': 'Garamond',
    'Bookman': 'Bookman',
    'Tahoma': 'Tahoma',
    'sans-serif': 'Inter',
    'serif': 'Times New Roman',
    'monospace': 'Courier New',
    'cursive': 'Comic Sans MS',
    'fantasy': 'Impact'
}

class WebsiteCapture:
    def __init__(self):
        self.driver = None
        
    def setup_driver(self):
        """Setup Chrome driver with headless configuration for Replit environment"""
        chrome_options = Options()
        chrome_options.add_argument('--headless')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--window-size=1920,1080')
        chrome_options.add_argument('--disable-extensions')
        chrome_options.add_argument('--disable-web-security')
        chrome_options.add_argument('--disable-features=VizDisplayCompositor')
        chrome_options.add_argument('--remote-debugging-port=9222')
        chrome_options.add_argument('--disable-setuid-sandbox')
        chrome_options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        
        try:
            # Try to find chromium binary in Replit environment
            import subprocess
            result = subprocess.run(['which', 'chromium'], capture_output=True, text=True)
            if result.returncode == 0:
                chrome_options.binary_location = result.stdout.strip()
            
            self.driver = webdriver.Chrome(options=chrome_options)
        except Exception as e:
            print(f"Error setting up WebDriver with system Chrome: {e}")
            # Fallback to ChromeDriverManager
            try:
                service = Service(ChromeDriverManager().install())
                self.driver = webdriver.Chrome(service=service, options=chrome_options)
            except Exception as fallback_error:
                print(f"Fallback WebDriver setup failed: {fallback_error}")
                raise Exception("Unable to initialize WebDriver")
        
        return self.driver
    
    def capture_viewport(self, url, viewport_config):
        """Capture website at specific viewport size"""
        try:
            if not self.driver:
                self.setup_driver()
            
            # Set viewport size
            self.driver.set_window_size(viewport_config['width'], viewport_config['height'])
            
            print(f"Capturing {url} at {viewport_config['device']} ({viewport_config['width']}x{viewport_config['height']})")
            
            # Navigate to page
            self.driver.get(url)
            
            # Wait for page to load
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            
            # Additional wait for dynamic content
            time.sleep(3)
            
            # Get page dimensions for full scroll capture
            total_height = self.driver.execute_script("return document.body.scrollHeight")
            viewport_height = self.driver.execute_script("return window.innerHeight")
            
            # Scroll to capture full page
            self.driver.execute_script("window.scrollTo(0, 0);")
            time.sleep(1)
            
            # Extract complete page data
            page_data = self.extract_page_data(viewport_config)
            
            return page_data
            
        except Exception as e:
            print(f"Error capturing viewport {viewport_config['device']}: {e}")
            return None
    
    def extract_page_data(self, viewport_config):
        """Extract comprehensive page data including all elements and styles"""
        
        # JavaScript to extract all element data - Enhanced for exact replication
        extraction_script = """
        function extractPageData() {
            const elements = [];
            const fonts = new Set();
            const colors = new Set();
            const images = new Set();
            const cssRules = [];
            
            // Get comprehensive page info
            const pageInfo = {
                url: window.location.href,
                title: document.title,
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight
                },
                scrollSize: {
                    width: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth),
                    height: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
                },
                devicePixelRatio: window.devicePixelRatio,
                userAgent: navigator.userAgent
            };
            
            // Enhanced function to get ALL computed styles for exact replication
            function getComputedStyleData(element) {
                const style = window.getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                
                // Parse numeric values from CSS
                const parsePixelValue = (value) => {
                    if (!value || value === 'auto' || value === 'none') return 0;
                    const match = value.match(/(-?\\d*\\.?\\d+)/);
                    return match ? parseFloat(match[1]) : 0;
                };
                
                // Extract background images and IMG src
                const backgroundImages = [];
                if (style.backgroundImage && style.backgroundImage !== 'none') {
                    const matches = style.backgroundImage.match(/url\\([^)]*\\)/g);
                    if (matches) {
                        matches.forEach(match => {
                            const url = match.slice(4, -1).replace(/["']/g, '');
                            if (url && !url.startsWith('data:')) {
                                backgroundImages.push(url);
                                images.add(url);
                            }
                        });
                    }
                }
                
                // Extract IMG element src
                if (element.tagName === 'IMG' && element.src && !element.src.startsWith('data:')) {
                    images.add(element.src);
                }
                
                return {
                    // Precise position and dimensions
                    position: {
                        x: Math.round(rect.left + window.scrollX),
                        y: Math.round(rect.top + window.scrollY),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height),
                        top: Math.round(rect.top),
                        right: Math.round(rect.right),
                        bottom: Math.round(rect.bottom),
                        left: Math.round(rect.left)
                    },
                    
                    // Complete layout properties for Figma Auto Layout
                    layout: {
                        display: style.display,
                        position: style.position,
                        zIndex: style.zIndex,
                        
                        // Flexbox properties
                        flexDirection: style.flexDirection,
                        flexWrap: style.flexWrap,
                        justifyContent: style.justifyContent,
                        alignItems: style.alignItems,
                        alignContent: style.alignContent,
                        alignSelf: style.alignSelf,
                        flex: style.flex,
                        flexGrow: style.flexGrow,
                        flexShrink: style.flexShrink,
                        flexBasis: style.flexBasis,
                        gap: style.gap,
                        rowGap: style.rowGap,
                        columnGap: style.columnGap,
                        
                        // Grid properties
                        gridTemplateColumns: style.gridTemplateColumns,
                        gridTemplateRows: style.gridTemplateRows,
                        gridTemplateAreas: style.gridTemplateAreas,
                        gridAutoColumns: style.gridAutoColumns,
                        gridAutoRows: style.gridAutoRows,
                        gridAutoFlow: style.gridAutoFlow,
                        gridColumn: style.gridColumn,
                        gridRow: style.gridRow,
                        gridArea: style.gridArea,
                        
                        // Box model
                        boxSizing: style.boxSizing,
                        overflow: style.overflow,
                        overflowX: style.overflowX,
                        overflowY: style.overflowY
                    },
                    
                    // Complete visual properties
                    visual: {
                        backgroundColor: style.backgroundColor,
                        backgroundImage: style.backgroundImage,
                        backgroundSize: style.backgroundSize,
                        backgroundPosition: style.backgroundPosition,
                        backgroundRepeat: style.backgroundRepeat,
                        backgroundAttachment: style.backgroundAttachment,
                        backgroundClip: style.backgroundClip,
                        backgroundOrigin: style.backgroundOrigin,
                        backgroundImages: backgroundImages,
                        
                        // Borders (all sides)
                        borderTopWidth: parsePixelValue(style.borderTopWidth),
                        borderRightWidth: parsePixelValue(style.borderRightWidth),
                        borderBottomWidth: parsePixelValue(style.borderBottomWidth),
                        borderLeftWidth: parsePixelValue(style.borderLeftWidth),
                        borderTopStyle: style.borderTopStyle,
                        borderRightStyle: style.borderRightStyle,
                        borderBottomStyle: style.borderBottomStyle,
                        borderLeftStyle: style.borderLeftStyle,
                        borderTopColor: style.borderTopColor,
                        borderRightColor: style.borderRightColor,
                        borderBottomColor: style.borderBottomColor,
                        borderLeftColor: style.borderLeftColor,
                        
                        // Border radius (all corners)
                        borderTopLeftRadius: style.borderTopLeftRadius,
                        borderTopRightRadius: style.borderTopRightRadius,
                        borderBottomRightRadius: style.borderBottomRightRadius,
                        borderBottomLeftRadius: style.borderBottomLeftRadius,
                        
                        // Effects
                        opacity: parseFloat(style.opacity),
                        boxShadow: style.boxShadow,
                        filter: style.filter,
                        transform: style.transform,
                        transformOrigin: style.transformOrigin,
                        transition: style.transition,
                        animation: style.animation,
                        
                        // Visibility
                        visibility: style.visibility,
                        clipPath: style.clipPath,
                        mask: style.mask
                    },
                    
                    // Complete typography properties
                    typography: {
                        fontFamily: style.fontFamily,
                        fontSize: parsePixelValue(style.fontSize),
                        fontWeight: style.fontWeight,
                        fontStyle: style.fontStyle,
                        fontVariant: style.fontVariant,
                        fontStretch: style.fontStretch,
                        lineHeight: style.lineHeight,
                        textAlign: style.textAlign,
                        textDecoration: style.textDecoration,
                        textDecorationColor: style.textDecorationColor,
                        textDecorationLine: style.textDecorationLine,
                        textDecorationStyle: style.textDecorationStyle,
                        textTransform: style.textTransform,
                        textIndent: style.textIndent,
                        textShadow: style.textShadow,
                        color: style.color,
                        letterSpacing: parsePixelValue(style.letterSpacing),
                        wordSpacing: parsePixelValue(style.wordSpacing),
                        whiteSpace: style.whiteSpace,
                        wordBreak: style.wordBreak,
                        wordWrap: style.wordWrap,
                        textOverflow: style.textOverflow,
                        verticalAlign: style.verticalAlign,
                        writingMode: style.writingMode,
                        direction: style.direction
                    },
                    
                    // Precise spacing (all values as numbers)
                    spacing: {
                        marginTop: parsePixelValue(style.marginTop),
                        marginRight: parsePixelValue(style.marginRight),
                        marginBottom: parsePixelValue(style.marginBottom),
                        marginLeft: parsePixelValue(style.marginLeft),
                        paddingTop: parsePixelValue(style.paddingTop),
                        paddingRight: parsePixelValue(style.paddingRight),
                        paddingBottom: parsePixelValue(style.paddingBottom),
                        paddingLeft: parsePixelValue(style.paddingLeft)
                    }
                };
            }
            
            // Function to determine if element should be included
            function shouldIncludeElement(element, style) {
                // Skip non-visual elements
                const skipTags = ['SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE', 'HEAD', 'NOSCRIPT'];
                if (skipTags.includes(element.tagName)) return false;
                
                // Skip hidden elements
                if (style.display === 'none' || style.visibility === 'hidden') return false;
                
                // Skip elements with zero dimensions (unless they have children)
                const rect = element.getBoundingClientRect();
                if (rect.width === 0 && rect.height === 0 && element.children.length === 0) return false;
                
                return true;
            }
            
            // Traverse DOM and extract elements
            function traverseElement(element, depth = 0, parentId = null) {
                if (depth > 15) return; // Prevent infinite recursion
                
                const style = window.getComputedStyle(element);
                
                if (!shouldIncludeElement(element, style)) return;
                
                const elementId = `${element.tagName.toLowerCase()}_${depth}_${elements.length}`;
                const styleData = getComputedStyleData(element);
                
                // Collect fonts and colors
                if (styleData.typography.fontFamily) {
                    fonts.add(styleData.typography.fontFamily);
                }
                if (styleData.typography.color && styleData.typography.color !== 'rgba(0, 0, 0, 0)') {
                    colors.add(styleData.typography.color);
                }
                if (styleData.visual.backgroundColor && styleData.visual.backgroundColor !== 'rgba(0, 0, 0, 0)') {
                    colors.add(styleData.visual.backgroundColor);
                }
                
                // Enhanced element data for exact Figma replication
                const elementData = {
                    id: elementId,
                    tagName: element.tagName,
                    className: element.className || '',
                    innerHTML: element.innerHTML ? element.innerHTML.substring(0, 1000) : '',
                    textContent: element.textContent ? element.textContent.trim().substring(0, 500) : '',
                    innerText: element.innerText ? element.innerText.trim().substring(0, 500) : '',
                    depth: depth,
                    parentId: parentId,
                    ...styleData,
                    
                    // Complete attributes for context
                    attributes: {
                        id: element.id || '',
                        href: element.href || '',
                        src: element.src || '',
                        alt: element.alt || '',
                        title: element.title || '',
                        role: element.getAttribute('role') || '',
                        ariaLabel: element.getAttribute('aria-label') || '',
                        dataAttributes: Array.from(element.attributes)
                            .filter(attr => attr.name.startsWith('data-'))
                            .reduce((acc, attr) => {
                                acc[attr.name] = attr.value;
                                return acc;
                            }, {})
                    },
                    
                    // Enhanced layout detection for Figma Auto Layout
                    layout_detection: {
                        isFlexContainer: style.display === 'flex',
                        isGridContainer: style.display === 'grid',
                        isInlineBlock: style.display === 'inline-block',
                        isBlock: style.display === 'block',
                        isInline: style.display === 'inline',
                        hasChildren: element.children.length > 0,
                        childrenCount: element.children.length,
                        isTextNode: element.children.length === 0 && element.textContent.trim().length > 0,
                        isImageElement: element.tagName === 'IMG',
                        isInputElement: ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(element.tagName),
                        isContainerElement: ['DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'NAV', 'MAIN', 'ASIDE'].includes(element.tagName),
                        
                        // Flexbox analysis for Auto Layout mapping
                        flexboxMapping: style.display === 'flex' ? {
                            figmaLayoutMode: style.flexDirection === 'column' || style.flexDirection === 'column-reverse' ? 'VERTICAL' : 'HORIZONTAL',
                            figmaPrimaryAxis: style.justifyContent,
                            figmaCounterAxis: style.alignItems,
                            figmaItemSpacing: parsePixelValue(style.gap) || parsePixelValue(style.rowGap) || parsePixelValue(style.columnGap),
                            figmaPadding: {
                                top: parsePixelValue(style.paddingTop),
                                right: parsePixelValue(style.paddingRight),
                                bottom: parsePixelValue(style.paddingBottom),
                                left: parsePixelValue(style.paddingLeft)
                            }
                        } : null,
                        
                        // Grid analysis for complex layouts
                        gridMapping: style.display === 'grid' ? {
                            columns: style.gridTemplateColumns,
                            rows: style.gridTemplateRows,
                            gap: parsePixelValue(style.gap),
                            areas: style.gridTemplateAreas
                        } : null
                    },
                    
                    // Visual hierarchy analysis
                    visual_hierarchy: {
                        zIndex: parseInt(style.zIndex) || 0,
                        isPositioned: ['absolute', 'relative', 'fixed', 'sticky'].includes(style.position),
                        isVisible: style.visibility !== 'hidden' && style.display !== 'none' && parseFloat(style.opacity) > 0,
                        hasBackground: style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent',
                        hasBorder: parsePixelValue(style.borderWidth) > 0 || parsePixelValue(style.borderTopWidth) > 0 || parsePixelValue(style.borderRightWidth) > 0 || parsePixelValue(style.borderBottomWidth) > 0 || parsePixelValue(style.borderLeftWidth) > 0,
                        hasShadow: style.boxShadow !== 'none',
                        hasTransform: style.transform !== 'none',
                        isInteractive: ['A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) || element.getAttribute('onclick') || style.cursor === 'pointer'
                    }
                };
                
                elements.push(elementData);
                
                // Process children
                for (let child of element.children) {
                    traverseElement(child, depth + 1, elementId);
                }
            }
            
            // Start traversal from body
            const body = document.body;
            if (body) {
                traverseElement(body);
            }
            
            return {
                page: pageInfo,
                elements: elements,
                fonts: Array.from(fonts),
                colors: Array.from(colors),
                images: Array.from(images),
                totalElements: elements.length,
                
                // Additional metadata for Figma
                metadata: {
                    captureTimestamp: Date.now(),
                    viewport: pageInfo.viewport,
                    totalFonts: fonts.size,
                    totalColors: colors.size,
                    totalImages: images.size,
                    hasFlexLayouts: elements.some(el => el.layout_detection?.isFlexContainer),
                    hasGridLayouts: elements.some(el => el.layout_detection?.isGridContainer),
                    maxDepth: Math.max(...elements.map(el => el.depth || 0))
                }
            };
        }
        
        return extractPageData();
        """
        
        # Execute the extraction script
        result = self.driver.execute_script(extraction_script)
        
        # Add viewport info
        result['viewport_config'] = viewport_config
        
        # Process and enhance the data
        result = self.post_process_data(result)
        
        return result
    
    def post_process_data(self, data):
        """Post-process extracted data for better Figma compatibility"""
        
        # Map fonts to Figma-compatible fonts
        mapped_fonts = []
        for font in data.get('fonts', []):
            figma_font = self.map_font_to_figma(font)
            if figma_font not in mapped_fonts:
                mapped_fonts.append(figma_font)
        
        data['figma_fonts'] = mapped_fonts
        
        # Process elements for better hierarchy
        for element in data.get('elements', []):
            # Determine Figma node type
            element['figma_node_type'] = self.determine_figma_node_type(element)
            
            # Clean up positioning for Figma
            element = self.optimize_for_figma(element)
        
        return data
    
    def map_font_to_figma(self, web_font):
        """Map web font to available Figma font"""
        # Extract primary font family
        font_families = [f.strip().strip('"\'') for f in web_font.split(',')]
        
        for font in font_families:
            if font in FONT_MAPPING:
                return FONT_MAPPING[font]
        
        # Default fallback
        return 'Inter'
    
    def determine_figma_node_type(self, element):
        """Determine the best Figma node type for an element"""
        if element.get('textContent') and element['textContent'].strip():
            return 'TEXT'
        elif element.get('isFlexContainer') or element.get('isGridContainer') or element.get('hasChildren'):
            return 'FRAME'
        else:
            return 'RECTANGLE'
    
    def optimize_for_figma(self, element):
        """Optimize element data for Figma creation"""
        # Convert CSS values to numeric
        pos = element.get('position', {})
        element['figma_x'] = self.parse_pixel_value(pos.get('x', 0))
        element['figma_y'] = self.parse_pixel_value(pos.get('y', 0))
        element['figma_width'] = max(1, self.parse_pixel_value(pos.get('width', 100)))
        element['figma_height'] = max(1, self.parse_pixel_value(pos.get('height', 20)))
        
        # Parse colors
        if element.get('visual', {}).get('backgroundColor'):
            element['figma_bg_color'] = self.parse_color(element['visual']['backgroundColor'])
        
        if element.get('typography', {}).get('color'):
            element['figma_text_color'] = self.parse_color(element['typography']['color'])
        
        # Parse font size
        if element.get('typography', {}).get('fontSize'):
            element['figma_font_size'] = self.parse_pixel_value(element['typography']['fontSize'])
        
        return element
    
    def parse_pixel_value(self, value):
        """Convert CSS pixel values to numbers"""
        if isinstance(value, (int, float)):
            return value
        if not value or value == 'auto':
            return 0
        
        # Extract numeric value from strings like "16px", "1.5em", etc.
        match = re.search(r'(\d+(?:\.\d+)?)', str(value))
        return float(match.group(1)) if match else 0
    
    def parse_color(self, color_str):
        """Parse CSS colors to RGB format for Figma"""
        if not color_str or color_str == 'rgba(0, 0, 0, 0)':
            return None
        
        # Handle rgb/rgba
        rgb_match = re.match(r'rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)', color_str)
        if rgb_match:
            r, g, b = map(int, rgb_match.groups()[:3])
            return {'r': r / 255, 'g': g / 255, 'b': b / 255}
        
        # Handle hex colors
        hex_match = re.match(r'#([a-f\d]{6})', color_str, re.I)
        if hex_match:
            hex_color = hex_match.group(1)
            r = int(hex_color[0:2], 16)
            g = int(hex_color[2:4], 16) 
            b = int(hex_color[4:6], 16)
            return {'r': r / 255, 'g': g / 255, 'b': b / 255}
        
        return None
    
    def cleanup(self):
        """Cleanup resources"""
        if self.driver:
            self.driver.quit()
            self.driver = None

@app.route('/api/capture-responsive', methods=['POST'])
def capture_responsive():
    """Capture website across multiple viewports"""
    capture = WebsiteCapture()
    
    try:
        data = request.get_json()
        if not data or 'url' not in data:
            return jsonify({'error': 'URL is required'}), 400
        
        url = data['url']
        requested_viewports = data.get('viewports', ['desktop', 'tablet', 'mobile'])
        
        # Validate URL
        parsed_url = urllib.parse.urlparse(url)
        if not parsed_url.scheme or not parsed_url.netloc:
            return jsonify({'error': 'Invalid URL format'}), 400
        
        print(f"Starting responsive capture for: {url}")
        print(f"Requested viewports: {requested_viewports}")
        
        results = {}
        
        # Capture each requested viewport
        for viewport_name in requested_viewports:
            if viewport_name not in VIEWPORTS:
                continue
                
            viewport_config = VIEWPORTS[viewport_name]
            result = capture.capture_viewport(url, viewport_config)
            
            if result:
                results[viewport_name] = result
                print(f"Successfully captured {viewport_name}: {result.get('totalElements', 0)} elements")
            else:
                print(f"Failed to capture {viewport_name}")
        
        if not results:
            return jsonify({'error': 'Failed to capture any viewports'}), 500
        
        return jsonify({
            'url': url,
            'viewports': results,
            'capture_time': time.time(),
            'total_viewports': len(results)
        })
        
    except Exception as e:
        print(f"Capture error: {e}")
        return jsonify({'error': f'Capture failed: {str(e)}'}), 500
    finally:
        capture.cleanup()

@app.route('/api/capture', methods=['POST'])
def capture_single():
    """Single viewport capture (backward compatibility)"""
    try:
        data = request.get_json()
        if not data or 'url' not in data:
            return jsonify({'error': 'URL is required'}), 400
        
        # Use desktop viewport for single capture
        viewport_config = VIEWPORTS['desktop']
        capture = WebsiteCapture()
        
        try:
            result = capture.capture_viewport(data['url'], viewport_config)
            if result:
                return jsonify(result)
            else:
                return jsonify({'error': 'Capture failed'}), 500
        finally:
            capture.cleanup()
            
    except Exception as e:
        return jsonify({'error': f'Capture failed: {str(e)}'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok', 
        'message': 'Enhanced website capture server is running',
        'supported_viewports': list(VIEWPORTS.keys()),
        'features': ['responsive_capture', 'full_css_extraction', 'font_mapping']
    })

@app.route('/', methods=['GET'])
def index():
    """Root endpoint with API information"""
    return jsonify({
        'name': 'Enhanced Website to Figma Capture Server',
        'version': '2.0.0',
        'endpoints': {
            '/api/capture-responsive': 'POST - Capture website across multiple viewports',
            '/api/capture': 'POST - Single viewport capture',
            '/health': 'GET - Health check'
        },
        'viewports': VIEWPORTS
    })

if __name__ == '__main__':
    print("Starting Enhanced Website Capture Server...")
    print("Features: Responsive capture, Full CSS extraction, Font mapping")
    print("Server will be available at: http://localhost:5000")
    print(f"Supported viewports: {', '.join(VIEWPORTS.keys())}")
    
    app.run(host='0.0.0.0', port=5000, debug=True)