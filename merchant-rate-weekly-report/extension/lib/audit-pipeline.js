import { auditAppId } from './auditor-core.js';
import { generateReport, generateSimplifiedExport } from './weekly-audit-report.js';
import { collectMerchantIdsFromReport, enrichWeeklyRowsWithCommissions } from './commission-csv.js';
import { fetchCommissionMapFromBigQuery } from './google-bq.js';

function commissionSortKey(r) {
  const n = Number(r && r.commission);
  if (!isNaN(n) && isFinite(n)) return n;
  return -Infinity;
}

export function sortIssueRowsByCommissionDesc(rows) {
  if (!rows || rows.length < 2) return;
  rows.sort((a, b) => {
    const nb = commissionSortKey(b);
    const na = commissionSortKey(a);
    if (nb !== na) return nb - na;
    const ida = Number(a.merchantId) || 0;
    const idb = Number(b.merchantId) || 0;
    if (ida !== idb) return ida - idb;
    return String(a.issueType || '').localeCompare(String(b.issueType || ''));
  });
}

export const HEADER = [
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
  '# of Rates to Review'
];

export function rowsToSheetValues(rows, runDateIso) {
  const dateStr = runDateIso.slice(0, 10);
  return rows.map((r) => {
    const commRaw = r.commission;
    let commCell = '';
    if (commRaw !== undefined && commRaw !== null && commRaw !== '') {
      const n = Number(commRaw);
      commCell = !isNaN(n) && isFinite(n) ? Math.round(n) : '';
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

/**
 * @param {number[]} appIds
 * @param {{
 *   accessToken?: string | null,
 *   useBigQuery?: boolean,
 *   bqProjectId?: string,
 *   bqDateColumn?: string,
 *   bqLookbackMonths?: number
 * }} [opts]
 * Commission resolution: BigQuery when enabled + token (no pasted CSV).
 */
export async function runMerchantRateAudit(appIds, opts = {}) {
  const ids = (appIds || [])
    .map((id) => parseInt(String(id).trim(), 10))
    .filter((n) => !isNaN(n) && n > 0);
  if (ids.length === 0) {
    throw new Error('No valid App IDs');
  }

  const results = [];
  for (const appId of ids) {
    results.push(await auditAppId(appId));
  }

  const report = generateReport(results);
  let rows = generateSimplifiedExport(report);

  let commissionMap = new Map();

  if (opts.accessToken && opts.useBigQuery) {
    const merchantIds = collectMerchantIdsFromReport(report);
    commissionMap = await fetchCommissionMapFromBigQuery(opts.accessToken, merchantIds, {
      projectId: opts.bqProjectId || 'wildfire-1000',
      dateColumn: opts.bqDateColumn || '',
      lookbackMonths: opts.bqLookbackMonths ?? 6
    });
  }

  rows = enrichWeeklyRowsWithCommissions(rows, commissionMap);
  sortIssueRowsByCommissionDesc(rows);

  return { report, rows, appIds: ids };
}

export function rowsToTsv(values) {
  return values
    .map((row) =>
      row
        .map((cell) => {
          const s = cell === null || cell === undefined ? '' : String(cell);
          if (/[\t\n\r",]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
          return s;
        })
        .join('\t')
    )
    .join('\n');
}

/** Sheet-shaped rows: header + data (matches weekly run-job no-issues row when empty). */
export function buildSheetExport(report, rows, runAtIso, appIds) {
  const summary = report.summary || {};
  const apps = (appIds || []).join('; ');
  const scanned = summary.totalMerchants ?? 'n/a';
  if (!rows || rows.length === 0) {
    const dateStr = runAtIso.slice(0, 10);
    const one = [
      [
        dateStr,
        '(no issues)',
        '',
        apps,
        '',
        '',
        '—',
        'OK',
        `No rate issues in this run. Merchants scanned: ${scanned}. App IDs: ${apps || 'n/a'}.`,
        '',
        '',
        '0'
      ]
    ];
    return [HEADER, ...one];
  }
  return [HEADER, ...rowsToSheetValues(rows, runAtIso)];
}
