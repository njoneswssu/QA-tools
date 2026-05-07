/**
 * Shared merchant latency run (used by CLI and UI server).
 */
import { appendFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { pickOrganicAndClickInPage } from './page-organic-pick.js';

const OFFER_TIMEOUT_MS = Number(process.env.OFFER_TIMEOUT_MS || '90000');

/** EMA must look stable this many polls in a row (default 3 ? 400ms ? 1.2s). */
const EMA_POLL_MS = Number(process.env.EMA_POLL_MS || '400');
const EMA_STABLE_POLLS = Math.max(2, Number(process.env.EMA_STABLE_POLLS || '3'));
/** When parent page can read Citi copy (same-origin / open shadow), require iframe + text. */
const EMA_MIN_IFRAME_W = Number(process.env.EMA_MIN_IFRAME_W || '120');
const EMA_MIN_IFRAME_H = Number(process.env.EMA_MIN_IFRAME_H || '80');
const EMA_MIN_IFRAME_AREA = Number(process.env.EMA_MIN_IFRAME_AREA || '9600');
const EMA_MIN_VIEWPORT_VISIBLE_FRAC = Number(process.env.EMA_MIN_VIEWPORT_VISIBLE_FRAC || '0.35');
/**
 * Citi Shop EMA is usually a tall chrome-extension iframe; inner DOM is cross-origin, so the
 * parent never sees "Activate Offer" in `document`. Detect via modal-like geometry only.
 */
const EMA_MODAL_MIN_W = Number(process.env.EMA_MODAL_MIN_W || '180');
const EMA_MODAL_MIN_H = Number(process.env.EMA_MODAL_MIN_H || '200');
const EMA_MODAL_MIN_VIS_AREA = Number(process.env.EMA_MODAL_MIN_VIS_AREA || '24000');
const EMA_MODAL_MIN_FRAC = Number(process.env.EMA_MODAL_MIN_FRAC || '0.2');

/** After `offer_view`, keep the tab open this long (ms) so Citi EMA can appear in the recording. `0` = old behavior (stop on first offer_view). */
const EMA_AFTER_OFFER_MS = Math.max(0, Number(process.env.EMA_AFTER_OFFER_MS ?? '60000'));
/** Listener must stay alive at least this long when we defer `offer_view` to hunt for EMA afterward. */
const OFFER_LISTENER_TIMEOUT_MS = Math.max(OFFER_TIMEOUT_MS, EMA_AFTER_OFFER_MS + 30000);

/** Shop tab only: max wall time from `newPage` until `close` for the `.webm` (SERP uses a separate tab whose recording is deleted). */
const ORGANIC_VIDEO_MAX_MS = Math.max(2000, Number(process.env.ORGANIC_VIDEO_MAX_MS ?? '6000'));
/** After `offer_view` / `ema_visible`, keep recording this long, capped by remaining `ORGANIC_VIDEO_MAX_MS` budget. */
const POST_SIGNAL_SETTLE_MS = Math.min(4000, Math.max(0, Number(process.env.POST_SIGNAL_SETTLE_MS ?? '800')));

const EMA_EVAL_ARGS = {
  MIN_W: EMA_MIN_IFRAME_W,
  MIN_H: EMA_MIN_IFRAME_H,
  MIN_AREA: EMA_MIN_IFRAME_AREA,
  MIN_FRAC: EMA_MIN_VIEWPORT_VISIBLE_FRAC,
  MODAL_MIN_W: EMA_MODAL_MIN_W,
  MODAL_MIN_H: EMA_MODAL_MIN_H,
  MODAL_MIN_VIS: EMA_MODAL_MIN_VIS_AREA,
  MODAL_MIN_FRAC: EMA_MODAL_MIN_FRAC
};

/**
 * Runs in the merchant page context (Playwright serializes this).
 * @param {Record<string, number>} args
 */
function citiEmaStrongInPage(args) {
  const MIN_W = args.MIN_W;
  const MIN_H = args.MIN_H;
  const MIN_AREA = args.MIN_AREA;
  const MIN_FRAC = args.MIN_FRAC;
  const MODAL_MIN_W = args.MODAL_MIN_W;
  const MODAL_MIN_H = args.MODAL_MIN_H;
  const MODAL_MIN_VIS = args.MODAL_MIN_VIS;
  const MODAL_MIN_FRAC = args.MODAL_MIN_FRAC;

  /** Chrome MV3 extension host is 32 chars [a-z0-9] (not hex-only); pierce open shadow roots. */
  const EXT_IFRAME_SRC = /^chrome-extension:\/\/[a-z0-9]{32}\//i;

  /** @param {Document | ShadowRoot} r */
  function collectIframesDeep(r) {
    const seen = new Set();
    /** @type {HTMLIFrameElement[]} */
    const out = [];
    function visit(root) {
      if (!root) return;
      for (const f of root.querySelectorAll('iframe')) {
        const el = /** @type {HTMLIFrameElement} */ (f);
        if (seen.has(el)) continue;
        seen.add(el);
        out.push(el);
      }
      for (const el of root.querySelectorAll('*')) {
        const sh = /** @type {Element & { shadowRoot?: ShadowRoot }} */ (el).shadowRoot;
        if (sh) visit(sh);
      }
    }
    visit(r);
    return out;
  }

  function gatherFromRoot(root) {
    let s = '';
    const walk = (node) => {
      if (!node) return;
      for (const child of node.childNodes) {
        if (child.nodeType === 3) s += child.textContent || '';
        else if (child.nodeType === 1) {
          const el = /** @type {Element} */ (child);
          if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
          if (el.shadowRoot) walk(el.shadowRoot);
          walk(el);
        }
      }
    };
    walk(root);
    return s;
  }

  let t = document.body ? gatherFromRoot(document.body) : '';
  for (const iframe of collectIframesDeep(document)) {
    try {
      const doc = iframe.contentDocument;
      if (doc?.body) t += '\n' + gatherFromRoot(doc.body);
    } catch {
      /* cross-origin */
    }
  }

  const activate = /Activate\s+Offer/i.test(t);
  const citiShop = /citi\s*shop/i.test(t);
  const earnBack = /Earn\s+up\s+to\s+[\d.]+\s*%?\s*back/i.test(t);
  const earningRates = /Earning\s+Rates/i.test(t);
  const termsApply = /Terms\s*apply/i.test(t);
  const textOk = activate && (citiShop || earnBack || earningRates || termsApply);

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let best = { vis: 0, w: 0, h: 0, total: 1 };
  for (const iframe of collectIframesDeep(document)) {
    const src = iframe.getAttribute('src') || iframe.src || '';
    if (!EXT_IFRAME_SRC.test(src)) continue;
    const r = iframe.getBoundingClientRect();
    const ix = Math.max(r.left, 0);
    const iy = Math.max(r.top, 0);
    const ix2 = Math.min(r.right, vw);
    const iy2 = Math.min(r.bottom, vh);
    const iw = Math.max(0, ix2 - ix);
    const ih = Math.max(0, iy2 - iy);
    const visArea = iw * ih;
    const totalArea = Math.max(1, r.width * r.height);
    if (visArea > best.vis) best = { vis: visArea, w: r.width, h: r.height, total: totalArea };
  }

  const strictFrame =
    best.w >= MIN_W && best.h >= MIN_H && best.vis >= MIN_AREA && best.vis >= best.total * MIN_FRAC;

  const textAndFrame = Boolean(textOk && strictFrame);

  const tallModalFrame =
    best.w >= MODAL_MIN_W &&
    best.h >= MODAL_MIN_H &&
    best.vis >= MODAL_MIN_VIS &&
    best.vis >= best.total * MODAL_MIN_FRAC;

  let activateBtnInPage = false;
  for (const el of document.querySelectorAll('button, [role="button"], a')) {
    const tx = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!/activate\s*offer/i.test(tx)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 48 || r.height < 10) continue;
    if (r.bottom < 8 || r.top > vh - 8) continue;
    if (r.right < 8 || r.left > vw - 8) continue;
    activateBtnInPage = true;
    break;
  }

  const pageHint = /citi\s*shop|earn\s+up\s+to|earning\s+rates/i.test(t);
  return Boolean(textAndFrame || tallModalFrame || (activateBtnInPage && pageHint));
}

/** @param {import('playwright').Page} page */
export async function detectCitiEmaStrong(page) {
  return page.evaluate(citiEmaStrongInPage, EMA_EVAL_ARGS);
}

export function googleSearchUrl(q) {
  return `https://www.google.com/search?q=${encodeURIComponent(q)}&hl=en&_wlcb=${Date.now()}`;
}

export function isOfferViewUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const hostOk =
      host === 'wild.link' || host === 'www.wild.link' || host.endsWith('.wild.link');
    if (!hostOk) return false;
    if (!/\/_sales\/offer-view/i.test(u.pathname)) return false;
    const pathQueryHash = (u.pathname + u.search + u.hash).toLowerCase();
    return /[?&#]action=offer_viewed\b/.test(pathQueryHash);
  } catch {
    return false;
  }
}

/**
 * Citi EMA flow fires `wild.link/_sales/offer-view` with `view=EMA` (see trace.network). The modal
 * may not appear as a `chrome-extension://` iframe our DOM heuristics can see, so treat this pixel as EMA.
 */
export function isWildlinkEmaPixelUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (!(host === 'wild.link' || host === 'www.wild.link' || host.endsWith('.wild.link'))) {
      return false;
    }
    if (!/\/_sales\/offer-view/i.test(u.pathname)) return false;
    const pathQueryHash = (u.pathname + u.search + u.hash).toLowerCase();
    if (!/[?&#]action=offer_viewed\b/.test(pathQueryHash)) return false;
    const view = u.searchParams.get('view');
    return Boolean(view && view.toLowerCase() === 'ema');
  } catch {
    return false;
  }
}

export async function fetchMerchants(appId) {
  const url = `https://www.wildlink.me/data/${appId}/merchant/1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Wildlink feed HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('Expected JSON array');
  return data
    .filter((row) => row && row.ID != null)
    .map((row) => ({ id: String(row.ID), name: row.Name || `Merchant ${row.ID}` }));
}

/**
 * @param {import('playwright').BrowserContext} context
 * @param {import('playwright').Page} page
 * @param {number} t0 listener attach time (for ms field and timeout window start)
 */
export function waitForOfferOrEma(context, page, t0) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timers = [];
    let domPoll = null;
    let emaStableCount = 0;
    /** Prevents overlapping `page.evaluate` ticks (stacked async intervals caused 10s+ main-thread violations). */
    let domPollBusy = false;
    /** When `EMA_AFTER_OFFER_MS > 0`, first offer_view is held until EMA wins or the defer window ends. */
    let deferredOfferTimer = null;
    /** @type {string | null} */
    let deferredOfferDetail = null;
    const debugNet = process.env.WL_LATENCY_DEBUG_NET === '1';

    const finish = (fn) => {
      if (settled) return;
      settled = true;
      if (deferredOfferTimer) {
        clearTimeout(deferredOfferTimer);
        deferredOfferTimer = null;
      }
      deferredOfferDetail = null;
      context.off('request', onReq);
      context.off('response', onRes);
      if (domPoll) clearInterval(domPoll);
      for (const t of timers) clearTimeout(t);
      fn();
    };

    const tryResolve = (kind, detail) => {
      finish(() => resolve({ kind, ms: Date.now() - t0, detail }));
    };

    /** First network `offer_view`: resolve immediately if not deferring; else keep polling DOM for EMA until defer fires. */
    const noteOfferView = (detail) => {
      if (EMA_AFTER_OFFER_MS <= 0) {
        tryResolve('offer_view', detail);
        return;
      }
      if (deferredOfferDetail != null) return;
      deferredOfferDetail = detail;
      deferredOfferTimer = setTimeout(() => {
        deferredOfferTimer = null;
        if (settled) return;
        const d = deferredOfferDetail;
        deferredOfferDetail = null;
        tryResolve('offer_view', d);
      }, EMA_AFTER_OFFER_MS);
    };

    const onReq = (req) => {
      const url = req.url();
      if (debugNet && /wild\.link/i.test(url)) console.log('[wl-req]', req.method(), url.slice(0, 200));
      if (isWildlinkEmaPixelUrl(url)) {
        tryResolve('ema_visible', `wildlink_view_ema:${url.slice(0, 500)}`);
        return;
      }
      if (isOfferViewUrl(url)) noteOfferView(url);
    };
    const onRes = (res) => {
      const u = res.url();
      if (debugNet && /wild\.link/i.test(u)) console.log('[wl-res]', res.status(), u.slice(0, 200));
      if (isWildlinkEmaPixelUrl(u)) {
        tryResolve('ema_visible', `wildlink_view_ema:${u.slice(0, 500)}`);
        return;
      }
      if (isOfferViewUrl(u)) noteOfferView(u);
    };

    context.on('request', onReq);
    context.on('response', onRes);

    domPoll = setInterval(() => {
      if (settled || domPollBusy) return;
      domPollBusy = true;
      void (async () => {
        try {
          const emaStrong = await detectCitiEmaStrong(page);

          if (settled) return;
          if (emaStrong) {
            emaStableCount += 1;
            if (emaStableCount >= EMA_STABLE_POLLS) {
              tryResolve('ema_visible', `ema_stable_${EMA_STABLE_POLLS}x`);
            }
          } else {
            emaStableCount = 0;
          }
        } catch {
          emaStableCount = 0;
        } finally {
          domPollBusy = false;
        }
      })();
    }, EMA_POLL_MS);

    timers.push(
      setTimeout(() => {
        finish(() =>
          reject(
            Object.assign(
              new Error(`No offer_view or EMA within ${OFFER_LISTENER_TIMEOUT_MS}ms`),
              {
                code: 'OFFER_TIMEOUT'
              }
            )
          )
        );
      }, OFFER_LISTENER_TIMEOUT_MS)
    );
  });
}

function roundSeconds(ms) {
  if (ms == null || Number.isNaN(ms)) return null;
  return Math.round((ms / 1000) * 1000) / 1000;
}

/**
 * Close a Playwright page and delete its `.webm` (SERP tab) unless `keep` is true.
 * @param {import('playwright').Page} page
 * @param {{ keep?: boolean }} [o]
 */
async function closePageAndDeleteWebm(page, o = {}) {
  const vid = page.video();
  await page.close().catch(() => {});
  if (o.keep || !vid) return;
  try {
    const p = await vid.path();
    if (p && existsSync(p)) unlinkSync(p);
  } catch {
    /* ignore */
  }
}

/**
 * Google SERP: resolve first organic result URL for `merchantName` (dry run; does not navigate).
 * @param {import('playwright').Page} page
 * @param {string} merchantName
 * @returns {Promise<string | null>}
 */
async function discoverOrganicUrlFromSerp(page, merchantName) {
  await page.goto(googleSearchUrl(merchantName), { waitUntil: 'domcontentloaded', timeout: 60000 });
  const serpDeadline = Date.now() + 45000;
  while (Date.now() < serpDeadline) {
    await page.evaluate(() => {
      function pulse(el) {
        try {
          if (typeof window.__wlPulseAt === 'function') {
            const r = el.getBoundingClientRect();
            if (r.width >= 2 && r.height >= 2) {
              window.__wlPulseAt(r.left + r.width / 2, r.top + r.height / 2);
            }
          }
        } catch (_) {
          /* ignore */
        }
      }
      const candidates = document.querySelectorAll('button, [role="button"], input[type="submit"]');
      for (const el of candidates) {
        const t = (el.textContent || el.value || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (!t || t.includes('reject all')) continue;
        if (t === 'accept all' || t.includes('accept all') || t === 'got it') {
          try {
            pulse(el);
            el.click();
          } catch (_) {}
        }
      }
    });
    const href = await page.evaluate(pickOrganicAndClickInPage, {
      merchantName,
      dryRun: true
    });
    if (href) return href;
    await page.waitForTimeout(250);
  }
  return null;
}

/**
 * Merchant tab only: `goto(organic)` + wait for offer_view or EMA. Trace covers this phase only.
 * Timing: **seconds from start of `page.goto(organic)`** until signal (not from listener attach).
 *
 * @param {import('playwright').BrowserContext} context
 * @param {import('playwright').Page} page
 * @param {string} merchantName
 * @param {string} organicHref
 * @param {{ traceZip?: boolean; tracePath: string; shopPhaseT0: number }} opts
 */
async function runMerchantOrganicLatency(context, page, merchantName, organicHref, opts) {
  const traceZip = opts.traceZip !== false;
  const tracePath = opts.tracePath;
  const shopT0 = opts.shopPhaseT0 ?? Date.now();

  let endReason = 'error';
  let msToSignal = null;
  let detail = null;
  let secondsToSignalFromNav = null;
  let secondsToOfferViewFromNav = null;
  let secondsToEmaFromNav = null;

  if (traceZip) await context.tracing.start({ screenshots: true, snapshots: true, sources: true });

  try {
    const listenerT0 = Date.now();
    const signalPromise = waitForOfferOrEma(context, page, listenerT0);
    const navStartMs = Date.now();
    await page.goto(organicHref, { waitUntil: 'domcontentloaded', timeout: 120000 });
    const sig = await signalPromise;

    endReason = sig.kind;
    msToSignal = sig.ms;
    detail = sig.detail;

    const msFromNav = sig.ms - (navStartMs - listenerT0);
    if (endReason === 'offer_view' || endReason === 'ema_visible') {
      secondsToSignalFromNav = roundSeconds(msFromNav);
      if (endReason === 'offer_view') secondsToOfferViewFromNav = secondsToSignalFromNav;
      if (endReason === 'ema_visible') secondsToEmaFromNav = secondsToSignalFromNav;

      const room = Math.max(0, ORGANIC_VIDEO_MAX_MS - (Date.now() - shopT0));
      const settleMs = Math.min(POST_SIGNAL_SETTLE_MS, room);
      if (settleMs > 0) await page.waitForTimeout(settleMs);
    }
  } catch (e) {
    const code = /** @type {any} */ (e)?.code;
    if (code === 'OFFER_TIMEOUT') endReason = 'timeout';
    else {
      endReason = 'error';
      detail = /** @type {any} */ (e)?.message || String(e);
    }
  } finally {
    if (traceZip) {
      await context.tracing.stop({ path: tracePath }).catch((err) => {
        console.warn(
          '[latency] tracing.stop failed:',
          tracePath,
          /** @type {any} */ (err)?.message || err
        );
      });
    }
  }

  return {
    merchantName,
    endReason,
    secondsToSignalFromNav,
    secondsToOfferViewFromNav,
    secondsToEmaFromNav,
    msToSignal,
    detail,
    tracePath: traceZip ? tracePath : null,
    videoPath: null,
    wallMs: Date.now() - shopT0,
    recordedAt: new Date().toISOString()
  };
}

/**
 * One merchant: SERP on a throwaway tab (recording deleted), then merchant + EMA on a fresh tab
 * with trace + `.webm` capped at `ORGANIC_VIDEO_MAX_MS` (default 6s) from shop `newPage`.
 *
 * @param {import('playwright').BrowserContext} context
 * @param {string} merchantName
 * @param {{ traceDir: string; traceZip?: boolean }} opts
 */
export async function runMerchantLatencyOnDedicatedPage(context, merchantName, opts) {
  const traceDir = opts.traceDir;
  const traceZip = opts.traceZip !== false;
  mkdirSync(traceDir, { recursive: true });

  const slug = String(merchantName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  const tracePath = join(traceDir, `${slug}-${Date.now()}.zip`);

  const runT0 = Date.now();

  const serpPage = await context.newPage();
  let organicHref = null;
  /** @type {string | null} */
  let serpErrorDetail = null;
  try {
    organicHref = await discoverOrganicUrlFromSerp(serpPage, merchantName);
  } catch (e) {
    serpErrorDetail = /** @type {any} */ (e)?.message || String(e);
  } finally {
    await closePageAndDeleteWebm(serpPage, {
      keep: process.env.WL_LATENCY_KEEP_SERP_VIDEO === '1'
    });
  }

  if (serpErrorDetail) {
    return {
      merchantName,
      endReason: 'error',
      secondsToSignalFromNav: null,
      secondsToOfferViewFromNav: null,
      secondsToEmaFromNav: null,
      msToSignal: null,
      detail: serpErrorDetail,
      tracePath: null,
      videoPath: null,
      wallMs: Date.now() - runT0,
      recordingWallSec: null,
      recordingWallMs: null,
      recordedAt: new Date().toISOString()
    };
  }

  if (!organicHref) {
    return {
      merchantName,
      endReason: 'serp_failed',
      secondsToSignalFromNav: null,
      secondsToOfferViewFromNav: null,
      secondsToEmaFromNav: null,
      msToSignal: null,
      detail: null,
      tracePath: null,
      videoPath: null,
      wallMs: Date.now() - runT0,
      recordingWallSec: null,
      recordingWallMs: null,
      recordedAt: new Date().toISOString()
    };
  }

  const shopPage = await context.newPage();
  const shopOpenT0 = Date.now();
  let row;
  /** @type {unknown} */
  let thrown;
  try {
    row = await runMerchantOrganicLatency(context, shopPage, merchantName, organicHref, {
      traceZip,
      tracePath,
      shopPhaseT0: shopOpenT0
    });
  } catch (e) {
    thrown = e;
  } finally {
    const video = shopPage.video();
    await shopPage.close().catch(() => {});
    const recordingWallMs = Date.now() - shopOpenT0;
    const recordingWallSec = Math.round((recordingWallMs / 1000) * 1000) / 1000;
    let videoPath = null;
    if (video) {
      try {
        videoPath = await video.path();
      } catch {
        /* no recording (e.g. CDP attach without recordVideo) */
      }
    }
    if (row) {
      row = {
        ...row,
        videoPath,
        recordingWallSec,
        recordingWallMs,
        wallMs: Date.now() - runT0
      };
    }
  }
  if (thrown) throw thrown;
  return row;
}

/**
 * Append one JSON line to the output dir results file.
 */
export function appendOutputRecord(outputDir, row) {
  mkdirSync(outputDir, { recursive: true });
  const dateStr = new Date().toISOString().slice(0, 10);
  const resultsPath = join(outputDir, `latency-results-${dateStr}.jsonl`);
  appendFileSync(resultsPath, JSON.stringify(row) + '\n');
  return resultsPath;
}
