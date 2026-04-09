let products = [];
const selected = new Set();

let shotLightboxSrc = '';

function syncLightboxSizeButton() {
  const box = document.getElementById('shotLightbox');
  const t = document.getElementById('shotLightboxToggleSize');
  if (!box || !t) return;
  const expanded = box.classList.contains('shot-lightbox--expanded');
  t.textContent = expanded ? 'Smaller' : 'Larger';
  t.title = expanded ? 'Shrink preview' : 'Expand preview';
}

function initShotLightbox() {
  const box = document.getElementById('shotLightbox');
  const dock = document.getElementById('shotLightboxDock');
  const fullImg = document.getElementById('shotLightboxImg');
  const dockImg = document.getElementById('shotLightboxDockImg');

  function closeAll() {
    box.hidden = true;
    dock.hidden = true;
    box.classList.remove('minimized', 'shot-lightbox--compact', 'shot-lightbox--expanded');
    fullImg.removeAttribute('src');
    dockImg.removeAttribute('src');
    shotLightboxSrc = '';
  }

  function openFromDock() {
    if (!shotLightboxSrc) return;
    fullImg.src = shotLightboxSrc;
    box.hidden = false;
    box.classList.remove('minimized');
    box.classList.add('shot-lightbox--compact');
    box.classList.remove('shot-lightbox--expanded');
    syncLightboxSizeButton();
    dock.hidden = true;
  }

  document.getElementById('shotLightboxBackdrop').addEventListener('click', closeAll);
  document.getElementById('shotLightboxClose').addEventListener('click', closeAll);
  document.getElementById('shotLightboxToggleSize').addEventListener('click', (e) => {
    e.stopPropagation();
    if (box.classList.contains('shot-lightbox--expanded')) {
      box.classList.remove('shot-lightbox--expanded');
      box.classList.add('shot-lightbox--compact');
    } else {
      box.classList.remove('shot-lightbox--compact');
      box.classList.add('shot-lightbox--expanded');
    }
    syncLightboxSizeButton();
  });
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
  fullImg.src = src;
  box.classList.remove('minimized', 'shot-lightbox--expanded');
  box.classList.add('shot-lightbox--compact');
  syncLightboxSizeButton();
  box.hidden = false;
  dock.hidden = true;
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
  const q = (document.getElementById('productSearch').value || '').toLowerCase().trim();
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
      else {
        selected.delete(p.id);
        document.getElementById('checkAll').checked = false;
      }
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

async function renderResultsFilterList(allResults, hidden) {
  const host = document.getElementById('resultsFilterList');
  if (!host) return;
  host.innerHTML = '';
  const pairs = uniqueProductsFromResults(allResults);
  for (const [pid, label] of pairs) {
    const row = document.createElement('div');
    row.className = 'results-filter-row';
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
  selected.clear();
  if (on) products.forEach((p) => selected.add(p.id));
  renderProducts();
  updateSelectedCount();
});

document.getElementById('btnUncheckFiltered').addEventListener('click', () => {
  const q = (document.getElementById('productSearch').value || '').toLowerCase().trim();
  if (!q) {
    toast('Type in the search box first — only matching rows are unchecked');
    return;
  }
  let n = 0;
  products.forEach((p) => {
    if (productSearchBlob(p).includes(q) && selected.has(p.id)) {
      selected.delete(p.id);
      n++;
    }
  });
  document.getElementById('checkAll').checked = false;
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
  if (!selected.size) {
    toast('Select at least one product');
    return;
  }
  if (!confirm(`Start testing ${selected.size} product(s) in one tab, one after another?`)) return;
  const pauseBtn = document.getElementById('btnSeqPause');
  pauseBtn.hidden = false;
  await syncSequencePauseButton();
  toast('Run started — Pause freezes between steps; keep the side panel open for screenshots');
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tabs[0]?.url?.includes('lowes.com') ? tabs[0].id : undefined;
  chrome.runtime.sendMessage(
    { type: 'RUN_SEQUENCE', productIds: Array.from(selected), tabId },
    async (res) => {
      pauseBtn.hidden = true;
      pauseBtn.classList.remove('primary');
      pauseBtn.classList.add('warn');
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
  await chrome.storage.local.set({ testResults: [] });
  await loadResults();
  toast('Cleared');
});

initShotLightbox();
loadProducts();
loadResults();
