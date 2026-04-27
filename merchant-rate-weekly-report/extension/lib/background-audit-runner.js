import { runMerchantRateAudit, buildSheetExport } from './audit-pipeline.js';
import { getGoogleAuthToken } from './google-auth.js';
import { writeAuditToNewSheetTab } from './google-sheets-rest.js';
import { readExtensionSettings } from './extension-settings.js';
import { friendlyGoogleAuthError, oauthClientPrecheckMessage } from './oauth-helper.js';
import { writeAuditJob } from './audit-run-state.js';

async function obtainGoogleToken() {
  try {
    return await getGoogleAuthToken(false);
  } catch {
    /* no cached token */
  }
  return getGoogleAuthToken(true);
}

/**
 * Runs full audit + optional Sheets export; updates chrome.storage.local merchantRateAuditJob.
 * @param {{ appIds: number[] }} payload
 */
export async function runAuditJobInServiceWorker(payload) {
  const { appIds } = payload;
  const startedAt = new Date().toISOString();

  await writeAuditJob({
    phase: 'running',
    startedAt,
    appIds: [...appIds]
  });

  try {
    const settings = await readExtensionSettings();
    const needsGoogle = !!(settings.useBigQuery || settings.syncToSheets);

    let accessToken = null;
    if (needsGoogle) {
      const pre = oauthClientPrecheckMessage();
      if (pre) {
        await writeAuditJob({
          phase: 'error',
          startedAt,
          finishedAt: new Date().toISOString(),
          appIds: [...appIds],
          error: `${pre} Open Settings (gear) after fixing manifest.json.`
        });
        return { ok: false, error: pre };
      }
      try {
        accessToken = await obtainGoogleToken();
      } catch (e) {
        const msg = friendlyGoogleAuthError(e);
        await writeAuditJob({
          phase: 'error',
          startedAt,
          finishedAt: new Date().toISOString(),
          appIds: [...appIds],
          error: msg
        });
        return { ok: false, error: msg };
      }
    }

    const { report, rows } = await runMerchantRateAudit(appIds, {
      accessToken,
      useBigQuery: !!settings.useBigQuery,
      bqProjectId: settings.bqProjectId,
      bqDateColumn: settings.bqDateColumn,
      bqLookbackMonths: settings.bqLookbackMonths
    });

    const runAt = new Date().toISOString();
    const exportLines = buildSheetExport(report, rows, runAt, appIds);
    const s = report.summary || {};

    let sheetsMessage = '';
    if (settings.syncToSheets && settings.spreadsheetId && String(settings.spreadsheetId).trim()) {
      try {
        let tokenForSheet = accessToken;
        if (!tokenForSheet) {
          tokenForSheet = await getGoogleAuthToken(true);
        }
        const { sheetTitle, rowsWritten } = await writeAuditToNewSheetTab(
          tokenForSheet,
          String(settings.spreadsheetId).trim(),
          exportLines,
          runAt
        );
        sheetsMessage = `Google Sheet: new tab "${sheetTitle}" (${rowsWritten} rows).`;
      } catch (e) {
        sheetsMessage = `Sheets export failed: ${e.message || String(e)}`;
      }
    }

    const baseMsg = rows.length ? `Done — ${rows.length} issue row(s).` : 'Done — no issues.';
    const statusMessage = sheetsMessage ? `${baseMsg} · ${sheetsMessage}` : baseMsg;

    await writeAuditJob({
      phase: 'done',
      startedAt,
      finishedAt: new Date().toISOString(),
      appIds: [...appIds],
      runAt,
      summary: s,
      rows,
      exportLines,
      statusMessage,
      sheetsMessage: sheetsMessage || undefined
    });

    return { ok: true };
  } catch (e) {
    const msg = e.message || String(e);
    await writeAuditJob({
      phase: 'error',
      startedAt,
      finishedAt: new Date().toISOString(),
      appIds: [...appIds],
      error: msg
    });
    return { ok: false, error: msg };
  }
}
