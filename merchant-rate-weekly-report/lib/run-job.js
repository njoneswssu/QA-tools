const { runMerchantRateAudit, rowsToSheetValues, HEADER, readAppIdsFromFile } = require('./audit-runner');
const { syncAuditRows } = require('./sheets');
const { writeState } = require('./state');

/** One data row so a sync run always produces a visible tab when there are zero issue rows */
function noIssuesSheetValues(runIso, summary, appIds) {
  const dateStr = runIso.slice(0, 10);
  const apps = (appIds || []).join('; ');
  const scanned = summary.totalMerchants ?? 'n/a';
  return [
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
}

let runLock = false;

function normalizeOverrideAppIds(override) {
  if (override == null) return null;
  const arr = Array.isArray(override) ? override : [override];
  const parsed = []
    .concat(arr)
    .flatMap((x) => String(x).split(/[,\s]+/))
    .map((s) => parseInt(String(s).trim(), 10))
    .filter((n) => !isNaN(n) && n > 0);
  return parsed.length > 0 ? parsed : null;
}

/**
 * @param {{ syncSheet: boolean, appIds?: unknown }} opts
 * When the UI sends `appIds` and it parses to at least one ID, that list is used for this run only (not written to config).
 * Otherwise uses saved `data/config.json` (cron, blank textarea, or omit `appIds` in the request body).
 */
async function executeAuditAndSync({ syncSheet, appIds: appIdsOverride }) {
  if (runLock) {
    return { ok: false, message: 'A run is already in progress.' };
  }
  runLock = true;
  writeState({ running: true });
  const runAt = new Date().toISOString();
  try {
    const fromUi = normalizeOverrideAppIds(appIdsOverride);
    const appIds = fromUi || readAppIdsFromFile();
    const { report, rows } = await runMerchantRateAudit(appIds);
    const summary = report.summary || {};
    const message =
      rows.length === 0
        ? `No rate issues found. Scanned ${summary.totalMerchants ?? 0} merchant(s) across ${appIds.length} app ID(s).`
        : `${rows.length} issue row(s) across ${appIds.length} app ID(s); ${summary.totalMerchants ?? 0} merchant(s) scanned.`;
    writeState({
      running: false,
      lastRunAt: runAt,
      lastRunOk: true,
      lastRunMessage: message,
      lastRowsCount: rows.length,
      lastSummary: summary
    });

    let sheetResult = null;
    if (syncSheet) {
      try {
        const values =
          rows.length === 0 ? noIssuesSheetValues(runAt, summary, appIds) : rowsToSheetValues(rows, runAt);
        const { rowsWritten, sheetTitle, mode } = await syncAuditRows(HEADER, values, runAt);
        sheetResult = {
          ok: true,
          message:
            mode === 'new_tab'
              ? `Created new tab "${sheetTitle}" with ${rowsWritten} row(s) (header + data).`
              : `Appended ${rowsWritten} row(s) to tab "${sheetTitle}".`
        };
        writeState({
          lastSheetSyncAt: new Date().toISOString(),
          lastSheetSyncOk: true,
          lastSheetSyncMessage: sheetResult.message
        });
      } catch (e) {
        const msg = e.message || String(e);
        writeState({
          lastSheetSyncAt: new Date().toISOString(),
          lastSheetSyncOk: false,
          lastSheetSyncMessage: msg
        });
        sheetResult = { ok: false, message: msg };
      }
    }

    return {
      ok: true,
      message,
      summary,
      rowsCount: rows.length,
      appIds,
      sheet: sheetResult
    };
  } catch (e) {
    const msg = e.message || String(e);
    writeState({
      running: false,
      lastRunAt: runAt,
      lastRunOk: false,
      lastRunMessage: msg
    });
    return { ok: false, message: msg };
  } finally {
    runLock = false;
    writeState({ running: false });
  }
}

module.exports = { executeAuditAndSync };
