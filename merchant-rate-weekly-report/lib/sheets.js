const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');

/** Readable message from googleapis / Gaxios failures */
function formatSheetsApiError(err) {
  const base = err && err.message ? err.message : String(err);
  const data = err && err.response && err.response.data;
  if (!data) return base;
  const e = data.error;
  if (e && typeof e === 'object') {
    const msg = e.message || e.status || '';
    const details = e.errors ? JSON.stringify(e.errors) : '';
    return [base, msg, details].filter(Boolean).join(' | ');
  }
  try {
    return `${base} | ${JSON.stringify(data)}`;
  } catch (_) {
    return base;
  }
}

/** Google Sheet tab titles cannot contain: : \ / ? * [ ] */
function sanitizeTabTitle(title) {
  let t = String(title).replace(/[:\\/?*[\]]/g, '-').replace(/\s+/g, ' ').trim();
  if (t.length > 100) t = t.slice(0, 100);
  return t || 'Rate audit';
}

function getSheetsClient() {
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyPath || !fs.existsSync(path.resolve(process.cwd(), keyPath))) {
    const err = new Error(
      'Set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON file path (see .env.example).'
    );
    err.code = 'NO_CREDENTIALS';
    throw err;
  }
  const keyFile = path.resolve(process.cwd(), keyPath);
  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  return google.sheets({ version: 'v4', auth });
}

async function listTabTitles(sheets, spreadsheetId) {
  const { data } = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(title))'
  });
  return new Set((data.sheets || []).map((s) => s.properties && s.properties.title).filter(Boolean));
}

async function resolveSheetTitle(sheets, spreadsheetId) {
  const gid = process.env.SHEET_GID;
  const explicit = process.env.SHEET_TAB_NAME;
  if (explicit && explicit.trim()) return explicit.trim();

  if (gid != null && String(gid).trim() !== '') {
    const gidNum = parseInt(String(gid).trim(), 10);
    const { data } = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets(properties(sheetId,title))'
    });
    const sheet = (data.sheets || []).find(
      (s) => s.properties && s.properties.sheetId === gidNum
    );
    if (sheet && sheet.properties && sheet.properties.title) {
      return sheet.properties.title;
    }
    throw new Error(`No tab found for SHEET_GID=${gid}. Set SHEET_TAB_NAME in .env.`);
  }

  const { data } = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(title))'
  });
  const first = data.sheets && data.sheets[0] && data.sheets[0].properties;
  if (first && first.title) return first.title;
  throw new Error('Spreadsheet has no sheets.');
}

function quoteSheet(title) {
  const escaped = String(title).replace(/'/g, "''");
  return `'${escaped}'`;
}

function pickUniqueNewTabTitle(existing, runIso) {
  const d = new Date(runIso);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const sec = String(d.getSeconds()).padStart(2, '0');
  let base = sanitizeTabTitle(`Rate audit ${y}-${mo}-${day} ${h}${min}${sec}`);
  if (!existing.has(base)) return base;
  let n = 2;
  while (n < 100) {
    const candidate = sanitizeTabTitle(`${base} (${n})`);
    if (!existing.has(candidate)) return candidate;
    n++;
  }
  return sanitizeTabTitle(`${base} ${Date.now()}`);
}

/**
 * Create a new tab and write header + data (one block from A1).
 */
async function writeToNewTab(headerRow, dataRows, runIso) {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('Set SPREADSHEET_ID in .env');
  }
  const sheets = getSheetsClient();
  const existing = await listTabTitles(sheets, spreadsheetId);
  const title = pickUniqueNewTabTitle(existing, runIso);

  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title } } }]
      }
    });
  } catch (e) {
    throw new Error(`Sheets batchUpdate (add tab): ${formatSheetsApiError(e)}`);
  }

  const quoted = quoteSheet(title);
  const allRows = [headerRow, ...dataRows];
  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${quoted}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: allRows }
    });
  } catch (e) {
    throw new Error(`Sheets values.update: ${formatSheetsApiError(e)}`);
  }

  return {
    spreadsheetId,
    sheetTitle: title,
    rowsWritten: allRows.length,
    wroteHeader: true,
    mode: 'new_tab'
  };
}

/**
 * Append rows to an existing tab (SHEET_GID / SHEET_TAB_NAME). If A1 is empty, writes header first.
 */
async function appendToExistingTab(headerRow, dataRows) {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('Set SPREADSHEET_ID in .env');
  }
  const sheets = getSheetsClient();
  const title = await resolveSheetTitle(sheets, spreadsheetId);
  const quoted = quoteSheet(title);
  const rangeA1 = `${quoted}!A:Z`;

  const meta = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${quoted}!A1:A1`
  });
  const firstCell = meta.data.values && meta.data.values[0] && meta.data.values[0][0];
  const needsHeader = !firstCell || String(firstCell).trim() === '';

  const toAppend = needsHeader ? [headerRow, ...dataRows] : dataRows;

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: rangeA1,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: toAppend }
    });
  } catch (e) {
    throw new Error(`Sheets values.append: ${formatSheetsApiError(e)}`);
  }

  return {
    spreadsheetId,
    sheetTitle: title,
    rowsWritten: toAppend.length,
    wroteHeader: needsHeader,
    mode: 'append'
  };
}

/**
 * SHEET_APPEND_MODE=new (default): create a new tab each run and write data from A1.
 * SHEET_APPEND_MODE=fixed: append to the tab from SHEET_GID / SHEET_TAB_NAME.
 */
async function syncAuditRows(headerRow, dataRows, runIso) {
  const mode = (process.env.SHEET_APPEND_MODE || 'new').toLowerCase();
  if (mode === 'fixed' || mode === 'append') {
    return appendToExistingTab(headerRow, dataRows);
  }
  return writeToNewTab(headerRow, dataRows, runIso);
}

module.exports = {
  syncAuditRows,
  appendToExistingTab,
  writeToNewTab,
  resolveSheetTitle,
  getSheetsClient,
  formatSheetsApiError
};
