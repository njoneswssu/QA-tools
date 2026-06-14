import { runMerchantRateAudit, buildSheetExport } from './audit-pipeline.js';
import { getGoogleAuthToken } from './google-auth.js';
import { writeAuditToNewSheetTab } from './google-sheets-rest.js';
import { readExtensionSettings } from './extension-settings.js';
import { friendlyGoogleAuthError, oauthClientPrecheckMessage } from './oauth-helper.js';
import { writeAuditJob } from './audit-run-state.js';

/** Silent token only (no interactive UI from the service worker for BigQuery-only). */
async function getGoogleTokenSilent() {
  try {
    return await getGoogleAuthToken(false);
  } catch {
    return null;
  }
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
    const wantsSheets = !!(settings.syncToSheets && String(settings.spreadsheetId || '').trim());
    const wantsBq = !!settings.useBigQuery;
    const needsGoogleForAuth = wantsSheets || wantsBq;

    let accessToken = null;
    if (needsGoogleForAuth) {
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
      accessToken = await getGoogleTokenSilent();
      if (!accessToken && wantsSheets) {
        const msg =
          'Google sign-in required: open extension Settings (click the gear on the popup or “settings” below), choose **Sign in with Google**, then run the audit again.';
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

    const useBigQueryEffective = !!(settings.useBigQuery && accessToken);

    const { report, rows } = await runMerchantRateAudit(appIds, {
      accessToken,
      useBigQuery: useBigQueryEffective,
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
        const { sheetTitle, rowsWritten } = await writeAuditToNewSheetTab(
          accessToken,
          String(settings.spreadsheetId).trim(),
          exportLines,
          runAt
        );
        sheetsMessage = `Google Sheet: new tab "${sheetTitle}" (${rowsWritten} rows).`;
      } catch (e) {
        sheetsMessage = `Sheets export failed: ${e.message || String(e)}`;
      }
    }

    const bqSkipped =
      wantsBq && !accessToken
        ? 'BigQuery commissions skipped — sign in with your Wildfire Google account in Settings (gear) on a signed-in browser.'
        : '';
    const baseMsg = rows.length ? `Done — ${rows.length} issue row(s).` : 'Done — no issues.';
    const parts = [baseMsg, bqSkipped, sheetsMessage].filter(Boolean);
    const statusMessage = parts.join(' · ');

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
