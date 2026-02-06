import { chromium } from 'playwright';
import chalk from 'chalk';

async function testWithColor() {
  console.log(chalk.bold.blue('\n🧪 Testing 3% Catalina @ 112" x 142" (WITH COLOR)\n'));
  
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
    
    // Select a color
    console.log(chalk.cyan('\n🎨 Selecting color...'));
    await page.evaluate(() => window.scrollBy(0, 200));
    await page.waitForTimeout(1000);
    
    const allButtons = await page.$$('button');
    let colorSelected = false;
    
    for (const button of allButtons) {
      const text = await button.textContent();
      const visible = await button.isVisible();
      
      if (visible && text && (text.includes('LS0') || text.includes('White') || text.trim().match(/^[A-Z0-9]{2,4}$/))) {
        await button.scrollIntoViewIfNeeded();
        await button.click();
        await page.waitForTimeout(2000);
        console.log(chalk.green(`✓ Selected color: ${text.trim().substring(0, 20)}`));
        colorSelected = true;
        break;
      }
    }
    
    if (!colorSelected) {
      console.log(chalk.yellow('⚠️  Could not find color button, continuing...'));
    }
    
    // Wait for page to fully validate after color selection
    console.log(chalk.yellow('\n⏳ Waiting 5 seconds for page to validate after color selection...'));
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
          console.log(chalk.gray(`    Pointer Events: ${pointerEvents}`));
          console.log(chalk.gray(`    Display: ${display}`));
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
    console.log(chalk.yellow('\n⏸️  Browser will stay open for 60 seconds for manual inspection...'));
    console.log(chalk.yellow('     Please verify what you see matches what the tool found.'));
    await page.waitForTimeout(60000);
    
  } catch (error) {
    console.log(chalk.red(`\n❌ Error: ${error.message}`));
  } finally {
    await browser.close();
  }
}

testWithColor();
