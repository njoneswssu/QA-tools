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

// Configuration storage file
const CONFIG_STORAGE_FILE = path.join(__dirname, 'configs', 'saved-configs.json');

// Available lift types
const LIFT_TYPES = {
  'cordless': 'Cordless',
  'cordloop': 'Cordloop',
  'medium-cassette': 'Medium Cassette Valance',
  'large-cassette': 'Large Cassette Valance',
  'motorization': 'Motorization',
  'cordless-2on1': 'Cordless 2 on 1',
  'cordloop-2on1': 'Cordloop 2 on 1',
  'large-cassette-2on1': 'Large Cassette Valance 2 on 1',
  'motorization-2on1': 'Motorization 2 on 1'
};

// Available models
const MODELS = [
  'Roller',
  'Solar',
  'Roman',
  'Banded',
  'Faux Wood',
  'Real Wood',
  'Verticals',
  'Perceptions',
  'Cellular',
  'Cellular 9/16"',
  'Cellular 9/16" Day/Night',
  'Cellular Day/Night',
  'Classic Value Faux Wood',
  'Naturals',
  'Sheer',
  'Vertical Cellular',
  'Panel',
  'Riviera Select',
  'Riviera Complete',
  'Riviera Classic'
];

// Available brands
const BRANDS = ['Home Depot', 'Lowe\'s'];

function loadSavedConfigs() {
  if (fs.existsSync(CONFIG_STORAGE_FILE)) {
    try {
      const data = fs.readFileSync(CONFIG_STORAGE_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Could not load saved configs: ${error.message}`));
      return {};
    }
  }
  return {};
}

function saveSavedConfigs(configs) {
  const configDir = path.dirname(CONFIG_STORAGE_FILE);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  fs.writeFileSync(CONFIG_STORAGE_FILE, JSON.stringify(configs, null, 2));
}

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

async function selectLiftType() {
  console.log(chalk.bold.cyan('\n🎯 What do you want to test?\n'));
  
  const options = Object.entries(LIFT_TYPES);
  options.forEach(([key, name], index) => {
    console.log(chalk.white(`  ${index + 1}. ${name}`));
  });
  
  console.log(chalk.red(`\n  ${options.length + 1}. 🗑️  Delete All Test Results`));
  console.log(chalk.gray('\n  Enter number (1-10) or press Enter to skip interactive mode:\n'));
  
  const answer = await askQuestion('  Selection: ');
  
  if (!answer || answer.trim() === '') {
    return null;
  }
  
  const selection = parseInt(answer.trim());
  
  if (isNaN(selection) || selection < 1 || selection > options.length + 1) {
    console.log(chalk.red('\n  ❌ Invalid selection.\n'));
    return null;
  }
  
  // Check if delete option was selected
  if (selection === options.length + 1) {
    return { action: 'delete-results' };
  }
  
  const [key, name] = options[selection - 1];
  return { key, name };
}

async function deleteAllResults() {
  const resultsDir = path.join(__dirname, 'test-results');
  
  if (!fs.existsSync(resultsDir)) {
    console.log(chalk.yellow('\n  ℹ️  No test-results folder found.\n'));
    return;
  }
  
  const files = fs.readdirSync(resultsDir);
  
  if (files.length === 0) {
    console.log(chalk.yellow('\n  ℹ️  No test results to delete.\n'));
    return;
  }
  
  console.log(chalk.cyan(`\n📁 Found ${files.length} files in test-results/\n`));
  files.forEach(file => {
    console.log(chalk.gray(`  - ${file}`));
  });
  
  console.log(chalk.yellow('\n⚠️  This will permanently delete all test result files!'));
  const confirm = await askQuestion(chalk.white('\n  Are you sure? Type "yes" to confirm: '));
  
  if (confirm.toLowerCase() === 'yes') {
    console.log(chalk.red('\n🗑️  Deleting all test results...\n'));
    let deletedCount = 0;
    
    files.forEach(file => {
      const filePath = path.join(resultsDir, file);
      try {
        fs.unlinkSync(filePath);
        console.log(chalk.gray(`  ✓ Deleted ${file}`));
        deletedCount++;
      } catch (error) {
        console.log(chalk.red(`  ✗ Failed to delete ${file}: ${error.message}`));
      }
    });
    
    console.log(chalk.green(`\n✅ Successfully deleted ${deletedCount} files\n`));
  } else {
    console.log(chalk.yellow('\n  ❌ Deletion cancelled.\n'));
  }
}

async function selectModel() {
  console.log(chalk.bold.cyan('\n🏷️  What model?\n'));
  
  MODELS.forEach((model, index) => {
    console.log(chalk.white(`  ${index + 1}. ${model}`));
  });
  
  console.log(chalk.gray('\n  Enter number (1-20):\n'));
  
  const answer = await askQuestion('  Selection: ');
  const selection = parseInt(answer.trim());
  
  if (isNaN(selection) || selection < 1 || selection > MODELS.length) {
    console.log(chalk.red('\n  ❌ Invalid selection.\n'));
    return null;
  }
  
  return MODELS[selection - 1];
}

async function selectBrand() {
  console.log(chalk.bold.cyan('\n🏪 What brand?\n'));
  
  BRANDS.forEach((brand, index) => {
    console.log(chalk.white(`  ${index + 1}. ${brand}`));
  });
  
  console.log(chalk.gray('\n  Enter number (1-2):\n'));
  
  const answer = await askQuestion('  Selection: ');
  const selection = parseInt(answer.trim());
  
  if (isNaN(selection) || selection < 1 || selection > BRANDS.length) {
    console.log(chalk.red('\n  ❌ Invalid selection.\n'));
    return null;
  }
  
  return BRANDS[selection - 1];
}

function buildConfigKey(liftType, model, brand) {
  const modelKey = model.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const brandKey = brand.toLowerCase().replace(/[^a-z0-9]/g, '-');
  return `${liftType}-${modelKey}-${brandKey}`;
}

function buildConfigName(liftTypeName, model, brand) {
  return `${liftTypeName} - ${model} - ${brand}`;
}

function buildGridImagePath(configKey) {
  return `configs/grids/${configKey}.png`;
}

function buildConfigFilePath(configKey) {
  return `configs/${configKey}-config.js`;
}

async function validateAndGetConfiguration(liftType, liftTypeName, model, brand) {
  const configKey = buildConfigKey(liftType, model, brand);
  const configName = buildConfigName(liftTypeName, model, brand);
  const gridImagePath = buildGridImagePath(configKey);
  const configFilePath = buildConfigFilePath(configKey);
  
  console.log(chalk.cyan(`\n📋 Configuration: ${configName}`));
  console.log(chalk.gray(`   Key: ${configKey}\n`));
  
  // Load saved configs
  const savedConfigs = loadSavedConfigs();
  let configData = savedConfigs[configKey];
  
  // Check if URL exists
  let configuratorUrl = null;
  if (configData && configData.url) {
    console.log(chalk.cyan(`📍 Found saved URL:\n   ${configData.url}\n`));
    const confirmAnswer = await askQuestion(chalk.white('  Is this the correct URL? (y/n): '));
    
    if (confirmAnswer.toLowerCase() === 'n' || confirmAnswer.toLowerCase() === 'no') {
      console.log(chalk.yellow('\n  Please paste the new configurator URL:\n'));
      const newUrl = await askQuestion('  URL: ');
      if (newUrl && newUrl.trim()) {
        configuratorUrl = newUrl.trim();
        // Update saved config
        if (!configData) configData = {};
        configData.url = configuratorUrl;
        savedConfigs[configKey] = configData;
        saveSavedConfigs(savedConfigs);
        console.log(chalk.green('\n  ✓ URL updated and saved\n'));
      }
    } else {
      configuratorUrl = configData.url;
      console.log(chalk.green('  ✓ Using saved URL\n'));
    }
  } else {
    // No URL saved, ask for it
    console.log(chalk.yellow('  ⚠️  No saved URL found for this configuration.\n'));
    console.log(chalk.white('  Please paste the configurator URL:\n'));
    const newUrl = await askQuestion('  URL: ');
    
    if (newUrl && newUrl.trim()) {
      configuratorUrl = newUrl.trim();
      // Save the URL
      if (!configData) configData = {};
      configData.url = configuratorUrl;
      savedConfigs[configKey] = configData;
      saveSavedConfigs(savedConfigs);
      console.log(chalk.green('\n  ✓ URL saved for future use\n'));
    } else {
      console.log(chalk.red('\n  ❌ No URL provided. Cannot proceed.\n'));
      return null;
    }
  }
  
  // Check grid image
  console.log(chalk.cyan('📋 Validating files...\n'));
  
  const gridPath = path.join(__dirname, gridImagePath);
  const gridExists = fs.existsSync(gridPath);
  
  if (!gridExists) {
    console.log(chalk.red(`  ❌ Grid image not found: ${gridImagePath}`));
    console.log(chalk.yellow(`\n  Please add the grid image to:`));
    console.log(chalk.white(`     ${gridPath}`));
    console.log(chalk.gray(`  Then run the test again.\n`));
    return null;
  } else {
    console.log(chalk.green(`  ✓ Grid image found: ${gridImagePath}`));
  }
  
  // Check config file
  const configPath = path.join(__dirname, configFilePath);
  const configExists = fs.existsSync(configPath);
  
  if (!configExists) {
    console.log(chalk.red(`  ❌ Config file not found: ${configFilePath}`));
    console.log(chalk.yellow(`\n  Please create the config file:`));
    console.log(chalk.white(`     1. Copy: configs/example-config.js`));
    console.log(chalk.white(`     2. Save as: ${configFilePath}`));
    console.log(chalk.white(`     3. Extract test data from grid image`));
    console.log(chalk.white(`     4. Update config with URL and test data\n`));
    console.log(chalk.gray(`  See configs/README.md for instructions.\n`));
    return null;
  } else {
    console.log(chalk.green(`  ✓ Config file found: ${configFilePath}\n`));
  }
  
  return {
    configKey,
    configName,
    configuratorUrl,
    gridImagePath,
    configFilePath: configPath
  };
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
  console.log(chalk.bold.blue('\n╔════════════════════════════════════════════╗'));
  console.log(chalk.bold.blue('║   Blinds Max Height Tester - Interactive   ║'));
  console.log(chalk.bold.blue('╚════════════════════════════════════════════╝'));
  
  const liftTypeSelection = await selectLiftType();
  
  if (liftTypeSelection) {
    // Check if delete action was selected
    if (liftTypeSelection.action === 'delete-results') {
      await deleteAllResults();
      process.exit(0);
    }
    
    const model = await selectModel();
    
    if (model) {
      const brand = await selectBrand();
      
      if (brand) {
        const validatedConfig = await validateAndGetConfiguration(
          liftTypeSelection.key,
          liftTypeSelection.name,
          model,
          brand
        );
        
        if (validatedConfig) {
          console.log(chalk.green('✅ Configuration validated successfully!\n'));
          options.config = validatedConfig.configFilePath;
          configuratorUrl = validatedConfig.configuratorUrl;
        } else {
          console.log(chalk.yellow('⚠️  Configuration incomplete. Falling back to default...\n'));
        }
      } else {
        console.log(chalk.yellow('⚠️  No brand selected. Falling back to default...\n'));
      }
    } else {
      console.log(chalk.yellow('⚠️  No model selected. Falling back to default...\n'));
    }
  } else {
    console.log(chalk.yellow('⚠️  Skipping interactive mode, using default config...\n'));
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
    if (!configuratorUrl) {
      configuratorUrl = options.url || config.url;
    }
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
