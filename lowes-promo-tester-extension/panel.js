let products = [];
const selected = new Set();

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

async function syncPauseButton() {
  try {
    const r = await chrome.runtime.sendMessage({ type: 'GET_PAUSE_STATE' });
    const paused = !!r?.paused;
    const btn = document.getElementById('btnPause');
    if (btn) {
      btn.textContent = paused ? 'Resume automation' : 'Pause automation';
      btn.classList.toggle('warn', paused);
    }
  } catch (_) {}
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
    });
    const lab = document.createElement('label');
    lab.htmlFor = `cb-${p.id}`;
    cb.id = `cb-${p.id}`;
    lab.innerHTML = `<strong>${displayName(p.name)}</strong><span class="product-model">${p.model || ''}</span>`;
    row.appendChild(cb);
    row.appendChild(lab);
    list.appendChild(row);
  });
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
  const { testResults = [] } = await chrome.storage.local.get('testResults');
  renderResults(testResults);
  updateStats(testResults);
}

function updateStats(testResults) {
  document.getElementById('totalTests').textContent = String(testResults.length);
  const ids = new Set(testResults.map((r) => r.product_id).filter(Boolean));
  document.getElementById('totalProducts').textContent = String(ids.size);
  const nums = testResults
    .map((r) => parseFloat(String(r.promo_percentage ?? '')))
    .filter((n) => !Number.isNaN(n));
  const avg = nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : '0';
  document.getElementById('avgPromo').textContent = avg;
}

function renderResults(testResults) {
  const grid = document.getElementById('resultsGrid');
  if (!testResults.length) {
    grid.innerHTML = '<p class="muted">No results yet. Run a test on a Lowe’s configure page.</p>';
    return;
  }
  grid.innerHTML = '';
  testResults.forEach((r) => {
    const card = document.createElement('div');
    card.className = 'card';
    const pct =
      r.promo_percentage != null && r.promo_percentage !== ''
        ? parseFloat(String(r.promo_percentage)).toFixed(1)
        : '0';
    const shot =
      r.screenshot_url ||
      (r.screenshot_data ? `data:image/png;base64,${r.screenshot_data}` : '');
    const imgHtml = shot ? `<img src="${shot}" alt="screenshot" class="result-shot" />` : '';
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
      ${imgHtml}
    `;
    card.querySelector('.del').addEventListener('click', () => deleteResult(r.id));
    const img = card.querySelector('img');
    if (img) {
      img.addEventListener('click', () => window.open(img.src, '_blank'));
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

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.testResults) {
    loadResults();
  }
  if (changes.automationPaused) {
    syncPauseButton();
  }
});

document.getElementById('productSearch').addEventListener('input', renderProducts);

document.getElementById('checkAll').addEventListener('change', (e) => {
  const on = e.target.checked;
  selected.clear();
  if (on) products.forEach((p) => selected.add(p.id));
  renderProducts();
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

document.getElementById('btnPause').addEventListener('click', async () => {
  try {
    const r = await chrome.runtime.sendMessage({ type: 'TOGGLE_PAUSE' });
    await syncPauseButton();
    toast(r?.paused ? 'Automation paused' : 'Automation resumed');
  } catch (e) {
    toast(e.message || 'Could not toggle pause');
  }
});

document.getElementById('btnPrepare').addEventListener('click', () => {
  if (!selected.size) {
    toast('Select at least one product');
    return;
  }
  const sec = document.getElementById('linksSection');
  const host = document.getElementById('productLinks');
  host.innerHTML = '';
  products
    .filter((p) => selected.has(p.id))
    .forEach((p) => {
      const card = document.createElement('div');
      card.className = 'link-card';
      card.innerHTML = `
        <h3>${displayName(p.name)}</h3>
        <div class="row">${p.model || ''}</div>
        <div class="link-actions">
          <a href="${p.url}" target="_blank" rel="noopener">Open product</a>
          <button type="button" class="run-new-tab" data-id="${p.id}">Start automation</button>
        </div>
      `;
      card.querySelector('.run-new-tab').addEventListener('click', async (ev) => {
        const btn = ev.target;
        btn.disabled = true;
        btn.textContent = 'Running…';
        try {
          const res = await chrome.runtime.sendMessage({
            type: 'RUN_PRODUCT_NEW_TAB',
            product: p
          });
          if (res?.ok) {
            toast('Test complete');
            await loadResults();
          } else {
            toast(res?.error || 'Failed');
          }
        } catch (err) {
          toast(err.message || 'Failed');
        }
        btn.disabled = false;
        btn.textContent = 'Start automation';
      });
      host.appendChild(card);
    });
  sec.hidden = false;
});

document.getElementById('btnRunActive').addEventListener('click', async () => {
  const id = document.getElementById('activeProductSelect').value;
  const product = products.find((p) => p.id === id);
  if (!product) return;
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id || !tab.url?.includes('lowes.com')) {
    toast('Switch to a Lowe’s tab first (or use Start automation).');
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
    toast('Select products first');
    return;
  }
  if (!confirm(`Run ${selected.size} product(s) in one tab sequentially?`)) return;
  document.getElementById('btnStop').hidden = false;
  toast('Sequence started — keep the tester tab visible for screenshots');
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tabs[0]?.url?.includes('lowes.com') ? tabs[0].id : undefined;
  chrome.runtime.sendMessage(
    { type: 'RUN_SEQUENCE', productIds: Array.from(selected), tabId },
    async (res) => {
      document.getElementById('btnStop').hidden = true;
      await loadResults();
      if (chrome.runtime.lastError) {
        toast(chrome.runtime.lastError.message);
        return;
      }
      if (res?.ok) toast('Sequence finished');
      else toast(res?.error || 'Sequence error');
    }
  );
});

document.getElementById('btnStop').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'STOP_SEQUENCE' });
  document.getElementById('btnStop').hidden = true;
  toast('Stop requested');
});

document.getElementById('btnClear').addEventListener('click', async () => {
  if (!confirm('Clear all saved results?')) return;
  await chrome.storage.local.set({ testResults: [] });
  await loadResults();
  toast('Cleared');
});

loadProducts();
loadResults();
syncPauseButton();
