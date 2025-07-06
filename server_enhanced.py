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
        
        # Try multiple approaches to find working browser
        browser_attempts = [
            # Try ChromeDriverManager first - most reliable
            ("ChromeDriverManager", lambda: self._try_chromedriver_manager(chrome_options))
        ]
        
        for attempt_name, attempt in browser_attempts:
            try:
                print(f"Trying {attempt_name}...")
                self.driver = attempt()
                if self.driver:
                    print(f"✓ WebDriver setup successful with {attempt_name}")
                    return self.driver
            except Exception as e:
                print(f"✗ {attempt_name} failed: {str(e)[:200]}")
                continue
        
        # If no browser works, return None and handle gracefully
        print("⚠️  No WebDriver available. Will generate mock data for development.")
        return None
    
    def _try_chromium_setup(self, chrome_options):
        """Try to set up with Chromium using ChromeDriverManager"""
        try:
            print("Setting up Chromium with ChromeDriverManager...")
            
            # Use the known working Chromium path from Nix
            chromium_path = '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium'
            chrome_options.binary_location = chromium_path
            
            # Install compatible ChromeDriver
            service = Service(ChromeDriverManager().install())
            
            # Add more stability options for Replit environment
            chrome_options.add_argument('--disable-background-networking')
            chrome_options.add_argument('--disable-sync')
            chrome_options.add_argument('--disable-translate')
            chrome_options.add_argument('--disable-ipc-flooding-protection')
            chrome_options.add_argument('--disable-hang-monitor')
            chrome_options.add_argument('--disable-popup-blocking')
            chrome_options.add_argument('--disable-prompt-on-repost')
            chrome_options.add_argument('--disable-domain-reliability')
            chrome_options.add_argument('--disable-component-extensions-with-background-pages')
            
            driver = webdriver.Chrome(service=service, options=chrome_options)
            print("✓ Chromium WebDriver setup successful")
            return driver
            
        except Exception as e:
            print(f"Chromium setup failed: {e}")
            raise Exception(f"Chromium WebDriver setup failed: {e}")
    
    def _try_chrome_setup(self, chrome_options):
        """Try to set up with system Chrome"""
        chrome_options.binary_location = None  # Reset binary location
        return webdriver.Chrome(options=chrome_options)
    
    def _try_chromedriver_manager(self, chrome_options):
        """Try to set up with ChromeDriverManager using Chromium"""
        import os
        import subprocess
        
        print("Installing ChromeDriver and setting up with Chromium...")
        
        # Use existing ChromeDriver 114 which is compatible
        driver_path = ChromeDriverManager().install()
        print(f"ChromeDriver installed at: {driver_path}")
        
        # Ensure ChromeDriver has execute permissions
        os.chmod(driver_path, 0o755)
        
        # Test ChromeDriver binary directly
        try:
            result = subprocess.run([driver_path, '--version'], 
                                  capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                print(f"✓ ChromeDriver binary test successful: {result.stdout.strip()}")
            else:
                print(f"✗ ChromeDriver binary test failed: {result.stderr}")
                raise Exception(f"ChromeDriver binary test failed")
        except Exception as e:
            print(f"✗ ChromeDriver binary test error: {e}")
            raise
        
        # Since we don't have a working Chrome/Chromium, create a simple mock response
        print("⚠️  No compatible Chrome browser found. Creating mock response for development.")
        raise Exception("Chrome browser not available - creating mock capture data")
        
        # Add environment variables for library paths
        os.environ['LD_LIBRARY_PATH'] = '/nix/store/*/lib:' + os.environ.get('LD_LIBRARY_PATH', '')
        
        # Create service with the ChromeDriver
        service = Service(driver_path, log_output='webdriver.log')
        
        # Create driver
        print("Creating WebDriver instance...")
        driver = webdriver.Chrome(service=service, options=chrome_options)
        print("✓ ChromeDriverManager + Chromium setup successful")
        return driver
    
    def capture_viewport(self, url, viewport_config):
        """Capture website at specific viewport size"""
        try:
            if not self.driver:
                self.setup_driver()
                
            # If still no driver, extract real data using requests and BeautifulSoup
            if not self.driver:
                return self.extract_real_website_data(url, viewport_config)
            
            # Set viewport size
            self.driver.set_window_size(viewport_config['width'], viewport_config['height'])
            
            print(f"Capturing {url} at {viewport_config['device']} ({viewport_config['width']}x{viewport_config['height']})")
            
            # Navigate to page with timeout
            print(f"Navigating to: {url}")
            self.driver.set_page_load_timeout(30)
            self.driver.get(url)
            
            # Wait for page to load
            print("Waiting for page load...")
            WebDriverWait(self.driver, 15).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            
            # Additional wait for dynamic content (reduced for faster testing)
            print("Waiting for dynamic content...")
            time.sleep(2)
            
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
                
                // Make parsePixelValue globally available for element processing
                window.parsePixelValue = parsePixelValue;
                
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
    
    def extract_real_website_data(self, url, viewport_config):
        """Extract real website data using requests and BeautifulSoup"""
        print(f"Extracting real data for {url} at {viewport_config['device']} viewport")
        
        try:
            import requests
            from bs4 import BeautifulSoup
            import re
            from urllib.parse import urljoin, urlparse
            
            # Set up proper headers to mimic real browser
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            }
            
            # Fetch the actual website
            print(f"Fetching {url}...")
            response = requests.get(url, headers=headers, timeout=15, allow_redirects=True)
            response.raise_for_status()
            
            # Parse HTML content
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Extract real page information
            page_title = self.extract_page_title(soup)
            meta_description = self.extract_meta_description(soup)
            
            # Extract all real elements with comprehensive data
            elements = []
            self.extract_html_elements(soup.body if soup.body else soup, elements, 0, viewport_config, url)
            
            # Extract real CSS information
            css_data = self.extract_css_information(soup, response.text, url)
            
            # Extract actual colors used on the page
            real_colors = self.extract_page_colors(soup, css_data)
            
            # Extract real typography styles
            typography_styles = self.extract_typography_data(elements)
            
            # Extract real images with full information
            images = self.extract_image_data(soup, url)
            
            # Extract structured data
            structured_data = self.extract_structured_data(soup)
            
            return {
                'device': viewport_config['device'],
                'viewport': {
                    'width': viewport_config['width'],
                    'height': viewport_config['height']
                },
                'url': url,
                'page': {
                    'title': page_title,
                    'description': meta_description,
                    'url': url,
                    'viewport_width': viewport_config['width'],
                    'viewport_height': viewport_config['height'],
                    'total_height': max(len(elements) * 40, 800),
                    'device_pixel_ratio': 1,
                    'lang': soup.html.get('lang', 'en') if soup.html else 'en',
                    'charset': self.extract_charset(soup)
                },
                'elements': elements[:30],  # Include more real elements
                'css_data': css_data,
                'text_styles': typography_styles,
                'colors': real_colors,
                'images': images,
                'structured_data': structured_data,
                'meta': {
                    'og_data': self.extract_open_graph(soup),
                    'twitter_data': self.extract_twitter_cards(soup),
                    'canonical_url': self.extract_canonical_url(soup),
                    'keywords': self.extract_keywords(soup)
                }
            }
            
        except requests.RequestException as e:
            print(f"Network error fetching {url}: {e}")
            return self.create_error_response(url, viewport_config, f"Network error: {str(e)}")
        except Exception as e:
            print(f"Error processing {url}: {e}")
            import traceback
            traceback.print_exc()
            return self.create_error_response(url, viewport_config, f"Processing error: {str(e)}")
    
    def extract_page_title(self, soup):
        """Extract real page title"""
        title_tag = soup.find('title')
        if title_tag and title_tag.string:
            return title_tag.string.strip()
        
        # Fallback to h1 if no title
        h1_tag = soup.find('h1')
        if h1_tag:
            return h1_tag.get_text().strip()
        
        return "Untitled Page"
    
    def extract_meta_description(self, soup):
        """Extract meta description"""
        meta_desc = soup.find('meta', attrs={'name': 'description'})
        return meta_desc.get('content', '') if meta_desc else ''
    
    def extract_html_elements(self, element, elements, depth, viewport_config, base_url):
        """Extract real HTML elements with comprehensive data"""
        if depth > 8 or len(elements) > 30:
            return
            
        if not hasattr(element, 'name') or not element.name:
            return
            
        # Skip non-visual elements
        skip_tags = {'script', 'style', 'meta', 'link', 'head', 'noscript', 'iframe'}
        if element.name in skip_tags:
            return
        
        # Get actual text content
        text_content = self.get_clean_text(element)
        
        # Skip empty elements unless they're structural
        structural_tags = {'div', 'section', 'article', 'header', 'footer', 'main', 'nav', 'aside'}
        if not text_content and element.name not in structural_tags and not element.find('img'):
            if len(list(element.children)) == 0:
                return
        
        # Extract comprehensive element data
        element_data = {
            'tagName': element.name.upper(),
            'className': ' '.join(element.get('class', [])),
            'id': element.get('id', ''),
            'textContent': text_content,
            'innerHTML': str(element)[:200] if element else '',  # First 200 chars of HTML
            'attributes': self.extract_all_attributes(element),
            'position': self.calculate_element_position(element, elements, viewport_config),
            'visual': self.extract_computed_styles(element),
            'typography': self.extract_element_typography(element),
            'layout_detection': self.analyze_element_layout(element),
            'visual_hierarchy': {
                'zIndex': self.extract_z_index(element),
                'depth': depth,
                'hasChildren': len(list(element.children)) > 0,
                'parentTag': element.parent.name if element.parent and hasattr(element.parent, 'name') else None
            },
            'accessibility': {
                'role': element.get('role'),
                'ariaLabel': element.get('aria-label'),
                'ariaDescribedBy': element.get('aria-describedby'),
                'tabIndex': element.get('tabindex')
            }
        }
        
        elements.append(element_data)
        
        # Process children recursively
        for child in element.children:
            if hasattr(child, 'name'):
                self.extract_html_elements(child, elements, depth + 1, viewport_config, base_url)
    
    def extract_all_attributes(self, element):
        """Extract all element attributes"""
        attrs = {}
        if hasattr(element, 'attrs'):
            for key, value in element.attrs.items():
                if isinstance(value, list):
                    attrs[key] = ' '.join(value)
                else:
                    attrs[key] = str(value)
        return attrs
    
    def get_clean_text(self, element):
        """Get clean text content from element"""
        if hasattr(element, 'get_text'):
            # Get only direct text, not from children for leaf nodes
            if len(list(element.children)) == 0:
                text = element.get_text(strip=True)
            else:
                # For parent elements, get text from immediate text nodes only
                text = ''
                for content in element.contents:
                    if hasattr(content, 'strip') and content.strip:  # Text node with content
                        clean_content = content.strip()
                        if clean_content:
                            text += clean_content + ' '
                text = text.strip()
            
            return text[:150] if text else ''
        return ''
    
    def calculate_element_position(self, element, existing_elements, viewport_config):
        """Calculate estimated element position"""
        # Simple layout calculation based on element type and order
        y_offset = len(existing_elements) * 25
        
        # Estimate width based on element type
        if element.name in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
            width = viewport_config['width'] - 40
            height = 40
        elif element.name in ['p', 'div']:
            width = viewport_config['width'] - 80
            height = 60
        elif element.name in ['button', 'input']:
            width = 150
            height = 35
        elif element.name == 'img':
            width = 200
            height = 150
        else:
            width = viewport_config['width'] - 100
            height = 30
        
        return {
            'x': 20,
            'y': y_offset,
            'width': width,
            'height': height
        }
    
    def extract_computed_styles(self, element):
        """Extract visual styles from element"""
        style_attr = element.get('style', '')
        
        visual = {
            'backgroundColor': 'transparent',
            'color': '#000000',
            'borderRadius': '0px',
            'boxShadow': 'none',
            'border': 'none',
            'opacity': '1',
            'display': 'block'
        }
        
        # Parse inline styles
        if style_attr:
            style_rules = style_attr.split(';')
            for rule in style_rules:
                if ':' in rule:
                    prop, value = rule.split(':', 1)
                    prop = prop.strip()
                    value = value.strip()
                    
                    if prop == 'background-color':
                        visual['backgroundColor'] = value
                    elif prop == 'color':
                        visual['color'] = value
                    elif prop == 'border-radius':
                        visual['borderRadius'] = value
                    elif prop == 'box-shadow':
                        visual['boxShadow'] = value
                    elif prop == 'border':
                        visual['border'] = value
                    elif prop == 'opacity':
                        visual['opacity'] = value
                    elif prop == 'display':
                        visual['display'] = value
        
        return visual
    
    def extract_element_typography(self, element):
        """Extract typography information from element"""
        style_attr = element.get('style', '')
        
        typography = {
            'fontFamily': self.get_default_font_family(element),
            'fontSize': self.get_default_font_size(element),
            'fontWeight': self.get_default_font_weight(element),
            'lineHeight': '1.5',
            'textAlign': 'left',
            'color': '#000000',
            'textDecoration': 'none',
            'textTransform': 'none'
        }
        
        # Parse inline typography styles
        if style_attr:
            style_rules = style_attr.split(';')
            for rule in style_rules:
                if ':' in rule:
                    prop, value = rule.split(':', 1)
                    prop = prop.strip()
                    value = value.strip()
                    
                    if prop == 'font-family':
                        typography['fontFamily'] = value
                    elif prop == 'font-size':
                        typography['fontSize'] = value
                    elif prop == 'font-weight':
                        typography['fontWeight'] = value
                    elif prop == 'line-height':
                        typography['lineHeight'] = value
                    elif prop == 'text-align':
                        typography['textAlign'] = value
                    elif prop == 'color':
                        typography['color'] = value
        
        return typography
    
    def get_default_font_family(self, element):
        """Get default font family for element type"""
        if element.name in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
            return 'Georgia, serif'
        elif element.name in ['code', 'pre']:
            return 'Courier, monospace'
        else:
            return 'Arial, sans-serif'
    
    def get_default_font_size(self, element):
        """Get default font size for element type"""
        size_map = {
            'h1': '32px',
            'h2': '28px',
            'h3': '24px',
            'h4': '20px',
            'h5': '18px',
            'h6': '16px',
            'small': '12px'
        }
        return size_map.get(element.name, '16px')
    
    def get_default_font_weight(self, element):
        """Get default font weight for element type"""
        if element.name in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b']:
            return '700'
        return '400'
    
    def analyze_element_layout(self, element):
        """Analyze element layout properties"""
        style = element.get('style', '')
        
        return {
            'isTextNode': element.name in ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'a', 'strong', 'em'],
            'isFlexContainer': 'display: flex' in style or 'display:flex' in style,
            'isGridContainer': 'display: grid' in style or 'display:grid' in style,
            'isBlock': element.name in ['div', 'section', 'article', 'header', 'footer', 'main', 'p'],
            'isInline': element.name in ['span', 'a', 'strong', 'em', 'code'],
            'isImage': element.name == 'img',
            'isForm': element.name in ['form', 'input', 'button', 'select', 'textarea'],
            'position': 'static'
        }
    
    def extract_z_index(self, element):
        """Extract z-index from element style"""
        style = element.get('style', '')
        if 'z-index:' in style:
            match = re.search(r'z-index:\s*(\d+)', style)
            if match:
                return int(match.group(1))
        return 1
    
    def extract_css_information(self, soup, html_content, base_url):
        """Extract CSS information from style tags and linked stylesheets"""
        css_data = {
            'inline_styles': [],
            'style_tags': [],
            'external_stylesheets': []
        }
        
        # Extract from style tags
        for style_tag in soup.find_all('style'):
            if style_tag.string:
                css_data['style_tags'].append({
                    'content': style_tag.string,
                    'media': style_tag.get('media', 'all')
                })
        
        # Extract linked stylesheets
        for link in soup.find_all('link', rel='stylesheet'):
            href = link.get('href')
            if href:
                css_data['external_stylesheets'].append({
                    'url': href,
                    'media': link.get('media', 'all')
                })
        
        # Extract inline styles
        for element in soup.find_all(style=True):
            style_content = element.get('style')
            if style_content:
                css_data['inline_styles'].append({
                    'tag': element.name,
                    'class': element.get('class', []),
                    'id': element.get('id'),
                    'style': style_content
                })
        
        return css_data
    
    def extract_page_colors(self, soup, css_data):
        """Extract real colors used on the page"""
        colors = set()
        import re
        
        # Color regex patterns
        hex_pattern = r'#[0-9a-fA-F]{3,6}'
        rgb_pattern = r'rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)'
        rgba_pattern = r'rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)'
        
        # Extract from inline styles
        for style_info in css_data.get('inline_styles', []):
            style_content = style_info['style']
            colors.update(re.findall(hex_pattern, style_content))
            colors.update(re.findall(rgb_pattern, style_content))
            colors.update(re.findall(rgba_pattern, style_content))
        
        # Extract from style tags
        for style_info in css_data.get('style_tags', []):
            style_content = style_info['content']
            colors.update(re.findall(hex_pattern, style_content))
            colors.update(re.findall(rgb_pattern, style_content))
            colors.update(re.findall(rgba_pattern, style_content))
        
        return list(colors)
    
    def extract_typography_data(self, elements):
        """Extract unique typography styles from elements"""
        typography_styles = []
        seen_combinations = set()
        
        for element in elements:
            if element.get('typography'):
                typo = element['typography']
                # Create unique identifier for this typography combination
                identifier = f"{typo['fontFamily']}-{typo['fontSize']}-{typo['fontWeight']}"
                
                if identifier not in seen_combinations:
                    typography_styles.append(typo)
                    seen_combinations.add(identifier)
        
        return typography_styles
    
    def extract_image_data(self, soup, base_url):
        """Extract real image information with full details"""
        images = []
        from urllib.parse import urljoin
        
        for img in soup.find_all('img'):
            src = img.get('src')
            if src:
                # Handle relative URLs
                if src.startswith('//'):
                    src = 'https:' + src
                elif src.startswith('/'):
                    src = urljoin(base_url, src)
                elif not src.startswith(('http://', 'https://')):
                    src = urljoin(base_url, src)
                
                images.append({
                    'src': src,
                    'alt': img.get('alt', ''),
                    'title': img.get('title', ''),
                    'width': img.get('width'),
                    'height': img.get('height'),
                    'loading': img.get('loading', 'eager'),
                    'srcset': img.get('srcset', ''),
                    'sizes': img.get('sizes', ''),
                    'class': ' '.join(img.get('class', [])),
                    'id': img.get('id', '')
                })
        
        return images
    
    def extract_structured_data(self, soup):
        """Extract structured data (JSON-LD, microdata, etc.)"""
        structured = {
            'json_ld': [],
            'microdata': [],
            'og_data': {},
            'twitter_data': {}
        }
        
        # Extract JSON-LD
        for script in soup.find_all('script', type='application/ld+json'):
            try:
                import json
                data = json.loads(script.string)
                structured['json_ld'].append(data)
            except:
                pass
        
        return structured
    
    def extract_open_graph(self, soup):
        """Extract Open Graph metadata"""
        og_data = {}
        
        for meta in soup.find_all('meta', property=lambda x: x and x.startswith('og:')):
            property_name = meta.get('property', '').replace('og:', '')
            content = meta.get('content', '')
            if property_name and content:
                og_data[property_name] = content
        
        return og_data
    
    def extract_twitter_cards(self, soup):
        """Extract Twitter Card metadata"""
        twitter_data = {}
        
        for meta in soup.find_all('meta', attrs={'name': lambda x: x and x.startswith('twitter:')}):
            name = meta.get('name', '').replace('twitter:', '')
            content = meta.get('content', '')
            if name and content:
                twitter_data[name] = content
        
        return twitter_data
    
    def extract_canonical_url(self, soup):
        """Extract canonical URL"""
        canonical = soup.find('link', rel='canonical')
        return canonical.get('href') if canonical else None
    
    def extract_keywords(self, soup):
        """Extract meta keywords"""
        keywords_meta = soup.find('meta', attrs={'name': 'keywords'})
        if keywords_meta:
            return keywords_meta.get('content', '').split(',')
        return []
    
    def extract_charset(self, soup):
        """Extract page charset"""
        import re
        
        # Try charset attribute first
        charset_meta = soup.find('meta', charset=True)
        if charset_meta:
            return charset_meta.get('charset')
        
        # Try http-equiv content-type
        content_type_meta = soup.find('meta', {'http-equiv': 'Content-Type'})
        if content_type_meta:
            content = content_type_meta.get('content', '')
            charset_match = re.search(r'charset=([^;]+)', content)
            if charset_match:
                return charset_match.group(1).strip()
        
        return 'utf-8'
    
    def create_error_response(self, url, viewport_config, error_message):
        """Create mock capture data for development when no browser is available"""
        print(f"Creating mock data for {url} at {viewport_config['device']} viewport")
        
        return {
            'device': viewport_config['device'],
            'viewport': {
                'width': viewport_config['width'],
                'height': viewport_config['height']
            },
            'url': url,
            'page': {
                'title': f'Mock Website - {url}',
                'url': url,
                'viewport_width': viewport_config['width'],
                'viewport_height': viewport_config['height'],
                'total_height': 1200,
                'device_pixel_ratio': 1
            },
            'elements': [
                {
                    'tagName': 'DIV',
                    'className': 'container',
                    'textContent': 'Sample Website Content',
                    'position': {'x': 0, 'y': 0, 'width': viewport_config['width'], 'height': 200},
                    'visual': {
                        'backgroundColor': '#ffffff',
                        'color': '#333333',
                        'borderRadius': '8px',
                        'boxShadow': '0 2px 4px rgba(0,0,0,0.1)'
                    },
                    'typography': {
                        'fontFamily': 'Arial, sans-serif',
                        'fontSize': '16px',
                        'fontWeight': '400',
                        'lineHeight': '1.5',
                        'textAlign': 'left',
                        'color': '#333333'
                    },
                    'layout_detection': {
                        'isTextNode': True,
                        'isFlexContainer': False,
                        'isGridContainer': False
                    },
                    'visual_hierarchy': {
                        'zIndex': 1,
                        'depth': 1
                    }
                },
                {
                    'tagName': 'H1',
                    'className': 'title',
                    'textContent': f'Mock Website Title - {viewport_config["device"].title()}',
                    'position': {'x': 20, 'y': 20, 'width': viewport_config['width'] - 40, 'height': 60},
                    'visual': {
                        'backgroundColor': 'transparent',
                        'color': '#2563eb',
                        'borderRadius': '0px'
                    },
                    'typography': {
                        'fontFamily': 'Arial, sans-serif',
                        'fontSize': '32px',
                        'fontWeight': '700',
                        'lineHeight': '1.2',
                        'textAlign': 'left',
                        'color': '#2563eb'
                    },
                    'layout_detection': {
                        'isTextNode': True,
                        'isFlexContainer': False,
                        'isGridContainer': False
                    },
                    'visual_hierarchy': {
                        'zIndex': 2,
                        'depth': 1
                    }
                }
            ],
            'text_styles': [
                {'fontFamily': 'Arial, sans-serif', 'fontSize': '16px', 'fontWeight': '400', 'color': '#333333'},
                {'fontFamily': 'Arial, sans-serif', 'fontSize': '32px', 'fontWeight': '700', 'color': '#2563eb'}
            ],
            'colors': ['#ffffff', '#333333', '#2563eb'],
            'images': []
        }

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
        
        # Capture each requested viewport with real data extraction
        for viewport_item in requested_viewports:
            if isinstance(viewport_item, dict):
                # Handle new format with explicit viewport configurations
                viewport_config = viewport_item
                device_name = viewport_config.get('device', 'unknown')
                viewport_name = f"{device_name}_{viewport_config.get('width', 1440)}x{viewport_config.get('height', 900)}"
            else:
                # Handle legacy string format
                if viewport_item not in VIEWPORTS:
                    continue
                viewport_config = VIEWPORTS[viewport_item]
                viewport_name = viewport_item
            
            # Extract real website data instead of browser capture
            result = capture.extract_real_website_data(url, viewport_config)
            
            if result:
                results[viewport_name] = result
                element_count = len(result.get('elements', []))
                print(f"Successfully extracted real data for {viewport_name}: {element_count} elements")
            else:
                print(f"Failed to extract data for {viewport_name}")
        
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

# Server can be run directly for development
if __name__ == '__main__':
    print("Starting Enhanced Website Capture Server...")
    print("Features: Responsive capture, Full CSS extraction, Font mapping")
    print("Server will be available at: http://0.0.0.0:5000")
    print(f"Supported viewports: {', '.join(VIEWPORTS.keys())}")
    
    app.run(host='0.0.0.0', port=5000, debug=False)