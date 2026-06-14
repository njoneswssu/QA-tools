/**
 * Create a new tab in a Google Spreadsheet with Merchant / Browser / Time (Seconds)
 * plus header + average row styling similar to the latency template.
 *
 * Credentials: same as merchant-rate auditor via `GOOGLE_APPLICATION_CREDENTIALS` (see
 * `merchant-rate-weekly-report/.env.example`), or `google-sheets-key.json` under this package or sibling repos.
 * Sheets API enabled; share the spreadsheet with the service account email (Editor).
 */
import { existsSync } from 'fs';
import { homedir } from 'os';
import { dirname, isAbsolute, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(__dirname, '..');
/** Parent of this package (e.g. `playwrightautomation` when this app lives in a subfolder). */
const REPO_ROOT = dirname(PKG_ROOT);

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

function expandUserPath(p) {
  if (!p || typeof p !== 'string') return p;
  if (p.startsWith('~/')) return join(homedir(), p.slice(2));
  if (p.startsWith('~\\')) return join(homedir(), p.slice(2));
  if (p === '~') return homedir();
  return p;
}

/** Resolve SA JSON: `GOOGLE_APPLICATION_CREDENTIALS`, then common paths under this package and repo siblings. */
export function resolveSheetsKeyFile() {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (raw) {
    const expanded = expandUserPath(raw);
    const cwd = process.cwd();
    const tries = [
      isAbsolute(raw) ? raw : null,
      expanded !== raw ? expanded : null,
      resolve(cwd, raw),
      resolve(cwd, expanded),
      resolve(PKG_ROOT, raw),
      resolve(PKG_ROOT, expanded)
    ].filter(Boolean);
    for (const p of tries) {
      if (p && existsSync(p)) return p;
    }
  }
  const fallbacks = [
    join(PKG_ROOT, 'secrets', 'google-sheets-key.json'),
    join(PKG_ROOT, '..', 'merchant-rate-weekly-report', 'secrets', 'google-sheets-key.json'),
    join(PKG_ROOT, '..', 'merchant-rate-weekly-ui', 'secrets', 'google-sheets-key.json'),
    join(REPO_ROOT, 'merchant-rate-weekly-report', 'secrets', 'google-sheets-key.json'),
    join(REPO_ROOT, 'merchant-google-latency-playwright', 'secrets', 'google-sheets-key.json'),
    join(REPO_ROOT, 'secrets', 'google-sheets-key.json')
  ];
  for (const p of fallbacks) {
    if (existsSync(p)) return p;
  }
  return null;
}

/** Extract spreadsheet id from a full URL or return the id string. */
export function parseSpreadsheetIdFromUrlOrId(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  const legacy = s.match(/[?&]id=([a-zA-Z0-9-_]+)/);
  if (legacy) return legacy[1];
  return s.replace(/\/.*$/, '').trim();
}

/** Google Sheet tab titles cannot contain : \\ / ? * [ ] */
export function sanitizeSheetTabTitle(title) {
  return String(title || '')
    .replace(/[:\\/?*[\]]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export function assertValidSpreadsheetId(spreadsheetId) {
  const id = String(spreadsheetId || '')
    .trim()
    .replace(/^['"]|['"]$/g, '');
  if (!/^[a-zA-Z0-9-_]{20,}$/.test(id)) {
    throw new Error(
      'Invalid or empty spreadsheet id. Paste the id from the sheet URL (between /d/ and /edit) or set GOOGLE_LATENCY_SPREADSHEET_ID.'
    );
  }
  return id;
}

/** Prefer full spreadsheet in batchUpdate response (replies alone are sometimes empty in newer clients). */
function extractNewSheetIdFromBatchResponse(addRes, tabTitle) {
  const updated = /** @type {any} */ (addRes)?.data?.updatedSpreadsheet;
  const fromUpdated = updated?.sheets?.find((s) => s.properties?.title === tabTitle);
  if (fromUpdated?.properties?.sheetId != null) return fromUpdated.properties.sheetId;
  const r0 = /** @type {any} */ (addRes)?.data?.replies?.[0];
  const fromReply = r0?.addSheet?.properties?.sheetId ?? r0?.addSheet?.sheetId;
  if (fromReply != null) return fromReply;
  return null;
}

function escapeSheetTitleForA1(title) {
  return `'${String(title).replace(/'/g, "''")}'`;
}

function timeSecondsForSheet(row) {
  const rw = row.recordingWallSec;
  if (rw != null && Number.isFinite(Number(rw))) return Number(rw);
  if (row.wallMs != null && Number.isFinite(Number(row.wallMs))) {
    return Math.round((Number(row.wallMs) / 1000) * 1000) / 1000;
  }
  if (row.endReason === 'offer_view' && row.secondsToOfferViewFromNav != null) {
    return row.secondsToOfferViewFromNav;
  }
  if (row.endReason === 'ema_visible' && row.secondsToEmaFromNav != null) {
    return row.secondsToEmaFromNav;
  }
  if (row.secondsToSignalFromNav != null) return row.secondsToSignalFromNav;
  return '';
}

function solidBorder() {
  return {
    style: 'SOLID',
    width: 1,
    color: { red: 0, green: 0, blue: 0 }
  };
}

/**
 * @param {string} spreadsheetId
 * @param {object[]} rows latency rows from runMerchantLatencyOnDedicatedPage
 * @param {{ browserLabel?: string; tabTitle?: string | null }} [options]
 * @returns {Promise<{ sheetId: number; tabTitle: string; spreadsheetUrl: string }>}
 */
export async function exportLatencyToGoogleSheet(spreadsheetId, rows, options = {}) {
  const keyFile = resolveSheetsKeyFile();
  if (!keyFile) {
    throw new Error(
      'No Google service-account JSON found. Set GOOGLE_APPLICATION_CREDENTIALS to the path of your service account JSON ' +
        '(see merchant-rate-weekly-report/.env.example), or copy google-sheets-key.json into ' +
        'merchant-google-latency-playwright/secrets/ or merchant-rate-weekly-report/secrets/. ' +
        'Enable the Google Sheets API on the Google Cloud project used by that JSON key, and share the spreadsheet with the service account email as Editor.'
    );
  }

  const id = assertValidSpreadsheetId(spreadsheetId);

  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: [SHEETS_SCOPE]
  });
  const sheets = google.sheets({ version: 'v4', auth });

  const browserLabel = options.browserLabel || 'Google Chrome';
  let tabTitle =
    sanitizeSheetTabTitle(
      options.tabTitle?.trim() ||
        `Latency ${new Date().toISOString().slice(0, 16).replace('T', ' ').replace(/:/g, '.')}`
    ) || `Latency ${Date.now()}`;
  tabTitle = tabTitle.slice(0, 99);

  const addSheetRequest = {
    addSheet: {
      properties: {
        title: tabTitle,
        gridProperties: { rowCount: Math.max(24, rows.length + 6), columnCount: 6 }
      }
    }
  };

  const batchBody = (/** @type {any} */ reqs) => ({
    includeSpreadsheetInResponse: true,
    requests: reqs
  });

  let addRes;
  try {
    addRes = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: id,
      requestBody: batchBody([addSheetRequest])
    });
  } catch (e) {
    const msg = String(/** @type {any} */ (e)?.message || e);
    if (/already exists|duplicate/i.test(msg)) {
      tabTitle = sanitizeSheetTabTitle(`${tabTitle.slice(0, 80)} ${Date.now()}`).slice(0, 99);
      addRes = await sheets.spreadsheets.batchUpdate({
        spreadsheetId: id,
        requestBody: batchBody([
          {
            addSheet: {
              properties: {
                title: tabTitle,
                gridProperties: { rowCount: Math.max(24, rows.length + 6), columnCount: 6 }
              }
            }
          }
        ])
      });
    } else {
      throw e;
    }
  }

  let sheetId = extractNewSheetIdFromBatchResponse(addRes, tabTitle);
  if (sheetId == null) {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: id,
      fields: 'sheets(properties(sheetId,title))'
    });
    const sh = meta.data.sheets?.find((s) => s.properties?.title === tabTitle);
    sheetId = sh?.properties?.sheetId;
  }
  if (sheetId == null) {
    const dbg = JSON.stringify(/** @type {any} */ (addRes)?.data || {}).slice(0, 500);
    throw new Error(`addSheet: could not read new sheet id. API snippet: ${dbg}`);
  }

  const esc = escapeSheetTitleForA1(tabTitle);
  const lastDataRow = 1 + rows.length;
  const avgRow = lastDataRow + 1;
  const avgFormula = rows.length > 0 ? `=AVERAGE(C2:C${lastDataRow})` : '';

  const values = [
    ['Merchant', 'Browser', 'Time (Seconds)'],
    ...rows.map((r) => [r.merchantName, browserLabel, timeSecondsForSheet(r)]),
    ['Average', '', avgFormula]
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: id,
    range: `${esc}!A1:C${avgRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values }
  });

  const grey = { red: 0.93, green: 0.93, blue: 0.93 };
  /** @type {any[]} */
  const requests = [
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 3 },
        cell: {
          userEnteredFormat: {
            backgroundColor: grey,
            horizontalAlignment: 'CENTER',
            textFormat: { bold: true }
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
      }
    },
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: avgRow - 1,
          endRowIndex: avgRow,
          startColumnIndex: 0,
          endColumnIndex: 3
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: grey,
            horizontalAlignment: 'CENTER',
            textFormat: { bold: true }
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
      }
    },
    {
      updateBorders: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: avgRow,
          startColumnIndex: 0,
          endColumnIndex: 3
        },
        top: solidBorder(),
        bottom: solidBorder(),
        left: solidBorder(),
        right: solidBorder(),
        innerHorizontal: solidBorder(),
        innerVertical: solidBorder()
      }
    }
  ];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: id,
    requestBody: { requests }
  });

  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${id}/edit?gid=${sheetId}`;
  return { sheetId, tabTitle, spreadsheetUrl };
}
