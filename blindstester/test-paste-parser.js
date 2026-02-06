#!/usr/bin/env node

/**
 * Quick test of the paste parsing functionality
 */

import chalk from 'chalk';

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

// Test with sample data
const sampleData = `Product Name     72" Width    96" Width    120" Width
Light Filtering  96"          72"          48"
Room Darkening   96"          72"          48"
Blackout         84"          60"          36"`;

console.log(chalk.bold.blue('\n🧪 Testing Paste Parser\n'));
console.log(chalk.gray('Sample input:'));
console.log(sampleData);

const result = parseTabularText(sampleData);

if (result) {
  console.log(chalk.green(`\n✅ Successfully parsed ${result.length} products:\n`));
  result.forEach((product, i) => {
    console.log(chalk.white(`${i + 1}. ${product.product}`));
    product.widthBreakpoints.forEach(bp => {
      console.log(chalk.gray(`   ${bp.width}" → ${bp.maxHeight}"`));
    });
  });
} else {
  console.log(chalk.red('\n❌ Parsing failed\n'));
}
