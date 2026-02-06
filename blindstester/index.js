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
        } else {
          console.log(chalk.red('\n❌ Configuration validation failed or cancelled.\n'));
          process.exit(1);
        }
      } else {
        console.log(chalk.red('\n❌ No brand selected. Exiting.\n'));
        process.exit(1);
      }
    } else {
      console.log(chalk.red('\n❌ No model selected. Exiting.\n'));
      process.exit(1);
    }
  } else {
    console.log(chalk.yellow('⚠️  Skipping interactive mode.\n'));
    console.log(chalk.red('❌ No configuration provided.\n'));
    console.log(chalk.yellow('To run tests, you need to either:'));
    console.log(chalk.white('  1. Use interactive mode (don\'t press Enter, select an option)'));
    console.log(chalk.white('  2. Use --config flag: npm start -- --config configs/your-config.js'));
    console.log(chalk.white('  3. Use --skip-interactive with --config flag\n'));
    process.exit(1);
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
    const configName = config ? config.name : 'configuration';
    console.log(chalk.cyan(`\n🎯 Starting test for ${configName}`));
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
