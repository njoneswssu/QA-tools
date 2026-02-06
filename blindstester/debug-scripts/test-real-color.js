import { chromium } from 'playwright';
import chalk from 'chalk';

async function testWithRealColor() {
  console.log(chalk.bold.blue('\n🧪 Testing 3% Catalina @ 112" x 142" (WITH REAL COLOR)\n'));
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Navigate
    console.log(chalk.cyan('📍 Navigating to configurator...'));
    await page.goto('https://www.homedepot.com/custom-blinds/Configurator/Draft?draftProductId=722389', { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    await page.waitForTimeout(3000);
    console.log(chalk.green('✓ Page loaded'));
    
    // Select Inside Mount
    console.log(chalk.cyan('\n📌 Selecting Inside Mount...'));
    const buttons = await page.$$('button');
    for (const button of buttons) {
      const text = await button.textContent();
      const visible = await button.isVisible();
      if (visible && text && text.trim() === 'Inside Mount') {
        await button.scrollIntoViewIfNeeded();
        await button.click();
        await page.waitForTimeout(2000);
        console.log(chalk.green('✓ Selected Inside Mount'));
        break;
      }
    }
    
    // Enter dimensions
    console.log(chalk.cyan('\n📏 Entering dimensions: 112" x 142"...'));
    await page.waitForTimeout(2000);
    
    const widthSelect = await page.waitForSelector('#Width-Inches', { timeout: 10000 });
    await widthSelect.selectOption('112');
    console.log(chalk.green('✓ Selected width: 112"'));
    await page.waitForTimeout(1000);
    
    const heightSelect = await page.waitForSelector('#Height-Inches', { timeout: 10000 });
    await heightSelect.selectOption('142');
    console.log(chalk.green('✓ Selected height: 142"'));
    await page.waitForTimeout(2000);
    
    // Scroll down to find color swatches
    console.log(chalk.cyan('\n🎨 Looking for color options...'));
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(1500);
    
    // Look for color swatch buttons - they might have specific attributes
    // Try different selectors that might identify color swatches
    let colorSelected = false;
    
    // Try 1: Look for buttons with aria-label containing "color" or specific color names
    const allButtons = await page.$$('button');
    for (const button of allButtons) {
      const ariaLabel = await button.getAttribute('aria-label');
      const text = await button.textContent();
      const visible = await button.isVisible();
      
      // Look for buttons that might be color swatches
      // They often have short codes or are in a specific section
      if (visible && ariaLabel && (
          ariaLabel.toLowerCase().includes('color') ||
          ariaLabel.toLowerCase().includes('shade') ||
          ariaLabel.toLowerCase().includes('fabric')
      )) {
        await button.scrollIntoViewIfNeeded();
        await button.click();
        await page.waitForTimeout(2000);
        console.log(chalk.green(`✓ Selected color: ${ariaLabel.substring(0, 40)}`));
        colorSelected = true;
        break;
      }
      
      // Also look for buttons with very short text (like "LS0", "LS1", etc - typical color codes)
      if (visible && text && text.trim().length >= 2 && text.trim().length <= 4 && 
          /^[A-Z0-9]+$/.test(text.trim()) && 
          !text.includes('DIY') && 
          !text.includes('Inside') && 
          !text.includes('Outside')) {
        await button.scrollIntoViewIfNeeded();
        await button.click();
        await page.waitForTimeout(2000);
        console.log(chalk.green(`✓ Selected color: ${text.trim()}`));
        colorSelected = true;
        break;
      }
    }
    
    if (!colorSelected) {
      // Try another approach - look for elements in a color grid/list
      console.log(chalk.yellow('  Trying alternative color selection method...'));
      
      // Look for clickable divs or spans that might be color swatches
      const clickables = await page.$$('div[role="button"], span[role="button"], [class*="color"], [class*="swatch"]');
      for (const elem of clickables) {
        const visible = await elem.isVisible();
        if (visible) {
          await elem.scrollIntoViewIfNeeded();
          await elem.click();
          await page.waitForTimeout(2000);
          console.log(chalk.green(`✓ Clicked on color element`));
          colorSelected = true;
          break;
        }
      }
    }
    
    if (!colorSelected) {
      console.log(chalk.yellow('⚠️  Could not find color option, continuing anyway...'));
    }
    
    // Wait for page to fully validate after color selection
    console.log(chalk.yellow('\n⏳ Waiting 5 seconds for page to validate...'));
    await page.waitForTimeout(5000);
    
    // Scroll to headrail section
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(1000);
    
    // Check for headrail options
    console.log(chalk.cyan('\n🔍 Checking for headrail options...'));
    const headrailButtons = await page.$$('button');
    
    let singleButton = null;
    let twoOn1Button = null;
    
    for (const button of headrailButtons) {
      const text = await button.textContent();
      const visible = await button.isVisible();
      
      if (visible && text) {
        const trimmedText = text.trim();
        const normalizedText = trimmedText.toLowerCase();
        
        // Check for Single
        if (normalizedText === 'single') {
          const isDisabled = await button.isDisabled();
          const opacity = await button.evaluate(el => window.getComputedStyle(el).opacity);
          const pointerEvents = await button.evaluate(el => window.getComputedStyle(el).pointerEvents);
          const display = await button.evaluate(el => window.getComputedStyle(el).display);
          const visibility = await button.evaluate(el => window.getComputedStyle(el).visibility);
          const isClickable = !isDisabled && opacity !== '0' && pointerEvents !== 'none' && display !== 'none' && visibility !== 'hidden';
          
          console.log(chalk.blue(`  Found "Single" button:`));
          console.log(chalk.gray(`    Disabled: ${isDisabled}`));
          console.log(chalk.gray(`    Opacity: ${opacity}`));
          console.log(chalk.gray(`    Visibility: ${visibility}`));
          console.log(chalk.gray(`    Clickable: ${isClickable}`));
          
          if (isClickable) {
            singleButton = button;
          }
        }
        
        // Check for 2 on 1
        if (normalizedText.includes('2 on 1') || normalizedText.includes('2on1')) {
          const isDisabled = await button.isDisabled();
          const opacity = await button.evaluate(el => window.getComputedStyle(el).opacity);
          const isClickable = !isDisabled && opacity !== '0';
          
          console.log(chalk.blue(`  Found "2 on 1 Headrail" button - Clickable: ${isClickable}`));
          
          if (isClickable) {
            twoOn1Button = button;
          }
        }
      }
    }
    
    console.log(chalk.bold.cyan('\n📊 Summary:'));
    if (singleButton && twoOn1Button) {
      console.log(chalk.red('  🐛 BUG: Both "Single" and "2 on 1" are available'));
      console.log(chalk.red('      (Single should be blocked at 142" height, max is 132")'));
    } else if (singleButton && !twoOn1Button) {
      console.log(chalk.red('  🐛 Only "Single" is available'));
    } else if (!singleButton && twoOn1Button) {
      console.log(chalk.green('  ✅ PASS: Only "2 on 1" is available (Single properly blocked)'));
    } else {
      console.log(chalk.yellow('  ⚠️  No headrail options found'));
    }
    
    // Keep browser open for manual inspection
    console.log(chalk.yellow('\n⏸️  Browser will stay open for 90 seconds for manual inspection...'));
    console.log(chalk.yellow('     Please check if a color was selected and verify the headrail options.'));
    await page.waitForTimeout(90000);
    
  } catch (error) {
    console.log(chalk.red(`\n❌ Error: ${error.message}`));
  } finally {
    await browser.close();
  }
}

testWithRealColor();
