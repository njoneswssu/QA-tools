const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

// Database integration
let dbModule;
try {
  dbModule = require(path.join(__dirname, '..', 'database', 'init_db'));
} catch (error) {
  console.log('Database module not found, results will only be saved to console/file');
  dbModule = null;
}

test.describe('API Merchant Tester', () => {
  test('Test merchants from API data with database integration', async () => {
    // Extended timeout for processing many websites
    test.setTimeout(3600000); // 1 hour timeout
    
    // Launch browser
    const browser = await chromium.launch({
      headless: false, // Keep visible to see what's happening
      slowMo: 500 // Slow down actions for visibility
    });
    
    const context = await browser.newContext({
      viewport: { width: 1200, height: 800 },
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: {
        'DNT': '1'  // Do Not Track header
      }
    });
    
    const page = await context.newPage();
    
    try {
      // ===== MERCHANT DATA FROM API =====
      // This is where you paste your merchant data from the API
      const merchantsFromAPI = {
        "Merchants": [
          {
            "AppID": 451,
            "MerchantID": 6745,
            "MerchantName": "525 America",
            "MerchantDomains": ["525america.com"],
            "MerchantScore": 0,
            "IsFeaturedMerchant": false,
            "PrimaryCategory": "Clothing & Apparel",
            "PrimaryCategoryID": 1,
            "ParentCategory": "Clothing & Apparel",
            "ParentCategoryID": 1,
            "MaxRate": "1.875",
            "MaxRateKind": "PERCENTAGE",
            "MaxRateCurrency": "",
            "MaxRateLedgerID": 631118,
            "Boosted": false,
            "MaxOfferScore": 0,
            "DetailedRates": [{"ID": 41504, "LedgerID": 631118, "Name": "Online Purchase", "Kind": "PERCENTAGE", "Amount": "1.875"}],
            "Coupons": [],
            "BrandColor": "",
            "TextColor": "",
            "FeaturedImageURL": "",
            "LogoImageExists": true,
            "Images": [],
            "CreatedDate": "2018-09-10T21:47:03.858082Z",
            "ModifiedDate": "2025-10-28T00:03:38.484305Z"
          },
          {
            "AppID": 451,
            "MerchantID": 6756,
            "MerchantName": "inKline Global Inc.",
            "MerchantDomains": ["inklineglobal.com"],
            "MerchantScore": 0,
            "IsFeaturedMerchant": false,
            "PrimaryCategory": "Satellite TV & Radio",
            "PrimaryCategoryID": 137,
            "ParentCategory": "Consumer Electronics",
            "ParentCategoryID": 17,
            "MaxRate": "0.375",
            "MaxRateKind": "FLAT",
            "MaxRateCurrency": "USD",
            "MaxRateLedgerID": 7204724,
            "Boosted": false,
            "MaxOfferScore": 0,
            "DetailedRates": [],
            "Coupons": [],
            "BrandColor": "",
            "TextColor": "",
            "FeaturedImageURL": "",
            "LogoImageExists": true,
            "Images": [],
            "CreatedDate": "2018-09-10T21:57:55.298463Z",
            "ModifiedDate": "2025-10-29T16:47:24.510059Z"
          }
          // Add more merchants here as needed
        ]
      };

      // Convert API merchant data to test format
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
      })).filter(website => website.url); // Only include merchants with valid URLs

      console.log('🚀 API MERCHANT TESTER STARTED');
      console.log('='.repeat(60));
      console.log(`📊 Total merchants from API: ${websites.length}`);
      console.log(`🎯 Testing merchants with full database integration`);
      console.log('='.repeat(60));

      // Variables to track results
      let unavailableWebsites = [];
      let successfulWebsites = [];
      let checkedWebsites = [];
      let checkedCount = 0;
      let userPassedWebsites = [];
      const totalWebsites = websites.length;

      // Database session management
      const sessionId = `api-session-${new Date().toISOString().replace(/[:.]/g, '-')}`;
      let dbSessionCreated = false;
      
      if (dbModule) {
        try {
          await dbModule.createTestSession(sessionId, 'API-driven merchant test with full merchant data');
          dbSessionCreated = true;
          console.log(`📊 Database session created: ${sessionId}`);
        } catch (error) {
          console.log(`⚠️ Failed to create database session: ${error.message}`);
        }
      }

      // Function to save merchant result to database with full API data
      async function saveMerchantToDatabase(website, status, reason, errorPattern = null, duration = null) {
        if (!dbModule || !dbSessionCreated) return;
        
        try {
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
            detailed_analysis: reason
          };
          
          await dbModule.saveMerchantTestResult(testData);
          console.log(`💾 Saved to database: ${website.name} - ${status}`);
        } catch (error) {
          console.log(`⚠️ Failed to save to database: ${error.message}`);
        }
      }

      // Function to display running list of flagged sites
      function displayRunningFlaggedList() {
        console.log('\n🚨 RUNNING FLAGGED SITES LIST:');
        console.log(`📊 Total flagged sites: ${unavailableWebsites.length}/${checkedCount} checked`);
        console.log('─'.repeat(60));
        
        if (unavailableWebsites.length === 0) {
          console.log('✅ No flagged sites yet!');
        } else {
          unavailableWebsites.forEach((site, index) => {
            console.log(`${index + 1}. ${site.name}`);
            console.log(`   🔗 ${site.url}`);
            console.log(`   🚨 ${site.pattern}`);
            console.log(`   📂 Category: ${site.category || 'N/A'}`);
            console.log('');
          });
        }
        console.log('─'.repeat(60));
      }

      // Function to display successful websites list
      function displaySuccessfulWebsitesList() {
        console.log('\n✅ SUCCESSFUL WEBSITES LIST:');
        console.log(`📊 Total successful sites: ${successfulWebsites.length}/${checkedCount} checked`);
        console.log('─'.repeat(60));
        
        if (successfulWebsites.length === 0) {
          console.log('⚠️ No successful sites yet');
        } else {
          successfulWebsites.forEach((site, index) => {
            const passedByUser = userPassedWebsites.some(passed => passed.name === site.name && passed.url === site.url);
            const statusText = passedByUser ? '[USER PASSED]' : '[AUTO SUCCESS]';
            console.log(`${index + 1}. ${site.name} ${statusText}`);
            console.log(`   🔗 ${site.url}`);
            console.log(`   ✅ ${site.reason}`);
            console.log(`   📂 Category: ${site.category || 'N/A'}`);
            console.log('');
          });
        }
        console.log('─'.repeat(60));
      }

      // Add UI controls for user interaction
      await page.evaluate(() => {
        // Remove any existing controls
        const existingControls = document.getElementById('test-controls');
        if (existingControls) {
          existingControls.remove();
        }

        // Create floating control panel
        const controlPanel = document.createElement('div');
        controlPanel.id = 'test-controls';
        controlPanel.innerHTML = `
          <div style="
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            min-width: 300px;
            backdrop-filter: blur(10px);
          ">
            <h3 style="margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">🧪 API Merchant Tester</h3>
            <div style="margin-bottom: 15px; font-size: 14px; opacity: 0.9;">
              <div id="current-site">Ready to start testing...</div>
              <div id="current-url" style="font-size: 12px; margin-top: 5px; opacity: 0.7;"></div>
            </div>
            <div style="display: flex; gap: 10px; margin-bottom: 15px;">
              <button id="pass-btn" style="
                background: rgba(255,255,255,0.2);
                border: 1px solid rgba(255,255,255,0.3);
                color: white;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 500;
                transition: all 0.2s;
              ">✅ Pass Current Site</button>
              <button id="pause-btn" style="
                background: rgba(255,255,255,0.2);
                border: 1px solid rgba(255,255,255,0.3);
                color: white;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 500;
                transition: all 0.2s;
              ">⏸️ Pause Testing</button>
            </div>
            <div style="font-size: 11px; opacity: 0.8; line-height: 1.4;">
              <div>🎮 <strong>Keyboard Shortcuts:</strong></div>
              <div>• Ctrl+S: Pass current site</div>
              <div>• F8 or Ctrl+P: Pause testing</div>
            </div>
          </div>
        `;
        document.body.appendChild(controlPanel);

        // Add button event listeners
        document.getElementById('pass-btn').addEventListener('click', () => {
          window.passCurrentSite = true;
        });

        document.getElementById('pause-btn').addEventListener('click', () => {
          window.testPauseRequested = true;
        });

        // Add keyboard shortcuts
        document.addEventListener('keydown', (e) => {
          if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            window.passCurrentSite = true;
          } else if (e.key === 'F8' || (e.ctrlKey && e.key === 'p')) {
            e.preventDefault();
            window.testPauseRequested = true;
          }
        });

        // Function to update current site display
        window.updateCurrentSite = function(siteName, siteUrl) {
          const currentSiteEl = document.getElementById('current-site');
          const currentUrlEl = document.getElementById('current-url');
          if (currentSiteEl) currentSiteEl.textContent = `Testing: ${siteName}`;
          if (currentUrlEl) currentUrlEl.textContent = siteUrl;
        };

        // Initialize flags
        window.passCurrentSite = false;
        window.testPauseRequested = false;
      });

      console.log('\n🎮 USER CONTROLS ACTIVATED:');
      console.log('  ✅ Pass Current Site: Ctrl+S or click button');
      console.log('  ⏸️ Pause Testing: F8, Ctrl+P, or click button');
      console.log('  📊 Progress checkpoints every 10 merchants');
      console.log('  💾 All results automatically saved to database');
      console.log('');

      // Main testing loop
      for (const website of websites) {
        const testStartTime = Date.now();
        checkedCount++;
        
        console.log(`\n[${checkedCount}/${websites.length}] 📋 Testing API Merchant: ${website.name}`);
        console.log(`🔗 URL: ${website.url}`);
        console.log(`📂 Category: ${website.primaryCategory}`);
        console.log(`💰 Rate: ${website.maxRate}${website.maxRateKind === 'PERCENTAGE' ? '%' : ` ${website.maxRateCurrency}`}`);
        console.log(`🆔 Merchant ID: ${website.merchantId}`);
        console.log(`📊 Current flagged sites: ${unavailableWebsites.length}`);
        console.log(`✅ Current successful sites: ${successfulWebsites.length}`);

        // Update the UI with current site info
        try {
          await page.evaluate((siteName, siteUrl) => {
            if (window.updateCurrentSite) {
              window.updateCurrentSite(siteName, siteUrl);
            }
          }, website.name, website.url);
        } catch (e) {
          // Continue if UI update fails
        }

        // Check if user requested to pass current site
        try {
          const passRequested = await page.evaluate(() => window.passCurrentSite);
          if (passRequested) {
            console.log('\n' + '✅'.repeat(30));
            console.log('👤 USER PASSED CURRENT SITE');
            console.log('✅'.repeat(30));
            console.log(`🏷️ Site: ${website.name}`);
            console.log(`🔗 URL: ${website.url}`);
            console.log(`📝 Reason: User manually marked as successful`);
            console.log('✅'.repeat(30));
            
            // Add to successful websites list
            successfulWebsites.push({
              name: website.name,
              url: website.url,
              reason: 'User manually passed',
              category: website.primaryCategory,
              checkedAt: new Date().toISOString()
            });

            // Save to database
            await saveMerchantToDatabase(website, 'user_passed', 'User manually passed', null, Date.now() - testStartTime);
            
            // Track that this was user-passed
            userPassedWebsites.push({
              name: website.name,
              url: website.url,
              passedAt: new Date().toISOString()
            });
            
            // Add to checked websites list
            checkedWebsites.push({
              name: website.name,
              url: website.url,
              checkedAt: new Date().toISOString()
            });
            
            // Display updated lists
            displaySuccessfulWebsitesList();
            
            // Reset pass flag and continue to next website
            await page.evaluate(() => { window.passCurrentSite = false; });
            console.log('▶️ Moving to next website...\n');
            continue; // Skip all processing for this website
          }
        } catch (e) {
          // Continue if pass check fails
        }

        // Check if user requested pause
        try {
          const pauseRequested = await page.evaluate(() => window.testPauseRequested);
          if (pauseRequested) {
            console.log('\n' + '⏸️'.repeat(30));
            console.log('🛑 USER REQUESTED PAUSE');
            console.log('⏸️'.repeat(30));
            console.log(`📊 Current Progress: ${checkedCount}/${websites.length} websites checked`);
            console.log(`🚨 Found ${unavailableWebsites.length} unavailable websites so far`);
            console.log(`✅ Found ${successfulWebsites.length} successful websites so far`);
            console.log('');
            
            // Show current results
            displayRunningFlaggedList();
            displaySuccessfulWebsitesList();
            
            console.log('');
            console.log('💡 Options:');
            console.log('  ▶️ Click RESUME to continue checking websites');
            console.log('  🛑 Click STOP to end testing and review results');
            console.log('⏸️'.repeat(30));
            
            // Reset pause flag and wait for user decision
            await page.evaluate(() => { window.testPauseRequested = false; });
            await page.pause();
            console.log('▶️ Resuming website checking...\n');
          }
        } catch (e) {
          // Continue if pause check fails
        }

        // Progress checkpoint every 10 websites
        if (checkedCount % 10 === 0) {
          console.log('\n' + '📊'.repeat(20));
          console.log('📊 PROGRESS CHECKPOINT');
          console.log('📊'.repeat(20));
          console.log(`📈 Progress: ${checkedCount}/${websites.length} websites checked`);
          console.log(`🚨 Found ${unavailableWebsites.length} unavailable websites so far`);
          console.log(`✅ Found ${successfulWebsites.length} successful websites so far`);
          console.log(`📊 Flagging rate: ${((unavailableWebsites.length / checkedCount) * 100).toFixed(1)}%`);
          console.log(`📊 Success rate: ${((successfulWebsites.length / checkedCount) * 100).toFixed(1)}%`);
          console.log('');
          
          // Display the running lists at checkpoints
          displayRunningFlaggedList();
          displaySuccessfulWebsitesList();
          
          console.log('💡 CONTROLS:');
          console.log('  ⏸️ Press F8 anytime to pause and review results');
          console.log('  ✅ Press Ctrl+S to pass current site');
          console.log('▶️ Continuing automatically in 3 seconds...');
          console.log('📊'.repeat(20));
          
          // Brief pause to read the checkpoint
          await page.waitForTimeout(3000);
        }

        try {
          console.log(`🌐 Navigating to: ${website.url}`);
          
          // Navigate to website
          await page.goto(website.url, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 // 30 seconds timeout
          });
          
          // Wait for content to load
          await page.waitForTimeout(2000);
          
          // Get page content for analysis
          const pageContent = await page.textContent('body');
          let pageText = pageContent ? pageContent.toLowerCase() : '';
          
          // Get page title for additional context
          const pageTitle = await page.title();
          const titleText = pageTitle ? pageTitle.toLowerCase() : '';
          
          // Enhanced content detection with scrolling
          try {
            console.log(`📜 ${website.name}: Scrolling to detect content...`);
            
            // Scroll down to load all content
            const scrollSteps = 3;
            for (let i = 0; i < scrollSteps; i++) {
              await page.evaluate(() => {
                window.scrollBy(0, window.innerHeight);
              });
              await page.waitForTimeout(1000);
            }
            
            // Scroll back to top
            await page.evaluate(() => {
              window.scrollTo(0, 0);
            });
            await page.waitForTimeout(500);
            
            // Get updated content after scrolling
            const scrolledContent = await page.textContent('body');
            const scrolledText = scrolledContent ? scrolledContent.toLowerCase() : '';
            
            // Combine original and scrolled content
            pageText = pageText + ' ' + scrolledText;
            
            console.log(`📜 ${website.name}: Content expanded from ${pageContent?.length || 0} to ${pageText.length} chars after scrolling`);
          } catch (scrollError) {
            console.log(`⚠️ Scrolling failed for ${website.name}: ${scrollError.message}`);
          }

          // Analyze content for availability patterns
          const testDuration = Date.now() - testStartTime;
          
          // Check for unavailability patterns
          const unavailabilityPatterns = [
            'this store is unavailable',
            'store is currently unavailable',
            'sorry, this store is currently unavailable',
            'store temporarily closed',
            'shop temporarily closed',
            'website temporarily unavailable',
            'site is temporarily unavailable',
            'temporarily unavailable',
            'under maintenance',
            'site maintenance',
            'website maintenance',
            'maintenance mode',
            'coming soon',
            'site coming soon',
            'website coming soon',
            'under construction',
            'site under construction',
            'this website is for sale',
            'domain for sale',
            'this domain is for sale',
            'suspended',
            'account suspended',
            'site suspended'
          ];

          let foundPattern = null;
          for (const pattern of unavailabilityPatterns) {
            if (pageText.includes(pattern) || titleText.includes(pattern)) {
              foundPattern = pattern;
              break;
            }
          }

          if (foundPattern) {
            console.log(`🚨 FLAGGED: ${website.name} - Pattern detected: "${foundPattern}"`);
            
            unavailableWebsites.push({
              name: website.name,
              url: website.url,
              pattern: foundPattern,
              category: website.primaryCategory,
              checkedAt: new Date().toISOString()
            });

            // Save to database
            await saveMerchantToDatabase(website, 'flagged', `Unavailability pattern detected: ${foundPattern}`, foundPattern, testDuration);
            
            displayRunningFlaggedList();
          } else {
            // Check for positive indicators (e-commerce features, pricing, etc.)
            const hasEcommerceFeatures = /add to cart|buy now|purchase|checkout|shopping cart|add to bag|shop now|order now/i.test(pageText);
            const hasPricing = /\$\s*\d+|\d+\s*\$|price|pricing|cost/i.test(pageText);
            const hasBusinessContent = /about us|contact us|customer service|shipping|returns|privacy policy/i.test(pageText);
            
            let successReason = 'Website appears to be available';
            
            if (hasEcommerceFeatures) {
              successReason = 'E-commerce features detected - functional online store';
            } else if (hasPricing) {
              successReason = 'Pricing information detected - active business';
            } else if (hasBusinessContent) {
              successReason = 'Business content detected - professional website';
            }
            
            console.log(`✅ SUCCESS: ${website.name} - ${successReason}`);
            
            successfulWebsites.push({
              name: website.name,
              url: website.url,
              reason: successReason,
              category: website.primaryCategory,
              checkedAt: new Date().toISOString()
            });

            // Save to database
            await saveMerchantToDatabase(website, 'success', successReason, null, testDuration);
          }

          // Add to checked websites list
          checkedWebsites.push({
            name: website.name,
            url: website.url,
            checkedAt: new Date().toISOString()
          });

        } catch (error) {
          console.log(`❌ Error checking ${website.name}: ${error.message}`);
          
          // Determine error type
          let errorType = 'network error';
          if (error.message.includes('Timeout') || error.message.includes('timeout')) {
            errorType = 'timeout error';
          } else if (error.message.includes('ERR_CONNECTION_REFUSED')) {
            errorType = 'connection refused';
          } else if (error.message.includes('ERR_NAME_NOT_RESOLVED')) {
            errorType = 'DNS resolution failed';
          }
          
          unavailableWebsites.push({
            name: website.name,
            url: website.url,
            pattern: `${errorType}: ${error.message.split('\n')[0]}`,
            category: website.primaryCategory
          });

          // Save to database
          await saveMerchantToDatabase(website, 'flagged', `Error: ${errorType}`, errorType, Date.now() - testStartTime);
          
          displayRunningFlaggedList();
          
          console.log(`📑 FLAGGED: ${website.name} - ${errorType}`);
          console.log(`🔗 URL: ${website.url}`);
          console.log(`📝 Error: ${error.message.split('\n')[0]}`);
          
          // Add to checked websites list for errors
          checkedWebsites.push({
            name: website.name,
            url: website.url,
            checkedAt: new Date().toISOString()
          });
          
          // Continue to next website
          continue;
        }
      }

      // Update database session with final results
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
          console.log(`📊 Database session updated: ${sessionId}`);
        } catch (error) {
          console.log(`⚠️ Failed to update database session: ${error.message}`);
        }
      }

      // Final results summary
      console.log('\n' + '🎯'.repeat(50));
      console.log('🎯 FINAL API MERCHANT TEST RESULTS');
      console.log('🎯'.repeat(50));
      console.log(`📊 Total websites checked: ${checkedCount}`);
      console.log(`🚨 Unavailable websites found: ${unavailableWebsites.length}`);
      console.log(`✅ Successful websites found: ${successfulWebsites.length}`);
      console.log(`📊 Success rate: ${checkedCount > 0 ? ((successfulWebsites.length / checkedCount) * 100).toFixed(1) : 0}%`);
      console.log(`📊 Flagging rate: ${checkedCount > 0 ? ((unavailableWebsites.length / checkedCount) * 100).toFixed(1) : 0}%`);
      
      if (userPassedWebsites.length > 0) {
        console.log(`👤 User-Passed Websites: ${userPassedWebsites.length}`);
      }

      if (dbSessionCreated) {
        console.log(`💾 Results saved to database session: ${sessionId}`);
        console.log(`🌐 View results at: http://localhost:3000`);
      }

      // Show final lists
      displaySuccessfulWebsitesList();
      displayRunningFlaggedList();

      console.log('\n🎉 API MERCHANT TESTING COMPLETED!');
      console.log('📊 All results have been saved to the database');
      console.log('🌐 Access the dashboard at: http://localhost:3000');
      
      // Keep browser open for review
      await page.pause();

    } catch (error) {
      console.log(`💥 Fatal error during API merchant testing: ${error.message}`);
      
      // Update session as interrupted if database is available
      if (dbModule && dbSessionCreated) {
        try {
          await dbModule.updateTestSession(sessionId, {
            completed_at: new Date().toISOString(),
            total_merchants: checkedCount,
            successful_merchants: successfulWebsites.length,
            flagged_merchants: unavailableWebsites.length,
            user_passed_merchants: userPassedWebsites.length,
            status: 'interrupted'
          });
        } catch (dbError) {
          console.log(`⚠️ Failed to update interrupted session: ${dbError.message}`);
        }
      }
      
      throw error;
    } finally {
      await browser.close();
    }
  });
});
