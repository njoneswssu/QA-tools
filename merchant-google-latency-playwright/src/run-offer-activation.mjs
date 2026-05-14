/**
 * Browser-level activation test: Google -> first organic merchant URL -> click Citi "Activate"
 * -> capture and validate the generated wild.link/e URL.
 */
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join, resolve as pathResolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { pickOrganicAndClickInPage } from './page-organic-pick.js';
import { fetchMerchants, googleSearchUrl } from './latency-core.mjs';
import {
  resolveCitiExtensionPath,
  startLatencyBrowser,
  stopLatencyBrowser
} from './run-latency.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const APP_ID = Number(process.env.APP_ID || '209');
const ACTIVATE_BUTTON_TIMEOUT_MS = Number(process.env.ACTIVATE_BUTTON_TIMEOUT_MS || '30000');
const WILDLINK_E_TIMEOUT_MS = Number(process.env.WILDLINK_E_TIMEOUT_MS || '30000');
const ACTIVATE_RE = /\bactivate(?:\s+offer)?\b/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_TOKEN_RE = /^[0-9a-f]{16,64}$/i;

function parseCli() {
  const argv = process.argv.slice(2);
  const out = {
    merchants: [],
    urls: [],
    limit: null,
    citiExt: null,
    cdpUrl: process.env.CDP_URL?.trim() || null,
    skipWarmup: process.env.SKIP_EXTENSION_WARMUP === '1',
    traceDir: process.env.TRACE_DIR || join(ROOT, 'traces'),
    outputDir: process.env.OUTPUT_DIR || join(ROOT, 'output')
  };

  let citiCli = null;
  if (process.env.MERCHANTS) {
    out.merchants = process.env.MERCHANTS.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (process.env.MERCHANT_URLS) {
    out.urls = process.env.MERCHANT_URLS.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--merchant' && argv[i + 1]) {
      out.merchants.push(argv[++i]);
    } else if (argv[i] === '--merchants' && argv[i + 1]) {
      out.merchants = argv[++i]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (argv[i] === '--url' && argv[i + 1]) {
      out.urls.push(argv[++i]);
    } else if (argv[i] === '--urls' && argv[i + 1]) {
      out.urls = argv[++i]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (argv[i] === '--limit' && argv[i + 1]) {
      out.limit = Number(argv[++i]);
    } else if (argv[i] === '--citi-extension' && argv[i + 1]) {
      citiCli = argv[++i];
    } else if (argv[i] === '--cdp-url' && argv[i + 1]) {
      out.cdpUrl = argv[++i];
    } else if (argv[i] === '--skip-warmup') {
      out.skipWarmup = true;
    } else if (argv[i] === '--trace-dir' && argv[i + 1]) {
      out.traceDir = argv[++i];
    } else if (argv[i] === '--output-dir' && argv[i + 1]) {
      out.outputDir = argv[++i];
    }
  }

  out.citiExt = resolveCitiExtensionPath(citiCli);
  return out;
}

function normalizeCdpUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return `http://127.0.0.1:${s}`;
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  return `http://${s}`;
}

function slugFor(value) {
  return String(value || 'merchant')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

export function appendActivationRecord(outputDir, row) {
  mkdirSync(outputDir, { recursive: true });
  const dateStr = new Date().toISOString().slice(0, 10);
  const resultsPath = join(outputDir, `activation-results-${dateStr}.jsonl`);
  appendFileSync(resultsPath, JSON.stringify(row) + '\n');
  return resultsPath;
}

function isWildlinkEUrl(raw) {
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    const hostOk = host === 'wild.link' || host === 'www.wild.link';
    return hostOk && u.pathname === '/e';
  } catch {
    return false;
  }
}

function comparableHost(raw) {
  try {
    return new URL(raw).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

function validScToken(raw) {
  const s = String(raw || '').trim();
  if (UUID_RE.test(s) || HEX_TOKEN_RE.test(s)) return true;
  const nestedUuid = s.match(/(?:^|[,\s])uuid=([0-9a-f-]{36})(?:$|[,\s])/i);
  return Boolean(nestedUuid && UUID_RE.test(nestedUuid[1]));
}

function validTcToken(raw) {
  const s = String(raw || '').trim();
  return UUID_RE.test(s) || HEX_TOKEN_RE.test(s);
}

function validateWildlinkEUrl(raw, expectedDestinationUrl) {
  const errors = [];
  let destinationUrl = null;

  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') errors.push('wildlink_url_not_https');
    if (u.hostname.toLowerCase() !== 'wild.link') errors.push('wildlink_host_not_exact');
    if (u.pathname !== '/e') errors.push('wildlink_path_not_e');

    const c = u.searchParams.get('c');
    const d = u.searchParams.get('d');
    const sc = u.searchParams.get('sc');
    const tc = u.searchParams.get('tc');
    const dest = u.searchParams.get('url');

    if (!c || !/^\d+$/.test(c)) errors.push('missing_or_invalid_c');
    if (!d || !/^\d+$/.test(d)) errors.push('missing_or_invalid_d');
    if (!sc || !validScToken(sc)) errors.push('missing_or_invalid_sc');
    if (!tc || !validTcToken(tc)) errors.push('missing_or_invalid_tc');
    if (!dest) {
      errors.push('missing_destination_url');
    } else {
      destinationUrl = dest;
      try {
        const destUrl = new URL(dest);
        if (!/^https?:$/.test(destUrl.protocol)) errors.push('destination_url_not_http');
      } catch {
        errors.push('destination_url_not_parseable');
      }
    }

    if (destinationUrl && expectedDestinationUrl) {
      const gotHost = comparableHost(destinationUrl);
      const expectedHost = comparableHost(expectedDestinationUrl);
      if (gotHost && expectedHost && gotHost !== expectedHost) {
        errors.push(`destination_host_mismatch:${gotHost}!=${expectedHost}`);
      }
    }
  } catch {
    errors.push('wildlink_url_not_parseable');
  }

  return {
    valid: errors.length === 0,
    errors,
    destinationUrl
  };
}

async function dismissGoogleConsent(page) {
  await page.evaluate(() => {
    const candidates = document.querySelectorAll('button, [role="button"], input[type="submit"]');
    for (const el of candidates) {
      const t = (el.textContent || el.value || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (!t || t.includes('reject all') || t.includes('decline')) continue;
      if (t === 'accept all' || t.includes('accept all') || t === 'i agree' || t === 'got it') {
        try {
          el.click();
          return;
        } catch {
          /* ignore */
        }
      }
    }
  });
}

async function discoverOrganicUrlFromSerp(page, merchantName) {
  await page.goto(googleSearchUrl(merchantName), { waitUntil: 'domcontentloaded', timeout: 60000 });
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    await dismissGoogleConsent(page).catch(() => {});
    const href = await page.evaluate(pickOrganicAndClickInPage, {
      merchantName,
      dryRun: true
    });
    if (href) return href;
    await page.waitForTimeout(250);
  }
  return null;
}

async function tryClickLocator(locator, label, maxCandidates = 8) {
  try {
    const count = Math.min(await locator.count(), maxCandidates);
    for (let i = 0; i < count; i++) {
      const candidate = locator.nth(i);
      const visible = await candidate.isVisible({ timeout: 300 }).catch(() => false);
      if (!visible) continue;
      await candidate.scrollIntoViewIfNeeded({ timeout: 1000 }).catch(() => {});
      try {
        await candidate.click({ timeout: 2500 });
        return { clicked: true, detail: `${label}#${i}` };
      } catch {
        await candidate.click({ timeout: 2500, force: true });
        return { clicked: true, detail: `${label}#${i}:force` };
      }
    }
  } catch {
    /* try next strategy */
  }
  return { clicked: false, detail: null };
}

async function showViewportClickMarker(page, x, y, label, session = null) {
  const cx = Math.round(x);
  const cy = Math.round(y);
  await page
    .evaluate(
      ({ cx, cy, label }) => {
        const id = '__wl_activation_click_marker';
        document.getElementById(id)?.remove();
        const wrap = document.createElement('div');
        wrap.id = id;
        wrap.style.cssText = [
          'position:fixed',
          `left:${cx}px`,
          `top:${cy}px`,
          'width:72px',
          'height:72px',
          'margin:-36px 0 0 -36px',
          'z-index:2147483647',
          'pointer-events:none',
          'border:5px solid #ff0000',
          'border-radius:50%',
          'background:rgba(255,0,0,0.12)',
          'box-shadow:0 0 0 6px rgba(255,255,255,0.9), 0 0 18px 8px rgba(255,0,0,0.45)'
        ].join(';');
        const h = document.createElement('div');
        h.style.cssText = 'position:absolute;left:-22px;right:-22px;top:33px;height:6px;background:#ff0000;';
        const v = document.createElement('div');
        v.style.cssText = 'position:absolute;top:-22px;bottom:-22px;left:33px;width:6px;background:#ff0000;';
        const tag = document.createElement('div');
        tag.textContent = `CLICK ${label}`;
        tag.style.cssText = [
          'position:absolute',
          'left:40px',
          'top:-30px',
          'padding:3px 6px',
          'font:700 12px ui-monospace,monospace',
          'color:#fff',
          'background:#ff0000',
          'border-radius:4px',
          'white-space:nowrap'
        ].join(';');
        wrap.append(h, v, tag);
        (document.body || document.documentElement).appendChild(wrap);
        setTimeout(() => wrap.remove(), 1800);
      },
      { cx, cy, label: String(label || '').slice(0, 80) }
    )
    .catch(() => {});

  if (session) {
    await session
      .send('Overlay.highlightRect', {
        x: cx - 36,
        y: cy - 36,
        width: 72,
        height: 72,
        color: { r: 255, g: 0, b: 0, a: 0.95 },
        outlineColor: { r: 255, g: 255, b: 255, a: 0.95 }
      })
      .catch(() => {});
    setTimeout(() => {
      session.send('Overlay.hideHighlight').catch(() => {});
    }, 1800);
  }
}

async function clickViewportPoint(page, x, y, label) {
  const cx = Math.round(x);
  const cy = Math.round(y);
  let cdpTried = false;
  try {
    const session = await page.context().newCDPSession(page);
    cdpTried = true;
    await showViewportClickMarker(page, cx, cy, label, session);
    await page.waitForTimeout(350);
    await session.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: cx,
      y: cy,
      button: 'none',
      pointerType: 'mouse'
    });
    await session.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: cx,
      y: cy,
      button: 'left',
      buttons: 1,
      clickCount: 1,
      pointerType: 'mouse'
    });
    await page.waitForTimeout(120);
    await session.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: cx,
      y: cy,
      button: 'left',
      buttons: 0,
      clickCount: 1,
      pointerType: 'mouse'
    });
    await session.detach().catch(() => {});
    return { clicked: true, detail: `${label}:cdp:${cx},${cy}` };
  } catch {
    try {
      await showViewportClickMarker(page, cx, cy, label);
      await page.waitForTimeout(350);
      await page.mouse.move(cx, cy);
      await page.waitForTimeout(80);
      await page.mouse.click(cx, cy, { button: 'left', delay: 120 });
      return { clicked: true, detail: `${label}:${cdpTried ? 'mouse_after_cdp' : 'mouse'}:${cx},${cy}` };
    } catch {
      return { clicked: false, detail: null };
    }
  }
}

function cdpCommandInAttachedTarget(rootSession, sessionId, method, params = {}, timeoutMs = 2500) {
  const id = Math.floor(Math.random() * 1_000_000_000);
  const message = JSON.stringify({ id, method, params });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`CDP ${method} timed out`));
    }, timeoutMs);

    const onMessage = (event) => {
      if (event.sessionId !== sessionId) return;
      let parsed;
      try {
        parsed = JSON.parse(event.message);
      } catch {
        return;
      }
      if (parsed.id !== id) return;
      cleanup();
      if (parsed.error) reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
      else resolve(parsed.result);
    };

    const cleanup = () => {
      clearTimeout(timer);
      rootSession.off('Target.receivedMessageFromTarget', onMessage);
    };

    rootSession.on('Target.receivedMessageFromTarget', onMessage);
    rootSession
      .send('Target.sendMessageToTarget', { sessionId, message })
      .catch((err) => {
        cleanup();
        reject(err);
      });
  });
}

async function tryClickEmaButtonInExtensionTargets(page) {
  let root = null;
  try {
    root = await page.context().newCDPSession(page);
    const targets = await root.send('Target.getTargets');
    const extensionTargets = (targets.targetInfos || []).filter((t) => {
      const url = String(t.url || '');
      return url.startsWith('chrome-extension://') && /page|iframe|other|background_page|service_worker/i.test(t.type || '');
    });

    for (const target of extensionTargets) {
      let sessionId = null;
      try {
        const attached = await root.send('Target.attachToTarget', {
          targetId: target.targetId,
          flatten: false
        });
        sessionId = attached.sessionId;
        const result = await cdpCommandInAttachedTarget(
          root,
          sessionId,
          'Runtime.evaluate',
          {
            awaitPromise: true,
            returnByValue: true,
            userGesture: true,
            expression: `(() => {
              function findDeep(root) {
                const direct = root.querySelector?.('button[data-testid="ema-button"]');
                if (direct) return direct;
                for (const el of root.querySelectorAll?.('*') || []) {
                  const shadow = el.shadowRoot;
                  if (!shadow) continue;
                  const found = findDeep(shadow);
                  if (found) return found;
                }
                return null;
              }
              const btn = findDeep(document);
              if (!btn) return { clicked: false, reason: 'not_found', url: location.href };
              const text = (btn.textContent || '').replace(/\\s+/g, ' ').trim();
              const r = btn.getBoundingClientRect();
              const style = getComputedStyle(btn);
              const visible = r.width >= 40 && r.height >= 18 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') > 0.05;
              if (!visible) return { clicked: false, reason: 'not_visible', text, url: location.href, rect: { x: r.left, y: r.top, w: r.width, h: r.height } };
              if (!/activate\\s+offer/i.test(text)) return { clicked: false, reason: 'wrong_text', text, url: location.href };
              btn.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' });
              btn.focus?.();
              const x = r.left + r.width / 2;
              const y = r.top + r.height / 2;
              document.getElementById('__wl_extension_click_marker')?.remove();
              const marker = document.createElement('div');
              marker.id = '__wl_extension_click_marker';
              marker.style.cssText = [
                'position:fixed',
                'left:' + x + 'px',
                'top:' + y + 'px',
                'width:72px',
                'height:72px',
                'margin:-36px 0 0 -36px',
                'z-index:2147483647',
                'pointer-events:none',
                'border:5px solid #ff0000',
                'border-radius:50%',
                'background:rgba(255,0,0,0.12)',
                'box-shadow:0 0 0 6px rgba(255,255,255,0.9), 0 0 18px 8px rgba(255,0,0,0.45)'
              ].join(';');
              const h = document.createElement('div');
              h.style.cssText = 'position:absolute;left:-22px;right:-22px;top:33px;height:6px;background:#ff0000;';
              const v = document.createElement('div');
              v.style.cssText = 'position:absolute;top:-22px;bottom:-22px;left:33px;width:6px;background:#ff0000;';
              const tag = document.createElement('div');
              tag.textContent = 'EXTENSION CLICK';
              tag.style.cssText = 'position:absolute;left:40px;top:-30px;padding:3px 6px;font:700 12px ui-monospace,monospace;color:#fff;background:#ff0000;border-radius:4px;white-space:nowrap;';
              marker.append(h, v, tag);
              (document.body || document.documentElement).appendChild(marker);
              setTimeout(() => marker.remove(), 1800);
              const init = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0 };
              if (typeof PointerEvent === 'function') btn.dispatchEvent(new PointerEvent('pointerdown', init));
              btn.dispatchEvent(new MouseEvent('mousedown', init));
              if (typeof PointerEvent === 'function') btn.dispatchEvent(new PointerEvent('pointerup', init));
              btn.dispatchEvent(new MouseEvent('mouseup', init));
              btn.dispatchEvent(new MouseEvent('click', init));
              btn.click();
              return { clicked: true, text, url: location.href, rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } };
            })()`
          },
          3000
        );
        const value = result?.result?.value;
        if (value?.clicked) {
          return {
            clicked: true,
            detail: `extension_target_click:${target.type}:${value.rect?.x ?? '?'},${value.rect?.y ?? '?'},${value.rect?.w ?? '?'}x${value.rect?.h ?? '?'}`
          };
        }
      } catch {
        /* try next extension target */
      } finally {
        if (sessionId) {
          await root.send('Target.detachFromTarget', { sessionId }).catch(() => {});
        }
      }
    }
  } catch {
    /* fall back to page/frame clicks */
  } finally {
    await root?.detach().catch(() => {});
  }
  return { clicked: false, detail: null };
}

async function tryCoordinateClickVisibleActivate(page, frame, label) {
  let handle = null;
  try {
    handle = await frame.evaluateHandle(() => {
      function textOf(el) {
        if (el instanceof HTMLInputElement) return el.value || el.getAttribute('aria-label') || '';
        return [el.textContent || '', el.getAttribute('aria-label') || '', el.getAttribute('title') || '']
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
      }

      function isVisible(el) {
        const r = el.getBoundingClientRect();
        if (r.width < 40 || r.height < 18) return false;
        if (r.bottom < 0 || r.right < 0 || r.top > window.innerHeight || r.left > window.innerWidth) {
          return false;
        }
        const s = window.getComputedStyle(el);
        return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity || '1') > 0.05;
      }

      function collect(root, out) {
        for (const el of root.querySelectorAll('*')) {
          out.push(el);
          const shadow = el.shadowRoot;
          if (shadow) collect(shadow, out);
        }
      }

      const all = [];
      collect(document, all);
      let best = null;
      let bestScore = -Infinity;
      for (const el of all) {
        const t = textOf(el);
        if (!/\bactivate(?:\s+offer)?\b/i.test(t)) continue;
        if (!isVisible(el)) continue;
        const r = el.getBoundingClientRect();
        const tag = el.tagName.toLowerCase();
        const role = el.getAttribute('role') || '';
        const exact = /^activate\s+offer$/i.test(t);
        const clickable =
          tag === 'button' ||
          tag === 'a' ||
          tag === 'input' ||
          role.toLowerCase() === 'button' ||
          typeof el.onclick === 'function';
        const score =
          (exact ? 100000 : 0) +
          (clickable ? 50000 : 0) +
          Math.min(20000, r.width * r.height) +
          r.top;
        if (score > bestScore) {
          best = el;
          bestScore = score;
        }
      }
      return best;
    });

    const element = handle.asElement();
    if (!element) return { clicked: false, detail: null };
    await element.scrollIntoViewIfNeeded({ timeout: 1000 }).catch(() => {});
    const box = await element.boundingBox();
    if (!box || box.width < 2 || box.height < 2) return { clicked: false, detail: null };
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const clicked = await clickViewportPoint(page, x, y, `coordinate:${label}`);
    if (clicked.clicked) return clicked;
  } catch {
    return { clicked: false, detail: null };
  } finally {
    await handle?.dispose().catch(() => {});
  }
}

async function tryDirectEmaButtonClick(page, frame, label) {
  try {
    const locator = frame.locator('button[data-testid="ema-button"]');
    const count = Math.min(await locator.count(), 4);
    for (let i = 0; i < count; i++) {
      const candidate = locator.nth(i);
      const text = (await candidate.textContent({ timeout: 500 }).catch(() => '')) || '';
      if (!/activate\s+offer/i.test(text)) continue;
      await candidate.scrollIntoViewIfNeeded({ timeout: 1000 }).catch(() => {});
      const box = await candidate.boundingBox({ timeout: 1000 }).catch(() => null);
      if (!box || box.width < 40 || box.height < 18) continue;
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      const clicked = await clickViewportPoint(page, x, y, `ema_button_box:${label}#${i}`);
      if (clicked.clicked) return clicked;
    }
  } catch {
    /* try DOM-dispatch fallback */
  }

  try {
    const result = await frame.evaluate(() => {
      function findDeep(root) {
        const direct = root.querySelector?.('button[data-testid="ema-button"]');
        if (direct) return direct;
        for (const el of root.querySelectorAll?.('*') || []) {
          const shadow = el.shadowRoot;
          if (!shadow) continue;
          const found = findDeep(shadow);
          if (found) return found;
        }
        return null;
      }

      const btn = findDeep(document);
      if (!btn) return { clicked: false, reason: 'not_found' };
      const text = (btn.textContent || '').replace(/\s+/g, ' ').trim();
      const r = btn.getBoundingClientRect();
      const style = window.getComputedStyle(btn);
      const visible =
        r.width >= 40 &&
        r.height >= 18 &&
        r.bottom >= 0 &&
        r.right >= 0 &&
        r.top <= window.innerHeight &&
        r.left <= window.innerWidth &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number(style.opacity || '1') > 0.05;
      if (!visible) return { clicked: false, reason: 'not_visible', text };
      if (!/activate\s+offer/i.test(text)) return { clicked: false, reason: `text:${text}`, text };

      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      btn.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' });
      const eventInit = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y,
        button: 0
      };
      if (typeof PointerEvent === 'function') btn.dispatchEvent(new PointerEvent('pointerdown', eventInit));
      btn.dispatchEvent(new MouseEvent('mousedown', eventInit));
      if (typeof PointerEvent === 'function') btn.dispatchEvent(new PointerEvent('pointerup', eventInit));
      btn.dispatchEvent(new MouseEvent('mouseup', eventInit));
      btn.dispatchEvent(new MouseEvent('click', eventInit));
      btn.click();
      return {
        clicked: true,
        text,
        rect: {
          x: Math.round(r.left),
          y: Math.round(r.top),
          w: Math.round(r.width),
          h: Math.round(r.height)
        }
      };
    });
    if (result?.clicked) {
      const rect = result.rect ? `${result.rect.x},${result.rect.y},${result.rect.w}x${result.rect.h}` : '';
      return { clicked: true, detail: `ema_button_direct:${label}:${rect}` };
    }
  } catch {
    /* try next strategy */
  }
  return { clicked: false, detail: null };
}

async function tryClickVisibleCitiModalButtonArea(page) {
  try {
    const target = await page.evaluate(() => {
      const EXT_IFRAME_SRC = /^chrome-extension:\/\/[a-z0-9]{32}\//i;

      function collectIframes(root, out) {
        for (const iframe of root.querySelectorAll?.('iframe') || []) out.push(iframe);
        for (const el of root.querySelectorAll?.('*') || []) {
          const shadow = el.shadowRoot;
          if (shadow) collectIframes(shadow, out);
        }
      }

      const iframes = [];
      collectIframes(document, iframes);
      let best = null;
      let bestScore = -Infinity;
      for (const iframe of iframes) {
        const src = iframe.getAttribute('src') || iframe.src || '';
        const r = iframe.getBoundingClientRect();
        const ix = Math.max(r.left, 0);
        const iy = Math.max(r.top, 0);
        const ix2 = Math.min(r.right, window.innerWidth);
        const iy2 = Math.min(r.bottom, window.innerHeight);
        const visW = Math.max(0, ix2 - ix);
        const visH = Math.max(0, iy2 - iy);
        const visArea = visW * visH;
        if (visArea < 60000 || visW < 240 || visH < 260) continue;
        const extBonus = EXT_IFRAME_SRC.test(src) ? 1000000 : 0;
        const score = extBonus + visArea + r.bottom;
        if (score > bestScore) {
          bestScore = score;
          best = { left: ix, top: iy, right: ix2, bottom: iy2, width: visW, height: visH, src };
        }
      }
      if (!best) return null;

      // Citi EMA places the blue CTA centered near the bottom of the modal.
      return {
        x: Math.round(best.left + best.width / 2),
        y: Math.round(Math.min(best.bottom - 80, best.top + best.height - 35)),
        frame: {
          x: Math.round(best.left),
          y: Math.round(best.top),
          w: Math.round(best.width),
          h: Math.round(best.height),
          src: best.src
        }
      };
    });

    if (!target) return { clicked: false, detail: null };
    const clicked = await clickViewportPoint(page, target.x, target.y, 'modal_area_click');
    if (!clicked.clicked) return clicked;
    await page.waitForTimeout(250);
    return {
      clicked: true,
      detail: `${clicked.detail}:${target.frame.w}x${target.frame.h}`
    };
  } catch {
    return { clicked: false, detail: null };
  }
}

async function tryClickLikelyCitiButtonArea(page) {
  try {
    const points = await page.evaluate(() => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // Citi Shop EMA is a right-side extension modal in the observed Chrome window.
      // The CTA center is roughly 84% across and 58% down the viewport.
      return [
        { label: 'viewport_citi_cta_center', x: Math.round(vw * 0.84), y: Math.round(vh * 0.58) },
        { label: 'viewport_citi_cta_left', x: Math.round(vw * 0.78), y: Math.round(vh * 0.58) },
        { label: 'viewport_citi_cta_right', x: Math.round(vw * 0.91), y: Math.round(vh * 0.58) },
        { label: 'viewport_citi_cta_high_center', x: Math.round(vw * 0.84), y: Math.round(vh * 0.55) },
        { label: 'viewport_citi_cta_low_center', x: Math.round(vw * 0.84), y: Math.round(vh * 0.61) }
      ];
    });

    for (const point of points) {
      const clicked = await clickViewportPoint(page, point.x, point.y, point.label);
      if (!clicked.clicked) continue;
      await page.waitForTimeout(250);
      return clicked;
    }
  } catch {
    /* try next strategy */
  }
  return { clicked: false, detail: null };
}

async function clickActivateButton(page, timeoutMs, shouldStop = () => false) {
  const deadline = Date.now() + timeoutMs;
  let lastClick = null;
  while (Date.now() < deadline) {
    if (shouldStop()) return lastClick || { clicked: true, detail: 'activation_signal_observed' };
    const extensionTargetClick = await tryClickEmaButtonInExtensionTargets(page);
    if (extensionTargetClick.clicked) {
      lastClick = extensionTargetClick;
      await page.waitForTimeout(900).catch(() => {});
      continue;
    }
    const modalAreaClick = await tryClickVisibleCitiModalButtonArea(page);
    if (modalAreaClick.clicked) {
      lastClick = modalAreaClick;
      await page.waitForTimeout(900).catch(() => {});
      continue;
    }
    const likelyAreaClick = await tryClickLikelyCitiButtonArea(page);
    if (likelyAreaClick.clicked) {
      lastClick = likelyAreaClick;
      await page.waitForTimeout(900).catch(() => {});
      continue;
    }
    for (const frame of page.frames()) {
      if (shouldStop()) return lastClick || { clicked: true, detail: 'activation_signal_observed' };
      const frameLabel = frame.url() || 'main-frame';
      const directEmaButton = await tryDirectEmaButtonClick(page, frame, frameLabel);
      if (directEmaButton.clicked) {
        lastClick = directEmaButton;
        await page.waitForTimeout(900).catch(() => {});
        break;
      }
      const exactEmaButton = await tryClickLocator(
        frame.locator('button[data-testid="ema-button"]', { hasText: /^activate\s+offer$/i }),
        `ema_button:${frameLabel}`,
        4
      );
      if (exactEmaButton.clicked) {
        lastClick = exactEmaButton;
        await page.waitForTimeout(900).catch(() => {});
        break;
      }
      const coordinateClick = await tryCoordinateClickVisibleActivate(page, frame, frameLabel);
      if (coordinateClick.clicked) {
        lastClick = coordinateClick;
        await page.waitForTimeout(900).catch(() => {});
        break;
      }
      const candidates = [
        {
          label: `role_exact:${frameLabel}`,
          locator: frame.getByRole('button', { name: /^activate\s+offer$/i })
        },
        {
          label: `role_button:${frameLabel}`,
          locator: frame.getByRole('button', { name: ACTIVATE_RE })
        },
        {
          label: `control_exact:${frameLabel}`,
          locator: frame.locator('button, [role="button"], a, input[type="button"], input[type="submit"]', {
            hasText: /^activate\s+offer$/i
          })
        },
        {
          label: `control_text:${frameLabel}`,
          locator: frame.locator('button, [role="button"], a', { hasText: ACTIVATE_RE })
        },
        {
          label: `text:${frameLabel}`,
          locator: frame.getByText(ACTIVATE_RE)
        }
      ];

      for (const candidate of candidates) {
        if (shouldStop()) return lastClick || { clicked: true, detail: 'activation_signal_observed' };
        const result = await tryClickLocator(candidate.locator, candidate.label);
        if (result.clicked) {
          lastClick = result;
          await page.waitForTimeout(900).catch(() => {});
          break;
        }
      }
    }
    await page.waitForTimeout(300);
  }
  return lastClick || { clicked: false, detail: null };
}

function createWildlinkEWatcher(context, page, timeoutMs) {
  let cleanup = () => {};
  const promise = new Promise((resolve, reject) => {
    let settled = false;
    const timers = [];
    const pages = new Set([page]);

    const finish = (fn) => {
      if (settled) return;
      settled = true;
      context.off('request', onRequest);
      context.off('response', onResponse);
      context.off('page', onPage);
      for (const p of pages) p.off('framenavigated', onFrameNavigated);
      for (const t of timers) clearTimeout(t);
      fn();
    };
    cleanup = () => finish(() => {});

    const maybeResolve = (raw, source) => {
      if (!isWildlinkEUrl(raw)) return;
      finish(() => resolve({ url: raw, source }));
    };

    const onRequest = (req) => maybeResolve(req.url(), 'request');
    const onResponse = (res) => maybeResolve(res.url(), 'response');
    const onFrameNavigated = (frame) => maybeResolve(frame.url(), 'navigation');
    const onPage = (newPage) => {
      pages.add(newPage);
      newPage.on('framenavigated', onFrameNavigated);
      maybeResolve(newPage.url(), 'new_page');
    };

    context.on('request', onRequest);
    context.on('response', onResponse);
    context.on('page', onPage);
    page.on('framenavigated', onFrameNavigated);

    timers.push(
      setInterval(() => {
        for (const p of pages) maybeResolve(p.url(), 'page_url_poll');
      }, 250)
    );
    timers.push(
      setTimeout(() => {
        finish(() =>
          reject(Object.assign(new Error(`No wild.link/e URL within ${timeoutMs}ms`), { code: 'WL_E_TIMEOUT' }))
        );
      }, timeoutMs)
    );
  });
  // The click search can run for a while; mark this handled now so a timeout cannot crash Node
  // before the caller reaches `await watcher.promise`.
  promise.catch(() => {});
  return { promise, cancel: cleanup };
}

export async function runOfferActivationOnPage(context, item, opts) {
  const merchantName = item.merchantName || item.url;
  const traceDir = opts.traceDir;
  mkdirSync(traceDir, { recursive: true });
  const tracePath = join(traceDir, `${slugFor(merchantName)}-activation-${Date.now()}.zip`);
  const runT0 = Date.now();

  let targetUrl = item.url || null;
  let endReason = 'error';
  let detail = null;
  let generatedWildlinkUrl = null;
  let generatedWildlinkSource = null;
  let validation = { valid: false, errors: [], destinationUrl: null };
  let msToActivateClick = null;
  let msToWildlinkFromClick = null;

  const page = await context.newPage();
  let wildlinkWatcher = null;
  if (opts.traceZip !== false) {
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  }

  try {
    if (!targetUrl) {
      targetUrl = await discoverOrganicUrlFromSerp(page, merchantName);
      if (!targetUrl) {
        endReason = 'serp_failed';
      }
    }

    if (targetUrl) {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });

      wildlinkWatcher = createWildlinkEWatcher(
        context,
        page,
        ACTIVATE_BUTTON_TIMEOUT_MS + WILDLINK_E_TIMEOUT_MS
      );
      let observedWildlink = null;
      const observedWildlinkPromise = wildlinkWatcher.promise.then((wildlink) => {
        observedWildlink = wildlink;
        return wildlink;
      });
      const clickStart = Date.now();
      const click = await clickActivateButton(page, ACTIVATE_BUTTON_TIMEOUT_MS, () => observedWildlink != null);
      if (!click.clicked && !observedWildlink) {
        wildlinkWatcher.cancel();
        wildlinkWatcher = null;
        endReason = 'activate_not_found';
        detail = `No visible Activate button within ${ACTIVATE_BUTTON_TIMEOUT_MS}ms`;
      } else {
        msToActivateClick = Date.now() - clickStart;
        detail = click.detail;

        const wlStart = Date.now();
        const wildlink = observedWildlink || (await observedWildlinkPromise);
        wildlinkWatcher = null;
        generatedWildlinkUrl = wildlink.url;
        generatedWildlinkSource = wildlink.source;
        msToWildlinkFromClick = Date.now() - wlStart;
        validation = validateWildlinkEUrl(generatedWildlinkUrl, targetUrl);
        endReason = validation.valid ? 'activation_link_valid' : 'activation_link_invalid';
      }
    }
  } catch (e) {
    if (e?.code === 'WL_E_TIMEOUT') {
      endReason = 'wildlink_timeout';
      detail = e.message;
    } else {
      endReason = 'error';
      detail = e?.message || String(e);
    }
  } finally {
    wildlinkWatcher?.cancel();
    if (opts.traceZip !== false) {
      await context.tracing.stop({ path: tracePath }).catch((err) => {
        console.warn('[activation] tracing.stop failed:', tracePath, err?.message || err);
      });
    }
  }

  const video = page.video();
  await page.close().catch(() => {});
  let videoPath = null;
  if (video) {
    try {
      videoPath = await video.path();
    } catch {
      /* no recording when attached over CDP */
    }
  }

  return {
    merchantName,
    targetUrl,
    endReason,
    detail,
    generatedWildlinkUrl,
    generatedWildlinkSource,
    wildlinkDestinationUrl: validation.destinationUrl,
    wildlinkValid: validation.valid,
    validationErrors: validation.errors,
    msToActivateClick,
    msToWildlinkFromClick,
    tracePath: opts.traceZip !== false ? tracePath : null,
    videoPath,
    wallMs: Date.now() - runT0,
    recordedAt: new Date().toISOString()
  };
}

async function buildRunItems(opts) {
  const items = [];
  for (const url of opts.urls) {
    let merchantName = url;
    try {
      merchantName = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      /* keep raw label */
    }
    items.push({ merchantName, url });
  }
  for (const merchantName of opts.merchants) items.push({ merchantName, url: null });

  if (items.length) return items;

  const all = await fetchMerchants(APP_ID);
  const picked = opts.limit != null ? all.slice(0, opts.limit) : all.slice(0, 5);
  console.log(`No --url/--merchant args; using first ${picked.length} merchants from app ${APP_ID} feed.`);
  return picked.map((m) => ({ merchantName: m.name, url: null }));
}

async function main() {
  const opts = parseCli();
  if (opts.cdpUrl) opts.cdpUrl = normalizeCdpUrl(opts.cdpUrl);

  if (opts.citiExt && !existsSync(opts.citiExt)) {
    console.warn(`Citi extension path not found (continuing without it): ${opts.citiExt}`);
    opts.citiExt = null;
  } else if (opts.citiExt && !opts.cdpUrl) {
    console.log('Using Citi extension:', opts.citiExt);
  }
  if (opts.cdpUrl) {
    console.log('CDP: attach to existing Chrome (load Citi in that window first).');
  }

  mkdirSync(opts.traceDir, { recursive: true });
  mkdirSync(opts.outputDir, { recursive: true });

  const items = await buildRunItems(opts);
  const session = await startLatencyBrowser({
    cdpUrl: opts.cdpUrl,
    citiExt: opts.citiExt,
    skipWarmup: opts.skipWarmup,
    traceDir: opts.traceDir
  });

  let lastOutputPath = null;
  try {
    for (const item of items) {
      console.log(`\n--- ${item.merchantName} ---`);
      const row = await runOfferActivationOnPage(session.context, item, { traceDir: opts.traceDir });
      lastOutputPath = appendActivationRecord(opts.outputDir, row);
      console.log(`Activation: ${row.endReason}`, row.generatedWildlinkUrl || row.detail || '');
      if (row.validationErrors?.length) console.log('Validation errors:', row.validationErrors.join(', '));
      if (row.tracePath) console.log('Trace:', row.tracePath);
      if (row.videoPath) console.log('Video:', row.videoPath);
    }
  } finally {
    await stopLatencyBrowser(session);
  }

  console.log('\nRecorded results:', lastOutputPath);
}

const isMain =
  Boolean(process.argv[1]) &&
  pathToFileURL(pathResolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
