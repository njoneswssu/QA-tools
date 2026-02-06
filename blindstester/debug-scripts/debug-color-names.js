import { chromium } from 'playwright';
import chalk from 'chalk';

async function debugColorNames() {
  console.log(chalk.bold.blue('\n🔍 Debugging color swatch alt texts\n'));
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    await page.goto('https://www.homedepot.com/custom-blinds/Configurator/Draft?draftProductId=722389', { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    await page.waitForTimeout(3000);
    
    // Select Inside Mount
    const buttons = await page.$$('button');
    for (const button of buttons) {
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
    await page.waitForTimeout(2000);
    
    // Scroll to colors
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(1500);
    
    console.log(chalk.cyan('Getting all color swatch image alt texts:\n'));
    
    const allImages = await page.$$('img[alt]');
    let colorCount = 0;
    
    for (const img of allImages) {
      const altText = await img.getAttribute('alt');
      
      // Filter to only show what looks like color swatches (containing product names)
      if (altText && (
        altText.includes('Catalina') || 
        altText.includes('Solapur') || 
        altText.includes('Newport') ||
        altText.includes('Malibu') ||
        altText.includes('Acadia') ||
        altText.includes('Barcelona')
      )) {
        console.log(chalk.white(`[${colorCount}] ${altText}`));
        colorCount++;
        
        if (colorCount >= 50) {
          console.log(chalk.yellow('\n... (showing first 50 colors only)\n'));
          break;
        }
      }
    }
    
    console.log(chalk.cyan(`\nTotal color swatches found: ${colorCount}`));
    
    console.log(chalk.yellow('\n⏸️  Browser staying open for 60 seconds...'));
    await page.waitForTimeout(60000);
    
  } catch (error) {
    console.log(chalk.red(`\n❌ Error: ${error.message}`));
  } finally {
    await browser.close();
  }
}

debugColorNames();
