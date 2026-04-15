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
  if (!header.includes('base64') || base64.length < 24) return null;
  return { dataUrl, base64 };
}

/**
 * CDP screenshot of the actual page surface — works when captureTab / captureVisibleTab
 * misbehave with the side panel or split view. Brief “Chrome is being controlled” bar may appear.
 */
async function captureViaDebugger(tabId) {
  const target = { tabId };
  let attached = false;
  try {
    try {
      await chrome.debugger.attach(target, '1.3');
      attached = true;
    } catch (e) {
      const msg = String(e?.message || e || '');
      if (/Another debugger|already attached|Debugger is already attached/i.test(msg)) return null;
      throw e;
    }
    await chrome.debugger.sendCommand(target, 'Page.enable', {});
    let result;
    try {
      result = await chrome.debugger.sendCommand(target, 'Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
        fromSurface: true
      });
    } catch {
      try {
        result = await chrome.debugger.sendCommand(target, 'Page.captureScreenshot', {
          format: 'png',
          captureBeyondViewport: true
        });
      } catch {
        result = await chrome.debugger.sendCommand(target, 'Page.captureScreenshot', { format: 'png' });
      }
    }
    const raw = result?.data;
    if (!raw || typeof raw !== 'string') return null;
    const dataUrl = `data:image/png;base64,${raw}`;
    return parseCaptureDataUrl(dataUrl);
  } catch {
    return null;
  } finally {
    if (attached) {
      try {
        await chrome.debugger.detach(target);
      } catch (_) {}
    }
  }
}

/**
 * One-shot full document screenshot via layout metrics + clip (avoids repeated “header only” captures).
 */
async function captureViaDebuggerFullDocument(tabId) {
  const target = { tabId };
  let attached = false;
  try {
    try {
      await chrome.debugger.attach(target, '1.3');
      attached = true;
    } catch (e) {
      const msg = String(e?.message || e || '');
      if (/Another debugger|already attached|Debugger is already attached/i.test(msg)) return null;
      throw e;
    }
    await chrome.debugger.sendCommand(target, 'Page.enable', {});
    const metrics = await chrome.debugger.sendCommand(target, 'Page.getLayoutMetrics', {});
    const cs = metrics?.contentSize;
    if (!cs || typeof cs.width !== 'number' || typeof cs.height !== 'number') {
      return null;
    }
    let W = Math.min(Math.max(1, Math.ceil(cs.width)), 16384);
    let H = Math.min(Math.max(1, Math.ceil(cs.height)), 24576);
    const lv = metrics.layoutViewport;
    if (lv && H < (lv.clientHeight || 0) * 1.25) {
      H = Math.max(H, Math.ceil((lv.clientHeight || 800) * 3));
    }
    const maxPx = 16384;
    const scaleCandidates = [];
    for (const s of [2.5, 2.25, 2, 1.75, 1.5, 1.25, 1]) {
      if (W * s <= maxPx && H * s <= maxPx) scaleCandidates.push(s);
    }
    if (!scaleCandidates.length) scaleCandidates.push(1);
    let raw = null;
    for (const scale of scaleCandidates) {
      const clip = { x: 0, y: 0, width: W, height: H, scale };
      try {
        const result = await chrome.debugger.sendCommand(target, 'Page.captureScreenshot', {
          format: 'png',
          clip,
          captureBeyondViewport: true,
          fromSurface: true
        });
        raw = result?.data;
      } catch {
        try {
          const result = await chrome.debugger.sendCommand(target, 'Page.captureScreenshot', {
            format: 'png',
            clip,
            captureBeyondViewport: true
          });
          raw = result?.data;
        } catch {
          raw = null;
        }
      }
      if (raw && typeof raw === 'string') break;
    }
    if (!raw || typeof raw !== 'string') return null;
    return parseCaptureDataUrl(`data:image/png;base64,${raw}`);
  } catch {
    return null;
  } finally {
    if (attached) {
      try {
        await chrome.debugger.detach(target);
      } catch (_) {}
    }
  }
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

const MAX_FULL_PAGE_SLICES = 60;

async function dataUrlToBlob(dataUrl) {
  const r = await fetch(dataUrl);
  return r.blob();
}

async function blobToDataUrlFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => {
      const url = r.result;
      if (typeof url === 'string') resolve(url);
      else reject(new Error('readAsDataURL failed'));
    };
    r.onerror = () => reject(r.error || new Error('FileReader error'));
    r.readAsDataURL(blob);
  });
}

/**
 * Full-page PNGs are far too large for chrome.storage.local (~5–10 MB total).
 * Downscale to high-quality JPEG so runs stay under quota but text stays readable.
 */
async function shrinkScreenshotForStorage(cap, options = {}) {
  const maxSide = options.maxSide ?? 8192;
  const quality = options.quality ?? 0.98;
  const force = !!options.force;
  if (!cap?.dataUrl || !cap?.base64) return cap;
  /* Skip recompress when already modest size (keeps prior sharp saves). */
  if (!force && cap.base64.length < 920000) return cap;
  if (typeof createImageBitmap === 'undefined' || typeof OffscreenCanvas === 'undefined') return cap;
  try {
    const resp = await fetch(cap.dataUrl);
    const blob = await resp.blob();
    const bmp = await createImageBitmap(blob);
    const maxDim = Math.max(bmp.width, bmp.height, 1);
    const scale = Math.min(1, maxSide / maxDim);
    const nw = Math.max(1, Math.round(bmp.width * scale));
    const nh = Math.max(1, Math.round(bmp.height * scale));
    const canvas = new OffscreenCanvas(nw, nh);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    try {
      ctx.imageSmoothingQuality = 'high';
    } catch (_) {}
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, nw, nh);
    ctx.drawImage(bmp, 0, 0, nw, nh);
    bmp.close();
    let outBlob = null;
    try {
      outBlob = await canvas.convertToBlob({ type: 'image/webp', quality: Math.min(0.99, quality) });
    } catch (_) {
      outBlob = null;
    }
    if (!outBlob || outBlob.size < 80) {
      outBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
    }
    const dataUrl = await blobToDataUrlFromBlob(outBlob);
    const parsed = parseCaptureDataUrl(dataUrl);
    return parsed?.base64 ? parsed : cap;
  } catch (_) {
    return cap;
  }
}

/**
 * Stack viewport captures top-to-bottom. Matches real scroll steps better than
 * placing by scrollY*dpr (capture scale can differ from window.devicePixelRatio).
 */
async function stitchScreenshotSlicesVertical(slices) {
  if (!slices.length) return null;
  const blobs = await Promise.all(slices.map(dataUrlToBlob));
  const bmps = [];
  let maxW = 0;
  let totalH = 0;
  for (const b of blobs) {
    const bmp = await createImageBitmap(b);
    maxW = Math.max(maxW, bmp.width);
    totalH += bmp.height;
    bmps.push(bmp);
  }
  const MAX_H = 16384;
  const canvasH = Math.min(totalH, MAX_H);
  const canvas = new OffscreenCanvas(maxW, canvasH);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  try {
    ctx.imageSmoothingQuality = 'high';
  } catch (_) {}
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, maxW, canvasH);
  let y = 0;
  for (const bmp of bmps) {
    if (y >= canvasH) break;
    const room = canvasH - y;
    if (bmp.height <= room) {
      ctx.drawImage(bmp, 0, y);
      y += bmp.height;
    } else {
      ctx.drawImage(bmp, 0, 0, bmp.width, room, 0, y, bmp.width, room);
      y = canvasH;
    }
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
  const slices = [];
  for (const pos of positions) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'SCROLL_FULL_CAPTURE_Y', y: pos });
    } catch {}
    await sleep(520);
    let dataUrl = null;
    try {
      dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
    } catch {}
    if (dataUrl) slices.push(dataUrl);
  }
  if (slices.length === 0) return null;
  if (slices.length === 1) return parseCaptureDataUrl(slices[0]);
  try {
    if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') {
      return parseCaptureDataUrl(slices[0]);
    }
    const stitchedUrl = await stitchScreenshotSlicesVertical(slices);
    const parsed = parseCaptureDataUrl(stitchedUrl);
    if (parsed) return parsed;
  } catch {
    /* fall through */
  }
  return parseCaptureDataUrl(slices[0]);
}

/**
 * Prefer captureTab first: it captures the Lowe's tab’s pixels even when the side panel is open.
 * Full-page stitching uses captureVisibleTab and often captured the wrong surface or failed quietly.
 */
async function captureViewportWithCaptureTab(tabId, windowId) {
  if (typeof chrome.tabs.captureTab !== 'function') return null;
  await chrome.tabs.update(tabId, { active: true });
  await chrome.windows.update(windowId, { focused: true });
  for (let i = 0; i < 40; i++) {
    const t = await chrome.tabs.get(tabId);
    if (t.active && t.windowId === windowId) break;
    await sleep(80);
  }
  await sleep(400);
  let lastErr = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const dataUrl = await chrome.tabs.captureTab(tabId, { format: 'png' });
      const parsed = parseCaptureDataUrl(dataUrl);
      if (parsed?.base64) return parsed;
    } catch (e) {
      lastErr = e;
      await sleep(400 * (attempt + 1));
    }
  }
  if (lastErr) throw lastErr;
  return null;
}

async function captureScreenshotReliable(tabId, windowId) {
  try {
    const viewport = await captureViewportWithCaptureTab(tabId, windowId);
    if (viewport?.base64) return viewport;
  } catch (_) {
    /* fall through */
  }
  try {
    const full = await captureFullPageScreenshot(tabId, windowId);
    if (full?.base64) return full;
  } catch {}
  try {
    return await captureScreenshotForTab(tabId, windowId);
  } catch (_) {
    /* fall through */
  }
  try {
    const dbg = await captureViaDebugger(tabId);
    if (dbg?.base64) return dbg;
  } catch (_) {}
  return requestExtensionPageCapture(tabId);
}

/** Long / scrollable page first (debugger CDP), then stitched visible-tab slices, then viewport fallbacks. */
async function captureFullWebpageForTab(tabId, windowId) {
  try {
    const big = await captureViaDebuggerFullDocument(tabId);
    if (big?.base64) return big;
  } catch (_) {}
  try {
    const dbg = await captureViaDebugger(tabId);
    if (dbg?.base64) return dbg;
  } catch (_) {}
  try {
    const full = await captureFullPageScreenshot(tabId, windowId);
    if (full?.base64) return full;
  } catch (_) {}
  return captureScreenshotReliable(tabId, windowId);
}

function sameLowesProductPage(tabUrl, productUrl) {
  try {
    const a = new URL(tabUrl);
    const b = new URL(productUrl);
    const ga = a.searchParams.get('omniItemId');
    const gb = b.searchParams.get('omniItemId');
    if (ga && gb && ga === gb) return true;
    return a.origin === b.origin && a.pathname === b.pathname && a.search === b.search;
  } catch {
    return false;
  }
}

async function pickOrNavigateLowesTab(productUrl) {
  const all = await chrome.tabs.query({});
  const lowes = all.filter((t) => t.url && /lowes\.com/i.test(t.url));
  let tab = lowes.find((t) => t.active);
  if (!tab && lowes.length) tab = lowes[0];
  if (!tab) {
    const t = await chrome.tabs.create({ url: productUrl, active: true });
    await waitTabComplete(t.id);
    return chrome.tabs.get(t.id);
  }
  await chrome.windows.update(tab.windowId, { focused: true });
  if (tab.url && sameLowesProductPage(tab.url, productUrl)) {
    await chrome.tabs.update(tab.id, { active: true });
    await sleep(800);
    return chrome.tabs.get(tab.id);
  }
  await chrome.tabs.update(tab.id, { url: productUrl, active: true });
  await waitTabComplete(tab.id);
  return chrome.tabs.get(tab.id);
}

async function applyScreenshotToResultRow(resultId, cap) {
  if (!cap?.base64) throw new Error('No image captured');
  const slim = await shrinkScreenshotForStorage(cap);
  const { testResults = [] } = await chrome.storage.local.get('testResults');
  const idx = testResults.findIndex((r) => String(r.id) === String(resultId));
  if (idx < 0) throw new Error('Result not found');
  const updated = [...testResults];
  updated[idx] = {
    ...updated[idx],
    screenshot_data: slim.base64,
    screenshot_url: slim.dataUrl
  };
  await writeTestResultsWithQuotaMitigation(updated, idx);
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
    blinds_per_headrail: partial.blinds_per_headrail ?? null,
    lift: partial.lift ?? null,
    valance_style: partial.valance_style ?? null,
    cassette_valance: partial.cassette_valance ?? null,
    side_channels: partial.side_channels ?? null,
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

/**
 * Writes testResults; on quota, drops other screenshots (oldest first) then shrinks the protected row.
 * @param {object[]} rows
 * @param {number|null} protectIdx index of row we want to keep a screenshot for
 */
async function writeTestResultsWithQuotaMitigation(rows, protectIdx = null) {
  let copy = rows.map((r) => ({ ...r }));
  let shrinkPass = 0;
  const shrinkSteps = [
    { maxSide: 6144, quality: 0.97 },
    { maxSide: 4800, quality: 0.95 },
    { maxSide: 3600, quality: 0.93 },
    { maxSide: 2800, quality: 0.9 },
    { maxSide: 2048, quality: 0.86 },
    { maxSide: 1600, quality: 0.8 },
    { maxSide: 1280, quality: 0.75 }
  ];
  for (let round = 0; round < 220; round++) {
    try {
      await storageLocalSet({ testResults: copy });
      return;
    } catch (e) {
      if (!String(e.message || '').toLowerCase().includes('quota')) throw e;
    }
    let clearedOther = false;
    for (let i = copy.length - 1; i >= 0; i--) {
      if (protectIdx != null && i === protectIdx) continue;
      if (copy[i].screenshot_data || copy[i].screenshot_url) {
        copy[i] = { ...copy[i], screenshot_data: null, screenshot_url: null };
        clearedOther = true;
        break;
      }
    }
    if (clearedOther) continue;
    if (protectIdx != null && copy[protectIdx]) {
      const row = copy[protectIdx];
      const du =
        row.screenshot_url && String(row.screenshot_url).startsWith('data:')
          ? row.screenshot_url
          : row.screenshot_data
            ? `data:image/png;base64,${row.screenshot_data}`
            : '';
      let parsed = parseCaptureDataUrl(du);
      if (!parsed && row.screenshot_data) {
        parsed =
          parseCaptureDataUrl(`data:image/webp;base64,${row.screenshot_data}`) ||
          parseCaptureDataUrl(`data:image/jpeg;base64,${row.screenshot_data}`);
      }
      if (parsed?.dataUrl && shrinkPass < 14) {
        const step = shrinkSteps[Math.min(shrinkPass, shrinkSteps.length - 1)];
        const more = await shrinkScreenshotForStorage(parsed, {
          ...step,
          force: true
        });
        copy[protectIdx] = {
          ...copy[protectIdx],
          screenshot_data: more.base64,
          screenshot_url: more.dataUrl
        };
        shrinkPass++;
        continue;
      }
    }
    if (copy.length > 1) {
      copy = copy.slice(0, -1);
      continue;
    }
    throw new Error(
      'Storage full — export a backup from the panel, then clear results or delete old entries.'
    );
  }
}

async function setTestResultsStripScreenshotsOnQuota(nextRows) {
  let rows = nextRows.map((r) => ({ ...r }));
  for (let round = 0; round < 120; round++) {
    try {
      await storageLocalSet({ testResults: rows });
      return;
    } catch (e) {
      if (!String(e.message || '').toLowerCase().includes('quota')) throw e;
    }
    let cleared = false;
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].screenshot_data || rows[i].screenshot_url) {
        rows[i] = { ...rows[i], screenshot_data: null, screenshot_url: null };
        cleared = true;
        break;
      }
    }
    if (cleared) continue;
    if (rows.length > 1) {
      rows = rows.slice(0, -1);
      continue;
    }
    rows = rows.map((r) => ({ ...r, screenshot_data: null, screenshot_url: null }));
    await storageLocalSet({ testResults: rows });
    return;
  }
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
    await sleep(900);
    let cap = await captureScreenshotReliable(tab.id, tab.windowId);
    if (!cap?.base64) {
      const { testResults: trOnly = [] } = await chrome.storage.local.get('testResults');
      return trOnly.find((r) => String(r.id) === String(id)) || row;
    }
    cap = await shrinkScreenshotForStorage(cap);
    const { testResults: tr = [] } = await chrome.storage.local.get('testResults');
    const idx = tr.findIndex((r) => String(r.id) === String(id));
    if (idx >= 0) {
      const updated = [...tr];
      updated[idx] = {
        ...updated[idx],
        screenshot_data: cap.base64,
        screenshot_url: cap.dataUrl
      };
      await writeTestResultsWithQuotaMitigation(updated, idx);
    }
  } catch (_) {
    /* row without screenshot */
  }

  const { testResults: tr2 = [] } = await chrome.storage.local.get('testResults');
  return tr2.find((r) => String(r.id) === String(id)) || row;
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

async function sendApplyResultToTab(tabId, config) {
  let lastErr = null;
  for (let attempt = 0; attempt < 28; attempt++) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        type: 'APPLY_RESULT_FOR_SCREENSHOT',
        config
      });
      if (response && typeof response === 'object' && response.ok) {
        return response;
      }
      lastErr = new Error(response?.error || 'Could not apply saved configuration');
    } catch (e) {
      lastErr = e;
    }
    await sleep(550);
  }
  return { ok: false, error: lastErr?.message || 'No response from Lowe’s page (reload tab and try again)' };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'CAPTURE_WEBPAGE_FOR_RESULT') {
    (async () => {
      try {
        const resultId = msg.resultId;
        if (resultId == null) {
          sendResponse({ ok: false, error: 'Missing result id' });
          return;
        }
        const { testResults = [] } = await chrome.storage.local.get('testResults');
        const row = testResults.find((r) => String(r.id) === String(resultId));
        if (!row) {
          sendResponse({ ok: false, error: 'Result not found' });
          return;
        }
        const productUrl = row.product_url;
        if (!productUrl || typeof productUrl !== 'string' || !/lowes\.com/i.test(productUrl)) {
          sendResponse({ ok: false, error: 'This result has no Lowe’s product URL to open' });
          return;
        }
        const tab = await pickOrNavigateLowesTab(productUrl);
        await sleep(5000);
        const applied = await sendApplyResultToTab(tab.id, {
          width: row.width,
          height: row.height,
          color: row.color
        });
        if (!applied?.ok) {
          sendResponse({
            ok: false,
            error:
              applied?.error ||
              'Could not apply this result’s width, height, and color on the page — reload the Lowe’s tab and try again'
          });
          return;
        }
        await sleep(600);
        try {
          await chrome.tabs.sendMessage(tab.id, { type: 'PREPARE_SCREENSHOT' });
        } catch (_) {}
        await sleep(700);
        const t2 = await chrome.tabs.get(tab.id);
        const cap = await captureFullWebpageForTab(t2.id, t2.windowId);
        if (!cap?.base64) {
          sendResponse({
            ok: false,
            error: 'Screenshot failed — close DevTools on that tab if open, reload the Lowe’s page, and try again'
          });
          return;
        }
        await applyScreenshotToResultRow(resultId, cap);
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: e.message || String(e) });
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
        await chrome.storage.local.set({ sequenceRunning: false, shouldStop: false, automationPaused: false });
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
