#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const resultsDir = path.join(__dirname, 'test-results');

console.log(chalk.bold.yellow('\n⚠️  Delete All Test Results\n'));
console.log(chalk.gray(`Directory: ${resultsDir}\n`));

if (!fs.existsSync(resultsDir)) {
  console.log(chalk.yellow('No test-results directory found.'));
  process.exit(0);
}

const files = fs.readdirSync(resultsDir);

if (files.length === 0) {
  console.log(chalk.yellow('No test results to delete.'));
  process.exit(0);
}

console.log(chalk.cyan(`Found ${files.length} files:\n`));
files.slice(0, 10).forEach(file => {
  console.log(chalk.gray(`  - ${file}`));
});

if (files.length > 10) {
  console.log(chalk.gray(`  ... and ${files.length - 10} more\n`));
}

// Check if running with --force flag
const forceDelete = process.argv.includes('--force');

if (!forceDelete) {
  console.log(chalk.red('\n❌ Delete cancelled.'));
  console.log(chalk.yellow('\nTo delete all results, run:'));
  console.log(chalk.white('  npm run clean-results -- --force'));
  console.log(chalk.gray('  or'));
  console.log(chalk.white('  node delete-results.js --force\n'));
  process.exit(0);
}

// Delete all files
console.log(chalk.red('\n🗑️  Deleting all test results...\n'));

let deletedCount = 0;
files.forEach(file => {
  const filePath = path.join(resultsDir, file);
  try {
    fs.unlinkSync(filePath);
    deletedCount++;
    if (deletedCount <= 5) {
      console.log(chalk.gray(`  ✓ Deleted ${file}`));
    }
  } catch (error) {
    console.log(chalk.red(`  ✗ Failed to delete ${file}: ${error.message}`));
  }
});

if (deletedCount > 5) {
  console.log(chalk.gray(`  ... and ${deletedCount - 5} more files`));
}

console.log(chalk.green(`\n✅ Successfully deleted ${deletedCount} files\n`));
