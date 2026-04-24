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

  return Array.from(merchantIssuesMap.values()).map((item) => ({
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
}

module.exports = { generateReport, generateSimplifiedExport };
