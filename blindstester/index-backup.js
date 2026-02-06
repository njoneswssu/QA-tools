import { chromium } from 'playwright';
import chalk from 'chalk';

async function testWithColorSwatch() {
  console.log(chalk.bold.blue('\n🧪 Testing 3% Catalina @ 112" x 142" (WITH COLOR SWATCH)\n'));
  
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
    console.log(chalk.cyan('\n🎨 Looking for color swatches...'));
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(1500);
    
    // Find color swatch images and click on them
    const colorImages = await page.$$('img[alt*="Solapur"], img[alt*="Catalina"], img[alt*="Newport"]');
    
    console.log(chalk.cyan(`Found ${colorImages.length} color swatch images`));
    
    let colorSelected = false;
    if (colorImages.length > 0) {
      const firstColorImg = colorImages[0];
      const altText = await firstColorImg.getAttribute('alt');
      
      console.log(chalk.cyan(`  Attempting to click color: ${altText}`));
      
      // Click on the parent div
      await firstColorImg.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      
      // Try clicking the image or its parent div
      try {
        await firstColorImg.click();
        console.log(chalk.cyan('  Clicked on image element'));
      } catch (e) {
        // If clicking the img fails, try clicking the parent div
        console.log(chalk.yellow('  Image click failed, trying parent div...'));
        const parentDiv = await firstColorImg.evaluateHandle(el => el.parentElement);
        await parentDiv.asElement().click();
        console.log(chalk.cyan('  Clicked on parent div'));
      }
      
      await page.waitForTimeout(3000);
      
      // Verify color was selected by checking if anything changed
      // Check if the "Review Your Selections" shows a color
      const bodyText = await page.textContent('body');
      const hasColorInReview = bodyText.includes('Color:') && bodyText.toLowerCase().includes('solapur');
      
      if (hasColorInReview) {
        console.log(chalk.green(`✓ Color CONFIRMED selected: ${altText}`));
        console.log(chalk.green(`  ✓ Color appears in "Review Your Selections"`));
        colorSelected = true;
      } else {
        console.log(chalk.yellow(`⚠️  Color clicked but not confirmed in review section`));
        console.log(chalk.yellow(`  Color name: ${altText}`));
        colorSelected = false;
      }
    }
    
    if (!colorSelected) {
      console.log(chalk.red('❌ COLOR NOT SELECTED - Results may not be accurate!'));
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
    console.log(chalk.yellow('     Please verify that a color was selected and check the headrail options.'));
    await page.waitForTimeout(90000);
    
  } catch (error) {
    console.log(chalk.red(`\n❌ Error: ${error.message}`));
    console.log(chalk.red(error.stack));
  } finally {
    await browser.close();
  }
}

testWithColorSwatch();
