const { chromium, firefox, webkit } = require('playwright');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

class WebsiteTester extends EventEmitter {
  constructor(options = {}) {
    super();
    this.browser = null;
    this.context = null;
    this.page = null;
    this.browserType = options.browserType || 'chrome';
    this.reuseWildlinkBrowser = options.reuseWildlinkBrowser || false;
    this.wildlinkScraper = options.wildlinkScraper || null;
    this.isRunning = false;
    this.isPaused = false;
    this.shouldStop = false;
    this.currentWebsite = null;
    this.checkedCount = 0;
    this.totalCount = 0;
    this.unavailableWebsites = [];
    this.checkedWebsites = [];
    // Use app data directory instead of relative path to avoid DMG mount issues
    const { app } = require('electron');
    this.dataDir = path.join(app.getPath('userData'), 'data');
    this.testedMerchantsFile = path.join(this.dataDir, 'tested-merchants.json');
    
    // Ensure data directory exists
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  async start(merchantsText) {
    if (this.isRunning) {
      throw new Error('Testing is already running');
    }

    try {
      this.isRunning = true;
      this.shouldStop = false;
      this.isPaused = false;
      this.checkedCount = 0;
      this.unavailableWebsites = [];
      this.checkedWebsites = [];

      // Parse merchants from text input
      const websites = this.parseMerchants(merchantsText);
      
      if (websites.length === 0) {
        throw new Error('No valid merchants found in input');
      }

      // Filter out recently tested merchants
      const websitesToTest = this.filterRecentlyTested(websites);
      this.totalCount = websitesToTest.length;

      if (websitesToTest.length === 0) {
        this.emit('complete', {
          message: 'All merchants have been tested within the last 24 hours',
          totalChecked: 0,
          unavailableCount: 0,
          skippedCount: websites.length
        });
        this.isRunning = false;
        return;
      }

      this.emit('progress', {
        status: 'starting',
        message: `Starting test for ${websitesToTest.length} merchants...`,
        totalMerchants: websites.length,
        merchantsToTest: websitesToTest.length,
        skippedMerchants: websites.length - websitesToTest.length
      });

      // Launch browser
      await this.setupBrowser();

      // Test websites
      await this.testWebsites(websitesToTest);

      // Complete
      this.emit('complete', {
        totalChecked: this.checkedCount,
        unavailableCount: this.unavailableWebsites.length,
        unavailableWebsites: this.unavailableWebsites,
        checkedWebsites: this.checkedWebsites
      });

    } catch (error) {
      this.emit('error', error.message);
    } finally {
      await this.cleanup();
      this.isRunning = false;
    }
  }

  async stop() {
    this.shouldStop = true;
    this.isPaused = false;
    await this.cleanup();
    this.isRunning = false;
    this.emit('progress', { status: 'stopped', message: 'Testing stopped by user' });
  }

  async pause() {
    if (this.isRunning) {
      this.isPaused = true;
      this.emit('progress', { status: 'paused', message: 'Testing paused' });
    }
  }

  async resume() {
    if (this.isRunning && this.isPaused) {
      this.isPaused = false;
      this.emit('progress', { status: 'resumed', message: 'Testing resumed' });
    }
  }

  getStatus() {
    return {
      running: this.isRunning,
      paused: this.isPaused,
      currentWebsite: this.currentWebsite,
      checkedCount: this.checkedCount,
      totalCount: this.totalCount,
      unavailableCount: this.unavailableWebsites.length
    };
  }

  parseMerchants(text) {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    const websites = [];

    for (const line of lines) {
      // Support different formats:
      // 1. "Name, URL" 
      // 2. "Name - URL"
      // 3. "URL" (extract name from domain)
      // 4. JSON format: {"name": "Name", "url": "URL"}
      
      try {
        // Try JSON format first
        const jsonMatch = line.match(/^\s*{.*}\s*$/);
        if (jsonMatch) {
          const parsed = JSON.parse(line);
          if (parsed.name && parsed.url) {
            websites.push({ name: parsed.name, url: this.normalizeUrl(parsed.url) });
            continue;
          }
        }

        // Try comma or dash separated format
        const separatorMatch = line.match(/^([^,\-]+)[,\-]\s*(.+)$/);
        if (separatorMatch) {
          const name = separatorMatch[1].trim();
          const url = this.normalizeUrl(separatorMatch[2].trim());
          websites.push({ name, url });
          continue;
        }

        // Try URL only format
        const urlMatch = line.match(/^https?:\/\/.+/);
        if (urlMatch) {
          const url = this.normalizeUrl(line);
          const name = this.extractNameFromUrl(url);
          websites.push({ name, url });
          continue;
        }

        // Try domain only format
        const domainMatch = line.match(/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.([a-zA-Z]{2,})/);
        if (domainMatch) {
          const url = this.normalizeUrl(line);
          const name = this.extractNameFromUrl(url);
          websites.push({ name, url });
        }

      } catch (error) {
        console.warn(`Could not parse line: ${line}`);
      }
    }

    return websites;
  }

  normalizeUrl(url) {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    return url;
  }

  extractNameFromUrl(url) {
    try {
      const domain = new URL(url).hostname;
      return domain.replace(/^www\./, '').split('.')[0];
    } catch {
      return url;
    }
  }

  filterRecentlyTested(websites) {
    const testedData = this.loadTestedMerchants();
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    
    return websites.filter(website => {
      const isRecentlyTested = testedData.merchants.some(tested => 
        tested.name === website.name && 
        tested.url === website.url && 
        tested.timestamp > oneDayAgo
      );
      return !isRecentlyTested;
    });
  }

  loadTestedMerchants() {
    try {
      if (fs.existsSync(this.testedMerchantsFile)) {
        const data = fs.readFileSync(this.testedMerchantsFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.warn('Error loading tested merchants:', error.message);
    }
    return { merchants: [], lastUpdated: null };
  }

  saveTestedMerchant(merchant, status, reason = null) {
    const testedData = this.loadTestedMerchants();
    testedData.merchants.push({
      name: merchant.name,
      url: merchant.url,
      status: status,
      reason: reason,
      timestamp: Date.now(),
      date: new Date().toISOString()
    });
    testedData.lastUpdated = new Date().toISOString();
    
    try {
      fs.writeFileSync(this.testedMerchantsFile, JSON.stringify(testedData, null, 2));
    } catch (error) {
      console.warn('Error saving tested merchant:', error.message);
    }
  }

  async setupBrowser() {
    // Try to reuse Wildlink browser if available
    if (this.reuseWildlinkBrowser && this.wildlinkScraper && this.wildlinkScraper.browser) {
      try {
        this.browser = this.wildlinkScraper.browser;
        this.page = await this.browser.newPage();
        this.emit('progress', { 
          status: 'testing', 
          message: `✅ Using existing ${this.wildlinkScraper.browserType} browser for testing` 
        });
        return;
      } catch (error) {
        console.log('Could not reuse Wildlink browser, creating new one:', error.message);
      }
    }

    // Create new browser based on selected type
    let browserEngine;
    let launchOptions = { 
      headless: false,
      args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
    };

    switch (this.browserType.toLowerCase()) {
      case 'firefox':
        browserEngine = firefox;
        launchOptions.args = ['--no-first-run'];
        break;
      case 'safari':
      case 'webkit':
        browserEngine = webkit;
        launchOptions.args = [];
        break;
      case 'chrome':
      case 'chromium':
      default:
        browserEngine = chromium;
        
        // Try to use Google Chrome if available
        const chromePaths = [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/usr/bin/google-chrome',
          '/usr/bin/google-chrome-stable'
        ];
        
        for (const chromePath of chromePaths) {
          if (require('fs').existsSync(chromePath)) {
            launchOptions.executablePath = chromePath;
            break;
          }
        }
        break;
    }
    
    // Launching browser silently - no progress dialog needed

    this.browser = await browserEngine.launch(launchOptions);
    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    this.page = await this.context.newPage();
    
    this.emit('progress', { 
      status: 'testing', 
      message: `✅ ${this.browserType} browser ready for testing` 
    });
  }

  async testWebsites(websites) {
    // Shuffle for random order
    const shuffledWebsites = [...websites].sort(() => Math.random() - 0.5);

    for (const website of shuffledWebsites) {
      if (this.shouldStop) break;

      // Handle pause
      while (this.isPaused && !this.shouldStop) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (this.shouldStop) break;

      this.currentWebsite = website;
      this.checkedCount++;

      this.emit('progress', {
        status: 'testing',
        currentWebsite: website,
        checkedCount: this.checkedCount,
        totalCount: this.totalCount,
        unavailableCount: this.unavailableWebsites.length,
        progress: this.checkedCount / this.totalCount,
        message: `Testing ${website.name} (${this.checkedCount}/${this.totalCount})`
      });

      try {
        const result = await this.testSingleWebsite(website);
        
        this.checkedWebsites.push({
          name: website.name,
          url: website.url,
          checkedAt: new Date().toISOString()
        });

        if (result.isUnavailable) {
          this.unavailableWebsites.push({
            name: website.name,
            url: website.url,
            pattern: result.reason
          });
          this.saveTestedMerchant(website, 'unavailable', result.reason);
        } else {
          this.saveTestedMerchant(website, 'available', result.reason);
        }

        // Emit individual result for immediate display
        this.emit('progress', {
          status: 'testing',
          result: {
            name: website.name,
            url: website.url,
            isUnavailable: result.isUnavailable,
            reason: result.reason
          },
          checkedCount: this.checkedCount,
          totalCount: this.totalCount,
          unavailableCount: this.unavailableWebsites.length,
          progress: this.checkedCount / this.totalCount,
          message: `${result.isUnavailable ? '❌' : '✅'} ${website.name} - ${result.isUnavailable ? result.reason : 'Available'}`
        });

        this.emit('progress', {
          status: 'testing',
          currentWebsite: website,
          checkedCount: this.checkedCount,
          totalCount: this.totalCount,
          unavailableCount: this.unavailableWebsites.length,
          lastResult: result,
          message: `Completed ${website.name} - ${result.isUnavailable ? 'UNAVAILABLE' : 'AVAILABLE'}`
        });

      } catch (error) {
        console.error(`Error testing ${website.name}:`, error);
        this.unavailableWebsites.push({
          name: website.name,
          url: website.url,
          pattern: `Error: ${error.message}`
        });
        this.saveTestedMerchant(website, 'unavailable', `Error: ${error.message}`);
      }

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  async testSingleWebsite(website) {
    try {
      // OPTIMIZED: Navigate with faster settings and shorter timeout
      await this.page.goto(website.url, { 
        waitUntil: 'domcontentloaded', // Faster than 'networkidle'
        timeout: 15000 // Reduced from 30000ms to 15000ms
      });

      // OPTIMIZED: Reduced wait time for dynamic content
      await this.page.waitForTimeout(1500); // Reduced from 3000ms to 1500ms

      // Get page content
      const pageText = await this.page.textContent('body') || '';
      const pageTitle = await this.page.title();

      // CONSERVATIVE: Check for very specific unavailability indicators only
      // Only mark as unavailable if we have STRONG evidence
      const strongUnavailabilityPatterns = [
        // Very specific patterns that clearly indicate unavailability
        /^coming soon$/i,
        /^under construction$/i,
        /^site unavailable$/i,
        /^this website is for sale$/i,
        /^domain for sale$/i,
        /^parked domain$/i,
        /temporarily unavailable.*maintenance/i,
        /website.*currently.*unavailable/i,
        /store.*permanently.*closed/i
      ];

      // Check for STRONG unavailability indicators in title (most reliable)
      for (const pattern of strongUnavailabilityPatterns) {
        if (pattern.test(pageTitle)) {
          return {
            isUnavailable: true,
            reason: `Strong unavailability indicator in title: "${pageTitle}"`,
            pageTitle,
            contentLength: pageText.length
          };
        }
      }

      // Check for very obvious unavailability text (must be prominent)
      const obviousUnavailabilityText = [
        /this domain is for sale/i,
        /website coming soon/i,
        /site under construction/i,
        /temporarily closed for maintenance/i,
        /permanently closed/i
      ];

      for (const pattern of obviousUnavailabilityText) {
        if (pattern.test(pageText)) {
          // Additional check: make sure this text is prominent (appears early in content)
          const firstPart = pageText.substring(0, 1000); // First 1000 characters
          if (pattern.test(firstPart)) {
            return {
              isUnavailable: true,
              reason: `Obvious unavailability text detected: "${pattern.source}"`,
              pageTitle,
              contentLength: pageText.length
            };
          }
        }
      }

      // PRIORITY: Check for positive e-commerce indicators first (more reliable than negative patterns)
      const strongAvailabilityIndicators = [
        // Strong positive indicators
        /add to cart|add to bag|buy now|shop now|checkout|purchase|order now/i,
        /\$\s*\d+|\d+\s*\$|£\s*\d+|\d+\s*£|€\s*\d+|\d+\s*€/,
        /\d+%\s*off|\d+%\s*discount|save\s*\d+%|sale\s*price/i,
        /free shipping|customer reviews|my account|shopping cart|wishlist/i,
        /product details|size guide|color options|quantity|in stock/i
      ];

      // If we find strong e-commerce indicators, mark as available
      for (const pattern of strongAvailabilityIndicators) {
        if (pattern.test(pageText)) {
          return {
            isUnavailable: false,
            reason: 'Strong e-commerce functionality detected',
            pageTitle,
            contentLength: pageText.length
          };
        }
      }

      // Check for very minimal content (likely placeholder)
      if (pageText.length < 100) {
        return {
          isUnavailable: true,
          reason: 'Extremely minimal content (likely placeholder)',
          pageTitle,
          contentLength: pageText.length
        };
      }

      // DEFAULT: If we can't find strong indicators either way, assume AVAILABLE
      // This is more conservative and reduces false positives
      return {
        isUnavailable: false,
        reason: 'No strong unavailability indicators found - assuming available',
        pageTitle,
        contentLength: pageText.length
      };

    } catch (error) {
      // Network errors likely indicate unavailability
      if (error.message.includes('ERR_NAME_NOT_RESOLVED') || 
          error.message.includes('ERR_CONNECTION_REFUSED') ||
          error.message.includes('ERR_TIMED_OUT')) {
        return {
          isUnavailable: true,
          reason: `Network error: ${error.message}`,
          pageTitle: '',
          contentLength: 0
        };
      }
      throw error;
    }
  }

  async cleanup() {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

module.exports = WebsiteTester;
