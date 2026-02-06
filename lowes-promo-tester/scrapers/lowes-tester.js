const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * Get Edge user profile directory path
 * @returns {string} Path to Edge user profile directory
 */
function getEdgeUserDataDir() {
  const platform = os.platform();
  const homeDir = os.homedir();
  
  if (platform === 'darwin') {
    // macOS
    return path.join(homeDir, 'Library', 'Application Support', 'Microsoft Edge');
  } else if (platform === 'win32') {
    // Windows
    return path.join(homeDir, 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data');
  } else {
    // Linux
    return path.join(homeDir, '.config', 'microsoft-edge');
  }
}

/**
 * Get a copy of Edge profile for testing (to avoid profile lock)
 * @returns {string} Path to copied profile directory
 */
function getEdgeProfileCopy() {
  const originalProfile = getEdgeUserDataDir();
  const tempDir = os.tmpdir();
  const profileCopy = path.join(tempDir, 'lowes-edge-profile-' + Date.now());
  
  // Check if original profile exists
  if (!fs.existsSync(originalProfile)) {
    console.log(`   ⚠️  Edge profile not found at ${originalProfile}, using temporary profile`);
    return null;
  }
  
  // For now, we'll use the profile directly with a separate directory
  // to avoid copying large profile data
  return profileCopy;
}

/**
 * Navigate to product by pasting URL in address bar and waiting for user to press Enter
 * @param {Page} page - Playwright page object
 * @param {Object} product - Product object
 */
async function navigateToProductOrganically(page, product) {
  console.log(`   🔗 Step 1: Preparing to enter product URL into address bar...`);
  console.log(`   📋 Product URL: ${product.url}`);
  
  // Wait for the test to start - give the browser time to be ready
  console.log(`   ⏳ Waiting for browser to be ready...`);
  await page.waitForTimeout(3000 + Math.random() * 2000); // Wait 3-5 seconds
  
  // Ensure page is focused
  try {
    await page.bringToFront();
    await page.waitForTimeout(500);
  } catch (e) {
    // Continue anyway
  }
  
  const platform = os.platform();
  
  // First, set the URL to clipboard using the browser's clipboard API
  console.log(`   📋 Setting URL to clipboard...`);
  try {
    const clipboardSet = await page.evaluate(async (url) => {
      try {
        // Try modern clipboard API
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(url);
          return true;
        }
        // Fallback to execCommand
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        return success;
      } catch (e) {
        console.error('Clipboard error:', e);
        return false;
      }
    }, product.url);
    
    if (!clipboardSet) {
      console.log(`   ⚠️  Could not set clipboard, will try typing instead`);
    } else {
      console.log(`   ✓ URL copied to clipboard`);
    }
  } catch (e) {
    console.log(`   ⚠️  Clipboard setup failed: ${e.message}, will try typing instead`);
  }
  
  // Wait a moment for clipboard to be ready
  await page.waitForTimeout(500);
  
  // Copy URL to clipboard and display visual instructions
  // Since automation to address bar is unreliable via CDP, we'll use a visual overlay
  console.log(`   📋 Preparing URL for manual entry...`);
  console.log(`   📋 URL: ${product.url}`);
  
  // Ensure URL is in clipboard
  let clipboardReady = false;
  try {
    const clipboardSet = await page.evaluate(async (url) => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(url);
          return true;
        }
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        return success;
      } catch (e) {
        return false;
      }
    }, product.url);
    
    if (clipboardSet) {
      clipboardReady = true;
      console.log(`   ✓ URL copied to clipboard`);
    }
  } catch (e) {
    console.log(`   ⚠️  Clipboard copy failed: ${e.message}`);
  }
  
  // Display visual overlay with instructions
  try {
    await page.evaluate(({ url, platform }) => {
      const existing = document.getElementById('lowes-url-instructions');
      if (existing) existing.remove();
      
      const overlay = document.createElement('div');
      overlay.id = 'lowes-url-instructions';
      overlay.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 30px 40px;
        border-radius: 15px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        max-width: 600px;
        text-align: center;
      `;
      
      overlay.innerHTML = `
        <h2 style="margin: 0 0 20px 0; font-size: 24px;">📋 Product URL</h2>
        <div style="display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.2); padding: 15px; border-radius: 8px; margin: 20px 0;">
          <div style="flex: 1; word-break: break-all; font-family: monospace; font-size: 14px; color: white;">
            ${url}
          </div>
          <button id="copy-url-btn" style="background: white; color: #667eea; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: bold; white-space: nowrap; flex-shrink: 0;">
            📋 Copy
          </button>
        </div>
        <p style="margin: 15px 0 0 0; font-size: 14px; opacity: 0.9;">
          Paste into address bar and press Enter
        </p>
        <button id="close-instructions" style="background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3); padding: 8px 16px; border-radius: 5px; cursor: pointer; font-weight: normal; margin-top: 15px;">
          Close
        </button>
      `;
      
      document.body.appendChild(overlay);
      
      // Copy button functionality
      const copyBtn = document.getElementById('copy-url-btn');
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(url);
          const originalText = copyBtn.textContent;
          copyBtn.textContent = '✓ Copied!';
          copyBtn.style.background = '#4ade80';
          setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.style.background = 'white';
          }, 2000);
        } catch (e) {
          // Fallback for older browsers
          const textArea = document.createElement('textarea');
          textArea.value = url;
          textArea.style.position = 'fixed';
          textArea.style.left = '-9999px';
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          
          const originalText = copyBtn.textContent;
          copyBtn.textContent = '✓ Copied!';
          copyBtn.style.background = '#4ade80';
          setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.style.background = 'white';
          }, 2000);
        }
      });
      
      // Close button functionality
      document.getElementById('close-instructions').addEventListener('click', () => {
        overlay.remove();
      });
      
      setTimeout(() => {
        if (document.getElementById('lowes-url-instructions')) {
          document.getElementById('lowes-url-instructions').remove();
        }
      }, 30000);
    }, { url: product.url, platform: platform });
    
    console.log(`   ✓ Visual instructions displayed on page`);
  } catch (e) {
    console.log(`   ⚠️  Could not display visual instructions: ${e.message}`);
  }
  
  // Console instructions
  console.log(`\n   ╔══════════════════════════════════════════════════════════════╗`);
  console.log(`   ║  PRODUCT URL - Copy and paste into address bar            ║`);
  console.log(`   ╠══════════════════════════════════════════════════════════════╣`);
  console.log(`   ║  ${product.url.padEnd(58)} ║`);
  console.log(`   ╚══════════════════════════════════════════════════════════════╝`);
  console.log(`   💡 URL is in clipboard${clipboardReady ? ' (ready!)' : ''} - paste into address bar and press Enter`);
  console.log(`   💡 The automation will automatically detect navigation and continue\n`);
  
  // Wait for the URL to change (user pressed Enter) - monitor actively
  const initialUrl = page.url();
  let urlChanged = false;
  let waitTime = 0;
  const maxWaitTime = 300000; // 5 minutes max wait
  const checkInterval = 500; // Check every 500ms for faster detection
  
  console.log(`   ⏳ Monitoring for navigation (current URL: ${initialUrl.substring(0, 60)}...)`);
  
  // Set up navigation event listener for instant detection
  let navigationDetected = false;
  const navigationHandler = async (frame) => {
    if (frame === page.mainFrame() && !navigationDetected) {
      const currentUrl = frame.url();
      if (currentUrl !== initialUrl) {
        const isOnProductPage = currentUrl.includes('lowes.com') && 
                                (currentUrl.includes('/p/') || 
                                 currentUrl.includes('/configure/') || 
                                 currentUrl.includes('omniItemId='));
        
        if (isOnProductPage) {
          navigationDetected = true;
          urlChanged = true;
          console.log(`   ✅ Navigation event detected! Product page loaded`);
          console.log(`   📍 URL: ${currentUrl.substring(0, 100)}...`);
        }
      }
    }
  };
  
  page.on('framenavigated', navigationHandler);
  
  // Poll for URL changes (backup method)
  while (!urlChanged && waitTime < maxWaitTime) {
    await page.waitForTimeout(checkInterval);
    waitTime += checkInterval;
    
    try {
      const currentUrl = page.url();
      
      // Check if URL changed to a product page
      if (currentUrl !== initialUrl) {
        const isOnProductPage = currentUrl.includes('lowes.com') && 
                                (currentUrl.includes('/p/') || 
                                 currentUrl.includes('/configure/') || 
                                 currentUrl.includes('omniItemId='));
        
        if (isOnProductPage) {
          urlChanged = true;
          console.log(`   ✅ Navigation detected! Product page loaded`);
          console.log(`   📍 URL: ${currentUrl.substring(0, 100)}...`);
          break;
        } else {
          // URL changed but not to product page yet - keep monitoring
          if (waitTime % 5000 === 0) { // Log every 5 seconds
            console.log(`   🔄 URL changed, but not on product page yet: ${currentUrl.substring(0, 80)}...`);
          }
        }
      }
      
      // Show progress every 10 seconds
      if (waitTime % 10000 === 0 && waitTime > 0) {
        console.log(`   ⏳ Still waiting for navigation... (${(waitTime / 1000).toFixed(1)}s elapsed)`);
      }
    } catch (e) {
      // Page might have navigated, check again
      try {
        const currentUrl = page.url();
        if (currentUrl !== initialUrl) {
          const isOnProductPage = currentUrl.includes('lowes.com') && 
                                  (currentUrl.includes('/p/') || 
                                   currentUrl.includes('/configure/') || 
                                   currentUrl.includes('omniItemId='));
          if (isOnProductPage) {
            urlChanged = true;
            break;
          }
        }
      } catch (e2) {
        // Continue polling
      }
    }
  }
  
  // Remove event listener
  page.off('framenavigated', navigationHandler);
  
  // If navigation detected, wait for page to load
  if (urlChanged) {
    try {
      await page.waitForLoadState('networkidle', { timeout: 30000 });
    } catch (e) {
      // Continue anyway
    }
    await page.waitForTimeout(3000 + Math.random() * 2000);
  }
  
  if (!urlChanged) {
    console.log(`   ⚠️  Timeout waiting for navigation`);
    console.log(`   💡 Please manually navigate to the product page`);
    console.log(`   💡 The automation will check if you're on the product page...`);
    
    // Check if user manually navigated anyway
    await page.waitForTimeout(5000);
    const finalUrl = page.url();
    const isOnProductPage = finalUrl.includes('lowes.com') && 
                            (finalUrl.includes('/p/') || 
                             finalUrl.includes('/configure/') || 
                             finalUrl.includes('omniItemId='));
    
    if (isOnProductPage) {
      console.log(`   ✅ You're on a product page - continuing!`);
      urlChanged = true;
    } else {
      throw new Error('Navigation timeout - please manually navigate to the product page and the automation will continue');
    }
  }
  
  // Verify we're on a product page
  const currentUrl = page.url();
  const isOnProductPage = currentUrl.includes('lowes.com') && 
                          (currentUrl.includes('/p/') || 
                           currentUrl.includes('/configure/') || 
                           currentUrl.includes('omniItemId='));
  
  if (isOnProductPage) {
    // Check for access denied
    const denied = await handleAccessDenied(page, 60);
    if (denied) {
      console.log(`   ✅ Successfully navigated to product page`);
      return;
    } else {
      throw new Error('Access denied after navigation');
    }
  } else {
    console.log(`   ⚠️  Not on a product page yet - current URL: ${currentUrl}`);
    console.log(`   💡 Please navigate to the product page`);
    await handleAccessDenied(page, 120);
    
    // Final check
    const finalUrl = page.url();
    const finalIsOnProductPage = finalUrl.includes('lowes.com') && 
                                 (finalUrl.includes('/p/') || 
                                  finalUrl.includes('/configure/') || 
                                  finalUrl.includes('omniItemId='));
    
    if (finalIsOnProductPage) {
      console.log(`   ✅ Now on product page - continuing!`);
      return;
    } else {
      throw new Error('Not on product page after navigation');
    }
  }
}

/**
 * Look for and click "Customize" button, then wait for color selector
 * @param {Page} page - Playwright page object
 * @param {Function} checkAccessDeniedPeriodic - Function to check for access denied
 * @returns {Promise<boolean>} True if customize button was clicked, false otherwise
 */
async function clickCustomizeButton(page, checkAccessDeniedPeriodic) {
  console.log(`   🔍 Looking for "Customize" button...`);
  let customizeClicked = false;
  
  try {
    // Common selectors for customize button
    const customizeSelectors = [
      'button:has-text("Customize")',
      'a:has-text("Customize")',
      'button[aria-label*="Customize" i]',
      'a[aria-label*="Customize" i]',
      'button[data-testid*="customize" i]',
      'a[data-testid*="customize" i]',
      'button.customize',
      'a.customize',
      '[class*="customize" i]',
      'button:contains("Customize")',
      'a:contains("Customize")'
    ];
    
    // Try to find customize button by selector
    for (const selector of customizeSelectors) {
      try {
        const customizeBtn = await page.$(selector);
        if (customizeBtn && await customizeBtn.isVisible()) {
          console.log(`   ✓ Found "Customize" button with selector: ${selector}`);
          await customizeBtn.scrollIntoViewIfNeeded();
          await page.waitForTimeout(500);
          await customizeBtn.click({ delay: 100 + Math.random() * 100 });
          await page.waitForTimeout(2000 + Math.random() * 1000);
          customizeClicked = true;
          console.log(`   ✅ Clicked "Customize" button`);
          break;
        }
      } catch (e) {
        // Try next selector
      }
    }
    
    // If not found by selector, try finding by text content
    if (!customizeClicked) {
      const allButtons = await page.$$('button, a, span, div');
      for (const btn of allButtons) {
        try {
          const text = await btn.textContent();
          const isVisible = await btn.isVisible();
          
          if (text && isVisible && text.trim().toLowerCase().includes('customize')) {
            // Make sure it's actually a clickable customize button
            const tagName = await btn.evaluate(el => el.tagName.toLowerCase());
            if (tagName === 'button' || tagName === 'a' || 
                (await btn.evaluate(el => window.getComputedStyle(el).cursor === 'pointer'))) {
              console.log(`   ✓ Found "Customize" button by text: "${text.trim()}"`);
              await btn.scrollIntoViewIfNeeded();
              await page.waitForTimeout(500);
              await btn.click({ delay: 100 + Math.random() * 100 });
              await page.waitForTimeout(2000 + Math.random() * 1000);
              customizeClicked = true;
              console.log(`   ✅ Clicked "Customize" button`);
              break;
            }
          }
        } catch (e) {
          // Continue to next button
        }
      }
    }
    
    if (!customizeClicked) {
      console.log(`   ℹ️  No "Customize" button found - product may already be in customize mode`);
    }
    
    // Wait for customize panel/options to load if button was clicked
    if (customizeClicked) {
      await page.waitForTimeout(2000 + Math.random() * 2000);
      // Check for access denied after clicking customize
      if (checkAccessDeniedPeriodic) {
        await checkAccessDeniedPeriodic();
      }
    }
    
    // Look for color selector after customize is clicked or if already in customize mode
    console.log(`   🎨 Looking for color selector...`);
    await page.waitForTimeout(2000);
    
    // Check if color selector is available
    const colorSelectorAvailable = await page.evaluate(() => {
      // Look for common color selector patterns
      const colorSelectors = [
        'input[type="search"][placeholder*="Color" i]',
        'input[placeholder*="Search by Color" i]',
        '[class*="color" i][class*="selector" i]',
        '[class*="color" i][class*="grid" i]',
        '[data-testid*="color" i]',
        'button[aria-label*="color" i]',
        'div[class*="swatch" i]',
        'img[alt*="color" i]'
      ];
      
      for (const selector of colorSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          return true;
        }
      }
      
      // Also check for text content
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        const text = el.textContent || '';
        if (text.includes('Color Name') || text.includes('Search by Color')) {
          return true;
        }
      }
      
      return false;
    });
    
    if (colorSelectorAvailable) {
      console.log(`   ✅ Color selector is available`);
    } else {
      console.log(`   ℹ️  Color selector not immediately visible (may load after interaction)`);
    }
    
  } catch (error) {
    console.log(`   ⚠️  Error looking for/clicking "Customize" button: ${error.message}`);
    // Continue anyway - product might not have a customize button
  }
  
  return customizeClicked;
}

/**
 * Helper function to search and click product by ID
 */
async function searchAndClickProduct(page, productId, product) {
  // Similar logic but using product ID
  console.log(`   🔍 Searching by product ID: ${productId}`);
  
  // Type product ID in search
  const searchBox = await page.$('input[type="search"], input[placeholder*="Search" i]');
  if (searchBox) {
    await searchBox.click();
    await page.waitForTimeout(500);
    await searchBox.fill(productId);
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    
    // Click product link
    await page.click(`a[href*="${productId}"]`, { timeout: 5000 });
    await page.waitForTimeout(2000);
  }
}

/**
 * Check for access denied and wait for manual intervention if needed
 * @param {Page} page - Playwright page object
 * @param {number} waitTime - Time to wait in seconds (default 60)
 * @returns {Promise<boolean>} True if access denied was resolved, false otherwise
 */
async function handleAccessDenied(page, waitTime = 60) {
  const checkAccessDenied = async () => {
    try {
      const pageInfo = await page.evaluate(() => {
        return {
          title: document.title,
          bodyText: document.body?.textContent?.substring(0, 500) || '',
          url: window.location.href
        };
      });
      
      const isDenied = pageInfo.title.includes('Access Denied') || 
                      pageInfo.bodyText.includes('Access Denied') ||
                      pageInfo.url.includes('errors.edgesuite.net') ||
                      pageInfo.bodyText.includes('Reference #') ||
                      pageInfo.bodyText.includes('You don\'t have permission');
      
      return isDenied;
    } catch (e) {
      return false;
    }
  };
  
  const isDenied = await checkAccessDenied();
  
  if (isDenied) {
    console.log(`\n   ⚠️  ACCESS DENIED DETECTED`);
    console.log(`   💡 The browser window is open - please manually navigate to the product page`);
    console.log(`   💡 Steps to fix:`);
    console.log(`      1. In the browser window, manually navigate to lowes.com`);
    console.log(`      2. Search for the product and click on it`);
    console.log(`      3. Wait for the product page to load`);
    console.log(`   💡 The automation will check every 5 seconds and continue when you're on the product page`);
    console.log(`   💡 Waiting up to ${waitTime} seconds for manual navigation...\n`);
    
    const startTime = Date.now();
    const checkInterval = 5000; // Check every 5 seconds
    
    while (Date.now() - startTime < waitTime * 1000) {
      await page.waitForTimeout(checkInterval);
      
      const stillDenied = await checkAccessDenied();
      
      if (!stillDenied) {
        // Check if we're on a product page
        const currentUrl = page.url();
        const isOnProductPage = currentUrl.includes('lowes.com') && 
                                (currentUrl.includes('/p/') || 
                                 currentUrl.includes('/configure/') || 
                                 currentUrl.includes('omniItemId='));
        
        if (isOnProductPage) {
          console.log(`   ✅ Manual navigation successful - you're on a product page!`);
          console.log(`   ✅ Automation will continue with testing...\n`);
          return true;
        } else if (currentUrl.includes('lowes.com') && !currentUrl.includes('errors.edgesuite.net')) {
          console.log(`   ✓ You're on lowes.com - please navigate to the product page`);
          // Continue waiting
        }
      } else {
        console.log(`   ⏳ Still waiting... (${Math.floor((Date.now() - startTime) / 1000)}s elapsed)`);
      }
    }
    
    // Final check
    const finalCheck = await checkAccessDenied();
    if (!finalCheck) {
      const currentUrl = page.url();
      const isOnProductPage = currentUrl.includes('lowes.com') && 
                              (currentUrl.includes('/p/') || 
                               currentUrl.includes('/configure/') || 
                               currentUrl.includes('omniItemId='));
      
      if (isOnProductPage) {
        console.log(`   ✅ Manual navigation successful!`);
        return true;
      }
    }
    
    console.log(`   ⚠️  Timeout reached - access denied may still be present`);
    return false;
  }
  
  return true; // No access denied detected
}

/**
 * Establish session with extended warm-up period and realistic behavior
 * @param {Page} page - Playwright page object
 */
async function establishSession(page) {
  console.log(`   🔐 Establishing session with extended warm-up period...`);
  console.log(`   ⏳ This may take 30-60 seconds to build a good session...`);
  
  // Extended warm-up: Visit multiple pages with realistic delays
  const pagesToVisit = [
    'https://www.lowes.com',
    'https://www.lowes.com/c/Blinds-window-treatments',
    'https://www.lowes.com/c/Windows-doors',
    'https://www.lowes.com'
  ];
  
  for (let i = 0; i < pagesToVisit.length; i++) {
    const url = pagesToVisit[i];
    console.log(`   📍 Warm-up ${i + 1}/${pagesToVisit.length}: Visiting ${url}...`);
    
    try {
      await page.goto(url, {
        waitUntil: 'networkidle', // Wait for network to be idle (more realistic)
        timeout: 90000
      });
      
      // Wait longer on each page (5-10 seconds)
      const waitTime = 5000 + Math.random() * 5000;
      await page.waitForTimeout(waitTime);
      
      // Check for access denied
      const denied = await handleAccessDenied(page, 60); // Longer wait time
      if (!denied) {
        console.log(`   ⚠️  Access denied detected on ${url}`);
        console.log(`   💡 Please manually navigate to lowes.com in the browser`);
        console.log(`   💡 Waiting up to 2 minutes for manual navigation...`);
        await handleAccessDenied(page, 120); // Wait up to 2 minutes
      }
      
      // Extensive human-like behavior simulation
      // Scroll multiple times
      for (let scroll = 0; scroll < 3; scroll++) {
        await page.evaluate(() => {
          window.scrollTo(0, Math.random() * 1500);
        });
        await page.waitForTimeout(1000 + Math.random() * 2000);
      }
      
      // Move mouse in a pattern
      for (let move = 0; move < 3; move++) {
        await page.mouse.move(
          200 + Math.random() * 600, 
          200 + Math.random() * 600,
          { steps: 10 } // Smooth mouse movement
        );
        await page.waitForTimeout(500 + Math.random() * 1000);
      }
      
      // Random clicks on non-interactive areas (simulates reading)
      try {
        await page.mouse.click(400 + Math.random() * 200, 300 + Math.random() * 200, { delay: 100 });
        await page.waitForTimeout(500);
      } catch (e) {
        // Ignore click errors
      }
      
      // Wait between page visits (longer delays)
      if (i < pagesToVisit.length - 1) {
        const betweenPageDelay = 3000 + Math.random() * 4000; // 3-7 seconds
        console.log(`   ⏳ Waiting ${(betweenPageDelay / 1000).toFixed(1)}s before next page...`);
        await page.waitForTimeout(betweenPageDelay);
      }
      
    } catch (e) {
      console.log(`   ⚠️  Error visiting ${url}: ${e.message}`);
      // Continue with next page
    }
  }
  
  // Final check - make sure we're on lowes.com
  const finalUrl = page.url();
  if (!finalUrl.includes('lowes.com') || finalUrl.includes('errors.edgesuite.net')) {
    console.log(`   ⚠️  Not on lowes.com after warm-up - waiting for manual navigation...`);
    await handleAccessDenied(page, 120);
  }
  
  console.log(`   ✅ Extended warm-up complete - session should be well established`);
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
    // Connect to existing Edge instance via remote debugging (opens in new tab)
    console.log('   🔌 Connecting to existing Edge instance on port 9222...');
    
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
        console.log('\n   ❌ ERROR: Could not connect to Edge on port 9222');
        console.log('\n   📋 To fix this, you need to start Edge with remote debugging enabled:');
        console.log('\n   macOS:');
        console.log('   "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" --remote-debugging-port=9222');
        console.log('\n   Windows:');
        console.log('   "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" --remote-debugging-port=9222');
        console.log('\n   Linux:');
        console.log('   microsoft-edge --remote-debugging-port=9222');
        console.log('\n   💡 Make sure Edge is completely closed before starting with this flag');
        console.log('   💡 You can verify it\'s working by visiting: http://localhost:9222/json');
        throw new Error('Edge must be started with --remote-debugging-port=9222. See instructions above.');
      }
    }
    
    connectedToExisting = true;
    console.log('   ✓ Connected to existing Edge instance');
    
    // Get all contexts - use the default context (where manually opened tabs are)
    const contexts = browser.contexts();
    console.log(`   📋 Found ${contexts.length} context(s)`);
    
    // Use the first available context (usually the default one with your tabs)
    // If no contexts exist, create a new one
    if (contexts.length > 0) {
      localContext = contexts[0];
      console.log('   ✓ Using existing Edge context');
    } else {
      // Create a new context in the connected browser
      localContext = await browser.newContext();
      console.log('   ✓ Created new context in existing Edge');
    }
    
    // Always create a new page (new tab) for testing
    localPage = await localContext.newPage();
    console.log('   ✓ Created new tab in existing Edge instance');
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
  
  // Enhanced anti-detection script
  await page.addInitScript(() => {
      // Remove webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
      
      // Override plugins to look real
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          const plugins = [
            { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
            { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
            { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
          ];
          return plugins;
        },
      });
      
      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
      
      // Override chrome property
      window.chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {}
      };
      
      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
      
      // Override getBattery
      if (navigator.getBattery) {
        navigator.getBattery = () => Promise.resolve({
          charging: true,
          chargingTime: 0,
          dischargingTime: Infinity,
          level: 1
        });
      }
      
      // Override platform
      Object.defineProperty(navigator, 'platform', {
        get: () => 'MacIntel',
      });
      
      // Override hardwareConcurrency
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 8,
      });
      
      // Override deviceMemory
      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => 8,
      });
      
      // Override connection
      if (navigator.connection) {
        Object.defineProperty(navigator, 'connection', {
          get: () => ({
            effectiveType: '4g',
            rtt: 50,
            downlink: 10,
            saveData: false
          }),
        });
      }
      
      // Remove automation indicators
      delete navigator.__proto__.webdriver;
      
      // Override toString methods
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) {
          return 'Intel Inc.';
        }
        if (parameter === 37446) {
          return 'Intel Iris OpenGL Engine';
        }
        return getParameter.call(this, parameter);
      };
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
      // Wait for page to be ready
      await page.waitForTimeout(2000);
      
      // Immediately look for customize button once product page is detected
      await clickCustomizeButton(page, null);
    } else {
      // Navigate to product by pasting URL in address bar
      console.log(`   🛒 Navigating to product...`);
      let navigationSuccess = false;
      let retryCount = 0;
      const maxRetries = 3; // Increased retries
      
      while (!navigationSuccess && retryCount <= maxRetries) {
        try {
          if (retryCount > 0) {
            console.log(`   🔄 Retry attempt ${retryCount}/${maxRetries}...`);
            // Wait longer between retries (exponential backoff)
            const backoffDelay = Math.min(10000 * Math.pow(2, retryCount - 1), 30000); // Up to 30 seconds
            console.log(`   ⏳ Waiting ${(backoffDelay / 1000).toFixed(1)}s before retry...`);
            await page.waitForTimeout(backoffDelay);
          }
          
          await navigateToProductOrganically(page, product);
          
          // Wait longer for page to fully load
          await page.waitForTimeout(5000 + Math.random() * 5000);
          
          // Check for access denied after navigation (with longer wait)
          const denied = await handleAccessDenied(page, 90); // 90 seconds wait
          if (denied) {
            // Verify we're actually on a product page
            const currentUrl = page.url();
            const isOnProductPage = currentUrl.includes('lowes.com') && 
                                    (currentUrl.includes('/p/') || 
                                     currentUrl.includes('/configure/') || 
                                     currentUrl.includes('omniItemId='));
            
            if (isOnProductPage) {
              // Additional wait to ensure page is fully loaded
              await page.waitForTimeout(3000 + Math.random() * 3000);
              navigationSuccess = true;
              console.log(`   ✅ Navigated to product page organically`);
              
              // Immediately look for customize button once product page is detected
              // (checkAccessDeniedPeriodic will be defined later, pass null for now)
              await clickCustomizeButton(page, null);
            } else {
              throw new Error('Not on product page after navigation');
            }
          } else {
            throw new Error('Access denied after navigation');
          }
        } catch (e) {
          retryCount++;
          console.log(`   ⚠️  Navigation attempt ${retryCount} failed: ${e.message}`);
          
          if (retryCount > maxRetries) {
            console.log(`\n   ❌ All automated navigation attempts failed`);
            console.log(`   💡 MANUAL INTERVENTION REQUIRED:`);
            console.log(`   💡 The browser tab is open - please manually:`);
            console.log(`      1. Navigate to lowes.com`);
            console.log(`      2. Search for: ${product.name || product.model}`);
            console.log(`      3. Click on the product`);
            console.log(`      4. Wait for the product page to load`);
            console.log(`   💡 The automation will check every 5 seconds and continue when you're ready`);
            console.log(`   💡 Waiting up to 3 minutes for manual navigation...\n`);
            
            // Wait for manual navigation with longer timeout
            const manualSuccess = await handleAccessDenied(page, 180); // 3 minutes
            if (manualSuccess) {
              const currentUrl = page.url();
              const isOnProductPage = currentUrl.includes('lowes.com') && 
                                      (currentUrl.includes('/p/') || 
                                       currentUrl.includes('/configure/') || 
                                       currentUrl.includes('omniItemId='));
              
              if (isOnProductPage) {
                navigationSuccess = true;
                console.log(`   ✅ Manual navigation successful - continuing with test`);
                
                // Immediately look for customize button once product page is detected
                await clickCustomizeButton(page, null);
              } else {
                console.log(`   ⚠️  You're on lowes.com but not on a product page yet`);
                console.log(`   💡 Please navigate to the product page`);
                await handleAccessDenied(page, 120); // Wait another 2 minutes
                const finalUrl = page.url();
                if (finalUrl.includes('/p/') || finalUrl.includes('/configure/') || finalUrl.includes('omniItemId=')) {
                  navigationSuccess = true;
                }
              }
            }
            
            if (!navigationSuccess) {
              throw new Error('Failed to navigate to product after all attempts and manual intervention. Please try again later or use a different approach.');
            }
          }
        }
      }
    }
    
    // Final check for access denied before proceeding (with longer wait)
    await page.waitForTimeout(3000 + Math.random() * 2000);
    
    const finalCheck = await handleAccessDenied(page, 30);
    if (!finalCheck) {
      console.log(`   ⚠️  Access denied still present - waiting for manual resolution...`);
      console.log(`   💡 Please manually navigate to the product page if needed`);
      await handleAccessDenied(page, 120); // Wait up to 2 minutes
    }
    
    console.log(`   ✅ Product page loaded successfully`);
    
    // Periodic check for access denied (catches errors after page refreshes)
    const checkAccessDeniedPeriodic = async () => {
      try {
        const check = await page.evaluate(() => {
          const bodyText = document.body?.textContent || '';
          const title = document.title || '';
          const url = window.location.href || '';
          
          return {
            denied: bodyText.includes('Access Denied') || 
                   title.includes('Access Denied') ||
                   url.includes('errors.edgesuite.net') ||
                   bodyText.includes('Reference #') ||
                   bodyText.includes('You don\'t have permission'),
            url: url
          };
        });
        
        if (check.denied) {
          console.log(`\n   ⚠️  ACCESS DENIED DETECTED (after page interaction)`);
          console.log(`   💡 Current URL: ${check.url}`);
          console.log(`   💡 The browser window is open - please manually navigate back to the product page`);
          console.log(`   💡 Waiting up to 60 seconds for manual navigation...\n`);
          
          const resolved = await handleAccessDenied(page, 60);
          if (!resolved) {
            throw new Error('Access denied persists after manual intervention timeout');
          }
          
          console.log(`   ✅ Access denied resolved - continuing with test`);
        }
      } catch (e) {
        // Ignore check errors, but log them
        if (e.message.includes('Access denied')) {
          throw e;
        }
      }
    };
    
    // Wait for page to fully load before starting interactions
    await page.waitForTimeout(3000);
    
    // Check for access denied before starting
    await checkAccessDeniedPeriodic();
    
    // Scroll to top to ensure we can see configuration options
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);
    
    // Customize button should already be clicked (done immediately after product page detection)
    // But check again in case it wasn't found the first time
    console.log(`   🔧 Starting product configuration (width, height, color)...`);
    
    // Try clicking customize again if needed (in case it wasn't found earlier)
    try {
      const customizeAlreadyClicked = await page.evaluate(() => {
        // Check if we're already in customize mode by looking for configuration options
        const hasConfigOptions = document.querySelector('select[name*="width" i], select[name*="height" i], [class*="color" i][class*="selector" i]');
        return !!hasConfigOptions;
      });
      
      if (!customizeAlreadyClicked) {
        console.log(`   🔍 Re-checking for "Customize" button...`);
        await clickCustomizeButton(page, checkAccessDeniedPeriodic);
      }
    } catch (e) {
      // Continue anyway
    }
    
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

    // Wait longer for price to update after dimension selection (page may refresh)
    await page.waitForTimeout(4000 + Math.random() * 3000);
    
    // Check for access denied after dimension selection (page may refresh)
    await checkAccessDeniedPeriodic();
    
    // Additional wait to ensure page is stable
    await page.waitForTimeout(2000 + Math.random() * 2000);

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

    // Wait longer for price to update after color selection (page may refresh)
    await page.waitForTimeout(4000 + Math.random() * 3000);
    
    // Check for access denied after color selection (page may refresh)
    await checkAccessDeniedPeriodic();
    
    // Additional wait to ensure page is stable
    await page.waitForTimeout(2000 + Math.random() * 2000);

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
    console.log('\n🚀 Connecting to existing Edge instance...');
    
    // Connect to existing Edge instance via remote debugging (REQUIRED)
    try {
      browser = await chromium.connectOverCDP('http://localhost:9222');
    } catch (e1) {
      console.log(`   ⚠️  localhost failed: ${e1.message}, trying 127.0.0.1...`);
      try {
        browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
      } catch (e2) {
        console.log('\n   ❌ ERROR: Could not connect to Edge on port 9222');
        console.log('\n   📋 To fix this, you need to start Edge with remote debugging enabled:');
        console.log('\n   macOS:');
        console.log('   "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" --remote-debugging-port=9222');
        console.log('\n   Windows:');
        console.log('   "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" --remote-debugging-port=9222');
        console.log('\n   Linux:');
        console.log('   microsoft-edge --remote-debugging-port=9222');
        console.log('\n   💡 Make sure Edge is completely closed before starting with this flag');
        console.log('   💡 You can verify it\'s working by visiting: http://localhost:9222/json');
        throw new Error('Edge must be started with --remote-debugging-port=9222. See instructions above.');
      }
    }
    
    connectedToExisting = true;
    console.log('   ✓ Connected to existing Edge instance (will open in new tab)');
    
    // Get existing context or use the default one
    const contexts = browser.contexts();
    if (contexts.length > 0) {
      context = contexts[0];
      console.log('   ✓ Using existing Edge context');
    } else {
      // Create a new context in the connected browser
      context = await browser.newContext();
      console.log('   ✓ Created new context in existing Edge');
    }
    
    // Always create a new page (new tab) for testing
    page = await context.newPage();
    console.log('   ✓ Created new tab in existing Edge instance');
    
    // Enhanced anti-detection script (same as in testProduct)
    await page.addInitScript(() => {
      // Remove webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
      
      // Override plugins to look real
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          const plugins = [
            { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
            { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
            { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
          ];
          return plugins;
        },
      });
      
      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
      
      // Override chrome property
      window.chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {}
      };
      
      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
      
      // Override getBattery
      if (navigator.getBattery) {
        navigator.getBattery = () => Promise.resolve({
          charging: true,
          chargingTime: 0,
          dischargingTime: Infinity,
          level: 1
        });
      }
      
      // Override platform
      Object.defineProperty(navigator, 'platform', {
        get: () => 'MacIntel',
      });
      
      // Override hardwareConcurrency
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 8,
      });
      
      // Override deviceMemory
      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => 8,
      });
      
      // Override connection
      if (navigator.connection) {
        Object.defineProperty(navigator, 'connection', {
          get: () => ({
            effectiveType: '4g',
            rtt: 50,
            downlink: 10,
            saveData: false
          }),
        });
      }
      
      // Remove automation indicators
      delete navigator.__proto__.webdriver;
      
      // Override toString methods
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) {
          return 'Intel Inc.';
        }
        if (parameter === 37446) {
          return 'Intel Iris OpenGL Engine';
        }
        return getParameter.call(this, parameter);
      };
    });
    
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);
    
    // Now test all products
    for (const product of products) {
      // Check if we should stop before each product
      if (shouldStop()) {
        console.log('\n🛑 Testing stopped by user');
        break;
      }
      
      // Pause before each product to allow manual navigation if needed
      console.log(`\n⏸️  Preparing to test: ${product.name}`);
      console.log(`   💡 If you need to manually navigate, do so now in the browser tab`);
      console.log(`   💡 The automation will start in 5 seconds...`);
      await page.waitForTimeout(5000);
      
      // Check current state before starting
      const currentUrl = page.url();
      if (!currentUrl.includes('lowes.com') || currentUrl.includes('errors.edgesuite.net')) {
        console.log(`   ⚠️  Not on lowes.com - waiting for manual navigation...`);
        const resolved = await handleAccessDenied(page, 60);
        if (!resolved) {
          console.log(`   ⚠️  Still not on lowes.com - attempting to navigate...`);
          try {
            await page.goto('https://www.lowes.com', {
              waitUntil: 'networkidle',
              timeout: 90000
            });
            await page.waitForTimeout(5000 + Math.random() * 5000);
            await handleAccessDenied(page, 60);
          } catch (e) {
            console.log(`   ⚠️  Navigation failed: ${e.message}`);
          }
        }
      }
      
      try {
        const result = await testProduct(product, { 
          ...options, 
          shouldStop,
          page, // Reuse the same page
          context // Reuse the same context
        });
        results.push(result);
        
        // Add longer delay between tests to avoid rate limiting
        if (products.indexOf(product) < products.length - 1 && !shouldStop()) {
          const delay = 8000 + Math.random() * 7000; // 8-15 seconds between products
          console.log(`   ⏳ Waiting ${(delay / 1000).toFixed(1)}s before next product (avoiding rate limits)...\n`);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Re-check access denied between products
          const betweenCheck = await handleAccessDenied(page, 10);
          if (!betweenCheck) {
            console.log(`   ⚠️  Access denied detected between products - waiting for resolution...`);
            await handleAccessDenied(page, 60);
          }
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
