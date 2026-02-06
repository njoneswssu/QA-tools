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
  'motorization-2on1': 'Motorization 2 on 1',
  'motorization-wand': 'Motorization Wand',
  'motorization-wand-2on1': 'Motorization Wand 2 on 1',
  'motorization-tdbu': 'Motorization TDBU'
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
  console.log(chalk.gray('\n  Enter number (1-13) or press Enter to skip interactive mode:\n'));
  
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

async function selectModel(showGoBack = false) {
  console.log(chalk.bold.cyan('\n🏷️  What model?\n'));
  
  MODELS.forEach((model, index) => {
    console.log(chalk.white(`  ${index + 1}. ${model}`));
  });
  
  if (showGoBack) {
    console.log(chalk.yellow(`\n  ${MODELS.length + 1}. ⬅️  Go back`));
  }
  
  console.log(chalk.gray(`\n  Enter number (1-${MODELS.length}${showGoBack ? ` or ${MODELS.length + 1} to go back` : ''}):\n`));
  
  const answer = await askQuestion('  Selection: ');
  const selection = parseInt(answer.trim());
  
  if (isNaN(selection) || selection < 1 || selection > (showGoBack ? MODELS.length + 1 : MODELS.length)) {
    console.log(chalk.red('\n  ❌ Invalid selection.\n'));
    return null;
  }
  
  // Check if go back was selected
  if (showGoBack && selection === MODELS.length + 1) {
    return { action: 'go-back' };
  }
  
  return MODELS[selection - 1];
}

async function selectBrand(showGoBack = false) {
  console.log(chalk.bold.cyan('\n🏪 What brand?\n'));
  
  BRANDS.forEach((brand, index) => {
    console.log(chalk.white(`  ${index + 1}. ${brand}`));
  });
  
  if (showGoBack) {
    console.log(chalk.yellow(`\n  ${BRANDS.length + 1}. ⬅️  Go back`));
  }
  
  console.log(chalk.gray(`\n  Enter number (1-${BRANDS.length}${showGoBack ? ` or ${BRANDS.length + 1} to go back` : ''}):\n`));
  
  const answer = await askQuestion('  Selection: ');
  const selection = parseInt(answer.trim());
  
  if (isNaN(selection) || selection < 1 || selection > (showGoBack ? BRANDS.length + 1 : BRANDS.length)) {
    console.log(chalk.red('\n  ❌ Invalid selection.\n'));
    return null;
  }
  
  // Check if go back was selected
  if (showGoBack && selection === BRANDS.length + 1) {
    return { action: 'go-back' };
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

async function askMultilineInput(query) {
  console.log(chalk.cyan(query));
  console.log(chalk.gray('═══════════════════════════════════════════════════════'));
  console.log(chalk.white('Paste your grid (including header row with widths)'));
  console.log(chalk.gray('Then type "done" on a new line and press Enter'));
  console.log(chalk.gray('═══════════════════════════════════════════════════════\n'));
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    const lines = [];

    rl.on('line', (line) => {
      if (line.trim().toLowerCase() === 'done') {
        rl.close();
      } else {
        lines.push(line);
      }
    });

    rl.on('close', () => {
      resolve(lines.join('\n'));
    });
  });
}

function parseGridData(text) {
  console.log(chalk.cyan('\n📊 Parsing grid data...\n'));
  
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length < 2) {
    console.log(chalk.red('❌ Not enough lines. Need at least header + 1 product.\n'));
    return null;
  }
  
  // Split by tabs or multiple spaces or pipes
  const splitLine = (line) => line.split(/\t+|\s{2,}|\|/).map(s => s.trim()).filter(s => s);
  
  const headerParts = splitLine(lines[0]);
  
  // Find width columns (should contain numbers with " or just numbers)
  const widthIndices = [];
  const widthValues = [];
  
  headerParts.forEach((part, index) => {
    const match = part.match(/^(\d+)\"?$/);
    if (match) {
      widthIndices.push(index);
      widthValues.push(parseInt(match[1]));
    }
  });
  
  if (widthValues.length === 0) {
    console.log(chalk.red('❌ Could not find width columns in header.\n'));
    console.log(chalk.gray('Expected format: Product Name | 72" | 96" | ...\n'));
    return null;
  }
  
  console.log(chalk.green(`✓ Found ${widthValues.length} width columns: ${widthValues.join('", ')}"\n`));
  
  const products = [];
  
  for (let i = 1; i < lines.length; i++) {
    const parts = splitLine(lines[i]);
    if (parts.length < 2) continue;
    
    const productName = parts[0];
    if (!productName || productName.length < 2) continue;
    
    const widthBreakpoints = [];
    
    for (let j = 0; j < widthIndices.length; j++) {
      const heightStr = parts[widthIndices[j]];
      if (!heightStr) continue;
      
      const heightMatch = heightStr.match(/(\d+)/);
      if (heightMatch) {
        widthBreakpoints.push({
          width: widthValues[j],
          maxHeight: parseInt(heightMatch[1])
        });
      }
    }
    
    if (widthBreakpoints.length > 0) {
      products.push({
        product: productName,
        widthBreakpoints
      });
      console.log(chalk.gray(`  ${products.length}. ${productName} - ${widthBreakpoints.length} widths`));
    }
  }
  
  console.log(chalk.green(`\n✓ Successfully parsed ${products.length} products!\n`));
  return products;
}

async function extractDataFromGridImage(gridImagePath) {
  console.log(chalk.cyan(`\n🔍 Reading grid image with OCR: ${gridImagePath}\n`));
  console.log(chalk.gray('This may take 30-60 seconds...\n'));
  
  try {
    const Tesseract = await import('tesseract.js');
    
    const { data: { text } } = await Tesseract.default.recognize(
      gridImagePath,
      'eng',
      {
        logger: m => {
          if (m.status === 'recognizing text') {
            const percent = Math.round(m.progress * 100);
            process.stdout.write(`\r  Progress: ${percent}%`);
          }
        }
      }
    );
    
    console.log('\n');
    
    // Parse the extracted text
    const lines = text.split('\n').filter(line => line.trim());
    const products = [];
    
    // Find width columns
    let widthValues = [];
    for (const line of lines) {
      const widths = line.match(/(\d+)"\s/g);
      if (widths && widths.length >= 2) {
        widthValues = widths.map(w => parseInt(w.replace('"', '').trim()));
        console.log(chalk.green(`✓ Found ${widthValues.length} width columns: ${widthValues.join('", ')}"\n`));
        break;
      }
    }
    
    if (widthValues.length === 0) {
      console.log(chalk.red('❌ Could not find width columns in grid image\n'));
      return null;
    }
    
    // Parse product lines
    for (const line of lines) {
      // Skip header lines
      if (line.includes('Width') || line.includes('width')) continue;
      if (!line.trim()) continue;
      
      // Extract product name (first non-numeric text before numbers)
      const productMatch = line.match(/^([^0-9]+?)(?:\s+\d)/);
      if (!productMatch) continue;
      
      const productName = productMatch[1].trim();
      if (!productName || productName.length < 3) continue;
      
      // Extract height values (find all numbers after product name)
      const numbers = line.match(/\d+/g);
      if (!numbers || numbers.length < widthValues.length + 1) continue;
      
      // Skip the first number if it's part of the product name (e.g., "3% Catalina")
      let startIndex = 0;
      if (productName.match(/\d+/)) {
        startIndex = 1;
      }
      
      const heights = numbers.slice(startIndex, startIndex + widthValues.length).map(Number);
      
      if (heights.length === widthValues.length) {
        const widthBreakpoints = widthValues.map((width, index) => ({
          width,
          maxHeight: heights[index]
        }));
        
        products.push({
          product: productName,
          widthBreakpoints
        });
      }
    }
    
    return products;
  } catch (error) {
    console.log(chalk.red(`\n❌ OCR extraction failed: ${error.message}\n`));
    return null;
  }
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
        const oldUrl = configuratorUrl;
        configuratorUrl = newUrl.trim();
        
        // Check if URL actually changed
        const urlChanged = oldUrl !== configuratorUrl;
        
        // Update saved config
        if (!configData) configData = {};
        configData.url = configuratorUrl;
        savedConfigs[configKey] = configData;
        saveSavedConfigs(savedConfigs);
        console.log(chalk.green('\n  ✓ URL updated and saved\n'));
        
        // If URL changed and config exists, ask about updating grid data
        if (urlChanged) {
          const configPath = path.join(__dirname, configFilePath);
          const configExists = fs.existsSync(configPath);
          
          if (configExists) {
            console.log(chalk.yellow('  ⚠️  The configurator URL has changed!\n'));
            console.log(chalk.white('  The product grid data might have changed too.\n'));
            console.log(chalk.cyan('  Do you want to update the grid data? (y/n): '));
            
            const updateGridAnswer = await askQuestion('  ');
            
            if (updateGridAnswer.toLowerCase() === 'y' || updateGridAnswer.toLowerCase() === 'yes') {
              // Delete old config file so validation loop will prompt for new data
              try {
                fs.unlinkSync(configPath);
                console.log(chalk.yellow('\n  ✓ Old grid data cleared. You will be prompted to paste new data.\n'));
              } catch (error) {
                console.log(chalk.red(`\n  ❌ Could not delete old config: ${error.message}\n`));
              }
            } else {
              console.log(chalk.green('\n  ✓ Keeping existing grid data. Starting tests with current data.\n'));
            }
          }
        }
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
  
  // Validation loop - keep trying until config exists or user gives up
  while (true) {
    // Check config file
    console.log(chalk.cyan('📋 Validating configuration...\n'));
    
    const configPath = path.join(__dirname, configFilePath);
    const configExists = fs.existsSync(configPath);
    
    let hasErrors = false;
    let hasGarbageData = false;
    
    // If config exists, validate it contains good data
    if (configExists) {
      try {
        const configModule = await import(configPath + '?t=' + Date.now()); // Cache bust
        const loadedConfig = configModule.config;
        
        // Check if product names look like garbage (OCR errors)
        if (loadedConfig && loadedConfig.testData) {
          const badProducts = loadedConfig.testData.filter(p => 
            /[\[\]—]/.test(p.product) || // Contains brackets or em dashes
            p.product.length < 3 || // Too short
            !p.product.match(/[a-zA-Z]/) // No letters
          );
          
          if (badProducts.length > 0) {
            hasGarbageData = true;
            console.log(chalk.yellow(`  ⚠️  Config file has questionable product names:\n`));
            badProducts.slice(0, 3).forEach(p => {
              console.log(chalk.red(`     "${p.product}" ← Looks like OCR error`));
            });
            if (badProducts.length > 3) {
              console.log(chalk.red(`     ... and ${badProducts.length - 3} more\n`));
            } else {
              console.log();
            }
            
            console.log(chalk.yellow('  This config was likely created by OCR and has errors.'));
            console.log(chalk.cyan('  Recommended: Replace it with pasted data\n'));
          } else {
            console.log(chalk.green(`  ✓ Config file found: ${configFilePath}`));
            console.log(chalk.green(`  ✓ Config data looks valid (${loadedConfig.testData.length} products)\n`));
          }
        } else {
          console.log(chalk.green(`  ✓ Config file found: ${configFilePath}\n`));
        }
      } catch (error) {
        console.log(chalk.yellow(`  ⚠️  Could not validate config: ${error.message}\n`));
      }
    }
    
    if (!configExists || hasGarbageData) {
      if (hasGarbageData) {
        console.log(chalk.red(`  ❌ Config file has bad data (OCR errors detected)`));
      } else {
        console.log(chalk.red(`  ❌ Config file not found: ${configFilePath}`));
      }
      
      console.log(chalk.yellow(`\n  📝 You need to provide your grid data to run tests.\n`));
      
      console.log(chalk.cyan('  Option 1: Paste grid data now (Quick & Accurate) ⭐'));
      console.log(chalk.white('     Copy your grid from Excel/Sheets/Website and paste it here.'));
      console.log(chalk.gray('     Takes 2 minutes, very reliable!\n'));
      
      console.log(chalk.cyan('  Option 2: Create config file separately'));
      console.log(chalk.white('     Run: npm run create-config'));
      console.log(chalk.gray('     Then retry\n'));
      
      hasErrors = true;
    } else {
      console.log(chalk.green(`  ✓ Config file found: ${configFilePath}\n`));
    }
    
    if (hasErrors) {
      // If config doesn't exist or has garbage, offer to paste grid data now
      if (!configExists || hasGarbageData) {
        console.log(chalk.cyan('  What would you like to do?\n'));
        console.log(chalk.white('    1. Paste grid data now (creates config automatically)'));
        console.log(chalk.white('    2. Retry (after creating config file separately)'));
        console.log(chalk.white('    3. Exit\n'));
        
        const action = await askQuestion('  Selection (1-3): ');
        
        if (action.trim() === '1') {
          // Paste grid data
          console.log(chalk.cyan('\n📋 Ready to receive grid data!\n'));
          console.log(chalk.white('EXAMPLE FORMAT:\n'));
          console.log(chalk.gray('Width To:  36"  42"  48"  60"  66"  72"'));
          console.log(chalk.gray('3% Catalina  144  144  144  144  144  132'));
          console.log(chalk.gray('5% Catalina  144  144  144  144  144  132'));
          console.log(chalk.gray('...\n'));
          console.log(chalk.yellow('Copy your entire grid (with header row) and paste below:'));
          
          const pastedData = await askMultilineInput('');
          
          if (pastedData && pastedData.trim()) {
            const extractedData = parseGridData(pastedData);
            
            if (extractedData && extractedData.length > 0) {
              // Auto-save as config file
              console.log(chalk.cyan('\n💾 Saving as config file...\n'));
              try {
                const configContent = `export const config = {
  name: "${configKey}",
  url: "${configuratorUrl}",
  gridImage: "${gridImagePath}",
  testData: ${JSON.stringify(extractedData, null, 4).replace(/"([^"]+)":/g, '$1:')}
};
`;
                const fullConfigPath = path.join(__dirname, 'configs', `${configKey}-config.js`);
                fs.writeFileSync(fullConfigPath, configContent);
                console.log(chalk.green(`✓ Config file saved: configs/${configKey}-config.js`));
                console.log(chalk.gray('  (Next time, this will load instantly!)\n'));
                console.log(chalk.cyan('🚀 Starting tests...\n'));
                
                // Return success with extracted data
                return {
                  configKey,
                  configName,
                  configuratorUrl,
                  gridImagePath,
                  configFilePath: fullConfigPath,
                  testData: extractedData
                };
              } catch (saveError) {
                console.log(chalk.red(`\n❌ Could not save config file: ${saveError.message}\n`));
                return null;
              }
            } else {
              console.log(chalk.red('\n❌ Could not parse pasted data.'));
              console.log(chalk.yellow('Please check the format and try again.\n'));
              continue; // Loop back to retry options
            }
          } else {
            console.log(chalk.red('\n❌ No data pasted.\n'));
            continue; // Loop back to retry options
          }
        } else if (action.trim() === '2') {
          // Retry - loop will continue
          console.log(chalk.cyan('\n🔄 Rechecking files...\n'));
          continue;
        } else {
          // Exit
          console.log(chalk.yellow('\n  ⏹️  Exiting. Run the tool again when ready.\n'));
          return null;
        }
      } else {
        // Original retry logic when only grid is missing
        console.log(chalk.cyan('  What would you like to do?\n'));
        console.log(chalk.white('    1. Retry (after adding missing files)'));
        console.log(chalk.white('    2. Exit\n'));
        
        const retryAnswer = await askQuestion('  Selection (1-2): ');
        
        if (retryAnswer.trim() === '1') {
          // Loop will continue and check again
          console.log(chalk.cyan('\n🔄 Rechecking files...\n'));
          continue;
        } else {
          // User wants to exit
          console.log(chalk.yellow('\n  ⏹️  Exiting. Run the tool again when ready.\n'));
          return null;
        }
      }
    } else {
      // Both files exist, break out of loop
      break;
    }
  }
  
  return {
    configKey,
    configName,
    configuratorUrl,
    gridImagePath,
    configFilePath: path.join(__dirname, configFilePath)
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
  
  let liftTypeSelection = null;
  let model = null;
  let brand = null;
  let validatedConfig = null;
  
  // Navigation loop to allow going back
  while (true) {
    // Step 1: Select lift type
    if (!liftTypeSelection) {
      liftTypeSelection = await selectLiftType();
      
      if (!liftTypeSelection) {
        console.log(chalk.yellow('⚠️  Skipping interactive mode.\n'));
        console.log(chalk.red('❌ No configuration provided.\n'));
        console.log(chalk.yellow('To run tests, you need to either:'));
        console.log(chalk.white('  1. Use interactive mode (don\'t press Enter, select an option)'));
        console.log(chalk.white('  2. Use --config flag: npm start -- --config configs/your-config.js'));
        console.log(chalk.white('  3. Use --skip-interactive with --config flag\n'));
        process.exit(1);
      }
      
      // Check if delete action was selected
      if (liftTypeSelection.action === 'delete-results') {
        await deleteAllResults();
        process.exit(0);
      }
      
      continue; // Go to next step
    }
    
    // Step 2: Select model
    if (!model) {
      model = await selectModel(true); // Show go back option
      
      if (!model) {
        console.log(chalk.red('\n❌ No model selected. Exiting.\n'));
        process.exit(1);
      }
      
      // Check if go back was selected
      if (typeof model === 'object' && model.action === 'go-back') {
        liftTypeSelection = null; // Reset to go back
        model = null;
        continue;
      }
      
      continue; // Go to next step
    }
    
    // Step 3: Select brand
    if (!brand) {
      brand = await selectBrand(true); // Show go back option
      
      if (!brand) {
        console.log(chalk.red('\n❌ No brand selected. Exiting.\n'));
        process.exit(1);
      }
      
      // Check if go back was selected
      if (typeof brand === 'object' && brand.action === 'go-back') {
        model = null; // Reset to go back
        brand = null;
        continue;
      }
      
      continue; // Go to validation
    }
    
    // Step 4: Validate configuration
    if (!validatedConfig) {
      validatedConfig = await validateAndGetConfiguration(
        liftTypeSelection.key,
        liftTypeSelection.name,
        model,
        brand
      );
      
      if (validatedConfig) {
        console.log(chalk.green('✅ Configuration validated successfully!\n'));
        
        if (validatedConfig.testData) {
          // Data was extracted from grid, use it directly
          testData = validatedConfig.testData;
          configuratorUrl = validatedConfig.configuratorUrl;
          config = {
            name: validatedConfig.configName,
            url: configuratorUrl,
            gridImage: validatedConfig.gridImagePath,
            testData: testData
          };
          console.log(chalk.cyan('📊 Using pasted grid data\n'));
        } else {
          // Load from config file
          options.config = validatedConfig.configFilePath;
          configuratorUrl = validatedConfig.configuratorUrl;
        }
        
        break; // Exit navigation loop
      } else {
        console.log(chalk.red('\n❌ Configuration validation failed or cancelled.\n'));
        process.exit(1);
      }
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
} else if (!config || !testData) {
  // No config loaded from interactive mode or command line
  console.log(chalk.red('\n❌ No configuration provided.\n'));
  console.log(chalk.yellow('To run tests, you need to either:'));
  console.log(chalk.white('  1. Use interactive mode (npm start) and complete the setup'));
  console.log(chalk.white('  2. Specify a config file (npm start -- --config configs/your-config.js)'));
  console.log(chalk.white('  3. Skip interactive mode requires a config (--skip-interactive --config ...)\n'));
  console.log(chalk.gray('Cannot run tests without proper configuration.\n'));
  process.exit(1);
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
  constructor(configuratorUrl, headless = false, is2on1 = false, configName = 'configuration') {
    this.configuratorUrl = configuratorUrl;
    this.headless = headless;
    this.is2on1 = is2on1;
    this.configName = configName; // Store config name for reports
    this.browser = null;
    this.page = null;
    this.results = [];
    this.shutdownRequested = false;
    this.isTestingConfiguration = false;
    this.completedProducts = new Set(); // Track completed products
    this.completedTests = new Map(); // Track completed tests by product-width
    this.progressFile = null; // Will be set when tests start
    this.resultsFilename = null; // Track the results filename for resume
  }

  setProgressFile(configName) {
    this.progressFile = path.join(__dirname, 'test-results', `.progress-${configName}.json`);
  }

  loadProgress() {
    if (!this.progressFile || !fs.existsSync(this.progressFile)) {
      return { completedProducts: [], completedTests: {}, resultsFilename: null };
    }
    
    try {
      const data = fs.readFileSync(this.progressFile, 'utf8');
      const progress = JSON.parse(data);
      console.log(chalk.gray(`\n  📂 Progress file exists: ${path.basename(this.progressFile)}`));
      console.log(chalk.gray(`  📅 Last updated: ${progress.lastUpdated || 'unknown'}`));
      
      // Show what's been tested
      if (progress.completedTests && Object.keys(progress.completedTests).length > 0) {
        const testCount = Object.values(progress.completedTests).reduce((sum, arr) => sum + arr.length, 0);
        console.log(chalk.gray(`  ✓ ${testCount} test(s) already completed`));
      }
      
      // Store the results filename if resuming
      if (progress.resultsFilename) {
        console.log(chalk.gray(`  📄 Will append to: ${path.basename(progress.resultsFilename)}`));
      }
      
      return progress;
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Could not load progress: ${error.message}`));
      return { completedProducts: [], completedTests: {}, resultsFilename: null };
    }
  }

  saveProgress() {
    if (!this.progressFile) return;
    
    const completedTestsObj = {};
    this.completedTests.forEach((widths, product) => {
      completedTestsObj[product] = Array.from(widths);
    });
    
    const progress = {
      completedProducts: Array.from(this.completedProducts),
      completedTests: completedTestsObj,
      lastUpdated: new Date().toISOString(),
      resultsFilename: this.resultsFilename // Track the results filename
    };
    
    try {
      const outputDir = path.dirname(this.progressFile);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      fs.writeFileSync(this.progressFile, JSON.stringify(progress, null, 2));
      
      const totalTests = Object.values(completedTestsObj).reduce((sum, arr) => sum + arr.length, 0);
      console.log(chalk.gray(`  💾 Progress saved: ${this.completedProducts.size} products, ${totalTests} tests completed`));
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Could not save progress: ${error.message}`));
    }
  }

  clearProgress() {
    if (this.progressFile && fs.existsSync(this.progressFile)) {
      try {
        fs.unlinkSync(this.progressFile);
        console.log(chalk.gray('  Progress file cleared'));
      } catch (error) {
        console.log(chalk.yellow(`⚠️  Could not clear progress: ${error.message}`));
      }
    }
    // Reset the completed products set and tests map
    this.completedProducts = new Set();
    this.completedTests = new Map();
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

  async cleanupAndSave(outputFile) {
    // Save results first, then cleanup browser
    if (this.results.length > 0) {
      console.log(chalk.cyan('\n💾 Saving partial results before exit...'));
      await this.saveResults(outputFile);
      
      // If we're saving partial results, also save progress unconditionally
      // This ensures we don't lose track of what we've tested so far
      console.log(chalk.cyan('💾 Saving progress for resume...'));
      this.saveProgress();
    }
    
    await this.cleanup();
  }

  async navigateToConfigurator() {
    console.log(chalk.cyan(`📍 Navigating to: ${this.configuratorUrl}`));
    try {
      await this.page.goto(this.configuratorUrl, { 
        waitUntil: 'domcontentloaded',  // Less strict than 'networkidle'
        timeout: 60000  // 60 seconds
      });
      await this.page.waitForTimeout(3000);
      console.log(chalk.green('  ✓ Page loaded'));
    } catch (error) {
      console.log(chalk.yellow(`  ⚠️  Page load warning: ${error.message}`));
      console.log(chalk.cyan('  Continuing anyway...\n'));
    }
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

  async canSelect2on1Headrail() {
    console.log(chalk.cyan('  🔍 Checking if 2 on 1 headrail is available...'));
    try {
      await this.page.evaluate(() => window.scrollBy(0, 400));
      await this.page.waitForTimeout(3000);

      const allButtons = await this.page.$$('button');
      let twoOnOneButton = null;
      
      for (const button of allButtons) {
        const text = await button.textContent();
        const trimmedText = text.trim().toLowerCase();
        
        // Look for "2 on 1" button
        if (trimmedText.includes('2 on 1') || trimmedText.includes('2on1') || trimmedText.includes('2-on-1')) {
          const isVisible = await button.isVisible();
          const isDisabled = await button.isDisabled();
          const opacity = await button.evaluate(el => window.getComputedStyle(el).opacity);
          const pointerEvents = await button.evaluate(el => window.getComputedStyle(el).pointerEvents);
          const display = await button.evaluate(el => window.getComputedStyle(el).display);
          const visibility = await button.evaluate(el => window.getComputedStyle(el).visibility);
          
          if (isVisible && !isDisabled && opacity !== '0' && pointerEvents !== 'none' && display !== 'none' && visibility !== 'hidden') {
            twoOnOneButton = button;
            break;
          }
        }
      }

      if (twoOnOneButton) {
        console.log(chalk.yellow('  ⚠️  2 on 1 headrail IS available (should be blocked!)'));
        return true;
      } else {
        console.log(chalk.green('  ✓ 2 on 1 headrail NOT available (correctly hidden)'));
        return false;
      }
    } catch (error) {
      console.log(chalk.yellow(`  ⚠️  Error checking 2 on 1 headrail: ${error.message}`));
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

  async testConfiguration(product, width, maxHeight, testHeight, isMaxWidthTest = false, is144Test = false) {
    console.log(chalk.cyan(`\n🧪 Testing: ${product} @ ${width}" width`));
    console.log(chalk.gray(`   Max Height: ${maxHeight}" | Testing: ${testHeight}"`));
    if (this.is2on1) {
      console.log(chalk.gray(`   Mode: 2 on 1 headrail test`));
    }
    if (isMaxWidthTest) {
      console.log(chalk.yellow(`   ⚠️  Max Width Test: Testing beyond max width`));
    }
    if (is144Test) {
      console.log(chalk.cyan(`   ✨ 144" Test: Verifying 144" height is allowed`));
    }

    const testResult = {
      product,
      width,
      maxHeight,
      testHeight,
      singleAvailable: null,
      twoOnOneAvailable: null,
      mountType: null,
      isMaxWidthTest,
      is144Test,
      status: 'FAIL',
      timestamp: new Date().toISOString()
    };

    try {
      await this.navigateToConfigurator();
      
      // Random mount selection
      const mountType = Math.random() < 0.5 ? 'inside' : 'outside';
      testResult.mountType = mountType;
      console.log(chalk.gray(`   Mount: ${mountType}`));
      await this.selectMountType(mountType);
      
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

      if (this.is2on1) {
        // For 2on1 configurations, check if 2on1 headrail option is available
        const twoOnOneAvailable = await this.canSelect2on1Headrail();
        testResult.twoOnOneAvailable = twoOnOneAvailable;

        await this.checkForErrors();

        if (is144Test) {
          // For 144" test, headrail SHOULD be available
          if (twoOnOneAvailable) {
            testResult.status = 'PASS';
            console.log(chalk.green(`  ✅ PASS: 144" height allowed - 2 on 1 headrail available`));
          } else {
            testResult.status = 'BUG';
            console.log(chalk.red(`  🐛 BUG: 144" height - 2 on 1 headrail NOT available (should be available)!`));
          }
        } else if (isMaxWidthTest) {
          // For max width test, headrail should NOT be available
          if (!twoOnOneAvailable) {
            testResult.status = 'PASS';
            console.log(chalk.green(`  ✅ PASS: Width ${width}" exceeds max - 2 on 1 headrail correctly unavailable`));
          } else {
            testResult.status = 'BUG';
            console.log(chalk.red(`  🐛 BUG: Width ${width}" exceeds max - 2 on 1 headrail still available!`));
          }
        } else if (testHeight > maxHeight && !twoOnOneAvailable) {
          testResult.status = 'PASS';
          console.log(chalk.green(`  ✅ PASS: Correctly blocked ${testHeight}" (max: ${maxHeight}") - 2 on 1 headrail not available`));
        } else if (testHeight > maxHeight && twoOnOneAvailable) {
          testResult.status = 'BUG';
          console.log(chalk.red(`  🐛 BUG: Allowed ${testHeight}" (max: ${maxHeight}") - 2 on 1 headrail still available!`));
        } else if (testHeight <= maxHeight && twoOnOneAvailable) {
          testResult.status = 'PASS';
          console.log(chalk.green(`  ✅ PASS: ${testHeight}" allowed (at or below max: ${maxHeight}") - 2 on 1 headrail available`));
        } else {
          testResult.status = 'UNEXPECTED';
          console.log(chalk.yellow(`  ⚠️  UNEXPECTED: ${testHeight}" (max: ${maxHeight}") - 2on1=${twoOnOneAvailable}`));
        }
      } else {
        // For regular configurations, check if single headrail option is available
        const singleAvailable = await this.canSelectSingleHeadrail();
        testResult.singleAvailable = singleAvailable;

        await this.checkForErrors();

        if (is144Test) {
          // For 144" test, headrail SHOULD be available
          if (singleAvailable) {
            testResult.status = 'PASS';
            console.log(chalk.green(`  ✅ PASS: 144" height allowed - Single headrail available`));
          } else {
            testResult.status = 'BUG';
            console.log(chalk.red(`  🐛 BUG: 144" height - Single headrail NOT available (should be available)!`));
          }
        } else if (isMaxWidthTest) {
          // For max width test, headrail should NOT be available
          if (!singleAvailable) {
            testResult.status = 'PASS';
            console.log(chalk.green(`  ✅ PASS: Width ${width}" exceeds max - Single headrail correctly unavailable`));
          } else {
            testResult.status = 'BUG';
            console.log(chalk.red(`  🐛 BUG: Width ${width}" exceeds max - Single headrail still available!`));
          }
        } else if (testHeight > maxHeight && !singleAvailable) {
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

  async runTests(productsToTest, resumeFromProgress = false) {
    const configName = config ? config.name : 'configuration';
    console.log(chalk.cyan(`\n🎯 Starting test for ${configName}`));
    
    // Set up progress tracking
    this.setProgressFile(configName);
    
    // Load previous progress if resuming
    if (resumeFromProgress) {
      const progress = this.loadProgress();
      this.completedProducts = new Set(progress.completedProducts || []);
      
      // Load completed tests map
      if (progress.completedTests) {
        for (const [product, widths] of Object.entries(progress.completedTests)) {
          this.completedTests.set(product, new Set(widths));
        }
      }
      
      // Load the saved results filename to append to it
      if (progress.resultsFilename) {
        this.resultsFilename = progress.resultsFilename;
      }
      
      console.log(chalk.green(`\n✓ Loaded progress: ${this.completedProducts.size} products fully completed`));
      
      const totalTests = Object.values(progress.completedTests || {}).reduce((sum, arr) => sum + arr.length, 0);
      if (totalTests > 0) {
        console.log(chalk.green(`✓ ${totalTests} individual test(s) already completed`));
      }
      
      console.log(chalk.gray('  Will skip completed tests\n'));
    }
    
    console.log(chalk.gray('   Press Ctrl+C to stop after current test completes and save results\n'));

    for (const product of productsToTest) {
      if (this.shutdownRequested) {
        console.log(chalk.yellow('\n⏹️  Stopping tests due to shutdown request'));
        break;
      }

      // Skip if already completed
      if (this.completedProducts.has(product.product)) {
        console.log(chalk.gray(`\n⏭️  Skipping ${product.product} - already completed`));
        continue;
      }

      console.log(chalk.bold.blue(`\n📦 Testing Product: ${product.product}`));

      let shouldSkipWidth = false;

      // STEP 1: Test 144" height first (one width breakpoint)
      // Find a breakpoint that supports 144" height
      const breakpoint144 = product.widthBreakpoints.find(bp => bp.maxHeight === 144);
      
      if (breakpoint144 && !this.shutdownRequested) {
        // Check if 144" test was already completed
        const test144Key = '144-height-test';
        const completedWidths = this.completedTests.get(product.product);
        
        if (completedWidths && completedWidths.has(test144Key)) {
          console.log(chalk.gray(`\n⏭️  Skipping STEP 1 (144" height test) for ${product.product} - already completed`));
        } else {
          const testWidth = breakpoint144.width - 2;
          console.log(chalk.cyan(`\n📏 STEP 1: Testing 144" height capability @ ${testWidth}" width`));
          console.log(chalk.gray(`   Verifying that 144" height is allowed with headrail available\n`));
          
          this.isTestingConfiguration = true;
          const test144Result = await this.testConfiguration(
            product.product,
            testWidth,
            144,
            144,
            false,  // isMaxWidthTest
            true    // is144Test
          );
          this.isTestingConfiguration = false;
          
          this.results.push(test144Result);
          
          // Mark 144" test as completed and save progress
          if (!this.completedTests.has(product.product)) {
            this.completedTests.set(product.product, new Set());
          }
          this.completedTests.get(product.product).add(test144Key);
          
          // Save progress after 144" test
          if (!this.shutdownRequested) {
            console.log(chalk.gray(`  💾 Saving progress...`));
            this.saveProgress();
          }
          
          if (test144Result.status === 'SKIPPED' || test144Result.status === 'ERROR') {
            console.log(chalk.yellow(`  ⏭️  Skipping all tests for ${product.product} - 144" test ${test144Result.status}`));
            shouldSkipWidth = true;
            // Don't mark as completed if we skipped due to error
            continue;
          }
        }
      }

      // STEP 2: Test regular width breakpoints (height above max)
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
        
        // Skip if maxHeight is already 144" (already tested in STEP 1)
        if (maxHeight === 144) {
          console.log(chalk.gray(`\n📏 Skipping width ${width - 2}" - maxHeight is 144" (already tested in STEP 1)`));
          continue;
        }
        
        // Generate a unique test key for this product-width combination
        const testKey = `${width}`;
        
        // Check if this specific test was already completed
        const completedWidths = this.completedTests.get(product.product);
        if (completedWidths && completedWidths.has(testKey)) {
          console.log(chalk.gray(`\n⏭️  Skipping ${product.product} @ ${width}" - already completed`));
          continue;
        }
        
        const testWidth = width - 2;
        
        // Calculate test height, but cap at 144" maximum
        const minAbove = maxHeight + 1;
        const maxAbove = Math.min(maxHeight + 20, 144); // Cap at 144"
        const randomHeight = Math.floor(Math.random() * (maxAbove - minAbove + 1)) + minAbove;
        
        console.log(chalk.cyan(`\n📏 STEP 2: Testing width ${testWidth}" (max height: ${maxHeight}")`));
        console.log(chalk.yellow(`   Testing at ${randomHeight}" (randomly selected above max height, capped at 144")`));
        
        this.isTestingConfiguration = true;
        const testResult = await this.testConfiguration(
          product.product,
          testWidth,
          maxHeight,
          randomHeight,
          false,  // isMaxWidthTest
          false   // is144Test
        );
        this.isTestingConfiguration = false;
        
        this.results.push(testResult);
        
        // Mark test as completed and save progress IMMEDIATELY after adding to results
        // This ensures progress is tracked even if shutdown happens before the status check
        // (testKey already declared above at line 1497)
        if (!this.completedTests.has(product.product)) {
          this.completedTests.set(product.product, new Set());
        }
        this.completedTests.get(product.product).add(testKey);
        
        // Save progress after every test (not just successful ones)
        // This ensures we never lose track of what's been tested
        if (!this.shutdownRequested) {
          console.log(chalk.gray(`  💾 Saving progress...`));
          this.saveProgress();
        }
        
        if (this.shutdownRequested) {
          console.log(chalk.yellow('\n⏹️  Test completed. Shutting down...'));
          break;
        }

        if (testResult.status === 'SKIPPED' || testResult.status === 'ERROR') {
          console.log(chalk.yellow(`  ⏭️  Skipping remaining widths for ${product.product} due to ${testResult.status}`));
          shouldSkipWidth = true;
        }
      }

      // STEP 3: Test max width restriction (after all normal width tests)
      if (!shouldSkipWidth && !this.shutdownRequested && product.widthBreakpoints.length > 0) {
        // Check if max width test was already completed
        const maxWidthKey = 'max-width';
        const completedWidths = this.completedTests.get(product.product);
        
        if (completedWidths && completedWidths.has(maxWidthKey)) {
          console.log(chalk.gray(`\n⏭️  Skipping STEP 3 (max width test) for ${product.product} - already completed`));
        } else {
          // Find the maximum width from all breakpoints
          const maxWidth = Math.max(...product.widthBreakpoints.map(bp => bp.width));
          const beyondMaxWidth = maxWidth + 12; // Test 12" beyond max width
          
          // Use a reasonable height (not at max) for this test
          const testHeight = 72;
          
          console.log(chalk.cyan(`\n📏 STEP 3: Testing max width restriction`));
          console.log(chalk.yellow(`   Max width in table: ${maxWidth}"`));
          console.log(chalk.yellow(`   Testing at: ${beyondMaxWidth}" (beyond max width)`));
          console.log(chalk.gray(`   Headrail should NOT be available\n`));
          
          this.isTestingConfiguration = true;
          const maxWidthTest = await this.testConfiguration(
            product.product,
            beyondMaxWidth,
            testHeight, // Use as "maxHeight" but won't be compared in max width test
            testHeight,
            true,   // isMaxWidthTest
            false   // is144Test
          );
          this.isTestingConfiguration = false;
          
          this.results.push(maxWidthTest);
          
          // Mark max width test as completed and save progress
          if (!this.completedTests.has(product.product)) {
            this.completedTests.set(product.product, new Set());
          }
          this.completedTests.get(product.product).add(maxWidthKey);
          
          // Save progress after max width test
          if (!this.shutdownRequested) {
            console.log(chalk.gray(`  💾 Saving progress...`));
            this.saveProgress();
          }
        }
      }

      // Mark product as completed (if not aborted)
      if (!this.shutdownRequested && !shouldSkipWidth) {
        this.completedProducts.add(product.product);
        this.saveProgress();
        console.log(chalk.green(`\n✅ Completed all tests for ${product.product}`));
      } else if (this.shutdownRequested) {
        console.log(chalk.yellow(`\n⚠️  Product ${product.product} not marked as completed (shutdown requested)`));
      } else if (shouldSkipWidth) {
        console.log(chalk.yellow(`\n⚠️  Product ${product.product} not marked as completed (tests were skipped)`));
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
    const gridReport = generateGridReport(this.results, this.configName);
    fs.writeFileSync(gridOutputFile, gridReport);
    console.log(chalk.cyan(`📋 Grid report saved to: ${path.basename(gridOutputFile)}`));

    const compactOutputFile = outputFile.replace('.json', '-compact.txt');
    const compactGrid = generateCompactGrid(this.results, this.configName);
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

  const is2on1 = config && config.name && config.name.toLowerCase().includes('2on1');
  const configName = config ? config.name : 'configuration';
  
  const tester = new BlindsConfiguratorTester(configuratorUrl, options.headless, is2on1, configName);

  if (is2on1) {
    console.log(chalk.yellow('🔧 Detected 2 on 1 configuration - will test for 2 on 1 headrail option\n'));
  }

  let shutdownCount = 0;
  const handleShutdown = async () => {
    shutdownCount++;
    if (shutdownCount === 1) {
      tester.requestShutdown();
    } else if (shutdownCount === 2) {
      console.log(chalk.red('\n🛑 Force exit requested. Saving results immediately...\n'));
      await tester.cleanupAndSave(options.output);
      process.exit(0);
    }
  };

  process.on('SIGINT', handleShutdown);
  process.on('SIGTERM', handleShutdown);

  try {
    // Check for existing progress BEFORE opening browser
    const configName = config ? config.name : 'configuration';
    console.log(chalk.gray(`\n  🔍 Checking for progress file for: ${configName}`));
    tester.setProgressFile(configName);
    console.log(chalk.gray(`  📁 Progress file path: ${tester.progressFile}`));
    const progress = tester.loadProgress();
    
    let resumeFromProgress = false;
    
    // Check if there's any progress at all (completed products OR completed tests)
    const hasCompletedProducts = progress.completedProducts && progress.completedProducts.length > 0;
    const hasCompletedTests = progress.completedTests && Object.keys(progress.completedTests).length > 0;
    
    if (hasCompletedProducts || hasCompletedTests) {
      // Found previous progress, ask user BEFORE opening browser
      console.log(chalk.cyan('\n📋 Previous test progress found!'));
      
      if (hasCompletedProducts) {
        console.log(chalk.white(`   ${progress.completedProducts.length} product(s) fully completed:`));
        progress.completedProducts.forEach((product, index) => {
          console.log(chalk.gray(`     ${index + 1}. ${product}`));
        });
      }
      
      if (hasCompletedTests) {
        const totalTests = Object.values(progress.completedTests).reduce((sum, arr) => sum + arr.length, 0);
        console.log(chalk.white(`   ${totalTests} individual test(s) completed`));
        if (!hasCompletedProducts) {
          // Show which products have partial progress with specific widths
          console.log(chalk.gray('   Partial progress for:'));
          Object.keys(progress.completedTests).forEach((product, index) => {
            const tests = progress.completedTests[product];
            const testCount = tests.length;
            
            // Separate width tests from special tests
            const widthTests = tests.filter(t => !isNaN(parseInt(t))).sort((a, b) => parseInt(a) - parseInt(b));
            const specialTests = tests.filter(t => isNaN(parseInt(t)));
            
            let testDetails = [];
            if (specialTests.includes('144-height-test')) {
              testDetails.push('144" height test');
            }
            if (widthTests.length > 0) {
              testDetails.push(`widths: ${widthTests.map(w => w + '"').join(', ')}`);
            }
            if (specialTests.includes('max-width')) {
              testDetails.push('max width test');
            }
            
            console.log(chalk.gray(`     ${index + 1}. ${product} (${testDetails.join(', ')})`));
          });
        }
      }
      console.log();
      
      console.log(chalk.white('   What would you like to do?\n'));
      console.log(chalk.white('     1. Resume from where you left off'));
      console.log(chalk.white('     2. Start fresh (clear progress and test all products in new file)'));
      console.log(chalk.white('     3. Exit\n'));
      
      const choice = await askQuestion('   Selection (1-3): ');
      
      if (choice.trim() === '1') {
        resumeFromProgress = true;
        console.log(chalk.green(`\n✓ Resuming tests from where you left off\n`));
        console.log(chalk.gray('  Will skip completed tests and continue\n'));
      } else if (choice.trim() === '2') {
        tester.clearProgress();
        console.log(chalk.yellow('\n✓ Starting fresh - all products will be tested\n'));
        console.log(chalk.gray('  Progress tracking reset for new test run\n'));
        console.log(chalk.gray('  A new results file will be created\n'));
        console.log(chalk.gray('  Previous results are preserved\n'));
      } else {
        console.log(chalk.yellow('\n⏹️  Exiting.\n'));
        process.exit(0);
      }
    }
    
    // NOW initialize the browser (only if we're continuing)
    await tester.initialize();
    
    // If resuming, use the saved results filename from progress
    if (resumeFromProgress && tester.resultsFilename) {
      options.output = tester.resultsFilename;
      console.log(chalk.gray(`  📄 Will append results to: ${path.basename(options.output)}\n`));
    } else {
      // Starting fresh or no saved filename - use the generated one
      tester.resultsFilename = options.output;
    }
    
    await tester.runTests(productsToTest, resumeFromProgress);
    tester.printSummary();
    await tester.saveResults(options.output);
    
    // Save progress on graceful shutdown (so resume works)
    const totalTests = Array.from(tester.completedTests.values()).reduce((sum, set) => sum + set.size, 0);
    if (tester.shutdownRequested && totalTests > 0) {
      console.log(chalk.cyan('💾 Saving progress for resume...'));
      tester.saveProgress();
    }
    
    // Clear progress file on successful completion
    if (!tester.shutdownRequested) {
      tester.clearProgress();
      console.log(chalk.green('\n✅ All tests completed! Progress file cleared.\n'));
    } else {
      console.log(chalk.yellow('\n⏸️  Tests paused. Run again to resume from where you left off.\n'));
    }
  } catch (error) {
    console.error(chalk.red(`\n❌ Fatal error: ${error.message}`));
    console.error(error.stack);
  } finally {
    await tester.cleanup();
  }
}

main().catch(console.error);
