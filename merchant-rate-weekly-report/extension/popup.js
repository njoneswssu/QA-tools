import { rowsToTsv } from './lib/audit-pipeline.js';
import { readExtensionSettings, writeExtensionSettings } from './lib/extension-settings.js';
import { getNextScheduledRunDate, formatCountdownTimer } from './lib/schedule-next-run.js';
import { AUDIT_JOB_STORAGE_KEY, readAuditJob } from './lib/audit-run-state.js';
import { DEFAULT_SELECTED_APP_IDS, unionIdsForPicker } from './lib/app-id-catalog.js';
import { getWildlinkAppCatalogEntries } from './lib/wildlink-app-catalog-cache.js';
import {
  loadWildlinkAppDisplayNameMap,
  displayNameFromMap,
  sortedAppIdsFromDisplayNameMap
} from './lib/wildlink-app-display-name-map.js';
import { getGoogleAuthToken } from './lib/google-auth.js';
import { oauthClientPrecheckMessage } from './lib/oauth-helper.js';

const appIdSearchEl = document.getElementById('appIdSearch');
const appIdListEl = document.getElementById('appIdList');
const appIdCheckAllEl = document.getElementById('appIdCheckAll');
const appIdUncheckAllEl = document.getElementById('appIdUncheckAll');
const runBtn = document.getElementById('runBtn');
const copyBtn = document.getElementById('copyBtn');
const statusEl = document.getElementById('status');
const summaryPanel = document.getElementById('summaryPanel');
const tableWrap = document.getElementById('tableWrap');
const tbody = document.getElementById('tbody');
const openOptsEl = document.getElementById('openOpts');
const gearSettingsEl = document.getElementById('gearSettings');
const scheduleBlock = document.getElementById('scheduleBlock');
const scheduleBlockWhen = document.getElementById('scheduleBlockWhen');
const scheduleBlockCount = document.getElementById('scheduleBlockCount');
const tableToolbar = document.getElementById('tableToolbar');
const toggleResultsBtn = document.getElementById('toggleResultsBtn');
const selectedAppIdsSummary = document.getElementById('selectedAppIdsSummary');

let lastExportLines = null;
/** @type {ReturnType<typeof setInterval> | null} */
let countdownTimer = null;
let issuesPreviewExpanded = true;

/** @type {number[]} */
let pendingSelected = [];

/**
 * Valid merchant-rate apps with display labels (`null` = still loading).
 * @type {Array<{ id: number, label: string, feedItemCount?: number | null }> | null}
 */
let cachedCatalogEntries = null;
/** @type {Record<string, string> | null} */
let cachedDisplayNameMap = null;

function buildHardcodedCatalogEntries() {
  const map = cachedDisplayNameMap || {};
  let ids = sortedAppIdsFromDisplayNameMap(map);
  if (!ids.length) ids = [...DEFAULT_SELECTED_APP_IDS];
  return ids.map((id) => ({
    id,
    label: displayNameFromMap(map, id) || `App ${id}`,
    feedItemCount: null
  }));
}

/** Catalog rows used for list + check-all (`null` only before first prefs load). */
function effectiveCatalogEntries() {
  if (cachedCatalogEntries === null) return null;
  if (cachedCatalogEntries.length) return cachedCatalogEntries;
  return buildHardcodedCatalogEntries();
}

function catalogIdsForPicker() {
  const rows = effectiveCatalogEntries();
  if (!rows) {
    const map = cachedDisplayNameMap || {};
    const ids = sortedAppIdsFromDisplayNameMap(map);
    return ids.length ? ids : [...DEFAULT_SELECTED_APP_IDS];
  }
  return rows.map((e) => e.id);
}

let persistTimer = null;
function schedulePersistAppIds() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(async () => {
    persistTimer = null;
    try {
      await writeExtensionSettings({
        appIdsSelected: pendingSelected,
        appIdsText: pendingSelected.join(', ')
      });
    } catch (e) {
      console.warn('[popup] persist App IDs failed:', e);
    }
  }, 250);
}

function getSearchQuery() {
  return String(appIdSearchEl.value || '').trim();
}

/** @returns {Array<{ id: number, label: string }> | null} */
function visibleCatalogRows() {
  const rows = effectiveCatalogEntries();
  if (rows === null) return null;
  const q = getSearchQuery().toLowerCase().trim();
  const byId = new Map(rows.map((e) => [e.id, e]));
  const unionIds = unionIdsForPicker([...byId.keys()], pendingSelected);
  const map = cachedDisplayNameMap || {};
  const merged = unionIds.map((id) => {
    if (byId.has(id)) {
      const row = byId.get(id);
      return { id, label: row.label, feedItemCount: row.feedItemCount ?? null };
    }
    const named = displayNameFromMap(map, id);
    return {
      id,
      label: named ? `${named} (saved ID)` : `App ${id} — add name in data/wildlink-app-display-names.json`
    };
  });
  merged.sort((a, b) => a.id - b.id);
  if (!q) return merged;
  return merged.filter(
    (e) => String(e.id).includes(q) || String(e.label).toLowerCase().includes(q)
  );
}

function updateSelectedAppIdsSummary() {
  if (!selectedAppIdsSummary) return;
  selectedAppIdsSummary.textContent = pendingSelected.length
    ? pendingSelected.join(', ')
    : '(none — check at least one App ID above)';
}

function renderAppIdList() {
  if (cachedCatalogEntries === null) {
    appIdListEl.innerHTML =
      '<div class="app-id-empty">Loading apps… (GCS list + merchant-rate checks; first load can take ~20–40s.)</div>';
    updateSelectedAppIdsSummary();
    return;
  }
  const selectedSet = new Set(pendingSelected);
  const list = visibleCatalogRows();
  if (!list || !list.length) {
    const q = getSearchQuery().trim();
    appIdListEl.innerHTML = q
      ? '<div class="app-id-empty">No App IDs match this filter.</div>'
      : '<div class="app-id-empty">No apps to show — add IDs and display names in <code>data/wildlink-app-display-names.json</code>, then reload the extension.</div>';
    updateSelectedAppIdsSummary();
    return;
  }
  appIdListEl.innerHTML = list
    .map((e) => {
      const checked = selectedSet.has(e.id) ? ' checked' : '';
      const fc = e.feedItemCount;
      const tip =
        fc != null && !isNaN(Number(fc))
          ? `${Number(fc).toLocaleString()} merchants in merchant-rate feed`
          : '';
      const titleAttr = tip ? ` title="${esc(tip)}"` : '';
      return `<label class="app-id-row"${titleAttr}><input type="checkbox" data-app-id="${e.id}"${checked}/><span class="app-id-line"><span class="app-id-num">${e.id}</span><span class="app-id-name">${esc(e.label)}</span></span></label>`;
    })
    .join('');
  updateSelectedAppIdsSummary();
}

function validateSelectedAppIds() {
  if (!pendingSelected.length) {
    return {
      ok: false,
      message: 'Select at least one App ID (use the list or adjust the filter), or import settings with IDs.'
    };
  }
  return { ok: true, ids: [...pendingSelected] };
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function clearCountdownTimer() {
  if (countdownTimer != null) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

/** Flagged rate display name (issue context); fall back to amount if name is missing. */
function flaggedRateCell(r) {
  const name = r && r.rateName != null ? String(r.rateName).trim() : '';
  if (name && name !== '(empty)') return esc(name);
  const amt = r && r.rateAmount != null ? String(r.rateAmount).trim() : '';
  if (amt && amt !== '(empty)') return esc(amt);
  return '—';
}

async function refreshScheduleCountdown() {
  clearCountdownTimer();
  if (!scheduleBlock || !scheduleBlockWhen || !scheduleBlockCount) return;
  let s;
  try {
    s = await readExtensionSettings();
  } catch {
    scheduleBlock.hidden = true;
    scheduleBlockWhen.textContent = '';
    scheduleBlockCount.textContent = '';
    return;
  }
  if (!s.scheduleEnabled) {
    scheduleBlock.hidden = true;
    scheduleBlockWhen.textContent = '';
    scheduleBlockCount.textContent = '';
    return;
  }
  const next = getNextScheduledRunDate(s.scheduleDayOfWeek, s.scheduleTimeLocal);
  if (!next) {
    scheduleBlock.hidden = true;
    scheduleBlockWhen.textContent = '';
    scheduleBlockCount.textContent = '';
    return;
  }
  scheduleBlock.hidden = false;
  const whenText = next.toLocaleString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
  const tick = () => {
    const ms = next.getTime() - Date.now();
    if (ms <= 0) {
      void refreshScheduleCountdown();
      return;
    }
    scheduleBlockWhen.textContent = whenText;
    scheduleBlockCount.textContent = formatCountdownTimer(ms);
  };
  tick();
  countdownTimer = setInterval(tick, 1000);
}

function openSettings() {
  if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
}

/** @returns {{ ok: true } | { ok: false, message: string }} */
async function assertGoogleSignedInForRun() {
  const pre = oauthClientPrecheckMessage();
  if (pre) return { ok: false, message: pre };

  const s = await readExtensionSettings();
  const wantsSheets = !!(s.syncToSheets && String(s.spreadsheetId || '').trim());
  const wantsBq = !!s.useBigQuery;
  if (!wantsSheets && !wantsBq) return { ok: true };

  let token = null;
  try {
    token = await getGoogleAuthToken(false);
  } catch {
    token = null;
  }
  if (!token) {
    return {
      ok: false,
      message:
        'Sign in with your Wildfire Google account in Settings before running an audit that uses Google Sheets or BigQuery.'
    };
  }
  return { ok: true };
}

/** @param {string} detail - main sentence (OAuth precheck or sign-in prompt). */
function showStatusWithOpenSettingsLink(detail) {
  statusEl.textContent = '';
  statusEl.className = 'status err';
  const wrap = document.createElement('span');
  wrap.appendChild(document.createTextNode(`${detail.trim()} `));
  const a = document.createElement('a');
  a.href = '#';
  a.textContent = 'Open Settings';
  a.addEventListener('click', (ev) => {
    ev.preventDefault();
    openSettings();
  });
  wrap.appendChild(a);
  statusEl.appendChild(wrap);
}

/** @param {Record<string, unknown>} job */
function applyJobToUi(job) {
  if (!job || typeof job !== 'object') return;

  if (job.phase === 'running') {
    runBtn.disabled = true;
    statusEl.textContent =
      'Running in background — you can switch tabs or close this popup; results will appear here when finished.';
    statusEl.className = 'status';
    return;
  }

  if (job.phase === 'error') {
    runBtn.disabled = false;
    statusEl.textContent = String(job.error || 'Audit failed.');
    statusEl.className = 'status err';
    return;
  }

  if (job.phase === 'done') {
    runBtn.disabled = false;
    const appIds = Array.isArray(job.appIds) ? job.appIds : [];
    const rows = Array.isArray(job.rows) ? job.rows : [];
    const summary = job.summary && typeof job.summary === 'object' ? job.summary : {};

    lastExportLines = Array.isArray(job.exportLines) ? job.exportLines : null;
    copyBtn.disabled = !lastExportLines;

    summaryPanel.innerHTML = `
      <strong>Summary</strong><br/>
      App IDs: ${appIds.join(', ')} · Merchants scanned: ${summary.totalMerchants ?? 0}<br/>
      Issue rows: ${rows.length} · Rates: ${summary.totalRates ?? 0}
    `;
    summaryPanel.hidden = false;

    const show = rows.slice(0, 150);
    tbody.innerHTML = show
      .map(
        (r) => `<tr>
        <td>${esc(r.merchantName)} <span class="muted">#${esc(r.merchantId)}</span></td>
        <td>${esc(r.issueType)}</td>
        <td>${flaggedRateCell(r)}</td>
      </tr>`
      )
      .join('');
    if (rows.length > show.length) {
      tbody.insertAdjacentHTML(
        'beforeend',
        `<tr><td colspan="3" class="muted">… ${rows.length - show.length} more (use Copy TSV for full)</td></tr>`
      );
    }
    tableWrap.hidden = rows.length === 0;
    if (tableToolbar) tableToolbar.hidden = rows.length === 0;
    tableWrap.classList.toggle('table-wrap--with-toolbar', rows.length > 0);
    if (rows.length > 0) {
      issuesPreviewExpanded = true;
      tableWrap.classList.remove('table-wrap--collapsed');
      if (toggleResultsBtn) toggleResultsBtn.textContent = 'Minimize results';
    }

    statusEl.textContent = String(job.statusMessage || 'Done.');
    statusEl.className = rows.length ? 'status ok' : 'status ok';
    if (String(job.sheetsMessage || '').toLowerCase().includes('failed')) {
      statusEl.classList.remove('ok');
      statusEl.classList.add('err');
    }
    return;
  }
}

async function loadPrefs() {
  const s = await readExtensionSettings();
  pendingSelected = Array.isArray(s.appIdsSelected) ? [...s.appIdsSelected] : [];
  appIdSearchEl.value = '';

  try {
    cachedDisplayNameMap = await loadWildlinkAppDisplayNameMap();
  } catch {
    cachedDisplayNameMap = {};
  }
  cachedCatalogEntries = buildHardcodedCatalogEntries();
  renderAppIdList();

  const job = await readAuditJob();
  applyJobToUi(job);

  void refreshScheduleCountdown();

  try {
    cachedCatalogEntries = await getWildlinkAppCatalogEntries();
  } catch (e) {
    console.warn('[popup] Wildlink app catalog fetch failed:', e);
    cachedCatalogEntries = buildHardcodedCatalogEntries();
  }
  renderAppIdList();
}

async function savePrefs() {
  await writeExtensionSettings({
    appIdsSelected: pendingSelected,
    appIdsText: pendingSelected.join(', ')
  });
}

appIdListEl.addEventListener('change', (e) => {
  const el = e.target;
  if (!(el instanceof HTMLInputElement) || el.type !== 'checkbox') return;
  const id = parseInt(el.getAttribute('data-app-id') || '', 10);
  if (isNaN(id) || id <= 0) return;
  if (el.checked) {
    if (!pendingSelected.includes(id)) pendingSelected.push(id);
  } else {
    pendingSelected = pendingSelected.filter((x) => x !== id);
  }
  pendingSelected.sort((a, b) => a - b);
  schedulePersistAppIds();
  renderAppIdList();
});

appIdSearchEl.addEventListener('input', () => {
  renderAppIdList();
});

appIdCheckAllEl.addEventListener('click', () => {
  const union = unionIdsForPicker(catalogIdsForPicker(), pendingSelected);
  pendingSelected = [...union].sort((a, b) => a - b);
  schedulePersistAppIds();
  renderAppIdList();
});

appIdUncheckAllEl.addEventListener('click', () => {
  pendingSelected = [];
  schedulePersistAppIds();
  renderAppIdList();
});

openOptsEl.addEventListener('click', (e) => {
  e.preventDefault();
  openSettings();
});

gearSettingsEl.addEventListener('click', () => openSettings());

toggleResultsBtn?.addEventListener('click', () => {
  issuesPreviewExpanded = !issuesPreviewExpanded;
  tableWrap.classList.toggle('table-wrap--collapsed', !issuesPreviewExpanded);
  toggleResultsBtn.textContent = issuesPreviewExpanded ? 'Minimize results' : 'Expand results';
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes[AUDIT_JOB_STORAGE_KEY]) {
    const next = changes[AUDIT_JOB_STORAGE_KEY].newValue;
    if (next && typeof next === 'object') applyJobToUi(next);
  }
  if (changes.extensionSettings) {
    void refreshScheduleCountdown();
  }
});

runBtn.addEventListener('click', async () => {
  statusEl.textContent = '';
  statusEl.className = 'status';
  summaryPanel.hidden = true;
  tableWrap.hidden = true;
  if (tableToolbar) tableToolbar.hidden = true;
  tableWrap.classList.remove('table-wrap--with-toolbar');
  tbody.innerHTML = '';
  copyBtn.disabled = true;
  lastExportLines = null;

  const validation = validateSelectedAppIds();
  if (!validation.ok) {
    statusEl.textContent = validation.message;
    statusEl.classList.add('err');
    return;
  }
  const appIds = validation.ids;

  runBtn.disabled = true;
  statusEl.textContent = 'Starting…';

  try {
    await savePrefs();
  } catch (e) {
    statusEl.textContent = e.message || String(e);
    statusEl.classList.add('err');
    runBtn.disabled = false;
    return;
  }

  const googleGate = await assertGoogleSignedInForRun();
  if (!googleGate.ok) {
    runBtn.disabled = false;
    showStatusWithOpenSettingsLink(googleGate.message || 'Google sign-in or setup is required in Settings.');
    return;
  }

  chrome.runtime.sendMessage(
    {
      type: 'RUN_MERCHANT_RATE_AUDIT',
      payload: {
        appIds
      }
    },
    (resp) => {
      if (chrome.runtime.lastError) {
        statusEl.textContent = chrome.runtime.lastError.message || 'Could not reach background.';
        statusEl.classList.add('err');
        runBtn.disabled = false;
        return;
      }
      if (resp && resp.busy) {
        readAuditJob().then(applyJobToUi);
        return;
      }
      if (resp && resp.started) {
        statusEl.textContent =
          'Running in background — you can switch tabs or close this popup; results will appear here when finished.';
        statusEl.className = 'status';
        runBtn.disabled = true;
      } else {
        statusEl.textContent = 'Could not start audit.';
        statusEl.classList.add('err');
        runBtn.disabled = false;
      }
    }
  );
});

copyBtn.addEventListener('click', async () => {
  if (!lastExportLines) return;
  const text = rowsToTsv(lastExportLines);
  try {
    await navigator.clipboard.writeText(text);
    statusEl.textContent = 'TSV copied (paste into Sheets).';
    statusEl.className = 'status ok';
  } catch {
    statusEl.textContent = 'Clipboard failed — select and copy manually.';
    statusEl.className = 'status err';
  }
});

loadPrefs();
