import { chromium } from 'playwright';
import chalk from 'chalk';

async function inspectColorSwatches() {
  console.log(chalk.bold.blue('\n🔍 Inspecting page to find color swatches\n'));
  
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
    await heightSelect.selectOption('142');
    await page.waitForTimeout(3000);
    
    console.log(chalk.cyan('Scrolling to find color section...'));
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(2000);
    
    // Look for text that says "Color" to find the section
    console.log(chalk.cyan('\n📋 Searching for color-related elements...\n'));
    
    const bodyText = await page.textContent('body');
    if (bodyText.includes('Color:') || bodyText.includes('color')) {
      console.log(chalk.green('✓ Found "Color" text on page'));
    }
    
    // Try to find all clickable elements that might be color swatches
    const allElements = await page.$$('button, div[role="button"], span[role="button"], [class*="swatch"], [class*="color"]');
    
    console.log(chalk.cyan(`Found ${allElements.length} potential clickable elements\n`));
    
    let colorIndex = 0;
    for (const elem of allElements) {
      const tagName = await elem.evaluate(el => el.tagName.toLowerCase());
      const text = await elem.textContent();
      const className = await elem.getAttribute('class');
      const ariaLabel = await elem.getAttribute('aria-label');
      const visible = await elem.isVisible();
      
      // Only show elements that might be colors (avoid showing all buttons)
      if (visible && (
        (className && (className.includes('swatch') || className.includes('color'))) ||
        (ariaLabel && (ariaLabel.includes('color') || ariaLabel.includes('Color'))) ||
        (text && text.trim().length <= 6 && /^[A-Z0-9]+$/.test(text.trim()))
      )) {
        console.log(chalk.blue(`[${colorIndex}] ${tagName.toUpperCase()}`));
        console.log(chalk.gray(`    Text: "${text?.trim().substring(0, 40)}"`));
        console.log(chalk.gray(`    Class: ${className?.substring(0, 60) || 'none'}`));
        console.log(chalk.gray(`    Aria-label: ${ariaLabel || 'none'}`));
        console.log('');
        colorIndex++;
        
        if (colorIndex >= 20) break; // Limit output
      }
    }
    
    if (colorIndex === 0) {
      console.log(chalk.yellow('No obvious color swatches found. Showing ALL visible buttons:\n'));
      
      const allButtons = await page.$$('button');
      let btnIndex = 0;
      for (const btn of allButtons) {
        const text = await btn.textContent();
        const visible = await btn.isVisible();
        const className = await btn.getAttribute('class');
        
        if (visible) {
          const firstLine = text?.split('\n')[0].trim().substring(0, 50);
          console.log(chalk.white(`[${btnIndex}] "${firstLine}"`));
          console.log(chalk.gray(`    Class: ${className?.substring(0, 80) || 'none'}`));
          btnIndex++;
          
          if (btnIndex >= 30) break;
        }
      }
    }
    
    console.log(chalk.yellow('\n⏸️  Browser staying open for 2 minutes...'));
    console.log(chalk.yellow('     Please manually select a color and check the page structure.'));
    await page.waitForTimeout(120000);
    
  } catch (error) {
    console.log(chalk.red(`\n❌ Error: ${error.message}`));
  } finally {
    await browser.close();
  }
}

inspectColorSwatches();
