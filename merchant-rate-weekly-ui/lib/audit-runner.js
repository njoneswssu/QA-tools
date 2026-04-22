const path = require('path');
const fs = require('fs');

const { generateReport, generateSimplifiedExport } = require('./weekly-audit-report');
const {
  collectMerchantIdsFromReport,
  fetchWeeklyCommissionMap,
  loadCommissionDataFromCSV,
  enrichWeeklyRowsWithCommissions
} = require('./weekly-commission-fetch');

const AUDITOR_DIR = path.resolve(__dirname, '../../merchant-rate-auditor');

/**
 * Run merchant rate audits for the given App IDs and return { report, rows }.
 * rows = simplified issue rows for Sheets (same shape as generateSimplifiedExport).
 */
async function runMerchantRateAudit(appIds) {
  const ids = (appIds || []).map((id) => parseInt(String(id).trim(), 10)).filter((n) => !isNaN(n) && n > 0);
  if (ids.length === 0) {
    throw new Error('No valid App IDs');
  }

  const prevCwd = process.cwd();
  const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (gac && String(gac).trim() && !path.isAbsolute(path.normalize(String(gac).trim()))) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(prevCwd, String(gac).trim());
  }
  process.chdir(AUDITOR_DIR);
  try {
    const auditor = require(path.join(AUDITOR_DIR, 'auditor.js'));
    const results = [];
    for (const appId of ids) {
      const result = await auditor.auditAppId(appId);
      results.push(result);
    }
    const report = auditor.generateReport(results);
    let rows = auditor.generateSimplifiedExport(report);
    const merchantIds = auditor.collectMerchantIdsFromReport(report);
    let commissionMap = await auditor.fetchCommissionFromBigQuery(merchantIds);
    const csvPath = process.env.COMMISSION_CSV_PATH;
    if ((!commissionMap || commissionMap.size === 0) && csvPath && String(csvPath).trim()) {
      const csvResolved = path.isAbsolute(csvPath.trim())
        ? csvPath.trim()
        : path.resolve(prevCwd, csvPath.trim());
      const fromCsv = auditor.loadCommissionDataFromCSV(csvResolved);
      if (fromCsv && fromCsv.size > 0) commissionMap = fromCsv;
    }
    rows = auditor.enrichExportRowsWithCommissions(rows, commissionMap);
    return { report, rows, appIds: ids };
  } finally {
    process.chdir(prevCwd);
  }
}

function rowsToSheetValues(rows, runDateIso) {
  const dateStr = runDateIso.slice(0, 10);
  return rows.map((r) => {
    const commRaw = r.commission;
    let commCell = '';
    if (commRaw !== undefined && commRaw !== null && commRaw !== '') {
      const n = Number(commRaw);
      commCell = !isNaN(n) && isFinite(n) ? n : '';
    }
    return [
    dateStr,
    r.merchantName || '',
    String(r.merchantId ?? ''),
    String(r.appId ?? ''),
    r.merchantCategory || '',
    commCell,
    r.issueType || '',
    r.severity || '',
    (r.reason || '').replace(/\r?\n/g, ' '),
    r.rateName || '',
    r.rateAmount || '',
    String(r.count ?? '')
    ];
  });
}

const HEADER = [
  'Run date',
  'Merchant name',
  'Merchant ID',
  'App ID',
  'Merchant category',
  'Total commissions',
  'Issue type',
  'Severity',
  'Reason',
  'Rate name',
  'Rate amount',
  'Count'
];

module.exports = {
  runMerchantRateAudit,
  rowsToSheetValues,
  HEADER,
  getConfigPath: () => path.join(__dirname, '../data/config.json'),
  readAppIdsFromFile() {
    const p = path.join(__dirname, '../data/config.json');
    if (!fs.existsSync(p)) return [451, 206, 209];
    try {
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      const ids = (j.appIds || []).map((x) => parseInt(String(x), 10)).filter((n) => !isNaN(n) && n > 0);
      return ids.length ? ids : [451, 206, 209];
    } catch (_) {
      return [451, 206, 209];
    }
  },
  writeAppIdsToFile(appIds) {
    const dir = path.join(__dirname, '../data');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const p = path.join(dir, 'config.json');
    fs.writeFileSync(p, JSON.stringify({ appIds }, null, 2), 'utf8');
  }
};
