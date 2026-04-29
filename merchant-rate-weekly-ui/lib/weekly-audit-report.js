/**
 * Report helpers duplicated from merchant-rate-auditor logic (keep in sync if auditor export shape changes).
 * Intentionally lives in merchant-rate-weekly-ui only — do not modify merchant-rate-auditor for the weekly UI.
 */

function generateReport(results) {
  const totalMerchants = results.reduce((sum, r) => sum + r.totalMerchants, 0);
  const merchantsWithIssues = results.reduce((sum, r) => sum + (r.issues || []).length, 0);
  return {
    summary: {
      totalAppIds: results.length,
      successfulAppIds: results.filter((r) => r.success).length,
      totalMerchants,
      merchantsWithNoIssues: totalMerchants - merchantsWithIssues,
      merchantsWithIssues,
      totalRates: results.reduce((sum, r) => sum + r.totalRates, 0),
      totalIssues: results.reduce((sum, r) => sum + (r.issues || []).length, 0),
      timestamp: new Date().toISOString()
    },
    results
  };
}

function severityRank(s) {
  const t = String(s || '').toLowerCase();
  if (t === 'high') return 3;
  if (t === 'medium') return 2;
  if (t === 'low') return 1;
  return 0;
}

/**
 * One sheet row per merchant ID (aggregates cross–app-ID and multi–issue-type rows).
 */
function mergeExportRowsByMerchantId(rows) {
  const groups = new Map();
  let noIdSeq = 0;
  for (const r of rows || []) {
    const raw = r.merchantId;
    const id =
      raw != null && String(raw).trim() !== '' ? String(raw).trim() : `__no_merchant_id__${noIdSeq++}`;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(r);
  }

  const out = [];
  for (const [, arr] of groups) {
    if (arr.length === 1) {
      out.push(arr[0]);
      continue;
    }
    const totalCount = arr.reduce((s, r) => s + Number(r.count || 0), 0);
    const issueTypes = [
      ...new Set(arr.map((x) => String(x.issueType || '').trim()).filter(Boolean))
    ].sort();
    const appIds = [
      ...new Set(arr.map((x) => String(x.appId != null ? x.appId : '').trim()).filter(Boolean))
    ].sort((a, b) => Number(a) - Number(b));

    let bestSev = 'low';
    for (const r of arr) {
      if (severityRank(r.severity) > severityRank(bestSev)) bestSev = r.severity;
    }

    const rep = arr
      .slice()
      .sort((a, b) => {
        const d = severityRank(b.severity) - severityRank(a.severity);
        if (d !== 0) return d;
        return Number(b.count || 0) - Number(a.count || 0);
      })[0];

    const catRow = arr.find((x) => x.merchantCategory != null && String(x.merchantCategory).trim() !== '');
    out.push({
      merchantName: rep.merchantName,
      merchantId: rep.merchantId,
      merchantCategory: catRow ? catRow.merchantCategory : rep.merchantCategory,
      appId: appIds.length ? appIds.join('; ') : rep.appId,
      issueType: issueTypes.length ? issueTypes.join('; ') : rep.issueType,
      severity: bestSev,
      reason: rep.reason,
      rateName: rep.rateName,
      rateAmount: rep.rateAmount,
      count: totalCount
    });
  }
  return out;
}

function generateSimplifiedExport(report) {
  const merchantIssuesMap = new Map();

  for (const result of report.results) {
    if (!result.success || !result.issues) continue;

    for (const issueGroup of result.issues) {
      const merchantName = issueGroup.merchantName || `Merchant ID ${issueGroup.merchantId}`;
      const merchantId = issueGroup.merchantId;
      const merchantCategory = issueGroup.merchantCategory || null;
      const appId = result.appId;

      for (const issue of issueGroup.issues) {
        const issueType = issue.type;
        const key = `${merchantId}-${appId}-${issueType}`;

        if (!merchantIssuesMap.has(key)) {
          merchantIssuesMap.set(key, {
            merchantName,
            merchantId,
            merchantCategory,
            appId,
            issueType: issue.type,
            severity: issue.severity,
            count: 1,
            example: {
              message: issue.message,
              rateName: issue.rate.Name || '(empty)',
              rateAmount: issue.rate.Amount || '(empty)'
            }
          });
        } else {
          merchantIssuesMap.get(key).count++;
        }
      }
    }
  }

  const flat = Array.from(merchantIssuesMap.values()).map((item) => ({
    merchantName: item.merchantName,
    merchantId: item.merchantId,
    merchantCategory: item.merchantCategory,
    appId: item.appId,
    issueType: item.issueType,
    severity: item.severity,
    reason: item.example.message,
    rateName: item.example.rateName,
    rateAmount: item.example.rateAmount,
    count: item.count
  }));

  return mergeExportRowsByMerchantId(flat);
}

module.exports = { generateReport, generateSimplifiedExport };
