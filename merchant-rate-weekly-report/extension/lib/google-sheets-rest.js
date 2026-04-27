/**
 * Google Sheets v4 via REST — new tab + values (same behavior as lib/sheets.js writeToNewTab).
 */

function sanitizeTabTitle(title) {
  let t = String(title).replace(/[:\\/?*[\]]/g, '-').replace(/\s+/g, ' ').trim();
  if (t.length > 100) t = t.slice(0, 100);
  return t || 'Rate audit';
}

function quoteSheet(title) {
  const escaped = String(title).replace(/'/g, "''");
  return `'${escaped}'`;
}

function pickUniqueNewTabTitle(existingSet, runIso) {
  const d = new Date(runIso);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const sec = String(d.getSeconds()).padStart(2, '0');
  let base = sanitizeTabTitle(`Rate audit ${y}-${mo}-${day} ${h}${min}${sec}`);
  if (!existingSet.has(base)) return base;
  let n = 2;
  while (n < 100) {
    const candidate = sanitizeTabTitle(`${base} (${n})`);
    if (!existingSet.has(candidate)) return candidate;
    n++;
  }
  return sanitizeTabTitle(`${base} ${Date.now()}`);
}

async function sheetsFetch(accessToken, url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${accessToken}`
    }
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = (data.error && data.error.message) || text.slice(0, 500);
    throw new Error(`Sheets API ${res.status}: ${msg}`);
  }
  return data;
}

async function listTabTitles(accessToken, spreadsheetId) {
  const fields = encodeURIComponent('sheets(properties(title))');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=${fields}`;
  const data = await sheetsFetch(accessToken, url);
  return new Set((data.sheets || []).map((s) => s.properties && s.properties.title).filter(Boolean));
}

/**
 * Create a new tab and write header + all data rows from A1.
 * @param {string} accessToken
 * @param {string} spreadsheetId
 * @param {string[][]} values - includes header row as values[0]
 * @param {string} runIso
 */
export async function writeAuditToNewSheetTab(accessToken, spreadsheetId, values, runIso) {
  if (!spreadsheetId || !String(spreadsheetId).trim()) {
    throw new Error('Set Spreadsheet ID in extension options.');
  }
  const existing = await listTabTitles(accessToken, spreadsheetId.trim());
  const title = pickUniqueNewTabTitle(existing, runIso);

  await sheetsFetch(
    accessToken,
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title } } }]
      })
    }
  );

  const range = `${quoteSheet(title)}!A1`;
  const encRange = encodeURIComponent(range);
  await sheetsFetch(
    accessToken,
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encRange}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values })
    }
  );

  return { sheetTitle: title, rowsWritten: values.length };
}
