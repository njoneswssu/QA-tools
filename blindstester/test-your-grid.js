import chalk from 'chalk';

// Your sample data with title row
const sampleGrid = `MOTORIZATION (InMotion and Wand)  CONTROL + OPEN ROLL  LIMITATIONS  BY  COLLECTION
Width To:	36"	42"	48"	54"	60"	66"	72"	78"	84"	90"	96"	102"	108"	114"	120"	126"	132"	138"	144"
3% Catalina	144	144	144	144	144	144	144	144	144	144	144	144	144	132	90	54	-	-	-
5% Catalina	144	144	144	144	144	144	144	144	144	144	144	144	144	132	90	54	-	-	-
1% Catalina	144	144	144	144	144	144	144	144	144	144	144	144	144	96	72	48	-	-	-
10% Solapur	144	144	144	144	144	144	144	144	144	144	144	144	144	96	72	48	-	-	-
3% Malibu	144	144	144	144	144	144	144	144	144	144	144	144	132	90	60	36	-	-	-`;

function parseGridData(text) {
  console.log(chalk.cyan('\n📊 Parsing grid data...\n'));
  
  const lines = text.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    console.log(chalk.red('❌ Not enough lines. Need at least header + 1 product.\n'));
    return null;
  }
  
  // Split by tabs or multiple spaces or pipes
  const splitLine = (line) => line.split(/\t+|\s{2,}/).map(s => s.trim()).filter(s => s);
  
  // Find the header row (contains width values like 36", 42", 48")
  let headerIndex = -1;
  let headerParts = [];
  
  console.log(chalk.gray(`Checking ${Math.min(5, lines.length)} lines for header row...\n`));
  
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const parts = splitLine(lines[i]);
    console.log(chalk.gray(`  Line ${i + 1}: ${parts.length} columns, first 3: ${parts.slice(0, 3).join(' | ')}`));
    
    // Count how many parts look like widths (numbers with ")
    const widthCount = parts.filter(p => /^\d+\"?$/.test(p)).length;
    
    if (widthCount >= 3) { // Found header with at least 3 width columns
      headerIndex = i;
      headerParts = parts;
      console.log(chalk.green(`  ✓ Found header row at line ${i + 1} with ${widthCount} width columns\n`));
      break;
    }
  }
  
  if (headerIndex === -1) {
    console.log(chalk.red('\n❌ Could not find header row with width columns.\n'));
    console.log(chalk.gray('Expected format: Width To: | 36" | 42" | 48" | ...\n'));
    console.log(chalk.yellow('Tip: Make sure to include the header row with width values!\n'));
    return null;
  }
  
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
  
  // Start parsing from the row after the header
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const parts = splitLine(lines[i]);
    if (parts.length < 2) continue;
    
    const productName = parts[0];
    if (!productName || productName.length < 2) continue;
    
    // Skip if product name looks like it might be another header row
    if (productName.toLowerCase().includes('width') || 
        productName.toLowerCase().includes('total')) {
      continue;
    }
    
    const widthBreakpoints = [];
    
    for (let j = 0; j < widthIndices.length; j++) {
      const heightStr = parts[widthIndices[j]];
      if (!heightStr || heightStr === '-') continue;
      
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

// Test with sample data
console.log(chalk.cyan('═══════════════════════════════════════════════════════'));
console.log(chalk.white('Testing parser with your sample data'));
console.log(chalk.cyan('═══════════════════════════════════════════════════════\n'));

const result = parseGridData(sampleGrid);

if (result && result.length > 0) {
  console.log(chalk.green('✅ Parser works with your data!\n'));
  console.log(chalk.white('Sample product:'));
  console.log(JSON.stringify(result[0], null, 2));
  console.log('\n' + chalk.white('All products:'));
  result.forEach((p, i) => {
    console.log(chalk.gray(`  ${i + 1}. ${p.product} - ${p.widthBreakpoints.length} width breakpoints`));
  });
} else {
  console.log(chalk.red('❌ Parser failed\n'));
}
