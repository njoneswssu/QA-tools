let products = [];
const selected = new Set();

let shotLightboxSrc = '';

function initShotLightbox() {
  const box = document.getElementById('shotLightbox');
  const dock = document.getElementById('shotLightboxDock');
  const fullImg = document.getElementById('shotLightboxImg');
  const dockImg = document.getElementById('shotLightboxDockImg');

  function closeAll() {
    box.hidden = true;
    dock.hidden = true;
    box.classList.remove('minimized');
    fullImg.removeAttribute('src');
    dockImg.removeAttribute('src');
    shotLightboxSrc = '';
  }

  function openFromDock() {
    if (!shotLightboxSrc) return;
    fullImg.src = shotLightboxSrc;
    box.hidden = false;
    box.classList.remove('minimized');
    dock.hidden = true;
  }

  document.getElementById('shotLightboxBackdrop').addEventListener('click', closeAll);
  document.getElementById('shotLightboxClose').addEventListener('click', closeAll);
  document.getElementById('shotLightboxMin').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!shotLightboxSrc) return;
    dockImg.src = shotLightboxSrc;
    box.classList.add('minimized');
    box.hidden = true;
    dock.hidden = false;
  });
  document.getElementById('shotLightboxDockRestore').addEventListener('click', openFromDock);
  document.getElementById('shotLightboxDockThumb').addEventListener('click', openFromDock);
  document.getElementById('shotLightboxDockClose').addEventListener('click', closeAll);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && (!box.hidden || !dock.hidden)) closeAll();
  });
}

function openShotPreview(src) {
  if (!src) return;
  shotLightboxSrc = src;
  const box = document.getElementById('shotLightbox');
  const fullImg = document.getElementById('shotLightboxImg');
  const dock = document.getElementById('shotLightboxDock');
  const bodyEl = box.querySelector('.shot-lightbox__body');
  fullImg.onload = () => {
    if (bodyEl) bodyEl.scrollTop = 0;
  };
  fullImg.src = src;
  if (fullImg.complete && bodyEl) bodyEl.scrollTop = 0;
  box.classList.remove('minimized');
  box.hidden = false;
  dock.hidden = true;
}

const BACKUP_FILE_VERSION = 1;

async function exportResultsBackup() {
  const { testResults = [], resultsHiddenProductIds = [] } = await chrome.storage.local.get([
    'testResults',
    'resultsHiddenProductIds'
  ]);
  const payload = {
    version: BACKUP_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    extension: 'lowes-promo-tester',
    testResults,
    resultsHiddenProductIds
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  a.href = url;
  a.download = `lowes-promo-tester-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  toast(`Exported ${testResults.length} result(s)`);
}

function parseBackupPayload(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Not valid JSON');
  }
  if (!data || typeof data !== 'object') throw new Error('Invalid backup file');
  if (!Array.isArray(data.testResults)) throw new Error('Backup must contain a testResults array');
  return data;
}

async function applyImportedBackup(text) {
  const data = parseBackupPayload(text);
  const incoming = data.testResults.filter((r) => r && typeof r === 'object');
  const hiddenIn = Array.isArray(data.resultsHiddenProductIds)
    ? data.resultsHiddenProductIds.map(String)
    : [];
  const replace = confirm(
    'Replace all current results with this backup?\n\nOK = replace\nCancel = merge with current (duplicate ids: keep version from file)'
  );
  if (replace) {
    try {
      await chrome.storage.local.set({
        testResults: incoming,
        resultsHiddenProductIds: hiddenIn
      });
    } catch (e) {
      throw new Error(e.message?.includes('quota') ? 'Too large for storage — export without screenshots or clear old results' : e.message);
    }
    toast(`Imported ${incoming.length} result(s) (replaced)`);
    return;
  }
  const { testResults: existing = [], resultsHiddenProductIds: oldHidden = [] } = await chrome.storage.local.get([
    'testResults',
    'resultsHiddenProductIds'
  ]);
  const seen = new Set();
  const merged = [];
  for (const r of [...incoming, ...existing]) {
    const id = String(r?.id ?? '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    merged.push(r);
  }
  merged.sort((a, b) => Number(b.id) - Number(a.id));
  const hidSet = new Set((oldHidden || []).map(String));
  hiddenIn.forEach((id) => hidSet.add(id));
  try {
    await chrome.storage.local.set({
      testResults: merged,
      resultsHiddenProductIds: [...hidSet]
    });
  } catch (e) {
    throw new Error(e.message?.includes('quota') ? 'Too large for storage after merge' : e.message);
  }
  toast(`Merged backup: ${incoming.length} from file, ${merged.length} total`);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'REQUEST_TAB_CAPTURE') return false;
  (async () => {
    try {
      const { tabId } = msg;
      await chrome.tabs.update(tabId, { active: true });
      const t = await chrome.tabs.get(tabId);
      await chrome.windows.update(t.windowId, { focused: true });
      await new Promise((r) => setTimeout(r, 500));
      const dataUrl = await chrome.tabs.captureVisibleTab(t.windowId, { format: 'png' });
      const i = dataUrl.indexOf(',');
      const base64 = i >= 0 && dataUrl.slice(0, i).includes('base64') ? dataUrl.slice(i + 1) : '';
      if (base64.length < 40) {
        sendResponse({ ok: false, error: 'empty capture' });
        return;
      }
      sendResponse({ ok: true, dataUrl, base64 });
    } catch (e) {
      sendResponse({ ok: false, error: e.message || String(e) });
    }
  })();
  return true;
});

function displayName(name) {
  let n = name || '';
  if (n.toLowerCase().includes('french door') && !n.toLowerCase().includes('shutters')) {
    n = `${n} Shutters`;
  }
  return n;
}

/** Text used for search — includes display suffix (e.g. Shutters) so "shutters" finds French Doors. */
function productSearchBlob(p) {
  const rawName = (p.name || '').toLowerCase();
  const parts = [
    p.name,
    p.model,
    displayName(p.name),
    rawName.includes('french door') && !rawName.includes('shutter') ? 'shutters shutter' : ''
  ];
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function productSearchQuery() {
  return (document.getElementById('productSearch').value || '').toLowerCase().trim();
}

/** Products whose rows are visible for the current search (all products when search is empty). */
function getVisibleProducts() {
  const q = productSearchQuery();
  return products.filter((p) => !q || productSearchBlob(p).includes(q));
}

function syncCheckAllFromSelection() {
  const cb = document.getElementById('checkAll');
  if (!cb) return;
  const visible = getVisibleProducts();
  if (!visible.length) {
    cb.checked = false;
    cb.indeterminate = false;
    return;
  }
  const nSel = visible.filter((p) => selected.has(p.id)).length;
  cb.checked = nSel === visible.length;
  cb.indeterminate = nSel > 0 && nSel < visible.length;
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.hidden = false;
  setTimeout(() => {
    el.hidden = true;
  }, 3200);
}

async function syncSequencePauseButton() {
  const btn = document.getElementById('btnSeqPause');
  if (!btn || btn.hidden) return;
  try {
    const r = await chrome.runtime.sendMessage({ type: 'GET_PAUSE_STATE' });
    const paused = !!r?.paused;
    btn.textContent = paused ? 'Resume' : 'Pause';
    btn.classList.toggle('warn', !paused);
    btn.classList.toggle('primary', paused);
  } catch (_) {}
}

async function syncSeqRunButton() {
  const btnSeq = document.getElementById('btnSeq');
  const pauseBtn = document.getElementById('btnSeqPause');
  if (!btnSeq || !pauseBtn) return;
  try {
    const { sequenceRunning } = await chrome.storage.local.get('sequenceRunning');
    if (sequenceRunning) {
      btnSeq.textContent = 'Stop testing';
      btnSeq.classList.remove('primary');
      btnSeq.classList.add('danger');
      pauseBtn.hidden = false;
      await syncSequencePauseButton();
    } else {
      btnSeq.textContent = 'Start testing';
      btnSeq.classList.add('primary');
      btnSeq.classList.remove('danger');
      pauseBtn.hidden = true;
      pauseBtn.classList.remove('primary');
      pauseBtn.classList.add('warn');
    }
  } catch (_) {}
}

function updateSelectedCount() {
  const el = document.getElementById('selectedCount');
  if (!el) return;
  const n = selected.size;
  el.textContent = `${n} product${n === 1 ? '' : 's'} selected`;
}

async function loadProducts() {
  const url = chrome.runtime.getURL('products.json');
  const res = await fetch(url);
  products = await res.json();
  renderProducts();
  fillActiveSelect();
}

function renderProducts() {
  const list = document.getElementById('productList');
  const q = productSearchQuery();
  list.innerHTML = '';
  products.forEach((p) => {
    const text = productSearchBlob(p);
    if (q && !text.includes(q)) return;

    const row = document.createElement('div');
    row.className = 'product-item';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = p.id;
    cb.checked = selected.has(p.id);
    cb.addEventListener('change', () => {
      if (cb.checked) selected.add(p.id);
      else selected.delete(p.id);
      syncCheckAllFromSelection();
      updateSelectedCount();
    });
    const lab = document.createElement('label');
    lab.htmlFor = `cb-${p.id}`;
    cb.id = `cb-${p.id}`;
    lab.innerHTML = `<strong>${displayName(p.name)}</strong><span class="product-model">${p.model || ''}</span>`;
    row.appendChild(cb);
    row.appendChild(lab);
    list.appendChild(row);
  });
  syncCheckAllFromSelection();
  updateSelectedCount();
}

function fillActiveSelect() {
  const sel = document.getElementById('activeProductSelect');
  sel.innerHTML = '';
  products.forEach((p) => {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = displayName(p.name);
    sel.appendChild(o);
  });
}

async function loadResults() {
  const { testResults = [], resultsHiddenProductIds = [] } = await chrome.storage.local.get([
    'testResults',
    'resultsHiddenProductIds'
  ]);
  const hidden = new Set((resultsHiddenProductIds || []).map(String));
  const visibleRows = testResults.filter((r) => !hidden.has(String(r.product_id ?? '')));
  const grid = document.getElementById('resultsGrid');
  if (!testResults.length) {
    grid.innerHTML = '<p class="muted">No results yet. Use Start testing or Run on active tab.</p>';
  } else if (!visibleRows.length) {
    grid.innerHTML =
      '<p class="muted">Every blind is hidden — open <strong>Filter blinds</strong> and check products to show them again.</p>';
  } else {
    renderResults(visibleRows);
  }
  updateStats(testResults, visibleRows);
  const panel = document.getElementById('resultsFilterPanel');
  if (panel && !panel.hidden) {
    await renderResultsFilterList(testResults, hidden);
  }
}

function updateStats(allRows, visibleRows) {
  document.getElementById('totalTests').textContent = String(allRows.length);
  const ids = new Set(allRows.map((r) => r.product_id).filter(Boolean));
  document.getElementById('totalProducts').textContent = String(ids.size);
  const avgSource = visibleRows.length ? visibleRows : allRows;
  const nums = avgSource
    .map((r) => parseFloat(String(r.promo_percentage ?? '')))
    .filter((n) => !Number.isNaN(n));
  const avg = nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : '0';
  document.getElementById('avgPromo').textContent = avg;
  const note = document.getElementById('resultsScopeNote');
  if (note) {
    if (visibleRows.length !== allRows.length) {
      note.textContent = `Showing ${visibleRows.length} of ${allRows.length} results`;
      note.hidden = false;
    } else {
      note.textContent = '';
      note.hidden = true;
    }
  }
}

function renderResults(rowsToShow) {
  const grid = document.getElementById('resultsGrid');
  grid.innerHTML = '';
  rowsToShow.forEach((r) => {
    const card = document.createElement('div');
    card.className = 'card';
    const pct =
      r.promo_percentage != null && r.promo_percentage !== ''
        ? parseFloat(String(r.promo_percentage)).toFixed(1)
        : '0';
    const shot =
      r.screenshot_url ||
      (r.screenshot_data ? `data:image/png;base64,${r.screenshot_data}` : '');
    card.innerHTML = `
      <div class="card-hdr">
        <div>
          <button type="button" class="del" data-id="${r.id}" title="Delete">🗑</button>
          <h3>${displayName(r.product_name || r.model)}</h3>
          <div class="row">${r.model || ''}</div>
        </div>
        <span class="badge">${pct}% off</span>
      </div>
      <div class="row">Date: ${r.test_date || '—'} · ${r.width != null ? `${r.width}" × ${r.height}"` : '—'} · ${r.color || '—'}</div>
      <div class="prices">
        <div><span>Original</span><div class="orig">${fmtPrice(r.original_price)}</div></div>
        <div><span>Promo</span><div class="promo">${fmtPrice(r.promotional_price)}</div></div>
      </div>
      ${r.error ? `<div class="err">${escapeHtml(r.error)}</div>` : ''}
    `;
    card.querySelector('.del').addEventListener('click', () => deleteResult(r.id));
    if (shot) {
      const wrap = document.createElement('button');
      wrap.type = 'button';
      wrap.className = 'result-shot-wrap';
      wrap.setAttribute('aria-label', 'View screenshot full size');
      const img = document.createElement('img');
      img.src = shot;
      img.className = 'result-shot';
      img.alt = 'Configuration screenshot';
      wrap.appendChild(img);
      wrap.addEventListener('click', (e) => {
        e.preventDefault();
        openShotPreview(img.src);
      });
      card.appendChild(wrap);
    }
    grid.appendChild(card);
  });
}

function fmtPrice(v) {
  if (v == null || v === '') return '—';
  const n = parseFloat(String(v));
  return Number.isNaN(n) ? '—' : `$${n.toFixed(2)}`;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

async function deleteResult(id) {
  const { testResults = [] } = await chrome.storage.local.get('testResults');
  const next = testResults.filter((r) => r.id !== id);
  await chrome.storage.local.set({ testResults: next });
  await loadResults();
}

function uniqueProductsFromResults(rows) {
  const m = new Map();
  for (const r of rows) {
    const pid = String(r.product_id ?? '');
    if (!pid) continue;
    if (!m.has(pid)) {
      const name = r.product_name || r.model || `Product ${pid}`;
      m.set(pid, displayName(name));
    }
  }
  return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
}

function applyResultsFilterSearch() {
  const input = document.getElementById('resultsFilterSearch');
  const host = document.getElementById('resultsFilterList');
  if (!input || !host) return;
  host.querySelectorAll('.results-filter-no-match').forEach((n) => n.remove());
  const q = (input.value || '').toLowerCase().trim();
  const rows = host.querySelectorAll('.results-filter-row');
  let visible = 0;
  for (const row of rows) {
    const blob = (row.dataset.filterBlob || '').toLowerCase();
    const match = !q || blob.includes(q);
    row.classList.toggle('results-filter-row--hidden', !match);
    if (match) visible++;
  }
  if (rows.length && !visible) {
    const p = document.createElement('p');
    p.className = 'results-filter-no-match results-filter-empty-msg muted';
    p.textContent = 'No blinds match this search. Clear the box to see all.';
    host.appendChild(p);
  }
}

function getShownFilterPids() {
  const host = document.getElementById('resultsFilterList');
  if (!host) return [];
  return [...host.querySelectorAll('.results-filter-row:not(.results-filter-row--hidden)')].map((r) => r.dataset.pid).filter(Boolean);
}

async function renderResultsFilterList(allResults, hidden) {
  const host = document.getElementById('resultsFilterList');
  if (!host) return;
  host.innerHTML = '';
  const pairs = uniqueProductsFromResults(allResults);
  if (!pairs.length) {
    const p = document.createElement('p');
    p.className = 'results-filter-empty-msg muted';
    p.textContent = 'No saved results yet — nothing to filter.';
    host.appendChild(p);
    return;
  }
  for (const [pid, label] of pairs) {
    const row = document.createElement('div');
    row.className = 'results-filter-row';
    row.dataset.pid = pid;
    row.dataset.filterBlob = `${label} ${pid}`.toLowerCase();
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !hidden.has(pid);
    const safeId = `rf-${pid.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    cb.id = safeId;
    const lab = document.createElement('label');
    lab.htmlFor = safeId;
    lab.textContent = label;
    cb.addEventListener('change', async () => {
      const { resultsHiddenProductIds = [] } = await chrome.storage.local.get('resultsHiddenProductIds');
      const set = new Set((resultsHiddenProductIds || []).map(String));
      if (cb.checked) set.delete(pid);
      else set.add(pid);
      await chrome.storage.local.set({ resultsHiddenProductIds: [...set] });
    });
    row.appendChild(cb);
    row.appendChild(lab);
    host.appendChild(row);
  }
  applyResultsFilterSearch();
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.testResults || changes.resultsHiddenProductIds) {
    loadResults();
  }
  if (changes.automationPaused) {
    syncSequencePauseButton();
  }
});

document.getElementById('productSearch').addEventListener('input', renderProducts);

document.getElementById('checkAll').addEventListener('change', (e) => {
  const on = e.target.checked;
  const visible = getVisibleProducts();
  if (on) {
    visible.forEach((p) => selected.add(p.id));
  } else {
    visible.forEach((p) => selected.delete(p.id));
  }
  renderProducts();
  updateSelectedCount();
});

document.getElementById('btnUncheckFiltered').addEventListener('click', () => {
  const q = productSearchQuery();
  if (!q) {
    const n = selected.size;
    selected.clear();
    syncCheckAllFromSelection();
    renderProducts();
    toast(n ? `Unchecked all ${n} product(s)` : 'Nothing was selected');
    return;
  }
  let n = 0;
  products.forEach((p) => {
    if (productSearchBlob(p).includes(q) && selected.has(p.id)) {
      selected.delete(p.id);
      n++;
    }
  });
  syncCheckAllFromSelection();
  renderProducts();
  toast(n ? `Unchecked ${n} matching product(s)` : 'No checked products match this search');
});

document.getElementById('btnRunActive').addEventListener('click', async () => {
  const id = document.getElementById('activeProductSelect').value;
  const product = products.find((p) => p.id === id);
  if (!product) return;
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id || !tab.url?.includes('lowes.com')) {
    toast('Switch to a Lowe’s tab first (or use Start testing).');
    return;
  }
  toast('Running…');
  try {
    const res = await chrome.runtime.sendMessage({
      type: 'RUN_TEST_ON_TAB',
      tabId: tab.id,
      product
    });
    if (res?.ok) {
      toast('Done');
      await loadResults();
    } else {
      toast(res?.error || 'Failed');
    }
  } catch (e) {
    toast(e.message || 'Failed — refresh the Lowe’s tab and try again');
  }
});

document.getElementById('btnSeq').addEventListener('click', async () => {
  const { sequenceRunning } = await chrome.storage.local.get('sequenceRunning');
  if (sequenceRunning) {
    try {
      await chrome.runtime.sendMessage({ type: 'STOP_SEQUENCE' });
      toast('Stopping after the current step…');
    } catch (e) {
      toast(e.message || 'Could not stop');
    }
    return;
  }

  if (!selected.size) {
    toast('Select at least one product');
    return;
  }
  if (!confirm(`Start testing ${selected.size} product(s) in one tab, one after another?`)) return;

  await chrome.storage.local.set({ shouldStop: false });
  const btnSeq = document.getElementById('btnSeq');
  const pauseBtn = document.getElementById('btnSeqPause');
  btnSeq.textContent = 'Stop testing';
  btnSeq.classList.remove('primary');
  btnSeq.classList.add('danger');
  pauseBtn.hidden = false;
  await syncSequencePauseButton();

  toast('Run started — Pause freezes between steps; keep the side panel open for screenshots');
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tabs[0]?.url?.includes('lowes.com') ? tabs[0].id : undefined;
  chrome.runtime.sendMessage(
    { type: 'RUN_SEQUENCE', productIds: Array.from(selected), tabId },
    async (res) => {
      await syncSeqRunButton();
      await loadResults();
      if (chrome.runtime.lastError) {
        toast(chrome.runtime.lastError.message);
        return;
      }
      if (res?.ok) toast('Run finished');
      else toast(res?.error || 'Run error');
    }
  );
});

document.getElementById('btnSeqPause').addEventListener('click', async () => {
  try {
    const r = await chrome.runtime.sendMessage({ type: 'TOGGLE_PAUSE' });
    await syncSequencePauseButton();
    toast(r?.paused ? 'Paused — press Resume to continue' : 'Resumed');
  } catch (e) {
    toast(e.message || 'Could not toggle pause');
  }
});

document.getElementById('btnResultsFilter').addEventListener('click', async () => {
  const p = document.getElementById('resultsFilterPanel');
  const { testResults = [], resultsHiddenProductIds = [] } = await chrome.storage.local.get([
    'testResults',
    'resultsHiddenProductIds'
  ]);
  const hidden = new Set((resultsHiddenProductIds || []).map(String));
  p.hidden = !p.hidden;
  if (!p.hidden) {
    await renderResultsFilterList(testResults, hidden);
  }
});

document.getElementById('btnResultsFilterClose').addEventListener('click', () => {
  document.getElementById('resultsFilterPanel').hidden = true;
});

document.getElementById('resultsFilterSearch').addEventListener('input', () => {
  applyResultsFilterSearch();
});

document.getElementById('btnResultsFilterCheckShown').addEventListener('click', async () => {
  const pids = getShownFilterPids();
  if (!pids.length) {
    toast('No blinds in the filtered list — adjust search or add results.');
    return;
  }
  const { resultsHiddenProductIds = [] } = await chrome.storage.local.get('resultsHiddenProductIds');
  const set = new Set((resultsHiddenProductIds || []).map(String));
  pids.forEach((pid) => set.delete(pid));
  await chrome.storage.local.set({ resultsHiddenProductIds: [...set] });
});

document.getElementById('btnResultsFilterUncheckShown').addEventListener('click', async () => {
  const pids = getShownFilterPids();
  if (!pids.length) {
    toast('No blinds in the filtered list — adjust search or add results.');
    return;
  }
  const { resultsHiddenProductIds = [] } = await chrome.storage.local.get('resultsHiddenProductIds');
  const set = new Set((resultsHiddenProductIds || []).map(String));
  pids.forEach((pid) => set.add(pid));
  await chrome.storage.local.set({ resultsHiddenProductIds: [...set] });
});

document.getElementById('btnResultsFilterAll').addEventListener('click', async () => {
  await chrome.storage.local.set({ resultsHiddenProductIds: [] });
});

document.getElementById('btnResultsFilterNone').addEventListener('click', async () => {
  const { testResults = [] } = await chrome.storage.local.get('testResults');
  const allIds = [...new Set(testResults.map((r) => String(r.product_id ?? '')).filter(Boolean))];
  await chrome.storage.local.set({ resultsHiddenProductIds: allIds });
});

document.getElementById('btnClear').addEventListener('click', async () => {
  if (!confirm('Clear all saved results?')) return;
  await chrome.storage.local.set({ testResults: [], resultsHiddenProductIds: [] });
  await loadResults();
  toast('Cleared');
});

document.getElementById('btnExportBackup').addEventListener('click', () => {
  exportResultsBackup().catch((e) => toast(e.message || 'Export failed'));
});

document.getElementById('btnImportBackup').addEventListener('click', () => {
  document.getElementById('backupFileInput').click();
});

document.getElementById('backupFileInput').addEventListener('change', async (e) => {
  const input = e.target;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    const text = await file.text();
    await applyImportedBackup(text);
    await loadResults();
  } catch (err) {
    toast(err.message || 'Import failed');
  }
});

initShotLightbox();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.sequenceRunning) return;
  syncSeqRunButton();
});

loadProducts();
loadResults();
syncSeqRunButton();
