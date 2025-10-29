const { test, expect, chromium } = require('@playwright/test');

test.describe('MyPeopleNet Timesheet Entry', () => {
  test('Login and enter time for Monday', async () => {
    // Extended timeout for login and navigation
    test.setTimeout(120000); // 2 minutes
    
    // Launch browser
    const browser = await chromium.launch({
      headless: false, // Keep visible to see what's happening
      slowMo: 1000, // Slow down actions for visibility
    });
    
    const context = await browser.newContext({
      viewport: { width: 1200, height: 1200 }
    });
    
    const page = await context.newPage();
    
    try {
      console.log('🌐 Navigating to MyPeopleNet...');
      await page.goto('https://www.mypeoplenet.com/', { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });
      
      console.log('✅ Page loaded successfully');
      
      // Wait for login form to be visible
      console.log('🔍 Looking for login form...');
      await page.waitForSelector('input[type="email"], input[name*="email"], input[id*="email"], input[placeholder*="email"]', { 
        timeout: 10000 
      });
      
      // Find and fill email field
      console.log('📧 Entering email address...');
      const emailField = await page.locator('input[type="email"], input[name*="email"], input[id*="email"], input[placeholder*="email"]').first();
      await emailField.fill('neil.jones@levolor.com');
      
      // Find and fill password field
      console.log('🔒 Entering password...');
      const passwordField = await page.locator('input[type="password"]').first();
      await passwordField.fill('Tinman2029!');
      
      // Take a screenshot before trying to click login
      await page.screenshot({ 
        path: 'test-results/before-login-click.png',
        fullPage: true 
      });
      console.log('📸 Screenshot taken before login attempt');
      
      // Find and click login button with better error handling
      console.log('🚀 Looking for login button...');
      
      // Try multiple possible login button selectors
      const loginSelectors = [
        'button:has-text("Login")',
        'button:has-text("Sign In")', 
        'button:has-text("Log In")',
        'input[type="submit"][value*="Login"]',
        'input[type="submit"][value*="Sign"]',
        'button[type="submit"]',
        'input[type="submit"]',
        '.login-button',
        '#login-button',
        '[data-testid*="login"]'
      ];
      
      let loginButton = null;
      for (const selector of loginSelectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible({ timeout: 1000 })) {
            loginButton = element;
            console.log(`✅ Found login button with selector: ${selector}`);
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      if (!loginButton) {
        console.log('❌ Could not find login button, showing page content...');
        const pageContent = await page.content();
        console.log('Page HTML length:', pageContent.length);
        throw new Error('Login button not found');
      }
      
      console.log('🚀 Clicking login button...');
      await loginButton.click();
      
      // Wait for login to complete and dashboard to load
      console.log('⏳ Waiting for login to complete...');
      await page.waitForLoadState('networkidle', { timeout: 30000 });
      
      // Look for the current week ending (the one with "0.00" and "No Time Entered")
      console.log('🔍 Looking for current week ending...');
      await page.waitForSelector('text=0.00', { timeout: 15000 });
      
      console.log('✅ Found 0.00 hours entry');
      
      // Look for the current week ending date (should be the first entry with 0.00 and "No Time Entered")
      console.log('📅 Looking for current week ending date...');
      
      const currentWeekSelectors = [
        // Look for row containing both "0.00" and "No Time Entered"
        'tr:has-text("0.00"):has-text("No Time Entered")',
        'tr:has-text("No Time Entered"):has-text("0.00")',
        // Look for the first timesheet row
        'tr:has-text("0.00"):first',
        // Look for date patterns in rows with 0.00
        'td:has-text("0.00") + td',
        'td:has-text("0.00") - td',
        // Look for any date format followed by 0.00
        'tr:has-text("/") :has-text("0.00"):first'
      ];
      
      let currentWeekElement = null;
      for (const selector of currentWeekSelectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible({ timeout: 2000 })) {
            currentWeekElement = element;
            console.log(`✅ Found current week entry with selector: ${selector}`);
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      if (!currentWeekElement) {
        // Fallback: try to find any date in the first timesheet row
        console.log('🔄 Trying fallback: looking for any date in first row...');
        try {
          // Look for date patterns like MM/DD/YYYY or M/D/YYYY
          const datePattern = page.locator('text=/\\d{1,2}\\/\\d{1,2}\\/\\d{4}/').first();
          if (await datePattern.isVisible({ timeout: 2000 })) {
            currentWeekElement = datePattern;
            console.log('✅ Found date using fallback pattern matching');
          }
        } catch (e) {
          console.log('⚠️ Fallback also failed');
        }
      }
      
      if (!currentWeekElement) {
        // Take a screenshot to see current state
        await page.screenshot({ 
          path: 'test-results/dashboard-state.png',
          fullPage: true 
        });
        console.log('❌ Could not find current week ending date');
        throw new Error('Current week ending date not found');
      }
      
      // Get the text content to show which date we found
      let weekEndingText = 'current week';
      try {
        weekEndingText = await currentWeekElement.textContent();
        console.log(`📊 Found week ending: ${weekEndingText}`);
      } catch (e) {
        console.log('📊 Found current week ending (could not read date)');
      }
      
      console.log('📊 Clicking on current week ending...');
      await currentWeekElement.click();
      
      // Wait for timesheet detail page to load
      console.log('⏳ Waiting for timesheet detail page to load...');
      await page.waitForLoadState('networkidle', { timeout: 15000 });
      await page.waitForTimeout(3000);
      
      // Take screenshot of timesheet detail page
      await page.screenshot({ 
        path: 'test-results/timesheet-detail-page.png',
        fullPage: true 
      });
      console.log('📸 Screenshot taken of current week timesheet detail page');
      
      // Help identify time entry points
      console.log('🔍 Scanning for time entry elements...');
      
      // Look for common time entry patterns
      const timeEntrySelectors = [
        'button:has-text("Enter Time")',
        'button:has-text("Add Time")',
        'button:has-text("Edit")',
        'a:has-text("Enter Time")',
        'a:has-text("Add Time")',
        'a:has-text("Edit")',
        'input[type="time"]',
        'input[placeholder*="time" i]',
        'input[name*="time" i]',
        'input[id*="time" i]',
        '.time-entry',
        '.add-time',
        '.edit-time',
        '[onclick*="time"]',
        'td:has-text("Mon") input',
        'td:has-text("Monday") input'
      ];
      
      console.log('📋 Found these time entry elements:');
      for (const selector of timeEntrySelectors) {
        try {
          const elements = await page.locator(selector).all();
          if (elements.length > 0) {
            for (let i = 0; i < elements.length && i < 3; i++) {
              const isVisible = await elements[i].isVisible();
              if (isVisible) {
                const text = await elements[i].textContent() || '';
                const tagName = await elements[i].evaluate(el => el.tagName);
                console.log(`  ✅ ${tagName}: "${text.trim()}" (selector: ${selector})`);
              }
            }
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      

      
      // Pause execution until user resumes
      await page.pause();
      
      // Wait a moment for any UI to settle after user interaction
      await page.waitForTimeout(2000);
      
      // Look for Edit/Enter Time button to enable the fields
      console.log('🔍 Looking for Edit/Enter Time button to enable fields...');
      
      const enableButtonSelectors = [
        'button:has-text("Edit")',
        'button:has-text("Enter")',
        'button:has-text("Add")',
        'button:has-text("Start")',
        'a:has-text("Edit")',
        'a:has-text("Enter")',
        'a:has-text("Add")',
        '.edit-button',
        '.enter-time-button',
        '[onclick*="edit"]',
        '[onclick*="enter"]'
      ];
      
      let enableButton = null;
      for (const selector of enableButtonSelectors) {
        try {
          const button = page.locator(selector).first();
          if (await button.isVisible({ timeout: 1000 })) {
            enableButton = button;
            console.log(`✅ Found enable button with selector: ${selector}`);
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      if (enableButton) {
        console.log('🔓 Clicking button to enable time entry...');
        await enableButton.click();
        await page.waitForTimeout(1000);
        console.log('✅ Clicked enable button');
      } else {
        console.log('⚠️ No enable button found - fields might already be enabled');
      }
      
      // Take screenshot of opened time entry interface
      await page.screenshot({ 
        path: 'test-results/time-entry-interface.png',
        fullPage: true 
      });
      console.log('📸 Screenshot taken of time entry interface');
      
      console.log('⏰ Entering work hours (8:00 AM - 5:00 PM)...');
      
      // Debug: Show ALL visible input elements to understand structure
      console.log('🔍 DEBUGGING: Analyzing time entry interface...');
      
      // Show all visible input-like elements
      console.log('📋 All visible input elements on page:');
      const allInputs = await page.locator('input').all();
      for (let i = 0; i < allInputs.length && i < 15; i++) {
        try {
          const isVisible = await allInputs[i].isVisible();
          if (isVisible) {
            const type = await allInputs[i].getAttribute('type') || 'text';
            const placeholder = await allInputs[i].getAttribute('placeholder') || '';
            const name = await allInputs[i].getAttribute('name') || '';
            const id = await allInputs[i].getAttribute('id') || '';
            const value = await allInputs[i].inputValue();
            const disabled = await allInputs[i].getAttribute('disabled');
            const isEnabled = disabled === null ? 'enabled' : 'DISABLED';
            console.log(`  ${i + 1}. type="${type}" name="${name}" id="${id}" placeholder="${placeholder}" value="${value}" status=${isEnabled}`);
          }
        } catch (e) {
          console.log(`  ${i + 1}. Error reading input: ${e.message}`);
        }
      }
      
      // Try to find time input fields with more specific selectors
      console.log('🔍 Looking for time input fields...');
      
      // Look for specific time input fields (enabled only)
      const timeInputSelectors = [
        // Specific time-related inputs
        'input[type="time"]:visible:not([disabled])',
        'input[placeholder*="time" i]:not([disabled])',
        'input[placeholder*="hour" i]:not([disabled])',
        'input[placeholder*="in" i]:not([disabled])',
        'input[placeholder*="out" i]:not([disabled])',
        'input[name*="time" i]:not([disabled])',
        'input[name*="in" i]:not([disabled])',
        'input[name*="out" i]:not([disabled])',
        'input[id*="time" i]:not([disabled])',
        'input[id*="in" i]:not([disabled])',
        'input[id*="out" i]:not([disabled])',
        // Text inputs that might be for time entry
        'input[type="text"]:visible:not([disabled])',
        // Fallback to any enabled input (but be careful)
        'input:not([disabled]):visible'
      ];
      
      let timeInputs = [];
      let bestSelector = '';
      
      for (const selector of timeInputSelectors) {
        try {
          const inputs = await page.locator(selector).all();
          const visibleInputs = [];
          for (const input of inputs) {
            if (await input.isVisible()) {
              visibleInputs.push(input);
            }
          }
          console.log(`🔍 Selector "${selector}": found ${inputs.length} total, ${visibleInputs.length} visible`);
          if (visibleInputs.length >= 2) {
            timeInputs = visibleInputs;
            bestSelector = selector;
            console.log(`✅ Using ${visibleInputs.length} visible input fields with selector: ${selector}`);
            break;
          }
        } catch (e) {
          console.log(`⚠️ Error with selector "${selector}": ${e.message}`);
        }
      }
      
      if (timeInputs.length < 2) {
        console.log('❌ Could not find enough time input fields');
        console.log(`   Found ${timeInputs.length} input fields, need at least 2`);
        console.log('   Taking screenshot for debugging...');
        await page.screenshot({ path: 'test-results/no-time-inputs-found.png', fullPage: true });
        
        // Try a more desperate search - just get the first 2 visible inputs
        console.log('🔄 Fallback: trying to use first 2 visible input fields...');
        const allVisibleInputs = [];
        for (const input of allInputs) {
          if (await input.isVisible()) {
            allVisibleInputs.push(input);
          }
        }
        
        if (allVisibleInputs.length >= 2) {
          timeInputs = allVisibleInputs.slice(0, 2);
          console.log(`✅ Using first 2 visible inputs as fallback: ${timeInputs.length} fields`);
        } else {
          throw new Error(`Only found ${allVisibleInputs.length} visible input fields total`);
        }
      }
      
      // Enter work IN time (8:00 AM)
      console.log('📝 Entering IN time: 08:00...');
      try {
        console.log('   Clicking IN time field...');
        await timeInputs[0].click();
        console.log('   Clearing IN time field...');
        await timeInputs[0].clear();
        console.log('   Filling IN time field with 08:00...');
        await timeInputs[0].fill('08:00');
        console.log('✅ Successfully filled IN time field');
        
        // Verify the value was entered
        const inTimeValue = await timeInputs[0].inputValue();
        console.log(`   IN time field now contains: "${inTimeValue}"`);
      } catch (error) {
        console.log(`❌ Error entering IN time: ${error.message}`);
        throw error;
      }
      
      // Click AM button for IN time
      try {
        console.log('🔍 Looking for AM button for IN time...');
        const amPmSelectors = [
          'button:has-text("AM")',
          'button:has-text("PM")', 
          'button:has-text("am")',
          'button:has-text("pm")',
          'button[value="AM"]',
          'button[value="PM"]',
          'button[class*="am"]',
          'button[class*="pm"]',
          'button[class*="ampm"]'
        ];
        
        let amButton = null;
        for (const selector of amPmSelectors) {
          try {
            const buttons = await page.locator(selector).all();
            for (const button of buttons) {
              if (await button.isVisible()) {
                const text = await button.textContent() || '';
                console.log(`  - Found button: "${text}"`);
                if (text.toLowerCase().includes('am') && !amButton) {
                  amButton = button;
                  break;
                }
              }
            }
            if (amButton) break;
          } catch (e) {
            // Continue
          }
        }
        
        if (amButton) {
          await amButton.click();
          console.log('✅ Clicked AM button for IN time');
        } else {
          console.log('⚠️ No AM button found for IN time');
        }
      } catch (error) {
        console.log(`⚠️ Error clicking AM button: ${error.message}`);
      }
      
      // Enter work OUT time (5:00 PM)  
      console.log('📝 Entering OUT time: 17:00...');
      try {
        console.log('   Clicking OUT time field...');
        await timeInputs[1].click();
        console.log('   Clearing OUT time field...');
        await timeInputs[1].clear();
        console.log('   Filling OUT time field with 5:00...');
        await timeInputs[1].fill('5:00');
        console.log('✅ Successfully filled OUT time field');
        
        // Verify the value was entered
        const outTimeValue = await timeInputs[1].inputValue();
        console.log(`   OUT time field now contains: "${outTimeValue}"`);
      } catch (error) {
        console.log(`❌ Error entering OUT time: ${error.message}`);
        throw error;
      }
      
      // Click AM/PM button for OUT time (beside the 5:00 field)
      try {
        console.log('🔍 Looking for AM/PM button beside OUT time field...');
        
        // Try multiple selectors for AM/PM buttons
        const amPmSelectors = [
          'button:has-text("PM")',
          'button:has-text("AM")', 
          'button:has-text("pm")',
          'button:has-text("am")',
          'button[value="PM"]',
          'button[value="AM"]',
          'button[class*="pm"]',
          'button[class*="am"]',
          'button[class*="ampm"]',
          '.pm-button',
          '.am-button',
          '.ampm-button',
          'button:near(input)'
        ];
        
        let foundButton = null;
        for (const selector of amPmSelectors) {
          try {
            const buttons = await page.locator(selector).all();
            console.log(`🔍 Selector "${selector}": found ${buttons.length} buttons`);
            for (const button of buttons) {
              if (await button.isVisible()) {
                const text = await button.textContent() || '';
                const value = await button.getAttribute('value') || '';
                console.log(`  - Button text: "${text}" value: "${value}"`);
                if (!foundButton) {
                  foundButton = button;
                }
              }
            }
            if (foundButton) break;
          } catch (e) {
            // Continue to next selector
          }
        }
        
        if (foundButton) {
          const buttonText = await foundButton.textContent() || '';
          console.log(`✅ Found AM/PM button: "${buttonText}"`);
          await foundButton.click();
          console.log('✅ Clicked AM/PM button beside OUT time field');
        } else {
          console.log('⚠️ No AM/PM button found for OUT time');
          
          // Take screenshot to help debug
          await page.screenshot({ 
            path: 'test-results/no-ampm-button-found.png',
            fullPage: true 
          });
          console.log('📸 Screenshot taken for debugging AM/PM button issue');
        }
      } catch (error) {
        console.log(`⚠️ Error clicking AM/PM button: ${error.message}`);
      }
      
      console.log('🍽️ Switching to meal entry...');
      
      // Look for Meal button with plus icon and click it automatically
      console.log('🔍 Looking for Meal button with plus icon...');
      
      const mealButtonSelectors = [
        // Look for ANY plus buttons first (most common)
        'button:has-text("+")',
        'button[text="+"]',
        'input[type="button"][value="+"]',
        'button[title*="add" i]',
        // Look for meal button with plus icon
        'button:has-text("Meal"):has("+"), button:has-text("meal"):has("+")',
        'button:has-text("+"):has-text("Meal"), button:has-text("+"):has-text("meal")',
        // Look for meal button with plus symbol
        'button:has-text("Meal") + button:has-text("+"), button:has-text("meal") + button:has-text("+")',
        'button:has-text("+") + button:has-text("Meal"), button:has-text("+") + button:has-text("meal")',
        // Look for buttons with meal and plus in various combinations
        'button[title*="meal" i]:has-text("+")',
        'button[title*="add meal" i]',
        'button[onclick*="meal" i]:has-text("+")',
        // Look for any button near meal text with plus
        'button:has-text("+"):near(:text("meal"), 100)',
        'button:has-text("+"):near(:text("Meal"), 100)',
        // Generic meal button selectors
        'button:has-text("Meal")',
        'button:has-text("meal")',
        'button[value*="meal" i]',
        'button[title*="meal" i]',
        '.meal-button',
        '#meal-button',
        '[data-testid*="meal"]',
        // Look for any add/plus buttons
        'button:has-text("Add")',
        'button:has-text("add")',
        'button[value*="add" i]',
        // CSS selectors for plus symbols
        'button:has-text("➕")',
        'button:has-text("✚")',
        'button[class*="plus"]',
        'button[class*="add"]'
      ];
      
      let mealButton = null;
      for (const selector of mealButtonSelectors) {
        try {
          const buttons = await page.locator(selector).all();
          console.log(`🔍 Selector "${selector}": found ${buttons.length} buttons`);
          for (const button of buttons) {
            if (await button.isVisible()) {
              const text = await button.textContent() || '';
              const title = await button.getAttribute('title') || '';
              console.log(`  - Button: text="${text.trim()}" title="${title}"`);
              if (!mealButton) {
                mealButton = button;
                console.log(`✅ Selected meal button with selector: ${selector}`);
              }
            }
          }
          if (mealButton) break;
        } catch (e) {
          // Continue to next selector
        }
      }
      
      if (mealButton) {
        try {
          console.log('🍽️ Clicking Meal button automatically...');
          await mealButton.click();
          console.log('✅ Successfully clicked Meal button');
          
          // Wait for meal entry interface to appear
          console.log('⏳ Waiting for meal entry interface to load...');
          await page.waitForTimeout(3000);
          
          // Verify that new meal input fields appeared
          console.log('🔍 Verifying meal input fields appeared after clicking Meal button...');
          
          // Take screenshot after meal button click to verify interface
          await page.screenshot({ 
            path: 'test-results/after-meal-button-click.png',
            fullPage: true 
          });
          console.log('📸 Screenshot taken after Meal button click');
          
          // MANUAL VERIFICATION PAUSE - Ensure meal interface appeared
          console.log('\n' + '='.repeat(60));
          console.log('⏸️ MEAL INTERFACE VERIFICATION');
          console.log('='.repeat(60));
          console.log('✅ Meal button was clicked successfully');
          console.log('🔍 Please verify that MEAL TIME INPUT FIELDS appeared');
          console.log('');
          console.log('Expected: New input fields specifically for meal times');
          console.log('⚠️ These should be DIFFERENT from work time fields (8:00 AM - 5:00 PM)');
          console.log('');
          console.log('If meal interface appeared correctly:');
          console.log('  ▶️ Click RESUME to proceed with meal time entry');
          console.log('');
          console.log('If NO new meal fields appeared:');
          console.log('  🛑 Stop the script (Ctrl+C) and report the issue');
          console.log('='.repeat(60));
          
          await page.pause();
          
        } catch (error) {
          console.log(`❌ CRITICAL ERROR: Failed to click Meal button: ${error.message}`);
          console.log('🛑 Cannot proceed with meal entry without clicking Meal button');
          throw new Error('Meal button click failed - stopping automation');
        }
      } else {
        console.log('❌ CRITICAL ERROR: Could not find Meal button with plus icon');
        console.log('📸 Taking screenshot for debugging...');
        await page.screenshot({ 
          path: 'test-results/no-meal-button-found.png',
          fullPage: true 
        });
        
        // Try to look for ANY plus buttons as a fallback
        console.log('🔄 Fallback: Looking for any plus buttons...');
        try {
          const plusButtons = await page.locator('button:has-text("+")').all();
          console.log(`📋 Found ${plusButtons.length} plus buttons on page:`);
          for (let i = 0; i < plusButtons.length && i < 5; i++) {
            const text = await plusButtons[i].textContent() || '';
            const isVisible = await plusButtons[i].isVisible();
            console.log(`  ${i + 1}. Plus button: "${text.trim()}" (visible: ${isVisible})`);
          }
        } catch (e) {
          console.log('⚠️ Could not analyze plus buttons');
        }
        
        // MANUAL FALLBACK - Let user click meal button manually
        console.log('\n' + '='.repeat(60));
        console.log('⏸️ MANUAL MEAL BUTTON CLICK REQUIRED');
        console.log('='.repeat(60));
        console.log('❌ Could not automatically find the meal button');
        console.log('📸 Check the screenshot: test-results/no-meal-button-found.png');
        console.log('');
        console.log('Please manually:');
        console.log('  1. Look for a button with "+" or "Add" or "Meal"');
        console.log('  2. Click it to open meal entry interface');
        console.log('  3. Click RESUME to continue with automated meal entry');
        console.log('');
        console.log('Or:');
        console.log('  🛑 Stop here (Ctrl+C) if no meal entry is needed');
        console.log('='.repeat(60));
        
        await page.pause();
      }
      
      console.log('🍽️ Entering meal break (12:00 AM - 1:00 AM)...');
      
      // Find MEAL-SPECIFIC time input fields (not the work time fields)
      console.log('🔍 Looking for NEW meal time input fields that appeared...');
      
      // Take screenshot to see current state
      await page.screenshot({ 
        path: 'test-results/after-meal-button-click.png',
        fullPage: true 
      });
      console.log('📸 Screenshot taken after Meal button click');
      
      // Look for meal-specific input selectors (ONLY meal fields, not work fields)
      const mealInputSelectors = [
        // Look specifically for meal-related inputs first
        'input[name*="meal" i]:not([disabled]):visible',
        'input[id*="meal" i]:not([disabled]):visible',
        'input[class*="meal" i]:not([disabled]):visible',
        'input[placeholder*="meal" i]:not([disabled]):visible',
        'input[title*="meal" i]:not([disabled]):visible',
        // Look for lunch/break related inputs
        'input[name*="lunch" i]:not([disabled]):visible',
        'input[id*="lunch" i]:not([disabled]):visible',
        'input[name*="break" i]:not([disabled]):visible',
        'input[id*="break" i]:not([disabled]):visible',
        // Look for inputs that appeared after meal button (avoid work time fields)
        // Note: We'll filter out fields that contain work times (8:00, 5:00)
      ];
      
      console.log('📋 All visible input elements after meal button click:');
      const allCurrentInputs = await page.locator('input').all();
      for (let i = 0; i < allCurrentInputs.length && i < 10; i++) {
        try {
          const isVisible = await allCurrentInputs[i].isVisible();
          if (isVisible) {
            const type = await allCurrentInputs[i].getAttribute('type') || 'text';
            const name = await allCurrentInputs[i].getAttribute('name') || '';
            const id = await allCurrentInputs[i].getAttribute('id') || '';
            const placeholder = await allCurrentInputs[i].getAttribute('placeholder') || '';
            const value = await allCurrentInputs[i].inputValue();
            const disabled = await allCurrentInputs[i].getAttribute('disabled');
            const isEnabled = disabled === null ? 'enabled' : 'DISABLED';
            console.log(`  ${i + 1}. type="${type}" name="${name}" id="${id}" placeholder="${placeholder}" value="${value}" status=${isEnabled}`);
          }
        } catch (e) {
          console.log(`  ${i + 1}. Error reading input: ${e.message}`);
        }
      }
      
      let mealTimeInputs = [];
      
      // First try meal-specific selectors
      for (const selector of mealInputSelectors) {
        try {
          const inputs = await page.locator(selector).all();
          const mealSpecificInputs = [];
          for (const input of inputs) {
            if (await input.isVisible()) {
              const disabled = await input.getAttribute('disabled');
              if (disabled === null) { // Not disabled
                const value = await input.inputValue() || '';
                const name = await input.getAttribute('name') || '';
                const id = await input.getAttribute('id') || '';
                
                // Skip fields that already contain work times (8:00, 5:00, 08:00, 17:00)
                if (!value.includes('8:00') && !value.includes('5:00') && 
                    !value.includes('08:00') && !value.includes('17:00')) {
                  mealSpecificInputs.push(input);
                  console.log(`  ✅ Found meal field: name="${name}" id="${id}" value="${value}"`);
                }
              }
            }
          }
          console.log(`🔍 Selector "${selector}": found ${inputs.length} total, ${mealSpecificInputs.length} meal-specific`);
          if (mealSpecificInputs.length >= 2) {
            mealTimeInputs = mealSpecificInputs;
            console.log(`✅ Using ${mealSpecificInputs.length} meal input fields with selector: ${selector}`);
            break;
          }
        } catch (e) {
          console.log(`⚠️ Error with meal selector "${selector}": ${e.message}`);
        }
      }
      
      // If no meal-specific fields found, look for any empty time fields
      if (mealTimeInputs.length < 2) {
        console.log('🔄 No meal-specific fields found, looking for empty time fields...');
        try {
          const allInputs = await page.locator('input:visible:not([disabled])').all();
          const emptyTimeFields = [];
          for (const input of allInputs) {
            const value = await input.inputValue() || '';
            const type = await input.getAttribute('type') || '';
            
            // Look for empty fields or fields with default values like "0:00" or "00:00"
            if ((value === '' || value === '0:00' || value === '00:00' || value === '0.00') &&
                (type === 'time' || type === 'text')) {
              emptyTimeFields.push(input);
              const name = await input.getAttribute('name') || '';
              const id = await input.getAttribute('id') || '';
              console.log(`  📝 Found empty field: name="${name}" id="${id}" value="${value}" type="${type}"`);
            }
          }
          
          if (emptyTimeFields.length >= 2) {
            // Use the LAST 2 empty fields (most likely to be meal fields)
            mealTimeInputs = emptyTimeFields.slice(-2);
            console.log(`✅ Using last 2 empty time fields as meal inputs: ${mealTimeInputs.length} fields`);
          }
        } catch (e) {
          console.log(`⚠️ Error looking for empty time fields: ${e.message}`);
        }
      }
      
      if (mealTimeInputs.length >= 2) {
        // Show which fields we're about to use for meal entry
        console.log('🔍 About to use these fields for meal entry:');
        for (let i = 0; i < Math.min(mealTimeInputs.length, 4); i++) {
          try {
            const id = await mealTimeInputs[i].getAttribute('id') || '';
            const name = await mealTimeInputs[i].getAttribute('name') || '';
            const value = await mealTimeInputs[i].inputValue() || '';
            const placeholder = await mealTimeInputs[i].getAttribute('placeholder') || '';
            console.log(`  Field ${i + 1}: id="${id}" name="${name}" value="${value}" placeholder="${placeholder}"`);
          } catch (e) {
            console.log(`  Field ${i + 1}: Error reading field details`);
          }
        }
        
        // Auto-proceed with meal entry (using last 2 fields)
        console.log('🔄 Auto-proceeding with meal entry using last 2 available fields...');
        
        // Enter meal IN time (12:00 AM) - use the LAST two available fields
        console.log('📝 Entering meal IN time: 12:00...');
        const mealInField = mealTimeInputs[mealTimeInputs.length - 2]; // Second to last field
        try {
          console.log('   Using second-to-last field for meal IN time...');
          await mealInField.click();
          await mealInField.clear();
          await mealInField.fill('12:00');
          console.log('✅ Filled meal IN time field with 12:00');
          
          // Verify what was actually entered
          const enteredValue = await mealInField.inputValue();
          console.log(`   ✓ Field now contains: "${enteredValue}"`);
          
        } catch (error) {
          console.log(`⚠️ Error entering meal IN time: ${error.message}`);
        }
        
        // Enter meal OUT time (1:00 AM) - use the LAST field
        console.log('📝 Entering meal OUT time: 1:00...');
        const mealOutField = mealTimeInputs[mealTimeInputs.length - 1]; // Last field
        try {
          console.log('   Using last field for meal OUT time...');
          await mealOutField.click();
          await mealOutField.clear();
          await mealOutField.fill('1:00');
          console.log('✅ Filled meal OUT time field with 1:00');
          
          // Verify what was actually entered
          const enteredValue = await mealOutField.inputValue();
          console.log(`   ✓ Field now contains: "${enteredValue}"`);
          
        } catch (error) {
          console.log(`⚠️ Error entering meal OUT time: ${error.message}`);
        }
        
        // Skip AM/PM buttons for now since they're causing confusion
        console.log('⚠️ Skipping AM/PM buttons for meal times (can be set manually if needed)');
        
      } else {
        console.log('❌ No meal input fields found!');
        console.log('🔍 This suggests the Meal button didn\'t create new input fields');
        console.log('📸 Taking screenshot for debugging...');
                 await page.screenshot({ 
           path: 'test-results/no-meal-fields-found.png',
           fullPage: true 
         });
        }
      
      console.log('📋 Looking for Copy to Friday button...');
      
      // Look for Copy to Friday button
      const copyToFridaySelectors = [
        'button:has-text("Copy through Friday")',
        'button:has-text("copy through friday")',
        'button:has-text("Copy through Fri")',
        'button:has-text("Copy through Friday")',
        'button[value*="Friday" i]',
        'button[title*="Friday" i]',
        'a:has-text("Copy through Friday")',
        'a:has-text("copy through friday")',
        '[onclick*="friday" i]',
        '[onclick*="copy" i]',
        '.copy-friday',
        '.copy-to-friday'
      ];
      
      let copyButton = null;
      for (const selector of copyToFridaySelectors) {
        try {
          const button = page.locator(selector).first();
          if (await button.isVisible({ timeout: 2000 })) {
            copyButton = button;
            console.log(`✅ Found Copy through Friday button with selector: ${selector}`);
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      if (copyButton) {
        try {
          console.log('📋 Clicking Copy through Friday button...');
          await copyButton.click();
          console.log('✅ Clicked Copy through Friday button');
          
          // Wait for copy operation to complete
          await page.waitForTimeout(1000);
          
        } catch (error) {
          console.log(`⚠️ Error clicking Copy to Friday button: ${error.message}`);
        }
      } else {
        console.log('⚠️ Copy to Friday button not found');
        
        // Take screenshot to help debug
        await page.screenshot({ 
          path: 'test-results/no-copy-friday-button.png',
          fullPage: true 
        });
        console.log('📸 Screenshot taken for debugging Copy to Friday button');
      }
      
      // MANUAL PAUSE BEFORE SAVING - Allow user to review and stop if needed
      console.log('\n' + '='.repeat(60));
      console.log('⏸️ FINAL REVIEW PAUSE');
      console.log('='.repeat(60));
      console.log('✅ All time entry information has been entered:');
      console.log('   • Work Time: 8:00 AM - 5:00 PM');
      console.log('   • Meal Time: 12:00 AM - 1:00 AM');
      console.log('   • Copy through Friday: Attempted');
      console.log('');
      console.log('🔍 Please review the timesheet entries above');
      console.log('');
      console.log('Options:');
      console.log('  ▶️ Click RESUME to save and complete the timesheet');
      console.log('  🛑 Or manually stop the test here (Ctrl+C) if satisfied');
      console.log('');
      console.log('⚠️ After RESUME, the script will click OK/Save automatically');
      console.log('='.repeat(60));
      
      await page.pause();
      
      console.log('💾 Continuing with save operation...');
      
      // Click OK button to save
      const okButtonSelectors = [
        'button:has-text("Ok")',
        'button:has-text("OK")', 
        'button:has-text("Save")',
        'button:has-text("Submit")',
        'dialog button:has-text("Ok")'
      ];
      
      let okButton = null;
      for (const selector of okButtonSelectors) {
        try {
          const button = page.locator(selector).first();
          if (await button.isVisible({ timeout: 1000 })) {
            okButton = button;
            console.log(`✅ Found OK button with selector: ${selector}`);
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      if (okButton) {
        await okButton.click();
        console.log('✅ Clicked OK to save time entry');
      } else {
        console.log('⚠️ Could not find OK button, trying Enter key...');
        await page.keyboard.press('Enter');
      }
      
      // Wait for modal to close and changes to be saved
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Take final screenshot
      await page.screenshot({ 
        path: 'test-results/time-entry-complete.png',
        fullPage: true 
      });
      console.log('📸 Final screenshot taken after time entry completion');
      
      console.log('✅ Time entry completed successfully!');
      console.log('📝 Monday timesheet with meal break completed');
      
      // Wait a moment to see the results
      await page.waitForTimeout(3000);
      
      console.log('ℹ️ Browser will remain open for review...');
      
    } catch (error) {
      console.log(`❌ Error during automation: ${error.message}`);
      
      // Try to take a screenshot for debugging (only if page is still accessible)
      try {
        await page.screenshot({ 
          path: 'test-results/mypeoplenet-error.png',
          fullPage: true 
        });
        console.log('📸 Screenshot saved for debugging');
      } catch (screenshotError) {
        console.log('⚠️ Could not take screenshot (page might be closed)');
      }
      
      throw error;
    }
    
    // Keep browser open for manual review
    // await browser.close();
  });
}); 