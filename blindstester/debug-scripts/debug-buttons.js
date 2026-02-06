import { chromium } from 'playwright';
import chalk from 'chalk';

async function debugButtons() {
  console.log(chalk.bold.blue('\n🔍 Debugging button texts at 112" x 133"\n'));
  
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
    
    // Select Inside Mount
    const buttons1 = await page.$$('button');
    for (const button of buttons1) {
      const text = await button.textContent();
      const visible = await button.isVisible();
      if (visible && text && text.trim() === 'Inside Mount') {
        await button.scrollIntoViewIfNeeded();
        await button.click();
        await page.waitForTimeout(2000);
        break;
      }
    }
    
    // Enter dimensions
    await page.waitForTimeout(2000);
    const widthSelect = await page.waitForSelector('#Width-Inches', { timeout: 10000 });
    await widthSelect.selectOption('112');
    await page.waitForTimeout(1000);
    
    const heightSelect = await page.waitForSelector('#Height-Inches', { timeout: 10000 });
    await heightSelect.selectOption('133');
    console.log(chalk.green('✓ Selected 112" x 133"'));
    
    // Wait longer for the page to update
    console.log(chalk.yellow('\n⏳ Waiting 5 seconds for page to fully update...'));
    await page.waitForTimeout(5000);
    
    // Scroll to where headrail options should be
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(1000);
    
    // Now check ALL buttons and their text
    console.log(chalk.cyan('\n📋 ALL visible button texts:\n'));
    const allButtons = await page.$$('button');
    let index = 0;
    let singleCount = 0;
    let twoOn1Count = 0;
    
    for (const button of allButtons) {
      const text = await button.textContent();
      const visible = await button.isVisible();
      
      if (visible && text && text.trim()) {
        const trimmedText = text.trim();
        const firstLine = trimmedText.split('\n')[0].substring(0, 50);
        
        // Check if this looks like a headrail option
        if (trimmedText.toLowerCase().includes('single') || 
            trimmedText.toLowerCase().includes('on 1') ||
            trimmedText.toLowerCase().includes('headrail')) {
          
          const isDisabled = await button.isDisabled();
          const opacity = await button.evaluate(el => window.getComputedStyle(el).opacity);
          const isClickable = !isDisabled && opacity !== '0';
          
          console.log(chalk.blue(`  [${index}] "${firstLine}"`));
          console.log(chalk.gray(`       Clickable: ${isClickable}, Disabled: ${isDisabled}, Opacity: ${opacity}`));
          
          // Count
          if (trimmedText.toLowerCase() === 'single') {
            singleCount++;
          }
          if (trimmedText.toLowerCase().includes('2') && trimmedText.toLowerCase().includes('on') && trimmedText.toLowerCase().includes('1')) {
            twoOn1Count++;
          }
        }
        
        index++;
      }
    }
    
    console.log(chalk.yellow(`\n📊 Summary:`));
    console.log(chalk.white(`   "Single" buttons found: ${singleCount}`));
    console.log(chalk.white(`   "2 on 1" buttons found: ${twoOn1Count}`));
    
    // Keep browser open
    console.log(chalk.yellow('\n⏸️  Browser staying open for 60 seconds - please manually check what you see...'));
    await page.waitForTimeout(60000);
    
  } catch (error) {
    console.log(chalk.red(`\n❌ Error: ${error.message}`));
  } finally {
    await browser.close();
  }
}

debugButtons();
