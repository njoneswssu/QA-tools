try {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
} catch (_) {}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function loadProducts() {
  const url = chrome.runtime.getURL('products.json');
  const res = await fetch(url);
  return res.json();
}

function waitTabComplete(tabId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpd);
      reject(new Error('Tab load timeout'));
    }, 120000);

    function onUpd(id, info) {
      if (id !== tabId) return;
      if (info.status === 'complete') {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(onUpd);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(onUpd);
    chrome.tabs.get(tabId).then((t) => {
      if (t.status === 'complete') {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(onUpd);
        resolve();
      }
    });
  });
}

/**
 * Prefer tabs.captureTab(tabId) when the browser supports it: captures that tab even when the side panel
 * has focus or another tab was briefly active. Falls back to captureVisibleTab after
 * focusing the window and waiting for the tab to become active.
 */
async function captureScreenshotForTab(tabId, windowId) {
  let lastErr = null;

  if (typeof chrome.tabs.captureTab === 'function') {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const dataUrl = await chrome.tabs.captureTab(tabId, { format: 'png' });
        if (dataUrl && dataUrl.length > 100) {
          const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
          return { dataUrl, base64 };
        }
      } catch (e) {
        lastErr = e;
        await sleep(350 * (attempt + 1));
      }
    }
  }

  await chrome.tabs.update(tabId, { active: true });
  await chrome.windows.update(windowId, { focused: true });

  for (let i = 0; i < 50; i++) {
    const t = await chrome.tabs.get(tabId);
    if (t.active && t.windowId === windowId) break;
    await sleep(80);
  }
  await sleep(900);

  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
      return { dataUrl, base64 };
    } catch (e) {
      lastErr = e;
      await sleep(450 * (attempt + 1));
    }
  }
  throw lastErr || new Error('captureVisibleTab failed');
}

function todayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function buildServerShapedRow(partial, id, testDate, screenshotDataBase64, screenshotUrl, createdAtIso) {
  const promoRaw = partial.promo_percentage;
  let promoNum = null;
  if (promoRaw != null && promoRaw !== '') {
    const n = parseFloat(String(promoRaw));
    promoNum = Number.isNaN(n) ? null : n;
  }
  const toNum = (v) => {
    if (v == null || v === '') return null;
    const n = parseFloat(String(v));
    return Number.isNaN(n) ? null : n;
  };
  return {
    id,
    product_id: partial.product_id != null ? String(partial.product_id) : null,
    product_name: partial.product_name ?? null,
    product_url: partial.product_url ?? null,
    model: partial.model ?? null,
    test_date: testDate,
    width: partial.width != null ? parseInt(partial.width, 10) : null,
    height: partial.height != null ? parseInt(partial.height, 10) : null,
    color: partial.color ?? null,
    original_price: toNum(partial.original_price),
    promotional_price: toNum(partial.promotional_price),
    promo_percentage: promoNum,
    screenshot_path: null,
    screenshot_data: screenshotDataBase64,
    screenshot_url: screenshotUrl,
    created_at: createdAtIso || new Date().toISOString()
  };
}

function storageLocalSet(obj) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(obj, () => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve();
    });
  });
}

async function setTestResultsStripScreenshotsOnQuota(nextRows) {
  try {
    await storageLocalSet({ testResults: nextRows });
    return;
  } catch (e) {
    if (!String(e.message).toLowerCase().includes('quota')) throw e;
  }
  const slim = nextRows.map((r) => ({ ...r, screenshot_data: null, screenshot_url: null }));
  await storageLocalSet({ testResults: slim });
}

async function persistTestResult(tabId, partial) {
  const id = Date.now();
  const testDate = todayLocal();
  const createdAtIso = new Date().toISOString();
  const row = buildServerShapedRow(partial, id, testDate, null, null, createdAtIso);
  const { testResults = [] } = await chrome.storage.local.get('testResults');
  const next = [row, ...testResults];
  await setTestResultsStripScreenshotsOnQuota(next);

  let tab = null;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch (_) {
    return row;
  }

  if (tab?.windowId == null) return row;

  try {
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'PREPARE_SCREENSHOT' });
    } catch (_) {
      /* tab may not have content script yet */
    }
    await sleep(600);

    const cap = await captureScreenshotForTab(tab.id, tab.windowId);
    const { testResults: tr = [] } = await chrome.storage.local.get('testResults');
    const idx = tr.findIndex((r) => r.id === id);
    if (idx >= 0) {
      const updated = [...tr];
      updated[idx] = {
        ...updated[idx],
        screenshot_data: cap.base64,
        screenshot_url: cap.dataUrl
      };
      try {
        await storageLocalSet({ testResults: updated });
      } catch (e) {
        if (String(e.message).toLowerCase().includes('quota')) {
          const slim = updated.map((r) => ({ ...r, screenshot_data: null, screenshot_url: null }));
          await storageLocalSet({ testResults: slim });
        }
      }
    }
  } catch (_) {
    /* row without screenshot */
  }

  const { testResults: tr2 = [] } = await chrome.storage.local.get('testResults');
  return tr2.find((r) => r.id === id) || row;
}

/** Content script may not be ready immediately after navigation; retry before failing. */
async function sendRunTestToTab(tabId, product) {
  let lastErr = null;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        type: 'RUN_LOWES_TEST',
        product
      });
      if (response && typeof response === 'object') {
        return response;
      }
    } catch (e) {
      lastErr = e;
    }
    await sleep(500);
  }
  return { ok: false, error: lastErr?.message || 'No response from Lowe’s page (reload tab and try again)' };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'RUN_TEST_ON_TAB') {
    (async () => {
      const tabId = msg.tabId;
      try {
        const response = await sendRunTestToTab(tabId, msg.product);
        if (!response?.ok || !response.partial) {
          sendResponse(response || { ok: false, error: 'No response from page' });
          return;
        }
        const final = await persistTestResult(tabId, response.partial);
        sendResponse({ ok: true, result: final });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true;
  }

  if (msg.type === 'GET_PRODUCTS') {
    loadProducts().then((p) => sendResponse({ ok: true, products: p })).catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  if (msg.type === 'OPEN_URL') {
    chrome.tabs.create({ url: msg.url, active: msg.active !== false }).then((t) => sendResponse({ ok: true, tabId: t.id })).catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  if (msg.type === 'RUN_PRODUCT_NEW_TAB') {
    (async () => {
      try {
        const tab = await chrome.tabs.create({ url: msg.product.url, active: true });
        await waitTabComplete(tab.id);
        await sleep(5000 + Math.random() * 2000);
        const response = await sendRunTestToTab(tab.id, msg.product);
        if (!response?.ok || !response.partial) {
          sendResponse(response || { ok: false, error: 'No response from page' });
          return;
        }
        const final = await persistTestResult(tab.id, response.partial);
        sendResponse({ ok: true, result: final });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true;
  }

  if (msg.type === 'RUN_SEQUENCE') {
    (async () => {
      const { productIds, tabId: preferredTabId } = msg;
      try {
        await chrome.storage.local.set({ shouldStop: false, sequenceRunning: true });
        const products = await loadProducts();
        const selected = products.filter((p) => productIds.includes(p.id));
        let tabId = preferredTabId;
        const tab = tabId != null ? await chrome.tabs.get(tabId).catch(() => null) : null;
        if (!tab || !tab.url?.includes('lowes.com')) {
          const t = await chrome.tabs.create({ url: 'https://www.lowes.com/', active: true });
          tabId = t.id;
          await waitTabComplete(tabId);
          await sleep(2000);
        }

        for (let i = 0; i < selected.length; i++) {
          const { shouldStop } = await chrome.storage.local.get('shouldStop');
          if (shouldStop) break;

          const product = selected[i];
          await chrome.tabs.update(tabId, { url: product.url });
          await waitTabComplete(tabId);
          await sleep(4000 + Math.random() * 2000);

          const seqRes = await sendRunTestToTab(tabId, product);
          if (seqRes?.ok && seqRes.partial) {
            try {
              await persistTestResult(tabId, seqRes.partial);
            } catch (_) {
              /* continue sequence */
            }
          }

          if (i < selected.length - 1) {
            await sleep(3000 + Math.random() * 2000);
          }
        }

        await chrome.storage.local.set({ sequenceRunning: false, shouldStop: false });
        sendResponse({ ok: true });
      } catch (e) {
        await chrome.storage.local.set({ sequenceRunning: false });
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true;
  }

  if (msg.type === 'STOP_SEQUENCE') {
    chrome.storage.local.set({ shouldStop: true });
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === 'TOGGLE_PAUSE') {
    (async () => {
      const { automationPaused } = await chrome.storage.local.get('automationPaused');
      const next = !automationPaused;
      await chrome.storage.local.set({ automationPaused: next });
      sendResponse({ ok: true, paused: next });
    })();
    return true;
  }

  if (msg.type === 'GET_PAUSE_STATE') {
    chrome.storage.local.get('automationPaused').then((o) => sendResponse({ paused: !!o.automationPaused }));
    return true;
  }

  return false;
});
