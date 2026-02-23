#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import { execSync } from 'child_process';

console.log(chalk.bold.blue('\n🎯 Blinds Configurator Tester\n'));

program
  .name('blinds-tester')
  .description('Test Home Depot blinds configurator max height constraints')
  .version('1.0.0');

program
  .command('quick')
  .description('Run quick verification test (70" x 125")')
  .action(() => {
    console.log(chalk.cyan('Running quick test...\n'));
    execSync('node quick-test.js', { stdio: 'inherit' });
  });

program
  .command('manual <width> <height> [mount]')
  .description('Test specific dimensions (mount: inside|outside)')
  .action((width, height, mount = 'inside') => {
    console.log(chalk.cyan(`Testing ${width}" x ${height}" (${mount} mount)...\n`));
    execSync(`node manual-test.js ${width} ${height} ${mount}`, { stdio: 'inherit' });
  });

program
  .command('full')
  .description('Run full test suite on all focus products')
  .option('-h, --headless', 'run in headless mode')
  .action((options) => {
    console.log(chalk.cyan('Running full test suite...\n'));
    const cmd = options.headless ? 'node index.js --headless' : 'node index.js';
    execSync(cmd, { stdio: 'inherit' });
  });

program
  .command('product <name>')
  .description('Test specific product (e.g., "Newport")')
  .option('-h, --headless', 'run in headless mode')
  .action((name, options) => {
    console.log(chalk.cyan(`Testing product: ${name}...\n`));
    const cmd = options.headless 
      ? `node index.js -p "${name}" --headless`
      : `node index.js -p "${name}"`;
    execSync(cmd, { stdio: 'inherit' });
  });

program
  .command('width <width>')
  .description('Test specific width breakpoint')
  .option('-h, --headless', 'run in headless mode')
  .action((width, options) => {
    console.log(chalk.cyan(`Testing width: ${width}"...\n`));
    const cmd = options.headless 
      ? `node index.js -w ${width} --headless`
      : `node index.js -w ${width}`;
    execSync(cmd, { stdio: 'inherit' });
  });

program
  .command('help-examples')
  .description('Show usage examples')
  .action(() => {
    console.log(chalk.bold('\n📖 Usage Examples:\n'));
    console.log(chalk.cyan('1. Quick test to verify setup:'));
    console.log('   npm run test:quick');
    console.log('   or: node cli.js quick\n');
    
    console.log(chalk.cyan('2. Test specific dimensions manually:'));
    console.log('   node cli.js manual 70 125 inside');
    console.log('   node cli.js manual 90 140 outside\n');
    
    console.log(chalk.cyan('3. Run full test suite:'));
    console.log('   npm start');
    console.log('   or: node cli.js full\n');
    
    console.log(chalk.cyan('4. Test specific product:'));
    console.log('   node cli.js product "Newport"');
    console.log('   node cli.js product "Catalina"\n');
    
    console.log(chalk.cyan('5. Test specific width:'));
    console.log('   node cli.js width 72');
    console.log('   node cli.js width 90\n');
    
    console.log(chalk.cyan('6. Run in headless mode:'));
    console.log('   node cli.js full --headless');
    console.log('   node cli.js product "Newport" --headless\n');
  });

program.parse();
