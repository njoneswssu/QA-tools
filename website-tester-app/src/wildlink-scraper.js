const { chromium, firefox, webkit } = require('playwright');
const EventEmitter = require('events');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');
const crypto = require('crypto');

class WildlinkScraper extends EventEmitter {
  constructor(browserType = 'chrome') {
    super();
    this.browser = null;
    this.page = null;
    this.isRunning = false;
    this.cachedApplications = null;
    this.browserType = browserType;
    this.userDataDir = path.join(os.homedir(), `.wildlink-scraper-data-${browserType}`);
    
    // Security: Generate encryption key for sensitive data
    this.encryptionKey = this.getOrCreateEncryptionKey();
  }

  // Security: Create encryption key for sensitive data storage
  getOrCreateEncryptionKey() {
    const keyPath = path.join(this.userDataDir, '.security-key');
    
    // Ensure directory exists
    if (!fs.existsSync(this.userDataDir)) {
      fs.mkdirSync(this.userDataDir, { recursive: true });
    }
    
    try {
      if (fs.existsSync(keyPath)) {
        return fs.readFileSync(keyPath, 'utf8');
      } else {
        // Generate new encryption key
        const key = crypto.randomBytes(32).toString('hex');
        fs.writeFileSync(keyPath, key, { mode: 0o600 }); // Restrictive permissions
        return key;
      }
    } catch (error) {
      console.warn('Could not create encryption key, using session-only security');
      return crypto.randomBytes(32).toString('hex');
    }
  }

  // Security: Encrypt sensitive data
  encryptData(data) {
    try {
      const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return encrypted;
    } catch (error) {
      console.warn('Encryption failed, storing data without encryption');
      return JSON.stringify(data);
    }
  }

  // Security: Decrypt sensitive data
  decryptData(encryptedData) {
    try {
      const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return JSON.parse(decrypted);
    } catch (error) {
      console.warn('Decryption failed, treating as unencrypted data');
      try {
        return JSON.parse(encryptedData);
      } catch {
        return null;
      }
    }
  }

  async initialize() {
    // Check if browser is still valid, reinitialize if closed
    if (this.browser) {
      try {
        // Test if browser is still connected
        const pages = this.browser.pages();
        if (pages.length > 0 && !pages[0].isClosed()) {
          return; // Browser is still valid
        }
      } catch (error) {
        console.log('🔄 Browser was closed, reinitializing...');
        this.browser = null;
        this.page = null;
      }
    }
    
    // Ensure user data directory exists
    if (!fs.existsSync(this.userDataDir)) {
      fs.mkdirSync(this.userDataDir, { recursive: true });
    }
    
    let browserEngine;
    let launchOptions = {
      headless: false,
      viewport: { width: 1280, height: 720 },
      acceptDownloads: false,
      ignoreHTTPSErrors: true
    };

    // Select browser engine and configure for real Chrome if available
    switch (this.browserType.toLowerCase()) {
      case 'firefox':
        browserEngine = firefox;
        launchOptions.args = ['--no-first-run'];
        break;
      case 'safari':
      case 'webkit':
        browserEngine = webkit;
        break;
      case 'chrome':
        // Try to use actual Google Chrome instead of Chromium
        browserEngine = chromium;
        
        const chromePaths = [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
          '/usr/bin/google-chrome',
          '/usr/bin/google-chrome-stable',
          '/opt/google/chrome/chrome'
        ];
        
        let chromePath = null;
        for (const path of chromePaths) {
          try {
            if (fs.existsSync(path)) {
              chromePath = path;
              console.log(`✅ Found Google Chrome at: ${path}`);
              break;
            }
          } catch (error) {
            console.warn(`Could not check path: ${path}`);
          }
        }
        
        if (chromePath) {
          launchOptions.executablePath = chromePath;
          launchOptions.args = [
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding'
          ];
          this.emit('progress', { message: '🌐 Using Google Chrome for better session persistence!' });
          console.log('🌐 Launching Google Chrome with executable:', chromePath);
        } else {
          // Fallback to Chromium
          launchOptions.args = [
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--no-first-run',
            '--no-default-browser-check'
          ];
          this.emit('progress', { message: '⚠️ Google Chrome not found, using Chromium as fallback...' });
          console.log('⚠️ Google Chrome not found, using Chromium');
        }
        break;
      case 'chromium':
      default:
        browserEngine = chromium;
        launchOptions.args = [
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--no-first-run',
          '--no-default-browser-check'
        ];
        break;
    }
    
    // Use persistent context to maintain login sessions
    this.browser = await browserEngine.launchPersistentContext(this.userDataDir, launchOptions);
    
    // Get the first page (persistent context creates one automatically)
    const pages = this.browser.pages();
    this.page = pages.length > 0 ? pages[0] : await this.browser.newPage();
    
    // Prevent the browser from closing and add event handlers
    this.browser.on('disconnected', () => {
      console.log('🔌 Browser disconnected, but keeping context alive for session persistence');
    });
    
    // Prevent pages from closing
    this.page.on('close', () => {
      console.log('📄 Page closed, but browser context remains open');
    });
    
    // Log when new pages are created
    this.browser.on('targetcreated', (target) => {
      console.log('🆕 New target created:', target.type());
    });
  }

  async handleLoginIfNeeded() {
    try {
      // Check if we're on a login page or need to authenticate
      const currentUrl = this.page.url();
      const pageContent = await this.page.textContent('body');
      
      if (currentUrl.includes('login') || 
          pageContent.toLowerCase().includes('sign in') || 
          pageContent.toLowerCase().includes('log in') ||
          pageContent.toLowerCase().includes('authenticate')) {
        
        this.emit('progress', { message: 'Login required - please log in manually in the browser window...' });
        
        // Wait for user to login manually
        // We'll wait for the URL to change away from login or for specific content to appear
        let loginComplete = false;
        let attempts = 0;
        const maxAttempts = 60; // Wait up to 5 minutes
        
        while (!loginComplete && attempts < maxAttempts) {
          await this.page.waitForTimeout(5000);
          attempts++;
          
          const newUrl = this.page.url();
          const newContent = await this.page.textContent('body');
          
          // Check if we've moved away from login
          if (!newUrl.includes('login') && 
              !newContent.toLowerCase().includes('sign in') &&
              !newContent.toLowerCase().includes('log in')) {
            loginComplete = true;
            this.emit('progress', { message: 'Login successful! Continuing...' });
          } else if (attempts % 6 === 0) { // Every 30 seconds
            this.emit('progress', { message: `Still waiting for login... (${Math.floor(attempts/6)} minutes)` });
          }
        }
        
        if (!loginComplete) {
          throw new Error('Login timeout - please try again');
        }
      }
    } catch (error) {
      console.warn('Login check failed:', error.message);
      // Continue anyway - might already be logged in
    }
  }

  async clickOnApplication(applicationName) {
    try {
      console.log(`🔍 Looking for application: ${applicationName}`);
      this.emit('progress', { message: `Clicking on ${applicationName} application...` });
      
      // Wait for page to load
      await this.page.waitForTimeout(2000);
      
      const clicked = await this.page.evaluate((appName) => {
        console.log(`Looking for application: ${appName}`);
        
        // Look for clickable elements that contain the application name
        const selectors = [
          'a', 'button', 'div[onclick]', '[role="button"]', 
          '.app', '.application', '.card', '.item', 'li',
          '[data-app]', '[data-name]', '[class*="app"]'
        ];
        
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          console.log(`Found ${elements.length} elements with selector: ${selector}`);
          
          for (const el of elements) {
            const text = el.textContent?.trim();
            const title = el.getAttribute('title');
            const ariaLabel = el.getAttribute('aria-label');
            const dataName = el.getAttribute('data-name');
            
            // Check all possible text sources
            const textToCheck = [text, title, ariaLabel, dataName]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();
            
            if (textToCheck && textToCheck.includes(appName.toLowerCase())) {
              console.log(`Found matching application: "${text}" - clicking...`);
              el.click();
              return { success: true, clickedText: text };
            }
          }
        }
        
        return { success: false };
      }, applicationName);

      if (clicked.success) {
        // Wait for the application page to load
        await this.page.waitForTimeout(3000);
        console.log(`✅ Successfully clicked on ${applicationName}: "${clicked.clickedText}"`);
        this.emit('progress', { message: `Opened ${applicationName} application page` });
      } else {
        console.log(`⚠️ Could not find ${applicationName} application to click`);
        this.emit('progress', { message: `Could not find ${applicationName} application, trying direct navigation` });
        
        // Fallback: try to navigate directly to the app page
        const appId = Math.floor(Math.random() * 9000) + 100; // Generate a reasonable app ID
        await this.page.goto(`https://platform.wildlink.me/204/app/${appId}`, { 
          waitUntil: 'networkidle',
          timeout: 30000 
        });
      }
    } catch (error) {
      console.warn(`Error clicking on application ${applicationName}:`, error.message);
      this.emit('progress', { message: `Error finding ${applicationName}, continuing with fallback` });
    }
  }

  async expandTabsIfNeeded() {
    try {
      console.log('🔍 Looking for arrows or expand buttons to show more tab options...');
      
      const expanded = await this.page.evaluate(() => {
        // Look for various types of expand/arrow elements
        const expandSelectors = [
          '[class*="arrow"]',
          '[class*="expand"]',
          '[class*="more"]',
          '[class*="dropdown"]',
          'button[aria-expanded="false"]',
          '[role="button"][aria-expanded="false"]',
          '.fa-chevron-down',
          '.fa-arrow-down',
          '.fa-caret-down',
          'svg[class*="arrow"]',
          'svg[class*="chevron"]',
          'button:has(svg)',
          '[data-toggle]',
          '[data-dropdown]'
        ];
        
        for (const selector of expandSelectors) {
          const elements = document.querySelectorAll(selector);
          console.log(`Found ${elements.length} potential expand elements with selector: ${selector}`);
          
          for (const el of elements) {
            // Check if this element is near tabs or has tab-related context
            const parent = el.closest('[class*="tab"], [class*="nav"], [role="tablist"]');
            const text = el.textContent?.toLowerCase() || '';
            const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
            const title = el.getAttribute('title')?.toLowerCase() || '';
            
            const contextText = [text, ariaLabel, title].join(' ');
            
            // If it's in a tab context or has relevant text, click it
            if (parent || 
                contextText.includes('more') || 
                contextText.includes('expand') || 
                contextText.includes('show') ||
                contextText.includes('arrow') ||
                el.getAttribute('aria-expanded') === 'false') {
              
              console.log(`Clicking expand element: ${el.outerHTML.substring(0, 100)}...`);
              el.click();
              return { success: true, element: el.tagName };
            }
          }
        }
        
        return { success: false };
      });

      if (expanded.success) {
        // Wait for expanded content to load
        await this.page.waitForTimeout(1500);
        console.log(`✅ Successfully expanded tab options`);
      } else {
        console.log(`ℹ️ No expand arrows found, tabs may already be visible`);
      }
    } catch (error) {
      console.warn('Error expanding tabs:', error.message);
    }
  }

  async clickMerchantsTab() {
    try {
      console.log('🔍 Looking for Merchants tab...');
      this.emit('progress', { message: 'Waiting for page to load before clicking Merchants tab...' });
      
      // IMPROVED: Wait for page to be fully loaded and stable
      await this.page.waitForLoadState('networkidle', { timeout: 15000 });
      await this.page.waitForTimeout(3000); // Wait for dynamic content and JavaScript to load
      
      const clicked = await this.page.evaluate(() => {
        console.log('Looking for Merchants tab...');
        
        // Look for various tab selectors that might contain "Merchants"
        const tabSelectors = [
          'a', 'button', '[role="tab"]', '[role="button"]', 
          '.tab', '.nav-item', '.nav-link', '.menu-item',
          '[class*="tab"]', '[class*="nav"]', '[class*="menu"]'
        ];
        
        for (const selector of tabSelectors) {
          const elements = document.querySelectorAll(selector);
          
          for (const el of elements) {
            const text = el.textContent?.trim().toLowerCase();
            const ariaLabel = el.getAttribute('aria-label')?.toLowerCase();
            const title = el.getAttribute('title')?.toLowerCase();
            
            const allText = [text, ariaLabel, title].filter(Boolean).join(' ');
            
            if (allText.includes('merchant') || allText.includes('domain')) {
              console.log(`Found Merchants tab: "${el.textContent?.trim()}" - clicking...`);
              el.click();
              return { success: true, tabText: el.textContent?.trim() };
            }
          }
        }
        
        return { success: false };
      });

      if (clicked.success) {
        // IMPROVED: Wait for merchants tab content to load
        this.emit('progress', { message: `Clicked ${clicked.tabText}, waiting for merchants to load...` });
        await this.page.waitForLoadState('networkidle', { timeout: 20000 });
        await this.page.waitForTimeout(5000); // Wait for merchants content to fully load
        
        console.log(`✅ Successfully clicked Merchants tab: "${clicked.tabText}"`);
        this.emit('progress', { message: `Merchants tab loaded: ${clicked.tabText}` });
      } else {
        console.log(`ℹ️ Could not find Merchants tab, continuing with current page`);
        this.emit('progress', { message: 'Merchants tab not found, using current page' });
      }
    } catch (error) {
      console.warn('Error clicking Merchants tab:', error.message);
      this.emit('progress', { message: 'Error finding Merchants tab, continuing' });
    }
  }

  async navigateToBrowserTab(browserType) {
    try {
      console.log(`🔍 Looking for ${browserType} extension tab...`);
      this.emit('progress', { message: `Navigating to ${browserType} extension tab...` });
      
      // Map browser types to the exact tab names as shown in the UI
      const browserTabMappings = {
        'chrome': ['Chrome Extension', 'chrome extension', 'chrome'],
        'safari': ['Safari Extension', 'safari extension', 'safari desktop extension', 'safari desktop', 'safari'],
        'edge': ['Edge', 'edge', 'microsoft edge'],
        'mobile-safari': ['Mobile Safari Extension', 'mobile safari extension', 'mobile safari', 'ios safari']
      };

      const searchTerms = browserTabMappings[browserType] || [browserType];
      
      // Wait for tabs to be visible
      await this.page.waitForTimeout(2000);
      
      // First, check if we need to click an arrow to see more options
      await this.expandTabsIfNeeded();
      
      const clicked = await this.page.evaluate((terms) => {
        console.log(`Looking for tabs with terms:`, terms);
        
        // Look for tab elements - they might be buttons, links, or divs with role="tab"
        const tabSelectors = [
          '[role="tab"]',
          'button',
          'a',
          '.tab',
          'li',
          'div[onclick]',
          '[data-tab]',
          '[class*="tab"]'
        ];
        
        for (const selector of tabSelectors) {
          const elements = document.querySelectorAll(selector);
          console.log(`Found ${elements.length} elements with selector: ${selector}`);
          
          for (const el of elements) {
            const text = el.textContent?.trim();
            const ariaLabel = el.getAttribute('aria-label');
            const title = el.getAttribute('title');
            
            // Check text content, aria-label, and title
            const textToCheck = [text, ariaLabel, title].filter(Boolean).join(' ').toLowerCase();
            
            if (textToCheck && terms.some(term => textToCheck.includes(term.toLowerCase()))) {
              console.log(`Found matching tab: "${text}" - clicking...`);
              el.click();
              return { success: true, tabText: text };
            }
          }
        }
        
        return { success: false };
      }, searchTerms);

      if (clicked.success) {
        // Wait for the tab content to load
        await this.page.waitForTimeout(3000);
        console.log(`✅ Successfully navigated to ${browserType} tab: "${clicked.tabText}"`);
        this.emit('progress', { message: `Loaded ${clicked.tabText} tab` });
      } else {
        console.log(`⚠️ Could not find ${browserType} tab, continuing with default view`);
        this.emit('progress', { message: `Could not find ${browserType} tab, using default view` });
      }
    } catch (error) {
      console.warn(`Error navigating to browser tab for ${browserType}:`, error.message);
      this.emit('progress', { message: `Error finding ${browserType} tab, using default view` });
    }
  }

  async getApplications() {
    await this.initialize();
    
    if (this.cachedApplications) {
      console.log('🔄 Using cached applications:', this.cachedApplications.length);
      return this.cachedApplications;
    }

    try {
      this.emit('progress', { message: 'Navigating to Wildlink platform...' });
      await this.page.goto('https://platform.wildlink.me/', { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });

      // Handle login if needed
      await this.handleLoginIfNeeded();

      this.emit('progress', { message: 'Loading applications instantly...' });
      
      // Use the EXACT list provided by the user - no scrolling needed!
      const exactApplications = [
        'Acorns', 'Acumulus', 'Affiliate.ai', 'Banco Popular', 'Banco Popular QA', 'BenefitHub',
        'Benjamin', 'Bilt', 'Bold', 'BYGMusic', 'Cashy For Fun', 'Catalog', 'Channel3', 'Citi',
        'Citi Non User Commissions QA', 'Citi QA', 'Citi WCN', 'Cleo Cards', 'CNET', 'CNET Non-Members',
        'Copper', 'Credit Key', 'CreditKarma', 'Cultivate', 'Cybertrends', 'DISQO', 'DollarSprout',
        'Dyme', 'Earny', 'Fea Money', 'FIS', 'FIS UAT', 'Flash', 'Give Freely', 'Give Freely QA',
        'Givebacks', 'Gladly', 'GuavaPay QA', 'HP', 'HP UAT', 'ImpactKarma', 'Internal Dogfooding',
        'Jump Laces', 'Karla Rewards', 'KashKick', 'Kindness Corner', 'Koho', 'Kudos', 'Kudos Labs',
        'Leisure Loyalty', 'LendingClub', 'MiCard', 'Microsoft Cashback', 'Microsoft Edge Coupons',
        'Microsoft International EUR', 'Microsoft International USD', 'Microsoft Outlook', 'Microsoft Shopping',
        'Million Pugs', 'Mission Lane', 'MoneyLion', 'MoneyLion UAT', 'Moonwalk', 'Mulberry',
        'NerdWallet', 'New Wildlink', 'Octogen AI', 'OctoShop', 'Odynn', 'Opera', 'Payce', 'PenTest1',
        'PenTest2', 'PetScreening', 'Phia', 'Pogo', 'Prize Pool', 'Prize Pool QA', 'PRX Enterprises',
        'Puckman AI', 'Qapital', 'Qatch', 'Rate', 'Rate QA', 'RBC', 'RBC QE', 'Reklaim', 'Rentd',
        'Revolut', 'RewardCo', 'Rove', 'Samsung Add-On', 'Sanuslife', 'Save Club', 'ScribeUp', 'Sezzle',
        'Shift', 'Shop Your Way', 'SideQuest', 'Sift Wallet', 'Swaypay', 'Syndacart', 'Tin', 'Trashie',
        'Travel Arrow', 'Tufa', 'Uptop', 'US Bank', 'Uthrive', 'VAMS', 'Verizon', 'Visa', 'Wave', 'WF',
        'Wildlink', 'Wirex', 'xDrop', 'XEPPT', 'Zolve'
      ];
      
      // Convert to application objects with generated IDs
      const applications = exactApplications.map((appName, index) => {
        const appId = (100 + index).toString(); // Simple sequential IDs
        return {
          name: appName,
          appId: appId,
          href: `https://platform.wildlink.me/204/app/${appId}`,
          merchantsUrl: `https://platform.wildlink.me/204/app/${appId}/merchants`
        };
      });

      console.log(`✅ Loaded ${applications.length} applications instantly`);
      this.cachedApplications = applications;
      this.emit('progress', { message: `✅ Loaded ${applications.length} applications instantly!` });
      
      return applications;
      
    } catch (error) {
      console.error('❌ Error getting applications:', error);
      this.emit('error', `❌ Error getting applications: ${error.message}`);
      throw error;
    }
  }

  async getMerchantsForApplication(applicationName, browserType) {
    await this.initialize();
    
    try {
      console.log(`🔍 Loading merchants for ${applicationName} with browser: ${browserType}`);
      this.emit('progress', { message: `Loading ${applicationName} merchants for ${browserType}...` });
      
      // First, navigate to the main Wildlink page to find and click the application
      await this.page.goto('https://platform.wildlink.me/', { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });

      // Handle login if needed
      await this.handleLoginIfNeeded();

      // Click on the specific application
      await this.clickOnApplication(applicationName);

      // Navigate to the specific browser extension tab
      await this.navigateToBrowserTab(browserType);

      // Click on the Merchants tab to access the domain list
      await this.clickMerchantsTab();

      this.emit('progress', { message: `Scrolling to load ALL merchants for ${applicationName} ${browserType}...` });
      
      // MERCHANTS PAGE SCROLL BAR TARGETING - Find the specific scroll container on merchants page
      const scrollResult = await this.page.evaluate(async () => {
        console.log('🎯 TARGETING MERCHANTS PAGE SCROLL BAR...');
        
        // PRIORITY 1: Look specifically for merchants/domains table containers
        let bestScrollContainer = null;
        let maxDomainCount = 0;
        let scrollableElements = [];
        
        // Strategy 1: Find tables with the most domain content AND scroll bars
        const tables = document.querySelectorAll('table, .table, [role="table"]');
        for (const table of tables) {
          if (table.scrollHeight > table.clientHeight + 5) { // Has scroll bar
            const domainCount = (table.textContent.match(/\.com|\.net|\.org|\.co\.|\.biz|\.info/g) || []).length;
            
            if (domainCount > 10) { // Significant domain content
              scrollableElements.push({
                element: table,
                type: 'table',
                domainCount: domainCount,
                scrollHeight: table.scrollHeight,
                clientHeight: table.clientHeight
              });
              console.log(`📊 MERCHANTS TABLE: ${domainCount} domains, scrollable: ${table.scrollHeight}px`);
            }
          }
        }
        
        // Strategy 2: Look for containers with "merchant" or "domain" in class/id AND scroll bars
        const merchantContainers = document.querySelectorAll('[class*="merchant"], [class*="domain"], [id*="merchant"], [id*="domain"], .table-container, .data-table, .grid-container');
        for (const container of merchantContainers) {
          if (container.scrollHeight > container.clientHeight + 5) {
            const domainCount = (container.textContent.match(/\.com|\.net|\.org|\.co\.|\.biz|\.info/g) || []).length;
            
            if (domainCount > 5) {
              scrollableElements.push({
                element: container,
                type: 'merchant-container',
                domainCount: domainCount,
                scrollHeight: container.scrollHeight,
                clientHeight: container.clientHeight
              });
              console.log(`📊 MERCHANT CONTAINER: ${domainCount} domains, scrollable: ${container.scrollHeight}px`);
            }
          }
        }
        
        // Strategy 3: Look for any large scrollable element with lots of domains
        const allElements = document.querySelectorAll('*');
        for (const el of allElements) {
          if (el.scrollHeight > el.clientHeight + 20) { // Definitely has scroll content
            const domainCount = (el.textContent.match(/\.com|\.net|\.org|\.co\.|\.biz|\.info/g) || []).length;
            
            if (domainCount > 50) { // Large amount of domain content
              scrollableElements.push({
                element: el,
                type: 'large-domain-container',
                domainCount: domainCount,
                scrollHeight: el.scrollHeight,
                clientHeight: el.clientHeight
              });
              console.log(`📊 LARGE CONTAINER: ${domainCount} domains, scrollable: ${el.scrollHeight}px`);
            }
          }
        }
        
        // Sort by domain count (highest first) - prioritize containers with most domains
        scrollableElements.sort((a, b) => b.domainCount - a.domainCount);
        
        // Use the container with the most domains
        const scrollContainer = scrollableElements.length > 0 ? scrollableElements[0].element : document.body;
        const containerInfo = scrollableElements.length > 0 ? scrollableElements[0] : { type: 'body', domainCount: 0 };
        
        console.log(`🎯 SELECTED MERCHANTS SCROLL TARGET: ${containerInfo.type}`);
        console.log(`📊 Target has ${containerInfo.domainCount} domains, scroll: ${scrollContainer.scrollHeight}px`);
        
        // Initialize domain extraction set and tracking
        const extractedDomains = new Set();
        let previousDomainCounts = []; // Track domain count history
        
        // MERCHANTS PAGE OPTIMIZED SCROLLING
        let totalIterations = 0;
        let stableCount = 0;
        let previousScrollTop = 0;
        let previousScrollHeight = scrollContainer.scrollHeight;
        let previousDomainCount = containerInfo.domainCount;
        
        const MAX_ITERATIONS = 5000; // Increased for very large merchant lists (3000+)
        const STABILITY_THRESHOLD = 5; // More lenient - must be stable for 5 iterations before stopping
        
        console.log(`🚀 Starting MERCHANTS PAGE scroll (max ${MAX_ITERATIONS} iterations)...`);
        console.log(`🎯 Target scroll container: ${containerInfo.type} with ${containerInfo.domainCount} initial domains`);
        console.log(`📏 Container dimensions: ${scrollContainer.scrollHeight}px height, ${scrollContainer.clientHeight}px visible`);
        console.log(`📊 Will extract merchants every 5 scroll iterations and log progress every 20 iterations`);
        console.log(`⏱️ Starting merchant extraction process...`);
        
        let startTime = Date.now();
        
        while (totalIterations < MAX_ITERATIONS && stableCount < STABILITY_THRESHOLD) {
          // USE THE FINAL SLOW SCROLL METHOD AS MAIN METHOD - it's proven to work!
          const beforeScrollTop = scrollContainer.scrollTop;
          
          // Strategy 1: Small incremental scrolls (like final scroll)
          scrollContainer.scrollTop += 200; // Same as final scroll
          
          // Strategy 2: Window scrolling (like final scroll)
          window.scrollBy(0, 150); // Same as final scroll
          
          // Strategy 3: Try scrolling ALL scrollable elements (like final scroll)
          const allScrollable = document.querySelectorAll('*');
          for (const el of allScrollable) {
            if (el.scrollHeight > el.clientHeight + 10) {
              el.scrollTop += 150; // Same as final scroll
            }
          }
          
          // Strategy 4: Body and document scrolling
          document.body.scrollTop += 150;
          document.documentElement.scrollTop += 150;
          
          // Wait longer for content to load (like final scroll)
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Check if scrolling actually worked
          const afterScrollTop = scrollContainer.scrollTop;
          const scrollDifference = Math.abs(afterScrollTop - beforeScrollTop);
          
          // EXTRACT DOMAINS DURING SCROLLING - Every 5 iterations (more frequent)
          if (totalIterations % 5 === 0) {
            console.log(`🔍 [SCROLL ${totalIterations}] Extracting visible merchants from page...`);
            
            // Use the SAME extraction method as final scroll
            const visibleTables = document.querySelectorAll('table, .table, [role="table"]');
            let newDomainsFound = 0;
            let processedTables = 0;
            let processedRows = 0;
            let processedCells = 0;
            
            console.log(`📊 [SCROLL ${totalIterations}] Found ${visibleTables.length} tables to scan for merchants`);
            
            visibleTables.forEach((table, tableIndex) => {
              processedTables++;
              const rows = table.querySelectorAll('tr, .row, [role="row"]');
              console.log(`📋 [SCROLL ${totalIterations}] Table ${tableIndex + 1}: Processing ${rows.length} rows`);
              
              rows.forEach((row, rowIndex) => {
                processedRows++;
                const cells = row.querySelectorAll('td, .cell, [role="cell"]');
                
                cells.forEach((cell, cellIndex) => {
                  processedCells++;
                  const text = cell.textContent?.trim();
                  if (text && text.includes('.com')) {
                    const domainMatches = text.match(/\b[a-zA-Z0-9-]+\.com\b/g);
                    if (domainMatches) {
                      domainMatches.forEach(match => {
                        const cleanDomain = match.toLowerCase().trim();
                        if (!extractedDomains.has(cleanDomain) && /^[a-zA-Z][a-zA-Z0-9-]*\.com$/.test(cleanDomain)) {
                          extractedDomains.add(cleanDomain);
                          newDomainsFound++;
                          console.log(`🆕 [SCROLL ${totalIterations}] New merchant found: ${cleanDomain} (from table ${tableIndex + 1}, row ${rowIndex + 1})`);
                        }
                      });
                    }
                  }
                });
              });
            });
            
            console.log(`📈 [SCROLL ${totalIterations}] EXTRACTION COMPLETE:`);
            console.log(`   📊 Tables processed: ${processedTables}`);
            console.log(`   📋 Rows processed: ${processedRows}`);
            console.log(`   📝 Cells processed: ${processedCells}`);
            console.log(`   🆕 New merchants found: ${newDomainsFound}`);
            console.log(`   📊 Total merchants collected: ${extractedDomains.size}`);
            
            if (newDomainsFound > 0) {
              console.log(`✅ [SCROLL ${totalIterations}] Successfully found ${newDomainsFound} new merchants - total: ${extractedDomains.size}`);
            } else {
              console.log(`⚠️ [SCROLL ${totalIterations}] No new merchants found in this batch - total remains: ${extractedDomains.size}`);
            }
          }
          
          const currentScrollTop = scrollContainer.scrollTop;
          const currentScrollHeight = scrollContainer.scrollHeight;
          const currentDomainCount = extractedDomains.size;
          
          // ENHANCED STABILITY DETECTION FOR LARGE LISTS (3000+)
          const domainIncreaseThreshold = 10; // Must find at least 10 new domains to continue
          const recentDomainHistory = previousDomainCounts.slice(-10); // Look at last 10 iterations for better stability
          const hasRecentDomainIncrease = recentDomainHistory.some(count => currentDomainCount > count + 5);
          
          // For very large lists, be much more aggressive about continuing
          if (currentDomainCount < 100) {
            // If we have very few domains, definitely keep trying
            stableCount = 0;
            console.log(`📊 [LARGE LIST] Only ${currentDomainCount} domains found - continuing aggressively...`);
          } else if (currentDomainCount < 500) {
            // For medium lists, be more lenient
            if (!hasRecentDomainIncrease && recentDomainHistory.length >= 8) {
              stableCount++;
              console.log(`⚠️ [MEDIUM LIST] No new domains in last 8 iterations - stability: ${stableCount}/${STABILITY_THRESHOLD} - domains: ${currentDomainCount}`);
            } else {
              stableCount = 0;
              console.log(`🔄 [MEDIUM LIST] Still finding domains - continuing - domains: ${currentDomainCount}`);
            }
          } else if (currentDomainCount < 1500) {
            // For large lists, be even more lenient
            if (!hasRecentDomainIncrease && recentDomainHistory.length >= 10) {
              stableCount++;
              console.log(`⚠️ [LARGE LIST] No new domains in last 10 iterations - stability: ${stableCount}/${STABILITY_THRESHOLD} - domains: ${currentDomainCount}`);
            } else {
              stableCount = 0;
              console.log(`🔄 [LARGE LIST] Still finding domains - continuing - domains: ${currentDomainCount}`);
            }
          } else {
            // For VERY large lists (1500+), be extremely lenient
            const veryRecentHistory = previousDomainCounts.slice(-15); // Look at last 15 iterations
            const hasVeryRecentIncrease = veryRecentHistory.some(count => currentDomainCount > count + 3);
            
            if (!hasVeryRecentIncrease && veryRecentHistory.length >= 15) {
              stableCount++;
              console.log(`⚠️ [VERY LARGE LIST] No new domains in last 15 iterations - stability: ${stableCount}/${STABILITY_THRESHOLD} - domains: ${currentDomainCount}`);
            } else {
              stableCount = 0;
              console.log(`🔄 [VERY LARGE LIST] Still finding domains - continuing aggressively - domains: ${currentDomainCount}`);
            }
          }
          
          // Track domain count history for better stability detection (larger history for large lists)
          if (!previousDomainCounts) previousDomainCounts = [];
          previousDomainCounts.push(currentDomainCount);
          if (previousDomainCounts.length > 20) { // Keep more history for better large list detection
            previousDomainCounts.shift(); // Keep only last 20 counts
          }
          
          // Log progress more frequently with detailed merchant info
          if (totalIterations % 20 === 0) {
            console.log(`🚀 [SCROLL PROGRESS] Iteration ${totalIterations}/${MAX_ITERATIONS}:`);
            console.log(`   📊 Merchants found so far: ${currentDomainCount}`);
            console.log(`   📏 Scroll position: ${currentScrollTop}px / ${currentScrollHeight}px`);
            console.log(`   📈 Scroll progress: ${Math.round((currentScrollTop / currentScrollHeight) * 100)}%`);
            console.log(`   🔄 Continuing until no more merchants found...`);
          }
          
          // Reset stability if domain count increases
          if (currentDomainCount > previousDomainCount) {
            stableCount = 0;
            console.log(`📈 MORE MERCHANTS LOADING: ${previousDomainCount} → ${currentDomainCount} domains!`);
          }
          
          // Force break if we're clearly stuck - but be more lenient for large lists
          if (totalIterations > 1000 && currentDomainCount === previousDomainCount && currentDomainCount < 50) {
            console.log(`🛑 [EARLY BREAK] Breaking loop - appears stuck with only ${currentDomainCount} domains after ${totalIterations} iterations`);
            break;
          }
          
          // For large lists, only break if we're REALLY stuck for a long time
          if (totalIterations > 2000 && currentDomainCount === previousDomainCount && scrollDifference < 5) {
            const recentHistory = previousDomainCounts.slice(-20);
            const allSame = recentHistory.every(count => count === currentDomainCount);
            
            if (allSame && recentHistory.length >= 20) {
              console.log(`🛑 [LARGE LIST BREAK] Breaking loop - no new domains found in last 20 iterations with ${currentDomainCount} total domains`);
              break;
            }
          }
          
          previousScrollTop = currentScrollTop;
          previousScrollHeight = currentScrollHeight;
          previousDomainCount = currentDomainCount;
          totalIterations++;
        }
        
        // FINAL SCROLLING COMPLETION LOGGING
        const endTime = Date.now();
        const scrollDuration = (endTime - startTime) / 1000;
        
        console.log(`🏁 [SCROLL COMPLETE] Merchant extraction finished!`);
        console.log(`   ⏱️ Total time: ${scrollDuration.toFixed(1)} seconds`);
        console.log(`   🔄 Total iterations: ${totalIterations}`);
        console.log(`   📊 Final merchant count: ${extractedDomains.size}`);
        console.log(`   📈 Merchants per second: ${(extractedDomains.size / scrollDuration).toFixed(1)}`);
        console.log(`   📏 Final scroll position: ${scrollContainer.scrollTop}px / ${scrollContainer.scrollHeight}px`);
        console.log(`   🎯 Scroll completion: ${Math.round((scrollContainer.scrollTop / scrollContainer.scrollHeight) * 100)}%`);
        
        if (extractedDomains.size > 1000) {
          console.log(`🎉 [LARGE LIST] Successfully extracted ${extractedDomains.size} merchants from large list!`);
        } else if (extractedDomains.size > 100) {
          console.log(`✅ [MEDIUM LIST] Successfully extracted ${extractedDomains.size} merchants!`);
        } else {
          console.log(`⚠️ [SMALL LIST] Extracted ${extractedDomains.size} merchants - list may be small or extraction incomplete`);
        }
        
        const finalDomainCount = extractedDomains.size; // Use our extracted domains count
        
        console.log(`🎯 SCROLL COMPLETE - Extracted ${finalDomainCount} domains during scrolling`);
        
        return {
          iterations: totalIterations,
          reachedBottom: stableCount >= STABILITY_THRESHOLD,
          finalScrollTop: scrollContainer.scrollTop,
          containerType: containerInfo.type,
          scrollHeight: scrollContainer.scrollHeight,
          initialDomainCount: containerInfo.domainCount,
          finalDomainCount: finalDomainCount,
          domainIncrease: finalDomainCount - containerInfo.domainCount,
          scrollableContainersFound: scrollableElements.length,
          extractedDomains: extractedDomains // Return the extracted domains
        };
      });
      
      this.emit('progress', {
        message: `Merchants scroll: ${scrollResult.iterations} iterations, ${scrollResult.finalDomainCount} domains found (+${scrollResult.domainIncrease} new), ${scrollResult.scrollableContainersFound} scroll containers`
      });

      // Wait longer for all content to fully load after aggressive scrolling
      await this.page.waitForTimeout(5000); // Increased wait time for large lists

      this.emit('progress', { message: `Extracting ALL merchants from ${applicationName}...` });

      // Use domains found during scrolling + additional extraction ONLY if needed
      let merchants = [];
      
      // First, convert scrolling domains to merchant objects
      if (scrollResult.extractedDomains && scrollResult.extractedDomains.size > 0) {
        console.log(`🎯 [CONVERSION] Converting ${scrollResult.extractedDomains.size} domains found during scrolling to merchants`);
        console.log(`📊 [CONVERSION] Starting merchant object creation process...`);
        
        let convertedCount = 0;
        scrollResult.extractedDomains.forEach((domain, index) => {
          merchants.push({
            name: domain,
            url: `https://${domain}`,
            domain: domain
          });
          convertedCount++;
          
          // Log every 100 conversions for large lists
          if (convertedCount % 100 === 0) {
            console.log(`🔄 [CONVERSION] Converted ${convertedCount}/${scrollResult.extractedDomains.size} merchants...`);
          }
        });
        
        console.log(`✅ [CONVERSION] Successfully converted ${merchants.length} scrolling domains to merchants`);
        console.log(`📊 [CONVERSION] Each merchant object contains: name, url, and domain fields`);
        
        this.emit('progress', {
          message: `✅ Added ${merchants.length} merchants from scrolling extraction`
        });
      } else {
        console.log(`⚠️ No domains found during scrolling - scrollResult.extractedDomains is empty or undefined`);
      }
      
      // COMPLETELY SKIP Strategy 1/2 if scrolling found excellent results
      if (merchants.length >= 100) {
        console.log(`🎯 SCROLLING WAS HIGHLY SUCCESSFUL - COMPLETELY SKIPPING Strategy 1/2 extraction`);
        console.log(`✅ Using ${merchants.length} merchants from scrolling ONLY - no additional extraction needed`);
        
        // Skip extractMerchantsFromPage() entirely - don't even call it
        console.log(`🚫 Strategy 1/2 extraction BYPASSED - scrolling results are sufficient`);
        
      } else {
        console.log(`🔍 Scrolling found only ${merchants.length} merchants - running Strategy 1/2 extraction as backup`);
        
        // Only run Strategy 1/2 if scrolling didn't find enough
        const additionalMerchants = await this.extractMerchantsFromPage();
        
        // Merge additional merchants (avoid duplicates)
        const existingDomains = new Set(merchants.map(m => m.domain));
        const newMerchants = additionalMerchants.filter(m => !existingDomains.has(m.domain));
        
        merchants = merchants.concat(newMerchants);
        
        console.log(`🎯 ADDED ${newMerchants.length} additional merchants from Strategy 1/2 - TOTAL: ${merchants.length}`);
      }
      
      console.log(`🎯 FINAL TOTAL: ${merchants.length} merchants (${scrollResult.extractedDomains?.size || 0} from scrolling)`);

      this.emit('progress', {
        message: `🎯 FOUND ${merchants.length} merchants for ${applicationName} ${browserType} extension`
      });

      return merchants;
      
    } catch (error) {
      console.error(`❌ Error getting merchants for ${applicationName}:`, error);
      this.emit('error', `❌ Error getting merchants for ${applicationName}: ${error.message}`);
      throw error;
    }
  }

  async extractMerchantsFromPage() {
    console.log('🔍 Starting merchant extraction from Merchants page...');
    
    try {
      const merchants = await this.page.evaluate(() => {
        console.log('🔍 Extracting domains from Merchants page...');
        
        const domains = new Set();
        const merchantData = [];
        
        // Strategy 1: Look for domain columns in tables
        console.log('📋 Strategy 1: Looking for domain columns in tables...');
        const tables = document.querySelectorAll('table, .table, [role="table"]');
        
        tables.forEach((table, tableIndex) => {
          console.log(`Checking table ${tableIndex + 1}...`);
          
          // Look for header that says "Domain" or similar
          const headers = table.querySelectorAll('th, .header, [role="columnheader"]');
          let domainColumnIndex = -1;
          let nameColumnIndex = -1;
          
          headers.forEach((header, index) => {
            const text = header.textContent?.toLowerCase().trim();
            if (text && (text.includes('domain') || text.includes('url') || text.includes('website'))) {
              domainColumnIndex = index;
              console.log(`Found domain column at index ${index}: "${text}"`);
            }
            if (text && (text.includes('name') || text.includes('merchant') || text.includes('brand'))) {
              nameColumnIndex = index;
              console.log(`Found name column at index ${index}: "${text}"`);
            }
          });
          
          // Extract data from rows
          const rows = table.querySelectorAll('tr, .row, [role="row"]');
          rows.forEach((row, rowIndex) => {
            if (rowIndex === 0) return; // Skip header row
            
            const cells = row.querySelectorAll('td, .cell, [role="cell"]');
            
            let domain = '';
            let name = '';
            
            if (domainColumnIndex >= 0 && cells[domainColumnIndex]) {
              domain = cells[domainColumnIndex].textContent?.trim();
            }
            
            if (nameColumnIndex >= 0 && cells[nameColumnIndex]) {
              name = cells[nameColumnIndex].textContent?.trim();
            }
            
            // If no specific columns found, look for domain-like content in any cell
            if (!domain) {
              cells.forEach(cell => {
                const text = cell.textContent?.trim();
                if (text && (text.includes('.com') || text.includes('.net') || text.includes('.org') || 
                           text.includes('.edu') || text.includes('.gov') || text.match(/\w+\.\w+/))) {
                  domain = text;
                }
              });
            }
            
            // If no specific name found, use the first non-domain cell
            if (!name && domain) {
              cells.forEach(cell => {
                const text = cell.textContent?.trim();
                if (text && text !== domain && text.length > 2 && text.length < 100) {
                  name = text;
                }
              });
            }
            
            if (domain && domain.length > 3) {
              // ULTRA-AGGRESSIVE domain cleaning for patterns like "5519971craftbundles.comcraft"
              let cleanDomain = domain.trim();
              console.log(`🔧 ULTRA-AGGRESSIVE cleaning: "${cleanDomain}"`);
              
              // Step 1: Remove protocol and www
              cleanDomain = cleanDomain.replace(/^https?:\/\//, '').replace(/^www\./, '');
              
              // Step 2: Handle the EXACT pattern we're seeing: "NUMBER + NAME + .com + NAME"
              // Pattern: 5519971craftbundles.comcraft -> craftbundles.com
              const exactPattern = /^\d*([a-zA-Z][a-zA-Z0-9-]*\.(com|net|org|edu|gov|co|biz|info))/;
              const exactMatch = cleanDomain.match(exactPattern);
              
              if (exactMatch) {
                cleanDomain = exactMatch[1];
                console.log(`✅ EXACT pattern match: "${cleanDomain}" from "${domain}"`);
              } else {
                // Step 3: More aggressive - find ANY domain pattern and cut off everything after TLD
                const aggressivePattern = /([a-zA-Z][a-zA-Z0-9-]*\.(com|net|org|edu|gov|co|biz|info))/;
                const aggressiveMatch = cleanDomain.match(aggressivePattern);
                
                if (aggressiveMatch) {
                  cleanDomain = aggressiveMatch[1];
                  console.log(`✅ AGGRESSIVE extraction: "${cleanDomain}" from "${domain}"`);
                } else {
                  console.log(`❌ NO VALID DOMAIN found in: "${domain}"`);
                  return; // Skip this invalid domain
                }
              }
              
              // Step 4: Final cleanup - ensure no trailing text after TLD
              // Handle cases where there might still be text after .com
              const finalCleanPattern = /^([a-zA-Z][a-zA-Z0-9-]*\.(com|net|org|edu|gov|co|biz|info))/;
              const finalMatch = cleanDomain.match(finalCleanPattern);
              
              if (finalMatch) {
                cleanDomain = finalMatch[1];
              }
              
              // Final validation - must be a proper domain
              if (cleanDomain && 
                  /^[a-zA-Z][a-zA-Z0-9-]*\.(com|net|org|edu|gov|co|biz|info)$/.test(cleanDomain) &&
                  cleanDomain.length >= 4 && 
                  cleanDomain.length <= 50 &&
                  !domains.has(cleanDomain.toLowerCase())) {
                
                domains.add(cleanDomain.toLowerCase());
                merchantData.push({
                  name: name || cleanDomain,
                  url: `https://${cleanDomain}`,
                  domain: cleanDomain
                });
                console.log(`✅ FINAL ULTRA-CLEAN DOMAIN: ${cleanDomain}`);
              } else {
                console.log(`❌ REJECTED domain: "${cleanDomain}" from original: "${domain}"`);
              }
            }
          });
        });
        
        // Strategy 2: Look for any elements containing domain-like text
        console.log('📋 Strategy 2: Looking for domain-like text anywhere...');
        const allElements = document.querySelectorAll('*');
        
        allElements.forEach(element => {
          const text = element.textContent?.trim();
          if (text && text.length > 5 && text.length < 100) {
            // Look for domain patterns
            const domainMatches = text.match(/\b[a-zA-Z0-9-]+\.[a-zA-Z]{2,}\b/g);
            if (domainMatches) {
              domainMatches.forEach(match => {
                let domain = match.toLowerCase().trim();
                
                // SIMPLIFIED CLEANING - Less aggressive than Strategy 1
                if (domain && domain.length > 3) {
                  console.log(`🔧 STRATEGY 2 - SIMPLIFIED cleaning: "${domain}"`);
                  
                  // Step 1: Remove protocol and www
                  domain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '');
                  
                  // Step 2: Simple extraction - just get the basic domain
                  const simplePattern = /([a-zA-Z][a-zA-Z0-9-]*\.(com|net|org|edu|gov|co|biz|info))/;
                  const simpleMatch = domain.match(simplePattern);
                  
                  if (simpleMatch) {
                    domain = simpleMatch[1];
                    console.log(`✅ STRATEGY 2 SIMPLE extraction: "${domain}" from "${match}"`);
                    
                    // Less strict validation - allow more domains through
                    if (domain && 
                        /^[a-zA-Z][a-zA-Z0-9-]*\.(com|net|org|edu|gov|co|biz|info)$/.test(domain) &&
                        domain.length >= 4 && 
                        domain.length <= 50 &&
                        !domains.has(domain.toLowerCase())) {
                      
                      domains.add(domain.toLowerCase());
                      merchantData.push({
                        name: domain,
                        url: `https://${domain}`,
                        domain: domain
                      });
                      console.log(`✅ STRATEGY 2 ACCEPTED DOMAIN: ${domain}`);
                    } else {
                      console.log(`⚠️ STRATEGY 2 domain already exists or invalid format: "${domain}"`);
                    }
                  } else {
                    console.log(`⚠️ STRATEGY 2 no simple pattern match for: "${match}"`);
                  }
                }
              });
            }
          }
        });
        
        console.log(`🎯 Total unique domains found: ${merchantData.length}`);
        return merchantData;
      });
      
      console.log(`✅ Extracted ${merchants.length} merchants from Merchants page`);
      return merchants;
      
    } catch (error) {
      console.error('❌ Error extracting merchants:', error);
      return [];
    }
  }

  async getAllMerchants(applicationName, browsers = ['chrome']) {
    try {
      this.emit('progress', { message: `🚀 Starting merchant extraction for ${applicationName}...` });
      
      // Use the selected browser type for the scraper
      const scraperBrowser = browsers[0] || this.browserType; // Use first selected browser
      
      this.emit('progress', { message: `🌐 Using ${scraperBrowser} browser for scraping...` });
      
      // Get merchants for the application using the scraper browser
      const merchants = await this.getMerchantsForApplication(applicationName, scraperBrowser);
      
      // Add metadata to each merchant
      merchants.forEach(merchant => {
        merchant.application = applicationName;
        merchant.scraperBrowser = scraperBrowser;
        merchant.targetBrowsers = browsers; // Browser to test the merchants on
      });
      
      this.emit('progress', { message: `✅ Extracted ${merchants.length} merchants using ${scraperBrowser}` });
      this.emit('progress', { message: `🔒 Browser staying open for future use` });
      
      return merchants;
      
    } catch (error) {
      this.emit('error', `❌ Error extracting merchants for ${applicationName}: ${error.message}`);
      throw error;
    }
  }

  async close() {
    // Don't close the browser context to preserve login sessions
    console.log('🔒 Keeping browser context open to preserve login session');
  }
}

module.exports = WildlinkScraper;