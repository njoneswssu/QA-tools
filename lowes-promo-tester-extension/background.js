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

function parseCaptureDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const i = dataUrl.indexOf(',');
  if (i < 0) return null;
  const header = dataUrl.slice(0, i);
  const base64 = dataUrl.slice(i + 1);
  if (!header.includes('base64') || base64.length < 40) return null;
  return { dataUrl, base64 };
}

/**
 * Prefer tabs.captureTab when available; else captureVisibleTab after focusing the Lowe's tab.
 */
async function captureScreenshotForTab(tabId, windowId) {
  let lastErr = null;

  if (typeof chrome.tabs.captureTab === 'function') {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const dataUrl = await chrome.tabs.captureTab(tabId, { format: 'png' });
        const parsed = parseCaptureDataUrl(dataUrl);
        if (parsed) return parsed;
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
      const parsed = parseCaptureDataUrl(dataUrl);
      if (parsed) return parsed;
    } catch (e) {
      lastErr = e;
      await sleep(450 * (attempt + 1));
    }
  }
  throw lastErr || new Error('captureVisibleTab failed');
}

function requestExtensionPageCapture(tabId) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 10000);
    try {
      chrome.runtime.sendMessage({ type: 'REQUEST_TAB_CAPTURE', tabId }, (response) => {
        clearTimeout(timer);
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        if (response && response.ok && response.base64) {
          resolve({ dataUrl: response.dataUrl, base64: response.base64 });
        } else {
          resolve(null);
        }
      });
    } catch (_) {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

function computeScrollPositions(fullHeight, viewHeight) {
  const vh = Math.max(1, Math.floor(viewHeight));
  const fh = Math.max(vh, Math.ceil(fullHeight));
  const maxY = Math.max(0, fh - vh);
  if (maxY === 0) return [0];
  const positions = [];
  let y = 0;
  while (y < maxY) {
    positions.push(y);
    y += vh;
  }
  if (positions[positions.length - 1] !== maxY) {
    positions.push(maxY);
  }
  return [...new Set(positions)].sort((a, b) => a - b);
}

const MAX_FULL_PAGE_SLICES = 34;

async function dataUrlToBlob(dataUrl) {
  const r = await fetch(dataUrl);
  return r.blob();
}

async function blobToDataUrlFromBlob(blob) {
  const buf = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buf);
  const len = bytes.length;
  for (let i = 0; i < len; i += 65536) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + 65536, len)));
  }
  const ct = blob.type && blob.type.includes('png') ? 'image/png' : 'image/png';
  return `data:${ct};base64,${btoa(binary)}`;
}

async function stitchScreenshotSlices(slices, positions, fullHeight, dpr) {
  if (!slices.length || slices.length !== positions.length) {
    return slices[0] || null;
  }
  const blobs = await Promise.all(slices.map(dataUrlToBlob));
  const bmp0 = await createImageBitmap(blobs[0]);
  const sliceW = bmp0.width;
  bmp0.close();
  let canvasH = Math.ceil(fullHeight * dpr);
  const MAX_H = 16384;
  if (canvasH > MAX_H) canvasH = MAX_H;
  const canvas = new OffscreenCanvas(sliceW, canvasH);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, sliceW, canvasH);
  for (let i = 0; i < blobs.length; i++) {
    const bmp = await createImageBitmap(blobs[i]);
    const destY = Math.round(positions[i] * dpr);
    ctx.drawImage(bmp, 0, destY);
    bmp.close();
  }
  const outBlob = await canvas.convertToBlob({ type: 'image/png' });
  return blobToDataUrlFromBlob(outBlob);
}

async function captureFullPageScreenshot(tabId, windowId) {
  await chrome.tabs.update(tabId, { active: true });
  await chrome.windows.update(windowId, { focused: true });
  for (let i = 0; i < 50; i++) {
    const t = await chrome.tabs.get(tabId);
    if (t.active && t.windowId === windowId) break;
    await sleep(80);
  }
  await sleep(450);
  let meta;
  try {
    meta = await chrome.tabs.sendMessage(tabId, { type: 'GET_FULL_PAGE_CAPTURE_METRICS' });
  } catch {
    return null;
  }
  if (!meta?.ok || meta.fullHeight == null) return null;
  const fullHeight = Math.max(1, meta.fullHeight);
  const viewHeight = Math.max(1, meta.viewHeight || 600);
  const dpr = meta.dpr || 1;
  const minSlices = Math.ceil(fullHeight / viewHeight);
  if (minSlices > MAX_FULL_PAGE_SLICES) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'SCROLL_FULL_CAPTURE_Y', y: 0 });
    } catch {}
    await sleep(400);
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
      return parseCaptureDataUrl(dataUrl);
    } catch {
      return null;
    }
  }
  const positions = computeScrollPositions(fullHeight, viewHeight);
  const pairs = [];
  for (const pos of positions) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'SCROLL_FULL_CAPTURE_Y', y: pos });
    } catch {}
    await sleep(380);
    let dataUrl = null;
    try {
      dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
    } catch {}
    if (dataUrl) pairs.push({ pos, dataUrl });
  }
  if (pairs.length === 0) return null;
  const slices = pairs.map((p) => p.dataUrl);
  const posUsed = pairs.map((p) => p.pos);
  if (slices.length === 1) return parseCaptureDataUrl(slices[0]);
  try {
    if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') {
      return parseCaptureDataUrl(slices[0]);
    }
    const stitchedUrl = await stitchScreenshotSlices(slices, posUsed, fullHeight, dpr);
    return parseCaptureDataUrl(stitchedUrl);
  } catch {
    return parseCaptureDataUrl(slices[0]);
  }
}

async function captureScreenshotReliable(tabId, windowId) {
  try {
    const full = await captureFullPageScreenshot(tabId, windowId);
    if (full?.base64) return full;
  } catch {}
  try {
    return await captureScreenshotForTab(tabId, windowId);
  } catch (_) {
    /* side panel + service worker: try panel fallback */
  }
  return requestExtensionPageCapture(tabId);
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

function fingerprintFromPartial(partial) {
  const w = partial.width != null ? parseInt(partial.width, 10) : null;
  const h = partial.height != null ? parseInt(partial.height, 10) : null;
  let pr = partial.promotional_price != null ? parseFloat(String(partial.promotional_price)) : null;
  if (Number.isNaN(pr)) pr = null;
  return `${String(partial.product_id ?? '')}|${w}|${h}|${pr}`;
}

function fingerprintFromRow(r) {
  return `${String(r.product_id ?? '')}|${r.width}|${r.height}|${r.promotional_price}`;
}

async function persistTestResult(tabId, partial) {
  const testDate = todayLocal();
  const createdAtIso = new Date().toISOString();
  const { testResults = [] } = await chrome.storage.local.get('testResults');
  const now = Date.now();
  const pfp = fingerprintFromPartial(partial);
  const latest = testResults[0];
  const dupRecent =
    latest &&
    fingerprintFromRow(latest) === pfp &&
    !Number.isNaN(Number(latest.id)) &&
    now - Number(latest.id) < 20000;

  let id;
  let row;
  let next;
  if (dupRecent) {
    id = latest.id;
    row = buildServerShapedRow(
      partial,
      id,
      testDate,
      latest.screenshot_data ?? null,
      latest.screenshot_url ?? null,
      latest.created_at || createdAtIso
    );
    next = [row, ...testResults.slice(1)];
  } else {
    id = Date.now();
    row = buildServerShapedRow(partial, id, testDate, null, null, createdAtIso);
    next = [row, ...testResults];
  }
  await setTestResultsStripScreenshotsOnQuota(next);

  let tab = null;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch (_) {
    return row;
  }

  if (tab?.windowId == null) return row;

  try {
    const cap = await captureScreenshotReliable(tab.id, tab.windowId);
    if (!cap?.base64) {
      const { testResults: trOnly = [] } = await chrome.storage.local.get('testResults');
      return trOnly.find((r) => r.id == id) || row;
    }
    const { testResults: tr = [] } = await chrome.storage.local.get('testResults');
    const idx = tr.findIndex((r) => r.id == id);
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
  return tr2.find((r) => r.id == id) || row;
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
        await chrome.storage.local.set({ shouldStop: false, sequenceRunning: true, automationPaused: false });
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
          for (;;) {
            const { shouldStop, automationPaused } = await chrome.storage.local.get(['shouldStop', 'automationPaused']);
            if (shouldStop) break;
            if (!automationPaused) break;
            await sleep(250);
          }
          const { shouldStop: stopNow } = await chrome.storage.local.get('shouldStop');
          if (stopNow) break;

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

        await chrome.storage.local.set({ sequenceRunning: false, shouldStop: false, automationPaused: false });
        sendResponse({ ok: true });
      } catch (e) {
        await chrome.storage.local.set({ sequenceRunning: false, automationPaused: false });
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
