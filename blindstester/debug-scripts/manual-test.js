import { chromium } from 'playwright';
import chalk from 'chalk';

// Manual test with custom dimensions
const width = process.argv[2] || 70;
const height = process.argv[3] || 125;
const mountType = process.argv[4] || 'inside';

async function manualTest() {
  console.log(chalk.blue(`🚀 Testing configuration: ${width}" x ${height}" (${mountType} mount)`));
  
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
    
    // Select Mount Type
    console.log(chalk.cyan(`📌 Selecting ${mountType} mount...`));
    const buttons = await page.$$('button');
    for (const button of buttons) {
      const text = await button.textContent();
      const searchText = mountType === 'inside' ? 'Inside Mount' : 'Outside Mount';
      if (text && text.includes(searchText)) {
        await button.scrollIntoViewIfNeeded();
        await button.click();
        await page.waitForTimeout(2000);
        console.log(chalk.green(`✓ Selected ${searchText}`));
        break;
      }
    }
    
    // Wait for page to update after mount selection
    await page.waitForTimeout(1000);
    
    // Enter dimensions - these are SELECT dropdowns, not text inputs!
    console.log(chalk.cyan(`📏 Entering dimensions: ${width}" x ${height}"...`));
    
    const widthSelect = await page.$('#Width-Inches');
    if (widthSelect) {
      await widthSelect.selectOption(width.toString());
      console.log(chalk.green(`✓ Entered width: ${width}"`));
      await page.waitForTimeout(500);
    } else {
      console.log(chalk.red(`❌ Width select not found`));
    }
    
    const heightSelect = await page.$('#Height-Inches');
    if (heightSelect) {
      await heightSelect.selectOption(height.toString());
      console.log(chalk.green(`✓ Entered height: ${height}"`));
      await page.waitForTimeout(2000);
    } else {
      console.log(chalk.red(`❌ Height select not found`));
    }
    
    // Check for errors
    console.log(chalk.cyan('🔍 Checking for validation errors...'));
    const bodyText = await page.textContent('body');
    
    const errorKeywords = ['exceed', 'maximum', 'invalid', 'error', 'cannot', 'too large'];
    const foundErrors = [];
    
    for (const keyword of errorKeywords) {
      if (bodyText.toLowerCase().includes(keyword)) {
        const regex = new RegExp(`.{0,50}${keyword}.{0,50}`, 'gi');
        const matches = bodyText.match(regex);
        if (matches) {
          foundErrors.push(...matches);
        }
      }
    }
    
    if (foundErrors.length > 0) {
      console.log(chalk.red('❌ Validation errors found:'));
      foundErrors.slice(0, 3).forEach(err => {
        console.log(chalk.red(`   ${err.trim().substring(0, 100)}`));
      });
    } else {
      console.log(chalk.green('✓ No validation errors - configuration accepted!'));
    }
    
    // Check if can proceed
    console.log(chalk.cyan('✅ Checking if Continue button is enabled...'));
    const buttons2 = await page.$$('button');
    let canContinue = false;
    
    for (const button of buttons2) {
      const text = await button.textContent();
      const visible = await button.isVisible();
      if (visible && text && (text.includes('Continue') || text.includes('Next'))) {
        const isDisabled = await button.isDisabled();
        const opacity = await button.evaluate(el => window.getComputedStyle(el).opacity);
        canContinue = !isDisabled && opacity !== '0';
        console.log(chalk.cyan(`   Found "${text.trim()}" - Enabled: ${canContinue}`));
        break;
      }
    }
    
    console.log(chalk.bold('\n📊 RESULT:'));
    console.log(chalk.bold(`   Configuration: ${width}" x ${height}" (${mountType} mount)`));
    console.log(chalk.bold(`   Has Errors: ${foundErrors.length > 0 ? 'Yes' : 'No'}`));
    console.log(chalk.bold(`   Can Continue: ${canContinue ? 'Yes' : 'No'}`));
    
    if (foundErrors.length === 0 && canContinue) {
      console.log(chalk.green('\n✅ Configuration is VALID and allowed'));
    } else if (foundErrors.length > 0 && !canContinue) {
      console.log(chalk.green('\n✅ Configuration is correctly BLOCKED'));
    } else if (foundErrors.length === 0 && !canContinue) {
      console.log(chalk.yellow('\n⚠️  No errors shown but cannot continue (might need color/lift selection)'));
    } else {
      console.log(chalk.red('\n🐛 BUG: Has errors but can still continue!'));
    }
    
    console.log(chalk.blue('\n⏱️  Keeping browser open for 60 seconds for manual inspection...'));
    await page.waitForTimeout(60000);
    
  } catch (error) {
    console.error(chalk.red(`❌ Error: ${error.message}`));
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

console.log(chalk.yellow('\nUsage: node manual-test.js [width] [height] [mount-type]'));
console.log(chalk.yellow('Example: node manual-test.js 70 125 inside\n'));

manualTest();
