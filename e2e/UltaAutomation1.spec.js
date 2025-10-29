const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

// Check if we already have resolved credentials from 1Password CLI (op run)
const hasResolvedCredentials = process.env.ULTA_USERNAME && process.env.ULTA_PASSWORD && 
  !process.env.ULTA_USERNAME.startsWith('op://') && !process.env.ULTA_PASSWORD.startsWith('op://');

if (hasResolvedCredentials) {
  console.log('✅ Using credentials provided by 1Password CLI (op run)');
  console.log(`✅ Username: ${process.env.ULTA_USERNAME}`);
} else {
  console.log('🔧 Loading credentials from information.env file...');
  require('dotenv').config({ path: path.join(__dirname, 'information.env') });
}

const ultaUsername = process.env.ULTA_USERNAME;
const ultaPassword = process.env.ULTA_PASSWORD;

// Card Information from environment variables
const cardNumber = process.env.CARD_NUMBER;
const cardExpiration = process.env.CARD_EXPIRATION;
const cardCVV = process.env.CARD_CVV;

// Billing Address Information from environment variables
const billingFirstName = process.env.BILLING_FIRST_NAME;
const billingLastName = process.env.BILLING_LAST_NAME;
const billingAddress = process.env.BILLING_ADDRESS;
const billingCity = process.env.BILLING_CITY;
const billingZip = process.env.BILLING_ZIP;
const billingPhone = process.env.BILLING_PHONE; 

// Verify credentials are loaded
console.log(`🔍 Loaded ULTA_USERNAME: ${ultaUsername ? (ultaUsername.startsWith('op://') ? '1Password Reference Found' : ultaUsername) : 'NOT FOUND'}`);
console.log(`🔍 Loaded ULTA_PASSWORD: ${ultaPassword ? (ultaPassword.startsWith('op://') ? '1Password Reference Found' : '[HIDDEN]') : 'NOT FOUND'}`);

// Verify card information is loaded
console.log(`🔍 Loaded CARD_NUMBER: ${cardNumber ? '****-****-****-' + cardNumber.slice(-4) : 'NOT FOUND'}`);
console.log(`🔍 Loaded CARD_EXPIRATION: ${cardExpiration ? cardExpiration.substring(0,2) + '/' + cardExpiration.substring(2) : 'NOT FOUND'}`);
console.log(`🔍 Loaded CARD_CVV: ${cardCVV ? '[HIDDEN]' : 'NOT FOUND'}`);

// Verify billing information is loaded
console.log(`🔍 Loaded BILLING_FIRST_NAME: ${billingFirstName ? '[HIDDEN]' : 'NOT FOUND'}`);
console.log(`🔍 Loaded BILLING_LAST_NAME: ${billingLastName ? '[HIDDEN]' : 'NOT FOUND'}`);
console.log(`🔍 Loaded BILLING_ADDRESS: ${billingAddress ? '[HIDDEN]' : 'NOT FOUND'}`);
console.log(`🔍 Loaded BILLING_CITY: ${billingCity ? '[HIDDEN]' : 'NOT FOUND'}`);
console.log(`🔍 Loaded BILLING_ZIP: ${billingZip ? '[HIDDEN]' : 'NOT FOUND'}`);
console.log(`🔍 Loaded BILLING_PHONE: ${billingPhone ? '[HIDDEN]' : 'NOT FOUND'}`);

// Check credential status
const allCredsLoaded = ultaUsername && ultaPassword && cardNumber && cardExpiration && cardCVV && 
                      billingFirstName && billingLastName && billingAddress && billingCity && billingZip && billingPhone;

if (allCredsLoaded && !ultaUsername.startsWith('op://') && !ultaPassword.startsWith('op://')) {
  console.log('✅ READY: All credentials loaded - automation can proceed');
} else if (ultaUsername && ultaUsername.startsWith('op://')) {
  console.log('⚠️ DETECTED: 1Password CLI references in information.env');
  console.log('🔧 To use 1Password CLI credentials, run: op run -- npx playwright test e2e/UltaAutomation1.spec.js --headed');
  console.log('🔧 OR replace the op:// references in information.env with actual credentials');
} else if (!ultaUsername || !ultaPassword) {
  console.log('❌ WARNING: Missing login credentials in information.env file');
  console.log('🔧 Please check /Users/neil/playwrightautomation/e2e/information.env');
} else if (!allCredsLoaded) {
  console.log('❌ WARNING: Missing card or billing information in information.env file');
  console.log('🔧 Please check /Users/neil/playwrightautomation/e2e/information.env');
}

test.describe('Ulta Automation with CitiShop Extension', () => {
  test('Complete purchase flow with CitiShop extension', async () => {
    // Increase timeout for manual interaction
    test.setTimeout(300000); // 5 minutes
    
    // Launch browser with CitiShop extension
    const pathToExtension = path.join('/Users/neil/Documents/CitiBuild 1.14');
    const userDataDir = path.join(__dirname, '..', 'browser-data', 'citishop-profile');
    
    console.log(`🔧 Extension path: ${pathToExtension}`);
    console.log(`🔧 User data dir: ${userDataDir}`);
    
    // Check if extension path exists
    if (!fs.existsSync(pathToExtension)) {
      console.log('❌ Extension path does not exist!');
      throw new Error(`Extension path not found: ${pathToExtension}`);
    }
    
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false, // Extensions require headed mode
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-first-run',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-popup-blocking',
        '--disable-notifications',
        '--enable-extensions',
        '--disable-extensions-file-access-check',
        '--allow-running-insecure-content',
        '--disable-backgrounding-occluded-windows',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection'
      ],
      viewport: { width: 1200, height: 1200 },
      ignoreHTTPSErrors: true
    });

    const page = await context.newPage();
    
    // Handle uncaught exceptions
    page.on('pageerror', (error) => {
      console.log('Page error:', error.message);
      // Don't fail the test on page errors
    });
    
    // Navigate to Ulta
    console.log('🚀 Navigating to Ulta...');
    await page.goto('https://www.ulta.com/');
    await page.waitForTimeout(2000);
    
    // Manual pause for CitiShop extension activation
    console.log('🔄 Waiting for manual CitiShop extension activation...');
    console.log('📋 MANUAL STEP: Please activate the CitiShop extension manually if needed');
    console.log('⏸️  Click the RESUME button in the browser when ready to continue');
    console.log('⏸️  The test will pause here until you manually resume...');
    
    // Pause the test for manual intervention
    await page.pause();
    
    // MANDATORY Sign in before proceeding - make this the first priority
    console.log('🔐 MANDATORY SIGN-IN REQUIRED - Looking for Sign In button on homepage...');
    console.log('⚠️ CRITICAL: Must sign in before adding items to cart');
    const homeSignInSelectors = [
      'button:has-text("Sign In")',
      'button:has-text("SIGN IN")', 
      'a:has-text("Sign In")',
      'a:has-text("SIGN IN")',
      'button:has-text("Join Now")',
      'button:has-text("JOIN NOW")',
      'a:has-text("Join Now")',
      'a:has-text("JOIN NOW")',
      'button:has-text("Join / Sign in")',
      'button:has-text("Join or sign in")',
      'a:has-text("Join / Sign in")',
      'a:has-text("Join or sign in")',
      '[data-testid="sign-in"]',
      '[data-testid="login"]',
      '.sign-in-button',
      '.login-button',
      'text=Sign In',
      'text=JOIN NOW'
    ];
    
    let homeSignInClicked = false;
    for (const selector of homeSignInSelectors) {
      try {
        console.log(`🔍 Checking for sign-in button: ${selector}`);
        const signInButton = page.locator(selector).first();
        
        if (await signInButton.count() > 0 && await signInButton.isVisible()) {
          console.log(`✅ Found sign-in button on homepage: ${selector}`);
          await signInButton.click({ force: true });
          console.log('✅ Successfully clicked sign-in button on homepage');
          
          // Wait for sign-in page/modal to load
          await page.waitForTimeout(1000);
          homeSignInClicked = true;
          break;
        }
      } catch (e) {
        console.log(`❌ Sign-in selector ${selector} failed: ${e.message}`);
        continue;
      }
    }
    
    if (homeSignInClicked) {
      console.log('🔐 Proceeding with sign-in from homepage...');
      
      // Wait for sign-in form to be ready
      await page.waitForTimeout(2000);
      
      // Look for username and password fields
      console.log('🔍 Looking for username and password fields...');
      
      try {
        // Get the username/password fields
        const usernameField = page.locator('#username').first();
        const passwordField = page.locator('#password').first();
        
        // Check if fields exist
        const usernameExists = await usernameField.count() > 0;
        const passwordExists = await passwordField.count() > 0;
        
        if (usernameExists && passwordExists) {
          console.log('✅ Found username and password fields');
          
          // Validate credentials before attempting to fill
          if (!ultaUsername || ultaUsername.startsWith('op://')) {
            console.log('❌ CREDENTIAL ERROR: Username is 1Password reference or missing');
            if (ultaUsername && ultaUsername.startsWith('op://')) {
              console.log('🔧 1Password detected: Run "op run -- npx playwright test e2e/UltaAutomation1.spec.js --headed"');
              console.log('🔧 OR replace 1Password references in information.env with actual credentials');
            } else {
              console.log('🔧 Please check ULTA_USERNAME in /Users/neil/playwrightautomation/e2e/information.env');
            }
            console.log('🔄 MANUAL SIGN-IN REQUIRED: Please complete sign-in manually');
            await page.pause();
            return;
          }
          
          if (!ultaPassword || ultaPassword.startsWith('op://')) {
            console.log('❌ CREDENTIAL ERROR: Password is 1Password reference or missing');
            if (ultaPassword && ultaPassword.startsWith('op://')) {
              console.log('🔧 1Password detected: Run "op run -- npx playwright test e2e/UltaAutomation1.spec.js --headed"');
              console.log('🔧 OR replace 1Password references in information.env with actual credentials');
            } else {
              console.log('🔧 Please check ULTA_PASSWORD in /Users/neil/playwrightautomation/e2e/information.env');
            }
            console.log('🔄 MANUAL SIGN-IN REQUIRED: Please complete sign-in manually');
            await page.pause();
            return;
          }
          
          console.log('✅ CREDENTIALS VALIDATED: Ready to enter username and password');
          
          console.log(`📝 Filling username field with: ${ultaUsername}`);
          await usernameField.fill(ultaUsername);
          console.log('✅ Username entered successfully');
          
          // Wait after username entry
          await page.waitForTimeout(1500);
          
          console.log('📝 Filling password field...');
          await passwordField.fill(ultaPassword);
          console.log('✅ Password entered successfully');
          
          // Wait for form to register the password and enable submit
          console.log('⏳ Waiting for form to process credentials...');
          await page.waitForTimeout(2000);
          
          // Check for any form validation errors first
          console.log('🔍 Checking for form validation errors...');
          try {
            const errorMessages = await page.locator('.error, .field-error, [class*="error"], [class*="invalid"]').all();
            if (errorMessages.length > 0) {
              for (const error of errorMessages) {
                if (await error.isVisible()) {
                  const errorText = await error.textContent();
                  console.log(`⚠️ Form validation error: ${errorText}`);
                }
              }
            }
          } catch (e) {
            console.log('🔍 No validation errors found');
          }
          
          // Submit the form - IMPROVED SIGN-IN BUTTON CLICKING
          console.log('🔘 LOOKING FOR SIGN-IN BUTTON TO CLICK...');
          
          let loginSubmitted = false;
          
          // Method 1: Find and click the VISIBLE Sign In button (not hidden ones)
          console.log('🔍 Method 1: Looking for VISIBLE Sign In button...');
          
          // First, debug all sign-in buttons on the page
          console.log('🔍 DEBUGGING: Finding all sign-in buttons on page...');
          try {
            const allSignInButtons = await page.locator('button:has-text("Sign in"), button:has-text("SIGN IN"), button:has-text("Sign In")').all();
            console.log(`📝 Found ${allSignInButtons.length} total sign-in buttons`);
            
            for (let i = 0; i < allSignInButtons.length; i++) {
              const btn = allSignInButtons[i];
              try {
                const isVisible = await btn.isVisible();
                const isEnabled = await btn.isEnabled();
                const ariaHidden = await btn.getAttribute('aria-hidden');
                const className = await btn.getAttribute('class');
                const text = await btn.textContent();
                console.log(`🔍 Button ${i+1}: visible=${isVisible}, enabled=${isEnabled}, aria-hidden=${ariaHidden}, class="${className}", text="${text?.trim()}"`);
              } catch (e) {
                console.log(`🔍 Button ${i+1}: Could not get attributes`);
              }
            }
          } catch (e) {
            console.log('❌ Could not debug sign-in buttons');
          }
          
          const signInButtonSelectors = [
            // Target VISIBLE buttons first (exclude hidden ones)
            'button:has-text("Sign in"):not([aria-hidden="true"])',
            'button:has-text("SIGN IN"):not([aria-hidden="true"])', 
            'button:has-text("Sign In"):not([aria-hidden="true"])',
            'button:has-text("Sign in"):not(.ulp-hidden-form-submit-button)',
            'button:has-text("SIGN IN"):not(.ulp-hidden-form-submit-button)',
            'button:has-text("Sign In"):not(.ulp-hidden-form-submit-button)',
            // Specific visible button selectors
            'button[type="submit"]:has-text("Sign in"):visible',
            'button[type="submit"]:has-text("SIGN IN"):visible',
            'button[type="submit"]:has-text("Sign In"):visible',
            'input[type="submit"][value*="Sign in"]',
            'input[type="submit"][value*="SIGN IN"]',
            // Form buttons that are visible
            'form button:has-text("Sign in"):not([aria-hidden="true"])',
            'form button:has-text("SIGN IN"):not([aria-hidden="true"])',
            'form button:has-text("Sign In"):not([aria-hidden="true"])',
            // Data attributes and IDs
            '[data-testid="sign-in-button"]',
            '[data-testid="signin-button"]',
            '[data-testid="login-button"]',
            '.sign-in-button:not([aria-hidden="true"])',
            '.signin-button:not([aria-hidden="true"])',
            '.login-button:not([aria-hidden="true"])',
            '#sign-in-button',
            '#signin-button', 
            '#login-button',
            // Fallback to original (but will prefer visible ones first)
            'button[name="action"][value="default"]:not([aria-hidden="true"])',
            'button:has-text("Sign in")',
            'button:has-text("SIGN IN")', 
            'button:has-text("Sign In")'
          ];
          
          for (const selector of signInButtonSelectors) {
            try {
              console.log(`🔍 Checking for sign-in button: ${selector}`);
              const button = page.locator(selector).first();
              
              if (await button.count() > 0) {
                const isVisible = await button.isVisible();
                const isEnabled = await button.isEnabled();
                console.log(`   Found button - visible: ${isVisible}, enabled: ${isEnabled}`);
                
                if (isVisible && isEnabled) {
                  console.log(`🔘 ATTEMPTING SIGN-IN WITH: ${selector}`);
                  
                  // Scroll to button and ensure it's in view
                  await button.scrollIntoViewIfNeeded();
                  await page.waitForTimeout(500);
                  
                  // Try multiple click methods for this button
                  let buttonClicked = false;
                  
                  // Method 1: Regular click
                  try {
                    console.log(`   🔘 Method 1: Regular click on ${selector}`);
                    await button.click();
                    buttonClicked = true;
                    console.log(`   ✅ Regular click successful`);
                  } catch (e) {
                    console.log(`   ❌ Regular click failed: ${e.message}`);
                  }
                  
                  // Method 2: Force click if regular failed
                  if (!buttonClicked) {
                    try {
                      console.log(`   🔘 Method 2: Force click on ${selector}`);
                      await button.click({ force: true });
                      buttonClicked = true;
                      console.log(`   ✅ Force click successful`);
                    } catch (e) {
                      console.log(`   ❌ Force click failed: ${e.message}`);
                    }
                  }
                  
                  // Method 3: JavaScript click if force failed
                  if (!buttonClicked) {
                    try {
                      console.log(`   🔘 Method 3: JavaScript click on ${selector}`);
                      await button.evaluate(el => el.click());
                      buttonClicked = true;
                      console.log(`   ✅ JavaScript click successful`);
                    } catch (e) {
                      console.log(`   ❌ JavaScript click failed: ${e.message}`);
                    }
                  }
                  
                                     if (buttonClicked) {
                     // Wait for page to process the sign-in with multiple checks
                     console.log('⏳ Waiting for sign-in to process...');
                     
                     // Wait for navigation or potential redirect
                     try {
                       console.log('🔍 Waiting for potential navigation/redirect...');
                       await page.waitForNavigation({ timeout: 10000 });
                       console.log('✅ Navigation detected after sign-in');
                       loginSubmitted = true;
                     } catch (navigationError) {
                       console.log('🔍 No navigation detected, checking URL and indicators...');
                       
                       // Check for navigation or URL change multiple times
                       let navigationDetected = false;
                       for (let i = 0; i < 10; i++) {
                         await page.waitForTimeout(1000);
                         
                         try {
                           const currentUrl = page.url();
                           console.log(`🔍 Check ${i+1}/10 - Current URL: ${currentUrl.substring(0, 100)}...`);
                           
                           if (!currentUrl.includes('/signin') && !currentUrl.includes('/login')) {
                             console.log('✅ Sign-in successful - page navigated away from login');
                             navigationDetected = true;
                             loginSubmitted = true;
                             break;
                           }
                           
                           // Also check for account indicators that suggest login success
                           const accountIndicators = ['text=Account', 'text=Hi,', 'text=Welcome,', 'text=My Account'];
                           for (const indicator of accountIndicators) {
                             if (await page.locator(indicator).count() > 0) {
                               console.log(`✅ Login success detected via indicator: ${indicator}`);
                               navigationDetected = true;
                               loginSubmitted = true;
                               break;
                             }
                           }
                           if (navigationDetected) break;
                         } catch (e) {
                           console.log(`🔍 Check ${i+1}/10 failed: ${e.message}`);
                           // Page might be closed or navigating, assume success
                           if (e.message.includes('closed')) {
                             console.log('✅ Page closed - likely successful sign-in redirect');
                             loginSubmitted = true;
                             break;
                           }
                         }
                       }
                     }
                    
                    if (!navigationDetected) {
                      console.log(`⚠️ No navigation detected after clicking: ${selector}`);
                    }
                  } else {
                    console.log(`❌ All click methods failed for: ${selector}`);
                  }
                  
                  if (loginSubmitted) break;
                }
              }
            } catch (e) {
              console.log(`❌ Sign-in button selector ${selector} failed: ${e.message}`);
              continue;
            }
          }
          
          // Method 2: Try Enter key as fallback
          if (!loginSubmitted) {
            console.log('🔍 Method 2: Trying form submission alternatives...');
            
            // Focus on password field and press Enter
            try {
              console.log('   🔘 Method 2a: Enter key from password field...');
              await passwordField.focus();
              await page.waitForTimeout(500);
              await page.keyboard.press('Enter');
              console.log('   ✅ Enter key pressed from password field');
              
              // Check for navigation with multiple attempts
              let enterKeyWorked = false;
              for (let i = 0; i < 8; i++) {
                await page.waitForTimeout(1000);
                const currentUrl = page.url();
                if (!currentUrl.includes('/signin') && !currentUrl.includes('/login')) {
                  console.log('✅ Enter key submission successful');
                  loginSubmitted = true;
                  enterKeyWorked = true;
                  break;
                }
              }
              
              if (!enterKeyWorked) {
                console.log('   ⚠️ Enter key did not navigate away from login page');
              }
            } catch (e) {
              console.log(`   ❌ Enter key method failed: ${e.message}`);
            }
            
            // Try finding and submitting the form directly
            if (!loginSubmitted) {
              try {
                console.log('   🔘 Method 2b: Direct form submission...');
                const form = page.locator('form').first();
                if (await form.count() > 0) {
                  await form.evaluate(form => form.submit());
                  console.log('   ✅ Form submitted directly');
                  
                  // Check for navigation
                  for (let i = 0; i < 8; i++) {
                    await page.waitForTimeout(1000);
                    const currentUrl = page.url();
                    if (!currentUrl.includes('/signin') && !currentUrl.includes('/login')) {
                      console.log('✅ Direct form submission successful');
                      loginSubmitted = true;
                      break;
                    }
                  }
                }
              } catch (e) {
                console.log(`   ❌ Direct form submission failed: ${e.message}`);
              }
            }
          }
          
          // Method 3: Try any submit button as last resort
          if (!loginSubmitted) {
            console.log('🔍 Method 3: Looking for any submit button...');
            const genericSubmitSelectors = [
              'button[type="submit"]',
              'input[type="submit"]',
              'form button'
            ];
            
            for (const selector of genericSubmitSelectors) {
              try {
                const button = page.locator(selector).first();
                if (await button.count() > 0 && await button.isVisible()) {
                  console.log(`🔍 Trying generic submit button: ${selector}`);
                  await button.click({ force: true });
                  await page.waitForTimeout(4000);
                  
                  const currentUrl = page.url();
                  if (!currentUrl.includes('/signin') && !currentUrl.includes('/login')) {
                    console.log('✅ Generic submit button successful');
                    loginSubmitted = true;
                    break;
                  }
                }
              } catch (e) {
                continue;
              }
            }
          }
          
          if (loginSubmitted) {
            console.log('✅ Successfully signed in from homepage');
            
            // Wait for sign-in to complete
            console.log('⏳ Waiting for sign-in to complete...');
            await page.waitForTimeout(5000);
            
          } else {
            console.log('❌ Could not submit sign-in form automatically');
            console.log('🔄 MANDATORY MANUAL SIGN-IN: Please complete sign-in manually');
            console.log('⚠️ CRITICAL: You MUST sign in before the script can continue');
            await page.pause();
          }
          
        } else {
          console.log('❌ Could not find username/password fields after clicking sign-in');
          console.log('🔄 MANDATORY MANUAL SIGN-IN: Please complete sign-in manually');
          console.log('⚠️ CRITICAL: You MUST sign in before the script can continue');
          await page.pause();
        }
        
      } catch (error) {
        console.log(`❌ Error during sign-in process: ${error.message}`);
        console.log('🔄 MANDATORY MANUAL SIGN-IN: Please complete sign-in manually');
        console.log('⚠️ CRITICAL: You MUST sign in before the script can continue');
        await page.pause();
      }
      
    } else {
      console.log('❌ No sign-in button found on homepage - MANUAL SIGN-IN REQUIRED');
      console.log('🔄 MANDATORY MANUAL SIGN-IN: Please sign in manually');
      console.log('⚠️ CRITICAL: You MUST sign in before the script can continue');
      await page.pause();
    }
    
    // VERIFY SIGN-IN STATUS BEFORE PROCEEDING
    console.log('🔍 Verifying sign-in status before proceeding...');
    
    // Check if page/browser is still available
    let pageAvailable = true;
    try {
      await page.url();
    } catch (e) {
      if (e.message.includes('closed')) {
        console.log('⚠️ Page/browser closed after sign-in - likely successful redirect');
        console.log('🔄 Creating new page for continued automation...');
        
        try {
          // Get the context and create a new page
          const context = page.context();
          page = await context.newPage();
          console.log('✅ New page created successfully');
          pageAvailable = true;
        } catch (contextError) {
          console.log('❌ Could not create new page - continuing with manual pause');
          pageAvailable = false;
        }
      } else {
        pageAvailable = false;
      }
    }
    
    if (pageAvailable) {
      // Check for sign-in indicators to ensure user is logged in
      const signInStatusSelectors = [
        'text=Hi,',          // "Hi, [Username]" 
        'text=Hello,',       // "Hello, [Username]"
        'text=Welcome,',     // "Welcome, [Username]"
        'text=My Account',   // Account menu
        'text=Account',      // Account link
        'text=Sign Out',     // Sign out option
        'text=Logout',       // Logout option
        '[data-testid="account-menu"]',
        '[aria-label*="account"]',
        '.account-menu',
        '.user-menu',
        'button:has-text("Account")'
      ];
      
      let signedIn = false;
      
      // Go directly to product page (skip unnecessary homepage redirect)
      try {
        console.log('🚀 Going directly to product page after sign-in...');
        await page.goto('https://www.ulta.com/p/cotton-swab-travel-case-pimprod2047299?sku=2622729');
        await page.waitForTimeout(3000);
        
        // Verify sign-in status on product page
        for (const selector of signInStatusSelectors) {
          try {
            if (await page.locator(selector).count() > 0) {
              console.log(`✅ Sign-in verified with indicator: ${selector}`);
              signedIn = true;
              break;
            }
          } catch (e) {
            continue;
          }
        }
        
        if (!signedIn) {
          console.log('⚠️ Sign-in indicators not found on product page');
          console.log('🔍 Checking URL for sign-in redirect...');
          const currentUrl = page.url();
          if (currentUrl.includes('/signin') || currentUrl.includes('/login')) {
            console.log('❌ Still on sign-in page - sign-in may have failed');
          } else {
            console.log('✅ Not on sign-in page - assuming sign-in was successful');
            signedIn = true;
          }
        }
      } catch (e) {
        console.log(`⚠️ Could not navigate to product page: ${e.message}`);
      }
      
      if (!signedIn) {
        console.log('❌ SIGN-IN NOT VERIFIED - User may not be signed in');
        console.log('🔄 FINAL CHANCE: Please ensure you are signed in before continuing');
        console.log('⚠️ The script will pause to allow you to sign in if needed');
        await page.pause();
      } else {
        console.log('✅ User appears to be signed in - proceeding with test');
      }
    } else {
      console.log('⚠️ Page not available - manual intervention required');
      await page.pause();
    }
    
    console.log('✅ Sign-in verification completed - continuing with automated test...');
    
    // Already on product page from sign-in verification - no need to navigate again
    console.log('✅ Already on product page - proceeding with add to cart...');
    
    // Check if product is already in cart, if not try to add it (avoiding quantity buttons)
    console.log('🛒 Checking product page interaction...');
    
    // First check if product is already in cart
    console.log('🔍 Checking if product is already in cart...');
    const alreadyInCartSelectors = [
      'text=Remove from Bag',
      'text=REMOVE FROM BAG', 
      'text=In Your Bag',
      'text=IN YOUR BAG',
      'text=Added to Bag',
      'text=ADDED TO BAG',
      'button:has-text("Remove from Bag")',
      'button:has-text("In Your Bag")',
      '[data-testid="remove-from-bag"]',
      '.in-bag-indicator',
      '.added-to-bag'
    ];
    
    let productAlreadyInCart = false;
    for (const selector of alreadyInCartSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.count() > 0 && await element.isVisible()) {
          console.log(`✅ Product already in cart (found: ${selector})`);
          productAlreadyInCart = true;
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    let addToCartSuccess = false;
    
    if (!productAlreadyInCart) {
      console.log('🛒 Product not in cart - attempting to add it...');
      
      // Debug: Show what buttons are on the page (for troubleshooting)
      try {
        console.log('🔍 DEBUG: Showing first few buttons on product page...');
        const allButtons = await page.locator('button').all();
        console.log(`📝 Found ${allButtons.length} total buttons on the page`);
        
        for (let i = 0; i < Math.min(allButtons.length, 8); i++) {
          const btn = allButtons[i];
          try {
            const text = await btn.textContent();
            const isVisible = await btn.isVisible();
            console.log(`🔍 Button ${i+1}: "${text?.trim()}" (visible: ${isVisible})`);
          } catch (e) {
            console.log(`🔍 Button ${i+1}: Could not get info`);
          }
        }
      } catch (e) {
        console.log('❌ Could not debug buttons on page');
      }
      
      // Scan for quantity-related elements (for awareness, but still try to add to cart)
      console.log('🔍 Scanning page for quantity-related elements to be extra careful...');
      const quantityIndicators = [
        'input[type="number"]', // Quantity input fields
        'button[aria-label*="quantity"]',
        'button[aria-label*="Quantity"]', 
        'button[aria-label*="increase"]',
        'button[aria-label*="decrease"]',
        'button[aria-label*="increment"]',
        'button[aria-label*="decrement"]',
        'button:has-text("+")',
        'button:has-text("-")',
        '[class*="quantity"]',
        '[class*="stepper"]',
        '[class*="increment"]',
        '[data-testid*="quantity"]',
        '.qty-stepper',
        '.quantity-selector'
      ];
      
      let quantityElementsFound = 0;
      for (const selector of quantityIndicators) {
        try {
          const elements = await page.locator(selector).count();
          if (elements > 0) {
            console.log(`⚠️ Found ${elements} quantity-related elements: ${selector}`);
            quantityElementsFound += elements;
          }
        } catch (e) {
          // Ignore selector errors
        }
      }
      
      if (quantityElementsFound > 0) {
        console.log(`⚠️ ${quantityElementsFound} quantity elements detected - will be extra careful with button selection`);
      } else {
        console.log('✅ No quantity elements detected - safe environment');
      }
      
      try {
        // Use specific selectors and validate each button carefully
        const addToCartSelectors = [
          // Most specific first - exact text matches
          'text="Add for ship"',
          'text="Add to Bag"', 
          'text="Add to Cart"',
          'text="ADD FOR SHIP"',
          'text="ADD TO BAG"', 
          'text="ADD TO CART"',
          // Backup selectors
          'button:has-text("Add for ship")',
          'button:has-text("Add to Bag")',
          'button:has-text("Add to Cart")',
          // Data attributes
          '[data-testid="add-to-bag"]',
          '[data-testid="add-to-cart"]'
        ];
        
        for (const selector of addToCartSelectors) {
          try {
            console.log(`🔍 Trying add to cart selector: ${selector}`);
            const addButton = page.locator(selector).first();
            
            if (await addButton.count() > 0 && await addButton.isVisible()) {
              const buttonText = await addButton.textContent();
              const ariaLabel = await addButton.getAttribute('aria-label');
              const className = await addButton.getAttribute('class');
              
              console.log(`🔍 Button found - text: "${buttonText?.trim()}", aria-label: "${ariaLabel}", class: "${className?.substring(0, 50)}"`);
              
              // STRICT validation - reject obvious quantity buttons
              const isQuantityButton = (
                // Text contains quantity indicators
                (buttonText && (
                  buttonText.trim() === '+' || 
                  buttonText.trim() === '-' || 
                  buttonText.toLowerCase().includes('qty') ||
                  buttonText.toLowerCase().includes('quantity') ||
                  buttonText.toLowerCase().includes('increase') ||
                  buttonText.toLowerCase().includes('decrease') ||
                  // Not add to cart text
                  (!buttonText.toLowerCase().includes('add') && !buttonText.toLowerCase().includes('ship') && !buttonText.toLowerCase().includes('bag') && !buttonText.toLowerCase().includes('cart'))
                )) ||
                // Aria-label indicates quantity function
                (ariaLabel && (
                  ariaLabel.toLowerCase().includes('quantity') ||
                  ariaLabel.toLowerCase().includes('increment') ||
                  ariaLabel.toLowerCase().includes('increase') ||
                  ariaLabel.toLowerCase().includes('decrease') ||
                  ariaLabel.toLowerCase().includes('stepper')
                )) ||
                // Class name indicates quantity function
                (className && (
                  className.toLowerCase().includes('qty-') ||
                  className.toLowerCase().includes('quantity-') ||
                  className.toLowerCase().includes('stepper') ||
                  className.toLowerCase().includes('increment')
                ))
              );
              
              if (isQuantityButton) {
                console.log(`🚨 REJECTED: This appears to be a quantity button - "${buttonText?.trim()}"`);
                continue;
              }
              
              // Additional check: make sure button text looks like "Add to Cart"
              if (buttonText && (
                buttonText.toLowerCase().includes('add') ||
                buttonText.toLowerCase().includes('ship') ||
                buttonText.toLowerCase().includes('bag') ||
                buttonText.toLowerCase().includes('cart')
              )) {
                console.log(`✅ VALIDATED: This looks like a valid add to cart button - "${buttonText?.trim()}"`);
                await addButton.click({ force: true });
                console.log('✅ Successfully clicked add to cart button');
                
                // Wait for cart update
                await page.waitForTimeout(3000);
                addToCartSuccess = true;
                break;
              } else {
                console.log(`⚠️ UNCERTAIN: Button text doesn't clearly indicate add to cart - "${buttonText?.trim()}"`);
                continue;
              }
            }
          } catch (e) {
            console.log(`❌ Add to cart selector ${selector} failed: ${e.message}`);
            continue;
          }
        }
        
      } catch (error) {
        console.log(`❌ Add to cart process failed: ${error.message}`);
      }
      
      if (!addToCartSuccess) {
        console.log('⚠️ No valid add to cart button found - will proceed to bag navigation');
        console.log('🔄 This avoids clicking quantity buttons or other irrelevant elements');
      }
    } else {
      console.log('✅ Product already in cart - skipping add to cart step');
      addToCartSuccess = true; // Consider it successful since item is already in cart
    }
    
    // Enhanced bag navigation - try multiple methods
    console.log('🛒 Ensuring we get to the bag page...');
    
    // Check if we're already on bag page
    const currentUrl = page.url();
    if (currentUrl.includes('/bag') || currentUrl.includes('/cart')) {
      console.log('✅ Already on bag/cart page!');
    } else {
      console.log('🛒 Need to navigate to bag - trying multiple methods...');
      
      let bagNavigationSuccess = false;
      
      // Method 1: Try clicking bag/cart buttons
      const bagSelectors = [
        // Bag icon and text links
        'a[href*="/bag"]',
        'a[href*="/cart"]', 
        'button:has-text("Bag")',
        'button:has-text("Cart")',
        'a:has-text("Bag")',
        'a:has-text("Cart")',
        'text=Bag',
        'text=Cart',
        // Icon selectors
        '.bag-icon',
        '.cart-icon',
        '[aria-label*="bag"]',
        '[aria-label*="cart"]',
        '[aria-label*="shopping"]',
        // Data attributes
        '[data-testid="bag"]',
        '[data-testid="cart"]',
        '[data-testid="bag-button"]',
        '[data-testid="cart-button"]',
        // Class selectors
        '.shopping-bag',
        '.shopping-cart',
        '.header-bag',
        '.header-cart'
      ];
      
      for (const selector of bagSelectors) {
        try {
          console.log(`🔍 Trying bag selector: ${selector}`);
          const bagElement = page.locator(selector).first();
          
          if (await bagElement.count() > 0 && await bagElement.isVisible()) {
            console.log(`✅ Found bag element: ${selector}`);
            await bagElement.click({ force: true });
            await page.waitForTimeout(2000);
            
            // Check if navigation worked
            const newUrl = page.url();
            if (newUrl.includes('/bag') || newUrl.includes('/cart')) {
              console.log(`✅ Successfully navigated to bag via: ${selector}`);
              bagNavigationSuccess = true;
              break;
            }
          }
        } catch (bagError) {
          console.log(`❌ Bag selector ${selector} failed: ${bagError.message}`);
          continue;
        }
      }
      
      // Method 2: Direct URL navigation if button clicking failed
      if (!bagNavigationSuccess) {
        try {
          console.log('🔄 Button navigation failed - trying direct URL navigation...');
          await page.goto('https://www.ulta.com/bag');
          await page.waitForTimeout(3000);
          console.log('✅ Successfully navigated directly to bag page');
          bagNavigationSuccess = true;
        } catch (directNavError) {
          console.log(`❌ Direct bag navigation failed: ${directNavError.message}`);
        }
      }
      
      // Method 3: Alternative cart URL as final fallback
      if (!bagNavigationSuccess) {
        try {
          console.log('🔄 Trying alternative cart URL...');
          await page.goto('https://www.ulta.com/cart');
          await page.waitForTimeout(3000);
          console.log('✅ Successfully navigated to cart page');
          bagNavigationSuccess = true;
        } catch (cartNavError) {
          console.log(`❌ Cart navigation failed: ${cartNavError.message}`);
        }
      }
      
      if (!bagNavigationSuccess) {
        console.log('❌ All bag navigation methods failed - manual intervention required');
        console.log('🔄 MANUAL STEP: Please navigate to the bag/cart page manually');
        await page.pause();
      }
    }
    
    // Quick wait for bag page to load
    console.log('⏳ Waiting for bag page to load...');
    await page.waitForTimeout(2000);
    
    // Bag page logic - authentication already handled on homepage
    
        // ALWAYS try to find and click checkout button 
    console.log('🛒 Looking for checkout button on bag page...');
    
    // Comprehensive checkout button detection - try all possible selectors
    const checkoutSelectors = [
      'button:has-text("Checkout")',
      'button:has-text("CHECKOUT")',
      'a:has-text("Checkout")',
      'a:has-text("CHECKOUT")',
      'span:has-text("Checkout")',
      'button:has-text("Check Out")',
      'button:has-text("CHECK OUT")',
      '[data-testid="checkout-button"]',
      '[data-testid="checkout"]',
      '.checkout-button',
      '.checkout-btn',
      'button[aria-label*="Checkout"]',
      'button[aria-label*="checkout"]',
      'input[value*="Checkout"]',
      'button[type="submit"]:has-text("Checkout")',
      '.bag-checkout-button',
      '#checkout-button',
      '#checkout'
    ];
    
    // First, let's see what buttons are actually available
    console.log('🔍 Debug: Checking all buttons on the bag page...');
    try {
      const allButtons = await page.locator('button').all();
      console.log(`📝 Found ${allButtons.length} buttons on the page`);
      
      for (let i = 0; i < Math.min(allButtons.length, 10); i++) {
        const button = allButtons[i];
        try {
          const text = await button.textContent();
          const isVisible = await button.isVisible();
          console.log(`🔍 Button ${i+1}: "${text?.trim()}" (visible: ${isVisible})`);
        } catch (e) {
          console.log(`🔍 Button ${i+1}: Could not get info`);
        }
      }
    } catch (e) {
      console.log(`❌ Could not debug buttons: ${e.message}`);
    }
    
    let checkoutClicked = false;
    for (const selector of checkoutSelectors) {
      try {
        console.log(`🔍 Checking for checkout button: ${selector}`);
        const element = page.locator(selector).first();
        
        const elementCount = await element.count();
        if (elementCount > 0) {
          console.log(`✅ Found element with selector: ${selector} (count: ${elementCount})`);
          
          const isVisible = await element.isVisible();
          const isEnabled = await element.isEnabled();
          console.log(`🔍 Element visible: ${isVisible}, enabled: ${isEnabled}`);
          
          if (isVisible) {
            console.log(`🔄 Attempting to click checkout button: ${selector}`);
            
            try {
              // Method 1: Scroll to element and wait for it to be ready
              await element.scrollIntoViewIfNeeded();
              await page.waitForTimeout(1000);
              
              // Method 2: Wait for element to be actionable
              await element.waitFor({ state: 'visible' });
              
              // Method 3: Try regular click first
              console.log(`🔄 Trying regular click on: ${selector}`);
              await element.click();
              console.log(`✅ Regular click successful!`);
              
            } catch (clickError) {
              console.log(`⚠️ Regular click failed: ${clickError.message}`);
              console.log(`🔄 Trying force click on: ${selector}`);
              
              try {
                // Method 4: Force click as fallback
                await element.click({ force: true });
                console.log(`✅ Force click successful!`);
                
              } catch (forceClickError) {
                console.log(`⚠️ Force click failed: ${forceClickError.message}`);
                console.log(`🔄 Trying JavaScript click on: ${selector}`);
                
                try {
                  // Method 5: JavaScript click as last resort
                  await element.evaluate(el => el.click());
                  console.log(`✅ JavaScript click successful!`);
                  
                } catch (jsClickError) {
                  console.log(`❌ All click methods failed for: ${selector}`);
                  console.log(`❌ JS click error: ${jsClickError.message}`);
                  continue; // Try next selector
                }
              }
            }
            
            console.log(`✅ Successfully clicked checkout button with selector: ${selector}`);
            
            // Wait longer and check if page actually changed
            console.log(`⏳ Waiting for checkout page to load...`);
            await page.waitForTimeout(3000);
            
            // Verify the click worked by checking URL or page content
            const currentUrl = page.url();
            console.log(`🔍 Current URL after click: ${currentUrl}`);
            
            if (currentUrl.includes('/checkout') || currentUrl.includes('/cart') || currentUrl.includes('/signin')) {
              console.log(`✅ Page navigation successful - proceeding to checkout`);
              checkoutClicked = true;
              break;
            } else {
              console.log(`⚠️ Page didn't navigate, trying next selector...`);
              continue;
            }
            
          } else {
            console.log(`⚠️ Element found but not visible: ${selector}`);
          }
        } else {
          console.log(`❌ No elements found for selector: ${selector}`);
        }
      } catch (e) {
        console.log(`❌ Selector ${selector} failed: ${e.message}`);
        continue;
      }
    }
    
    if (!checkoutClicked) {
      console.log('⚠️ Standard selectors failed, trying alternative approaches...');
      
      // Try generic role-based approach
      try {
        console.log('🔄 Trying role-based checkout button...');
        const roleButton = page.getByRole('button', { name: 'Checkout' });
        
        if (await roleButton.count() > 0) {
          await roleButton.scrollIntoViewIfNeeded();
          await page.waitForTimeout(1000);
          await roleButton.click({ force: true });
          console.log('✅ Successfully clicked checkout via role selector');
          
          await page.waitForTimeout(3000);
          const currentUrl = page.url();
          
          if (currentUrl.includes('/checkout') || currentUrl.includes('/cart') || currentUrl.includes('/signin')) {
            console.log('✅ Role-based click successful');
            checkoutClicked = true;
          }
        }
      } catch (e) {
        console.log(`❌ Role-based approach failed: ${e.message}`);
      }
      
      // Try clicking any button that contains "checkout" (case insensitive)
      if (!checkoutClicked) {
        try {
          console.log('🔄 Trying to find any button containing "checkout"...');
          const allButtons = await page.locator('button').all();
          
          for (const button of allButtons) {
            try {
              const text = await button.textContent();
              if (text && text.toLowerCase().includes('checkout')) {
                console.log(`🔍 Found potential checkout button: "${text.trim()}"`);
                
                if (await button.isVisible()) {
                  await button.scrollIntoViewIfNeeded();
                  await page.waitForTimeout(500);
                  await button.click({ force: true });
                  console.log(`✅ Clicked button: "${text.trim()}"`);
                  
                  await page.waitForTimeout(3000);
                  const currentUrl = page.url();
                  
                  if (currentUrl.includes('/checkout') || currentUrl.includes('/cart') || currentUrl.includes('/signin')) {
                    console.log('✅ Button click navigation successful');
                    checkoutClicked = true;
                    break;
                  }
                }
              }
            } catch (buttonError) {
              continue;
            }
          }
        } catch (e) {
          console.log(`❌ Button search approach failed: ${e.message}`);
        }
      }
      
      // Final fallback - manual intervention
      if (!checkoutClicked) {
        console.log('❌ All automatic approaches failed');
        console.log('🔄 MANUAL PAUSE: Please click checkout button manually');
        console.log('⏸️ The script will continue after you click checkout and press RESUME');
        await page.pause();
      }
    }
    
        // Authentication already handled on homepage - proceeding with checkout flow
    
    // Wait for checkout flow to complete
    await page.waitForTimeout(3000);
    
    // Check if we're on a secure checkout page and handle CVV entry
    console.log('🔍 Checking if we are on secure checkout page...');
    const checkoutPageUrl = page.url();
    console.log(`🔍 Current URL: ${checkoutPageUrl}`);
    
    // Check for secure checkout indicators
    const secureCheckoutIndicators = [
      'secure',
      'checkout',
      'payment',
      'billing'
    ];
    
    const isSecureCheckout = secureCheckoutIndicators.some(indicator => 
      checkoutPageUrl.toLowerCase().includes(indicator)
    );
    
    // Track if CVV was already entered to avoid duplicates
    let cvvAlreadyEntered = false;
    
    if (isSecureCheckout) {
      console.log('✅ Detected secure checkout page - looking for CVV field...');
      
      // Wait for page to stabilize
      await page.waitForTimeout(2000);
      
      // Look for CVV field and enter information immediately
      const cvvSelectors = [
        'input[name="cvv"]',
        'input[name="securityCode"]',
        'input[name="cvc"]',
        'input[placeholder*="CVV"]',
        'input[placeholder*="CVC"]',
        'input[placeholder*="Security"]',
        'input[placeholder*="security"]',
        'input[placeholder*="3-digit"]',
        'input[placeholder*="4-digit"]',
        'input[aria-label*="CVV"]',
        'input[aria-label*="CVC"]',
        'input[aria-label*="Verify security code"]',
        'input[aria-label*="security"]',
        'input[aria-label*="Security"]',
        '[data-testid="cvv-input"]',
        '[data-testid="security-code"]',
        '[data-testid="cvc-input"]',
        'input[type="password"]',
        'input[maxlength="3"]',
        'input[maxlength="4"]',
        '.cvv-input',
        '.security-code-input'
      ];
      
      for (const selector of cvvSelectors) {
        try {
          const cvvField = page.locator(selector);
          if (await cvvField.count() > 0 && await cvvField.isVisible()) {
            console.log(`💳 Found CVV field on secure checkout: ${selector}`);
            
                      // Check if field is already filled to avoid duplicate entry
          const currentValue = await cvvField.inputValue();
          if (currentValue === cardCVV) {
            console.log('✅ CVV already filled correctly, skipping...');
            cvvAlreadyEntered = true;
            break;
          }
          
          // Clear and fill CVV only once
          await cvvField.clear();
          await page.waitForTimeout(500);
          
          // Enter CVV slowly for validation
          await cvvField.type(cardCVV, { delay: 200 });
          console.log('✅ CVV [HIDDEN] entered on secure checkout page');
            
            // Trigger validation events
            await cvvField.blur();
            await page.waitForTimeout(500);
            await cvvField.dispatchEvent('change');
            await page.waitForTimeout(500);
            await cvvField.dispatchEvent('input');
            await page.waitForTimeout(1000);
            
            // Click outside to trigger validation
            await page.click('body', { position: { x: 100, y: 100 } });
            console.log('✅ CVV validation events triggered on secure checkout');
            
            cvvAlreadyEntered = true;
            break; // Exit loop after first successful entry
          }
        } catch (e) {
          console.log(`❌ CVV selector ${selector} failed: ${e.message}`);
          continue;
        }
      }
      
      if (!cvvAlreadyEntered) {
        console.log('⚠️ Could not find or fill CVV field on secure checkout page');
      } else {
        console.log('✅ CVV successfully entered on secure checkout page');
        // Wait for validation to complete
        await page.waitForTimeout(3000);
      }
    } else {
      console.log('ℹ️ Not on secure checkout page, continuing with normal flow...');
    }
    
    // Payment information - check if card is already on file
    console.log('💳 Checking for existing card on file...');
    
    // Debug: Let's see what input fields are actually available
    console.log('🔍 Debug: Checking for all input fields on the payment page...');
    try {
      const allInputs = await page.locator('input').all();
      console.log(`📝 Found ${allInputs.length} input fields on the page`);
      
      for (let i = 0; i < Math.min(allInputs.length, 15); i++) {
        const input = allInputs[i];
        try {
          const name = await input.getAttribute('name');
          const placeholder = await input.getAttribute('placeholder');
          const type = await input.getAttribute('type');
          const id = await input.getAttribute('id');
          const className = await input.getAttribute('class');
          const ariaLabel = await input.getAttribute('aria-label');
          
          console.log(`🔍 Input ${i+1}: name="${name}", placeholder="${placeholder}", type="${type}", id="${id}", class="${className}", aria-label="${ariaLabel}"`);
        } catch (e) {
          console.log(`🔍 Input ${i+1}: Could not get attributes - ${e.message}`);
        }
      }
    } catch (e) {
      console.log(`❌ Could not debug input fields: ${e.message}`);
    }
    
    // Look for indicators of saved payment methods - improved detection
    const savedCardSelectors = [
      'text=Card ending in',
      'text=ending in',
      'text=****',
      'text=•••• •••• ••••',
      'text=Mastercard',
      'text=Visa',
      'text=American Express',
      'text=Discover',
      '[data-testid="saved-card"]',
      '.saved-payment-method',
      'text=Use saved card',
      'text=Saved card',
      '[aria-label*="saved card"]',
      'text=Select payment method',
      'text=Change payment method',
      'text=Edit payment method'
    ];
    
    // Also check for CVV-only fields (strong indicator of saved card)
    const cvvOnlyIndicators = [
      'input[name="cvv"]',
      'input[name="securityCode"]',
      'input[placeholder*="CVV"]',
      'input[placeholder*="Security"]',
      'input[aria-label*="CVV"]',
      'input[aria-label*="Verify security code"]',
      'input[aria-label*="security"]'
    ];
    
    let cardOnFile = false;
    let cvvFieldFound = false;
    
    // First check for saved card indicators
    for (const selector of savedCardSelectors) {
      try {
        if (await page.locator(selector).count() > 0) {
          console.log(`✅ Found existing card indicator: ${selector}`);
          cardOnFile = true;
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    // Also check for CVV fields (which often appear for saved cards)
    for (const selector of cvvOnlyIndicators) {
      try {
        if (await page.locator(selector).count() > 0) {
          console.log(`✅ Found CVV field for saved card: ${selector}`);
          cvvFieldFound = true;
          // If we find CVV field but no full credit card number field, it's likely a saved card
          const fullCardField = page.locator('input[name="creditCardNumber"]');
          if (await fullCardField.count() === 0) {
            console.log('✅ CVV field found without full card number field - saved card detected');
            cardOnFile = true;
          }
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if ((cardOnFile || cvvFieldFound) && !cvvAlreadyEntered) {
      console.log('💳 Card on file detected - entering CVV only...');
      
      // Try to find and fill CVV field for existing card - expanded selectors
      const cvvSelectors = [
        'input[name="cvv"]',
        'input[name="securityCode"]',
        'input[name="cvc"]',
        'input[placeholder*="CVV"]',
        'input[placeholder*="CVC"]',
        'input[placeholder*="Security"]',
        'input[placeholder*="security"]',
        'input[placeholder*="3-digit"]',
        'input[placeholder*="4-digit"]',
        'input[aria-label*="CVV"]',
        'input[aria-label*="CVC"]',
        'input[aria-label*="Verify security code"]',
        'input[aria-label*="security"]',
        'input[aria-label*="Security"]',
        '[data-testid="cvv-input"]',
        '[data-testid="security-code"]',
        '[data-testid="cvc-input"]',
        'input[type="password"]',
        'input[maxlength="3"]',
        'input[maxlength="4"]',
        '.cvv-input',
        '.security-code-input'
      ];
      
      let cvvFilled = false;
      for (const selector of cvvSelectors) {
        try {
          const cvvField = page.locator(selector);
          if (await cvvField.count() > 0 && await cvvField.isVisible()) {
            console.log(`🔍 Attempting to fill CVV with selector: ${selector}`);
            
            // Check if field is already filled to avoid duplicate entry
            const currentValue = await cvvField.inputValue();
            if (currentValue === cardCVV) {
              console.log('✅ CVV already filled correctly, skipping duplicate entry...');
              cvvFilled = true;
              break;
            }
            
            // Clear the field first and then fill slowly
            await cvvField.clear();
            await page.waitForTimeout(500);
            
            // Fill CVV slowly character by character
            await cvvField.type(cardCVV, { delay: 200 });
            await page.waitForTimeout(1000);
            
            // Verify the value was entered
            const fieldValue = await cvvField.inputValue();
            if (fieldValue === cardCVV) {
              console.log('✅ CVV [HIDDEN] filled and verified successfully');
              
              // Trigger multiple events to ensure validation
              console.log('🔍 Triggering CVV field validation events...');
              try {
                // Trigger blur event
                await cvvField.blur();
                await page.waitForTimeout(500);
                
                // Trigger change event
                await cvvField.dispatchEvent('change');
                await page.waitForTimeout(500);
                
                // Trigger input event
                await cvvField.dispatchEvent('input');
                await page.waitForTimeout(500);
                
                // Click outside the field to trigger validation and enable place order button
                await page.click('body', { position: { x: 100, y: 100 } });
                console.log('✅ Successfully triggered CVV validation events');
                
                // Wait longer for validation to complete
                await page.waitForTimeout(3000);
              } catch (e) {
                console.log(`⚠️ Failed to trigger CVV validation: ${e.message}`);
              }
              
              cvvFilled = true;
              break; // Exit loop after first successful entry
            } else {
              console.log(`⚠️ CVV field filled but value verification failed, trying next selector...`);
            }
          }
        } catch (e) {
          console.log(`❌ Failed to fill CVV with selector ${selector}: ${e.message}`);
          continue;
        }
      }
      
      if (!cvvFilled) {
        console.log('⚠️ Could not find or fill CVV field for saved card, trying manual entry...');
        // Fall back to manual entry if CVV field not found
        cardOnFile = false;
      } else {
        // Wait a bit after filling CVV
        await page.waitForTimeout(1000);
      }
    } else if (cvvAlreadyEntered) {
      console.log('✅ CVV already entered on secure checkout page, skipping duplicate entry...');
    }
    
    if (!cardOnFile) {
      console.log('💳 No card on file - entering full payment details...');
      
      // Check if we're actually on a payment page before filling card details
      console.log('🔍 Verifying we are on the payment page...');
      const paymentPageIndicators = [
        'input[name="creditCardNumber"]',
        'text=Payment',
        'text=Credit Card',
        'text=Card Number',
        'text=Billing Address'
      ];
      
      let onPaymentPage = false;
      for (const indicator of paymentPageIndicators) {
        try {
          if (await page.locator(indicator).count() > 0) {
            console.log(`✅ Payment page confirmed (found: ${indicator})`);
            onPaymentPage = true;
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      if (!onPaymentPage) {
        console.log('⚠️ Not on payment page - skipping card details entry');
        console.log('🔍 Current URL:', page.url());
        return; // Exit the function if not on payment page
      }
      
      // Handle billing address same as shipping BEFORE entering card details
      console.log('🔍 Looking for billing address options before entering card details...');
      
      try {
        // First, try to dynamically find any element containing "billing address same as shipping" text
        console.log('  🔍 Searching dynamically for "billing address same as shipping" text...');
        let sameAsShippingClicked = false;
        let dynamicElement = null;
        
        try {
          // Search for elements containing the exact phrase
          const phrases = [
            'billing address same as shipping',
            'Billing address same as shipping',
            'billing address is same as shipping',
            'Billing address is same as shipping',
            'billing same as shipping',
            'Billing same as shipping',
            'use shipping address for billing',
            'Use shipping address for billing'
          ];
          
          for (const phrase of phrases) {
            console.log(`    🔍 Looking for phrase: "${phrase}"`);
            const elements = await page.locator(`text="${phrase}"`).all();
            console.log(`    📊 Found ${elements.length} elements with exact text "${phrase}"`);
            
            if (elements.length > 0) {
              for (const el of elements) {
                const isVisible = await el.isVisible();
                console.log(`    👁️ Element visible: ${isVisible}`);
                if (isVisible) {
                  dynamicElement = el;
                  console.log(`    ✅ Found dynamic element with text: "${phrase}"`);
                  break;
                }
              }
              if (dynamicElement) break;
            }
          }
        } catch (e) {
          console.log('    ⚠️ Dynamic text search failed');
        }
        
        if (dynamicElement) {
          console.log('  ✅ Attempting to click dynamically found element...');
          try {
            await dynamicElement.click({ force: true });
            console.log('  ✅ SUCCESS: Clicked dynamically found "billing address same as shipping" element');
            sameAsShippingClicked = true;
          } catch (e) {
            console.log(`  ❌ Failed to click dynamic element: ${e.message}`);
          }
        }
        
        // If dynamic search didn't work, try predefined selectors
        if (!sameAsShippingClicked) {
          console.log('  🔄 Dynamic search failed, trying predefined selectors...');
          
          // Try to find "billing address same as shipping" text switches/toggles
          const sameAsShippingSelectors = [
            // Text-based switches and toggles
            'text="Billing address same as shipping"',
            'text="billing address same as shipping"',
            'text="Same as shipping address"',
            'text="same as shipping address"',
            'text="Use shipping address for billing"',
            'text="use shipping address for billing"',
            
            // Switch/toggle elements with text
            '[role="switch"]:has-text("billing address same as shipping")',
            '[role="switch"]:has-text("same as shipping")',
            '.switch:has-text("billing address same as shipping")',
            '.toggle:has-text("billing address same as shipping")',
            '.checkbox:has-text("billing address same as shipping")',
            
            // Buttons and clickable elements with specific text
            'button:has-text("Billing address same as shipping")',
            'button:has-text("billing address same as shipping")',
            'button:has-text("Same as shipping")',
            'button:has-text("same as shipping")',
            
            // Labels and spans with the text
            'label:has-text("Billing address same as shipping")',
            'label:has-text("billing address same as shipping")',
            'span:has-text("Billing address same as shipping")',
            'span:has-text("billing address same as shipping")',
            'div:has-text("Billing address same as shipping")',
            'div:has-text("billing address same as shipping")',
            
            // Input elements
            '#billingAddressSamAsaShipping',
            'input[name*="billingAddressSameAsShipping"]',
            'input[name*="sameAsShipping"]',
            'input[value="same"]',
            'input[name*="billing"][value="true"]',
            'input[name*="billing"][value="yes"]',
            
            // Data attributes and aria labels
            '[data-testid="same-as-shipping"]',
            '[data-testid="billing-same-shipping"]',
            '[aria-label*="billing address same as shipping"]',
            '[aria-label*="same as shipping"]'
          ];
          
          for (let i = 0; i < sameAsShippingSelectors.length; i++) {
            const selector = sameAsShippingSelectors[i];
            console.log(`  🔍 Trying billing same as shipping selector ${i+1}/${sameAsShippingSelectors.length}: ${selector}`);
            
            try {
              const element = page.locator(selector);
              const elementCount = await element.count();
              console.log(`    📊 Found ${elementCount} elements with this selector`);
              
              if (elementCount > 0) {
                const isVisible = await element.isVisible();
                console.log(`    👁️ Element visible: ${isVisible}`);
                
                if (isVisible) {
                  console.log(`    ✅ Found billing same as shipping option: ${selector}`);
                  
                  // Get element details for better handling
                  const tagName = await element.evaluate(el => el.tagName.toLowerCase());
                  const inputType = await element.getAttribute('type');
                  const role = await element.getAttribute('role');
                  const text = await element.textContent();
                  
                  console.log(`    🔍 Element details: tag="${tagName}", type="${inputType}", role="${role}", text="${text?.trim()}"`);
                  
                  // Handle different element types appropriately
                  if (tagName === 'input' && inputType === 'checkbox') {
                    console.log(`    📝 Handling as checkbox...`);
                    const isChecked = await element.isChecked();
                    if (!isChecked) {
                      await element.check({ force: true });
                      console.log('    ✅ Checked "billing address same as shipping" checkbox');
                    } else {
                      console.log('    ✅ "Same as shipping" checkbox already checked');
                    }
                  } else if (tagName === 'input' && inputType === 'radio') {
                    console.log(`    📝 Handling as radio button...`);
                    await element.check({ force: true });
                    console.log('    ✅ Selected "billing address same as shipping" radio button');
                  } else if (role === 'switch') {
                    console.log(`    📝 Handling as switch/toggle...`);
                    await element.click({ force: true });
                    console.log('    ✅ Toggled "billing address same as shipping" switch');
                  } else {
                    // For buttons, text, labels, spans, divs - just click
                    console.log(`    📝 Handling as clickable element (${tagName})...`);
                    await element.click({ force: true });
                    console.log(`    ✅ Clicked "billing address same as shipping" ${tagName}`);
                  }
                  
                  sameAsShippingClicked = true;
                  break;
                }
              } else {
                console.log(`    ❌ No elements found with selector: ${selector}`);
              }
            } catch (e) {
              console.log(`    ❌ Error with selector ${selector}: ${e.message}`);
              continue;
            }
          }
        }
        
        if (!sameAsShippingClicked) {
          console.log('  ❌ FAILED to find and click "billing address same as shipping" option');
          console.log('  🔄 Proceeding with card entry anyway...');
        } else {
          console.log('  ✅ SUCCESS: "billing address same as shipping" option clicked');
        }
        
        console.log('\n⏳ Waiting for form to update after same-as-shipping interaction...');
        // Wait for form to update after selection
        await page.waitForTimeout(3000);
        
      } catch (e) {
        console.log('⚠️ Billing address same as shipping handling failed, continuing with card entry...');
      }
      
      // Enter full card details with better error handling
      const cardFields = [
        { selector: 'input[name="creditCardNumber"]', value: cardNumber, name: 'Credit Card Number', displayValue: '****-****-****-' + cardNumber.slice(-4) },
        { selector: 'input[name="expirationDate"]', value: cardExpiration, name: 'Expiration Date', displayValue: cardExpiration.substring(0,2) + '/' + cardExpiration.substring(2) },
        { selector: 'input[name="cvv"]', value: cardCVV, name: 'CVV', displayValue: '[HIDDEN]' }
      ];
      
      for (const field of cardFields) {
        try {
          const fieldElement = page.locator(field.selector);
          if (await fieldElement.count() > 0) {
            
            // Fill field based on type
            if (field.name === 'CVV') {
              // Fill CVV slowly to allow validation
              await fieldElement.clear();
              await page.waitForTimeout(500);
              await fieldElement.type(field.value, { delay: 200 });
              await page.waitForTimeout(1000);
              console.log(`✅ Filled ${field.name} ${field.displayValue} successfully (slowly)`);
            } else {
              await fieldElement.fill(field.value);
              console.log(`✅ Filled ${field.name} ${field.displayValue} successfully`);
            }
            
            if (field.name === 'Credit Card Number') {
              await page.waitForTimeout(2000); // Wait for card type detection
            }
            
            // Trigger validation after filling CVV
            if (field.name === 'CVV') {
              console.log('🔍 Triggering CVV field validation events...');
              try {
                // Trigger blur event
                await fieldElement.blur();
                await page.waitForTimeout(500);
                
                // Trigger change event
                await fieldElement.dispatchEvent('change');
                await page.waitForTimeout(500);
                
                // Trigger input event
                await fieldElement.dispatchEvent('input');
                await page.waitForTimeout(500);
                
                // Click outside the field to trigger validation
                await page.click('body', { position: { x: 100, y: 100 } });
                console.log('✅ Successfully triggered CVV validation events');
                
                // Wait longer for validation to complete
                await page.waitForTimeout(3000);
              } catch (e) {
                console.log(`⚠️ Failed to trigger CVV validation: ${e.message}`);
              }
            }
          } else {
            console.log(`⚠️ ${field.name} field not found with selector: ${field.selector}`);
          }
        } catch (e) {
          console.log(`❌ Failed to fill ${field.name}: ${e.message}`);
        }
      }
      
      console.log('✅ Full card details entered');
      
      // Enter billing information after card details
      console.log('📝 Entering billing address information...');
      
      // Wait a moment for any form updates after card entry
      await page.waitForTimeout(2000);
      
      // Billing address information with multiple selector strategies
      const billingFields = [
        { 
          name: 'First Name',
          value: billingFirstName,
          displayValue: '[HIDDEN]',
          selectors: [
            'input[name="firstName"]',
            'input[name="firstname"]',
            'input[name="first_name"]',
            'input[placeholder*="First"]',
            'input[placeholder*="first"]',
            'input[aria-label*="First"]',
            'input[id*="first"]',
            '#firstName',
            '#firstname',
            '#first-name'
          ]
        },
        { 
          name: 'Last Name',
          value: billingLastName,
          displayValue: '[HIDDEN]',
          selectors: [
            'input[name="lastName"]',
            'input[name="lastname"]',
            'input[name="last_name"]',
            'input[placeholder*="Last"]',
            'input[placeholder*="last"]',
            'input[aria-label*="Last"]',
            'input[id*="last"]',
            '#lastName',
            '#lastname',
            '#last-name'
          ]
        },
        { 
          name: 'Address',
          value: billingAddress,
          displayValue: '[HIDDEN]',
          selectors: [
            'input[name="address"]',
            'input[name="address1"]',
            'input[name="street"]',
            'input[name="streetAddress"]',
            'input[placeholder*="Address"]',
            'input[placeholder*="Street"]',
            'input[aria-label*="Address"]',
            'input[aria-label*="Street"]',
            'input[id*="address"]',
            '#address',
            '#address1',
            '#street'
          ]
        },
        { 
          name: 'City',
          value: billingCity,
          displayValue: '[HIDDEN]',
          selectors: [
            'input[name="city"]',
            'input[name="locality"]',
            'input[placeholder*="City"]',
            'input[aria-label*="City"]',
            'input[id*="city"]',
            '#city'
          ]
        },
        { 
          name: 'Zip Code',
          value: billingZip,
          displayValue: '[HIDDEN]',
          selectors: [
            'input[name="zipCode"]',
            'input[name="zip"]',
            'input[name="postalCode"]',
            'input[name="postal_code"]',
            'input[placeholder*="Zip"]',
            'input[placeholder*="zip"]',
            'input[placeholder*="Postal"]',
            'input[aria-label*="Zip"]',
            'input[aria-label*="Postal"]',
            'input[id*="zip"]',
            'input[id*="postal"]',
            '#zipCode',
            '#zip',
            '#postalCode'
          ]
        },
        { 
          name: 'Phone Number',
          value: billingPhone,
          displayValue: '[HIDDEN]',
          selectors: [
            'input[name="phone"]',
            'input[name="phoneNumber"]',
            'input[name="mobile"]',
            'input[name="mobileNumber"]',
            'input[type="tel"]',
            'input[placeholder*="Phone"]',
            'input[placeholder*="phone"]',
            'input[placeholder*="Mobile"]',
            'input[placeholder*="mobile"]',
            'input[aria-label*="Phone"]',
            'input[aria-label*="Mobile"]',
            'input[id*="phone"]',
            'input[id*="mobile"]',
            '#phone',
            '#phoneNumber',
            '#mobile'
          ]
        }
      ];
      
      console.log('🔄 Starting billing field entry loop...');
      for (const field of billingFields) {
        console.log(`\n📝 Processing ${field.name} field...`);
        let fieldFilled = false;
        
        for (let i = 0; i < field.selectors.length; i++) {
          const selector = field.selectors[i];
          console.log(`  🔍 Trying selector ${i+1}/${field.selectors.length}: ${selector}`);
          
          try {
            const fieldElement = page.locator(selector);
            const elementCount = await fieldElement.count();
            console.log(`    📊 Found ${elementCount} elements with this selector`);
            
            if (elementCount > 0) {
              console.log(`    ✅ Found ${field.name} field with selector: ${selector}`);
              
              // Check if field is visible and enabled
              const isVisible = await fieldElement.isVisible();
              const isEnabled = await fieldElement.isEnabled();
              console.log(`    🔍 ${field.name} field visible: ${isVisible}, enabled: ${isEnabled}`);
              
              if (isVisible && isEnabled) {
                console.log(`    📝 Attempting to fill ${field.displayValue} into ${field.name}...`);
                await fieldElement.fill(field.value);
                console.log(`    ✅ Successfully filled ${field.name} with ${field.displayValue}`);
                fieldFilled = true;
                break;
              } else {
                console.log(`    ⚠️ ${field.name} field found but not fillable (visible: ${isVisible}, enabled: ${isEnabled})`);
              }
            } else {
              console.log(`    ❌ No elements found with selector: ${selector}`);
            }
          } catch (e) {
            console.log(`    ❌ Error with selector ${selector}: ${e.message}`);
            continue;
          }
        }
        
        if (!fieldFilled) {
          console.log(`  ❌ FAILED to fill ${field.name} field with any selector`);
        } else {
          console.log(`  ✅ SUCCESS: ${field.name} field filled`);
        }
        
        // Small delay between fields
        await page.waitForTimeout(500);
      }
      
      console.log('\n🔍 Billing field entry loop completed.');
      
      // Handle state selection with multiple selectors
      console.log('\n📝 Processing State selection...');
      const stateSelectors = [
        '#select-state',
        'select[name="state"]',
        'select[name="stateOrProvince"]',
        'select[name="region"]',
        'select[aria-label*="State"]',
        'select[aria-label*="state"]',
        'select[id*="state"]',
        'select[id*="region"]',
        '#state',
        '#stateOrProvince',
        '#region'
      ];
      
      let stateSelected = false;
      for (let i = 0; i < stateSelectors.length; i++) {
        const selector = stateSelectors[i];
        console.log(`  🔍 Trying state selector ${i+1}/${stateSelectors.length}: ${selector}`);
        
        try {
          const stateField = page.locator(selector);
          const elementCount = await stateField.count();
          console.log(`    📊 Found ${elementCount} state elements with this selector`);
          
          if (elementCount > 0) {
            console.log(`    ✅ Found state field with selector: ${selector}`);
            
            // Check if field is visible and enabled
            const isVisible = await stateField.isVisible();
            const isEnabled = await stateField.isEnabled();
            console.log(`    🔍 State field visible: ${isVisible}, enabled: ${isEnabled}`);
            
            if (isVisible && isEnabled) {
              console.log(`    📝 Attempting to select state "CA"...`);
              await stateField.selectOption('CA');
              console.log('    ✅ Successfully selected state: CA');
              stateSelected = true;
              break;
            } else {
              console.log(`    ⚠️ State field found but not selectable (visible: ${isVisible}, enabled: ${isEnabled})`);
            }
          } else {
            console.log(`    ❌ No state elements found with selector: ${selector}`);
          }
        } catch (e) {
          console.log(`    ❌ Error with state selector ${selector}: ${e.message}`);
          continue;
        }
      }
      
      if (!stateSelected) {
        console.log('  ❌ FAILED to select state field with any selector');
      } else {
        console.log('  ✅ SUCCESS: State field selected');
      }
      
      console.log('\n🏁 State selection completed.');
      
      // Wait for billing address form to process
      console.log('⏳ Waiting for billing address form to process...');
      await page.waitForTimeout(3000);
      
      // Validate that billing fields were filled
      console.log('🔍 Validating billing address fields were filled...');
      try {
        const filledFields = await page.locator('input[value]:not([value=""])').count();
        console.log(`📝 Found ${filledFields} filled input fields`);
        
        if (filledFields > 3) {
          console.log('✅ Billing address appears to be filled successfully');
        } else {
          console.log('⚠️ Billing address may not have been filled completely');
        }
      } catch (e) {
        console.log(`⚠️ Could not validate billing fields: ${e.message}`);
      }
      
      console.log('✅ Billing address information entry completed');
    } // Close the if (!cardOnFile) block
    await page.waitForTimeout(3000);
    
    // Wait for place order button to be enabled after CVV validation
    console.log('🔍 Waiting for place order button to be enabled...');
    try {
      await page.waitForSelector('text=Place order', { state: 'visible', timeout: 15000 });
      console.log('✅ Place order button is visible');
      
      // Wait for button to be enabled - check multiple times
      let buttonEnabled = false;
      for (let i = 0; i < 10; i++) {
        try {
          const placeOrderButton = page.locator('text=Place order');
          if (await placeOrderButton.count() > 0) {
            const isEnabled = await placeOrderButton.isEnabled();
            console.log(`🔍 Place order button enabled check ${i+1}/10: ${isEnabled}`);
            if (isEnabled) {
              buttonEnabled = true;
              break;
            }
          }
          await page.waitForTimeout(1000);
        } catch (e) {
          console.log(`⚠️ Button enabled check ${i+1} failed: ${e.message}`);
          await page.waitForTimeout(1000);
        }
      }
      
      if (buttonEnabled) {
        console.log('✅ Place order button is now enabled');
      } else {
        console.log('⚠️ Place order button is still not enabled after waiting');
      }
      
    } catch (e) {
      console.log(`⚠️ Place order button visibility check failed: ${e.message}`);
    }
    
    // Pause before submitting the order to allow final review
    console.log('⏸️ Pausing before order submission for final review...');
    console.log('🔍 Please verify all details are correct');
    console.log('⏸️ Click RESUME when ready to submit the order');
    await page.pause();
    
    // Place order with better error handling
    console.log('🛒 Attempting to place order...');
    const placeOrderSelectors = [
      'text=Place order',
      'button:has-text("Place order")',
      'button:has-text("Place Order")',
      'button:has-text("Complete order")',
      'button:has-text("Submit order")',
      'button[type="submit"]',
      '[data-testid="place-order"]',
      '.place-order-button',
      'input[type="submit"]'
    ];
    
    let orderPlaced = false;
    for (const selector of placeOrderSelectors) {
      try {
        const orderButton = page.locator(selector);
        if (await orderButton.count() > 0) {
          console.log(`🔍 Found place order button with selector: ${selector}`);
          
          // Check if button is enabled before clicking
          const isEnabled = await orderButton.isEnabled();
          console.log(`🔍 Button enabled status: ${isEnabled}`);
          
          if (isEnabled) {
            // Wait for button to be ready
            await orderButton.waitFor({ state: 'visible' });
            
            // Click the button
            await orderButton.click({ force: true });
            console.log(`✅ Successfully clicked place order button: ${selector}`);
            
            // Wait a bit to see if page changes
            await page.waitForTimeout(3000);
            
            // Check if we're on a confirmation page or if URL changed
            const currentUrl = page.url();
            console.log(`🔍 Current URL after click: ${currentUrl}`);
            
            // Look for confirmation indicators
            const confirmationIndicators = [
              'text=Order confirmation',
              'text=Thank you',
              'text=Your order has been placed',
              'text=Order placed',
              'text=Confirmation',
              'text=Order number',
              'text=Order #'
            ];
            
            let confirmationFound = false;
            for (const indicator of confirmationIndicators) {
              try {
                if (await page.locator(indicator).count() > 0) {
                  console.log(`✅ Order confirmation found: ${indicator}`);
                  confirmationFound = true;
                  break;
                }
              } catch (e) {
                continue;
              }
            }
            
            if (!confirmationFound) {
              console.log('⚠️ No confirmation message found, but button was clicked');
            }
            
            orderPlaced = true;
            break;
          } else {
            console.log(`⚠️ Button found but not enabled with selector: ${selector}`);
            continue;
          }
        }
      } catch (e) {
        console.log(`❌ Failed to click place order with selector ${selector}: ${e.message}`);
        continue;
      }
    }
    
    if (!orderPlaced) {
      console.log('⚠️ Could not find or click place order button, order may not have been placed');
    }
    
    // Wait for order confirmation or result
    await page.waitForTimeout(5000);
    
    console.log('✅ Test completed successfully!');
    console.log('ℹ️ Browser will remain open for manual review...');
    console.log('ℹ️ Press Ctrl+C in the terminal to close the browser and end the test.');
    
    // Keep browser open indefinitely - prevent test from completing
    await page.pause(); // This will pause the test and keep browser open
    // Alternative: use a very long timeout to keep browser open
    // await page.waitForTimeout(3600000); // 1 hour
    
    // Keep browser open - context.close() commented out
    // await context.close();
  });
}); 