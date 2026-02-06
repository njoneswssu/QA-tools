import { chromium } from 'playwright';
import chalk from 'chalk';

// Simple test to verify the selectors work
async function quickTest() {
  console.log(chalk.blue('🚀 Starting quick test...'));
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    // Navigate
    console.log(chalk.blue('📍 Navigating to configurator...'));
    await page.goto('https://www.homedepot.com/custom-blinds/Configurator/Draft?draftProductId=722389', { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    await page.waitForTimeout(5000);
    
    // Select Inside Mount
    console.log(chalk.cyan('📌 Selecting Inside Mount...'));
    const buttons = await page.$$('button');
    for (const button of buttons) {
      const text = await button.textContent();
      if (text && text.includes('Inside Mount')) {
        await button.scrollIntoViewIfNeeded();
        await button.click();
        await page.waitForTimeout(2000);
        console.log(chalk.green('✓ Selected Inside Mount'));
        break;
      }
    }
    
    // Wait for page to update
    await page.waitForTimeout(1000);
    
    // Enter dimensions - these are SELECT dropdowns!
    console.log(chalk.cyan('📏 Entering dimensions: 70" x 125"...'));
    
    const widthSelect = await page.$('#Width-Inches');
    if (widthSelect) {
      await widthSelect.selectOption('70');
      console.log(chalk.green('✓ Entered width: 70"'));
      await page.waitForTimeout(500);
    } else {
      console.log(chalk.red('❌ Width select not found'));
    }
    
    const heightSelect = await page.$('#Height-Inches');
    if (heightSelect) {
      await heightSelect.selectOption('125');
      console.log(chalk.green('✓ Entered height: 125"'));
      await page.waitForTimeout(2000);
    } else {
      console.log(chalk.red('❌ Height select not found'));
    }
    
    // Select color
    console.log(chalk.cyan('🎨 Selecting color...'));
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(500);
    
    const buttons2 = await page.$$('button');
    for (const button of buttons2) {
      const text = await button.textContent();
      const visible = await button.isVisible();
      if (visible && text && text.includes('LS0') && !text.includes('Mount')) {
        await button.scrollIntoViewIfNeeded();
        await button.click();
        await page.waitForTimeout(1000);
        console.log(chalk.green(`✓ Selected color: ${text.substring(0, 30)}...`));
        break;
      }
    }
    
    // Select Motorized
    console.log(chalk.cyan('🔧 Selecting Motorized lift...'));
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(500);
    
    const buttons3 = await page.$$('button');
    for (const button of buttons3) {
      const text = await button.textContent();
      const visible = await button.isVisible();
      if (visible && text && text.includes('Motorized') && !text.includes('Rechargeable')) {
        await button.scrollIntoViewIfNeeded();
        await button.click();
        await page.waitForTimeout(1500);
        console.log(chalk.green('✓ Selected Motorized'));
        
        // Select battery
        await page.evaluate(() => window.scrollBy(0, 300));
        await page.waitForTimeout(500);
        
        const buttons4 = await page.$$('button');
        for (const button2 of buttons4) {
          const text2 = await button2.textContent();
          const visible2 = await button2.isVisible();
          if (visible2 && text2 && text2.includes('Rechargeable Battery') && !text2.includes('Solar')) {
            await button2.scrollIntoViewIfNeeded();
            await button2.click();
            await page.waitForTimeout(1000);
            console.log(chalk.green('✓ Selected Rechargeable Battery'));
            break;
          }
        }
        break;
      }
    }
    
    // Check for errors
    console.log(chalk.cyan('🔍 Checking for errors...'));
    const bodyText = await page.textContent('body');
    const hasError = bodyText.toLowerCase().includes('exceed') || 
                     bodyText.toLowerCase().includes('maximum') ||
                     bodyText.toLowerCase().includes('invalid');
    
    if (hasError) {
      console.log(chalk.yellow('⚠️  Found validation error'));
    } else {
      console.log(chalk.green('✓ No validation errors'));
    }
    
    console.log(chalk.green('\n✅ Quick test completed! Keeping browser open for 30 seconds...'));
    await page.waitForTimeout(30000);
    
  } catch (error) {
    console.error(chalk.red(`❌ Error: ${error.message}`));
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

quickTest();
