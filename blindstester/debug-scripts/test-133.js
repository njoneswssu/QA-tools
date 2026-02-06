import { chromium } from 'playwright';
import chalk from 'chalk';

async function testSpecificConfiguration() {
  console.log(chalk.bold.blue('\n🧪 Testing 1% Catalina @ 112" x 133"\n'));
  
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
    console.log(chalk.cyan('\n📏 Entering dimensions: 112" x 133"...'));
    await page.waitForTimeout(2000);
    
    const widthSelect = await page.waitForSelector('#Width-Inches', { timeout: 10000 });
    await widthSelect.selectOption('112');
    console.log(chalk.green('✓ Selected width: 112"'));
    await page.waitForTimeout(1000);
    
    const heightSelect = await page.waitForSelector('#Height-Inches', { timeout: 10000 });
    await heightSelect.selectOption('133');
    console.log(chalk.green('✓ Selected height: 133"'));
    await page.waitForTimeout(2000);
    
    // Check for Single headrail
    console.log(chalk.cyan('\n🔍 Checking for headrail options...'));
    const allButtons = await page.$$('button');
    
    let foundSingle = false;
    let foundTwoOn1 = false;
    
    for (const button of allButtons) {
      const text = await button.textContent();
      const visible = await button.isVisible();
      
      if (visible && text) {
        const trimmedText = text.trim();
        const normalizedText = trimmedText.toLowerCase();
        
        // Check for Single (exact match, no "on")
        if (normalizedText === 'single' && !normalizedText.includes('on')) {
          const isDisabled = await button.isDisabled();
          const opacity = await button.evaluate(el => window.getComputedStyle(el).opacity);
          const pointerEvents = await button.evaluate(el => window.getComputedStyle(el).pointerEvents);
          const isClickable = !isDisabled && opacity !== '0' && pointerEvents !== 'none';
          
          foundSingle = true;
          console.log(chalk.blue(`  Found "Single" button - Clickable: ${isClickable}`));
          console.log(chalk.gray(`    disabled: ${isDisabled}, opacity: ${opacity}, pointerEvents: ${pointerEvents}`));
        }
        
        // Check for 2 on 1
        if (normalizedText.includes('2') && normalizedText.includes('on') && normalizedText.includes('1')) {
          const isDisabled = await button.isDisabled();
          const opacity = await button.evaluate(el => window.getComputedStyle(el).opacity);
          const pointerEvents = await button.evaluate(el => window.getComputedStyle(el).pointerEvents);
          const isClickable = !isDisabled && opacity !== '0' && pointerEvents !== 'none';
          
          foundTwoOn1 = true;
          console.log(chalk.blue(`  Found "2 on 1" button - Clickable: ${isClickable}`));
          console.log(chalk.gray(`    disabled: ${isDisabled}, opacity: ${opacity}, pointerEvents: ${pointerEvents}`));
        }
      }
    }
    
    if (!foundSingle && !foundTwoOn1) {
      console.log(chalk.yellow('  ⚠️  No headrail options found!'));
    } else if (!foundSingle && foundTwoOn1) {
      console.log(chalk.red('\n❌ Single headrail NOT available (only "2 on 1" available)'));
      console.log(chalk.green('✓ This is the expected behavior - configuration should be blocked'));
    } else if (foundSingle) {
      console.log(chalk.red('\n🐛 BUG: Single headrail IS available at 133" (max is 96")'));
    }
    
    // Keep browser open for manual inspection
    console.log(chalk.yellow('\n⏸️  Browser will stay open for 30 seconds for inspection...'));
    await page.waitForTimeout(30000);
    
  } catch (error) {
    console.log(chalk.red(`\n❌ Error: ${error.message}`));
  } finally {
    await browser.close();
  }
}

testSpecificConfiguration();
