const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

/**
 * Navigate to product through categories
 * @param {Page} page - Playwright page object
 * @param {Object} product - Product object
 */
async function navigateThroughCategories(page, product) {
  console.log(`   📂 Step 1: Navigating to Blinds category...`);
  
  // Navigate to blinds category page
  await page.goto('https://www.lowes.com/c/Blinds-window-treatments', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });
  await page.waitForTimeout(3000);
  
  // Check for access denied
  const categoryCheck = await page.evaluate(() => {
    return {
      title: document.title,
      bodyText: document.body?.textContent?.substring(0, 200) || ''
    };
  });
  
  if (categoryCheck.title.includes('Access Denied') || categoryCheck.bodyText.includes('Access Denied')) {
    console.log(`   ⚠️  Access denied on category page - trying direct product navigation...`);
    await page.goto(product.url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    return;
  }
  
  console.log(`   📂 Step 2: Navigating to product page from category...`);
  
  // Try to find and click product link in category, or navigate directly
  const omniItemId = product.url.split('omniItemId=')[1]?.split('&')[0];
  
  // Look for product link in category page
  const productLinkFound = await page.evaluate((omniItemId) => {
    const links = Array.from(document.querySelectorAll('a[href]'));
    for (const link of links) {
      const href = link.getAttribute('href') || '';
      if (href.includes(omniItemId) || (href.includes('configure/blinds') && href.includes(omniItemId))) {
        link.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return true;
      }
    }
    return false;
  }, omniItemId);
  
  if (productLinkFound) {
    console.log(`   👆 Clicking product link from category page...`);
    try {
      await page.click(`a[href*="${omniItemId}"]`, { timeout: 5000 });
      await page.waitForTimeout(3000);
      console.log(`   ✓ Clicked product from category`);
    } catch (e) {
      // If click fails, navigate directly
      console.log(`   🔗 Click failed, navigating directly to product...`);
      await page.goto(product.url, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
    }
  } else {
    // If product not found in category, navigate directly
    console.log(`   🔗 Product not found in category, navigating directly...`);
    await page.goto(product.url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
  }
  
  await page.waitForTimeout(2000);
}

/**
 * Test a single Lowe's product page
 * @param {Object} product - Product object with url, name, model
 * @param {Object} options - Testing options
 * @returns {Promise<Object>} Test result with prices and screenshot path
 */
async function testProduct(product, options = {}) {
  const { 
    width = null, 
    height = null, 
    color = null,
    screenshotDir = path.join(__dirname, '..', 'screenshots'),
    shouldStop = () => false,
    headless = false, // Default to visible for single product tests
    sharedPage = null, // Optional: shared page for sequential testing
    sharedContext = null, // Optional: shared context for sequential testing
    keepBrowserOpen = false // If true, don't close browser after test
  } = options;
  
  // Check if we should stop
  if (shouldStop()) {
    throw new Error('Testing stopped by user');
  }

  // Ensure screenshot directory exists
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  let browser, localContext, localPage;
  let connectedToExisting = false;
  let usingSharedContext = false;
  
  // If sharedPage and sharedContext are provided, use them (for sequential testing)
  if (sharedPage && sharedContext) {
    localPage = sharedPage;
    localContext = sharedContext;
    usingSharedContext = true;
    connectedToExisting = true; // Assume we're using existing connection
    console.log('   ✓ Using shared browser context for sequential testing');
  } else {
    // Create new browser/context
    try {
      // Strategy 1: Try to connect to existing Chrome instance (opens in new tab)
      console.log('   🔌 Attempting to connect to Chrome on port 9222...');
      
      // Try both localhost and 127.0.0.1
      let connectionError = null;
      try {
        browser = await chromium.connectOverCDP('http://localhost:9222');
      } catch (e1) {
        connectionError = e1;
        console.log(`   ⚠️  localhost failed: ${e1.message}, trying 127.0.0.1...`);
        try {
          browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
        } catch (e2) {
          connectionError = e2;
          throw e2; // Re-throw to trigger fallback
        }
      }
      
      connectedToExisting = true;
      console.log('   ✓ Connected to existing Chrome instance');
      
      // Get all contexts - manually opened tabs are usually in the default context
      const contexts = browser.contexts();
      console.log(`   📋 Found ${contexts.length} context(s)`);
      
      // First, try to find a page with the product URL in any context
      let foundPage = null;
      let foundContext = null;
      
      for (const ctx of contexts) {
        try {
          const pages = ctx.pages();
          console.log(`   🔍 Checking context with ${pages.length} page(s)...`);
          
          for (const p of pages) {
            try {
              const url = p.url();
              console.log(`      - Page URL: ${url.substring(0, 80)}...`);
              
              // Check if this page matches the product URL
              if (url.includes('lowes.com/configure') || 
                  url.includes(product.url) ||
                  (url.includes('lowes.com') && url.includes(product.url.split('?')[0]))) {
                foundPage = p;
                foundContext = ctx;
                console.log(`   ✅ Found existing tab with product page!`);
                break;
              }
            } catch (e) {
              // Page might be closed or inaccessible, skip it
            }
          }
          
          if (foundPage) break;
        } catch (e) {
          console.log(`   ⚠️  Error checking context: ${e.message}`);
        }
      }
      
      if (foundPage && foundContext) {
        // Verify the found page actually contains lowes.com
        try {
          const foundUrl = foundPage.url();
          if (foundUrl.includes('lowes.com')) {
            // Use the existing page and context
            localPage = foundPage;
            localContext = foundContext;
            console.log('   ✓ Using existing tab with Lowe\'s product page');
          } else {
            // Found page doesn't have lowes.com - create new tab instead
            console.log('   ⚠️  Found page does not contain lowes.com, creating new tab');
            if (contexts.length > 0) {
              localContext = contexts[0];
            } else {
              localContext = await browser.newContext({
                viewport: { width: 1920, height: 1080 },
                userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                locale: 'en-US',
                timezoneId: 'America/New_York',
                permissions: ['geolocation'],
                geolocation: { longitude: -74.006, latitude: 40.7128 },
                colorScheme: 'light',
                extraHTTPHeaders: {
                  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                  'Accept-Language': 'en-US,en;q=0.9',
                  'Accept-Encoding': 'gzip, deflate, br',
                  'Connection': 'keep-alive',
                  'Upgrade-Insecure-Requests': '1'
                }
              });
            }
            localPage = await localContext.newPage();
            console.log('   ✓ Created new tab for testing');
          }
        } catch (e) {
          // Error checking URL - create new tab to be safe
          console.log('   ⚠️  Error checking found page URL, creating new tab');
          if (contexts.length > 0) {
            localContext = contexts[0];
          } else {
            localContext = await browser.newContext({
              viewport: { width: 1920, height: 1080 },
              userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              locale: 'en-US',
              timezoneId: 'America/New_York',
              permissions: ['geolocation'],
              geolocation: { longitude: -74.006, latitude: 40.7128 },
              colorScheme: 'light',
              extraHTTPHeaders: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
              }
            });
          }
          localPage = await localContext.newPage();
          console.log('   ✓ Created new tab for testing');
        }
      } else {
        // No matching tab found - check existing pages for lowes.com
        let hasLowesPage = false;
        let lowesContext = null;
        let lowesPage = null;
        
        // Check all contexts and pages for any lowes.com page
        for (const ctx of contexts) {
          try {
            const pages = ctx.pages();
            for (const p of pages) {
              try {
                const url = p.url();
                if (url.includes('lowes.com')) {
                  hasLowesPage = true;
                  lowesContext = ctx;
                  lowesPage = p;
                  break;
                }
              } catch (e) {
                // Skip inaccessible pages
              }
            }
            if (hasLowesPage) break;
          } catch (e) {
            // Skip inaccessible contexts
          }
        }
        
        if (hasLowesPage && lowesPage && lowesContext) {
          // Found a lowes.com page - use it
          localPage = lowesPage;
          localContext = lowesContext;
          console.log('   ✓ Using existing Lowe\'s page');
        } else {
          // No lowes.com page found - create new tab
          if (contexts.length > 0) {
            localContext = contexts[0]; // Use default context (where manually opened tabs are)
            console.log('   ✓ Using default Chrome context, creating new tab');
          } else {
            // No contexts available, create one (shouldn't happen, but just in case)
            localContext = await browser.newContext({
              viewport: { width: 1920, height: 1080 },
              userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              locale: 'en-US',
              timezoneId: 'America/New_York',
              permissions: ['geolocation'],
              geolocation: { longitude: -74.006, latitude: 40.7128 },
              colorScheme: 'light',
              extraHTTPHeaders: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
              }
            });
            console.log('   ✓ Created new context in existing Chrome');
          }
          
          // Always create a new page - don't reuse non-Lowe's pages
          localPage = await localContext.newPage();
          console.log('   ✓ Created new tab for testing (no Lowe\'s page found)');
        }
      }
    } catch (cdpError) {
      // Strategy 2: Launch new Chrome instance
      console.log(`   ⚠️  Could not connect to Chrome on port 9222: ${cdpError.message}`);
      console.log('   ℹ️  Launching new Chrome instance instead...');
      console.log('   💡 Tip: To open in tabs, start Chrome with: chrome --remote-debugging-port=9222');
      console.log('   💡 Make sure Chrome is completely closed before starting with remote debugging');
      
      browser = await chromium.launch({ 
        headless: headless,
        channel: 'chrome',
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--no-first-run'
        ]
      });
      
      // Create browser context with realistic settings
      localContext = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'en-US',
        timezoneId: 'America/New_York',
        permissions: ['geolocation'],
        geolocation: { longitude: -74.006, latitude: 40.7128 },
        colorScheme: 'light',
        extraHTTPHeaders: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Cache-Control': 'max-age=0',
          'DNT': '1',
          'Referer': 'https://www.google.com/'
        }
      });
      
      localPage = await localContext.newPage();
    }
  }
  
  // Use localPage and localContext for the rest of the function
  // Create const references for use in the function
  const page = localPage;
  const context = localContext;
  
  if (!page || !context) {
    console.error('   ❌ Failed to create browser/page');
    result.error = 'Failed to create browser/page';
    return result;
  }
  
  // Remove webdriver property to avoid detection
  await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
      
      // Override the plugins property to use a custom getter
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      
      // Override the languages property to use a custom getter
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
      
      // Override chrome property
      window.chrome = {
        runtime: {},
      };
      
      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
    });
    
  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(60000);

  // Format product name: add " shutters" to French door products
  let productName = product.name || product.model || 'Unknown Product';
  if (productName && productName.toLowerCase().includes('french door') && !productName.toLowerCase().includes('shutters')) {
    productName = productName + ' Shutters';
  }

  const result = {
    success: false,
    product_name: productName,
    product_url: product.url,
    model: product.model,
    width: null,
    height: null,
    color: null,
    original_price: null,
    promotional_price: null,
    promo_percentage: null,
    screenshot_path: null,
    error: null
  };

  try {
    console.log(`\n🔍 Testing product: ${product.name}`);
    console.log(`   URL: ${product.url}`);

    // Check current URL - if already on product page, we're good
    const currentUrl = page.url();
    console.log(`   📍 Current page URL: ${currentUrl.substring(0, 100)}...`);
    
    // Check if we're already on the product page
    const isOnProductPage = currentUrl.includes('lowes.com/configure') || 
                            currentUrl.includes(product.url) ||
                            (currentUrl.includes('lowes.com') && currentUrl.includes(product.url.split('?')[0]));
    
    if (isOnProductPage) {
      console.log(`   ✅ Already on product page - ready to test!`);
    } else {
      // Navigate to product page
      console.log(`   🛒 Navigating to product page...`);
      try {
        await page.goto(product.url, {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });
        await page.waitForTimeout(3000);
        console.log(`   ✅ Navigated to product page`);
      } catch (e) {
        console.log(`   ⚠️  Navigation error: ${e.message}`);
        throw new Error(`Failed to navigate to product: ${e.message}`);
      }
    }
    
    // Wait for page to fully load and check for access denied
    await page.waitForTimeout(2000);
    
    const pageCheck = await page.evaluate(() => {
      return {
        title: document.title,
        bodyText: document.body?.textContent?.substring(0, 200) || '',
        url: window.location.href
      };
    });
    
    if (pageCheck.title.includes('Access Denied') || pageCheck.bodyText.includes('Access Denied')) {
      console.log(`   ⚠️  Access denied detected on product page`);
      throw new Error('Access denied on product page');
    }
    
    console.log(`   ✅ Product page loaded successfully`);
    
    // Wait for page to fully load before starting interactions
    await page.waitForTimeout(3000);
    
    // Scroll to top to ensure we can see configuration options
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);
    
    console.log(`   🔧 Starting product configuration (width, height, color)...`);
    
    // Simulate human-like behavior: scroll and mouse movement
    try {
      // Random scroll to simulate reading the page
      await page.evaluate(() => {
        window.scrollTo(0, Math.random() * 800);
      });
      await page.waitForTimeout(1000 + Math.random() * 1000);
      
      // Scroll back up a bit
      await page.evaluate(() => {
        window.scrollTo(0, Math.random() * 400);
      });
      await page.waitForTimeout(500 + Math.random() * 500);
      
      // Move mouse to simulate human interaction
      await page.mouse.move(Math.random() * 800, Math.random() * 600);
      await page.waitForTimeout(500);
    } catch (e) {
      // Ignore errors from mouse/scroll simulation
    }
    
    // Check if we got an access denied page (re-check after navigation)
    // Don't throw error - just log it and continue (browser stays open)
    const productPageTitle = await page.title();
    const productPageUrl = page.url();
    const productPageContent = await page.content();
    
    const isProductPageDenied = productPageTitle.includes('Access Denied') || 
                                productPageContent.includes('Access Denied') || 
                                productPageContent.includes('errors.edgesuite.net') ||
                                productPageUrl.includes('errors.edgesuite.net') ||
                                productPageContent.includes('Reference #');
    
    if (isProductPageDenied) {
      console.log(`   ⚠️  Access denied on product page - browser will remain open for manual review`);
      result.error = 'Access Denied: Lowe\'s is blocking automated access. Browser window remains open for manual review.';
      // Don't throw - continue with what we can do (browser stays open)
    }
    
    // Additional check: look for common access denied indicators
    const hasAccessDenied = await page.evaluate(() => {
      const bodyText = document.body?.textContent || '';
      return bodyText.includes('Access Denied') || 
             bodyText.includes('You don\'t have permission') ||
             document.querySelector('h1')?.textContent?.includes('Access Denied');
    });
    
    if (hasAccessDenied && !result.error) {
      console.log(`   ⚠️  Access denied detected - browser will remain open for manual review`);
      result.error = 'Access Denied: Lowe\'s is blocking automated access. Browser window remains open for manual review.';
      // Don't throw - continue (browser stays open)
    }

    // Select random width if not provided (18-84)
    let selectedWidth = width;
    if (!selectedWidth) {
      selectedWidth = Math.floor(Math.random() * (84 - 18 + 1)) + 18;
    }

    // Select random height if not provided (16-84)
    let selectedHeight = height;
    if (!selectedHeight) {
      selectedHeight = Math.floor(Math.random() * (84 - 16 + 1)) + 16;
    }

    result.width = selectedWidth;
    result.height = selectedHeight;

    console.log(`   Selected dimensions: ${selectedWidth}" x ${selectedHeight}"`);

    // Try to find and select width
    try {
      // Common selectors for width dropdown
      const widthSelectors = [
        'select[name*="width" i]',
        'select[id*="width" i]',
        'select[aria-label*="width" i]',
        'select[data-testid*="width" i]',
        'select:has(option:contains("Width"))',
        'select:first-of-type'
      ];

      let widthSelected = false;
      for (const selector of widthSelectors) {
        try {
          const widthSelect = await page.$(selector);
          if (widthSelect) {
            await widthSelect.selectOption({ value: selectedWidth.toString() });
            await page.waitForTimeout(1000);
            widthSelected = true;
            console.log(`   ✓ Width selected: ${selectedWidth}"`);
            break;
          }
        } catch (e) {
          // Try next selector
        }
      }

      // If dropdown not found, try clicking on width options
      if (!widthSelected) {
        const widthButtons = await page.$$('button, a, span, div');
        for (const btn of widthButtons.slice(0, 50)) {
          const text = await btn.textContent();
          if (text && text.includes(selectedWidth.toString()) && (text.includes('"') || text.includes('Width'))) {
            await btn.click();
            await page.waitForTimeout(1000);
            widthSelected = true;
            console.log(`   ✓ Width clicked: ${selectedWidth}"`);
            break;
          }
        }
      }
    } catch (error) {
      console.log(`   ⚠️  Could not select width: ${error.message}`);
    }

    // Try to find and select height
    try {
      const heightSelectors = [
        'select[name*="height" i]',
        'select[id*="height" i]',
        'select[aria-label*="height" i]',
        'select[data-testid*="height" i]',
        'select:has(option:contains("Height"))',
        'select:nth-of-type(2)'
      ];

      let heightSelected = false;
      for (const selector of heightSelectors) {
        try {
          const heightSelect = await page.$(selector);
          if (heightSelect) {
            await heightSelect.selectOption({ value: selectedHeight.toString() });
            await page.waitForTimeout(1000);
            heightSelected = true;
            console.log(`   ✓ Height selected: ${selectedHeight}"`);
            break;
          }
        } catch (e) {
          // Try next selector
        }
      }

      // If dropdown not found, try clicking on height options
      if (!heightSelected) {
        const heightButtons = await page.$$('button, a, span, div');
        for (const btn of heightButtons.slice(0, 50)) {
          const text = await btn.textContent();
          if (text && text.includes(selectedHeight.toString()) && (text.includes('"') || text.includes('Height'))) {
            await btn.click();
            await page.waitForTimeout(1000);
            heightSelected = true;
            console.log(`   ✓ Height clicked: ${selectedHeight}"`);
            break;
          }
        }
      }
    } catch (error) {
      console.log(`   ⚠️  Could not select height: ${error.message}`);
    }

    // Wait for price to update after dimension selection
    await page.waitForTimeout(2000);

    // Try to select a color from the grid of swatches
    // Look specifically for color swatch buttons/images, not generic clickable elements
    try {
      await page.waitForTimeout(2000);
      
      console.log(`   🎨 Looking for color swatches...`);
      
      // More specific approach: Look for actual color swatch elements
      const colorSwatches = await page.evaluate(() => {
        const swatches = [];
        
        // Find elements that are likely color swatches:
        // 1. Elements with color swatch images
        // 2. Elements in a color selection grid
        // 3. Elements with aria-label containing "color" and an image
        // 4. Buttons/divs with class containing "swatch" or "color" AND have an image
        
        const allElements = Array.from(document.querySelectorAll('button, div[role="button"], [class*="swatch"], [class*="color"]'));
        
        allElements.forEach(el => {
          // Must have an image (color swatch visual)
          const hasImage = el.querySelector('img') || 
                          el.style.backgroundImage || 
                          window.getComputedStyle(el).backgroundImage !== 'none';
          
          if (!hasImage) return; // Skip if no visual swatch
          
          const text = (el.textContent || '').trim();
          const className = (el.className || '').toLowerCase();
          const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
          
          // Exclude common non-color elements
          const excludePatterns = [
            'credit', 'center', 'card', 'payment', 'checkout', 'cart',
            'filter', 'search', 'select all', 'choose', 'apply',
            'sign in', 'login', 'account', 'help', 'support'
          ];
          
          const shouldExclude = excludePatterns.some(pattern => 
            text.toLowerCase().includes(pattern) || 
            ariaLabel.includes(pattern) ||
            className.includes(pattern)
          );
          
          if (shouldExclude) return;
          
          // Look for color-like names (short, descriptive)
          // Examples: "Cream", "Granite", "Ivory Mist", "Off White"
          if (text && text.length >= 3 && text.length <= 25) {
            // Check if it looks like a color name
            const isColorName = !text.match(/^\d+$/) && // Not just numbers
                               text.split(' ').length <= 3 && // Max 3 words
                               !text.match(/^(Filter|Search|Select|Choose|View|See|More|Less)$/i);
            
            if (isColorName) {
              // Check if it's in a color selection area
              const parent = el.closest('[class*="color"], [class*="swatch"], [class*="option"]');
              const isInColorArea = parent !== null || 
                                   className.includes('swatch') || 
                                   className.includes('color') ||
                                   ariaLabel.includes('color');
              
              if (isInColorArea) {
                swatches.push({
                  name: text.split('\n')[0].trim(),
                  element: el,
                  hasImage: true
                });
              }
            }
          }
        });
        
        return swatches.slice(0, 30); // Limit to first 30
      });
      
      if (colorSwatches && colorSwatches.length > 0) {
        // Select a random color swatch
        const randomIndex = Math.floor(Math.random() * colorSwatches.length);
        const selectedSwatch = colorSwatches[randomIndex];
        const colorName = selectedSwatch.name;
        
        console.log(`   🎨 Found ${colorSwatches.length} color swatches, selecting: "${colorName}"`);
        
        // Find and click the specific swatch element
        const swatchElements = await page.$$('button, div[role="button"], [class*="swatch"], [class*="color"]');
        
        for (const el of swatchElements) {
          try {
            const text = await el.textContent();
            const ariaLabel = await el.getAttribute('aria-label') || '';
            const hasImage = await el.$('img') !== null;
            
            // Match by exact color name and ensure it has an image
            if (hasImage && text && (
                text.trim().includes(colorName) || 
                text.trim().startsWith(colorName) ||
                ariaLabel.includes(colorName.toLowerCase())
            )) {
              // Exclude non-color elements
              const lowerText = text.toLowerCase();
              if (lowerText.includes('credit') || lowerText.includes('center') || 
                  lowerText.includes('card') || lowerText.includes('payment')) {
                continue; // Skip this one
              }
              
              await el.scrollIntoViewIfNeeded();
              await page.waitForTimeout(500);
              
              await el.click({ timeout: 5000 });
              await page.waitForTimeout(2000);
              
              result.color = colorName;
              console.log(`   ✓ Color selected: ${result.color}`);
              break;
            }
          } catch (clickError) {
            // Try next element
            continue;
          }
        }
      }
      
      // Fallback: Try to find any clickable element with a color-like name
      if (!result.color) {
        const allClickable = await page.$$('button, a, div[role="button"]');
        const colorNames = ['Cream', 'Granite', 'Ivory', 'White', 'Pebble', 'Beige', 'Gray', 'Black', 'Brown'];
        
        for (const colorName of colorNames) {
          for (const el of allClickable.slice(0, 100)) {
            const text = await el.textContent();
            if (text && text.includes(colorName)) {
              try {
                await el.scrollIntoViewIfNeeded();
                await page.waitForTimeout(300);
                await el.click();
                await page.waitForTimeout(2000);
                
                result.color = colorName;
                console.log(`   ✓ Color clicked (fallback): ${result.color}`);
                break;
              } catch (e) {
                continue;
              }
            }
          }
          if (result.color) break;
        }
      }
      
      if (!result.color) {
        console.log(`   ⚠️  Could not find color selector`);
      }
    } catch (error) {
      console.log(`   ⚠️  Could not select color: ${error.message}`);
    }

    // Wait for price to update after color selection
    await page.waitForTimeout(2000);

    // Extract prices from the page - look for Lowe's specific price structure
    const prices = await page.evaluate(() => {
      const priceData = {
        original_price: null,
        promotional_price: null
      };

      // Strategy 1: Find all price elements and their context
      // Focus on finding the two actual prices displayed, not "Save $X" amounts
      const priceElements = [];
      
      // Look for price elements in headings and price-specific containers
      const priceContainers = document.querySelectorAll('h1, h2, h3, h4, h5, h6, [class*="price"], [class*="Price"], [data-testid*="price"]');
      
      priceContainers.forEach(el => {
        const text = el.textContent || '';
        const priceMatches = text.match(/\$[\d,]+\.?\d*/g);
        
        if (priceMatches && priceMatches.length > 0) {
          priceMatches.forEach(match => {
            const priceValue = parseFloat(match.replace(/[$,]/g, ''));
            if (priceValue > 5 && priceValue < 100000) { // Exclude very small prices like $1
              const style = window.getComputedStyle(el);
              const isStruck = style.textDecoration.includes('line-through') || 
                              el.closest('s, strike') !== null ||
                              el.classList.toString().toLowerCase().includes('original') ||
                              el.classList.toString().toLowerCase().includes('was');
              
              const fontSize = parseFloat(style.fontSize);
              const fontWeight = parseInt(style.fontWeight) || 400;
              const isLarge = fontSize >= 14 || fontWeight >= 500;
              
              // Exclude "Save $X" text - check if this element or its text contains "Save"
              const fullText = el.textContent || '';
              const isSaveText = /Save\s+\$[\d,]+\.?\d*/i.test(fullText) && 
                                fullText.toLowerCase().includes('save') &&
                                !isLarge;
              
              // Only include if it's not a "Save $X" amount
              if (!isSaveText) {
                priceElements.push({
                  value: priceValue,
                  isStruck: isStruck,
                  isLarge: isLarge,
                  fontSize: fontSize,
                  fontWeight: fontWeight,
                  element: el,
                  text: fullText.trim()
                });
              }
            }
          });
        }
      });

      // Remove duplicates (same value, same element)
      const uniquePriceElements = [];
      const seen = new Set();
      priceElements.forEach(p => {
        const key = `${p.value}-${p.isStruck}-${p.isLarge}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniquePriceElements.push(p);
        }
      });

      // Strategy 2: Identify original and promotional prices from the two displayed prices
      // Original price: usually struck-through, higher value
      // Promotional price: usually larger/bolder, lower value
      
      const struckPrices = uniquePriceElements.filter(p => p.isStruck);
      const nonStruckPrices = uniquePriceElements.filter(p => !p.isStruck);
      
      // Get all unique price values (sorted descending)
      const allPrices = [...new Set(uniquePriceElements.map(p => p.value))].sort((a, b) => b - a);
      
      // If we have exactly 2 prices, use them directly
      if (allPrices.length === 2) {
        if (struckPrices.length === 1) {
          // One is struck-through: struck = original, non-struck = promotional
          priceData.original_price = struckPrices[0].value;
          priceData.promotional_price = nonStruckPrices.find(p => p.value !== struckPrices[0].value)?.value || allPrices[1];
        } else {
          // Neither is struck: higher = original, lower = promotional
          priceData.original_price = allPrices[0]; // Higher
          priceData.promotional_price = allPrices[1]; // Lower
        }
      } else if (struckPrices.length > 0) {
        // If we have struck-through prices, use the highest one as original
        priceData.original_price = Math.max(...struckPrices.map(p => p.value));
        
        // Find the promotional price (non-struck, preferably larger)
        if (nonStruckPrices.length > 0) {
          const sortedNonStruck = nonStruckPrices.sort((a, b) => {
            if (a.isLarge && !b.isLarge) return -1;
            if (!a.isLarge && b.isLarge) return 1;
            if (a.fontSize !== b.fontSize) return b.fontSize - a.fontSize;
            return b.fontWeight - a.fontWeight;
          });
          priceData.promotional_price = sortedNonStruck[0].value;
        } else if (allPrices.length > 1) {
          // Use the lower price as promotional
          priceData.promotional_price = allPrices[allPrices.length - 1];
        }
      } else if (nonStruckPrices.length > 0) {
        // No struck prices, but we have prices
        if (allPrices.length >= 2) {
          priceData.original_price = allPrices[0]; // Higher
          priceData.promotional_price = allPrices[1]; // Lower
        } else if (allPrices.length === 1) {
          priceData.promotional_price = allPrices[0];
          priceData.original_price = allPrices[0];
        }
      }
      
      // If we only found one price, use it for both
      if (allPrices.length === 1 && !priceData.promotional_price) {
        priceData.promotional_price = allPrices[0];
        if (!priceData.original_price) {
          priceData.original_price = allPrices[0];
        }
      }

      // Final validation: ensure prices make sense
      if (priceData.original_price && priceData.promotional_price) {
        // Original should be >= promotional
        if (priceData.original_price < priceData.promotional_price) {
          // Swap them
          const temp = priceData.original_price;
          priceData.original_price = priceData.promotional_price;
          priceData.promotional_price = temp;
        }
        
        // Ensure they're different enough to be meaningful (not just rounding differences)
        if (Math.abs(priceData.original_price - priceData.promotional_price) < 0.01) {
          priceData.original_price = priceData.promotional_price;
        }
      }

      return priceData;
    });

    result.original_price = prices.original_price;
    result.promotional_price = prices.promotional_price;

    // Calculate promo percentage
    if (result.original_price && result.promotional_price && result.original_price > result.promotional_price) {
      result.promo_percentage = ((result.original_price - result.promotional_price) / result.original_price * 100).toFixed(2);
    } else if (result.original_price === result.promotional_price) {
      result.promo_percentage = 0;
    }

    // Validate prices - if they seem wrong, try extracting again after a delay
    if (!result.original_price || !result.promotional_price || result.promotional_price < 5) {
      console.log(`   ⚠️  Prices seem incorrect, waiting and re-extracting...`);
      await page.waitForTimeout(3000);
      
      // Scroll to price area
      await page.evaluate(() => {
        const priceElements = document.querySelectorAll('[class*="price"], [class*="Price"], h5, h4, h3');
        if (priceElements.length > 0) {
          priceElements[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
      await page.waitForTimeout(2000);
      
      // Re-extract prices with better logic - focus on the two actual prices
      const pricesRetry = await page.evaluate(() => {
        const priceData = { original_price: null, promotional_price: null };
        
        // Find price elements in headings and price containers (not "Save $X")
        const priceElements = [];
        document.querySelectorAll('h1, h2, h3, h4, h5, h6, [class*="price"], [class*="Price"]').forEach(el => {
          const text = el.textContent || '';
          const priceMatches = text.match(/\$[\d,]+\.?\d*/g);
          if (priceMatches) {
            priceMatches.forEach(match => {
              const priceValue = parseFloat(match.replace(/[$,]/g, ''));
              if (priceValue > 5 && priceValue < 100000) {
                const style = window.getComputedStyle(el);
                const isStruck = style.textDecoration.includes('line-through');
                const fullText = text.toLowerCase();
                const isSaveText = fullText.includes('save') && /save\s+\$[\d,]+\.?\d*/i.test(text);
                
                // Exclude "Save $X" amounts - only include actual product prices
                if (!isSaveText) {
                  priceElements.push({
                    value: priceValue,
                    isStruck: isStruck
                  });
                }
              }
            });
          }
        });
        
        // Get unique prices (sorted descending)
        const uniquePrices = [...new Set(priceElements.map(p => p.value))].sort((a, b) => b - a);
        const struckPrices = priceElements.filter(p => p.isStruck).map(p => p.value);
        
        // Use the two actual prices displayed
        if (uniquePrices.length >= 2) {
          if (struckPrices.length > 0) {
            // One is struck: struck = original, other = promotional
            priceData.original_price = Math.max(...struckPrices);
            priceData.promotional_price = uniquePrices.find(p => !struckPrices.includes(p)) || uniquePrices[1];
          } else {
            // Neither struck: higher = original, lower = promotional
            priceData.original_price = uniquePrices[0];
            priceData.promotional_price = uniquePrices[1];
          }
        } else if (uniquePrices.length === 1) {
          priceData.promotional_price = uniquePrices[0];
          priceData.original_price = uniquePrices[0];
        }
        
        return priceData;
      });
      
      if (pricesRetry.original_price && pricesRetry.promotional_price) {
        result.original_price = pricesRetry.original_price;
        result.promotional_price = pricesRetry.promotional_price;
        console.log(`   ✅ Re-extracted prices`);
      }
    }

    console.log(`   💰 Original Price: $${result.original_price || 'N/A'}`);
    console.log(`   💰 Promotional Price: $${result.promotional_price || 'N/A'}`);
    console.log(`   📊 Promo Percentage: ${result.promo_percentage || 0}%`);

    // Take screenshot as base64 (stored in database instead of file system)
    const screenshotBuffer = await page.screenshot({ 
      fullPage: true,
      type: 'png'
    });
    
    // Convert to base64 for database storage
    result.screenshot_data = screenshotBuffer.toString('base64');
    result.success = true;
    console.log(`   📸 Screenshot captured (${(screenshotBuffer.length / 1024).toFixed(2)} KB)`);

  } catch (error) {
    console.error(`   ❌ Error testing product: ${error.message}`);
    result.error = error.message;
  } finally {
    // Only close browser if not using shared context and not keeping it open
    if (!usingSharedContext && !keepBrowserOpen) {
      // Only close browser if we created it (not if connected to existing)
      if (!connectedToExisting) {
        try {
          if (page) await page.close();
        } catch (e) {
          // Ignore errors
        }
        try {
          if (context) await context.close();
        } catch (e) {
          // Ignore errors
        }
        try {
          if (browser) await browser.close();
        } catch (e) {
          // Ignore errors
        }
        console.log(`   ✅ Browser closed`);
      } else {
        // If connected to existing Chrome, just close the page
        try {
          if (page) await page.close();
          console.log(`   ✅ Tab closed`);
        } catch (e) {
          // Ignore errors
        }
      }
    } else if (usingSharedContext) {
      // Using shared context - don't close, just log
      console.log(`   ✓ Test complete (browser remains open for next product)`);
    } else if (keepBrowserOpen) {
      // Keep browser open for sequential testing
      console.log(`   ✓ Test complete (browser remains open)`);
    }
  }

  return result;
}

/**
 * Test multiple products using a shared browser context
 * @param {Array} products - Array of product objects
 * @param {Object} options - Testing options
 * @returns {Promise<Array>} Array of test results
 */
async function testProducts(products, options = {}) {
  const results = [];
  const shouldStop = options.shouldStop || (() => false);
  const headless = options.headless !== undefined ? options.headless : false; // Default to false (non-headless)
  
  let browser, context, page;
  let connectedToExisting = false; // Track if we connected to existing Chrome
  
  try {
    console.log('\n🚀 Opening Google Chrome browser...');
    
    // Strategy 1: Try to connect to existing Chrome instance (opens in new tab)
    try {
      browser = await chromium.connectOverCDP('http://localhost:9222');
      connectedToExisting = true;
      console.log('   ✓ Connected to existing Chrome instance (will open in new tab)');
      
      // Get existing context or create new one
      const contexts = browser.contexts();
      if (contexts.length > 0) {
        context = contexts[0];
        console.log('   ✓ Using existing Chrome context');
      } else {
        context = await browser.newContext({
          viewport: { width: 1920, height: 1080 },
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          locale: 'en-US',
          timezoneId: 'America/New_York',
          permissions: ['geolocation'],
          geolocation: { longitude: -74.006, latitude: 40.7128 },
          colorScheme: 'light',
          extraHTTPHeaders: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0',
            'DNT': '1'
          }
        });
        console.log('   ✓ Created new context in existing Chrome (opens as tab)');
      }
    } catch (cdpError) {
      // Strategy 2: Use a temporary profile directory (avoids profile lock)
      console.log('   ℹ️  No existing Chrome instance found, launching new Chrome...');
      console.log('   💡 Tip: To open in tabs, start Chrome with: chrome --remote-debugging-port=9222');
      
      // Use a temporary profile directory to avoid conflicts with running Chrome
      const os = require('os');
      const tempProfileDir = path.join(os.tmpdir(), 'lowes-test-profile-' + Date.now());
      
      // Launch with temporary profile - this avoids the profile lock issue
      context = await chromium.launchPersistentContext(tempProfileDir, {
        headless: false, // Always visible
        channel: 'chrome', // Use installed Google Chrome
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--no-first-run'
        ],
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'en-US',
        timezoneId: 'America/New_York',
        permissions: ['geolocation'],
        geolocation: { longitude: -74.006, latitude: 40.7128 },
        colorScheme: 'light',
        extraHTTPHeaders: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Cache-Control': 'max-age=0',
          'DNT': '1'
        }
      });
      
      browser = context.browser();
      console.log('   ✓ Launched Chrome with temporary profile (avoids profile lock)');
    }
    console.log('   ✓ Chrome browser opened');
    // Get or create a page from the context
    const pages = context.pages();
    if (pages.length > 0) {
      page = pages[0]; // Use existing page
    } else {
      page = await context.newPage(); // Create new page if none exists
    }
    
    // Remove webdriver property to avoid detection
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
      
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
      
      window.chrome = {
        runtime: {},
      };
      
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
    });
    
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);
    
    // Visit lowes.com homepage FIRST to establish session
    // This session will be maintained across all product tests
    console.log('📍 Establishing session on lowes.com homepage...');
    try {
      // Navigate with realistic referrer
      await page.goto('https://www.lowes.com', { 
        waitUntil: 'domcontentloaded',
        timeout: 60000,
        referer: 'https://www.google.com/' // Look like coming from Google search
      });
      
      // Wait for page to load with realistic delays
      await page.waitForTimeout(3000 + Math.random() * 2000); // 3-5 seconds
      
      // Handle cookie consent if present
      try {
        const cookieButtons = await page.$$('button[id*="accept" i], button[class*="accept" i], button:has-text("Accept"), button:has-text("I Accept")');
        for (const btn of cookieButtons) {
          if (await btn.isVisible()) {
            await btn.click();
            await page.waitForTimeout(1000);
            console.log('   ✓ Accepted cookies');
            break;
          }
        }
      } catch (e) {
        // No cookie banner
      }
      
      // Simulate human behavior - scroll and interact
      await page.evaluate(() => {
        window.scrollTo(0, 300 + Math.random() * 200);
      });
      await page.waitForTimeout(1000 + Math.random() * 1000);
      
      // Move mouse to simulate human
      await page.mouse.move(400 + Math.random() * 200, 300 + Math.random() * 200);
      await page.waitForTimeout(500);
      
      // Check if blocked on homepage
      const homepageTitle = await page.title();
      const homepageUrl = page.url();
      const homepageContent = await page.content();
      
      if (homepageTitle.includes('Access Denied') || 
          homepageUrl.includes('errors.edgesuite.net') ||
          homepageContent.includes('Access Denied')) {
        console.log(`   ⚠️  Access denied on homepage detected`);
        console.log(`   💡 Workaround: The browser window is open - please manually navigate to lowes.com`);
        console.log(`   💡 Once you're on lowes.com, the automation will continue with product testing`);
        console.log(`   💡 Waiting 30 seconds for manual navigation...`);
        
        // Wait for user to manually navigate
        await page.waitForTimeout(30000);
        
        // Check again after manual navigation
        const newUrl = page.url();
        if (newUrl.includes('lowes.com') && !newUrl.includes('errors.edgesuite.net')) {
          console.log('   ✅ Manual navigation successful - continuing with automation');
        } else {
          throw new Error('Access Denied: Please manually navigate to lowes.com in the browser window, then the automation will continue');
        }
      } else {
        // Session is now established - proceed to products
        console.log('✅ Session established - ready to test products\n');
      }
    } catch (e) {
      console.error(`❌ Failed to establish session: ${e.message}`);
      console.log(`   💡 The browser window is still open - you can manually navigate to lowes.com`);
      console.log(`   💡 The automation will attempt to continue after 30 seconds...`);
      await page.waitForTimeout(30000);
      // Don't throw - try to continue anyway
    }
    
    // Now test all products using the established session
    for (const product of products) {
      // Check if we should stop before each product
      if (shouldStop()) {
        console.log('\n🛑 Testing stopped by user');
        break;
      }
      
      try {
        const result = await testProduct(product, { 
          ...options, 
          shouldStop,
          page, // Reuse the same page
          context // Reuse the same context
        });
        results.push(result);
        
        // Add delay between tests
        if (products.indexOf(product) < products.length - 1 && !shouldStop()) {
          const delay = 3000 + Math.random() * 3000; // 3-6 seconds
          console.log(`   ⏳ Waiting ${(delay / 1000).toFixed(1)}s before next product...\n`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        if (error.message.includes('stopped by user')) {
          console.log(`\n🛑 Stopping test for ${product.name}`);
          break;
        }
        console.error(`Error testing product ${product.name}:`, error);
        // Format product name: add " shutters" to French door products
        let errorProductName = product.name || product.model || 'Unknown Product';
        if (errorProductName && errorProductName.toLowerCase().includes('french door') && !errorProductName.toLowerCase().includes('shutters')) {
          errorProductName = errorProductName + ' Shutters';
        }
        
        results.push({
          success: false,
          product_name: errorProductName,
          product_url: product.url,
          model: product.model,
          error: error.message
        });
      }
    }
    
  } finally {
    // Check if any products had access denied - if so, keep browser open
    const hasAccessDenied = results.some(r => r.error && r.error.includes('Access Denied'));
    
    if (hasAccessDenied) {
      console.log('\n⚠️  Some products encountered access denied.');
      console.log('   Browser window will remain open for 60 seconds for manual review.');
      console.log('   You can manually navigate and test products, then close the browser.');
      await new Promise(resolve => setTimeout(resolve, 60000)); // Keep open for 60 seconds
    }
    
    // Clean up browser resources only at the end
    try {
      if (page && !connectedToExisting) {
        await page.close();
      }
    } catch (e) {
      // Ignore errors
    }
    try {
      if (context && !connectedToExisting) {
        await context.close();
      }
    } catch (e) {
      // Ignore errors
    }
    try {
      if (browser && !connectedToExisting) {
        await browser.close();
      }
    } catch (e) {
      // Ignore errors - if connected to existing, don't close it
    }
  }
  
  return results;
}

module.exports = { testProduct, testProducts };
