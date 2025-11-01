
const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

// Database integration - automatically uses correct database (SQLite or PostgreSQL)
let dbModule;
try {
  const path = require('path');
  
  // Since this temp file is in temp/ directory, go up two levels: temp/ -> api-merchant-tester/ -> database/
  const USE_POSTGRES = process.env.USE_POSTGRES === 'true' || process.env.PGDATABASE;
  
  let dbPath;
  if (USE_POSTGRES) {
    dbPath = path.join(__dirname, '..', 'database', 'pg_init_db');
    dbModule = require(dbPath);
    console.log('📦 Using PostgreSQL database for test');
  } else {
    dbPath = path.join(__dirname, '..', 'database', 'init_db');
    dbModule = require(dbPath);
    console.log('📦 Using SQLite database for test');
  }
  
  console.log('✅ Database module loaded successfully');
  console.log('Database path used:', dbPath);
  console.log('Available functions:', Object.keys(dbModule));
} catch (error) {
  console.error('❌ Database module loading failed:', error.message);
  console.error('Error stack:', error.stack);
  console.error('Current __dirname:', __dirname);
  dbModule = null;
}

test.describe('API Merchant Tester - UI Generated', () => {
  test('Test merchants from UI with database integration', async () => {
    test.setTimeout(3600000); // 1 hour timeout
    
    // Try to launch browser with different strategies if one fails
    let browser;
    let launchError;
    
    // Strategy 1: Try regular chromium with crash reporter disabled
    try {
      console.log('🚀 Attempting to launch Chromium browser...');
      browser = await chromium.launch({
        headless: false,
        slowMo: 2000,  // Slow down to 2 seconds between actions
        args: [
          '--disable-crash-reporter',
          '--disable-breakpad',
          '--no-crash-upload',
          '--disable-gpu',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled'
        ],
        chromiumSandbox: false,
        // Use a custom user data directory in the project folder
        channel: undefined // Use default Chromium
      });
      console.log('✅ Chromium browser launched successfully');
    } catch (error) {
      console.log('⚠️ Failed to launch Chromium: ' + error.message);
      launchError = error;
      
      // Strategy 2: Try headless mode
      try {
        console.log('🚀 Attempting to launch Chromium in headless mode...');
        browser = await chromium.launch({
          headless: true,
          slowMo: 500,
          args: [
            '--disable-crash-reporter',
            '--disable-breakpad',
            '--no-crash-upload',
            '--disable-gpu',
            '--no-sandbox',
            '--disable-setuid-sandbox'
          ],
          chromiumSandbox: false
        });
        console.log('✅ Chromium launched in headless mode');
      } catch (headlessError) {
        console.log('⚠️ Failed to launch headless: ' + headlessError.message);
        // Re-throw the original error
        throw launchError;
      }
    }
    
    const context = await browser.newContext({
      viewport: { width: 1200, height: 800 },
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: {
        'DNT': '1'
      }
    });
    
    const page = await context.newPage();
    
    // Detect browser close and update session
    let browserClosed = false;
    browser.on('disconnected', async () => {
      console.log('🚪 Browser closed by user');
      browserClosed = true;
      if (dbModule && dbSessionCreated) {
        try {
          await dbModule.updateTestSession(sessionId, {
            status: 'stopped',
            completed_at: new Date().toISOString(),
            total_merchants: checkedCount,
            successful_merchants: successfulWebsites.length,
            flagged_merchants: unavailableWebsites.length
          });
          console.log('💾 Session marked as stopped due to browser close');
        } catch (error) {
          console.log('⚠️ Failed to update session on browser close:', error.message);
        }
      }
    });
    
    try {
      // Merchant data from UI
      const merchantsFromAPI = {
  "Merchants": [
    {
      "AppID": 206,
      "MerchantID": 109425,
      "MerchantName": "'47 Brand",
      "MerchantDomains": [
        "47brand.com"
      ],
      "MerchantScore": 0,
      "IsFeaturedMerchant": false,
      "PrimaryCategory": "",
      "PrimaryCategoryID": null,
      "ParentCategory": "",
      "ParentCategoryID": null,
      "MaxRate": "3.25",
      "MaxRateKind": "PERCENTAGE",
      "MaxRateCurrency": "",
      "MaxRateLedgerID": null,
      "Boosted": false,
      "MaxOfferScore": 0,
      "DetailedRates": [],
      "Coupons": [],
      "BrandColor": "",
      "TextColor": "",
      "FeaturedImageURL": "",
      "LogoImageExists": false,
      "Images": [],
      "CreatedDate": "2025-11-01T06:29:20.318Z",
      "ModifiedDate": "2025-11-01T10:29:20.318Z"
    },
    {
      "AppID": 451,
      "MerchantID": 93551,
      "MerchantName": "1 Driving School",
      "MerchantDomains": [
        "1drivingschool.com",
        "products.1drivingschool.com"
      ],
      "MerchantScore": 0,
      "IsFeaturedMerchant": false,
      "PrimaryCategory": "Education",
      "PrimaryCategoryID": 38,
      "ParentCategory": "Education",
      "ParentCategoryID": 38,
      "MaxRate": "3.75",
      "MaxRateKind": "PERCENTAGE",
      "MaxRateCurrency": "",
      "MaxRateLedgerID": 5351369,
      "Boosted": false,
      "MaxOfferScore": 0,
      "DetailedRates": [
        {
          "ID": 346993,
          "LedgerID": 5351369,
          "Name": "Online Purchase",
          "Kind": "PERCENTAGE",
          "Amount": "3.75"
        }
      ],
      "Coupons": [],
      "BrandColor": "",
      "TextColor": "",
      "FeaturedImageURL": "",
      "LogoImageExists": true,
      "Images": [
        {
          "ID": 53471,
          "Kind": "LOGO",
          "Ordinal": 1,
          "ImageID": 53485,
          "URL": "https://storage.googleapis.com/wl-image/a5330483adad734017fad90a94cbd6604d791737",
          "Height": 200,
          "Width": 200
        },
        {
          "ID": 53472,
          "Kind": "LOGORECT",
          "Ordinal": 1,
          "ImageID": 53486,
          "URL": "https://storage.googleapis.com/wl-image/e5e35d1f3d886e829497a450434be5c64a67cf56",
          "Height": 200,
          "Width": 260
        }
      ],
      "CreatedDate": "2021-01-16T01:20:25.208Z",
      "ModifiedDate": "2025-10-28T08:09:43.215Z"
    },
    {
      "AppID": 206,
      "MerchantID": 116801,
      "MerchantName": "& Other Stories",
      "MerchantDomains": [
        "stories.com"
      ],
      "MerchantScore": 0,
      "IsFeaturedMerchant": false,
      "PrimaryCategory": "",
      "PrimaryCategoryID": null,
      "ParentCategory": "",
      "ParentCategoryID": null,
      "MaxRate": "0.65",
      "MaxRateKind": "PERCENTAGE",
      "MaxRateCurrency": "",
      "MaxRateLedgerID": null,
      "Boosted": false,
      "MaxOfferScore": 0,
      "DetailedRates": [],
      "Coupons": [],
      "BrandColor": "",
      "TextColor": "",
      "FeaturedImageURL": "",
      "LogoImageExists": false,
      "Images": [],
      "CreatedDate": "2025-11-01T06:29:20.318Z",
      "ModifiedDate": "2025-11-01T10:29:20.318Z"
    }
  ]
};
      
      // Convert to test format
      const websites = merchantsFromAPI.Merchants.map(merchant => ({
        name: merchant.MerchantName,
        url: merchant.MerchantDomains[0] ? `https://${merchant.MerchantDomains[0]}` : null,
        merchantId: merchant.MerchantID,
        appId: merchant.AppID,
        primaryCategory: merchant.PrimaryCategory,
        parentCategory: merchant.ParentCategory,
        maxRate: merchant.MaxRate,
        maxRateKind: merchant.MaxRateKind,
        maxRateCurrency: merchant.MaxRateCurrency,
        isFeatured: merchant.IsFeaturedMerchant,
        boosted: merchant.Boosted
      })).filter(website => website.url);

      console.log('🚀 UI-GENERATED API MERCHANT TEST STARTED');
      console.log('='.repeat(60));
      console.log(`📊 Total merchants: ${websites.length}`);
      console.log(`🎯 Test: Merchant Test - Nov 1, 2025`);
      console.log(`📋 Session: api-ui-1762032117919`);
      console.log('='.repeat(60));

      // Variables to track results
      let unavailableWebsites = [];
      let successfulWebsites = [];
      let checkedWebsites = [];
      let checkedCount = 0;
      let userPassedWebsites = [];

      // Database session management
      const sessionId = 'api-ui-1762032117919';
      let dbSessionCreated = false;
      
      console.log('🔍 Checking database module availability...');
      console.log('dbModule exists:', !!dbModule);
      
      if (dbModule) {
        console.log('✅ Database module available');
        console.log('createTestSession exists:', !!dbModule.createTestSession);
        
        try {
          // Check if session already exists, if so, just continue with it
          console.log(`📝 Attempting to create session: ${sessionId}`);
          await dbModule.createTestSession(sessionId, 'Merchant Test - Nov 1, 2025 - UI Generated Test');
          dbSessionCreated = true;
          console.log(`✅ Database session created: ${sessionId}`);
        } catch (error) {
          // If UNIQUE constraint error (SQLite or PostgreSQL), session already exists - that's OK, use it
          if (error.message && (error.message.includes('UNIQUE constraint') || error.message.includes('duplicate key'))) {
            console.log(`⚠️ Session ${sessionId} already exists, continuing with existing session`);
            dbSessionCreated = true; // Set to true since we can still use the existing session
          } else {
            console.log(`❌ Failed to create database session: ${error.message}`);
            console.error('Full error:', error);
          }
        }
      } else {
        console.log('❌ Database module is NULL - results will NOT be saved!');
      }

      // Function to handle media files (screenshots and videos)
      async function handleMediaFiles(website, testInfo) {
        const mediaFiles = {};
        const fs = require('fs');
        const path = require('path');
        
        try {
          // Create safe filename from merchant name
          const safeFileName = website.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
          const timestamp = Date.now();
          
          // Handle screenshot
          if (testInfo.attachments) {
            const screenshot = testInfo.attachments.find(a => a.name === 'screenshot' && a.path);
            if (screenshot && fs.existsSync(screenshot.path)) {
              const screenshotName = `${safeFileName}_${timestamp}.png`;
              // Use absolute path - go up one level from temp/ to api-merchant-tester/
              const screenshotDest = path.join(__dirname, '..', 'media', 'screenshots', screenshotName);
              fs.copyFileSync(screenshot.path, screenshotDest);
              mediaFiles.screenshot = `media/screenshots/${screenshotName}`;
              console.log(`📸 Screenshot saved: ${mediaFiles.screenshot}`);
            }
          }
          
          // Handle video
          if (testInfo.attachments) {
            const video = testInfo.attachments.find(a => a.name === 'video' && a.path);
            if (video && fs.existsSync(video.path)) {
              const videoName = `${safeFileName}_${timestamp}.webm`;
              // Use absolute path - go up one level from temp/ to api-merchant-tester/
              const videoDest = path.join(__dirname, '..', 'media', 'videos', videoName);
              fs.copyFileSync(video.path, videoDest);
              mediaFiles.video = `media/videos/${videoName}`;
              console.log(`🎥 Video saved: ${mediaFiles.video}`);
            }
          }
        } catch (error) {
          console.log(`⚠️ Failed to handle media files: ${error.message}`);
        }
        
        return mediaFiles;
      }

      // Function to save merchant result to database
      async function saveMerchantToDatabase(website, status, reason, errorPattern = null, duration = null, mediaFiles = {}) {
        if (!dbModule) {
          console.log('❌ Database module not loaded - RESULT NOT SAVED');
          console.log('   Make sure database is properly initialized');
          return false;
        }
        
        if (!dbSessionCreated) {
          console.log('❌ Database session not created - RESULT NOT SAVED');
          console.log('   Session ID:', sessionId);
          return false;
        }
        
        try {
          console.log(`💾 Saving to database: ${website.name} - ${status}`);
          
          const testData = {
            session_id: sessionId,
            merchant_name: website.name,
            merchant_url: website.url,
            merchant_id: website.merchantId,
            app_id: website.appId,
            primary_category: website.primaryCategory,
            parent_category: website.parentCategory,
            max_rate: website.maxRate,
            max_rate_kind: website.maxRateKind,
            test_status: status,
            test_result: reason,
            error_pattern: errorPattern,
            test_duration_ms: duration,
            is_user_passed: status === 'user_passed',
            detailed_analysis: reason,
            screenshot_path: mediaFiles.screenshot || null,
            video_path: mediaFiles.video || null
          };
          
          await dbModule.saveMerchantTestResult(testData);
          console.log(`✅ Successfully saved: ${website.name}`);
          return true;
        } catch (error) {
          console.log(`❌ Failed to save to database: ${error.message}`);
          console.error('Full error:', error);
          return false;
        }
      }

      // Add UI controls (simplified version)
      await page.evaluate(() => {
        const controlPanel = document.createElement('div');
        controlPanel.innerHTML = `
          <div style="
            position: fixed; top: 20px; right: 20px; background: #667eea; color: white;
            padding: 20px; border-radius: 12px; z-index: 10000; font-family: sans-serif;
          ">
            <h3>🧪 UI-Generated Test</h3>
            <button id="pass-btn" style="margin: 5px; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer;">✅ Pass</button>
            <button id="pause-btn" style="margin: 5px; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer;">⏸️ Pause</button>
          </div>
        `;
        document.body.appendChild(controlPanel);

        document.getElementById('pass-btn').addEventListener('click', () => {
          window.passCurrentSite = true;
        });
        document.getElementById('pause-btn').addEventListener('click', () => {
          window.testPauseRequested = true;
        });

        window.passCurrentSite = false;
        window.testPauseRequested = false;
      });

      // Main testing loop
      for (const website of websites) {
        // Check if browser was closed
        if (browserClosed) {
          console.log('🛑 Stopping test - browser was closed');
          break;
        }
        
        // Check if test is paused
        try {
          if (dbModule && dbModule.queryOne) {
            const sessionStatus = await dbModule.queryOne(
              'SELECT status FROM test_sessions WHERE session_id = ' + (process.env.USE_POSTGRES === 'true' ? '$1' : '?'),
              [sessionId]
            );
            
            if (sessionStatus && sessionStatus.status === 'paused') {
              console.log('⏸️ Test paused - waiting for resume...');
              
              // Wait until resumed or stopped
              while (true) {
                await new Promise(resolve => setTimeout(resolve, 2000)); // Check every 2 seconds
                
                const updatedSession = await dbModule.queryOne(
                  'SELECT status FROM test_sessions WHERE session_id = ' + (process.env.USE_POSTGRES === 'true' ? '$1' : '?'),
                  [sessionId]
                );
                
                if (!updatedSession) {
                  console.log('🛑 Session deleted - stopping test');
                  return; // Exit test completely
                }
                
                if (updatedSession.status === 'running') {
                  console.log('▶️ Test resumed - continuing...');
                  break; // Continue with testing
                }
                
                if (updatedSession.status === 'stopped') {
                  console.log('🛑 Test stopped - exiting');
                  return; // Exit test completely
                }
              }
            }
          }
        } catch (error) {
          console.error('Failed to check pause status:', error);
        }
        
        const testStartTime = Date.now();
        checkedCount++;
        
        console.log(`\n[${checkedCount}/${websites.length}] 📋 Testing: ${website.name}`);
        console.log(`🔗 URL: ${website.url}`);
        console.log(`📂 Category: ${website.primaryCategory}`);
        console.log(`📊 Progress: Testing merchant ${checkedCount} of ${websites.length} total`);
        
        // Update current merchant in database for real-time tracking
        try {
          if (dbModule && dbModule.updateCurrentMerchant) {
            await dbModule.updateCurrentMerchant(sessionId, website.name, website.url);
          }
        } catch (error) {
          console.error('Failed to update current merchant:', error);
        }
        
        // Add delay before starting each website test
        await page.waitForTimeout(2000);

        // Check for user pass
        try {
          const passRequested = await page.evaluate(() => window.passCurrentSite);
          if (passRequested) {
            console.log('👤 USER PASSED CURRENT SITE');
            
            successfulWebsites.push({
              name: website.name,
              url: website.url,
              reason: 'User manually passed'
            });

            await saveMerchantToDatabase(website, 'user_passed', 'User manually passed', null, Date.now() - testStartTime);
            
            // Wait for database save to complete
            await new Promise(resolve => setTimeout(resolve, 500));
            
            userPassedWebsites.push({ name: website.name, url: website.url });
            checkedWebsites.push({ name: website.name, url: website.url });
            
            await page.evaluate(() => { window.passCurrentSite = false; });
            continue;
          }
        } catch (e) {}

        // Check for pause
        try {
          const pauseRequested = await page.evaluate(() => window.testPauseRequested);
          if (pauseRequested) {
            console.log('🛑 USER REQUESTED PAUSE');
            await page.evaluate(() => { window.testPauseRequested = false; });
            await page.pause();
          }
        } catch (e) {}

        try {
          console.log(`🌐 Navigating to: ${website.url}`);
          
          await page.goto(website.url, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });
          
          // Wait for page to fully load and render
          await page.waitForTimeout(3000);
          
          // Additional wait for any dynamic content
          try {
            await page.waitForLoadState('networkidle', { timeout: 5000 });
          } catch (e) {
            // Continue if networkidle timeout - some sites have continuous requests
          }
          
          const pageContent = await page.textContent('body');
          let pageText = pageContent ? pageContent.toLowerCase() : '';
          
          // Get page title for enhanced detection
          const pageTitle = await page.title();
          const titleText = pageTitle ? pageTitle.toLowerCase() : '';
          
          // Enhanced content detection with scrolling
          console.log(`📜 Scrolling page to load all content...`);
          try {
            for (let i = 0; i < 3; i++) {
              await page.evaluate(() => window.scrollBy(0, window.innerHeight));
              await page.waitForTimeout(1500); // Increased delay
            }
            
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.waitForTimeout(1000); // Increased delay
            
            const scrolledContent = await page.textContent('body');
            pageText = pageText + ' ' + (scrolledContent ? scrolledContent.toLowerCase() : '');
            console.log(`📜 Content loaded: ${pageText.length} characters total`);
          } catch (scrollError) {
            console.log(`⚠️ Scrolling error: ${scrollError.message}`);
          }

          const testDuration = Date.now() - testStartTime;
          
          // COMPREHENSIVE DETECTION LOGIC FROM WEBSITE-QUICKCHECK
          
          // Major brand protection - never flag these
          const majorBrands = [
            'amazon', 'walmart', 'target', 'bestbuy', 'home depot', 'lowes', 'macys', 'nordstrom',
            'nike', 'adidas', 'apple', 'microsoft', 'google', 'facebook', 'twitter', 'instagram',
            'ebay', 'etsy', 'shopify', 'square', 'paypal', 'stripe', 'visa', 'mastercard',
            'coca cola', 'pepsi', 'mcdonalds', 'starbucks', 'disney', 'netflix', 'spotify'
          ];
          
          const isMajorBrand = majorBrands.some(brand => {
            const nameMatch = website.name.toLowerCase().includes(brand.toLowerCase());
            const urlMatch = website.url.toLowerCase().includes(brand.toLowerCase());
            return nameMatch || urlMatch;
          });
          
          if (isMajorBrand) {
            console.log(`🛡️ MAJOR BRAND PROTECTION: ${website.name} - Auto-success`);
            successfulWebsites.push({
              name: website.name,
              url: website.url,
              reason: 'Major brand protection - automatically successful'
            });
            await saveMerchantToDatabase(website, 'success', 'Major brand protection', null, testDuration);
            
            // Wait for database save to complete
            await new Promise(resolve => setTimeout(resolve, 500));
            
            checkedWebsites.push({ name: website.name, url: website.url });
            continue;
          }
          
          // BUSINESS MODEL DETECTION
          const businessModels = {
            ticketing: {
              sites: ['todaytix', 'stubhub', 'ticketmaster', 'vivid seats', 'seatgeek'],
              contentPatterns: ['tickets', 'shows', 'events', 'theater', 'concert', 'venue', 'performance'],
              pricingPatterns: [/\$\d+.*ticket/i, /tickets.*\$\d+/i, /from.*\$\d+/i],
              functionalIndicators: ['buy tickets', 'select seats', 'choose event', 'book tickets', 'event listing']
            },
            travel: {
              sites: ['cheapflightsfares', 'expedia', 'kayak', 'booking', 'priceline', 'orbitz'],
              contentPatterns: ['flights', 'hotels', 'travel', 'destinations', 'airlines', 'airports', 'booking'],
              pricingPatterns: [/\$\d+.*flight/i, /flights.*\$\d+/i, /from.*\$\d+/i, /starting.*\$\d+/i],
              functionalIndicators: ['search flights', 'book flight', 'find flights', 'travel deals', 'flight search']
            },
            fitness: {
              sites: ['lifepro fitness', 'lifepro', 'peloton', 'nordictrack', 'bowflex'],
              contentPatterns: ['fitness', 'workout', 'exercise', 'equipment', 'gym', 'training', 'health'],
              pricingPatterns: [/\$\d+/i],
              functionalIndicators: ['buy now', 'add to cart', 'shop now', 'order now', 'purchase']
            },
            luxury: {
              sites: ['anuschka', 'creme de la mer', 'grown brilliance'],
              contentPatterns: ['luxury', 'premium', 'collection', 'exclusive', 'designer'],
              pricingPatterns: [/\$\d+/i],
              functionalIndicators: ['shop', 'buy', 'purchase', 'add to cart', 'collection']
            },
            domainMarketplace: {
              sites: ['hugedomains', 'sedo', 'godaddy auctions', 'namecheap marketplace', 'flippa'],
              contentPatterns: ['domain', 'domains', 'domain name', 'domain marketplace', 'domain auction'],
              pricingPatterns: [/\$\d+.*domain/i, /domain.*\$\d+/i, /\$\d+/i],
              functionalIndicators: ['buy now', 'buy domain', 'purchase domain', 'domain for sale', 'make offer']
            }
          };
          
          // Detect business model
          let detectedModel = null;
          let confidence = 0;
          
          for (const [modelName, model] of Object.entries(businessModels)) {
            const siteMatch = model.sites.some(site => 
              website.name.toLowerCase().includes(site) || 
              website.url.toLowerCase().includes(site) ||
              titleText.includes(site.toLowerCase())
            );
            
            if (siteMatch) {
              const contentScore = model.contentPatterns.filter(pattern => 
                pageText.includes(pattern.toLowerCase())
              ).length;
              
              const pricingScore = model.pricingPatterns.filter(pattern => 
                pattern.test(pageText)
              ).length;
              
              const functionalScore = model.functionalIndicators.filter(indicator => 
                pageText.includes(indicator.toLowerCase())
              ).length;
              
              const totalScore = contentScore + pricingScore + functionalScore;
              
              if (totalScore > confidence) {
                detectedModel = modelName;
                confidence = totalScore;
              }
            }
          }
          
          // PRICING AND FUNCTIONALITY DETECTION
          const hasPricing = /\$\s*\d+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?\s*\$/.test(pageText);
          const hasHotelPricing = /\$\d+.*night|per night.*\$\d+|\$\d+.*room|room.*\$\d+/i.test(pageText);
          const hasTravelPricing = /\$\d+.*flight|flight.*\$\d+|\$\d+.*ticket|ticket.*\$\d+/i.test(pageText);
          const hasTicketPricing = /\$\d+.*ticket|ticket.*\$\d+|from.*\$\d+|starting.*\$\d+/i.test(pageText);
          
          const hasShoppingFeatures = /add to cart|buy now|purchase|checkout|shopping cart|add to bag|shop now|order now/i.test(pageText);
          const hasHotelBookingFeatures = /book now|check availability|reserve room|book room|select room/i.test(pageText);
          const hasTravelBookingFeatures = /book flight|search flights|find flights|book now|select flight/i.test(pageText);
          const hasTicketBookingFeatures = /buy tickets|select seats|book tickets|purchase tickets|get tickets/i.test(pageText);
          
          const hasPercentageOff = /\d+%\s*off|save\s*\d+%|\d+%\s*discount|\d+%\s*savings/i.test(pageText);
          
          // Site type detection
          const isHotelSite = website.name.toLowerCase().includes('hotel') || 
                             website.name.toLowerCase().includes('resort') ||
                             website.url.toLowerCase().includes('hotel');
          
          const isTravelSite = website.name.toLowerCase().includes('flight') || 
                             website.name.toLowerCase().includes('travel') ||
                             website.name.toLowerCase().includes('airline') ||
                             website.url.toLowerCase().includes('flight');
          
          const isTicketSite = website.name.toLowerCase().includes('ticket') || 
                             website.name.toLowerCase().includes('tix') ||
                             website.url.toLowerCase().includes('ticket');
          
          // Combined functionality detection
          const hasFunctionalFeatures = hasShoppingFeatures || hasHotelBookingFeatures || hasTravelBookingFeatures || hasTicketBookingFeatures;
          const hasAnyPricing = hasPricing || hasHotelPricing || hasTravelPricing || hasTicketPricing;
          
          // STRONG UNAVAILABILITY PATTERNS (override pricing)
          const strongUnavailabilityPatterns = [
            'this store is unavailable',
            'our store is unavailable', 
            'store is currently unavailable',
            'sorry, this store is currently unavailable',
            'store temporarily closed',
            'shop temporarily closed',
            'website temporarily unavailable',
            'site temporarily unavailable',
            'this website is for sale',
            'this domain is for sale',
            'enter password to access this site',
            'website suspended',
            'account suspended',
            'website maintenance mode',
            'site maintenance mode',
            'down for maintenance',
            'site not found',
            'website not found',
            'page not found - 404',
            '404 error',
            'error 404'
          ];
          
          const hasStrongUnavailabilityPattern = strongUnavailabilityPatterns.some(pattern => 
            pageText.includes(pattern.toLowerCase()) || titleText.includes(pattern.toLowerCase())
          );
          
          // DECISION LOGIC
          let foundPattern = null;
          
          // Check for strong unavailability patterns first
          if (hasStrongUnavailabilityPattern) {
            foundPattern = strongUnavailabilityPatterns.find(pattern => 
              pageText.includes(pattern.toLowerCase()) || titleText.includes(pattern.toLowerCase())
            );
          }
          
          // If we have a business model and functional features, override weak patterns
          if (detectedModel && (hasFunctionalFeatures || hasAnyPricing || hasPercentageOff)) {
            if (!hasStrongUnavailabilityPattern) {
              foundPattern = null; // Clear any weak patterns
            }
          }
          
          // Final decision
          if (foundPattern) {
            console.log(`🚨 FLAGGED: ${website.name} - Pattern: "${foundPattern}"`);
            
            // Capture screenshot of flagged website
            let mediaFiles = {};
            try {
              const fs = require('fs');
              const path = require('path');
              const screenshotName = `${website.name.replace(/[^a-zA-Z0-9]/g, '_')}_flagged_${Date.now()}.png`;
              // Use absolute path - go up one level from temp/ to api-merchant-tester/
              const screenshotPath = path.join(__dirname, '..', 'media', 'screenshots', screenshotName);
              
              await page.screenshot({ path: screenshotPath, fullPage: true });
              mediaFiles.screenshot = `media/screenshots/${screenshotName}`;
              console.log(`📸 Flagged screenshot saved: ${mediaFiles.screenshot}`);
            } catch (screenshotError) {
              console.log(`⚠️ Failed to capture flagged screenshot: ${screenshotError.message}`);
            }
            
            unavailableWebsites.push({
              name: website.name,
              url: website.url,
              pattern: foundPattern
            });

            await saveMerchantToDatabase(website, 'flagged', `Website unavailable: ${foundPattern}`, foundPattern, testDuration, mediaFiles);
          } else {
            // Determine success reason
            let successReason = 'Website appears to be available and functional';
            
            if (detectedModel) {
              successReason = `Business model detected: ${detectedModel}`;
            } else if (hasAnyPricing && hasFunctionalFeatures) {
              let siteType = 'E-commerce';
              if (isHotelSite) siteType = 'Hotel booking';
              else if (isTravelSite) siteType = 'Travel booking';
              else if (isTicketSite) siteType = 'Ticket booking';
              successReason = `${siteType} features detected with pricing`;
            } else if (hasFunctionalFeatures) {
              successReason = 'Functional e-commerce features detected';
            } else if (hasAnyPricing) {
              successReason = 'Pricing information detected';
            } else if (hasPercentageOff) {
              successReason = 'Promotional offers detected';
            }
            
            console.log(`✅ SUCCESS: ${website.name} - ${successReason}`);
            
            // Capture screenshot of successful website
            let mediaFiles = {};
            try {
              const fs = require('fs');
              const path = require('path');
              const safeFileName = website.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
              const timestamp = Date.now();
              const screenshotName = `${safeFileName}_success_${timestamp}.png`;
              // Use absolute path - go up one level from temp/ to api-merchant-tester/
              const screenshotPath = path.join(__dirname, '..', 'media', 'screenshots', screenshotName);
              
              await page.screenshot({ path: screenshotPath, fullPage: true });
              mediaFiles.screenshot = `media/screenshots/${screenshotName}`;
              console.log(`📸 Success screenshot saved: ${mediaFiles.screenshot}`);
            } catch (screenshotError) {
              console.log(`⚠️ Failed to capture success screenshot: ${screenshotError.message}`);
            }
            
            successfulWebsites.push({
              name: website.name,
              url: website.url,
              reason: successReason
            });

            await saveMerchantToDatabase(website, 'success', successReason, null, testDuration, mediaFiles);
            
            // Wait for database save to complete
            await new Promise(resolve => setTimeout(resolve, 500));
          }

          checkedWebsites.push({ name: website.name, url: website.url });
          
          // Add delay between merchants to ensure everything is processed
          console.log('⏳ Waiting 2 seconds before next merchant...');
          await page.waitForTimeout(2000);
          
          // Check if test is paused AFTER finishing this merchant
          try {
            if (dbModule && dbModule.queryOne) {
              const sessionStatus = await dbModule.queryOne(
                'SELECT status FROM test_sessions WHERE session_id = ' + (process.env.USE_POSTGRES === 'true' ? '$1' : '?'),
                [sessionId]
              );
              
              if (sessionStatus && sessionStatus.status === 'paused') {
                console.log('⏸️ Test paused after completing merchant - waiting for resume...');
                
                // Wait until resumed or stopped
                while (true) {
                  await new Promise(resolve => setTimeout(resolve, 2000)); // Check every 2 seconds
                  
                  const updatedSession = await dbModule.queryOne(
                    'SELECT status FROM test_sessions WHERE session_id = ' + (process.env.USE_POSTGRES === 'true' ? '$1' : '?'),
                    [sessionId]
                  );
                  
                  if (!updatedSession || updatedSession.status === 'stopped') {
                    console.log('🛑 Test stopped while paused');
                    break;
                  }
                  
                  if (updatedSession.status === 'running') {
                    console.log('▶️ Test resumed');
                    break;
                  }
                  
                  console.log('⏸️ Still paused... checking again in 2 seconds');
                }
              }
            }
          } catch (pauseError) {
            console.log(`⚠️ Error checking pause status: ${pauseError.message}`);
          }

        } catch (error) {
          console.log(`❌ Error checking ${website.name}: ${error.message}`);
          
          let errorType = 'network error';
          if (error.message.includes('Timeout') || error.message.includes('timeout')) {
            errorType = 'timeout error';
          }
          
          // Capture screenshot on error
          let mediaFiles = {};
          try {
            const fs = require('fs');
            const path = require('path');
            const safeFileName = website.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
            const timestamp = Date.now();
            const screenshotName = `${safeFileName}_error_${timestamp}.png`;
            // Use absolute path - go up one level from temp/ to api-merchant-tester/
            const screenshotPath = path.join(__dirname, '..', 'media', 'screenshots', screenshotName);
            
            await page.screenshot({ path: screenshotPath, fullPage: true });
            mediaFiles.screenshot = `media/screenshots/${screenshotName}`;
            console.log(`📸 Error screenshot saved: ${mediaFiles.screenshot}`);
          } catch (screenshotError) {
            console.log(`⚠️ Failed to capture error screenshot: ${screenshotError.message}`);
          }
          
          unavailableWebsites.push({
            name: website.name,
            url: website.url,
            pattern: `${errorType}: ${error.message.split('\n')[0]}`
          });

          await saveMerchantToDatabase(website, 'flagged', `Error: ${errorType}`, errorType, Date.now() - testStartTime, mediaFiles);
          
          // Wait for database save to complete
          await new Promise(resolve => setTimeout(resolve, 500));
          
          checkedWebsites.push({ name: website.name, url: website.url });
          
          // Add delay before continuing
          console.log('⏳ Waiting 2 seconds before next merchant...');
          await page.waitForTimeout(2000);
          
          // Check if test is paused AFTER finishing this merchant (even after error)
          try {
            if (dbModule && dbModule.queryOne) {
              const sessionStatus = await dbModule.queryOne(
                'SELECT status FROM test_sessions WHERE session_id = ' + (process.env.USE_POSTGRES === 'true' ? '$1' : '?'),
                [sessionId]
              );
              
              if (sessionStatus && sessionStatus.status === 'paused') {
                console.log('⏸️ Test paused after error - waiting for resume...');
                
                // Wait until resumed or stopped
                while (true) {
                  await new Promise(resolve => setTimeout(resolve, 2000)); // Check every 2 seconds
                  
                  const updatedSession = await dbModule.queryOne(
                    'SELECT status FROM test_sessions WHERE session_id = ' + (process.env.USE_POSTGRES === 'true' ? '$1' : '?'),
                    [sessionId]
                  );
                  
                  if (!updatedSession || updatedSession.status === 'stopped') {
                    console.log('🛑 Test stopped while paused');
                    break;
                  }
                  
                  if (updatedSession.status === 'running') {
                    console.log('▶️ Test resumed');
                    break;
                  }
                  
                  console.log('⏸️ Still paused... checking again in 2 seconds');
                }
              }
            }
          } catch (pauseError) {
            console.log(`⚠️ Error checking pause status: ${pauseError.message}`);
          }
        }

        // Progress checkpoint every 10 websites
        if (checkedCount % 10 === 0) {
          console.log(`\n📊 CHECKPOINT: ${checkedCount}/${websites.length} completed`);
          console.log(`✅ Successful: ${successfulWebsites.length}`);
          console.log(`🚨 Flagged: ${unavailableWebsites.length}`);
          console.log('⏸️  Pausing for 3 seconds...');
          
          // Show list of successful merchants every 10
          if (successfulWebsites.length > 0) {
            console.log('\n✅ SUCCESSFUL MERCHANTS (Last 10):');
            console.log('═'.repeat(60));
            const recentSuccessful = successfulWebsites.slice(-10);
            recentSuccessful.forEach((site, idx) => {
              console.log(`  ${idx + 1}. ${site.name}`);
              console.log(`     🔗 ${site.url}`);
              console.log(`     ✓ ${site.reason}`);
            });
            console.log('═'.repeat(60));
          }
          
          await page.waitForTimeout(3000);
        }
        
        // Show flagged merchants every 5
        if (checkedCount % 5 === 0 && unavailableWebsites.length > 0) {
          console.log('\n🚨 FLAGGED MERCHANTS (Last 5):');
          console.log('═'.repeat(60));
          const recentFlagged = unavailableWebsites.slice(-5);
          recentFlagged.forEach((site, idx) => {
            console.log(`  ${idx + 1}. ${site.name}`);
            console.log(`     🔗 ${site.url}`);
            console.log(`     ⚠️  ${site.pattern}`);
          });
          console.log('═'.repeat(60));
        }
        
        // Small delay between each website for better visibility
        await page.waitForTimeout(500);
      }

      // Update database session
      if (dbModule && dbSessionCreated) {
        try {
          await dbModule.updateTestSession(sessionId, {
            completed_at: new Date().toISOString(),
            total_merchants: checkedCount,
            successful_merchants: successfulWebsites.length,
            flagged_merchants: unavailableWebsites.length,
            user_passed_merchants: userPassedWebsites.length,
            status: 'completed'
          });
        } catch (error) {}
      }

      // Final results
      console.log('\n🎯 FINAL RESULTS');
      console.log(`📊 Total: ${checkedCount}`);
      console.log(`✅ Successful: ${successfulWebsites.length}`);
      console.log(`🚨 Flagged: ${unavailableWebsites.length}`);
      console.log(`👤 User Passed: ${userPassedWebsites.length}`);
      console.log('🌐 View results at: http://localhost:3000');
      
      await page.pause();

    } catch (error) {
      console.log(`💥 Fatal error: ${error.message}`);
      throw error;
    } finally {
      await browser.close();
    }
  });
});
