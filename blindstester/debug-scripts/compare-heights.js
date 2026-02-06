import { chromium } from 'playwright';
import chalk from 'chalk';

async function compareHeights() {
  console.log(chalk.bold.blue('\n🔍 Comparing headrail options at different heights\n'));
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const heights = [97, 106, 133];
  
  for (const height of heights) {
    console.log(chalk.bold.yellow(`\n${'='.repeat(60)}`));
    console.log(chalk.bold.yellow(`Testing at 112" x ${height}"`));
    console.log(chalk.bold.yellow('='.repeat(60)));
    
    try {
      // Navigate
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
      await heightSelect.selectOption(height.toString());
      console.log(chalk.green(`✓ Selected 112" x ${height}"`));
      
      // Wait for page to update
      await page.waitForTimeout(3000);
      
      // Scroll to headrail section
      await page.evaluate(() => window.scrollBy(0, 400));
      await page.waitForTimeout(1000);
      
      // Check for headrail options
      const allButtons = await page.$$('button');
      let singleFound = false;
      let twoOn1Found = false;
      
      console.log(chalk.cyan('\nHeadrail-related buttons found:'));
      
      for (const button of allButtons) {
        const text = await button.textContent();
        const visible = await button.isVisible();
        
        if (visible && text) {
          const trimmedText = text.trim();
          const normalizedText = trimmedText.toLowerCase();
          
          // Check if this is a headrail button
          if (normalizedText === 'single' || 
              normalizedText.includes('2 on 1') || 
              normalizedText.includes('headrail')) {
            
            const isDisabled = await button.isDisabled();
            const opacity = await button.evaluate(el => window.getComputedStyle(el).opacity);
            const isClickable = !isDisabled && opacity !== '0';
            
            console.log(chalk.white(`  • "${trimmedText.substring(0, 40)}" - Clickable: ${isClickable}`));
            
            if (normalizedText === 'single' && isClickable) {
              singleFound = true;
            }
            if ((normalizedText.includes('2 on 1') || normalizedText.includes('2on1')) && isClickable) {
              twoOn1Found = true;
            }
          }
        }
      }
      
      console.log(chalk.bold.cyan('\nSummary:'));
      if (singleFound && twoOn1Found) {
        console.log(chalk.red('  ✗ Both "Single" and "2 on 1" are available'));
      } else if (singleFound && !twoOn1Found) {
        console.log(chalk.blue('  • Only "Single" is available'));
      } else if (!singleFound && twoOn1Found) {
        console.log(chalk.green('  ✓ Only "2 on 1" is available (Single properly blocked)'));
      } else {
        console.log(chalk.yellow('  ? No headrail options found'));
      }
      
    } catch (error) {
      console.log(chalk.red(`❌ Error: ${error.message}`));
    }
  }
  
  console.log(chalk.yellow('\n⏸️  Browser staying open for 30 seconds...'));
  await page.waitForTimeout(30000);
  await browser.close();
}

compareHeights();
