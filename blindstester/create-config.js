#!/usr/bin/env node

/**
 * Smart Config File Generator
 * 
 * Automatically extracts test data from grid images using OCR,
 * or accepts pasted text data.
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import readline from 'readline';
import { fileURLToPath } from 'url';
import Tesseract from 'tesseract.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function askMultilineInput(query) {
  console.log(chalk.cyan(query));
  console.log(chalk.gray('(Paste your data, then press Enter twice to finish)\n'));
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    const lines = [];
    let emptyLineCount = 0;

    rl.on('line', (line) => {
      if (line.trim() === '') {
        emptyLineCount++;
        if (emptyLineCount >= 2) {
          rl.close();
        }
      } else {
        emptyLineCount = 0;
        lines.push(line);
      }
    });

    rl.on('close', () => {
      resolve(lines.join('\n'));
    });
  });
}

async function extractFromImage(imagePath) {
  console.log(chalk.cyan('\n🔍 Reading grid image with OCR...\n'));
  console.log(chalk.gray('This may take 30-60 seconds...\n'));
  
  try {
    const { data: { text } } = await Tesseract.recognize(
      imagePath,
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
    return text;
  } catch (error) {
    console.log(chalk.red(`\n❌ OCR failed: ${error.message}\n`));
    return null;
  }
}

function parseGridText(text) {
  console.log(chalk.cyan('\n📊 Parsing grid data...\n'));
  
  const lines = text.split('\n').filter(line => line.trim());
  const products = [];
  
  // Try to find header line with widths
  let headerLine = null;
  const widthPattern = /\d+"/g;
  
  for (const line of lines) {
    const widths = line.match(widthPattern);
    if (widths && widths.length >= 2) {
      headerLine = line;
      break;
    }
  }
  
  if (!headerLine) {
    console.log(chalk.yellow('⚠️  Could not automatically detect column structure.\n'));
    return null;
  }
  
  // Extract width values from header
  const widthValues = headerLine.match(/\d+/g).map(Number);
  console.log(chalk.gray(`  Found ${widthValues.length} width columns: ${widthValues.join('", ')}"\n`));
  
  // Process each subsequent line as a product
  for (const line of lines) {
    if (line === headerLine) continue;
    if (!line.trim()) continue;
    
    // Extract product name (first non-numeric text)
    const productMatch = line.match(/^([^0-9]+)/);
    if (!productMatch) continue;
    
    const productName = productMatch[1].trim();
    if (!productName || productName.length < 2) continue;
    
    // Extract all numbers from the line
    const numbers = line.match(/\d+/g);
    if (!numbers || numbers.length < widthValues.length) continue;
    
    // Remove the product name numbers if any, keep only height values
    const heights = numbers.slice(-widthValues.length).map(Number);
    
    const widthBreakpoints = widthValues.map((width, index) => ({
      width,
      maxHeight: heights[index]
    }));
    
    products.push({
      product: productName,
      widthBreakpoints
    });
  }
  
  return products;
}

function parseTabularText(text) {
  console.log(chalk.cyan('\n📊 Parsing pasted data...\n'));
  
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length < 2) {
    console.log(chalk.red('❌ Not enough lines. Need at least header + 1 product.\n'));
    return null;
  }
  
  // Split by tabs or multiple spaces
  const splitLine = (line) => line.split(/\t+|\s{2,}/).map(s => s.trim()).filter(s => s);
  
  const headerParts = splitLine(lines[0]);
  
  // Find width columns (should contain numbers with ")
  const widthIndices = [];
  const widthValues = [];
  
  headerParts.forEach((part, index) => {
    const match = part.match(/(\d+)"/);
    if (match) {
      widthIndices.push(index);
      widthValues.push(parseInt(match[1]));
    }
  });
  
  if (widthValues.length === 0) {
    console.log(chalk.red('❌ Could not find width columns in header.\n'));
    console.log(chalk.gray('Expected format: Product Name | 72" Width | 96" Width | ...\n'));
    return null;
  }
  
  console.log(chalk.gray(`  Found ${widthValues.length} width columns: ${widthValues.join('", ')}"\n`));
  
  const products = [];
  
  for (let i = 1; i < lines.length; i++) {
    const parts = splitLine(lines[i]);
    if (parts.length < 2) continue;
    
    const productName = parts[0];
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
    }
  }
  
  return products;
}

async function main() {
  console.log(chalk.bold.blue('\n╔════════════════════════════════════════════╗'));
  console.log(chalk.bold.blue('║    Smart Config Generator - Auto Extract   ║'));
  console.log(chalk.bold.blue('╚════════════════════════════════════════════╝\n'));

  // Get config name
  console.log(chalk.cyan('First, tell me about your configuration:\n'));
  const configName = await askQuestion(chalk.white('  Config name (e.g., "motorization-solar-home-depot"): '));
  
  if (!configName || !configName.trim()) {
    console.log(chalk.red('\n❌ Config name is required.\n'));
    process.exit(1);
  }

  const configKey = configName.trim();
  
  // Get URL
  console.log(chalk.cyan('\nWhat\'s the configurator URL?\n'));
  const url = await askQuestion(chalk.white('  URL: '));
  
  if (!url || !url.trim()) {
    console.log(chalk.red('\n❌ URL is required.\n'));
    process.exit(1);
  }

  // Check for grid image
  const gridImagePath = `configs/grids/${configKey}.png`;
  const fullGridPath = path.join(__dirname, gridImagePath);
  const gridExists = fs.existsSync(fullGridPath);
  
  let products = null;
  
  // Choose extraction method
  console.log(chalk.bold.cyan('\n📊 How would you like to provide the test data?\n'));
  console.log(chalk.white('  1. Auto-extract from grid image (using OCR)'));
  console.log(chalk.white('  2. Paste grid data as text'));
  console.log(chalk.white('  3. Manual entry (original method)\n'));
  
  const method = await askQuestion(chalk.gray('  Selection (1-3): '));
  let currentMethod = method; // Use a mutable variable for fallback logic
  
  if (currentMethod === '1') {
    // OCR method
    if (!gridExists) {
      console.log(chalk.red(`\n❌ Grid image not found: ${gridImagePath}`));
      console.log(chalk.yellow(`Please save your grid screenshot to: ${fullGridPath}\n`));
      process.exit(1);
    }
    
    const ocrText = await extractFromImage(fullGridPath);
    if (ocrText) {
      products = parseGridText(ocrText);
      
      if (!products || products.length === 0) {
        console.log(chalk.yellow('⚠️  Auto-extraction found no products.'));
        console.log(chalk.cyan('Let\'s try pasting the data as text instead.\n'));
        currentMethod = '2'; // Fall through to paste method
      } else {
        console.log(chalk.green(`✓ Found ${products.length} products!\n`));
      }
    }
  }
  
  if (currentMethod === '2' || (method === '1' && !products)) {
    // Paste method
    console.log(chalk.cyan('\n📋 Paste your grid data:\n'));
    console.log(chalk.gray('You can copy from Excel, Google Sheets, or the configurator page.'));
    console.log(chalk.gray('Format: Product Name [tab/spaces] 72" [tab/spaces] 96" [tab/spaces] ...\n'));
    
    const pastedText = await askMultilineInput('');
    
    if (pastedText) {
      products = parseTabularText(pastedText);
    }
  }
  
  if (currentMethod === '3' || !products || products.length === 0) {
    // Manual method (fallback)
    if (products && products.length === 0) {
      console.log(chalk.yellow('\n⚠️  Automatic extraction failed. Falling back to manual entry.\n'));
    }
    
    console.log(chalk.cyan('📝 Manual entry mode:\n'));
    console.log(chalk.gray('Enter products one by one.\n'));
    
    products = [];
    let addMore = true;
    let productNum = 1;

    while (addMore) {
      console.log(chalk.bold.white(`\n━━━ Product #${productNum} ━━━\n`));
      
      const productName = await askQuestion(chalk.white('  Product name: '));
      
      if (!productName || !productName.trim()) {
        break;
      }

      console.log(chalk.cyan('\n  Enter width breakpoints:\n'));

      const widthBreakpoints = [];
      let addMoreWidths = true;
      let widthNum = 1;

      while (addMoreWidths) {
        console.log(chalk.white(`    Width #${widthNum}:`));
        
        const widthStr = await askQuestion(chalk.gray('      Width (inches): '));
        const width = parseInt(widthStr);
        
        if (isNaN(width) || !widthStr.trim()) {
          break;
        }

        const maxHeightStr = await askQuestion(chalk.gray('      Max height: '));
        const maxHeight = parseInt(maxHeightStr);
        
        if (isNaN(maxHeight)) {
          console.log(chalk.red('      ❌ Invalid height, skipping.\n'));
          continue;
        }

        widthBreakpoints.push({ width, maxHeight });
        console.log(chalk.green(`      ✓ Added: ${width}" width, max ${maxHeight}" height\n`));
        
        const continueWidths = await askQuestion(chalk.gray('      Add another width? (y/n): '));
        if (continueWidths.toLowerCase() !== 'y') {
          addMoreWidths = false;
        }
        widthNum++;
      }

      if (widthBreakpoints.length > 0) {
        products.push({
          product: productName.trim(),
          widthBreakpoints
        });
        console.log(chalk.green(`\n  ✓ Added "${productName}" with ${widthBreakpoints.length} widths`));
      }

      const continueProducts = await askQuestion(chalk.white('\nAdd another product? (y/n): '));
      if (continueProducts.toLowerCase() !== 'y') {
        addMore = false;
      }
      productNum++;
    }
  }

  if (!products || products.length === 0) {
    console.log(chalk.red('\n❌ No products added. Config file not created.\n'));
    process.exit(1);
  }

  // Show preview and confirm
  console.log(chalk.bold.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.bold.cyan('           PREVIEW           '));
  console.log(chalk.bold.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
  
  products.forEach((product, index) => {
    console.log(chalk.white(`${index + 1}. ${product.product}`));
    product.widthBreakpoints.forEach(bp => {
      console.log(chalk.gray(`   ${bp.width}" width → max ${bp.maxHeight}" height`));
    });
    console.log();
  });
  
  const confirm = await askQuestion(chalk.yellow('Does this look correct? (y/n): '));
  
  if (confirm.toLowerCase() !== 'y') {
    console.log(chalk.yellow('\n⏹️  Cancelled. No file created.\n'));
    process.exit(0);
  }

  // Generate the config file
  const configContent = `export const config = {
  name: "${configKey}",
  url: "${url.trim()}",
  gridImage: "${gridImagePath}",
  testData: ${JSON.stringify(products, null, 4).replace(/"([^"]+)":/g, '$1:')}
};
`;

  const configFilePath = path.join(__dirname, 'configs', `${configKey}-config.js`);
  
  fs.writeFileSync(configFilePath, configContent);
  
  console.log(chalk.bold.green('\n✅ Config file created successfully!\n'));
  console.log(chalk.cyan(`📁 Saved to: configs/${configKey}-config.js`));
  console.log(chalk.cyan(`📊 Products: ${products.length}`));
  console.log(chalk.cyan(`🔗 URL: ${url.trim()}\n`));

  // Show next steps
  console.log(chalk.bold.cyan('🚀 Next Steps:\n'));
  if (!gridExists) {
    console.log(chalk.yellow(`  1. Add grid image to: ${gridImagePath}`));
    console.log(chalk.white(`  2. Run: npm start`));
  } else {
    console.log(chalk.white(`  1. Run: npm start`));
  }
  console.log(chalk.white(`  2. Select lift type, model, and brand`));
  console.log(chalk.green(`\n✓ Ready to test!\n`));
}

main().catch(error => {
  console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
  console.error(error.stack);
  process.exit(1);
});
