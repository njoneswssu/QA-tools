#!/usr/bin/env node
/**
 * Fetches two Wildlink active-domain/1 feeds, normalizes rows, and writes:
 * - Default: one .xlsx workbook with sheets RBC, Koho, Koho_not_in_RBC
 * - With --format csv: three CSV files (plain CSV has no worksheet tabs)
 *
 * Env: RBC_FEED_URL, KOHO_FEED_URL (override defaults)
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const DEFAULT_RBC = 'https://www.wildlink.me/data/126/active-domain/1';
const DEFAULT_KOHO = 'https://www.wildlink.me/data/291/active-domain/1';

function parseArgs(argv) {
  const out = {
    format: 'xlsx',
    output: null,
    rbcUrl: process.env.RBC_FEED_URL || DEFAULT_RBC,
    kohoUrl: process.env.KOHO_FEED_URL || DEFAULT_KOHO,
    help: false,
    invalid: false
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--format' && argv[i + 1]) {
      out.format = String(argv[++i]).toLowerCase();
    } else if (a === '--output' && argv[i + 1]) out.output = argv[++i];
    else if (a === '--rbc' && argv[i + 1]) out.rbcUrl = argv[++i];
    else if (a === '--koho' && argv[i + 1]) out.kohoUrl = argv[++i];
    else if (a.startsWith('--')) {
      console.error(`Unknown option: ${a}`);
      out.help = true;
      out.invalid = true;
    }
  }
  return out;
}

function printHelp() {
  console.log(`Usage: node compare.js [options]

Writes RBC merchants, Koho merchants, and Koho rows whose Merchant ID is not
present anywhere in the RBC feed (same feed shape as Citi dashboard).

Options:
  --format xlsx|csv   Output format (default: xlsx). CSV writes three files.
  --output PATH       xlsx: file path. csv: directory path (default: ./out)
  --rbc URL           RBC active-domain URL (default: ${DEFAULT_RBC})
  --koho URL          Koho active-domain URL (default: ${DEFAULT_KOHO})

Environment:
  RBC_FEED_URL, KOHO_FEED_URL   Same as --rbc / --koho

Note: Standard CSV cannot contain multiple tabs; use xlsx for one workbook.
`);
}

async function fetchActiveDomainJson(url) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    redirect: 'follow'
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}: ${text.slice(0, 300)}`);
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(`Not valid JSON from ${url}: ${e.message}`);
  }
  if (!Array.isArray(data)) {
    throw new Error(`Expected JSON array from ${url}`);
  }
  return data;
}

function rowFromRecord(raw) {
  const m = raw.Merchant || {};
  const mr = m.MaxRate || {};
  return {
    Merchant_Name: m.Name != null ? String(m.Name) : '',
    Domain: String(raw.Domain || '').trim(),
    Merchant_ID: m.ID != null ? m.ID : '',
    MaxRate_Kind: mr.Kind != null ? String(mr.Kind) : '',
    MaxRate_Amount: mr.Amount != null ? String(mr.Amount) : '',
    MaxRate_Currency: mr.Currency != null ? String(mr.Currency) : ''
  };
}

function merchantIdSet(rows) {
  const s = new Set();
  for (const r of rows) {
    if (r.Merchant_ID !== '' && r.Merchant_ID != null) s.add(Number(r.Merchant_ID));
  }
  return s;
}

function kohoNotInRbc(kohoRows, rbcMerchantIds) {
  return kohoRows.filter((r) => {
    const id = r.Merchant_ID;
    if (id === '' || id == null) return true;
    return !rbcMerchantIds.has(Number(id));
  });
}

/** One row per merchant name (case-insensitive); domains merged into Domain. */
function dedupeByMerchantName(rows) {
  const keyFor = (r) => {
    const n = String(r.Merchant_Name || '').trim().toLowerCase();
    return n || '\0(empty name)';
  };
  const groups = new Map();
  for (const r of rows) {
    const k = keyFor(r);
    if (!groups.has(k)) {
      groups.set(k, {
        Merchant_Name: r.Merchant_Name,
        Merchant_ID: r.Merchant_ID,
        MaxRate_Kind: r.MaxRate_Kind,
        MaxRate_Amount: r.MaxRate_Amount,
        MaxRate_Currency: r.MaxRate_Currency,
        domains: new Set()
      });
    }
    const g = groups.get(k);
    const d = String(r.Domain || '').trim();
    if (d) g.domains.add(d);
  }
  return [...groups.values()].map((g) => ({
    Merchant_Name: g.Merchant_Name,
    Domain: [...g.domains].sort().join(', '),
    Merchant_ID: g.Merchant_ID,
    MaxRate_Kind: g.MaxRate_Kind,
    MaxRate_Amount: g.MaxRate_Amount,
    MaxRate_Currency: g.MaxRate_Currency
  }));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeXlsx(rbcRows, kohoRows, diffRows, filePath) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rbcRows), 'RBC');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kohoRows), 'Koho');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(diffRows), 'Koho_not_in_RBC');
  XLSX.writeFile(wb, filePath);
}

function writeCsv(rows, filePath) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  fs.writeFileSync(filePath, csv, 'utf8');
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    process.exit(args.invalid ? 1 : 0);
  }
  if (args.format !== 'xlsx' && args.format !== 'csv') {
    console.error('Invalid --format (use xlsx or csv)');
    process.exit(1);
  }

  console.log('Fetching RBC…', args.rbcUrl);
  const rbcRaw = await fetchActiveDomainJson(args.rbcUrl);
  console.log('Fetching Koho…', args.kohoUrl);
  const kohoRaw = await fetchActiveDomainJson(args.kohoUrl);

  const rbcDomainRows = rbcRaw.map(rowFromRecord);
  const kohoDomainRows = kohoRaw.map(rowFromRecord);
  const rbcIds = merchantIdSet(rbcDomainRows);
  const diffDomainRows = kohoNotInRbc(kohoDomainRows, rbcIds);

  const rbcRows = dedupeByMerchantName(rbcDomainRows);
  const kohoRows = dedupeByMerchantName(kohoDomainRows);
  const diffRows = dedupeByMerchantName(diffDomainRows);

  console.log(
    `RBC merchants: ${rbcRows.length} (${rbcDomainRows.length} domain rows); ` +
      `Koho merchants: ${kohoRows.length} (${kohoDomainRows.length} domain rows); ` +
      `Koho not in RBC: ${diffRows.length} (${diffDomainRows.length} domain rows)`
  );

  if (args.format === 'xlsx') {
    const outPath =
      args.output ||
      path.join(process.cwd(), `rbc-koho-compare-${new Date().toISOString().slice(0, 10)}.xlsx`);
    ensureDir(path.dirname(path.resolve(outPath)));
    writeXlsx(rbcRows, kohoRows, diffRows, outPath);
    console.log('Wrote', outPath);
  } else {
    const dir = path.resolve(args.output || path.join(process.cwd(), 'out'));
    ensureDir(dir);
    const stamp = new Date().toISOString().slice(0, 10);
    const paths = {
      rbc: path.join(dir, `rbc-${stamp}.csv`),
      koho: path.join(dir, `koho-${stamp}.csv`),
      diff: path.join(dir, `koho-not-in-rbc-${stamp}.csv`)
    };
    writeCsv(rbcRows, paths.rbc);
    writeCsv(kohoRows, paths.koho);
    writeCsv(diffRows, paths.diff);
    console.log('Wrote', paths.rbc, paths.koho, paths.diff);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
