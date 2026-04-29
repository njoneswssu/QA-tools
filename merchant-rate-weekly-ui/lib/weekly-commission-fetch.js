/**
 * BigQuery + CSV commission loading for the weekly UI only.
 * Env: COMMISSION_USE_ADC, BIGQUERY_APPLICATION_CREDENTIALS, COMMISSION_CSV_PATH, COMMISSION_DATE_COLUMN,
 *      BIGQUERY_PROJECT_ID, GOOGLE_APPLICATION_CREDENTIALS (Sheets; temporarily unset for BQ when using ADC).
 */

const path = require('path');
const fs = require('fs');

const UI_ROOT = path.resolve(__dirname, '..');

let BigQuery = null;
try {
  BigQuery = require('@google-cloud/bigquery').BigQuery;
} catch (_) {}

const DEFAULT_BQ_PROJECT = 'wildfire-1000';
const COMMISSION_LOOKBACK_MONTHS = Number(process.env.COMMISSION_LOOKBACK_MONTHS) || 6;

function getBigQueryProjectId() {
  const fromEnv =
    process.env.BIGQUERY_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  if (fromEnv && String(fromEnv).trim()) return String(fromEnv).trim();
  return DEFAULT_BQ_PROJECT;
}

function resolveGoogleApplicationCredentialsPath() {
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyPath || !String(keyPath).trim()) return null;
  const trimmed = String(keyPath).trim();
  let resolved = path.isAbsolute(trimmed) ? trimmed : path.resolve(process.cwd(), trimmed);
  if (fs.existsSync(resolved)) return resolved;
  if (!path.isAbsolute(trimmed)) {
    const rel = trimmed.replace(/^\.\//, '');
    const underUi = path.resolve(UI_ROOT, rel);
    if (fs.existsSync(underUi)) return underUi;
    const secrets = path.resolve(UI_ROOT, 'secrets', path.basename(trimmed));
    if (fs.existsSync(secrets)) return secrets;
  }
  return resolved;
}

function resolveBigQueryKeyFilename() {
  const raw = process.env.BIGQUERY_APPLICATION_CREDENTIALS || process.env.COMMISSION_GOOGLE_APPLICATION_CREDENTIALS;
  if (raw && String(raw).trim()) {
    const trimmed = String(raw).trim();
    let resolved = path.isAbsolute(trimmed) ? trimmed : path.resolve(process.cwd(), trimmed);
    if (fs.existsSync(resolved)) return resolved;
    if (!path.isAbsolute(trimmed)) {
      const rel = trimmed.replace(/^\.\//, '');
      const underUi = path.resolve(UI_ROOT, rel);
      if (fs.existsSync(underUi)) return underUi;
      const secrets = path.resolve(UI_ROOT, 'secrets', path.basename(trimmed));
      if (fs.existsSync(secrets)) return secrets;
    }
    return fs.existsSync(resolved) ? resolved : null;
  }
  const useAdc =
    process.env.COMMISSION_USE_ADC === '1' ||
    process.env.COMMISSION_USE_APPLICATION_DEFAULT_CREDENTIALS === '1';
  if (useAdc) return null;
  const gac = resolveGoogleApplicationCredentialsPath();
  return gac && fs.existsSync(gac) ? gac : null;
}

function commissionPullShouldIgnoreSheetsKeyFile() {
  const hasBqDedicatedKey = !!(
    (process.env.BIGQUERY_APPLICATION_CREDENTIALS || process.env.COMMISSION_GOOGLE_APPLICATION_CREDENTIALS || '')
      .trim()
  );
  if (hasBqDedicatedKey) return false;
  return (
    process.env.COMMISSION_USE_ADC === '1' ||
    process.env.COMMISSION_USE_APPLICATION_DEFAULT_CREDENTIALS === '1'
  );
}

async function runBigQueryUnscopedFromSheetsServiceAccount(asyncFn) {
  if (!commissionPullShouldIgnoreSheetsKeyFile()) {
    return asyncFn();
  }
  const saved = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (saved) {
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }
  try {
    return await asyncFn();
  } finally {
    if (saved !== undefined) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = saved;
    }
  }
}

function createBigQueryClient() {
  const projectId = getBigQueryProjectId();
  const keyFile = resolveBigQueryKeyFilename();
  if (BigQuery && keyFile && fs.existsSync(keyFile)) {
    return new BigQuery({ projectId, keyFilename: keyFile });
  }
  if (BigQuery) return new BigQuery({ projectId });
  return null;
}

function getCommissionDateColumnNameOrNull() {
  const fromEnv = process.env.COMMISSION_DATE_COLUMN;
  const raw = String(
    fromEnv != null && String(fromEnv).trim() !== '' ? fromEnv : process.env.COMMISSION_DATE_DEFAULT || ''
  ).trim();
  if (!raw || /^none$/i.test(raw) || /^off$/i.test(raw)) return null;
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(raw)) return null;
  return raw;
}

function commissionDatePredicateSql() {
  const col = getCommissionDateColumnNameOrNull();
  if (!col) return '';
  return ` AND DATE(c.${col}) >= DATE_SUB(CURRENT_DATE(), INTERVAL ${COMMISSION_LOOKBACK_MONTHS} MONTH)`;
}

function collectMerchantIdsFromReport(report) {
  const ids = new Set();
  for (const result of report.results || []) {
    if (!result.success) continue;
    for (const m of result.allMerchants || []) {
      if (m.merchantId != null) ids.add(Number(m.merchantId));
    }
    for (const issueGroup of result.issues || []) {
      if (issueGroup.merchantId != null) ids.add(Number(issueGroup.merchantId));
    }
  }
  return [...ids];
}

function loadCommissionDataFromCSV(filepath) {
  const map = new Map();
  if (!filepath || !fs.existsSync(filepath)) return map;
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    const lines = content.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return map;
    const header = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    const midx = header.findIndex((h) => /merchant_id/i.test(h));
    const cidx = header.findIndex((h) => /total_commission|commission_amount|commission/i.test(h));
    if (midx < 0 || cidx < 0) return map;
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
      const merchantId = parts[midx];
      const commission = parseFloat(parts[cidx]);
      if (merchantId && !isNaN(commission)) map.set(String(merchantId), commission);
    }
  } catch (_) {}
  return map;
}

function logBqHint(err) {
  const msg = String((err && err.message) || err || '');
  if (/bigquery\.jobs\.create|Access Denied|PERMISSION_DENIED|permission/i.test(msg)) {
    console.warn(
      '[weekly-ui][BigQuery] IAM: grant bigquery.jobUser (+ data access) on project ' +
        getBigQueryProjectId() +
        ', or set COMMISSION_USE_ADC=1 after gcloud auth application-default login, or BIGQUERY_APPLICATION_CREDENTIALS.'
    );
  }
  if (/not found inside c|Unrecognized name:/i.test(msg)) {
    console.warn(
      '[weekly-ui][BigQuery] Date column: unset COMMISSION_DATE_COLUMN or use none for all-time sums; or set a valid column name for a lookback window.'
    );
  }
}

/**
 * @returns {Promise<Map<string, number>>}
 */
async function fetchWeeklyCommissionMap(merchantIds) {
  if (!BigQuery || !merchantIds || merchantIds.length === 0) return new Map();
  const ids = merchantIds.map(Number).filter((n) => !isNaN(n) && n > 0);
  if (ids.length === 0) return new Map();
  const inList = ids.join(', ');
  const datePred = commissionDatePredicateSql();
  const query = `
    SELECT m.name, c.merchant_id, sum(c.commission_amount) as Total_Commissions
    FROM \`wildfire-1000.stephsandbox.commission_detail_view_2\` c
    JOIN \`wildfire-1000.firepublic.merchant\` m ON c.merchant_id = m.ID
    WHERE c.merchant_id IN (${inList})${datePred}
    GROUP BY c.merchant_id, m.name
    ORDER BY sum(c.commission_amount) DESC
  `;

  return runBigQueryUnscopedFromSheetsServiceAccount(async () => {
    try {
      const bigquery = createBigQueryClient();
      if (!bigquery) return new Map();
      const [rows] = await bigquery.query({ query });
      const map = new Map();
      for (const row of rows || []) {
        const id = row.merchant_id != null ? String(row.merchant_id) : null;
        const commission = row.Total_Commissions != null ? Number(row.Total_Commissions) : NaN;
        if (id && !isNaN(commission)) map.set(id, commission);
      }
      return map;
    } catch (err) {
      console.warn('[weekly-ui][BigQuery] ' + (err.message || err));
      logBqHint(err);
      return new Map();
    }
  });
}

/** Missing, non-numeric, or ≤0 commission → treated as no payout for severity. */
function rowCommissionIsMissingOrZero(r) {
  if (!r || r.commission === '' || r.commission === undefined || r.commission === null) return true;
  const n = Number(r.commission);
  if (isNaN(n) || !isFinite(n)) return true;
  return n <= 0;
}

function rowHasPositiveCommission(r) {
  if (!r || r.commission === '' || r.commission === undefined || r.commission === null) return false;
  const n = Number(r.commission);
  return !isNaN(n) && isFinite(n) && n > 0;
}

/**
 * Sheet severity: only **high** | **medium** | **low**.
 * No commission data or **0** commission → **low**. Positive commissions → tertiles on log scale within the batch.
 */
function adjustSeverityByCommission(rows) {
  const issueRows = (rows || []).filter(
    (r) =>
      r &&
      r.issueType &&
      String(r.issueType).trim() !== '' &&
      r.issueType !== 'None' &&
      r.issueType !== 'Info'
  );
  if (issueRows.length === 0) return;

  const positive = issueRows.filter(rowHasPositiveCommission);

  if (positive.length === 0) {
    for (const r of issueRows) {
      r.severity = 'low';
    }
    return;
  }

  const amounts = positive.map((r) => Number(r.commission));
  const minC = Math.min(...amounts);
  const maxC = Math.max(...amounts);

  function severityForAmount(c) {
    if (maxC > minC) {
      const lo = Math.log1p(Math.max(0, minC));
      const hi = Math.log1p(Math.max(0, maxC));
      const t = hi > lo ? (Math.log1p(Math.max(0, c)) - lo) / (hi - lo) : 1;
      if (t >= 2 / 3) return 'high';
      if (t >= 1 / 3) return 'medium';
      return 'low';
    }
    return 'medium';
  }

  for (const r of issueRows) {
    if (rowCommissionIsMissingOrZero(r)) {
      r.severity = 'low';
      continue;
    }
    r.severity = severityForAmount(Number(r.commission));
  }
}

function enrichWeeklyRowsWithCommissions(rows, commissionMap) {
  const map = commissionMap && commissionMap.get ? commissionMap : new Map();
  for (const r of rows || []) {
    const v = map.get(String(r.merchantId));
    if (v !== undefined && v !== null && !isNaN(Number(v))) r.commission = Number(v);
    else r.commission = '';
  }
  adjustSeverityByCommission(rows);
  return rows;
}

module.exports = {
  collectMerchantIdsFromReport,
  fetchWeeklyCommissionMap,
  loadCommissionDataFromCSV,
  enrichWeeklyRowsWithCommissions
};
