const { chromium } = require('playwright');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const os = require('os');

class MAdminScraper extends EventEmitter {
  constructor(options = {}) {
    super();
    this.browser = null;
    this.page = null;
    this.userDataDir = path.join(os.homedir(), '.madmin-scraper-data');
    this.inactiveLinks = [];
    this.noTestLinks = []; // Track merchants with no ShareASale/Awin test links
    this.shouldStop = false;
    this.isPaused = false;
    
    // New option for URL testing mode
    this.testingMode = options.testingMode || 'awin'; // 'awin' or 'url'
    console.log(`🔧 MAdmin Scraper initialized with testing mode: ${this.testingMode}`);
  }

  async initialize() {
    try {
      console.log('🔧 Initializing MAdmin scraper with persistent login...');
      
      // Create user data directory if it doesn't exist
      if (!fs.existsSync(this.userDataDir)) {
        fs.mkdirSync(this.userDataDir, { recursive: true });
        console.log('📁 Created MAdmin user data directory for persistent sessions');
      }
      
      // Use persistent context to maintain login sessions (like Wildlink scraper)
      this.browser = await chromium.launchPersistentContext(this.userDataDir, {
        headless: false,
        args: [
          '--no-first-run',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-focus-on-show', // Prevent focus stealing
          '--no-default-browser-check'
        ]
      });
      
      // Get the first page (persistent context creates one automatically)
      const pages = this.browser.pages();
      this.page = pages.length > 0 ? pages[0] : await this.browser.newPage();
      
      console.log('✅ MAdmin scraper initialized with persistent login sessions');
      this.emit('progress', { message: '🔒 Login sessions will be remembered for future use' });
      
      return true;
      
    } catch (error) {
      console.error('❌ Error initializing MAdmin scraper:', error);
      throw error;
    }
  }

  async navigateToMAdmin() {
    try {
      console.log('🌐 Navigating directly to https://admin.wildlink.me/merchant-admin...');
      this.emit('progress', { message: 'Opening MAdmin merchant testing page...' });
      
      await this.page.goto('https://admin.wildlink.me/merchant-admin', {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // Handle login if needed
      await this.handleLoginIfNeeded();

      // Wait for the page to fully load
      await this.page.waitForTimeout(3000);

      console.log('✅ Successfully navigated to MAdmin merchant-admin page');
      this.emit('progress', { message: 'MAdmin page loaded, ready to test merchants' });
      return true;
    } catch (error) {
      console.error('❌ Error navigating to MAdmin:', error);
      throw error;
    }
  }

  async handleLoginIfNeeded() {
    try {
      // Check if we're on a login page
      const isLoginPage = await this.page.evaluate(() => {
        const url = window.location.href;
        const hasLoginForm = document.querySelector('input[type="password"]') !== null;
        const hasEmailField = document.querySelector('input[type="email"]') !== null;
        return url.includes('login') || url.includes('auth') || (hasLoginForm && hasEmailField);
      });

      if (isLoginPage) {
        console.log('🔐 Login required - please log in manually');
        this.emit('progress', { message: 'Please log in to MAdmin portal manually...' });
        
        // Wait for user to complete login (detect navigation away from login page)
        await this.page.waitForFunction(() => {
          const url = window.location.href;
          const hasLoginForm = document.querySelector('input[type="password"]') !== null;
          const hasEmailField = document.querySelector('input[type="email"]') !== null;
          return !url.includes('login') && !url.includes('auth') && !(hasLoginForm && hasEmailField);
        }, { timeout: 120000 }); // 2 minute timeout for manual login

        console.log('✅ Login completed');
        this.emit('progress', { message: 'Login completed successfully' });
      }
    } catch (error) {
      console.warn('Login detection failed:', error.message);
    }
  }

  async testMerchants(merchants) {
    try {
      console.log(`🧪 Starting to test ${merchants.length} merchants...`);
      this.shouldStop = false; // Reset stop flag
      this.isPaused = false; // Reset pause flag
      
      this.emit('progress', { 
        message: `Testing ${merchants.length} merchants...`,
        total: merchants.length,
        tested: 0,
        inactive: 0
      });
      
      this.inactiveLinks = [];
      this.noTestLinks = []; // Reset no test links array
      let testedCount = 0;

      for (const merchant of merchants) {
        // Check if we should stop
        if (this.shouldStop) {
          console.log('🛑 MAdmin testing stopped by user');
          this.emit('progress', { message: 'Testing stopped by user' });
          break;
        }

        // Wait if paused
        await this.waitIfPaused();

        // Check again after waiting
        if (this.shouldStop) {
          console.log('🛑 MAdmin testing stopped by user');
          this.emit('progress', { message: 'Testing stopped by user' });
          break;
        }

        try {
          console.log(`🔍 Testing merchant: ${merchant}`);
          this.emit('progress', { 
            message: `Testing ${merchant}... (${testedCount + 1}/${merchants.length})`,
            currentMerchant: merchant,
            total: merchants.length,
            tested: testedCount,
            inactive: this.inactiveLinks.length
          });

          const testResult = await this.searchAndTestMerchant(merchant);
          testedCount++;

          // Handle the different result types
          if (testResult) {
            if (testResult.status === 'tested') {
              // Merchant was tested successfully
              const isActive = testResult.isActive;
              if (!isActive) {
                // Prevent duplicate entries
                if (!this.inactiveLinks.includes(merchant)) {
                  this.inactiveLinks.push(merchant);
                  console.log(`📝 Added ${merchant} to inactive links list (total: ${this.inactiveLinks.length})`);
                } else {
                  console.log(`⚠️ ${merchant} already in inactive links list - skipping duplicate`);
                }
              } else {
                console.log(`✅ ${merchant} is active`);
              }
              
              // Emit individual result progress
              this.emit('progress', { 
                result: { merchant, merchantId: this.currentMerchantId, isActive: isActive, isUnavailable: !isActive }
              });
              
              // Emit updated progress counts immediately after result
              this.emit('progress', { 
                message: `Completed ${merchant} (${testedCount}/${merchants.length})`,
                currentMerchant: merchant,
                total: merchants.length,
                tested: testedCount,
                inactive: this.inactiveLinks.length,
                noTestLink: this.noTestLinks.length
              });
              
            } else if (testResult.status === 'no_test_link') {
              // No ShareASale/Awin test links found
              // Prevent duplicate entries
              if (!this.noTestLinks.includes(merchant)) {
                this.noTestLinks.push(merchant);
                console.log(`📝 Added ${merchant} to no test links list (total: ${this.noTestLinks.length})`);
              } else {
                console.log(`⚠️ ${merchant} already in no test links list - skipping duplicate`);
              }
              
              // Emit individual result progress for no test link
              this.emit('progress', { 
                result: { merchant, merchantId: this.currentMerchantId, hasNoTestLink: true }
              });
              
              // Emit updated progress counts immediately after result
              this.emit('progress', { 
                message: `Completed ${merchant} - No test links (${testedCount}/${merchants.length})`,
                currentMerchant: merchant,
                total: merchants.length,
                tested: testedCount,
                inactive: this.inactiveLinks.length,
                noTestLink: this.noTestLinks.length
              });
            }
          } else {
            // If testResult is null/undefined, it means the merchant was skipped
            console.log(`[${merchant}] ⚠️ Merchant was skipped - adding to no test link category`);
            // Prevent duplicate entries
            if (!this.noTestLinks.includes(merchant)) {
              this.noTestLinks.push(merchant);
              console.log(`📝 Added skipped ${merchant} to no test links list (total: ${this.noTestLinks.length})`);
            } else {
              console.log(`⚠️ Skipped ${merchant} already in no test links list - skipping duplicate`);
            }
            
            // Emit individual result progress for skipped merchant
            this.emit('progress', { 
              result: { merchant, merchantId: this.currentMerchantId, hasNoTestLink: true }
            });
            
            // Emit updated progress counts immediately after result
            this.emit('progress', { 
              message: `Skipped ${merchant} (${testedCount}/${merchants.length})`,
              currentMerchant: merchant,
              total: merchants.length,
              tested: testedCount,
              inactive: this.inactiveLinks.length,
              noTestLink: this.noTestLinks.length
            });
          }

          // Small delay between merchants (but check for stop/pause)
          for (let i = 0; i < 20; i++) { // 2 second delay broken into 100ms chunks
            if (this.shouldStop) break;
            await this.waitIfPaused();
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.error(`❌ Error testing merchant ${merchant}:`, error.message);
          // Continue with next merchant even if one fails
        }
      }

      console.log(`✅ Completed testing ${testedCount} merchants.`);
      console.log(`📊 Final Results Summary:`);
      console.log(`   - Total merchants processed: ${testedCount}`);
      console.log(`   - Merchants with inactive links: ${this.inactiveLinks.length}`);
      console.log(`   - Merchants with no test links: ${this.noTestLinks.length}`);
      console.log(`   - Inactive merchants list:`, this.inactiveLinks);
      console.log(`   - No test link merchants list:`, this.noTestLinks);
      
      return {
        tested: testedCount,
        inactive: this.inactiveLinks.length,
        inactiveLinks: this.inactiveLinks,
        noTestLinks: this.noTestLinks
      };
    } catch (error) {
      console.error('❌ Error in testMerchants:', error);
      throw error;
    }
  }

  async searchAndTestMerchant(merchant) {
    try {
      // Check for pause/stop before starting
      if (this.shouldStop) return null;
      await this.waitIfPaused();
      
      console.log(`🔍 Searching for merchant: ${merchant}`);
      this.emit('progress', { message: `Searching for ${merchant}...` });

      // No need to navigate back to search page - the search bar should be available on any page
      // Wait for page to be ready (but check for pause)
      for (let i = 0; i < 20; i++) { // 2 second delay broken into 100ms chunks
        if (this.shouldStop) return null;
        await this.waitIfPaused();
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Look for search input with multiple strategies
      let searchInput = null;
      
      // Strategy 1: Common search input selectors
      const searchSelectors = [
        'input[type="search"]',
        'input[placeholder*="search" i]',
        'input[placeholder*="merchant" i]',
        'input[name*="search" i]',
        'input[id*="search" i]',
        '.search-input',
        '.search-field',
        '[data-testid*="search"]',
        'input[type="text"]'
      ];

      for (const selector of searchSelectors) {
        try {
          const elements = await this.page.$$(selector);
          if (elements.length > 0) {
            // Check if the input is visible and not disabled
            for (const element of elements) {
              const isVisible = await element.isVisible();
              const isEnabled = await element.isEnabled();
              if (isVisible && isEnabled) {
                searchInput = element;
                console.log(`✅ Found search input with selector: ${selector}`);
                break;
              }
            }
            if (searchInput) break;
          }
        } catch (error) {
          // Continue to next selector
        }
      }

      if (!searchInput) {
        console.log(`⚠️ Could not find search input for merchant: ${merchant}`);
        return;
      }

      // Clear and type merchant name
      // Check for pause/stop before typing
      if (this.shouldStop) return null;
      await this.waitIfPaused();
      
      await searchInput.click();
      await searchInput.fill('');
      await this.page.waitForTimeout(500);
      await searchInput.type(merchant, { delay: 100 });
      
      console.log(`✅ Typed "${merchant}" into search bar`);
      this.emit('progress', { message: `Typed ${merchant} into search...` });

      // Wait for dropdown/suggestions to appear (but check for pause)
      for (let i = 0; i < 20; i++) { // 2 second wait broken into 100ms chunks
        if (this.shouldStop) return null;
        await this.waitIfPaused();
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Look for dropdown results and click on matching merchant
      const clicked = await this.page.evaluate((merchantName) => {
        // Look for dropdown items, suggestions, or results
        const dropdownSelectors = [
          '.dropdown-item', '.suggestion', '.search-result', '.autocomplete-item',
          '[role="option"]', '.menu-item', '.result-item', '.list-item',
          '.search-dropdown li', '.search-suggestions li', 'ul li',
          '[class*="dropdown"] li', '[class*="suggestion"] li'
        ];

        for (const selector of dropdownSelectors) {
          const items = document.querySelectorAll(selector);
          for (const item of items) {
            const text = item.textContent?.trim().toLowerCase();
            if (text && (text.includes(merchantName.toLowerCase()) || merchantName.toLowerCase().includes(text))) {
              console.log(`Found merchant in dropdown: "${item.textContent?.trim()}" - clicking...`);
              item.click();
              return { success: true, text: item.textContent?.trim() };
            }
          }
        }

        // Also try clicking on any visible text that matches
        const allElements = document.querySelectorAll('*');
        for (const el of allElements) {
          if (el.children.length === 0) { // Text nodes only
            const text = el.textContent?.trim().toLowerCase();
            if (text && text.includes(merchantName.toLowerCase()) && text.length < 100) {
              const rect = el.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) { // Visible element
                console.log(`Found merchant text: "${el.textContent?.trim()}" - clicking...`);
                el.click();
                return { success: true, text: el.textContent?.trim() };
              }
            }
          }
        }
        
        return { success: false };
      }, merchant);

      if (clicked.success) {
        console.log(`✅ Clicked on merchant: ${merchant} (${clicked.text})`);
        this.emit('progress', { message: `Selected ${merchant} from dropdown` });
        await this.page.waitForTimeout(3000); // Wait for page to load
        
        // Capture merchant ID from URL after navigation
        const currentUrl = this.page.url();
        console.log(`[${merchant}] Current URL after merchant selection: ${currentUrl}`);
        
        // Extract merchant ID from URL
        const merchantIdMatch = currentUrl.match(/merchant[\/\-_]?(\d+)/i);
        const merchantId = merchantIdMatch ? merchantIdMatch[1] : null;
        
        if (merchantId) {
          console.log(`[${merchant}] ✅ Captured merchant ID: ${merchantId}`);
          this.currentMerchantId = merchantId;
        } else {
          console.log(`[${merchant}] ⚠️ Could not extract merchant ID from URL: ${currentUrl}`);
          this.currentMerchantId = null;
        }
        
        // Now look for test links
        const testResult = await this.findAndTestLinks(merchant);
        return testResult; // Return the result from findAndTestLinks
      } else {
        console.log(`⚠️ Could not find merchant ${merchant} in dropdown - trying to press Enter`);
        
        // Try pressing Enter as fallback
        await this.page.keyboard.press('Enter');
        await this.page.waitForTimeout(3000);
        
        // Still try to find test links
        const testResult = await this.findAndTestLinks(merchant);
        return testResult; // Return the result from findAndTestLinks
      }
    } catch (error) {
      console.error(`Error searching for merchant ${merchant}:`, error.message);
      this.emit('progress', { message: `Error searching for ${merchant}: ${error.message}` });
    }
  }

  async findAndTestLinks(merchant) {
    try {
      // Check for pause/stop before starting
      if (this.shouldStop) return null;
      await this.waitIfPaused();
      
      if (this.testingMode === 'url') {
        console.log(`🔗 Looking for available URLs for ${merchant}...`);
        this.emit('progress', { message: `Looking for available URLs for ${merchant}...` });
      } else {
        console.log(`🔗 Looking for ShareASale or Awin test links for ${merchant}...`);
        this.emit('progress', { message: `Looking for test links for ${merchant}...` });
      }

      // Wait for page to fully load (increased wait time)
      for (let i = 0; i < 50; i++) { // 5 second wait broken into 100ms chunks
        if (this.shouldStop) return null;
        await this.waitIfPaused();
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (this.testingMode === 'url') {
        console.log(`[${merchant}] 🔍 Looking for available URLs after page load...`);
      } else {
        console.log(`[${merchant}] 🔍 Looking for ShareASale or Awin test links after page load...`);
      }

      // Wait for any dynamic content to load (additional wait)
      await this.page.waitForTimeout(2000);
      console.log(`[${merchant}] ⏳ Additional wait completed, now scanning for ${this.testingMode === 'url' ? 'URLs' : 'test links'}...`);

      // Choose detection method based on testing mode
      const testLinks = await this.page.evaluate((testingMode) => {
        const links = [];
        
        if (testingMode === 'url') {
          console.log('[MAdmin] Looking for available URLs on merchant page...');
          
          // Look for merchant website URLs in various places
          const allElements = document.querySelectorAll('*');
          const urlPatterns = [
            /https?:\/\/[^\s<>"']+\.[a-z]{2,}/gi, // Basic URL pattern
          ];
          
          for (const el of allElements) {
            const href = el.getAttribute('href') || '';
            const text = el.textContent?.trim() || '';
            const value = el.value || '';
            
            // Check href attributes for direct URLs
            if (href && href.startsWith('http') && !href.includes('wildlink.me') && !href.includes('admin.wildlink.me')) {
              // Skip internal admin links and focus on merchant URLs
              if (!href.includes('awin') && !href.includes('shareasale') && !href.includes('commission')) {
                links.push({
                  text: text || el.getAttribute('title') || 'Available URL',
                  href: href,
                  type: 'URL',
                  element: el,
                  isInput: false
                });
              }
            }
            
            // Check text content for URLs
            const textUrls = text.match(urlPatterns);
            if (textUrls) {
              textUrls.forEach(url => {
                if (!url.includes('wildlink.me') && !url.includes('admin.wildlink.me')) {
                  links.push({
                    text: `URL found in text: ${url}`,
                    href: url,
                    type: 'URL',
                    element: el,
                    isInput: false
                  });
                }
              });
            }
            
            // Check input values for URLs
            if (el.tagName.toLowerCase() === 'input' && value && value.startsWith('http')) {
              if (!value.includes('wildlink.me') && !value.includes('admin.wildlink.me')) {
                links.push({
                  text: 'URL from input field',
                  href: value,
                  type: 'URL',
                  element: el,
                  isInput: true
                });
              }
            }
          }
          
          // Remove duplicates based on href
          const uniqueLinks = [];
          const seenUrls = new Set();
          for (const link of links) {
            if (!seenUrls.has(link.href)) {
              seenUrls.add(link.href);
              uniqueLinks.push(link);
            }
          }
          
          console.log(`[MAdmin] Found ${uniqueLinks.length} unique URLs total`);
          return uniqueLinks.slice(0, 5); // Limit to first 5 URLs to avoid overwhelming
          
        } else {
          // Original Awin link detection
          console.log('[MAdmin] Looking specifically for Awin links starting with https://www.awin1.com/...');
          
          // Look for all elements that might contain the specific Awin URL
          const allElements = document.querySelectorAll('*');
          
          for (const el of allElements) {
            const href = el.getAttribute('href') || '';
            const onclick = el.getAttribute('onclick') || '';
            const text = el.textContent?.trim() || '';
            const value = el.value || '';
            
            // Check if this element has the specific Awin URL we're looking for
            const hasAwin1Url = href.startsWith('https://www.awin1.com/') || 
                               onclick.includes('https://www.awin1.com/') ||
                               value.startsWith('https://www.awin1.com/');
            
            if (hasAwin1Url) {
              const awinUrl = href.startsWith('https://www.awin1.com/') ? href :
                             onclick.includes('https://www.awin1.com/') ? onclick :
                             value.startsWith('https://www.awin1.com/') ? value : '';
              
              console.log(`[MAdmin] Found Awin link: Element=${el.tagName}, Text="${text.substring(0, 50)}", URL="${awinUrl.substring(0, 150)}"`);
              
              // For input fields with URLs, we'll need special handling
              if (el.tagName.toLowerCase() === 'input' && value.startsWith('https://www.awin1.com/')) {
                links.push({
                  text: text || 'Awin Test Link',
                  href: value,
                  onclick: onclick,
                  type: 'Awin',
                  element: el,
                  isInput: true
                });
              } else if (el.offsetParent !== null || el.tagName.toLowerCase() === 'input') { // Must be visible or an input
                links.push({
                  text: text || 'Awin Test Link',
                  href: awinUrl,
                  onclick: onclick,
                  type: 'Awin',
                  element: el,
                  isInput: false
                });
              }
            }
          }
          
          console.log(`[MAdmin] Found ${links.length} Awin links total`);
          return links;
        }
      }, this.testingMode);

      console.log(`[${merchant}] Found ${testLinks.length} potential test links:`);
      testLinks.forEach((link, i) => {
        console.log(`[${merchant}]   ${i+1}. ${link.type}: "${link.text}" -> ${link.href?.substring(0, 80) || 'no href'}`);
        console.log(`[${merchant}]      isInput: ${link.isInput}, element: ${link.element?.tagName || 'unknown'}`);
      });
      this.emit('progress', { message: `Found ${testLinks.length} potential test links for ${merchant}` });

      if (testLinks.length === 0) {
        if (this.testingMode === 'url') {
          console.log(`[${merchant}] ⚠️ No available URLs found on merchant page`);
          this.emit('progress', { message: `No available URLs found for ${merchant}` });
        } else {
          console.log(`[${merchant}] ⚠️ No Awin links starting with https://www.awin1.com/ found`);
          this.emit('progress', { message: `No Awin test links found for ${merchant}` });
        }
        
        // Log what links ARE available for debugging
        const allLinks = await this.page.evaluate(() => {
          return Array.from(document.querySelectorAll('a[href], input[value]')).slice(0, 10).map(el => ({
            tag: el.tagName,
            text: el.textContent?.trim(),
            href: el.href || el.value || '',
            hasAwin: (el.href || el.value || '').includes('awin')
          }));
        });
        console.log(`[${merchant}] Available links on page:`, allLinks);
        
        // Return status indicating no test links found
        return { status: 'no_test_link', merchant };
      }

      if (testLinks.length > 1) {
        console.log(`[${merchant}] ⚠️ Found ${testLinks.length} Awin links, expected only 1. Using the first one.`);
        testLinks.forEach((link, i) => {
          console.log(`[${merchant}]   ${i+1}. "${link.text}" -> ${link.href?.substring(0, 100)}`);
        });
      }

      // Use the first link found
      const linkToTest = testLinks[0];
      if (this.testingMode === 'url') {
        console.log(`[${merchant}] 🧪 Testing the available URL: "${linkToTest.text}"`);
        console.log(`[${merchant}] 🔗 URL details: href="${linkToTest.href?.substring(0, 150)}"`);
        this.emit('progress', { message: `Testing available URL for ${merchant}...` });
      } else {
        console.log(`[${merchant}] 🧪 Testing the Awin link: "${linkToTest.text}"`);
        console.log(`[${merchant}] 🔗 Link details: href="${linkToTest.href?.substring(0, 150)}", isInput=${linkToTest.isInput}`);
        console.log(`[${merchant}] 🔗 Link element: ${linkToTest.element?.tagName || 'unknown'}`);
        this.emit('progress', { message: `Testing Awin link for ${merchant}...` });
      }
      
      console.log(`[${merchant}] ⏳ Calling testLink method...`);
      const testResult = await this.testLink(merchant, linkToTest);
      console.log(`[${merchant}] 📊 testLink returned:`, testResult);
      console.log(`[${merchant}] 📊 testResult type:`, typeof testResult);
      console.log(`[${merchant}] 📊 testResult === null:`, testResult === null);
      console.log(`[${merchant}] 📊 testResult === false:`, testResult === false);
      console.log(`[${merchant}] 📊 testResult && typeof testResult === 'object':`, testResult && typeof testResult === 'object');
      console.log(`[${merchant}] 📊 testResult.hasOwnProperty('isActive'):`, testResult && testResult.hasOwnProperty && testResult.hasOwnProperty('isActive'));
      
      // CRITICAL: Clean up all extra tabs immediately after getting any result
      try {
        const allPagesForCleanup = await this.browser.pages();
        console.log(`[${merchant}] 🧹 POST-RESULT CLEANUP - Found ${allPagesForCleanup.length} total pages, closing extras...`);
        
        // Close all tabs except the first one (admin page)
        for (let i = 1; i < allPagesForCleanup.length; i++) {
          try {
            await allPagesForCleanup[i].close();
            console.log(`[${merchant}] ✅ POST-RESULT - Closed tab ${i}`);
          } catch (closeErr) {
            console.log(`[${merchant}] ⚠️ POST-RESULT - Could not close tab ${i}: ${closeErr.message}`);
          }
        }
        
        const remainingPages = await this.browser.pages();
        console.log(`[${merchant}] 🧹 POST-RESULT CLEANUP COMPLETE - ${remainingPages.length} pages remaining (should be 1)`);
        
      } catch (cleanupError) {
        console.error(`[${merchant}] ❌ Error during post-result cleanup:`, cleanupError.message);
      }
      
      if (testResult === null) {
        console.log(`[${merchant}] ⏸️ Testing was stopped or paused`);
        return null;
      } else if (testResult && typeof testResult === 'object' && testResult.hasOwnProperty('isActive')) {
        // Successfully tested the Awin link, return the result
        console.log(`[${merchant}] ✅ Successfully tested Awin link: ${testResult.isActive ? 'ACTIVE' : 'INACTIVE'}`);
        this.emit('progress', { message: `✅ Completed testing Awin link for ${merchant}: ${testResult.isActive ? 'Active' : 'Inactive'}` });
        console.log(`[${merchant}] 🎯 FINAL RESULT - Returning: { status: 'tested', merchant: '${merchant}', isActive: ${testResult.isActive} }`);
        return { status: 'tested', merchant, isActive: testResult.isActive };
      } else if (testResult === false) {
        // Failed to test the link (couldn't click it or no new tab opened)
        console.log(`[${merchant}] ❌ Failed to test Awin link - could not click link or no new tab opened`);
        this.emit('progress', { message: `❌ Failed to test Awin link for ${merchant}` });
        console.log(`[${merchant}] 🎯 FINAL RESULT - Returning: { status: 'no_test_link', merchant: '${merchant}' }`);
        return { status: 'no_test_link', merchant }; // Treat failed click as no test link
      } else {
        // Unexpected result
        console.log(`[${merchant}] ⚠️ Unexpected testLink result:`, testResult);
        console.log(`[${merchant}] ⚠️ This should not happen - all cases should be covered above`);
        this.emit('progress', { message: `⚠️ Unexpected result testing Awin link for ${merchant}` });
        console.log(`[${merchant}] 🎯 FINAL RESULT - Returning: { status: 'no_test_link', merchant: '${merchant}' } (unexpected)`);
        return { status: 'no_test_link', merchant };
      }
      
      // If we get here, no links were successfully tested
      console.log(`[${merchant}] ⚠️ No affiliate links could be tested`);
      this.emit('progress', { message: `No testable affiliate links found for ${merchant}` });
      return { status: 'no_test_link', merchant }; // Return status for no testable links
      
    } catch (error) {
      console.error(`Error finding test links for ${merchant}:`, error.message);
      this.emit('progress', { message: `Error finding test links for ${merchant}: ${error.message}` });
    }
  }

  async testLink(merchant, linkInfo) {
    let linkWasClicked = false; // Track if link was successfully clicked
    
    console.log(`[${merchant}] 🧪 === STARTING testLink method ===`);
    console.log(`[${merchant}] 🧪 Method called with linkInfo:`, {
      text: linkInfo.text,
      href: linkInfo.href?.substring(0, 200),
      type: linkInfo.type,
      isInput: linkInfo.isInput,
      element: linkInfo.element?.tagName
    });
    
    try {
      console.log(`[${merchant}] 🧪 === STARTING testLink method ===`);
      console.log(`[${merchant}] 🧪 Testing link: "${linkInfo.text}" (${linkInfo.type})`);
      console.log(`[${merchant}] 🧪 Link href: ${linkInfo.href?.substring(0, 200) || 'no href'}`);
      console.log(`[${merchant}] 🧪 Link isInput: ${linkInfo.isInput}`);
      this.emit('progress', { message: `Testing link: ${merchant} - ${linkInfo.text}` });

      // Check for pause/stop before starting link test
      if (this.shouldStop) {
        console.log(`[${merchant}] 🛑 Stopped before testing link`);
        return null;
      }
      await this.waitIfPaused();

      // URL TESTING MODE: Click on URL container to test merchant website
      if (this.testingMode === 'url') {
        console.log(`[${merchant}] 🌐 URL TESTING MODE: Looking for merchant URL to test...`);
        
        try {
          // First, try to find and click the URL field/container in the MAdmin interface
          console.log(`[${merchant}] 🔍 Looking for URL field in MAdmin interface...`);
          
          // Look for URL field/container with various selectors
          const urlSelectors = [
            'input[value*="http"]', // URL input field
            '[data-field="url"]', // Data attribute for URL field
            '.url-field', // URL field class
            '.merchant-url', // Merchant URL class
            'a[href*="http"]:not([href*="wildlink"]):not([href*="admin"])', // Direct URL links (excluding admin links)
            'td:has-text("http")', // Table cell containing URL
            'div:has-text("http")', // Div containing URL
            '.field:has-text("URL")', // Field containing "URL" text
            'label:has-text("URL") + input', // Input after URL label
            'label:has-text("Website") + input' // Input after Website label
          ];
          
          let urlElement = null;
          let merchantUrl = null;
          
          // Try each selector to find the URL
          for (const selector of urlSelectors) {
            try {
              const elements = await this.page.$$(selector);
              for (const element of elements) {
                const href = await element.getAttribute('href');
                const value = await element.getAttribute('value');
                const text = await element.textContent();
                
                // Check if this element contains a valid merchant URL
                const potentialUrl = href || value || text;
                if (potentialUrl && potentialUrl.startsWith('http') && 
                    !potentialUrl.includes('wildlink.me') && 
                    !potentialUrl.includes('admin.wildlink.me')) {
                  
                  urlElement = element;
                  merchantUrl = potentialUrl.trim();
                  console.log(`[${merchant}] 🎯 Found merchant URL: ${merchantUrl}`);
                  break;
                }
              }
              if (urlElement) break;
            } catch (selectorError) {
              // Continue to next selector if this one fails
              continue;
            }
          }
          
          // If no URL element found, try to extract from page content
          if (!urlElement || !merchantUrl) {
            console.log(`[${merchant}] 🔍 No clickable URL found, extracting from page content...`);
            
            const pageContent = await this.page.textContent('body');
            const urlMatch = pageContent.match(/https?:\/\/[^\s<>"']+\.[a-z]{2,}/gi);
            
            if (urlMatch) {
              // Filter out admin URLs and find merchant URL
              const merchantUrls = urlMatch.filter(url => 
                !url.includes('wildlink.me') && 
                !url.includes('admin.wildlink.me') &&
                !url.includes('awin') &&
                !url.includes('shareasale')
              );
              
              if (merchantUrls.length > 0) {
                merchantUrl = merchantUrls[0];
                console.log(`[${merchant}] 📄 Extracted merchant URL from content: ${merchantUrl}`);
              }
            }
          }
          
          if (!merchantUrl) {
            console.log(`[${merchant}] ❌ No merchant URL found to test`);
            return { isActive: true }; // Don't flag if we can't find URL to test
          }
          
          // Now test the merchant URL
          console.log(`[${merchant}] 🌐 Testing merchant URL: ${merchantUrl}`);
          
          // If we have a clickable element, try clicking it first
          if (urlElement) {
            try {
              console.log(`[${merchant}] 🖱️ Attempting to click URL element...`);
              
              // Scroll element into view and click
              await urlElement.scrollIntoView();
              await this.page.waitForTimeout(1000);
              
              // Try clicking the element
              await urlElement.click();
              
              // Wait for potential new tab to open
              await this.page.waitForTimeout(2000);
              
              // Check if a new tab opened
              const pages = await this.browser.pages();
              if (pages.length > 1) {
                // Use the new tab that opened
                const newPage = pages[pages.length - 1];
                console.log(`[${merchant}] 🎯 New tab opened, using it for testing`);
                
                // Wait for the page to load
                await newPage.waitForLoadState('domcontentloaded');
                await newPage.waitForTimeout(3000);
                
                const response = { status: () => 200 }; // Assume success if tab opened
                const pageTitle = await newPage.title();
                const pageContent = await newPage.textContent('body');
                
                // Test the opened page
                const testResult = await this.testPageForUnavailability(merchant, newPage, pageTitle, pageContent, response);
                
                // Close the test tab
                await newPage.close();
                
                return testResult;
              }
            } catch (clickError) {
              console.log(`[${merchant}] ⚠️ Click failed, will test URL directly: ${clickError.message}`);
            }
          }
          
          // Fallback: Open URL directly in new tab
          console.log(`[${merchant}] 🌐 Opening merchant URL directly: ${merchantUrl}`);
          const newPage = await this.browser.newPage();
          
          const response = await newPage.goto(merchantUrl, { 
            waitUntil: 'domcontentloaded', 
            timeout: 15000 
          });
          
          const statusCode = response?.status();
          console.log(`[${merchant}] 🌐 URL response status: ${statusCode}`);
          
          // Wait for page to fully load
          await newPage.waitForTimeout(3000);
          
          // Get page title and content for analysis
          const pageTitle = await newPage.title();
          const pageContent = await newPage.textContent('body');
          
          // Test the page for unavailability patterns
          const testResult = await this.testPageForUnavailability(merchant, newPage, pageTitle, pageContent, response);
          
          // Close the test tab
          await newPage.close();
          
          return testResult;
          
        } catch (urlError) {
          console.log(`[${merchant}] ❌ URL test failed: ${urlError.message}`);
          // Only flag as inactive if there's a clear error, not just network issues
          const isNetworkError = urlError.message.includes('net::') || 
                                 urlError.message.includes('timeout') ||
                                 urlError.message.includes('DNS');
          
          if (isNetworkError) {
            console.log(`[${merchant}] 🌐 Network error - flagging as unavailable: ${urlError.message}`);
            return { isActive: false };
          } else {
            console.log(`[${merchant}] 🌐 Technical error - not flagging: ${urlError.message}`);
            return { isActive: true }; // Don't flag for technical issues
          }
        }
      }

      // Add page error handling to catch JavaScript errors
      const pageErrors = [];
      this.page.on('pageerror', (error) => {
        console.log(`[${merchant}] ⚠️ Page JavaScript error: ${error.message}`);
        pageErrors.push(error.message);
      });

      this.page.on('requestfailed', (request) => {
        console.log(`[${merchant}] ⚠️ Request failed: ${request.url()} - ${request.failure()?.errorText}`);
      });

      // Click the test link with multiple strategies
      let linkClicked = false;
      console.log(`[${merchant}] 🎯 Starting click strategies for ${linkInfo.isInput ? 'INPUT' : 'ELEMENT'} with ${linkInfo.href ? 'HREF' : 'NO HREF'}`);
      
      // Strategy 1: Find by exact text match or handle input fields
      console.log(`[${merchant}] 🎯 Strategy 1: ${linkInfo.isInput ? 'Input field handling' : 'Exact text matching'}`);
      console.log(`[${merchant}] Trying to click by exact text: "${linkInfo.text}"`);
      console.log(`[${merchant}] Link info - isInput: ${linkInfo.isInput}, href: ${linkInfo.href?.substring(0, 100) || 'no href'}`);
      
      if (linkInfo.isInput) {
        // Handle input fields with ShareASale/Awin URLs - extract URL and open directly
        console.log(`[${merchant}] 🎯 Strategy 1A: Input field - extracting URL and opening directly`);
        linkClicked = await this.page.evaluate(() => {
          // Find inputs with affiliate URLs
          const inputs = document.querySelectorAll('input');
          for (const input of inputs) {
            if (input.value && (input.value.includes('shareasale.com') || input.value.includes('awin'))) {
              console.log(`[MAdmin] Found input with affiliate URL: ${input.value.substring(0, 100)}`);
              
              // Extract the full URL from the input field
              const affiliateUrl = input.value.trim();
              console.log(`[MAdmin] Extracted affiliate URL: ${affiliateUrl.substring(0, 150)}`);
              
              // Open the URL directly in a new tab instead of trying to click buttons
              try {
                console.log(`[MAdmin] Opening affiliate URL directly in new tab...`);
                window.open(affiliateUrl, '_blank', 'noopener,noreferrer');
                console.log(`[MAdmin] Successfully opened affiliate URL in new tab`);
                return true;
              } catch (openError) {
                console.log(`[MAdmin] Failed to open affiliate URL: ${openError.message}`);
                
                // Fallback: try to find and click nearby buttons
                const parent = input.closest('div, form, section, td, tr');
                if (parent) {
                  const buttons = parent.querySelectorAll('button, a, [role="button"], .btn, .button, input[type="button"], input[type="submit"]');
                  for (const btn of buttons) {
                    const btnText = btn.textContent?.trim().toLowerCase() || '';
                    const btnType = btn.type || '';
                    if (btnText.includes('test') || btnText.includes('link') || btnText.includes('go') || 
                        btnText.includes('visit') || btnType === 'submit' || btnType === 'button') {
                      console.log(`[MAdmin] Fallback: Attempting to click nearby button: "${btn.textContent?.trim()}" (type: ${btnType})`);
                      
                      try {
                        btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        btn.focus();
                        btn.click();
                        
                        // Also try dispatching click event
                        btn.dispatchEvent(new MouseEvent('click', {
                          bubbles: true,
                          cancelable: true,
                          view: window
                        }));
                        
                        console.log(`[MAdmin] Successfully clicked button: "${btn.textContent?.trim()}"`);
                        return true;
                      } catch (clickError) {
                        console.log(`[MAdmin] Click failed for button: ${clickError.message}`);
                      }
                    }
                  }
                }
                
                return false;
              }
            }
          }
          return false;
        });
        console.log(`[${merchant}] 🎯 Strategy 1A result (Input field): ${linkClicked}`);
      } else {
        // Handle regular clickable elements with enhanced clicking
        linkClicked = await this.page.evaluate((linkText) => {
          const allElements = document.querySelectorAll('a, button, [role="button"], .btn, .button');
          
          for (const el of allElements) {
            const text = el.textContent?.trim();
            if (text === linkText) {
              console.log(`[MAdmin] Attempting to click test link by exact text: "${text}"`);
              
              try {
                // Enhanced clicking with multiple methods
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.focus();
                el.click();
                
                // Also try dispatching click event
                el.dispatchEvent(new MouseEvent('click', {
                  bubbles: true,
                  cancelable: true,
                  view: window
                }));
                
                console.log(`[MAdmin] Successfully clicked element: "${text}"`);
                return true;
              } catch (clickError) {
                console.log(`[MAdmin] Click failed for element: ${clickError.message}`);
              }
            }
          }
          return false;
        }, linkInfo.text);
        console.log(`[${merchant}] 🎯 Strategy 1B result (Regular elements): ${linkClicked}`);
      }
      
      console.log(`[${merchant}] Exact text/input click result: ${linkClicked}`);

      // Strategy 2: Find by partial text match if exact match failed
      if (!linkClicked) {
        console.log(`[${merchant}] 🎯 Strategy 2: Partial text matching`);
        linkClicked = await this.page.evaluate((linkText) => {
          const allElements = document.querySelectorAll('a, button, [role="button"], .btn, .button');
          
          for (const el of allElements) {
            const text = el.textContent?.trim().toLowerCase();
            const searchText = linkText.toLowerCase();
            if (text && searchText && (text.includes(searchText) || searchText.includes(text))) {
              console.log(`[MAdmin] Clicking test link by partial text: "${el.textContent?.trim()}"`);
              el.click();
              return true;
            }
          }
          return false;
        }, linkInfo.text);
        
        console.log(`[${merchant}] 🎯 Strategy 2 result (Partial text): ${linkClicked}`);
        console.log(`[${merchant}] Partial text click result: ${linkClicked}`);
      }

      // Strategy 3: Find by href if text matching failed
      if (!linkClicked && linkInfo.href) {
        console.log(`[${merchant}] Trying to click by href: "${linkInfo.href}"`);
        linkClicked = await this.page.evaluate((href) => {
          const allElements = document.querySelectorAll('a[href], button[href]');
          
          for (const el of allElements) {
            const elementHref = el.getAttribute('href');
            if (elementHref === href) {
              console.log(`[MAdmin] Clicking test link by href: "${href}"`);
              el.click();
              return true;
            }
          }
          return false;
        }, linkInfo.href);
        
        console.log(`[${merchant}] Href click result: ${linkClicked}`);
      }

      // Strategy 4: If we have an onclick handler, try that
      if (!linkClicked && linkInfo.onclick) {
        console.log(`[${merchant}] Trying to click by onclick handler`);
        linkClicked = await this.page.evaluate((onclick) => {
          const allElements = document.querySelectorAll('*[onclick]');
          
          for (const el of allElements) {
            const elementOnclick = el.getAttribute('onclick');
            if (elementOnclick && elementOnclick.includes(onclick.substring(0, 20))) {
              console.log(`[MAdmin] Clicking test link by onclick`);
              el.click();
              return true;
            }
          }
          return false;
        }, linkInfo.onclick);
        
        console.log(`[${merchant}] Onclick click result: ${linkClicked}`);
      }

      // Strategy 5: Direct URL navigation if we have a ShareASale/Awin URL
      if (!linkClicked && linkInfo.href && (linkInfo.href.includes('shareasale.com') || linkInfo.href.includes('awin'))) {
        console.log(`[${merchant}] Trying direct navigation to affiliate URL: ${linkInfo.href.substring(0, 100)}...`);
        try {
          // Navigate directly to the affiliate URL in the current tab
          await this.page.goto(linkInfo.href);
          console.log(`[${merchant}] ✅ Successfully navigated to affiliate URL directly`);
          linkClicked = true;
          
          // Wait a moment for the page to load
          await this.page.waitForTimeout(3000);
          
        } catch (error) {
          console.log(`[${merchant}] ❌ Failed to navigate directly to affiliate URL:`, error.message);
        }
      }

      // Strategy 6: Direct URL opening - if we have the URL, just open it
      if (!linkClicked && linkInfo.href && (linkInfo.href.includes('shareasale.com') || linkInfo.href.includes('awin'))) {
        console.log(`[${merchant}] Strategy 6: Direct URL opening - Using linkInfo.href: ${linkInfo.href.substring(0, 150)}...`);
        try {
          // Use the URL directly from linkInfo
          await this.page.evaluate((url) => {
            console.log(`[MAdmin] Opening linkInfo URL directly in new tab: ${url.substring(0, 100)}`);
            window.open(url, '_blank', 'noopener,noreferrer');
          }, linkInfo.href);
          console.log(`[${merchant}] ✅ Direct linkInfo URL opening executed`);
          linkClicked = true;
          
        } catch (error) {
          console.log(`[${merchant}] ❌ Failed direct linkInfo URL opening:`, error.message);
        }
      }

      // Strategy 7: Force new tab opening - modify links to open in new tab
      if (!linkClicked && (linkInfo.href && (linkInfo.href.includes('shareasale.com') || linkInfo.href.includes('awin')))) {
        console.log(`[${merchant}] Trying to force new tab opening for affiliate URL: ${linkInfo.href.substring(0, 100)}...`);
        try {
          // First, try to modify any existing links to force new tab behavior
          linkClicked = await this.page.evaluate((linkText, href) => {
            console.log(`[MAdmin] Modifying links to force new tab behavior...`);
            
            // Find elements that match our link
            const allElements = document.querySelectorAll('a, button, [role="button"], .btn, .button');
            let modified = false;
            
            for (const el of allElements) {
              const text = el.textContent?.trim() || '';
              const elementHref = el.getAttribute('href') || '';
              const onclick = el.getAttribute('onclick') || '';
              
              if (text === linkText || elementHref.includes(href) || onclick.includes('shareasale') || onclick.includes('awin')) {
                console.log(`[MAdmin] Found matching element: ${el.tagName} with text "${text}"`);
                
                // If it's a link, modify it to open in new tab
                if (el.tagName === 'A' && elementHref) {
                  el.setAttribute('target', '_blank');
                  el.setAttribute('rel', 'noopener noreferrer');
                  console.log(`[MAdmin] Modified link to open in new tab`);
                }
                
                // Add click handler that forces new tab
                const originalOnclick = el.onclick;
                el.onclick = function(e) {
                  console.log(`[MAdmin] Custom click handler triggered`);
                  e.preventDefault();
                  e.stopPropagation();
                  
                  // Try original handler first
                  if (originalOnclick) {
                    try {
                      originalOnclick.call(this, e);
                    } catch (err) {
                      console.log(`[MAdmin] Original onclick failed: ${err.message}`);
                    }
                  }
                  
                  // Force open in new tab
                  if (elementHref) {
                    window.open(elementHref, '_blank', 'noopener,noreferrer');
                  } else if (href) {
                    window.open(href, '_blank', 'noopener,noreferrer');
                  }
                  
                  return false;
                };
                
                // Now click the modified element
                try {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  el.focus();
                  el.click();
                  console.log(`[MAdmin] Clicked modified element`);
                  modified = true;
                  break;
                } catch (clickError) {
                  console.log(`[MAdmin] Click failed: ${clickError.message}`);
                }
              }
            }
            
            return modified;
          }, linkInfo.text, linkInfo.href);
          
          console.log(`[${merchant}] Force new tab modification result: ${linkClicked}`);
          
        } catch (error) {
          console.log(`[${merchant}] ❌ Failed to modify links for new tab:`, error.message);
        }
      }

      // Strategy 8: Direct window.open with URL extraction
      if (!linkClicked && linkInfo.href && (linkInfo.href.includes('shareasale.com') || linkInfo.href.includes('awin'))) {
        console.log(`[${merchant}] Trying direct window.open for affiliate URL...`);
        try {
          // Force open the URL by directly calling window.open
          await this.page.evaluate((url) => {
            console.log(`[MAdmin] Opening URL directly in new tab: ${url.substring(0, 100)}`);
            window.open(url, '_blank', 'noopener,noreferrer');
          }, linkInfo.href);
          console.log(`[${merchant}] ✅ Direct window.open executed`);
          linkClicked = true;
          
        } catch (error) {
          console.log(`[${merchant}] ❌ Failed direct window.open:`, error.message);
        }
      }

      // Strategy 9: Try more aggressive element finding and clicking
      if (!linkClicked) {
        console.log(`[${merchant}] Trying aggressive element detection and clicking...`);
        linkClicked = await this.page.evaluate((linkText, href) => {
          console.log(`[MAdmin] Aggressive search for clickable elements...`);
          
          // Look for ANY element that might be clickable and contains our link info
          const allElements = document.querySelectorAll('*');
          const potentialElements = [];
          
          for (const el of allElements) {
            const elementText = el.textContent?.trim() || '';
            const elementHref = el.getAttribute('href') || '';
            const elementOnclick = el.getAttribute('onclick') || '';
            const elementClass = el.className || '';
            const elementId = el.id || '';
            
            // Check if this element is related to our test link
            const isRelated = elementText.includes(linkText) || 
                             elementHref.includes(href) ||
                             elementOnclick.includes('test') ||
                             elementClass.toLowerCase().includes('test') ||
                             elementId.toLowerCase().includes('test') ||
                             (elementText.toLowerCase().includes('test') && elementText.toLowerCase().includes('link'));
            
            if (isRelated && (el.tagName === 'A' || el.tagName === 'BUTTON' || el.onclick || el.getAttribute('role') === 'button')) {
              potentialElements.push({
                element: el,
                text: elementText,
                href: elementHref,
                onclick: elementOnclick,
                tagName: el.tagName
              });
            }
          }
          
          console.log(`[MAdmin] Found ${potentialElements.length} potential clickable elements`);
          
          // Try clicking each potential element
          for (const item of potentialElements) {
            console.log(`[MAdmin] Trying to click ${item.tagName}: "${item.text.substring(0, 50)}" (href: ${item.href.substring(0, 50)})`);
            
            try {
              const el = item.element;
              
              // Multiple click strategies
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              // Wait for scroll (can't use await in browser context)
              setTimeout(() => {}, 500);
              
              el.focus();
              
              // Try different click methods
              el.click();
              
              // Try mouse events
              el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
              el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
              el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
              
              // If it's a link with href, try to navigate directly
              if (el.tagName === 'A' && el.href) {
                console.log(`[MAdmin] Also trying direct navigation to: ${el.href}`);
                window.open(el.href, '_blank');
              }
              
              // If it has onclick, try to execute it
              if (el.onclick) {
                console.log(`[MAdmin] Also trying to execute onclick handler`);
                el.onclick.call(el);
              }
              
              console.log(`[MAdmin] Successfully attempted click on ${item.tagName}: "${item.text.substring(0, 30)}"`);
              return true; // Return true if we attempted the click
              
            } catch (clickError) {
              console.log(`[MAdmin] Click failed for ${item.tagName}: ${clickError.message}`);
            }
          }
          
          return false;
        }, linkInfo.text, linkInfo.href || '');
        
        console.log(`[${merchant}] Aggressive clicking result: ${linkClicked}`);
      }

      // Strategy 10: Last resort - try to find and execute any test-related JavaScript
      if (!linkClicked) {
        console.log(`[${merchant}] Last resort: Looking for test-related JavaScript...`);
        linkClicked = await this.page.evaluate(() => {
          // Look for any JavaScript functions that might be test-related
          const scripts = document.querySelectorAll('script');
          for (const script of scripts) {
            const scriptContent = script.textContent || '';
            if (scriptContent.includes('test') && (scriptContent.includes('window.open') || scriptContent.includes('location.href'))) {
              console.log(`[MAdmin] Found test-related script, attempting to trigger...`);
              try {
                // Try to find and execute test functions
                if (window.testLink && typeof window.testLink === 'function') {
                  window.testLink();
                  return true;
                }
                if (window.openTestLink && typeof window.openTestLink === 'function') {
                  window.openTestLink();
                  return true;
                }
              } catch (jsError) {
                console.log(`[MAdmin] JavaScript execution failed: ${jsError.message}`);
              }
            }
          }
          return false;
        });
        
        console.log(`[${merchant}] JavaScript execution result: ${linkClicked}`);
      }

      // Strategy 11: Try Playwright's native clicking methods
      if (!linkClicked) {
        console.log(`[${merchant}] Trying Playwright native clicking methods...`);
        try {
          // Try to find the element using various selectors and click with Playwright
          const selectors = [
            `text="${linkInfo.text}"`,
            `text="${linkInfo.text.toLowerCase()}"`,
            `text*="${linkInfo.text}"`,
            `[href*="shareasale"]`,
            `[href*="awin"]`,
            `[onclick*="shareasale"]`,
            `[onclick*="awin"]`,
            `button:has-text("test")`,
            `a:has-text("test")`,
            `button:has-text("Test Link")`,
            `a:has-text("Test Link")`
          ];
          
          for (const selector of selectors) {
            try {
              console.log(`[${merchant}] Trying Playwright selector: ${selector}`);
              const element = await this.page.locator(selector).first();
              
              if (await element.count() > 0) {
                console.log(`[${merchant}] Found element with selector: ${selector}`);
                
                // Try scrolling into view first
                await element.scrollIntoViewIfNeeded();
                await this.page.waitForTimeout(500);
                
                // Try different Playwright click methods
                await element.click({ force: true, timeout: 5000 });
                console.log(`[${merchant}] ✅ Playwright click successful with selector: ${selector}`);
                linkClicked = true;
                break;
              }
            } catch (playwrightError) {
              console.log(`[${merchant}] Playwright click failed for ${selector}: ${playwrightError.message}`);
            }
          }
        } catch (error) {
          console.log(`[${merchant}] Playwright native clicking failed:`, error.message);
        }
        
        console.log(`[${merchant}] Playwright native clicking result: ${linkClicked}`);
      }

      // Strategy 12: Debug - show what elements are actually clickable on the page
      if (!linkClicked) {
        console.log(`[${merchant}] 🔍 DEBUGGING: Analyzing all clickable elements on page...`);
        await this.page.evaluate((merchant) => {
          console.log(`[${merchant}] === CLICKABLE ELEMENTS DEBUG ===`);
          
          const clickableElements = document.querySelectorAll('a, button, [role="button"], [onclick], input[type="button"], input[type="submit"], .btn, .button');
          console.log(`[${merchant}] Total clickable elements found: ${clickableElements.length}`);
          
          for (let i = 0; i < Math.min(clickableElements.length, 20); i++) {
            const el = clickableElements[i];
            const text = el.textContent?.trim() || '';
            const href = el.getAttribute('href') || '';
            const onclick = el.getAttribute('onclick') || '';
            const tagName = el.tagName;
            const isVisible = el.offsetParent !== null;
            
            console.log(`[${merchant}] ${i+1}. ${tagName} - "${text}" (visible: ${isVisible})`);
            if (href) console.log(`[${merchant}]    href: ${href.substring(0, 100)}`);
            if (onclick) console.log(`[${merchant}]    onclick: ${onclick.substring(0, 100)}`);
          }
          
          console.log(`[${merchant}] === END DEBUG ===`);
        }, merchant);
      }

      if (!linkClicked) {
        console.log(`[${merchant}] ⚠️ ALL STRATEGIES FAILED - Could not click test link: "${linkInfo.text}"`);
        this.emit('progress', { message: `Could not click test link for ${merchant}` });
        return false; // Return false to indicate no link was tested
      }

      // 🎯 IMPORTANT: Set flag immediately when click is reported successful
      // This ensures error recovery can work even if tab verification fails
      linkWasClicked = true;
      console.log(`[${merchant}] 🎯 LINK CLICKED FLAG SET - Click strategies reported success`);

      console.log(`[${merchant}] ✅ Click attempt completed - verifying if new tab opened...`);
      this.emit('progress', { message: `Verifying link click for ${merchant}...` });

      // Check for pause/stop before waiting for new tab
      if (this.shouldStop) return null;
      await this.waitIfPaused();

      // Wait for new tab/page to open and VERIFY it actually opened
      await this.page.waitForTimeout(6000); // Reduced wait time to 6 seconds

      // IMMEDIATE INACTIVE CHECK: Check all pages for inactive content as soon as possible
      console.log(`[${merchant}] 🚨 IMMEDIATE INACTIVE CHECK - Scanning all pages for 'this link is inactive' text...`);
      
      try {
        const immediatePages = await this.browser.pages();
        console.log(`[${merchant}] 🚨 IMMEDIATE - Found ${immediatePages.length} pages to check immediately`);
        
        for (let i = 0; i < immediatePages.length; i++) {
          try {
            console.log(`[${merchant}] 🚨 IMMEDIATE - Checking page ${i} for inactive text...`);
            
            const immediateContent = await immediatePages[i].evaluate(() => {
              const bodyText = document.body.textContent || '';
              const titleText = document.title || '';
              const fullText = (bodyText + ' ' + titleText).toLowerCase();
              
              // Be more specific about inactive detection - only exact phrases
              const hasThisLinkIsInactive = fullText.includes('this link is inactive');
              const hasLinkIsInactive = fullText.includes('link is inactive');
              const hasInactiveInTitle = titleText.toLowerCase().includes('inactive');
              
              // Only check for very specific inactive patterns
              const isDefinitelyInactive = hasThisLinkIsInactive || 
                                         (hasLinkIsInactive && !fullText.includes('if this link is inactive')) ||
                                         (hasInactiveInTitle && titleText.toLowerCase().includes('link'));
              
              return {
                url: window.location.href,
                title: titleText,
                bodyText: bodyText.substring(0, 500),
                fullTextSnippet: fullText.substring(0, 500),
                hasThisLinkIsInactive: hasThisLinkIsInactive,
                hasLinkIsInactive: hasLinkIsInactive,
                hasInactiveInTitle: hasInactiveInTitle,
                isDefinitelyInactive: isDefinitelyInactive,
                // Additional context for debugging
                containsInactive: fullText.includes('inactive'),
                inactiveContext: fullText.includes('inactive') ? 
                  fullText.substring(Math.max(0, fullText.indexOf('inactive') - 50), fullText.indexOf('inactive') + 50) : 
                  'no inactive text found'
              };
            });
            
            console.log(`[${merchant}] 🚨 IMMEDIATE - Page ${i} URL: ${immediateContent.url}`);
            console.log(`[${merchant}] 🚨 IMMEDIATE - Page ${i} title: "${immediateContent.title}"`);
            console.log(`[${merchant}] 🚨 IMMEDIATE - Page ${i} body text: "${immediateContent.bodyText}"`);
            console.log(`[${merchant}] 🚨 IMMEDIATE - Contains 'inactive': ${immediateContent.containsInactive}`);
            console.log(`[${merchant}] 🚨 IMMEDIATE - Inactive context: "${immediateContent.inactiveContext}"`);
            console.log(`[${merchant}] 🚨 IMMEDIATE - 'this link is inactive': ${immediateContent.hasThisLinkIsInactive}`);
            console.log(`[${merchant}] 🚨 IMMEDIATE - 'link is inactive': ${immediateContent.hasLinkIsInactive}`);
            console.log(`[${merchant}] 🚨 IMMEDIATE - title has 'inactive': ${immediateContent.hasInactiveInTitle}`);
            console.log(`[${merchant}] 🚨 IMMEDIATE - DEFINITELY INACTIVE: ${immediateContent.isDefinitelyInactive}`);
            
            if (immediateContent.isDefinitelyInactive) {
              console.log(`[${merchant}] 🚨🚨 IMMEDIATE INACTIVE DETECTED ON PAGE ${i}! 🚨🚨`);
              console.log(`[${merchant}] 🚨 IMMEDIATE - Full text snippet: "${immediateContent.fullTextSnippet}"`);
              console.log(`[${merchant}] 🚨 IMMEDIATE - Inactive context: "${immediateContent.inactiveContext}"`);
              
              // Close all extra pages immediately
              for (let j = 1; j < immediatePages.length; j++) {
                try {
                  await immediatePages[j].close();
                  console.log(`[${merchant}] 🚨 IMMEDIATE - Closed page ${j}`);
                } catch (closeErr) {
                  console.log(`[${merchant}] 🚨 IMMEDIATE - Could not close page ${j}: ${closeErr.message}`);
                }
              }
              
              const immediateResult = { isActive: false };
              console.log(`[${merchant}] 🚨🚨 IMMEDIATE RETURNING INACTIVE: ${JSON.stringify(immediateResult)} 🚨🚨`);
              console.log(`[${merchant}] 🚨 === testLink method completed with IMMEDIATE inactive detection ===`);
              return immediateResult;
            } else {
              console.log(`[${merchant}] 🚨 IMMEDIATE - Page ${i} does NOT contain definitive inactive text`);
              if (immediateContent.containsInactive) {
                console.log(`[${merchant}] 🚨 IMMEDIATE - Page contains 'inactive' but not in definitive pattern: "${immediateContent.inactiveContext}"`);
              }
            }
            
          } catch (pageError) {
            console.log(`[${merchant}] 🚨 IMMEDIATE - Error checking page ${i}: ${pageError.message}`);
          }
        }
        
        console.log(`[${merchant}] 🚨 IMMEDIATE - No inactive text found in immediate check, continuing with detailed analysis...`);
        
      } catch (immediateError) {
        console.error(`[${merchant}] 🚨 IMMEDIATE - Error in immediate check: ${immediateError.message}`);
      }

      // FIRST: Check if we have the inactive content anywhere, regardless of tab behavior
      console.log(`[${merchant}] 🔍 PRIORITY CHECK - Looking for inactive content anywhere after 8s wait...`);
      
      try {
        // Get all pages first to see what we're working with
        const allPages = await this.browser.pages();
        console.log(`[${merchant}] 🔍 PRIORITY - Found ${allPages.length} total pages/tabs`);
        
        // Log all page URLs for debugging
        for (let i = 0; i < allPages.length; i++) {
          try {
            const pageUrl = await allPages[i].evaluate(() => window.location.href);
            console.log(`[${merchant}] 📄 PRIORITY - Page ${i} URL: ${pageUrl}`);
          } catch (urlError) {
            console.log(`[${merchant}] ❌ Could not get URL for page ${i}: ${urlError.message}`);
          }
        }
        
        // Check current page first
        console.log(`[${merchant}] 🔍 PRIORITY - Checking current page (main tab)...`);
        const currentPageContent = await this.page.evaluate(() => {
          return {
            url: window.location.href,
            title: document.title,
            hasInactiveText: document.body.textContent?.toLowerCase().includes('this link is inactive') || 
                           document.body.textContent?.toLowerCase().includes('link is inactive') ||
                           document.body.textContent?.toLowerCase().includes('inactive link') ||
                           document.body.textContent?.toLowerCase().includes('link inactive') ||
                           document.body.textContent?.toLowerCase().includes('not available') ||
                           document.body.textContent?.toLowerCase().includes('unavailable') ||
                           document.title?.toLowerCase().includes('inactive') ||
                           false,
            bodySnippet: document.body.textContent?.substring(0, 300) || '',
            fullBodyText: document.body.textContent || ''
          };
        });
        
        console.log(`[${merchant}] 📄 PRIORITY - Current page URL: ${currentPageContent.url}`);
        console.log(`[${merchant}] 📄 PRIORITY - Current page title: "${currentPageContent.title}"`);
        console.log(`[${merchant}] 📄 PRIORITY - Body snippet: "${currentPageContent.bodySnippet}"`);
        console.log(`[${merchant}] 🔍 PRIORITY - Checking current page for inactive text patterns...`);
        console.log(`[${merchant}] 🔍 PRIORITY - 'this link is inactive': ${currentPageContent.fullBodyText?.toLowerCase().includes('this link is inactive')}`);
        console.log(`[${merchant}] 🔍 PRIORITY - 'link is inactive': ${currentPageContent.fullBodyText?.toLowerCase().includes('link is inactive')}`);
        console.log(`[${merchant}] 🔍 PRIORITY - 'inactive link': ${currentPageContent.fullBodyText?.toLowerCase().includes('inactive link')}`);
        console.log(`[${merchant}] 🔍 PRIORITY - 'link inactive': ${currentPageContent.fullBodyText?.toLowerCase().includes('link inactive')}`);
        console.log(`[${merchant}] 🔍 PRIORITY - Title contains 'inactive': ${currentPageContent.title?.toLowerCase().includes('inactive')}`);
        console.log(`[${merchant}] 📄 PRIORITY - Current page has inactive text: ${currentPageContent.hasInactiveText}`);
        
        if (currentPageContent.hasInactiveText) {
          console.log(`[${merchant}] ✅ PRIORITY SUCCESS - Found inactive content on current page!`);
          console.log(`[${merchant}] 📄 Full content contains: "${currentPageContent.fullBodyText.toLowerCase().substring(0, 500)}"`);
          
          const priorityResult = { isActive: false };
          console.log(`[${merchant}] 🎯 PRIORITY RETURNING:`, priorityResult);
          console.log(`[${merchant}] 🔚 === testLink method completed with priority success ===`);
          return priorityResult;
        }
        
        // Check all other pages/tabs - especially the newly opened ones
        console.log(`[${merchant}] 🔍 PRIORITY - Current page clean, checking all ${allPages.length} pages/tabs...`);
        
        for (let i = 0; i < allPages.length; i++) {
          try {
            console.log(`[${merchant}] 🔍 PRIORITY - Checking page/tab ${i}...`);
            
            // Wait longer for slow-loading affiliate pages
            console.log(`[${merchant}] ⏳ PRIORITY - Waiting 5s for page ${i} to fully load...`);
            await allPages[i].waitForTimeout(5000);
            
            const pageContent = await allPages[i].evaluate(() => {
              return {
                url: window.location.href,
                title: document.title,
                hasInactiveText: document.body.textContent?.toLowerCase().includes('this link is inactive') || 
                               document.body.textContent?.toLowerCase().includes('link is inactive') ||
                               document.body.textContent?.toLowerCase().includes('inactive link') ||
                               document.body.textContent?.toLowerCase().includes('link inactive') ||
                               document.body.textContent?.toLowerCase().includes('not available') ||
                               document.body.textContent?.toLowerCase().includes('unavailable') ||
                               document.title?.toLowerCase().includes('inactive') ||
                               false,
                bodySnippet: document.body.textContent?.substring(0, 300) || '',
                fullBodyText: document.body.textContent || ''
              };
            });
            
            console.log(`[${merchant}] 📄 PRIORITY - Page ${i} URL: ${pageContent.url}`);
            console.log(`[${merchant}] 📄 PRIORITY - Page ${i} title: "${pageContent.title}"`);
            console.log(`[${merchant}] 📄 PRIORITY - Page ${i} body snippet: "${pageContent.bodySnippet}"`);
            console.log(`[${merchant}] 🔍 PRIORITY - Checking for inactive text patterns...`);
            console.log(`[${merchant}] 🔍 PRIORITY - 'this link is inactive': ${pageContent.fullBodyText?.toLowerCase().includes('this link is inactive')}`);
            console.log(`[${merchant}] 🔍 PRIORITY - 'link is inactive': ${pageContent.fullBodyText?.toLowerCase().includes('link is inactive')}`);
            console.log(`[${merchant}] 🔍 PRIORITY - 'inactive link': ${pageContent.fullBodyText?.toLowerCase().includes('inactive link')}`);
            console.log(`[${merchant}] 🔍 PRIORITY - 'link inactive': ${pageContent.fullBodyText?.toLowerCase().includes('link inactive')}`);
            console.log(`[${merchant}] 🔍 PRIORITY - Title contains 'inactive': ${pageContent.title?.toLowerCase().includes('inactive')}`);
            console.log(`[${merchant}] 📄 PRIORITY - Page ${i} has inactive text: ${pageContent.hasInactiveText}`);
            
            // FIRST PRIORITY: Check for inactive text (this takes precedence over everything)
            if (pageContent.hasInactiveText) {
              console.log(`[${merchant}] ✅ PRIORITY SUCCESS - Found inactive content on page ${i}!`);
              console.log(`[${merchant}] 📄 Full page content: "${pageContent.fullBodyText.substring(0, 500)}"`);
              
              // Close extra pages/tabs (keep the first one which is usually the main admin page)
              if (i > 0) {
                try {
                  await allPages[i].close();
                  console.log(`[${merchant}] ✅ Closed inactive page/tab ${i}`);
                } catch (closeErr) {
                  console.log(`[${merchant}] ⚠️ Could not close page/tab ${i}: ${closeErr.message}`);
                }
              }
              
              const priorityResult = { isActive: false };
              console.log(`[${merchant}] 🎯 PRIORITY RETURNING:`, priorityResult);
              console.log(`[${merchant}] 🔚 === testLink method completed with priority success ===`);
              return priorityResult;
            } else {
              // If no inactive text found, check if this looks like a successful affiliate page
              const isAffiliateSuccess = pageContent.url.includes('faithheart-jewelry.com') || 
                                       pageContent.url.includes('chopin') ||
                                       pageContent.url.includes('rpnb') ||
                                       pageContent.url.includes('.com') && !pageContent.url.includes('admin.wildlink.me') ||
                                       (pageContent.title && pageContent.title.length > 5 && !pageContent.title.toLowerCase().includes('error') && !pageContent.title.toLowerCase().includes('not found')) ||
                                       (pageContent.bodySnippet && pageContent.bodySnippet.length > 50);
              
              console.log(`[${merchant}] 🔍 PRIORITY - Checking if page ${i} looks like active affiliate...`);
              console.log(`[${merchant}] 📄 PRIORITY - URL check: ${pageContent.url.includes('.com') && !pageContent.url.includes('admin.wildlink.me')}`);
              console.log(`[${merchant}] 📄 PRIORITY - Title check: ${pageContent.title && pageContent.title.length > 5}`);
              console.log(`[${merchant}] 📄 PRIORITY - Content check: ${pageContent.bodySnippet && pageContent.bodySnippet.length > 50}`);
              console.log(`[${merchant}] 📄 PRIORITY - Overall affiliate success: ${isAffiliateSuccess}`);
              
              if (isAffiliateSuccess) {
                console.log(`[${merchant}] ✅ PRIORITY SUCCESS - Found active affiliate page on tab ${i}!`);
                console.log(`[${merchant}] 📄 Page appears to be working affiliate link`);
                console.log(`[${merchant}] 📄 Full URL: ${pageContent.url}`);
                console.log(`[${merchant}] 📄 Title: "${pageContent.title}"`);
                console.log(`[${merchant}] 📄 Content snippet: "${pageContent.bodySnippet}"`);
                
                // Close extra pages/tabs (keep the first one which is usually the main admin page)
                if (i > 0) {
                  try {
                    await allPages[i].close();
                    console.log(`[${merchant}] ✅ Closed active affiliate page/tab ${i}`);
                  } catch (closeErr) {
                    console.log(`[${merchant}] ⚠️ Could not close page/tab ${i}: ${closeErr.message}`);
                  }
                }
                
                const priorityResult = { isActive: true };
                console.log(`[${merchant}] 🎯 PRIORITY RETURNING:`, priorityResult);
                console.log(`[${merchant}] 🔚 === testLink method completed with priority success (active) ===`);
                return priorityResult;
              } else {
                console.log(`[${merchant}] ❌ PRIORITY - Page ${i} doesn't look like active affiliate or inactive page`);
                console.log(`[${merchant}] 📄 Will continue checking other pages...`);
              }
            }
          } catch (pageError) {
            console.log(`[${merchant}] ❌ Error checking page/tab ${i}: ${pageError.message}`);
          }
        }
        
        console.log(`[${merchant}] ❌ PRIORITY - No inactive content found in any of the ${allPages.length} pages/tabs`);
        console.log(`[${merchant}] 🧹 PRIORITY - Cleaning up all extra tabs before continuing...`);
        
        // Close all extra tabs (keep only the first one which is the admin page)
        for (let i = 1; i < allPages.length; i++) {
          try {
            await allPages[i].close();
            console.log(`[${merchant}] ✅ Closed extra tab ${i} during cleanup`);
          } catch (closeErr) {
            console.log(`[${merchant}] ⚠️ Could not close tab ${i} during cleanup: ${closeErr.message}`);
          }
        }
        
        console.log(`[${merchant}] 🧹 PRIORITY - Tab cleanup completed, continuing with regular logic...`);
        
      } catch (priorityError) {
        console.error(`[${merchant}] ❌ Error in priority check: ${priorityError.message}`);
        
        // Try to clean up tabs even if there was an error
        try {
          const errorPages = await this.browser.pages();
          console.log(`[${merchant}] 🧹 ERROR CLEANUP - Found ${errorPages.length} pages, closing extras...`);
          
          for (let i = 1; i < errorPages.length; i++) {
            try {
              await errorPages[i].close();
              console.log(`[${merchant}] ✅ Closed error tab ${i}`);
            } catch (closeErr) {
              console.log(`[${merchant}] ⚠️ Could not close error tab ${i}: ${closeErr.message}`);
            }
          }
        } catch (cleanupError) {
          console.log(`[${merchant}] ❌ Error during error cleanup: ${cleanupError.message}`);
        }
      }

      // Get all pages/tabs and verify a new one opened
      const pages = await this.browser.pages();
      const newPage = pages.length > 1 ? pages[pages.length - 1] : null;
      
      // Also check if we've been redirected back to search page (indicates navigation instead of new tab)
      const currentUrl = this.page.url();
      const isBackAtSearch = currentUrl.includes('/merchant-admin') && !currentUrl.includes('/merchant-admin/merchant/');
      
      if (isBackAtSearch) {
        console.log(`[${merchant}] ⚠️ NAVIGATION DETECTED - Redirected back to search page instead of opening new tab`);
        console.log(`[${merchant}] Current URL: ${currentUrl}`);
        console.log(`[${merchant}] 🎯 Link clicked flag: ${linkWasClicked} (should be true - will trigger error recovery)`);
        this.emit('progress', { message: `❌ Link navigated instead of opening new tab for ${merchant}` });
        
        // Check if the current page itself has the inactive content
        // This can happen when the link navigates in the same tab instead of opening a new one
        console.log(`[${merchant}] 🔍 Checking current page for inactive content after navigation...`);
        
        try {
          const currentPageContent = await this.page.evaluate(() => {
            return {
              url: window.location.href,
              title: document.title,
              hasInactiveText: document.body.textContent?.toLowerCase().includes('this link is inactive') || false,
              bodySnippet: document.body.textContent?.substring(0, 300) || '',
              fullText: document.body.textContent || ''
            };
          });
          
          console.log(`[${merchant}] 📄 Current page - URL: ${currentPageContent.url}`);
          console.log(`[${merchant}] 📄 Current page - Title: "${currentPageContent.title}"`);
          console.log(`[${merchant}] 📄 Current page - Has inactive text: ${currentPageContent.hasInactiveText}`);
          console.log(`[${merchant}] 📄 Current page - Body snippet: "${currentPageContent.bodySnippet}"`);
          
          if (currentPageContent.hasInactiveText) {
            console.log(`[${merchant}] ✅ Found inactive content on current page after navigation!`);
            console.log(`[${merchant}] 📄 Full page text contains: "${currentPageContent.fullText.toLowerCase().substring(0, 500)}"`);
            
            const navigationResult = { isActive: false };
            console.log(`[${merchant}] 🎯 NAVIGATION RECOVERY RETURNING:`, navigationResult);
            console.log(`[${merchant}] 🔚 === testLink method completed with navigation recovery ===`);
            return navigationResult;
          } else {
            console.log(`[${merchant}] ❌ Current page does not contain inactive text`);
            console.log(`[${merchant}] 📄 Page content: "${currentPageContent.fullText.substring(0, 500)}"`);
          }
        } catch (currentPageError) {
          console.error(`[${merchant}] ❌ Error checking current page: ${currentPageError.message}`);
        }
        
        // Also check other pages in case there are multiple tabs
        const pages = await this.browser.pages();
        console.log(`[${merchant}] 🔍 Checking ${pages.length} total pages for inactive content after navigation...`);
        
        // Check all pages for the inactive content
        for (let i = 0; i < pages.length; i++) {
          try {
            const pageContent = await pages[i].evaluate(() => {
              return {
                url: window.location.href,
                title: document.title,
                hasInactiveText: document.body.textContent?.toLowerCase().includes('this link is inactive') || false,
                bodySnippet: document.body.textContent?.substring(0, 200) || ''
              };
            });
            
            console.log(`[${merchant}] 📄 Page ${i} - URL: ${pageContent.url.substring(0, 100)}`);
            console.log(`[${merchant}] 📄 Page ${i} - Has inactive text: ${pageContent.hasInactiveText}`);
            
            if (pageContent.hasInactiveText) {
              console.log(`[${merchant}] ✅ Found inactive content on page ${i} after navigation!`);
              
              // Try to close this page if it's not the main page
              if (i > 0) {
                try {
                  await pages[i].close();
                  console.log(`[${merchant}] ✅ Closed inactive page ${i}`);
                } catch (closeErr) {
                  console.log(`[${merchant}] ⚠️ Could not close page ${i}: ${closeErr.message}`);
                }
              }
              
              const navigationResult = { isActive: false };
              console.log(`[${merchant}] 🎯 NAVIGATION RECOVERY RETURNING:`, navigationResult);
              console.log(`[${merchant}] 🔚 === testLink method completed with navigation recovery ===`);
              return navigationResult;
            }
          } catch (pageError) {
            console.log(`[${merchant}] ❌ Error checking page ${i}: ${pageError.message}`);
          }
        }
        
        console.log(`[${merchant}] ❌ No inactive content found after navigation - treating as failed click`);
        console.log(`[${merchant}] 🎯 NAVIGATION RECOVERY RETURNING: false`);
        return false; // Navigation instead of new tab, and no inactive content found
      }
      
      if (!newPage || newPage === this.page) {
        console.log(`[${merchant}] ❌ CLICK VERIFICATION FAILED - No new tab opened despite click attempt`);
        console.log(`[${merchant}] 📊 Total pages: ${pages.length}, Current page same as new page: ${newPage === this.page}`);
        console.log(`[${merchant}] Current URL: ${currentUrl}`);
        console.log(`[${merchant}] 🎯 Link clicked flag: ${linkWasClicked} (should be true - will trigger error recovery)`);
        this.emit('progress', { message: `❌ Click failed for ${merchant} - no new tab opened` });
        return false; // Click didn't actually work
      }

      console.log(`[${merchant}] ✅ CLICK VERIFIED - New tab successfully opened (${pages.length} total pages)`);
      this.emit('progress', { message: `✅ New tab opened for ${merchant}, testing content...` });

      // Now test the verified new tab
      try {
        // Check for pause/stop before testing the new tab
        if (this.shouldStop) {
          console.log(`[${merchant}] 🛑 Stopping - closing opened tab`);
          try {
            await newPage.close();
          } catch (e) {
            console.error(`[${merchant}] Error closing tab during stop:`, e.message);
          }
          return null;
        }
        await this.waitIfPaused();
        
        // Wait for the new page to load (reduced timeout from 15000ms to 8000ms)
        await newPage.waitForLoadState('networkidle', { timeout: 8000 });
        
        // Final pause/stop check before analyzing page content
        if (this.shouldStop) {
          console.log(`[${merchant}] 🛑 Stopping - closing tested tab`);
          try {
            await newPage.close();
          } catch (e) {
            console.error(`[${merchant}] Error closing tab during stop:`, e.message);
          }
          return null;
        }
        await this.waitIfPaused();
          
          // Check if the page says "this link is inactive" or other inactive indicators
          const pageContent = await newPage.evaluate(() => {
            const bodyText = document.body.textContent?.toLowerCase() || '';
            const titleText = document.title?.toLowerCase() || '';
            const url = window.location.href.toLowerCase();
            
            // More detailed debugging - get actual text snippets around "inactive"
            const bodyTextFull = document.body.textContent || '';
            const inactiveMatches = [];
            
            // Find all instances of "inactive" and get context
            let index = bodyTextFull.toLowerCase().indexOf('inactive');
            while (index !== -1) {
              const start = Math.max(0, index - 50);
              const end = Math.min(bodyTextFull.length, index + 50);
              const context = bodyTextFull.substring(start, end);
              inactiveMatches.push(context);
              index = bodyTextFull.toLowerCase().indexOf('inactive', index + 1);
            }
            
            return {
              bodyText: bodyText.substring(0, 1000), // Limit text for logging
              titleText: titleText,
              url: url,
              hasInactiveText: bodyText.includes('this link is inactive'), // ONLY check for this specific text
              inactiveMatches: inactiveMatches, // For debugging
              hasAnyInactive: bodyText.includes('inactive') // For debugging
            };
          });

          console.log(`[${merchant}] 📄 Page content: URL=${pageContent.url.substring(0, 100)}, Title="${pageContent.titleText}"`);
          console.log(`[${merchant}] 🔍 Inactive detection: HasSpecificText=${pageContent.hasInactiveText}, HasAnyInactive=${pageContent.hasAnyInactive}`);
          
          if (pageContent.inactiveMatches.length > 0) {
            console.log(`[${merchant}] 🔍 Found ${pageContent.inactiveMatches.length} instances of "inactive":`);
            pageContent.inactiveMatches.forEach((match, index) => {
              console.log(`[${merchant}]    ${index + 1}: "${match}"`);
            });
          }

          if (pageContent.hasInactiveText) {
            console.log(`[${merchant}] ❌ INACTIVE LINK found - Contains "this link is inactive"`);
            this.emit('progress', { message: `❌ Found inactive link: ${merchant}` });
            
            // DON'T add to inactiveLinks here - let the calling method handle it based on return value
          } else {
            console.log(`[${merchant}] ✅ Link is active - No "this link is inactive" text found`);
            this.emit('progress', { message: `✅ Link active: ${merchant}` });
            
            // DON'T emit individual result here - let the calling method handle it
          }

          // Close the test tab IMMEDIATELY and FORCEFULLY - with better error handling
          let tabClosed = false;
          try {
            console.log(`[${merchant}] 🗂️ Attempting to close test tab...`);
            await newPage.close();
            console.log(`[${merchant}] ✅ Successfully closed test tab`);
            tabClosed = true;
          } catch (closeError) {
            console.error(`[${merchant}] ⚠️ Error closing tab:`, closeError.message);
            // Try multiple force close strategies
            try {
              console.log(`[${merchant}] 🔄 Trying force close strategy 1: navigate to about:blank`);
              await newPage.goto('about:blank');
              await newPage.close();
              console.log(`[${merchant}] ✅ Force-closed test tab after navigation`);
              tabClosed = true;
            } catch (forceCloseError1) {
              console.error(`[${merchant}] ❌ Force close strategy 1 failed:`, forceCloseError1.message);
              try {
                console.log(`[${merchant}] 🔄 Trying force close strategy 2: direct close`);
                await newPage.close();
                console.log(`[${merchant}] ✅ Force-closed test tab (strategy 2)`);
                tabClosed = true;
              } catch (forceCloseError2) {
                console.error(`[${merchant}] ❌ All tab closing strategies failed:`, forceCloseError2.message);
                console.log(`[${merchant}] ⚠️ Tab may remain open - continuing with result processing`);
              }
            }
          }
          
          console.log(`[${merchant}] 📊 Tab closing status: ${tabClosed ? 'SUCCESS' : 'FAILED'}`);
          console.log(`[${merchant}] ✅ Tab cleanup completed - ready for next merchant`);
          console.log(`[${merchant}] 📊 Final result: Link is ${!pageContent.hasInactiveText ? 'ACTIVE' : 'INACTIVE'}`);
          console.log(`[${merchant}] 🔚 === testLink method completed successfully ===`);
          
          // Remove error handlers
          try {
            this.page.removeAllListeners('pageerror');
            this.page.removeAllListeners('requestfailed');
          } catch (handlerError) {
            console.log(`[${merchant}] ⚠️ Error removing handlers: ${handlerError.message}`);
          }
          
          // Return the result - this should work regardless of tab closing status
          const finalResult = { isActive: !pageContent.hasInactiveText };
          console.log(`[${merchant}] 🎯 Returning result:`, finalResult);
          console.log(`[${merchant}] 🔚 === testLink method completed successfully ===`);
          return finalResult;
        } catch (error) {
          console.error(`[${merchant}] Error checking test link:`, error.message);
          console.log(`[${merchant}] ⚠️ Could not verify link due to error - treating as ACTIVE (benefit of doubt)`);
          this.emit('progress', { message: `⚠️ Error checking link for ${merchant} - assuming active` });
          
          // Close the tab anyway with force
          try {
            await newPage.close();
            console.log(`[${merchant}] 🗂️ Successfully closed problematic test tab`);
          } catch (closeError) {
            console.error(`[${merchant}] ⚠️ Error closing problematic tab:`, closeError.message);
            // Try to force close
            try {
              await newPage.goto('about:blank');
              await newPage.close();
              console.log(`[${merchant}] 🗂️ Force-closed problematic tab`);
            } catch (forceCloseError) {
              console.error(`[${merchant}] ❌ Could not force close problematic tab:`, forceCloseError.message);
            }
          }
          console.log(`[${merchant}] ✅ Error tab cleanup completed - ready for next merchant`);
          return { isActive: true }; // Give benefit of doubt when error occurs
        }
    } catch (error) {
      console.error(`[${merchant}] ❌ Error testing link:`, error.message);
      console.error(`[${merchant}] ❌ Error stack:`, error.stack);
      console.log(`[${merchant}] 🎯 Link clicked flag: ${linkWasClicked}`);
      console.log(`[${merchant}] ⚠️ General error testing - checking if link was clicked...`);
      this.emit('progress', { message: `Error testing link for ${merchant}: ${error.message}` });
      
      // If link was clicked (flag is true), try error recovery
      if (linkWasClicked) {
        console.log(`[${merchant}] 🔄 LINK WAS CLICKED - Attempting error recovery...`);
        
        // Check if we have any open tabs (should have them since linkWasClicked is true)
        try {
          const pages = await this.browser.pages();
          console.log(`[${merchant}] 🔍 Found ${pages.length} pages after error`);
          
          if (pages.length > 1) {
            console.log(`[${merchant}] ✅ Link was clicked (new tab opened) - checking content for result`);
            const newPage = pages[pages.length - 1];
            
            try {
              // Try to get the page content to determine if it's active or inactive
              const pageContent = await newPage.evaluate(() => {
                return {
                  url: window.location.href,
                  title: document.title,
                  hasInactiveText: document.body.textContent?.toLowerCase().includes('this link is inactive') || false,
                  bodySnippet: document.body.textContent?.substring(0, 200) || ''
                };
              });
              
              console.log(`[${merchant}] 📄 Error recovery - Page URL: ${pageContent.url.substring(0, 100)}`);
              console.log(`[${merchant}] 📄 Error recovery - Page title: "${pageContent.title}"`);
              console.log(`[${merchant}] 🔍 Error recovery - Has inactive text: ${pageContent.hasInactiveText}`);
              console.log(`[${merchant}] 📄 Error recovery - Body snippet: "${pageContent.bodySnippet}"`);
              
              // Try to close the tab
              try {
                await newPage.close();
                console.log(`[${merchant}] ✅ Closed error recovery tab`);
              } catch (closeErr) {
                console.log(`[${merchant}] ⚠️ Could not close error recovery tab: ${closeErr.message}`);
              }
              
              // Return the appropriate result based on page content
              const result = { isActive: !pageContent.hasInactiveText };
              console.log(`[${merchant}] 🎯 Error recovery result: ${result.isActive ? 'ACTIVE' : 'INACTIVE'}`);
              
              // Remove error handlers
              try {
                this.page.removeAllListeners('pageerror');
                this.page.removeAllListeners('requestfailed');
              } catch (cleanupError) {
                console.log(`[${merchant}] ⚠️ Error cleaning up handlers: ${cleanupError.message}`);
              }
              
              console.log(`[${merchant}] 🔚 === testLink method completed with error recovery ===`);
              const recoveryResult = result;
              console.log(`[${merchant}] 🎯 ERROR RECOVERY RETURNING:`, recoveryResult);
              return recoveryResult;
              
            } catch (contentError) {
              console.error(`[${merchant}] ❌ Could not get page content for error recovery:`, contentError.message);
              
              // Try to close the tab anyway
              try {
                await newPage.close();
                console.log(`[${merchant}] ✅ Closed tab (no content recovery)`);
              } catch (closeErr) {
                console.log(`[${merchant}] ⚠️ Could not close tab: ${closeErr.message}`);
              }
              
              // Since link was clicked but we can't determine result, give benefit of doubt
              console.log(`[${merchant}] 🎯 Link was clicked but content check failed - assuming ACTIVE`);
              
              // Remove error handlers
              try {
                this.page.removeAllListeners('pageerror');
                this.page.removeAllListeners('requestfailed');
              } catch (cleanupError) {
                console.log(`[${merchant}] ⚠️ Error cleaning up handlers: ${cleanupError.message}`);
              }
              
              console.log(`[${merchant}] 🔚 === testLink method completed with benefit of doubt ===`);
              const benefitResult = { isActive: true };
              console.log(`[${merchant}] 🎯 BENEFIT OF DOUBT RETURNING:`, benefitResult);
              return benefitResult; // Benefit of doubt since link was clicked
            }
          } else {
            console.log(`[${merchant}] ❌ Inconsistent state - linkWasClicked=true but no new tabs found`);
            console.log(`[${merchant}] This suggests the tab was closed during error processing`);
            
            // Remove error handlers
            try {
              this.page.removeAllListeners('pageerror');
              this.page.removeAllListeners('requestfailed');
            } catch (cleanupError) {
              console.log(`[${merchant}] ⚠️ Error cleaning up handlers: ${cleanupError.message}`);
            }
            
            // Since link was clicked but tab is gone, give benefit of doubt
            console.log(`[${merchant}] 🔚 === testLink method completed with benefit of doubt (tab was closed) ===`);
            const tabClosedResult = { isActive: true };
            console.log(`[${merchant}] 🎯 TAB CLOSED BENEFIT RETURNING:`, tabClosedResult);
            return tabClosedResult; // Benefit of doubt since link was clicked
          }
        } catch (pageCheckError) {
          console.error(`[${merchant}] ❌ Error checking pages for recovery:`, pageCheckError.message);
          
          // Remove error handlers
          try {
            this.page.removeAllListeners('pageerror');
            this.page.removeAllListeners('requestfailed');
          } catch (cleanupError) {
            console.log(`[${merchant}] ⚠️ Error cleaning up handlers: ${cleanupError.message}`);
          }
          
          // Since link was clicked but we can't check, give benefit of doubt
          console.log(`[${merchant}] 🔚 === testLink method completed with benefit of doubt (page check failed) ===`);
          const pageCheckFailResult = { isActive: true };
          console.log(`[${merchant}] 🎯 PAGE CHECK FAIL BENEFIT RETURNING:`, pageCheckFailResult);
          return pageCheckFailResult; // Benefit of doubt since link was clicked
        }
      } else {
        console.log(`[${merchant}] ❌ LINK WAS NOT CLICKED - No error recovery needed`);
        console.log(`[${merchant}] This means the click attempt failed before opening any tab`);
        
        // Remove error handlers
        try {
          this.page.removeAllListeners('pageerror');
          this.page.removeAllListeners('requestfailed');
        } catch (cleanupError) {
          console.log(`[${merchant}] ⚠️ Error cleaning up handlers: ${cleanupError.message}`);
        }
        
        // If no link was clicked, then it's truly "no test link"
        console.log(`[${merchant}] 🔚 === testLink method FAILED - no link was clicked ===`);
        console.log(`[${merchant}] 🎯 NO CLICK RETURNING: false`);
        return false; // Return false to indicate failed test (no test link)
      }
    }
  }

  async syncMerchantsFromAdmin() {
    try {
      console.log('🔄 Starting merchant sync from Wildlink Admin database...');
      this.emit('progress', { message: 'Connecting to Wildlink Admin merchant database...' });
      
      // Navigate to the merchant list page
      await this.page.goto('https://admin.wildlink.me/merchants', {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // Handle login if needed
      await this.handleLoginIfNeeded();

      console.log('📊 Extracting merchant data from admin interface...');
      this.emit('progress', { message: 'Extracting merchant data from admin interface...' });

      // Wait for merchant list to load
      await this.page.waitForSelector('table, .merchant-list, [data-testid="merchant-table"]', { timeout: 10000 });

      // Extract all merchants from the admin interface
      const merchants = await this.page.evaluate(() => {
        const merchantList = [];
        
        // Try multiple selectors for different admin interface layouts
        const selectors = [
          'table tbody tr',
          '.merchant-list .merchant-item',
          '[data-testid="merchant-row"]',
          '.merchant-row',
          'tr[data-merchant-id]'
        ];
        
        let rows = [];
        for (const selector of selectors) {
          rows = document.querySelectorAll(selector);
          if (rows.length > 0) {
            console.log(`Found ${rows.length} merchants using selector: ${selector}`);
            break;
          }
        }
        
        if (rows.length === 0) {
          // Fallback: try to find any table rows or list items
          rows = document.querySelectorAll('tbody tr, .list-item, .merchant');
        }
        
        rows.forEach((row, index) => {
          try {
            // Extract merchant name - try multiple approaches
            let name = '';
            let url = '';
            let id = '';
            
            // Try to find merchant name
            const nameSelectors = [
              '.merchant-name',
              '[data-field="name"]',
              'td:first-child',
              '.name',
              'h3',
              'h4',
              '.title'
            ];
            
            for (const selector of nameSelectors) {
              const nameElement = row.querySelector(selector);
              if (nameElement && nameElement.textContent.trim()) {
                name = nameElement.textContent.trim();
                break;
              }
            }
            
            // Try to find merchant URL
            const urlSelectors = [
              '.merchant-url',
              '[data-field="url"]',
              'a[href*="http"]',
              '.url',
              '.website'
            ];
            
            for (const selector of urlSelectors) {
              const urlElement = row.querySelector(selector);
              if (urlElement) {
                url = urlElement.href || urlElement.textContent.trim();
                if (url && !url.startsWith('http')) {
                  url = 'https://' + url;
                }
                break;
              }
            }
            
            // Try to find merchant ID
            const idSelectors = [
              '[data-merchant-id]',
              '.merchant-id',
              '[data-field="id"]',
              '.id'
            ];
            
            for (const selector of idSelectors) {
              const idElement = row.querySelector(selector);
              if (idElement) {
                id = idElement.getAttribute('data-merchant-id') || idElement.textContent.trim();
                break;
              }
            }
            
            // If we found at least a name, add the merchant
            if (name && name.length > 1) {
              // Generate URL if not found
              if (!url) {
                const cleanName = name.toLowerCase()
                  .replace(/[^\w\s]/g, '')
                  .replace(/\s+/g, '');
                url = `https://www.${cleanName}.com`;
              }
              
              merchantList.push({
                name: name,
                url: url,
                id: id || `admin_${index}`,
                source: 'wildlink_admin'
              });
            }
          } catch (error) {
            console.warn(`Error processing merchant row ${index}:`, error);
          }
        });
        
        return merchantList;
      });

      console.log(`✅ Extracted ${merchants.length} merchants from Wildlink Admin`);
      this.emit('progress', { 
        message: `Successfully extracted ${merchants.length} merchants from admin database`,
        merchantCount: merchants.length
      });

      // Try to get more merchants by scrolling or pagination
      let totalMerchants = merchants.length;
      let pageNumber = 1;
      
      while (pageNumber < 10) { // Limit to 10 pages to avoid infinite loops
        try {
          // Look for pagination or "Load More" buttons
          const nextButton = await this.page.$('button:has-text("Next"), .pagination-next, [aria-label="Next page"], button:has-text("Load More")');
          
          if (nextButton) {
            console.log(`📄 Loading page ${pageNumber + 1}...`);
            this.emit('progress', { message: `Loading additional merchants from page ${pageNumber + 1}...` });
            
            await nextButton.click();
            await this.page.waitForTimeout(2000); // Wait for new content to load
            
            // Extract merchants from the new page
            const newMerchants = await this.page.evaluate(() => {
              // Same extraction logic as above
              const merchantList = [];
              const rows = document.querySelectorAll('table tbody tr, .merchant-list .merchant-item, [data-testid="merchant-row"]');
              
              rows.forEach((row, index) => {
                try {
                  let name = '';
                  let url = '';
                  let id = '';
                  
                  const nameElement = row.querySelector('.merchant-name, [data-field="name"], td:first-child, .name');
                  if (nameElement) {
                    name = nameElement.textContent.trim();
                  }
                  
                  const urlElement = row.querySelector('.merchant-url, [data-field="url"], a[href*="http"], .url');
                  if (urlElement) {
                    url = urlElement.href || urlElement.textContent.trim();
                    if (url && !url.startsWith('http')) {
                      url = 'https://' + url;
                    }
                  }
                  
                  const idElement = row.querySelector('[data-merchant-id], .merchant-id, [data-field="id"]');
                  if (idElement) {
                    id = idElement.getAttribute('data-merchant-id') || idElement.textContent.trim();
                  }
                  
                  if (name && name.length > 1) {
                    if (!url) {
                      const cleanName = name.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, '');
                      url = `https://www.${cleanName}.com`;
                    }
                    
                    merchantList.push({
                      name: name,
                      url: url,
                      id: id || `admin_p${pageNumber}_${index}`,
                      source: 'wildlink_admin'
                    });
                  }
                } catch (error) {
                  console.warn(`Error processing merchant row ${index} on page ${pageNumber}:`, error);
                }
              });
              
              return merchantList;
            });
            
            // Filter out duplicates and add new merchants
            const existingNames = new Set(merchants.map(m => m.name.toLowerCase()));
            const uniqueNewMerchants = newMerchants.filter(m => !existingNames.has(m.name.toLowerCase()));
            
            merchants.push(...uniqueNewMerchants);
            totalMerchants = merchants.length;
            
            console.log(`📄 Page ${pageNumber + 1}: Added ${uniqueNewMerchants.length} new merchants (total: ${totalMerchants})`);
            
            pageNumber++;
          } else {
            console.log('📄 No more pages found, pagination complete');
            break;
          }
        } catch (paginationError) {
          console.log(`📄 Pagination ended: ${paginationError.message}`);
          break;
        }
      }

      console.log(`🎯 Final merchant sync result: ${totalMerchants} merchants extracted from Wildlink Admin`);
      this.emit('progress', { 
        message: `✅ Sync completed: ${totalMerchants} merchants extracted from Wildlink Admin`,
        merchantCount: totalMerchants,
        completed: true
      });

      return {
        success: true,
        merchants: merchants,
        count: totalMerchants
      };

    } catch (error) {
      console.error('❌ Error syncing merchants from Wildlink Admin:', error);
      this.emit('progress', { 
        message: `❌ Sync failed: ${error.message}`,
        error: true
      });
      throw error;
    }
  }

  async testPageForUnavailability(merchant, page, pageTitle, pageContent, response) {
    try {
      const pageText = (pageTitle + ' ' + pageContent).toLowerCase();
      
      console.log(`[${merchant}] 🌐 Page title: "${pageTitle}"`);
      console.log(`[${merchant}] 🌐 Content length: ${pageContent?.length || 0} characters`);
      
      // Define comprehensive unavailability patterns
      const unavailabilityPatterns = [
        // Store unavailable patterns
        'this store is unavailable',
        'our store is unavailable', 
        'store is currently unavailable',
        'sorry, this store is currently unavailable',
        'this store does not exist',
        'store temporarily closed',
        'shop temporarily closed',
        'website temporarily unavailable',
        'site temporarily unavailable',
        
        // Domain/website for sale
        'this website is for sale',
        'this domain is for sale',
        'domain name is for sale',
        'parked domain',
        'domain parking',
        
        // Coming soon patterns
        'website coming soon',
        'site coming soon',
        'this website is coming soon',
        'this site is coming soon',
        'opening soon',
        'launching soon',
        'launch soon',
        'under construction',
        'site under construction',
        'website under construction',
        
        // Business closure patterns
        'ceased operations',
        'officially ceased operations',
        'we have now officially ceased operations',
        'we have ceased operations',
        'business has ceased operations',
        'company has ceased operations',
        'operations have ceased',
        'no longer in business',
        'business closed permanently',
        'permanently closed',
        'closed permanently',
        'out of business',
        'business discontinued',
        'operations discontinued',
        'service discontinued',
        'company closed',
        'business shutdown',
        'operations ended',
        
        // Maintenance patterns
        'website maintenance mode',
        'site maintenance mode', 
        'down for maintenance',
        'site maintenance',
        'website maintenance',
        'scheduled maintenance',
        'site offline',
        'website offline',
        'service unavailable',
        'temporarily down for maintenance',
        'be right back - site maintenance',
        
        // Access/suspension patterns
        'website suspended',
        'account suspended',
        'site suspended',
        'access restricted',
        'site not found',
        'page not found',
        
        // Error patterns
        '404 not found',
        '404 error',
        'error 404',
        'page cannot be found',
        'the page you requested was not found',
        'this page could not be found',
        
        // Newsletter/launch signup patterns
        'sign up for our newsletter to be the first to know when we launch',
        'be the first to know when we launch',
        'sign up to be notified when we launch',
        'get notified when we launch',
        'coming soon - sign up',
        'notify me when available',
        'join our mailing list',
        'subscribe for updates',
        'stay tuned for launch',
        'pre-launch signup'
      ];
      
      // Check for unavailability patterns
      let foundPattern = null;
      for (const pattern of unavailabilityPatterns) {
        if (pageText.includes(pattern)) {
          foundPattern = pattern;
          console.log(`[${merchant}] 🚨 UNAVAILABILITY PATTERN DETECTED: "${pattern}"`);
          break;
        }
      }
      
      // Additional checks for minimal content (potential placeholder pages)
      const hasMinimalContent = pageContent && pageContent.trim().length < 200;
      if (hasMinimalContent && !foundPattern) {
        console.log(`[${merchant}] ⚠️ Minimal content detected (${pageContent.trim().length} chars) - checking for placeholder indicators`);
        
        // Check if minimal content contains placeholder indicators
        const placeholderIndicators = [
          'default page',
          'placeholder',
          'test page',
          'sample page',
          'example page',
          'template',
          'lorem ipsum'
        ];
        
        for (const indicator of placeholderIndicators) {
          if (pageText.includes(indicator)) {
            foundPattern = `minimal content with placeholder: ${indicator}`;
            console.log(`[${merchant}] 🚨 PLACEHOLDER DETECTED: "${indicator}"`);
            break;
          }
        }
      }
      
      // Check for HTTP error status codes
      let statusError = null;
      const statusCode = response?.status();
      if (statusCode && (statusCode >= 400 || statusCode < 200)) {
        statusError = `HTTP ${statusCode} error`;
        console.log(`[${merchant}] 🚨 HTTP ERROR: ${statusCode}`);
      }
      
      // Determine final result - only flag if unavailability patterns are found
      const shouldFlag = foundPattern || statusError;
      const isActive = !shouldFlag;
      
      if (shouldFlag) {
        console.log(`[${merchant}] 🚩 FLAGGED: ${foundPattern || statusError}`);
        console.log(`[${merchant}] 🌐 URL test result: UNAVAILABLE (${foundPattern || statusError})`);
      } else {
        console.log(`[${merchant}] ✅ NO UNAVAILABILITY PATTERNS FOUND`);
        console.log(`[${merchant}] 🌐 URL test result: AVAILABLE (no issues detected)`);
      }
      
      return { isActive: isActive };
      
    } catch (error) {
      console.log(`[${merchant}] ❌ Error testing page for unavailability: ${error.message}`);
      return { isActive: true }; // Don't flag on testing errors
    }
  }

  async close() {
    try {
      // Don't close anything - keep browser and page open for user interaction
      console.log('🔒 Keeping MAdmin browser and page open for continued use');
      this.shouldStop = true; // Signal to stop testing
      this.isPaused = false;
      
      if (this.usingExistingBrowser) {
        console.log('🔒 Using existing Wildlink browser - keeping all tabs open');
      } else if (this.browser) {
        console.log('🔒 Keeping MAdmin browser open to preserve login session and allow manual interaction');
      }
    } catch (error) {
      console.error('Error in MAdmin close method:', error);
    }
  }

  stop() {
    console.log('🛑 Stopping MAdmin testing...');
    this.shouldStop = true;
    this.isPaused = false;
  }

  pause() {
    console.log('⏸️ Pausing MAdmin testing...');
    this.isPaused = true;
  }

  resume() {
    console.log('▶️ Resuming MAdmin testing...');
    this.isPaused = false;
  }

  async waitIfPaused() {
    while (this.isPaused && !this.shouldStop) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

module.exports = MAdminScraper;
