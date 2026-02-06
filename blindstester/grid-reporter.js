import fs from 'fs';
import chalk from 'chalk';

// Generate a grid report similar to the original image format
export function generateGridReport(results, outputFile = 'grid-report.txt') {
  const lines = [];
  
  lines.push('═'.repeat(120));
  lines.push('BLINDS MAX HEIGHT TEST RESULTS - Grid Format');
  lines.push('═'.repeat(120));
  lines.push('');
  lines.push('Legend: ✅ PASS | 🐛 BUG | ❌ FAIL | ⚠️  UNEXPECTED');
  lines.push('Note: Tests are run AFTER max height (+1" and +10") to verify blocking');
  lines.push('      Single headrail availability determines if configuration is blocked');
  lines.push('      (S) = Single headrail available | (-) = Single headrail not available');
  lines.push('');
  
  // Group results by product
  const byProduct = {};
  results.forEach(r => {
    if (!byProduct[r.product]) {
      byProduct[r.product] = {};
    }
    if (!byProduct[r.product][r.width]) {
      byProduct[r.product][r.width] = {
        maxHeight: r.maxHeight,
        tests: []
      };
    }
    byProduct[r.product][r.width].tests.push(r);
  });
  
  // Generate grid for each product
  Object.keys(byProduct).sort().forEach(product => {
    lines.push('─'.repeat(120));
    lines.push(`PRODUCT: ${product}`);
    lines.push('─'.repeat(120));
    
    const widths = Object.keys(byProduct[product]).map(Number).sort((a, b) => a - b);
    
    // Header row
    const header = '│ Width (") │ Max Height │';
    const testHeaders = ' +1" │ +10" │ Overall │';
    lines.push(header + testHeaders);
    lines.push('├' + '─'.repeat(11) + '┼' + '─'.repeat(12) + '┼' + '─'.repeat(5) + '┼' + '─'.repeat(6) + '┼' + '─'.repeat(9) + '┤');
    
    // Data rows
    widths.forEach(width => {
      const data = byProduct[product][width];
      const tests = data.tests.sort((a, b) => a.testHeight - b.testHeight);
      
      // Determine overall status
      const hasBugs = tests.some(t => t.status === 'BUG');
      const hasFails = tests.some(t => t.status === 'ERROR' || t.status === 'FAIL');
      const hasUnexpected = tests.some(t => t.status === 'UNEXPECTED');
      
      let overallStatus = '✅ PASS';
      if (hasBugs) overallStatus = '🐛 BUG';
      else if (hasFails) overallStatus = '❌ FAIL';
      else if (hasUnexpected) overallStatus = '⚠️  WARN';
      
      // Get test results (now only +1 and +10, no "at max" test)
      const plusOne = tests.find(t => t.testHeight === data.maxHeight + 1);
      const plusTen = tests.find(t => t.testHeight === data.maxHeight + 10);
      
      const getIcon = (test) => {
        if (!test) return '  -  ';
        if (test.status === 'BUG') return '🐛BUG';
        if (test.status === 'PASS') return '✅ OK';
        if (test.status === 'ERROR' || test.status === 'FAIL') return '❌FAIL';
        if (test.status === 'UNEXPECTED') return '⚠️ ???';
        return '  ?  ';
      };
      
      const row = `│   ${width.toString().padStart(3)}     │    ${data.maxHeight}\"      │${getIcon(plusOne)}│ ${getIcon(plusTen)} │ ${overallStatus.padEnd(7)} │`;
      lines.push(row);
    });
    
    lines.push('');
  });
  
  // Summary section
  lines.push('═'.repeat(120));
  lines.push('SUMMARY');
  lines.push('═'.repeat(120));
  
  const totalTests = results.length;
  const passTests = results.filter(r => r.status === 'PASS').length;
  const bugTests = results.filter(r => r.status === 'BUG').length;
  const failTests = results.filter(r => r.status === 'ERROR' || r.status === 'FAIL').length;
  const unexpectedTests = results.filter(r => r.status === 'UNEXPECTED').length;
  
  lines.push('');
  lines.push(`Total Tests:       ${totalTests}`);
  lines.push(`✅ Passed:          ${passTests}`);
  lines.push(`🐛 Bugs Found:      ${bugTests}`);
  lines.push(`❌ Failed:          ${failTests}`);
  lines.push(`⚠️  Unexpected:     ${unexpectedTests}`);
  lines.push('');
  
  // Bug details
  if (bugTests > 0) {
    lines.push('═'.repeat(120));
    lines.push('🐛 BUG DETAILS - Configurations That Should Have Been Blocked:');
    lines.push('═'.repeat(120));
    lines.push('');
    
    results.filter(r => r.status === 'BUG').forEach(bug => {
      lines.push(`  • ${bug.product} @ ${bug.width}" width:`);
      lines.push(`    Allowed ${bug.testHeight}" height when maximum is ${bug.maxHeight}"`);
      lines.push(`    Timestamp: ${bug.timestamp}`);
      lines.push('');
    });
  }
  
  lines.push('═'.repeat(120));
  lines.push(`Report generated: ${new Date().toISOString()}`);
  lines.push('═'.repeat(120));
  
  const report = lines.join('\n');
  
  // Write to file
  fs.writeFileSync(outputFile, report);
  
  // Also print to console
  console.log('\n\n');
  console.log(report);
  
  return report;
}

export function generateCompactGrid(results, outputFile = 'compact-grid.txt') {
  const lines = [];
  
  lines.push('═'.repeat(100));
  lines.push('BLINDS MAX HEIGHT TEST RESULTS - Compact Grid');
  lines.push('═'.repeat(100));
  lines.push('');
  
  // Group by product and width
  const byProduct = {};
  results.forEach(r => {
    if (!byProduct[r.product]) {
      byProduct[r.product] = [];
    }
    if (!byProduct[r.product].find(w => w.width === r.width)) {
      byProduct[r.product].push({
        width: r.width,
        maxHeight: r.maxHeight,
        status: 'PASS',
        issues: []
      });
    }
    const widthData = byProduct[r.product].find(w => w.width === r.width);
    
    if (r.status === 'BUG') {
      widthData.status = 'BUG';
      widthData.issues.push(`Allowed ${r.testHeight}"`);
    } else if (r.status === 'ERROR' || r.status === 'FAIL') {
      widthData.status = 'FAIL';
      widthData.issues.push(`Failed at ${r.testHeight}"`);
    }
  });
  
  // Print grid
  Object.keys(byProduct).sort().forEach(product => {
    lines.push(`${product}:`);
    
    const widths = byProduct[product].sort((a, b) => a.width - b.width);
    
    const widthRow = '  Widths:     ' + widths.map(w => `${w.width}"`).join('  |  ');
    const heightRow = '  Max Height: ' + widths.map(w => `${w.maxHeight}"`).join('  |  ');
    const statusRow = '  Status:     ' + widths.map(w => {
      if (w.status === 'BUG') return '🐛BUG';
      if (w.status === 'FAIL') return '❌FAIL';
      return '✅PASS';
    }).join(' | ');
    
    lines.push(widthRow);
    lines.push(heightRow);
    lines.push(statusRow);
    
    widths.forEach(w => {
      if (w.issues.length > 0) {
        lines.push(`    ⚠️  @ ${w.width}": ${w.issues.join(', ')}`);
      }
    });
    
    lines.push('');
  });
  
  const report = lines.join('\n');
  fs.writeFileSync(outputFile, report);
  
  return report;
}
