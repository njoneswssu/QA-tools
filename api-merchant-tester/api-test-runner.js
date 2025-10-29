const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * API Test Runner - Bridges the UI with the Playwright test
 * This script creates a temporary test file with API data and runs it
 */

class APITestRunner {
    constructor() {
        this.tempDir = path.join(__dirname, 'temp');
        this.ensureTempDir();
    }

    ensureTempDir() {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    /**
     * Create a temporary test file with the provided merchant data
     */
    createTempTestFile(merchants, sessionId, testName) {
        const testContent = `
const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

// Database integration
let dbModule;
try {
  dbModule = require(path.join(__dirname, 'database', 'init_db'));
} catch (error) {
  console.log('Database module not found, results will only be saved to console/file');
  dbModule = null;
}

test.describe('API Merchant Tester - UI Generated', () => {
  test('Test merchants from UI with database integration', async () => {
    test.setTimeout(3600000); // 1 hour timeout
    
    const browser = await chromium.launch({
      headless: false,
      slowMo: 500
    });
    
    const context = await browser.newContext({
      viewport: { width: 1200, height: 800 },
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: {
        'DNT': '1'
      }
    });
    
    const page = await context.newPage();
    
    try {
      // Merchant data from UI
      const merchantsFromAPI = ${JSON.stringify({ Merchants: merchants }, null, 2)};
      
      // Convert to test format
      const websites = merchantsFromAPI.Merchants.map(merchant => ({
        name: merchant.MerchantName,
        url: merchant.MerchantDomains[0] ? \`https://\${merchant.MerchantDomains[0]}\` : null,
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
      console.log(\`📊 Total merchants: \${websites.length}\`);
      console.log(\`🎯 Test: ${testName}\`);
      console.log(\`📋 Session: ${sessionId}\`);
      console.log('='.repeat(60));

      // Variables to track results
      let unavailableWebsites = [];
      let successfulWebsites = [];
      let checkedWebsites = [];
      let checkedCount = 0;
      let userPassedWebsites = [];

      // Database session management
      const sessionId = '${sessionId}';
      let dbSessionCreated = false;
      
      if (dbModule) {
        try {
          await dbModule.createTestSession(sessionId, '${testName} - UI Generated Test');
          dbSessionCreated = true;
          console.log(\`📊 Database session created: \${sessionId}\`);
        } catch (error) {
          console.log(\`⚠️ Failed to create database session: \${error.message}\`);
        }
      }

      // Function to save merchant result to database
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
        } catch (error) {
          console.log(\`⚠️ Failed to save to database: \${error.message}\`);
        }
      }

      // Add UI controls (simplified version)
      await page.evaluate(() => {
        const controlPanel = document.createElement('div');
        controlPanel.innerHTML = \`
          <div style="
            position: fixed; top: 20px; right: 20px; background: #667eea; color: white;
            padding: 20px; border-radius: 12px; z-index: 10000; font-family: sans-serif;
          ">
            <h3>🧪 UI-Generated Test</h3>
            <button id="pass-btn" style="margin: 5px; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer;">✅ Pass</button>
            <button id="pause-btn" style="margin: 5px; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer;">⏸️ Pause</button>
          </div>
        \`;
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
        const testStartTime = Date.now();
        checkedCount++;
        
        console.log(\`\\n[\${checkedCount}/\${websites.length}] 📋 Testing: \${website.name}\`);
        console.log(\`🔗 URL: \${website.url}\`);
        console.log(\`📂 Category: \${website.primaryCategory}\`);

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
          console.log(\`🌐 Navigating to: \${website.url}\`);
          
          await page.goto(website.url, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });
          
          await page.waitForTimeout(2000);
          
          const pageContent = await page.textContent('body');
          let pageText = pageContent ? pageContent.toLowerCase() : '';
          
          // Get page title for enhanced detection
          const pageTitle = await page.title();
          const titleText = pageTitle ? pageTitle.toLowerCase() : '';
          
          // Enhanced content detection with scrolling
          try {
            for (let i = 0; i < 3; i++) {
              await page.evaluate(() => window.scrollBy(0, window.innerHeight));
              await page.waitForTimeout(1000);
            }
            
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.waitForTimeout(500);
            
            const scrolledContent = await page.textContent('body');
            pageText = pageText + ' ' + (scrolledContent ? scrolledContent.toLowerCase() : '');
          } catch (scrollError) {}

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
            console.log(\`🛡️ MAJOR BRAND PROTECTION: \${website.name} - Auto-success\`);
            successfulWebsites.push({
              name: website.name,
              url: website.url,
              reason: 'Major brand protection - automatically successful'
            });
            await saveMerchantToDatabase(website, 'success', 'Major brand protection', null, testDuration);
            checkedWebsites.push({ name: website.name, url: website.url });
            continue;
          }
          
          // BUSINESS MODEL DETECTION
          const businessModels = {
            ticketing: {
              sites: ['todaytix', 'stubhub', 'ticketmaster', 'vivid seats', 'seatgeek'],
              contentPatterns: ['tickets', 'shows', 'events', 'theater', 'concert', 'venue', 'performance'],
              pricingPatterns: [/\\$\\d+.*ticket/i, /tickets.*\\$\\d+/i, /from.*\\$\\d+/i],
              functionalIndicators: ['buy tickets', 'select seats', 'choose event', 'book tickets', 'event listing']
            },
            travel: {
              sites: ['cheapflightsfares', 'expedia', 'kayak', 'booking', 'priceline', 'orbitz'],
              contentPatterns: ['flights', 'hotels', 'travel', 'destinations', 'airlines', 'airports', 'booking'],
              pricingPatterns: [/\\$\\d+.*flight/i, /flights.*\\$\\d+/i, /from.*\\$\\d+/i, /starting.*\\$\\d+/i],
              functionalIndicators: ['search flights', 'book flight', 'find flights', 'travel deals', 'flight search']
            },
            fitness: {
              sites: ['lifepro fitness', 'lifepro', 'peloton', 'nordictrack', 'bowflex'],
              contentPatterns: ['fitness', 'workout', 'exercise', 'equipment', 'gym', 'training', 'health'],
              pricingPatterns: [/\\$\\d+/i],
              functionalIndicators: ['buy now', 'add to cart', 'shop now', 'order now', 'purchase']
            },
            luxury: {
              sites: ['anuschka', 'creme de la mer', 'grown brilliance'],
              contentPatterns: ['luxury', 'premium', 'collection', 'exclusive', 'designer'],
              pricingPatterns: [/\\$\\d+/i],
              functionalIndicators: ['shop', 'buy', 'purchase', 'add to cart', 'collection']
            },
            domainMarketplace: {
              sites: ['hugedomains', 'sedo', 'godaddy auctions', 'namecheap marketplace', 'flippa'],
              contentPatterns: ['domain', 'domains', 'domain name', 'domain marketplace', 'domain auction'],
              pricingPatterns: [/\\$\\d+.*domain/i, /domain.*\\$\\d+/i, /\\$\\d+/i],
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
          const hasPricing = /\\$\\s*\\d+(?:\\.\\d{1,2})?|\\d+(?:\\.\\d{1,2})?\\s*\\$/.test(pageText);
          const hasHotelPricing = /\\$\\d+.*night|per night.*\\$\\d+|\\$\\d+.*room|room.*\\$\\d+/i.test(pageText);
          const hasTravelPricing = /\\$\\d+.*flight|flight.*\\$\\d+|\\$\\d+.*ticket|ticket.*\\$\\d+/i.test(pageText);
          const hasTicketPricing = /\\$\\d+.*ticket|ticket.*\\$\\d+|from.*\\$\\d+|starting.*\\$\\d+/i.test(pageText);
          
          const hasShoppingFeatures = /add to cart|buy now|purchase|checkout|shopping cart|add to bag|shop now|order now/i.test(pageText);
          const hasHotelBookingFeatures = /book now|check availability|reserve room|book room|select room/i.test(pageText);
          const hasTravelBookingFeatures = /book flight|search flights|find flights|book now|select flight/i.test(pageText);
          const hasTicketBookingFeatures = /buy tickets|select seats|book tickets|purchase tickets|get tickets/i.test(pageText);
          
          const hasPercentageOff = /\\d+%\\s*off|save\\s*\\d+%|\\d+%\\s*discount|\\d+%\\s*savings/i.test(pageText);
          
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
            console.log(\`🚨 FLAGGED: \${website.name} - Pattern: "\${foundPattern}"\`);
            
            unavailableWebsites.push({
              name: website.name,
              url: website.url,
              pattern: foundPattern
            });

            await saveMerchantToDatabase(website, 'flagged', \`Website unavailable: \${foundPattern}\`, foundPattern, testDuration);
          } else {
            // Determine success reason
            let successReason = 'Website appears to be available and functional';
            
            if (detectedModel) {
              successReason = \`Business model detected: \${detectedModel}\`;
            } else if (hasAnyPricing && hasFunctionalFeatures) {
              let siteType = 'E-commerce';
              if (isHotelSite) siteType = 'Hotel booking';
              else if (isTravelSite) siteType = 'Travel booking';
              else if (isTicketSite) siteType = 'Ticket booking';
              successReason = \`\${siteType} features detected with pricing\`;
            } else if (hasFunctionalFeatures) {
              successReason = 'Functional e-commerce features detected';
            } else if (hasAnyPricing) {
              successReason = 'Pricing information detected';
            } else if (hasPercentageOff) {
              successReason = 'Promotional offers detected';
            }
            
            console.log(\`✅ SUCCESS: \${website.name} - \${successReason}\`);
            
            successfulWebsites.push({
              name: website.name,
              url: website.url,
              reason: successReason
            });

            await saveMerchantToDatabase(website, 'success', successReason, null, testDuration);
          }

          checkedWebsites.push({ name: website.name, url: website.url });

        } catch (error) {
          console.log(\`❌ Error checking \${website.name}: \${error.message}\`);
          
          let errorType = 'network error';
          if (error.message.includes('Timeout') || error.message.includes('timeout')) {
            errorType = 'timeout error';
          }
          
          unavailableWebsites.push({
            name: website.name,
            url: website.url,
            pattern: \`\${errorType}: \${error.message.split('\\n')[0]}\`
          });

          await saveMerchantToDatabase(website, 'flagged', \`Error: \${errorType}\`, errorType, Date.now() - testStartTime);
          
          checkedWebsites.push({ name: website.name, url: website.url });
        }

        // Progress checkpoint every 10 websites
        if (checkedCount % 10 === 0) {
          console.log(\`\\n📊 CHECKPOINT: \${checkedCount}/\${websites.length} completed\`);
          console.log(\`✅ Successful: \${successfulWebsites.length}\`);
          console.log(\`🚨 Flagged: \${unavailableWebsites.length}\`);
          await page.waitForTimeout(2000);
        }
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
      console.log('\\n🎯 FINAL RESULTS');
      console.log(\`📊 Total: \${checkedCount}\`);
      console.log(\`✅ Successful: \${successfulWebsites.length}\`);
      console.log(\`🚨 Flagged: \${unavailableWebsites.length}\`);
      console.log(\`👤 User Passed: \${userPassedWebsites.length}\`);
      console.log('🌐 View results at: http://localhost:3000');
      
      await page.pause();

    } catch (error) {
      console.log(\`💥 Fatal error: \${error.message}\`);
      throw error;
    } finally {
      await browser.close();
    }
  });
});
`;

        const tempFilePath = path.join(this.tempDir, `api-test-${Date.now()}.spec.js`);
        fs.writeFileSync(tempFilePath, testContent);
        return tempFilePath;
    }

    /**
     * Run the test with the provided data
     */
    async runTest(merchants, sessionId, testName) {
        return new Promise((resolve, reject) => {
            try {
                // Create temporary test file
                const tempTestFile = this.createTempTestFile(merchants, sessionId, testName);
                
                console.log(`🚀 Starting API test with ${merchants.length} merchants`);
                console.log(`📁 Temp test file: ${tempTestFile}`);
                
                // Run Playwright test
                const playwrightProcess = spawn('npx', ['playwright', 'test', tempTestFile, '--headed', '--project=chromium-with-extension'], {
                    stdio: 'inherit',
                    cwd: __dirname,
                    shell: true
                });

                playwrightProcess.on('close', (code) => {
                    // Clean up temp file
                    try {
                        fs.unlinkSync(tempTestFile);
                    } catch (cleanupError) {
                        console.log('Warning: Could not clean up temp file:', cleanupError.message);
                    }

                    if (code === 0) {
                        console.log('✅ Test completed successfully');
                        resolve({ success: true, code });
                    } else {
                        console.log(`❌ Test failed with code ${code}`);
                        resolve({ success: false, code });
                    }
                });

                playwrightProcess.on('error', (error) => {
                    console.error('Failed to start test:', error);
                    reject(error);
                });

            } catch (error) {
                console.error('Error setting up test:', error);
                reject(error);
            }
        });
    }

    /**
     * Clean up any remaining temp files
     */
    cleanup() {
        try {
            const files = fs.readdirSync(this.tempDir);
            files.forEach(file => {
                if (file.endsWith('.spec.js')) {
                    fs.unlinkSync(path.join(this.tempDir, file));
                }
            });
        } catch (error) {
            console.log('Cleanup warning:', error.message);
        }
    }
}

module.exports = APITestRunner;
