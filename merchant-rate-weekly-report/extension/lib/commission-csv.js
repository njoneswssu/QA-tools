/**
 * Commission enrichment from BigQuery map + severity adjust (same idea as weekly-commission-fetch.js).
 * Pasted CSV is no longer used in the extension UI; this module still parses CSV if called programmatically.
 */

export function collectMerchantIdsFromReport(report) {
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

/** @returns {Map<string, number>} */
export function loadCommissionDataFromCSVString(content) {
  const map = new Map();
  if (!content || !String(content).trim()) return map;
  try {
    const lines = String(content).split(/\r?\n/).filter((l) => l.trim());
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

function rowHasNumericCommission(r) {
  if (!r || r.commission === '' || r.commission === undefined || r.commission === null) return false;
  const n = Number(r.commission);
  return !isNaN(n) && isFinite(n);
}

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

  const withComm = issueRows.filter(rowHasNumericCommission);
  if (withComm.length === 0) return;

  const amounts = withComm.map((r) => Number(r.commission));
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
    return 'high';
  }

  for (const r of issueRows) {
    if (!rowHasNumericCommission(r)) continue;
    r.severity = severityForAmount(Number(r.commission));
  }
}

export function enrichWeeklyRowsWithCommissions(rows, commissionMap) {
  const map = commissionMap && commissionMap.get ? commissionMap : new Map();
  for (const r of rows || []) {
    const v = map.get(String(r.merchantId));
    if (v !== undefined && v !== null && !isNaN(Number(v))) r.commission = Number(v);
    else r.commission = '';
  }
  adjustSeverityByCommission(rows);
  return rows;
}
