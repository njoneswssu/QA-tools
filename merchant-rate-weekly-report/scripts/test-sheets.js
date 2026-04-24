#!/usr/bin/env node
/**
 * Smoke test: load .env from project root, verify credentials + SPREADSHEET_ID,
 * create a new tab (same path as audit sync) with one test row.
 * Run from repo: cd merchant-rate-weekly-ui && node scripts/test-sheets.js
 */
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
process.chdir(root);
require('dotenv').config({ path: path.join(root, '.env') });

const { HEADER } = require('../lib/audit-runner');
const { syncAuditRows, formatSheetsApiError } = require('../lib/sheets');

async function main() {
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const resolved = keyPath ? path.resolve(root, keyPath) : null;
  console.log('cwd:', process.cwd());
  console.log('SPREADSHEET_ID:', process.env.SPREADSHEET_ID || '(missing)');
  console.log('GOOGLE_APPLICATION_CREDENTIALS:', keyPath || '(missing)');
  console.log('resolved key file:', resolved);
  if (!resolved || !fs.existsSync(resolved)) {
    console.error(
      '\nFAIL: Service account JSON not found. Set GOOGLE_APPLICATION_CREDENTIALS in .env to a path under this folder (e.g. ./secrets/your-key.json).'
    );
    process.exit(1);
  }

  const runIso = new Date().toISOString();
  const dateStr = runIso.slice(0, 10);
  const testRow = [
    dateStr,
    'Sheets smoke test',
    '',
    'test',
    '',
    '',
    'TEST',
    'OK',
    'If you see this tab, Sheets API + sharing are working.',
    '',
    '',
    '1'
  ];

  try {
    const r = await syncAuditRows(HEADER, [testRow], runIso);
    console.log('\nOK:', JSON.stringify(r, null, 2));
    console.log('\nOpen the spreadsheet and look for tab:', r.sheetTitle);
  } catch (e) {
    console.error('\nFAIL:', formatSheetsApiError(e));
    process.exit(1);
  }
}

main();
