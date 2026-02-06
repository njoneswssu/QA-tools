#!/usr/bin/env node

/**
 * OCR Verification Tool
 * 
 * Shows what OCR extracted from grid image so you can verify and correct product names.
 */

import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configFile = process.argv[2];

if (!configFile) {
  console.log(chalk.red('\n❌ Please specify a config file:\n'));
  console.log(chalk.white('   node verify-ocr.js configs/motorization-solar-home-depot-config.js\n'));
  process.exit(1);
}

const configPath = path.resolve(__dirname, configFile);

try {
  const { config } = await import(configPath);
  
  console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║         OCR Extraction Results             ║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════╝\n'));
  
  console.log(chalk.cyan(`Configuration: ${config.name}`));
  console.log(chalk.cyan(`Grid Image: ${config.gridImage}`));
  console.log(chalk.cyan(`Products Found: ${config.testData.length}\n`));
  
  console.log(chalk.bold.white('━━━ Extracted Products ━━━\n'));
  
  config.testData.forEach((product, index) => {
    const hasGarbage = /[^a-zA-Z0-9\s%\-']/.test(product.product) || 
                      product.product.includes('[') || 
                      product.product.includes('—');
    
    if (hasGarbage) {
      console.log(chalk.red(`${index + 1}. "${product.product}" ⚠️  INCORRECT OCR`));
    } else {
      console.log(chalk.green(`${index + 1}. "${product.product}" ✓`));
    }
    
    console.log(chalk.gray(`   Widths: ${product.widthBreakpoints.map(bp => `${bp.width}"`).join(', ')}`));
    console.log(chalk.gray(`   Max Heights: ${product.widthBreakpoints.map(bp => `${bp.maxHeight}"`).join(', ')}\n`));
  });
  
  const hasErrors = config.testData.some(p => 
    /[^a-zA-Z0-9\s%\-']/.test(p.product) || 
    p.product.includes('[') || 
    p.product.includes('—')
  );
  
  if (hasErrors) {
    console.log(chalk.bold.yellow('⚠️  PRODUCT NAMES NEED CORRECTION\n'));
    console.log(chalk.cyan('To fix:\n'));
    console.log(chalk.white(`  1. Open: ${configFile}`));
    console.log(chalk.white('  2. Look at your grid image to see correct product names'));
    console.log(chalk.white('  3. Replace the incorrect OCR text with actual product names'));
    console.log(chalk.white('     Example: "[sbewpore — [raal taal" → "Light Filtering"'));
    console.log(chalk.white('  4. Save the file\n'));
    
    console.log(chalk.bold.cyan('💡 TIP: Common Solar Shade Names:\n'));
    console.log(chalk.gray('   - Light Filtering'));
    console.log(chalk.gray('   - Room Darkening'));
    console.log(chalk.gray('   - Blackout'));
    console.log(chalk.gray('   - Screen 3%'));
    console.log(chalk.gray('   - Screen 5%'));
    console.log(chalk.gray('   - Screen 10%\n'));
  } else {
    console.log(chalk.bold.green('✅ All product names look correct!\n'));
  }
  
} catch (error) {
  console.log(chalk.red(`\n❌ Error loading config: ${error.message}\n`));
  process.exit(1);
}
