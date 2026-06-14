/* global fetch */

const APP_ID = new URLSearchParams(location.search).get('appId') || '209';
const STORAGE_KEY = `wl-latency-ui:v1:${APP_ID}`;
/** Browser copy of merchant feed so the first paint does not wait on `/api/merchants`. */
const MERCHANT_FEED_STORAGE_KEY = `wl-latency-merchant-feed:v1:${APP_ID}`;
/** Avoid multi-MB localStorage / giant DOM from locking the main thread. */
const MAX_PERSISTED_RESULT_ROWS = 200;
const RENDER_MERCHANT_CHUNK = 120;
const RESTORE_ROWS_CHUNK = 50;
/** Must match server default `UI_MERCHANTS_LIMIT` (keeps feed JSON + DOM small). */
const MERCHANT_LIST_LIMIT = 400;

const merchantList = document.getElementById('merchantList');
const tbody = document.getElementById('tbody');
const filterEl = document.getElementById('filter');
const reloadBtn = document.getElementById('reload');
const runBtn = document.getElementById('run');
const statusEl = document.getElementById('status');
const checkFilteredBtn = document.getElementById('checkFiltered');
const uncheckFilteredBtn = document.getElementById('uncheckFiltered');
const appIdLabel = document.getElementById('appIdLabel');
const exportGoogleSheetEl = document.getElementById('exportGoogleSheet');
const googleSpreadsheetIdEl = document.getElementById('googleSpreadsheetId');
const googleTabTitleEl = document.getElementById('googleTabTitle');
const sheetExportRow = document.getElementById('sheetExportRow');
const selectedSummaryEl = document.getElementById('selectedSummary');
const resultsPanel = document.getElementById('resultsPanel');
const resultsFilterEl = document.getElementById('resultsFilter');
const resultsMinimizeBtn = document.getElementById('resultsMinimize');
const deleteAllResultsBtn = document.getElementById('deleteAllResults');
const modeEls = Array.from(document.querySelectorAll('input[name="toolMode"]'));

const RUN_LABEL_IDLE = 'Run selected';
const RUN_LABEL_STOP = 'Stop selected';

/** @type {AbortController | null} */
let runAbortController = null;

/** True while `/api/run-stream` is reading; avoids merchant reload replacing the results table mid-run. */
let runStreamActive = false;

if (appIdLabel) appIdLabel.textContent = APP_ID;

function setRunIdleUi() {
  runStreamActive = false;
  runAbortController = null;
  if (runBtn) {
    runBtn.disabled = false;
    runBtn.textContent = currentMode() === 'activation' ? 'Run activation' : RUN_LABEL_IDLE;
    runBtn.classList.remove('stop-run');
  }
}

function setRunActiveUi() {
  runStreamActive = true;
  if (runBtn) {
    runBtn.disabled = false;
    runBtn.textContent = RUN_LABEL_STOP;
    runBtn.classList.add('stop-run');
  }
}

/** @type {{ id: string, name: string }[]} */
let merchants = [];

/** Merchant display names currently selected (survives filter / re-render). */
const selectedMerchantNames = new Set();

/** All result rows shown in the table (newest first; multiple runs prepend). */
let accumulatedResultRows = [];

/** Stable id for DOM row ? in-memory row (delete). */
let nextResultRowSeq = 1;

function stripRowUiFields(row) {
  const o = { ...row };
  delete o.__uiRowId;
  return o;
}

/** Cancels in-flight chunked `renderList` when the filter changes again. */
let renderListGeneration = 0;

function loadStored() {
  try {
    const t = localStorage.getItem(STORAGE_KEY);
    if (!t || t.length > 4_000_000) return {};
    return JSON.parse(t);
  } catch {
    return {};
  }
}

function saveStored(partial) {
  try {
    const cur = loadStored();
    Object.assign(cur, partial);
    if (cur.lastRun?.rows?.length > MAX_PERSISTED_RESULT_ROWS) {
      cur.lastRun.rows = cur.lastRun.rows.slice(-MAX_PERSISTED_RESULT_ROWS);
    }
    const out = JSON.stringify(cur);
    if (out.length > 4_500_000) return;
    localStorage.setItem(STORAGE_KEY, out);
  } catch {
    /* quota / private mode */
  }
}

function readMerchantFeedFromStorage() {
  try {
    const t = localStorage.getItem(MERCHANT_FEED_STORAGE_KEY);
    if (!t || t.length > 6_000_000) return null;
    const o = JSON.parse(t);
    if (!Array.isArray(o.merchants) || !o.merchants.length) return null;
    return o;
  } catch {
    return null;
  }
}

function writeMerchantFeedToStorage(payload) {
  try {
    const o = {
      merchants: payload.merchants,
      merchantTotal: payload.merchantTotal ?? null,
      limitedTo: payload.limitedTo ?? null,
      fromCache: Boolean(payload.fromCache),
      stale: Boolean(payload.stale),
      cachedAt: new Date().toISOString()
    };
    localStorage.setItem(MERCHANT_FEED_STORAGE_KEY, JSON.stringify(o));
  } catch {
    /* quota */
  }
}

function debounce(fn, ms) {
  let t = 0;
  return () => {
    clearTimeout(t);
    t = setTimeout(fn, ms);
  };
}

const persistFormDebounced = debounce(() => {
  saveStored({
    googleSpreadsheetId: googleSpreadsheetIdEl?.value ?? '',
    googleTabTitle: googleTabTitleEl?.value ?? '',
    exportGoogleSheet: Boolean(exportGoogleSheetEl?.checked),
    mode: currentMode()
  });
}, 200);

const applyResultsFilterDebounced = debounce(() => {
  applyResultsFilter();
}, 100);

function formatRecordedAt(iso) {
  if (!iso) return '?';
  try {
    const d = new Date(String(iso));
    return Number.isNaN(d.getTime()) ? '?' : d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' });
  } catch {
    return '?';
  }
}

/** Wall time for the shop tab until recording stops; refined from `<video>` metadata when available. */
function initialRecordingSecondsDisplay(row) {
  const rw = row.recordingWallSec;
  if (rw != null && Number.isFinite(Number(rw))) return String(Math.round(Number(rw) * 1000) / 1000);
  if (row.wallMs != null && Number.isFinite(Number(row.wallMs))) {
    return String(Math.round((Number(row.wallMs) / 1000) * 1000) / 1000);
  }
  if (row.secondsToSignalFromNav != null) return String(row.secondsToSignalFromNav);
  return '?';
}

/** Merchant rows intersecting the scrollport (not just filter-matched off-screen). */
function merchantInputsInScrollport() {
  const root = merchantList;
  if (!root) return [];
  const rr = root.getBoundingClientRect();
  /** @type {HTMLInputElement[]} */
  const out = [];
  root.querySelectorAll('.merchant-item:not(.hidden)').forEach((label) => {
    const r = label.getBoundingClientRect();
    const visible = r.height > 0 && r.bottom > rr.top && r.top < rr.bottom;
    if (visible) {
      const inp = label.querySelector('input[type="checkbox"]');
      if (inp) out.push(/** @type {HTMLInputElement} */ (inp));
    }
  });
  return out;
}

function applyResultsFilter() {
  if (!tbody) return;
  const q = (resultsFilterEl?.value || '').trim().toLowerCase();
  tbody.querySelectorAll('tr').forEach((tr) => {
    const hay = (tr.dataset.filterText || '').toLowerCase();
    tr.classList.toggle('results-row-hidden', Boolean(q) && !hay.includes(q));
  });
}

function applyStoredForm() {
  const s = loadStored();
  if (typeof s.mode === 'string') {
    for (const el of modeEls) {
      if (el.value === s.mode) el.checked = true;
    }
  }
  if (googleSpreadsheetIdEl && typeof s.googleSpreadsheetId === 'string') {
    googleSpreadsheetIdEl.value = s.googleSpreadsheetId;
  }
  if (googleTabTitleEl && typeof s.googleTabTitle === 'string') {
    googleTabTitleEl.value = s.googleTabTitle;
  }
  if (exportGoogleSheetEl && typeof s.exportGoogleSheet === 'boolean') {
    exportGoogleSheetEl.checked = s.exportGoogleSheet;
  }
  updateModeUi();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Split filter box on commas, semicolons, or newlines; OR-match merchants against each token. */
function parseFilterTokens(raw) {
  return String(raw || '')
    .split(/[\n,;]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

/** @param {{ id: string, name: string }} m @param {string[]} tokens */
function merchantMatchesFilterTokens(m, tokens) {
  if (!tokens.length) return true;
  const name = m.name.toLowerCase();
  const id = String(m.id).toLowerCase();
  return tokens.some((q) => name.includes(q) || id.includes(q));
}

/** Same-origin URL for a `.webm` under the UI server (basename only; must match server path checks). */
function traceMediaUrl(videoPath) {
  if (!videoPath || typeof videoPath !== 'string') return '';
  const base = videoPath.replace(/^.*[/\\]/, '');
  if (base.length > 240 || !/\.webm$/i.test(base)) return '';
  if (/[\\/]/.test(base) || base.includes('..')) return '';
  return `/api/traces/media?name=${encodeURIComponent(base)}`;
}

function currentMode() {
  const checked = modeEls.find((el) => el.checked);
  return checked?.value === 'activation' ? 'activation' : 'latency';
}

function updateModeUi() {
  const activation = currentMode() === 'activation';
  sheetExportRow?.classList.toggle('is-hidden', activation);
  if (runBtn && !runStreamActive) runBtn.textContent = activation ? 'Run activation' : RUN_LABEL_IDLE;
}

function appendTextOrLink(td, value, opts = {}) {
  if (!value) {
    td.textContent = '?';
    return;
  }
  const s = String(value);
  if (/^https?:\/\//i.test(s)) {
    const wrap = document.createElement('div');
    wrap.className = 'link-cell';
    const a = document.createElement('a');
    a.href = s;
    a.textContent = opts.label || (opts.short ? s.replace(/^https?:\/\//i, '') : s);
    a.title = s;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    wrap.appendChild(a);
    if (opts.copy) {
      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'secondary copy-link-btn';
      copyBtn.textContent = 'Copy';
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(s);
          copyBtn.textContent = 'Copied';
          setTimeout(() => {
            copyBtn.textContent = 'Copy';
          }, 1200);
        } catch {
          window.prompt('Copy generated link:', s);
        }
      });
      wrap.appendChild(copyBtn);
    }
    td.appendChild(wrap);
    return;
  }
  td.textContent = s;
}

function compactWildlinkLabel(raw) {
  if (!raw) return undefined;
  try {
    const u = new URL(String(raw));
    if (u.hostname.replace(/^www\./, '') !== 'wild.link') return undefined;
    const c = u.searchParams.get('c');
    const d = u.searchParams.get('d');
    if (c && d) return `wild.link/e?c=${c}&d=${d}`;
    return 'wild.link/e';
  } catch {
    return undefined;
  }
}

/** Server sets `videoMediaUrl` when the file exists on disk (same-origin path). */
function videoSrcForRow(row) {
  const u = row.videoMediaUrl;
  if (typeof u === 'string' && u.startsWith('/api/traces/media')) return u;
  return traceMediaUrl(row.videoPath);
}

/**
 * Build table row with DOM APIs (avoids `<video>` issues with `tr.innerHTML`).
 * @param {Record<string, unknown>} row must include `__uiRowId`
 * @param {{ insert?: 'top' | 'append' }} [opts] `top` = newest row; `append` = batch restore in newest-first order
 */
function appendDataRow(row, opts = {}) {
  const insert = opts.insert || 'top';
  const tr = document.createElement('tr');
  const uiId = row.__uiRowId;
  if (uiId != null) tr.dataset.resultRowId = String(uiId);

  const td = (className) => {
    const el = document.createElement('td');
    if (className) el.className = className;
    return el;
  };

  const tDel = td('td-row-actions');
  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'icon-trash';
  delBtn.setAttribute('aria-label', 'Delete this result');
  delBtn.title = 'Delete this result';
  delBtn.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>';
  delBtn.addEventListener('click', () => {
    if (uiId == null) return;
    const name = String(row.merchantName ?? 'this row');
    if (
      !window.confirm(
        `Delete the result for "${name}"? This removes the row and updates the saved snapshot in this browser. This cannot be undone.`
      )
    ) {
      return;
    }
    deleteResultByUiId(Number(uiId));
  });
  tDel.appendChild(delBtn);

  const tDate = td();
  tDate.textContent = formatRecordedAt(row.recordedAt);

  const tMerchant = td();
  tMerchant.textContent = String(row.merchantName ?? '');

  const tOutcome = td('td-outcome');
  tOutcome.textContent =
    row.endReason != null && row.endReason !== '' ? String(row.endReason) : '?';
  if (Array.isArray(row.validationErrors) && row.validationErrors.length) {
    const small = document.createElement('small');
    small.className = 'validation-errors';
    small.textContent = row.validationErrors.map(String).join(', ');
    tOutcome.appendChild(document.createElement('br'));
    tOutcome.appendChild(small);
  } else if (row.wildlinkValid === true) {
    const small = document.createElement('small');
    small.className = 'validation-ok';
    small.textContent = 'wild.link/e valid';
    tOutcome.appendChild(document.createElement('br'));
    tOutcome.appendChild(small);
  }

  const tGenerated = td('td-link');
  appendTextOrLink(tGenerated, row.generatedWildlinkUrl, {
    label: compactWildlinkLabel(row.generatedWildlinkUrl),
    copy: true
  });

  const tRec = td('td-recording');
  tRec.textContent = initialRecordingSecondsDisplay(row);

  const tVid = td('td-video');
  const vsrc = videoSrcForRow(row);
  if (vsrc) {
    const wrap = document.createElement('div');
    wrap.className = 'video-cell';
    const bar = document.createElement('div');
    bar.className = 'video-cell-bar';
    const fsBtn = document.createElement('button');
    fsBtn.type = 'button';
    fsBtn.className = 'secondary video-fs-btn';
    fsBtn.textContent = 'Fullscreen';
    const video = document.createElement('video');
    video.controls = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.preload = 'metadata';
    video.src = vsrc;
    video.addEventListener('loadedmetadata', () => {
      if (video.duration && Number.isFinite(video.duration) && video.duration > 0) {
        tRec.textContent = String(Math.round(video.duration * 1000) / 1000);
      }
    });
    fsBtn.addEventListener('click', () => {
      const v = /** @type {any} */ (video);
      try {
        if (video.requestFullscreen) {
          void video.requestFullscreen();
        } else if (v.webkitEnterFullscreen) {
          v.webkitEnterFullscreen();
        }
      } catch (e) {
        console.warn('Fullscreen:', e);
      }
    });
    bar.appendChild(fsBtn);
    wrap.appendChild(bar);
    wrap.appendChild(video);
    tVid.appendChild(wrap);
  } else {
    tVid.textContent = '?';
  }

  const tTrace = td();
  if (row.tracePath) {
    const sm = document.createElement('small');
    sm.className = 'mono';
    sm.title = String(row.tracePath);
    sm.textContent = String(row.tracePath);
    tTrace.appendChild(sm);
  } else {
    tTrace.textContent = '?';
  }

  tr.append(tDel, tDate, tMerchant, tOutcome, tGenerated, tRec, tVid, tTrace);
  const filterParts = [
    tDate.textContent,
    tMerchant.textContent,
    tOutcome.textContent,
    tGenerated.textContent,
    tRec.textContent,
    row.tracePath ? String(row.tracePath) : ''
  ];
  tr.dataset.filterText = filterParts.join(' ').toLowerCase();

  if (insert === 'append') tbody.appendChild(tr);
  else tbody.insertBefore(tr, tbody.firstChild);
  applyResultsFilterDebounced();
}

function deleteResultByUiId(uiId) {
  const idStr = String(uiId);
  const tr = tbody?.querySelector(`tr[data-result-row-id="${idStr}"]`);
  tr?.remove();
  const idx = accumulatedResultRows.findIndex((r) => r.__uiRowId === uiId);
  if (idx >= 0) accumulatedResultRows.splice(idx, 1);
  persistResultsSnapshot();
}

function persistResultsSnapshot() {
  const prev = loadStored();
  const rows = accumulatedResultRows.slice(0, MAX_PERSISTED_RESULT_ROWS).map((r) => stripRowUiFields(r));
  if (!rows.length) {
    saveStored({ lastRun: undefined });
    return;
  }
  saveStored({
    lastRun: {
      rows,
      done: prev.lastRun?.done ?? null
    }
  });
}

function deleteAllResults() {
  if (!tbody) return;
  const n = accumulatedResultRows.length;
  if (
    n > 0 &&
    !window.confirm(
      `You are about to delete all ${n} result row(s) from this page and clear the saved results snapshot in this browser. This cannot be undone.\n\nContinue?`
    )
  ) {
    return;
  }
  tbody.innerHTML = '';
  accumulatedResultRows = [];
  nextResultRowSeq = 1;
  saveStored({ lastRun: undefined });
  applyResultsFilterDebounced();
}

function renderDoneStatus(done, opts = {}) {
  if (!statusEl) return;
  const traceDir = done.traceDir;
  const gs = done.googleSheet;
  const cancelled = Boolean(done.cancelled);
  const mode = done.mode === 'activation' ? 'Activation' : 'Latency';
  const intro = opts.restored ? 'Last run finished.' : cancelled ? 'Run cancelled.' : 'Finished.';
  if (gs?.spreadsheetUrl) {
    statusEl.textContent = '';
    statusEl.appendChild(
      document.createTextNode(
        `${intro} Results also appended under output/.` +
          (traceDir ? ` Traces & videos: ${traceDir}. ` : ' ') +
          'Google Sheet: '
      )
    );
    const a = document.createElement('a');
    a.href = gs.spreadsheetUrl;
    a.textContent = 'Open tab: ' + (gs.tabTitle || 'new');
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    statusEl.appendChild(a);
    return;
  }
  let msg = `${intro} ${mode} results also appended under output/.`;
  if (traceDir) msg += ` Traces (.zip) and videos (.webm): ${traceDir}`;
  if (gs?.error) msg += ' Google Sheet: ' + gs.error;
  if (cancelled && !gs?.spreadsheetUrl) {
    msg += ' Google Sheet export was skipped.';
  }
  statusEl.textContent = msg;
}

function raf() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
}

/** Rebuild merchant checkboxes; yields to the browser between chunks so the tab stays responsive. */
async function renderList() {
  if (!merchantList || !filterEl) return;
  const gen = ++renderListGeneration;
  const tokens = parseFilterTokens(filterEl.value);

  const rowHtml = (m) => {
    const hit = merchantMatchesFilterTokens(m, tokens);
    const checked = selectedMerchantNames.has(m.name) ? ' checked' : '';
    return `<label class="merchant-item ${hit ? '' : 'hidden'}">
        <input type="checkbox" value="${escapeHtml(m.name)}" data-id="${escapeHtml(m.id)}"${checked} />
        <span>${escapeHtml(m.name)}</span>
        <span class="id">#${escapeHtml(m.id)}</span>
      </label>`;
  };

  merchantList.innerHTML = '';
  if (merchants.length <= RENDER_MERCHANT_CHUNK) {
    merchantList.innerHTML = merchants.map(rowHtml).join('');
  } else {
    for (let i = 0; i < merchants.length; i += RENDER_MERCHANT_CHUNK) {
      if (gen !== renderListGeneration) return;
      const chunk = merchants.slice(i, i + RENDER_MERCHANT_CHUNK).map(rowHtml).join('');
      merchantList.insertAdjacentHTML('beforeend', chunk);
      if (i + RENDER_MERCHANT_CHUNK < merchants.length) await raf();
    }
  }
  if (gen !== renderListGeneration) return;
  updateSelectedSummary();
}

async function applyStoredLastRunBatched() {
  const s = loadStored();
  const lr = s.lastRun;
  if (!lr || !Array.isArray(lr.rows) || !lr.rows.length) return;
  tbody.innerHTML = '';
  const rows = lr.rows
    .slice()
    .sort((a, b) => {
      const ta = new Date(/** @type {any} */ (a).recordedAt || 0).getTime();
      const tb = new Date(/** @type {any} */ (b).recordedAt || 0).getTime();
      return tb - ta;
    });
  accumulatedResultRows = [];
  nextResultRowSeq = 1;
  for (let i = 0; i < rows.length; i += RESTORE_ROWS_CHUNK) {
    for (let j = i; j < Math.min(i + RESTORE_ROWS_CHUNK, rows.length); j++) {
      const uiId = nextResultRowSeq++;
      const r = { ...rows[j], __uiRowId: uiId };
      accumulatedResultRows.push(r);
      appendDataRow(r, { insert: 'append' });
    }
    if (i + RESTORE_ROWS_CHUNK < rows.length) await raf();
  }
  if (lr.done) renderDoneStatus(lr.done, { restored: true });
  applyResultsFilterDebounced();
}

function updateSelectedSummary() {
  if (!selectedSummaryEl) return;
  const n = selectedMerchantNames.size;
  if (n === 0) {
    selectedSummaryEl.textContent = 'No merchants selected.';
    return;
  }
  const sorted = [...selectedMerchantNames].sort((a, b) => a.localeCompare(b));
  selectedSummaryEl.innerHTML =
    `<strong>${n} selected:</strong> ` +
    sorted.map((name) => `<span class="sel-name">${escapeHtml(name)}</span>`).join('<span class="sel-sep"> ? </span>');
}

function merchantLoadedStatus(count, payload) {
  let s = `${count} merchants loaded.`;
  const total = payload?.merchantTotal;
  if (total != null && total > count) {
    s += ` Showing first ${count} of ${total} (UI limit for speed; raise UI_MERCHANTS_LIMIT on the server or add ?limit= to the API URL).`;
  }
  if (payload?.stale) {
    s += ' Using stale local backup (network refresh failed).';
  } else if (payload?.fromCache) {
    s += ' From server file cache (Reload feed to refresh from Wildlink).';
  }
  if (payload?.browserOnly) {
    s += ' List from this browser (Reload feed to sync from server).';
  }
  return s;
}

/**
 * @param {boolean} forceRefresh
 * @returns {Promise<Record<string, unknown>>}
 */
async function loadMerchants(forceRefresh = false) {
  if (!statusEl || !runBtn) return {};
  if (!forceRefresh) {
    const cached = readMerchantFeedFromStorage();
    if (cached?.merchants?.length) {
      merchants = cached.merchants;
      await renderList();
      statusEl.textContent = merchantLoadedStatus(merchants.length, {
        merchantTotal: cached.merchantTotal,
        fromCache: Boolean(cached.fromCache),
        stale: Boolean(cached.stale),
        browserOnly: true
      });
      return {
        merchants: cached.merchants,
        merchantTotal: cached.merchantTotal,
        fromCache: cached.fromCache,
        stale: cached.stale,
        browserOnly: true
      };
    }
  }

  statusEl.textContent = forceRefresh ? 'Refreshing merchants from Wildlink?' : 'Loading merchants?';
  runBtn.disabled = true;
  try {
    const refresh = forceRefresh ? '&refresh=1' : '';
    const res = await fetch(
      `/api/merchants?appId=${encodeURIComponent(APP_ID)}&limit=${MERCHANT_LIST_LIMIT}${refresh}`
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    merchants = data.merchants || [];
    writeMerchantFeedToStorage(data);
    const valid = new Set(merchants.map((m) => m.name));
    for (const name of [...selectedMerchantNames]) {
      if (!valid.has(name)) selectedMerchantNames.delete(name);
    }
    await renderList();
    statusEl.textContent = merchantLoadedStatus(merchants.length, data);
    return data;
  } finally {
    runBtn.disabled = false;
  }
}

function selectedNames() {
  return [...selectedMerchantNames];
}

if (merchantList) {
  merchantList.addEventListener('change', (e) => {
    const t = /** @type {HTMLInputElement | null} */ (e.target);
    if (!t || t.type !== 'checkbox') return;
    if (t.checked) selectedMerchantNames.add(t.value);
    else selectedMerchantNames.delete(t.value);
    updateSelectedSummary();
  });
}

function appendRow(row) {
  if (!row || typeof row !== 'object') return;
  if (row.type === 'done') {
    const rows = accumulatedResultRows.slice(0, MAX_PERSISTED_RESULT_ROWS).map((r) => stripRowUiFields(r));
    saveStored({
      lastRun: {
        rows,
        done: {
          traceDir: row.traceDir,
          googleSheet: row.googleSheet,
          mode: row.mode
        }
      }
    });
    renderDoneStatus(
      {
        traceDir: row.traceDir,
        googleSheet: row.googleSheet,
        mode: row.mode,
        cancelled: Boolean(row.cancelled)
      },
      { restored: false }
    );
    return;
  }
  if (row.type === 'error') {
    statusEl.textContent = 'Error: ' + row.message;
    return;
  }
  if (row.merchantName == null || row.merchantName === '') return;
  const uiId = nextResultRowSeq++;
  const r = { ...row, __uiRowId: uiId };
  accumulatedResultRows.unshift(r);
  appendDataRow(r, { insert: 'top' });
}

async function runSelected() {
  const names = selectedNames();
  const mode = currentMode();
  if (!names.length) {
    statusEl.textContent = 'Select at least one merchant.';
    return;
  }
  statusEl.textContent =
    mode === 'activation' ? 'Running activation (browser will open)...' : 'Running latency (browser will open)...';
  setRunActiveUi();
  runAbortController = new AbortController();
  const { signal } = runAbortController;
  reloadBtn?.setAttribute('disabled', 'disabled');

  const payload =
    mode === 'activation'
      ? {
          merchants: names
        }
      : {
          merchants: names,
          exportGoogleSheet: Boolean(exportGoogleSheetEl?.checked),
          googleSpreadsheetId: googleSpreadsheetIdEl?.value?.trim() || undefined,
          googleTabTitle: googleTabTitleEl?.value?.trim() || undefined
        };

  try {
    const res = await fetch(mode === 'activation' ? '/api/activation-stream' : '/api/run-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal
    });

    if (!res.ok) {
      statusEl.textContent =
        mode === 'activation' && res.status === 404
          ? 'HTTP 404: activation endpoint is not available in the running UI server. Stop and restart npm run ui, then refresh this page.'
          : 'HTTP ' + res.status;
      return;
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let sep;
      while ((sep = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, sep);
        buf = buf.slice(sep + 2);
        const line = chunk.split('\n').find((l) => l.startsWith('data: '));
        if (!line) continue;
        const json = line.slice(6);
        try {
          appendRow(JSON.parse(json));
        } catch {
          /* ignore */
        }
      }
    }
  } catch (e) {
    const aborted = signal.aborted || /** @type {any} */ (e)?.name === 'AbortError';
    if (statusEl) {
      statusEl.textContent = aborted
        ? 'Stopped: request cancelled. The server may finish the current merchant before closing the browser.'
        : String(/** @type {any} */ (e)?.message || e);
    }
  } finally {
    reloadBtn?.removeAttribute('disabled');
    setRunIdleUi();
  }
}

function wireUi() {
  filterEl?.addEventListener('input', () => {
    renderList().catch((e) => console.warn(e));
  });
  reloadBtn?.addEventListener('click', () => {
    if (runStreamActive) return;
    loadMerchants(true).catch((e) => {
      if (statusEl) statusEl.textContent = String(e.message || e);
    });
  });
  const checkFiltered = () => {
    merchantInputsInScrollport().forEach((inp) => {
      inp.checked = true;
      selectedMerchantNames.add(inp.value);
    });
    updateSelectedSummary();
  };
  const uncheckFiltered = () => {
    merchantList?.querySelectorAll('input[type="checkbox"]').forEach((el) => {
      const inp = /** @type {HTMLInputElement} */ (el);
      inp.checked = false;
      selectedMerchantNames.delete(inp.value);
    });
    updateSelectedSummary();
  };
  checkFilteredBtn?.addEventListener('click', checkFiltered);
  uncheckFilteredBtn?.addEventListener('click', uncheckFiltered);
  resultsFilterEl?.addEventListener('input', () => applyResultsFilter());
  for (const el of modeEls) {
    el.addEventListener('change', () => {
      persistFormDebounced();
      updateModeUi();
    });
  }
  resultsMinimizeBtn?.addEventListener('click', () => {
    if (!resultsPanel) return;
    const collapsed = resultsPanel.classList.toggle('results-minimized');
    resultsMinimizeBtn.textContent = collapsed ? 'Expand results' : 'Minimize results';
    resultsMinimizeBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    saveStored({ resultsMinimized: collapsed });
  });
  deleteAllResultsBtn?.addEventListener('click', () => deleteAllResults());
  runBtn?.addEventListener('click', () => {
    if (runStreamActive && runAbortController) {
      runAbortController.abort();
      return;
    }
    runSelected().catch((e) => {
      if (statusEl) statusEl.textContent = String(e.message || e);
    });
  });

  googleSpreadsheetIdEl?.addEventListener('input', persistFormDebounced);
  googleTabTitleEl?.addEventListener('input', persistFormDebounced);
  exportGoogleSheetEl?.addEventListener('change', persistFormDebounced);
}

function init() {
  if (!filterEl || !merchantList || !tbody || !runBtn || !statusEl) {
    console.error('Latency UI: missing required DOM nodes.');
    return;
  }
  wireUi();
  applyStoredForm();
  const st0 = loadStored();
  if (st0.resultsMinimized && resultsPanel) {
    resultsPanel.classList.add('results-minimized');
    if (resultsMinimizeBtn) {
      resultsMinimizeBtn.textContent = 'Expand results';
      resultsMinimizeBtn.setAttribute('aria-expanded', 'false');
    }
  }
  const seedFeed = readMerchantFeedFromStorage();
  if (seedFeed?.merchants?.length) {
    merchants = seedFeed.merchants;
    renderList().catch((e) => console.warn(e));
    statusEl.textContent = merchantLoadedStatus(merchants.length, {
      merchantTotal: seedFeed.merchantTotal,
      fromCache: Boolean(seedFeed.fromCache),
      stale: Boolean(seedFeed.stale),
      browserOnly: true
    });
  }
  setTimeout(() => {
    (async () => {
      try {
        const data = await loadMerchants(false);
        const stored = loadStored();
        if (stored.lastRun?.rows?.length) {
          try {
            await applyStoredLastRunBatched();
            statusEl.textContent =
              merchantLoadedStatus(merchants.length, data) + ' Restored last run from this browser.';
          } catch (e) {
            console.warn('Could not restore last run from storage:', e);
            statusEl.textContent =
              merchantLoadedStatus(merchants.length, data) +
              ' Could not restore saved results; try clearing site data for this origin.';
          }
        }
      } catch (e) {
        statusEl.textContent = String(/** @type {any} */ (e)?.message || e);
      }
    })();
  }, 0);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
