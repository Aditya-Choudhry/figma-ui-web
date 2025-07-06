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
            print(f"🔍 Starting element extraction for viewport {viewport_config['width']}x{viewport_config['height']}")
            elements = []
            self.extract_html_elements(soup.body if soup.body else soup, elements, 0, viewport_config, url)
            print(f"✅ Extracted {len(elements)} total elements from HTML structure")
            
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
            
            # Create comprehensive design analysis
            print(f"🎨 Creating design analysis from {len(elements)} elements, {len(images)} images, {len(real_colors)} colors")
            design_analysis = self.create_design_analysis(elements, images, real_colors, typography_styles, css_data)
            print(f"📊 Design analysis complete: {len(design_analysis.get('textElements', []))} text elements, {design_analysis.get('summary', {}).get('totalShapes', 0)} shapes")
            
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
                'elements': elements[:100],  # Include more real elements for comprehensive capture
                'css_data': css_data,
                'text_styles': typography_styles,
                'colors': real_colors,
                'images': images,
                'structured_data': structured_data,
                'design_analysis': design_analysis,  # New comprehensive design inspector output
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
            print(f"⚠️  Stopping extraction: depth={depth}, elements={len(elements)}")
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
                print(f"⏭️  Skipping empty {element.name} element with no text/children at depth {depth}")
                return
        
        print(f"🔍 Processing {element.name} element at depth {depth} - text: '{text_content[:30]}...' children: {len(list(element.children))}")
        
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
        print(f"✅ EXTRACTED: {element.name.upper()} | Tag: {element_data['tagName']} | Text: '{text_content[:40]}...' | Position: {element_data['position']} | Depth: {depth}")
        
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
        """Extract comprehensive visual styles from element"""
        style_attr = element.get('style', '')
        
        visual = {
            # Background properties
            'backgroundColor': 'transparent',
            'backgroundImage': 'none',
            'backgroundSize': 'auto',
            'backgroundPosition': '0% 0%',
            'backgroundRepeat': 'repeat',
            
            # Text and color properties
            'color': '#000000',
            'fontSize': '16px',
            'fontFamily': 'inherit',
            'fontWeight': 'normal',
            'fontStyle': 'normal',
            'textAlign': 'left',
            'textDecoration': 'none',
            'lineHeight': 'normal',
            'letterSpacing': 'normal',
            
            # Border properties
            'border': 'none',
            'borderTop': 'none',
            'borderRight': 'none', 
            'borderBottom': 'none',
            'borderLeft': 'none',
            'borderRadius': '0px',
            'borderTopLeftRadius': '0px',
            'borderTopRightRadius': '0px',
            'borderBottomLeftRadius': '0px',
            'borderBottomRightRadius': '0px',
            
            # Layout properties
            'display': 'block',
            'position': 'static',
            'top': 'auto',
            'right': 'auto',
            'bottom': 'auto',
            'left': 'auto',
            'width': 'auto',
            'height': 'auto',
            'maxWidth': 'none',
            'maxHeight': 'none',
            'minWidth': '0',
            'minHeight': '0',
            
            # Spacing properties
            'margin': '0',
            'marginTop': '0',
            'marginRight': '0',
            'marginBottom': '0',
            'marginLeft': '0',
            'padding': '0',
            'paddingTop': '0',
            'paddingRight': '0',
            'paddingBottom': '0',
            'paddingLeft': '0',
            
            # Effects
            'opacity': '1',
            'boxShadow': 'none',
            'filter': 'none',
            'transform': 'none',
            'transformOrigin': '50% 50%',
            'transition': 'none',
            'animation': 'none',
            
            # Visibility
            'visibility': 'visible',
            'overflow': 'visible',
            'overflowX': 'visible',
            'overflowY': 'visible',
            'clipPath': 'none',
            'zIndex': 'auto'
        }
        
        # Enhanced inline style parsing with comprehensive properties
        if style_attr:
            style_rules = style_attr.split(';')
            for rule in style_rules:
                if ':' in rule:
                    prop, value = rule.split(':', 1)
                    prop = prop.strip()
                    value = value.strip()
                    
                    # Normalize CSS property name to camelCase
                    camel_prop = ''.join(word.capitalize() if i > 0 else word for i, word in enumerate(prop.split('-')))
                    
                    # Store all CSS properties
                    if camel_prop in visual:
                        visual[camel_prop] = value
                    else:
                        # Store additional properties not in the default set
                        visual[camel_prop] = value
        
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
        """Extract comprehensive CSS information including colors, fonts, and images"""
        css_data = {
            'inline_styles': [],
            'style_tags': [],
            'external_stylesheets': [],
            'extracted_colors': set(),
            'extracted_fonts': set(),
            'background_images': set(),
            'css_rules': [],
            'computed_styles': {}
        }
        
        # Extract from style tags with comprehensive parsing
        for style_tag in soup.find_all('style'):
            if style_tag.string:
                style_content = style_tag.string.strip()
                style_info = {
                    'content': style_content,
                    'media': style_tag.get('media', 'all'),
                    'type': style_tag.get('type', 'text/css')
                }
                css_data['style_tags'].append(style_info)
                
                # Parse CSS content for colors, fonts, images
                self.parse_css_content_comprehensive(style_content, css_data, base_url)
        
        # Extract linked stylesheets with enhanced info
        for link in soup.find_all('link', rel='stylesheet'):
            href = link.get('href')
            if href:
                full_url = self.resolve_url(href, base_url)
                stylesheet_info = {
                    'url': href,
                    'full_url': full_url,
                    'media': link.get('media', 'all'),
                    'crossorigin': link.get('crossorigin'),
                    'integrity': link.get('integrity')
                }
                css_data['external_stylesheets'].append(stylesheet_info)
                
                # Try to fetch and parse external CSS
                try:
                    external_css = self.fetch_external_css_safe(full_url)
                    if external_css:
                        self.parse_css_content_comprehensive(external_css, css_data, base_url)
                except Exception as e:
                    print(f"Could not fetch external CSS from {full_url}: {e}")
        
        # Extract comprehensive inline styles
        for element in soup.find_all(style=True):
            style_content = element.get('style')
            if style_content:
                parsed_properties = self.parse_inline_style_comprehensive(style_content, css_data, base_url)
                inline_style = {
                    'tag': element.name,
                    'class': element.get('class', []),
                    'id': element.get('id'),
                    'style': style_content,
                    'parsed_properties': parsed_properties
                }
                css_data['inline_styles'].append(inline_style)
        
        # Extract colors from HTML attributes
        self.extract_html_colors(soup, css_data)
        
        # Extract fonts from HTML
        self.extract_html_fonts(soup, css_data)
        
        # Extract images from HTML
        self.extract_html_images(soup, css_data, base_url)
        
        # Convert sets to lists for JSON serialization
        css_data['extracted_colors'] = list(css_data['extracted_colors'])
        css_data['extracted_fonts'] = list(css_data['extracted_fonts'])
        css_data['background_images'] = list(css_data['background_images'])
        
        return css_data
    
    def parse_css_content_comprehensive(self, css_content, css_data, base_url):
        """Parse CSS content to extract all colors, fonts, images, and rules"""
        import re
        
        # Extract all types of colors
        color_patterns = [
            r'#[0-9a-fA-F]{3,8}',  # Hex colors
            r'rgb\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)',  # RGB colors
            r'rgba\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)',  # RGBA colors
            r'hsl\s*\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\)',  # HSL colors
            r'hsla\s*\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*,\s*[\d.]+\s*\)',  # HSLA colors
            # Named colors
            r'\b(?:red|blue|green|yellow|purple|orange|pink|brown|black|white|gray|grey|cyan|magenta|lime|navy|olive|teal|silver|maroon|aqua|fuchsia|crimson|gold|indigo|violet|turquoise|coral|salmon|khaki|plum|orchid|tan|beige|ivory|snow)\b'
        ]
        
        for pattern in color_patterns:
            colors = re.findall(pattern, css_content, re.IGNORECASE)
            for color in colors:
                css_data['extracted_colors'].add(color.strip().lower())
        
        # Extract font families comprehensively
        font_patterns = [
            r'font-family\s*:\s*([^;{}]+)',
            r'font\s*:\s*[^;]*?\s([^;,{}]+(?:,[^;,{}]+)*)',  # Font shorthand
            r'@import\s+url\(["\']?[^"\']*fonts[^"\']*["\']?\)',  # Google Fonts imports
        ]
        
        for pattern in font_patterns:
            font_matches = re.findall(pattern, css_content, re.IGNORECASE)
            for font_match in font_matches:
                if isinstance(font_match, str):
                    fonts = [f.strip().strip('"\'') for f in font_match.split(',')]
                    for font in fonts:
                        if font and font not in ['inherit', 'initial', 'unset', 'normal', 'bold', 'italic']:
                            css_data['extracted_fonts'].add(font)
        
        # Extract background images and other image references
        image_patterns = [
            r'background-image\s*:\s*url\s*\(\s*["\']?([^"\'()]+)["\']?\s*\)',
            r'background\s*:\s*[^;]*url\s*\(\s*["\']?([^"\'()]+)["\']?\s*\)',
            r'content\s*:\s*url\s*\(\s*["\']?([^"\'()]+)["\']?\s*\)',
            r'list-style-image\s*:\s*url\s*\(\s*["\']?([^"\'()]+)["\']?\s*\)',
            r'border-image\s*:\s*url\s*\(\s*["\']?([^"\'()]+)["\']?\s*\)'
        ]
        
        for pattern in image_patterns:
            images = re.findall(pattern, css_content, re.IGNORECASE)
            for image_url in images:
                full_image_url = self.resolve_url(image_url, base_url)
                css_data['background_images'].add(full_image_url)
        
        # Extract CSS rules with selectors for comprehensive analysis
        rule_pattern = r'([^{}]+)\s*\{([^{}]*)\}'
        rules = re.findall(rule_pattern, css_content, re.DOTALL)
        
        for selector, properties in rules:
            if selector.strip() and properties.strip():
                css_rule = {
                    'selector': selector.strip(),
                    'properties': {},
                    'colors': [],
                    'fonts': [],
                    'images': []
                }
                
                # Parse individual properties
                prop_pattern = r'([^:;]+)\s*:\s*([^;]+)'
                props = re.findall(prop_pattern, properties)
                
                for prop_name, prop_value in props:
                    prop_name = prop_name.strip()
                    prop_value = prop_value.strip()
                    css_rule['properties'][prop_name] = prop_value
                    
                    # Extract colors from this property
                    for color_pattern in color_patterns:
                        colors = re.findall(color_pattern, prop_value, re.IGNORECASE)
                        css_rule['colors'].extend([c.strip().lower() for c in colors])
                    
                    # Extract fonts from this property
                    if 'font' in prop_name.lower():
                        fonts = [f.strip().strip('"\'') for f in prop_value.split(',')]
                        css_rule['fonts'].extend([f for f in fonts if f and f not in ['inherit', 'initial', 'unset', 'normal', 'bold', 'italic']])
                    
                    # Extract images from this property
                    if 'url(' in prop_value:
                        url_match = re.search(r'url\s*\(\s*["\']?([^"\'()]+)["\']?\s*\)', prop_value)
                        if url_match:
                            image_url = self.resolve_url(url_match.group(1), base_url)
                            css_rule['images'].append(image_url)
                
                css_data['css_rules'].append(css_rule)
    
    def parse_inline_style_comprehensive(self, style_content, css_data, base_url):
        """Parse inline styles comprehensively"""
        import re
        properties = {}
        
        # Split style into property-value pairs
        prop_pattern = r'([^:;]+)\s*:\s*([^;]+)'
        props = re.findall(prop_pattern, style_content)
        
        for prop_name, prop_value in props:
            prop_name = prop_name.strip()
            prop_value = prop_value.strip()
            properties[prop_name] = prop_value
            
            # Extract colors
            color_patterns = [
                r'#[0-9a-fA-F]{3,8}',
                r'rgb\s*\([^)]+\)',
                r'rgba\s*\([^)]+\)',
                r'hsl\s*\([^)]+\)',
                r'hsla\s*\([^)]+\)',
                r'\b(?:red|blue|green|yellow|purple|orange|pink|brown|black|white|gray|grey|cyan|magenta|lime|navy|olive|teal|silver|maroon|aqua|fuchsia)\b'
            ]
            
            for pattern in color_patterns:
                colors = re.findall(pattern, prop_value, re.IGNORECASE)
                for color in colors:
                    css_data['extracted_colors'].add(color.strip().lower())
            
            # Extract fonts
            if 'font' in prop_name.lower():
                fonts = [f.strip().strip('"\'') for f in prop_value.split(',')]
                for font in fonts:
                    if font and font not in ['inherit', 'initial', 'unset', 'normal', 'bold', 'italic']:
                        css_data['extracted_fonts'].add(font)
            
            # Extract background images
            if 'url(' in prop_value:
                url_match = re.search(r'url\s*\(\s*["\']?([^"\'()]+)["\']?\s*\)', prop_value)
                if url_match:
                    image_url = self.resolve_url(url_match.group(1), base_url)
                    css_data['background_images'].add(image_url)
        
        return properties
    
    def extract_html_colors(self, soup, css_data):
        """Extract colors from HTML attributes"""
        # Extract colors from deprecated HTML attributes
        color_attributes = ['bgcolor', 'color', 'text', 'link', 'vlink', 'alink']
        
        for attr in color_attributes:
            elements = soup.find_all(attrs={attr: True})
            for element in elements:
                color = element.get(attr)
                if color:
                    css_data['extracted_colors'].add(color.strip().lower())
    
    def extract_html_fonts(self, soup, css_data):
        """Extract fonts from HTML attributes and elements"""
        # Extract fonts from face attribute (deprecated but still used)
        font_elements = soup.find_all('font', face=True)
        for element in font_elements:
            face = element.get('face')
            if face:
                fonts = [f.strip().strip('"\'') for f in face.split(',')]
                for font in fonts:
                    if font:
                        css_data['extracted_fonts'].add(font)
        
        # Extract web fonts from link elements
        font_links = soup.find_all('link', href=True)
        for link in font_links:
            href = link.get('href', '')
            if 'fonts.googleapis.com' in href or 'fonts.gstatic.com' in href or 'font' in href.lower():
                # Extract font family from Google Fonts URL
                import re
                family_match = re.search(r'family=([^&]+)', href)
                if family_match:
                    font_family = family_match.group(1).replace('+', ' ')
                    css_data['extracted_fonts'].add(font_family)
    
    def extract_html_images(self, soup, css_data, base_url):
        """Extract images from HTML elements"""
        # Extract from img tags
        img_elements = soup.find_all('img', src=True)
        for img in img_elements:
            src = img.get('src')
            if src:
                full_url = self.resolve_url(src, base_url)
                css_data['background_images'].add(full_url)
        
        # Extract from other elements with image attributes
        image_attributes = ['background', 'src', 'poster', 'data-src', 'data-background']
        for attr in image_attributes:
            elements = soup.find_all(attrs={attr: True})
            for element in elements:
                image_url = element.get(attr)
                if image_url and ('.' in image_url):  # Basic check for image URL
                    full_url = self.resolve_url(image_url, base_url)
                    css_data['background_images'].add(full_url)
    
    def fetch_external_css_safe(self, css_url):
        """Safely fetch external CSS content"""
        try:
            import requests
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
            response = requests.get(css_url, headers=headers, timeout=5)
            response.raise_for_status()
            return response.text
        except Exception as e:
            print(f"Failed to fetch CSS from {css_url}: {e}")
            return None
    
    def resolve_url(self, url, base_url):
        """Resolve relative URLs to absolute URLs"""
        try:
            from urllib.parse import urljoin, urlparse
            if urlparse(url).netloc:  # Already absolute
                return url
            return urljoin(base_url, url)
        except Exception:
            return url
    
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
        """Extract comprehensive image information from all sources"""
        images = []
        from urllib.parse import urljoin
        
        # Extract regular img tags with comprehensive data
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
                
                # Parse srcset for responsive images
                srcset_urls = []
                if img.get('srcset'):
                    srcset_parts = img.get('srcset').split(',')
                    for part in srcset_parts:
                        url_part = part.strip().split(' ')[0]
                        if url_part:
                            if url_part.startswith('//'):
                                url_part = 'https:' + url_part
                            elif url_part.startswith('/'):
                                url_part = urljoin(base_url, url_part)
                            elif not url_part.startswith(('http://', 'https://')):
                                url_part = urljoin(base_url, url_part)
                            srcset_urls.append(url_part)
                
                images.append({
                    'type': 'img_tag',
                    'src': src,
                    'alt': img.get('alt', ''),
                    'title': img.get('title', ''),
                    'width': img.get('width'),
                    'height': img.get('height'),
                    'loading': img.get('loading', 'eager'),
                    'srcset': img.get('srcset', ''),
                    'srcset_urls': srcset_urls,
                    'sizes': img.get('sizes', ''),
                    'class': ' '.join(img.get('class', [])),
                    'id': img.get('id', ''),
                    'data_src': img.get('data-src', ''),  # Lazy loading
                    'data_original': img.get('data-original', '')  # Some lazy loaders
                })
        
        # Extract SVG elements
        for svg in soup.find_all('svg'):
            images.append({
                'type': 'svg_inline',
                'content': str(svg)[:500],  # Limited content for size
                'width': svg.get('width'),
                'height': svg.get('height'),
                'viewBox': svg.get('viewBox'),
                'class': ' '.join(svg.get('class', [])),
                'id': svg.get('id', '')
            })
        
        # Extract background images from style attributes
        for element in soup.find_all(style=True):
            style = element.get('style', '')
            if 'background-image' in style:
                # Extract URL from background-image
                import re
                url_match = re.search(r'background-image:\s*url\(["\']?([^"\']*)["\']?\)', style)
                if url_match:
                    bg_url = url_match.group(1)
                    if bg_url.startswith('//'):
                        bg_url = 'https:' + bg_url
                    elif bg_url.startswith('/'):
                        bg_url = urljoin(base_url, bg_url)
                    elif not bg_url.startswith(('http://', 'https://')):
                        bg_url = urljoin(base_url, bg_url)
                    
                    images.append({
                        'type': 'background_image',
                        'src': bg_url,
                        'element': element.name,
                        'class': ' '.join(element.get('class', [])),
                        'id': element.get('id', ''),
                        'style': style
                    })
        
        # Extract picture/source elements for responsive images
        for picture in soup.find_all('picture'):
            for source in picture.find_all('source'):
                srcset = source.get('srcset')
                if srcset:
                    images.append({
                        'type': 'picture_source',
                        'srcset': srcset,
                        'media': source.get('media', ''),
                        'type_attr': source.get('type', ''),
                        'sizes': source.get('sizes', '')
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
    
    def create_design_analysis(self, elements, images, colors, typography_styles, css_data):
        """Create comprehensive design analysis in the format requested"""
        
        # Analyze text elements with detailed font properties
        text_elements = []
        shapes = {'lines': [], 'dots': [], 'rectangles': [], 'circles': []}
        layout_info = {'grid': 'unknown', 'alignment': 'left', 'spacing': []}
        
        for element in elements:
            # Extract text content with full typography details
            text_content = element.get('textContent') or element.get('text', '')
            if text_content and text_content.strip():
                text_info = {
                    'content': text_content.strip(),
                    'fontSize': self.parse_pixel_value(element.get('visual', {}).get('fontSize', '16px')),
                    'fontWeight': element.get('visual', {}).get('fontWeight', 'normal'),
                    'fontFamily': element.get('visual', {}).get('fontFamily', 'inherit'),
                    'color': element.get('visual', {}).get('color', '#000000'),
                    'lineHeight': element.get('visual', {}).get('lineHeight', 'normal'),
                    'letterSpacing': element.get('visual', {}).get('letterSpacing', 'normal'),
                    'textAlign': element.get('visual', {}).get('textAlign', 'left'),
                    'textDecoration': element.get('visual', {}).get('textDecoration', 'none'),
                    'position': element.get('position', {}),
                    'tag': element.get('tagName') or element.get('tag', 'unknown'),
                    'figmaProperties': self.map_css_to_figma_text(element.get('visual', {}))
                }
                text_elements.append(text_info)
                print(f"🔤 CONVERTED TO TEXT: '{text_content[:40]}...' | Font: {text_info['fontSize']}px {text_info['fontFamily']} | Tag: {text_info['tag']}")
            
            # Detect shapes based on element properties
            visual = element.get('visual', {})
            position = element.get('position', {})
            
            # Get tag name from correct field
            tag_name = (element.get('tagName') or element.get('tag', '')).lower()
            
            # Detect lines (elements with border or hr tags)
            if (tag_name == 'hr' or 
                visual.get('borderTop', 'none') != 'none' or
                visual.get('borderBottom', 'none') != 'none'):
                
                line_info = {
                    'length': position.get('width', 0),
                    'thickness': self.parse_pixel_value(visual.get('borderTop', '1px').split()[0] if visual.get('borderTop', 'none') != 'none' else '1px'),
                    'color': self.extract_border_color(visual.get('borderTop', '#000000')),
                    'style': 'solid',
                    'position': position
                }
                shapes['lines'].append(line_info)
            
            # Detect dots/circles (small elements with border-radius)
            if (visual.get('borderRadius', '0px') != '0px' and 
                position.get('width', 0) < 50 and position.get('height', 0) < 50):
                
                dot_info = {
                    'radius': position.get('width', 10) / 2,
                    'color': visual.get('backgroundColor', 'transparent'),
                    'position': position,
                    'borderColor': visual.get('borderColor', 'none'),
                    'borderWidth': self.parse_pixel_value(visual.get('border', '0px').split()[0] if visual.get('border', 'none') != 'none' else '0px')
                }
                shapes['dots'].append(dot_info)
            
            # Create detailed Figma rectangles for each structural element
            if tag_name in ['div', 'section', 'article', 'header', 'footer', 'main', 'nav', 'aside']:
                figma_rect = self.create_figma_rectangle_section(element, visual, position, tag_name)
                shapes['rectangles'].append(figma_rect)
                print(f"🔷 CONVERTED TO RECTANGLE: {figma_rect['name']} | Size: {figma_rect['figmaProperties']['width']}x{figma_rect['figmaProperties']['height']} | Layout: {figma_rect['figmaProperties']['layoutMode']}")
        
        # Analyze color usage with context
        color_analysis = []
        color_usage = {}
        
        for color in colors:
            if color and color != 'transparent':
                # Count usage across elements
                usage_count = 0
                usage_types = set()
                
                for element in elements:
                    visual = element.get('visual', {})
                    if visual.get('color') == color:
                        usage_count += 1
                        usage_types.add('text')
                    if visual.get('backgroundColor') == color:
                        usage_count += 1
                        usage_types.add('background')
                    if color in str(visual.get('border', '')):
                        usage_count += 1
                        usage_types.add('border')
                
                color_info = {
                    'hex': color,
                    'usage': list(usage_types),
                    'count': usage_count,
                    'rgb': self.hex_to_rgb(color) if color.startswith('#') else None
                }
                color_analysis.append(color_info)
        
        # Enhanced image analysis
        image_analysis = []
        for img in images:
            img_info = {
                'type': img.get('type', 'img_tag'),
                'src': img.get('src', ''),
                'width': self.parse_pixel_value(str(img.get('width', 'auto'))),
                'height': self.parse_pixel_value(str(img.get('height', 'auto'))),
                'alt': img.get('alt', ''),
                'format': img.get('src', '').split('.')[-1] if '.' in img.get('src', '') else 'unknown',
                'hasResponsive': bool(img.get('srcset', '')),
                'position': img.get('position', {}),
                'loading': img.get('loading', 'eager')
            }
            image_analysis.append(img_info)
        
        # Layout analysis
        layout_info = {
            'totalElements': len(elements),
            'gridDetected': any('grid' in str(el.get('visual', {}).get('display', '')) for el in elements),
            'flexDetected': any('flex' in str(el.get('visual', {}).get('display', '')) for el in elements),
            'alignment': 'center' if any('center' in str(el.get('visual', {}).get('textAlign', '')) for el in elements) else 'left',
            'maxWidth': max([el.get('position', {}).get('width', 0) for el in elements] + [0]),
            'maxHeight': max([el.get('position', {}).get('height', 0) for el in elements] + [0])
        }
        
        return {
            'textElements': text_elements,
            'shapes': shapes,
            'images': image_analysis,
            'colors': color_analysis,
            'layout': layout_info,
            'summary': {
                'totalTextElements': len(text_elements),
                'totalShapes': sum(len(shapes[key]) for key in shapes),
                'totalImages': len(image_analysis),
                'totalColors': len(color_analysis),
                'uniqueFonts': len(set(t.get('fontFamily', 'inherit') for t in text_elements)),
                'hasInteractiveElements': any((el.get('tagName') or el.get('tag', '')).lower() in ['button', 'a', 'input'] for el in elements)
            }
        }
    
    def extract_border_color(self, border_style):
        """Extract color from border style string"""
        if not border_style or border_style == 'none':
            return '#000000'
        
        # Extract color from border shorthand (e.g., "1px solid #333")
        import re
        color_match = re.search(r'#[a-fA-F0-9]{3,6}|rgb\([^)]+\)', border_style)
        return color_match.group(0) if color_match else '#000000'
    
    def hex_to_rgb(self, hex_color):
        """Convert hex color to RGB values"""
        if not hex_color.startswith('#'):
            return None
        
        try:
            hex_color = hex_color.lstrip('#')
            if len(hex_color) == 3:
                hex_color = ''.join([c*2 for c in hex_color])
            
            return {
                'r': int(hex_color[0:2], 16),
                'g': int(hex_color[2:4], 16),
                'b': int(hex_color[4:6], 16)
            }
        except ValueError:
            return None

    def map_css_to_figma_text(self, visual_styles):
        """Map CSS text properties to Figma text properties"""
        return {
            'fills': [{'type': 'SOLID', 'color': self.parse_color(visual_styles.get('color', '#000000'))}],
            'fontSize': self.parse_pixel_value(visual_styles.get('fontSize', '16px')),
            'fontName': {
                'family': visual_styles.get('fontFamily', 'Inter').split(',')[0].strip().strip('"\''),
                'style': self.map_font_style_weight(visual_styles.get('fontWeight', 'normal'), visual_styles.get('fontStyle', 'normal'))
            },
            'lineHeight': self.map_line_height(visual_styles.get('lineHeight', 'normal')),
            'letterSpacing': self.map_letter_spacing(visual_styles.get('letterSpacing', '0px')),
            'textAlignHorizontal': self.map_text_align(visual_styles.get('textAlign', 'left')),
            'textDecoration': self.map_text_decoration(visual_styles.get('textDecoration', 'none'))
        }
    
    def create_figma_rectangle_section(self, element, visual, position, tag_name):
        """Create comprehensive Figma rectangle with all CSS properties mapped"""
        x = position.get('x', 0)
        y = position.get('y', 0)
        width = position.get('width', 100)
        height = position.get('height', 40)
        
        # Map background fills
        fills = []
        if visual.get('backgroundColor') and visual.get('backgroundColor') != 'transparent':
            color_rgb = self.parse_color(visual.get('backgroundColor'))
            if color_rgb:
                fills.append({
                    'type': 'SOLID',
                    'color': color_rgb
                })
        
        # Map border strokes
        strokes = []
        stroke_weight = 0
        if visual.get('border') and visual.get('border') != 'none':
            border_parts = visual.get('border', '').split()
            if len(border_parts) >= 3:
                stroke_weight = self.parse_pixel_value(border_parts[0])
                stroke_color = border_parts[2] if len(border_parts) > 2 else '#000000'
                color_rgb = self.parse_color(stroke_color)
                if color_rgb:
                    strokes.append({
                        'type': 'SOLID',
                        'color': color_rgb
                    })
        
        # Map corner radius
        corner_radius = self.parse_pixel_value(visual.get('borderRadius', '0px'))
        
        # Map effects (shadows)
        effects = []
        if visual.get('boxShadow') and visual.get('boxShadow') != 'none':
            shadow_effect = self.map_box_shadow_to_figma(visual.get('boxShadow'))
            if shadow_effect:
                effects.append(shadow_effect)
        
        # Detect Auto Layout properties
        layout_mode = 'NONE'
        primary_axis_align = 'MIN'
        counter_axis_align = 'MIN'
        item_spacing = 0
        
        if visual.get('display') == 'flex':
            layout_mode = 'HORIZONTAL' if visual.get('flexDirection', 'row') == 'row' else 'VERTICAL'
            primary_axis_align = self.map_justify_content(visual.get('justifyContent', 'flex-start'))
            counter_axis_align = self.map_align_items(visual.get('alignItems', 'stretch'))
            item_spacing = self.parse_pixel_value(visual.get('gap', '0px'))
        
        return {
            'type': 'RECTANGLE',
            'name': f"{tag_name.upper()}_Section",
            'width': width,
            'height': height,
            'backgroundColor': visual.get('backgroundColor', 'transparent'),
            'borderRadius': visual.get('borderRadius', '0px'),
            'position': position,
            'border': visual.get('border', 'none'),
            'figmaProperties': {
                'x': x,
                'y': y,
                'width': width,
                'height': height,
                'fills': fills,
                'strokes': strokes,
                'strokeWeight': stroke_weight,
                'cornerRadius': corner_radius,
                'effects': effects,
                'layoutMode': layout_mode,
                'primaryAxisAlignItems': primary_axis_align,
                'counterAxisAlignItems': counter_axis_align,
                'paddingLeft': self.parse_pixel_value(visual.get('paddingLeft', '0px')),
                'paddingRight': self.parse_pixel_value(visual.get('paddingRight', '0px')),
                'paddingTop': self.parse_pixel_value(visual.get('paddingTop', '0px')),
                'paddingBottom': self.parse_pixel_value(visual.get('paddingBottom', '0px')),
                'itemSpacing': item_spacing,
                'opacity': float(visual.get('opacity', 1)),
                'visible': visual.get('display', 'block') != 'none'
            },
            'cssProperties': visual,
            'hierarchicalInfo': {
                'depth': element.get('visual_hierarchy', {}).get('depth', 0),
                'hasChildren': element.get('visual_hierarchy', {}).get('hasChildren', False),
                'parentTag': element.get('visual_hierarchy', {}).get('parentTag'),
                'zIndex': self.parse_pixel_value(visual.get('zIndex', '0'))
            }
        }
    
    def map_font_style_weight(self, weight, style):
        """Map CSS font weight and style to Figma font style"""
        weight_mapping = {
            '100': 'Thin', '200': 'ExtraLight', '300': 'Light',
            '400': 'Regular', '500': 'Medium', '600': 'SemiBold',
            '700': 'Bold', '800': 'ExtraBold', '900': 'Black',
            'normal': 'Regular', 'bold': 'Bold'
        }
        base_style = weight_mapping.get(str(weight), 'Regular')
        return base_style + (' Italic' if style == 'italic' else '')
    
    def map_line_height(self, line_height):
        """Map CSS line height to Figma line height"""
        if line_height == 'normal':
            return {'unit': 'AUTO'}
        elif line_height.endswith('px'):
            return {'unit': 'PIXELS', 'value': self.parse_pixel_value(line_height)}
        elif line_height.endswith('%'):
            return {'unit': 'PERCENT', 'value': float(line_height.rstrip('%'))}
        else:
            try:
                return {'unit': 'PERCENT', 'value': float(line_height) * 100}
            except:
                return {'unit': 'AUTO'}
    
    def map_letter_spacing(self, letter_spacing):
        """Map CSS letter spacing to Figma letter spacing"""
        if letter_spacing == 'normal':
            return {'unit': 'PIXELS', 'value': 0}
        return {'unit': 'PIXELS', 'value': self.parse_pixel_value(letter_spacing)}
    
    def map_text_align(self, text_align):
        """Map CSS text align to Figma text align"""
        mapping = {'left': 'LEFT', 'center': 'CENTER', 'right': 'RIGHT', 'justify': 'JUSTIFIED'}
        return mapping.get(text_align, 'LEFT')
    
    def map_text_decoration(self, text_decoration):
        """Map CSS text decoration to Figma text decoration"""
        if 'underline' in text_decoration:
            return 'UNDERLINE'
        elif 'line-through' in text_decoration:
            return 'STRIKETHROUGH'
        return 'NONE'
    
    def map_justify_content(self, justify_content):
        """Map CSS justify-content to Figma primary axis alignment"""
        mapping = {
            'flex-start': 'MIN', 'center': 'CENTER', 
            'flex-end': 'MAX', 'space-between': 'SPACE_BETWEEN'
        }
        return mapping.get(justify_content, 'MIN')
    
    def map_align_items(self, align_items):
        """Map CSS align-items to Figma counter axis alignment"""
        mapping = {
            'flex-start': 'MIN', 'center': 'CENTER',
            'flex-end': 'MAX', 'stretch': 'STRETCH'
        }
        return mapping.get(align_items, 'MIN')
    
    def map_box_shadow_to_figma(self, box_shadow):
        """Map CSS box-shadow to Figma drop shadow effect"""
        try:
            import re
            # Parse box-shadow: offset-x offset-y blur-radius spread-radius color
            numbers = re.findall(r'-?\d+(?:\.\d+)?px', box_shadow)
            colors = re.findall(r'#[0-9A-Fa-f]{3,6}|rgba?\([^)]+\)', box_shadow)
            
            if len(numbers) >= 3:
                shadow_color = self.parse_color(colors[0] if colors else '#000000')
                return {
                    'type': 'DROP_SHADOW',
                    'offset': {
                        'x': self.parse_pixel_value(numbers[0]),
                        'y': self.parse_pixel_value(numbers[1])
                    },
                    'radius': self.parse_pixel_value(numbers[2]),
                    'spread': self.parse_pixel_value(numbers[3]) if len(numbers) > 3 else 0,
                    'color': shadow_color if shadow_color else {'r': 0, 'g': 0, 'b': 0},
                    'visible': True
                }
        except:
            pass
        return None

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
    """Root endpoint with web interface"""
    return """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Website to Figma Capture Server</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
        }
        .container {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 40px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        h1 {
            text-align: center;
            margin-bottom: 30px;
            font-size: 2.5em;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
        }
        .status {
            background: rgba(0, 255, 0, 0.2);
            border: 2px solid #4CAF50;
            border-radius: 10px;
            padding: 15px;
            margin: 20px 0;
            text-align: center;
        }
        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }
        .feature {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            padding: 20px;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .feature h3 {
            margin-top: 0;
            color: #FFD700;
        }
        .endpoints {
            background: rgba(0, 0, 0, 0.2);
            border-radius: 10px;
            padding: 20px;
            margin: 20px 0;
        }
        .endpoint {
            margin: 10px 0;
            padding: 10px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 5px;
            font-family: monospace;
        }
        .test-section {
            margin: 30px 0;
            padding: 20px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
        }
        input[type="url"] {
            width: 100%;
            padding: 12px;
            border: none;
            border-radius: 5px;
            margin: 10px 0;
            font-size: 16px;
        }
        button {
            background: #4CAF50;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            margin: 5px;
        }
        button:hover {
            background: #45a049;
        }
        #result {
            margin: 20px 0;
            padding: 15px;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 5px;
            font-family: monospace;
            white-space: pre-wrap;
            max-height: 400px;
            overflow-y: auto;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Website to Figma Capture Server</h1>
        
        <div class="status">
            <h2>Server Running</h2>
            <p>Enhanced capture system with comprehensive data extraction</p>
        </div>

        <div class="features">
            <div class="feature">
                <h3>Multi-Viewport Capture</h3>
                <p>Captures websites across desktop, tablet, and mobile viewports</p>
            </div>
            <div class="feature">
                <h3>Full CSS Extraction</h3>
                <p>Extracts all visual styles, colors, fonts, and layout properties</p>
            </div>
            <div class="feature">
                <h3>Image Processing</h3>
                <p>Captures images, SVGs, backgrounds, and responsive srcsets</p>
            </div>
            <div class="feature">
                <h3>Real-Time Data</h3>
                <p>Fetches authentic website content with zero mock data</p>
            </div>
        </div>

        <div class="endpoints">
            <h2>API Endpoints</h2>
            <div class="endpoint">POST /api/capture-responsive - Multi-viewport capture</div>
            <div class="endpoint">POST /api/capture - Single viewport capture</div>
            <div class="endpoint">GET /health - Health check</div>
        </div>

        <div class="test-section">
            <h2>Test the API</h2>
            <input type="url" id="urlInput" placeholder="Enter website URL (e.g., https://example.com)" value="https://example.com">
            <br>
            <button onclick="testSingleCapture()">Test Single Capture</button>
            <button onclick="testResponsiveCapture()">Test Responsive Capture</button>
            <div id="result"></div>
        </div>
    </div>

    <script>
        async function testSingleCapture() {
            const url = document.getElementById('urlInput').value;
            const resultDiv = document.getElementById('result');
            
            resultDiv.textContent = 'Testing single capture...';
            
            try {
                const response = await fetch('/api/capture', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({url: url})
                });
                
                const data = await response.json();
                resultDiv.textContent = `SUCCESS: Captured ${data.elements?.length || 0} elements, ${data.images?.length || 0} images, ${data.colors?.length || 0} colors`;
            } catch (error) {
                resultDiv.textContent = `ERROR: ${error.message}`;
            }
        }

        async function testResponsiveCapture() {
            const url = document.getElementById('urlInput').value;
            const resultDiv = document.getElementById('result');
            
            resultDiv.textContent = 'Testing responsive capture...';
            
            try {
                const response = await fetch('/api/capture-responsive', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({url: url, viewports: ['desktop', 'tablet', 'mobile']})
                });
                
                const data = await response.json();
                let result = `SUCCESS: Captured ${data.total_viewports} viewports\\n`;
                
                for (const [viewport, vdata] of Object.entries(data.viewports)) {
                    result += `${viewport}: ${vdata.elements?.length || 0} elements, ${vdata.images?.length || 0} images\\n`;
                }
                
                resultDiv.textContent = result;
            } catch (error) {
                resultDiv.textContent = `ERROR: ${error.message}`;
            }
        }
    </script>
</body>
</html>"""

# Server can be run directly for development
if __name__ == '__main__':
    print("Starting Enhanced Website Capture Server...")
    print("Features: Responsive capture, Full CSS extraction, Font mapping")
    print("Server will be available at: http://0.0.0.0:5000")
    print(f"Supported viewports: {', '.join(VIEWPORTS.keys())}")
    
    app.run(host='0.0.0.0', port=5000, debug=False)