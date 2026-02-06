import { chromium } from 'playwright';
import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateGridReport, generateCompactGrid } from './grid-reporter.js';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Available test configurations
const TEST_CONFIGS = {
  'cordless': {
    name: 'Cordless',
    gridImage: 'configs/grids/cordless-grid.png',
    configFile: 'configs/cordless-config.js'
  },
  'cordloop': {
    name: 'Cordloop',
    gridImage: 'configs/grids/cordloop-grid.png',
    configFile: 'configs/cordloop-config.js'
  },
  'medium-cassette': {
    name: 'Medium Cassette Valance',
    gridImage: 'configs/grids/medium-cassette-grid.png',
    configFile: 'configs/medium-cassette-config.js'
  },
  'large-cassette': {
    name: 'Large Cassette Valance',
    gridImage: 'configs/grids/large-cassette-grid.png',
    configFile: 'configs/large-cassette-config.js'
  },
  'motorization': {
    name: 'Motorization',
    gridImage: 'configs/grids/motorization-grid.png',
    configFile: 'configs/motorization-config.js'
  },
  'cordless-2on1': {
    name: 'Cordless 2 on 1',
    gridImage: 'configs/grids/cordless-2on1-grid.png',
    configFile: 'configs/cordless-2on1-config.js'
  },
  'cordloop-2on1': {
    name: 'Cordloop 2 on 1',
    gridImage: 'configs/grids/cordloop-2on1-grid.png',
    configFile: 'configs/cordloop-2on1-config.js'
  },
  'large-cassette-2on1': {
    name: 'Large Cassette Valance 2 on 1',
    gridImage: 'configs/grids/large-cassette-2on1-grid.png',
    configFile: 'configs/large-cassette-2on1-config.js'
  },
  'motorization-2on1': {
    name: 'Motorization 2 on 1',
    gridImage: 'configs/grids/motorization-2on1-grid.png',
    configFile: 'configs/motorization-2on1-config.js'
  }
};

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

async function selectTestConfiguration() {
  console.log(chalk.bold.cyan('\n🎯 What do you want to test?\n'));
  
  const options = Object.entries(TEST_CONFIGS);
  options.forEach(([key, config], index) => {
    console.log(chalk.white(`  ${index + 1}. ${config.name}`));
  });
  
  console.log(chalk.gray('\n  Enter number (1-9) or press Enter to skip interactive mode:\n'));
  
  const answer = await askQuestion('  Selection: ');
  
  if (!answer || answer.trim() === '') {
    console.log(chalk.yellow('\n  ⏭️  Skipping interactive mode, using default config...\n'));
    return null;
  }
  
  const selection = parseInt(answer.trim());
  
  if (isNaN(selection) || selection < 1 || selection > options.length) {
    console.log(chalk.red('\n  ❌ Invalid selection. Using default config...\n'));
    return null;
  }
  
  const [key, selectedConfig] = options[selection - 1];
  console.log(chalk.green(`\n  ✓ Selected: ${selectedConfig.name}\n`));
  
  return { key, ...selectedConfig };
}

async function validateConfiguration(configSelection) {
  if (!configSelection) return null;
  
  const { name, gridImage, configFile } = configSelection;
  
  // Check if grid image exists
  const gridPath = path.join(__dirname, gridImage);
  const gridExists = fs.existsSync(gridPath);
  
  // Check if config file exists
  const configPath = path.join(__dirname, configFile);
  const configExists = fs.existsSync(configPath);
  
  console.log(chalk.cyan(`📋 Validating configuration for: ${name}\n`));
  
  if (!gridExists) {
    console.log(chalk.red(`  ❌ Grid image not found: ${gridImage}`));
    console.log(chalk.yellow(`\n  Please add the grid image to: ${gridPath}`));
    console.log(chalk.gray(`  Then run the test again.\n`));
    return null;
  } else {
    console.log(chalk.green(`  ✓ Grid image found: ${gridImage}`));
  }
  
  if (!configExists) {
    console.log(chalk.red(`  ❌ Config file not found: ${configFile}`));
    console.log(chalk.yellow(`\n  Please create the config file:`));
    console.log(chalk.white(`     1. Copy: configs/example-config.js`));
    console.log(chalk.white(`     2. Save as: ${configFile}`));
    console.log(chalk.white(`     3. Extract test data from grid image`));
    console.log(chalk.white(`     4. Update config with URL and test data\n`));
    console.log(chalk.gray(`  See configs/README.md for instructions.\n`));
    return null;
  } else {
    console.log(chalk.green(`  ✓ Config file found: ${configFile}\n`));
  }
  
  return configPath;
}

const program = new Command();

program
  .name('blinds-max-height-tester')
  .description('CLI tool to test Home Depot blinds configurator max height constraints')
  .version('1.0.0')
  .option('-c, --config <path>', 'path to config file (e.g., configs/my-config.js)')
  .option('-u, --url <url>', 'configurator URL (overrides config)')
  .option('-h, --headless', 'run in headless mode', false)
  .option('-o, --output <file>', 'output file for results')
  .option('-f, --focus-only', 'only test products with max height < 144"', true)
  .option('-w, --width <width>', 'test specific width only')
  .option('-p, --product <product>', 'test specific product only')
  .option('--skip-interactive', 'skip interactive configuration selection', false)
  .parse(process.argv);

const options = program.opts();

// Load configuration
let config;
let testData;
let configuratorUrl;

// Interactive mode if no config specified and not skipped
if (!options.config && !options.skipInteractive) {
  const selection = await selectTestConfiguration();
  if (selection) {
    const validatedConfigPath = await validateConfiguration(selection);
    if (validatedConfigPath) {
      options.config = validatedConfigPath;
    } else {
      console.log(chalk.yellow('⚠️  Falling back to default configuration...\n'));
    }
  }
}

if (options.config) {
  // Load custom config
  const configPath = path.resolve(options.config);
  console.log(chalk.cyan(`📋 Loading config from: ${configPath}`));
  
  try {
    const configModule = await import(configPath);
    config = configModule.config;
    testData = config.testData;
    configuratorUrl = options.url || config.url;
    console.log(chalk.green(`✓ Loaded config: ${config.name}`));
    if (config.gridImage) {
      console.log(chalk.gray(`  Grid image: ${config.gridImage}\n`));
    }
  } catch (error) {
    console.log(chalk.red(`❌ Failed to load config: ${error.message}`));
    console.log(chalk.yellow('\nMake sure your config file exports a "config" object.'));
    console.log(chalk.gray('Example: export const config = { name: "...", url: "...", testData: [...] };\n'));
    process.exit(1);
  }
} else {
  // Load default config from test-data.js
  const { testData: defaultTestData } = await import('./test-data.js');
  testData = defaultTestData;
  configuratorUrl = options.url || 'https://www.homedepot.com/custom-blinds/Configurator/Draft?draftProductId=722389';
  console.log(chalk.cyan('📋 Using default configuration\n'));
}

// Generate focusProducts from loaded testData
const focusProducts = testData
  .filter(product => 
    product.widthBreakpoints.some(bp => bp.maxHeight < 144)
  )
  .map(product => ({
    ...product,
    widthBreakpoints: product.widthBreakpoints.filter(bp => bp.maxHeight < 144)
  }));

// Set output filename with config name if available
if (!options.output) {
  const configName = config ? config.name.replace(/[^a-z0-9]/gi, '-').toLowerCase() : 'test-results';
  options.output = `test-results/${configName}-${new Date().toISOString().replace(/:/g, '-')}.json`;
}

class BlindsConfiguratorTester {
  constructor(configuratorUrl, headless = false) {
    this.configuratorUrl = configuratorUrl;
    this.headless = headless;
    this.browser = null;
    this.page = null;
    this.results = [];
    this.shutdownRequested = false;
    this.isTestingConfiguration = false;
  }

  async initialize() {
    console.log(chalk.blue('🚀 Initializing browser...'));
    this.browser = await chromium.launch({ 
      headless: this.headless,
      slowMo: 100
    });
    this.page = await this.browser.newPage();
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async navigateToConfigurator() {
    console.log(chalk.cyan(`📍 Navigating to: ${this.configuratorUrl}`));
    await this.page.goto(this.configuratorUrl, { waitUntil: 'networkidle' });
    await this.page.waitForTimeout(3000);
    console.log(chalk.green('  ✓ Page loaded'));
  }

  async selectMountType(type = 'inside') {
    console.log(chalk.cyan(`  📌 Selecting mount type: ${type}`));
    await this.page.waitForTimeout(1000);
    
    const buttonText = type === 'inside' ? 'Inside Mount' : 'Outside Mount';
    const button = await this.page.locator(`button:has-text("${buttonText}")`);
    await button.click();
    await this.page.waitForTimeout(1500);
    console.log(chalk.green(`  ✓ Selected ${buttonText}`));
  }

  async enterDimensions(width, height) {
    console.log(chalk.cyan(`  📏 Entering dimensions: ${width}" x ${height}"`));
    
    try {
      await this.page.evaluate(() => window.scrollBy(0, 200));
      await this.page.waitForTimeout(1000);

      const widthSelect = await this.page.$('select[id="WidthInches"]');
      if (widthSelect) {
        await widthSelect.selectOption(width.toString());
        await this.page.waitForTimeout(1500);
        console.log(chalk.green(`  ✓ Selected width: ${width}"`));
      }

      await this.page.evaluate(() => window.scrollBy(0, 100));
      await this.page.waitForTimeout(1000);

      const heightSelect = await this.page.$('select[id="HeightInches"]');
      if (heightSelect) {
        await heightSelect.selectOption(height.toString());
        await this.page.waitForTimeout(1500);
        console.log(chalk.green(`  ✓ Selected height: ${height}"`));
      }

      await this.page.waitForTimeout(2000);
      return true;
    } catch (error) {
      console.log(chalk.red(`  ❌ Error entering dimensions: ${error.message}`));
      return false;
    }
  }

  async selectColor(productName) {
    console.log(chalk.cyan(`  🎨 Selecting color for ${productName}...`));
    try {
      await this.page.evaluate(() => window.scrollBy(0, 300));
      await this.page.waitForTimeout(1500);

      const parts = productName.split(' ');
      const percentage = parts[0];
      const name = parts.slice(1).join(' ');
      const reversedProductName = `${name} ${percentage}`;

      console.log(chalk.cyan(`  Looking for "${reversedProductName}" color swatches...`));
      const allColorImages = await this.page.$$('img[alt]');
      const matchingImages = [];
      
      for (const img of allColorImages) {
        const altText = await img.getAttribute('alt');
        if (altText && altText.includes(reversedProductName)) {
          matchingImages.push(img);
        }
      }
      
      if (matchingImages.length > 0) {
        const firstColorImg = matchingImages[0];
        const altText = await firstColorImg.getAttribute('alt');
        
        await firstColorImg.scrollIntoViewIfNeeded();
        await this.page.waitForTimeout(1000);
        
        try {
          await firstColorImg.click();
        } catch (e) {
          const parentDiv = await firstColorImg.evaluateHandle(el => el.parentElement);
          await parentDiv.asElement().click();
        }
        await this.page.waitForTimeout(3000);
        
        const bodyText = await this.page.textContent('body');
        const hasColorInReview = bodyText.includes('Color:') && bodyText.includes(reversedProductName);
        
        if (hasColorInReview) {
          console.log(chalk.green(`  ✓ Color CONFIRMED selected: ${altText.substring(0, 50)}`));
          return true;
        } else {
          console.log(chalk.yellow(`  ⚠️  Color clicked but not confirmed in review section`));
          return false;
        }
      }
      console.log(chalk.red(`  ❌ No "${reversedProductName}" color swatches found!`));
      return false;
    } catch (error) {
      console.log(chalk.yellow(`  ⚠️  Error selecting color: ${error.message}`));
      return false;
    }
  }

  async canSelectSingleHeadrail() {
    console.log(chalk.cyan('  🔍 Checking if Single headrail is available...'));
    try {
      await this.page.evaluate(() => window.scrollBy(0, 400));
      await this.page.waitForTimeout(3000);

      const allButtons = await this.page.$$('button');
      let singleButton = null;
      
      for (const button of allButtons) {
        const text = await button.textContent();
        const trimmedText = text.trim();
        
        if (trimmedText === 'Single' || (trimmedText.includes('Single') && !trimmedText.toLowerCase().includes('on'))) {
          const isVisible = await button.isVisible();
          const isDisabled = await button.isDisabled();
          const opacity = await button.evaluate(el => window.getComputedStyle(el).opacity);
          const pointerEvents = await button.evaluate(el => window.getComputedStyle(el).pointerEvents);
          const display = await button.evaluate(el => window.getComputedStyle(el).display);
          const visibility = await button.evaluate(el => window.getComputedStyle(el).visibility);
          
          if (isVisible && !isDisabled && opacity !== '0' && pointerEvents !== 'none' && display !== 'none' && visibility !== 'hidden') {
            singleButton = button;
            break;
          }
        }
      }

      if (singleButton) {
        await singleButton.click();
        await this.page.waitForTimeout(2000);
        
        const isPressed = await singleButton.getAttribute('aria-pressed');
        const buttonClass = await singleButton.getAttribute('class');
        const isSelected = isPressed === 'true' || (buttonClass && (buttonClass.includes('selected') || buttonClass.includes('active')));
        
        if (isSelected) {
          console.log(chalk.yellow('  ⚠️  Single headrail IS available (should be blocked!)'));
          return true;
        } else {
          console.log(chalk.green('  ✓ Single headrail NOT available (only "2 on 1" found)'));
          return false;
        }
      } else {
        console.log(chalk.green('  ✓ Single headrail NOT available (only "2 on 1" found)'));
        return false;
      }
    } catch (error) {
      console.log(chalk.yellow(`  ⚠️  Error checking headrail: ${error.message}`));
      return false;
    }
  }

  async checkForErrors() {
    console.log(chalk.cyan('  🔍 Checking for validation errors...'));
    try {
      const bodyText = await this.page.textContent('body');
      const errorIndicators = [
        'error',
        'invalid',
        'exceeds',
        'maximum',
        'cannot'
      ];
      
      const foundErrors = errorIndicators.filter(indicator => 
        bodyText.toLowerCase().includes(indicator)
      );
      
      if (foundErrors.length > 0) {
        console.log(chalk.yellow(`  ⚠️  Found ${foundErrors.length} potential errors/warnings`));
      } else {
        console.log(chalk.gray('  No obvious validation errors detected'));
      }
    } catch (error) {
      console.log(chalk.gray(`  Could not check for errors: ${error.message}`));
    }
  }

  async testConfiguration(product, width, maxHeight, testHeight) {
    console.log(chalk.cyan(`\n🧪 Testing: ${product} @ ${width}" width`));
    console.log(chalk.gray(`   Max Height: ${maxHeight}" | Testing: ${testHeight}"`));

    const testResult = {
      product,
      width,
      maxHeight,
      testHeight,
      singleAvailable: null,
      status: 'FAIL',
      timestamp: new Date().toISOString()
    };

    try {
      await this.navigateToConfigurator();
      await this.selectMountType('inside');
      
      const dimensionsSet = await this.enterDimensions(width, testHeight);
      if (!dimensionsSet) {
        testResult.status = 'ERROR';
        testResult.error = 'Could not set dimensions';
        return testResult;
      }

      const colorSelected = await this.selectColor(product);
      if (!colorSelected) {
        console.log(chalk.yellow('  ⚠️  Skipping test - color not selected'));
        testResult.status = 'SKIPPED';
        testResult.error = 'Color not selected';
        return testResult;
      }

      const singleAvailable = await this.canSelectSingleHeadrail();
      testResult.singleAvailable = singleAvailable;

      await this.checkForErrors();

      if (testHeight > maxHeight && !singleAvailable) {
        testResult.status = 'PASS';
        console.log(chalk.green(`  ✅ PASS: Correctly blocked ${testHeight}" (max: ${maxHeight}") - Single headrail not available`));
      } else if (testHeight > maxHeight && singleAvailable) {
        testResult.status = 'BUG';
        console.log(chalk.red(`  🐛 BUG: Allowed ${testHeight}" (max: ${maxHeight}") - Single headrail still available!`));
      } else if (testHeight <= maxHeight && singleAvailable) {
        testResult.status = 'PASS';
        console.log(chalk.green(`  ✅ PASS: ${testHeight}" allowed (at or below max: ${maxHeight}") - Single headrail available`));
      } else {
        testResult.status = 'UNEXPECTED';
        console.log(chalk.yellow(`  ⚠️  UNEXPECTED: ${testHeight}" (max: ${maxHeight}") - Single=${singleAvailable}`));
      }

    } catch (error) {
      testResult.status = 'ERROR';
      testResult.error = error.message;
      console.log(chalk.red(`  ❌ ERROR: ${error.message}`));
    }

    return testResult;
  }

  requestShutdown() {
    if (this.isTestingConfiguration) {
      console.log(chalk.yellow('\n⏳ Shutdown requested. Will complete current test and save results...'));
      this.shutdownRequested = true;
    } else {
      console.log(chalk.yellow('\n🛑 Shutdown requested. Saving results...'));
      this.shutdownRequested = true;
    }
  }

  async runTests(productsToTest) {
    console.log(chalk.cyan(`\n🎯 Starting tests for ${productsToTest.length} products`));
    console.log(chalk.gray('\n   Press Ctrl+C to stop after current test completes and save results\n'));

    for (const product of productsToTest) {
      if (this.shutdownRequested) {
        console.log(chalk.yellow('\n⏹️  Stopping tests due to shutdown request'));
        break;
      }

      console.log(chalk.bold.blue(`\n📦 Testing Product: ${product.product}`));

      let shouldSkipWidth = false;

      for (const breakpoint of product.widthBreakpoints) {
        if (this.shutdownRequested) {
          console.log(chalk.yellow('\n⏹️  Stopping tests due to shutdown request'));
          break;
        }

        if (shouldSkipWidth) {
          console.log(chalk.gray(`\n📏 Skipping width ${breakpoint.width - 2}" - previous test failed`));
          continue;
        }

        const { width, maxHeight } = breakpoint;
        const testWidth = width - 2;
        
        const minAbove = maxHeight + 1;
        const maxAbove = maxHeight + 20;
        const randomHeight = Math.floor(Math.random() * (maxAbove - minAbove + 1)) + minAbove;
        
        console.log(chalk.cyan(`\n📏 Testing width ${testWidth}" (max height: ${maxHeight}")`));
        console.log(chalk.yellow(`   Note: Testing at ${randomHeight}" (randomly selected above max height)`));
        
        this.isTestingConfiguration = true;
        const testResult = await this.testConfiguration(product.product, testWidth, maxHeight, randomHeight);
        this.isTestingConfiguration = false;
        
        this.results.push(testResult);
        
        if (this.shutdownRequested) {
          console.log(chalk.yellow('\n⏹️  Test completed. Shutting down...'));
          break;
        }

        if (testResult.status === 'SKIPPED' || testResult.status === 'ERROR') {
          console.log(chalk.yellow(`  ⏭️  Skipping remaining widths for ${product.product} due to ${testResult.status}`));
          shouldSkipWidth = true;
        }
      }
    }
  }

  async saveResults(outputFile) {
    const outputDir = path.dirname(outputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputFile, JSON.stringify(this.results, null, 2));
    console.log(chalk.green(`\n💾 JSON results saved to: ${path.basename(outputFile)}`));

    const gridOutputFile = outputFile.replace('.json', '-grid.txt');
    const gridReport = generateGridReport(this.results);
    fs.writeFileSync(gridOutputFile, gridReport);
    console.log(chalk.cyan(`📋 Grid report saved to: ${path.basename(gridOutputFile)}`));

    const compactOutputFile = outputFile.replace('.json', '-compact.txt');
    const compactGrid = generateCompactGrid(this.results);
    fs.writeFileSync(compactOutputFile, compactGrid);
    console.log(chalk.cyan(`📊 Compact grid saved to: ${path.basename(compactOutputFile)}`));
  }

  printSummary() {
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const bugs = this.results.filter(r => r.status === 'BUG').length;

    console.log(chalk.bold.cyan('\n\n📊 TEST RESULTS SUMMARY\n'));
    console.log(chalk.green(`✅ Passed: ${passed}`));
    console.log(chalk.red(`❌ Failed: ${failed}`));
    console.log(chalk.yellow(`🐛 Bugs Found: ${bugs}`));
  }
}

// Main execution
async function main() {
  let productsToTest;

  if (options.focusOnly) {
    productsToTest = focusProducts;
  } else {
    productsToTest = testData;
  }

  if (options.product) {
    productsToTest = productsToTest.filter(p => 
      p.product.toLowerCase().includes(options.product.toLowerCase())
    );
    if (productsToTest.length === 0) {
      console.log(chalk.red(`\n❌ No products found matching: ${options.product}\n`));
      process.exit(1);
    }
  }

  if (options.width) {
    const targetWidth = parseInt(options.width);
    productsToTest = productsToTest.map(product => ({
      ...product,
      widthBreakpoints: product.widthBreakpoints.filter(bp => bp.width === targetWidth)
    })).filter(product => product.widthBreakpoints.length > 0);
    
    if (productsToTest.length === 0) {
      console.log(chalk.red(`\n❌ No width breakpoints found matching: ${options.width}"\n`));
      process.exit(1);
    }
  }

  const tester = new BlindsConfiguratorTester(configuratorUrl, options.headless);

  process.on('SIGINT', () => {
    tester.requestShutdown();
  });

  process.on('SIGTERM', () => {
    tester.requestShutdown();
  });

  try {
    await tester.initialize();
    await tester.runTests(productsToTest);
    tester.printSummary();
    await tester.saveResults(options.output);
  } catch (error) {
    console.error(chalk.red(`\n❌ Fatal error: ${error.message}`));
    console.error(error.stack);
  } finally {
    await tester.cleanup();
  }
}

main().catch(console.error);
