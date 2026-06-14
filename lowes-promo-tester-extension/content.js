const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shouldStop() {
  const { shouldStop: s } = await chrome.storage.local.get('shouldStop');
  return !!s;
}

async function stopGuard() {
  if (await shouldStop()) throw new Error('Stopped by user');
}

/** Sleep that respects Pause and Stop (elapsed time does not advance while paused). */
async function pauseAwareSleep(totalMs) {
  let elapsed = 0;
  const slice = 200;
  while (elapsed < totalMs) {
    await stopGuard();
    const { automationPaused } = await chrome.storage.local.get('automationPaused');
    if (automationPaused) {
      await sleep(slice);
      continue;
    }
    const step = Math.min(slice, totalMs - elapsed);
    await sleep(step);
    elapsed += step;
  }
}

function formatProductName(name) {
  let n = name || '';
  if (n.toLowerCase().includes('french door') && !n.toLowerCase().includes('shutters')) {
    n = `${n} Shutters`;
  }
  return n;
}

function isVisible(el) {
  if (!el || !el.getBoundingClientRect) return false;
  const r = el.getBoundingClientRect();
  const st = getComputedStyle(el);
  return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
}

/** React-controlled selects often need the prototype setter, not plain `sel.value =`. */
function setNativeSelectValue(sel, value) {
  if (!sel) return;
  try {
    const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    if (desc && desc.set) desc.set.call(sel, value);
    else sel.value = value;
  } catch (_) {
    try {
      sel.value = value;
    } catch (_) {}
  }
  sel.dispatchEvent(new Event('input', { bubbles: true }));
  sel.dispatchEvent(new Event('change', { bubbles: true }));
}

function configuratorRoot() {
  return (
    document.querySelector(
      'main, [role="main"], [class*="Configurator" i], [class*="configurator" i], [id*="threekit" i], [class*="ProductDetail" i]'
    ) || document.body
  );
}

function elementClassString(el) {
  const c = el.className;
  if (typeof c === 'string') return c;
  if (c && typeof c.baseVal === 'string') return c.baseVal;
  return '';
}

/** Lowe's uses small (i) / SVG buttons that open Mount, Opacity, etc. help modals — never click these. */
function isLikelyInfoOrHelpControl(el) {
  if (!el) return true;
  const aria = (el.getAttribute('aria-label') || '').toLowerCase();
  const title = (el.getAttribute('title') || '').toLowerCase();
  const cls = elementClassString(el).toLowerCase();
  const tid = (el.getAttribute('data-testid') || '').toLowerCase();
  const combined = `${aria} ${title} ${cls} ${tid}`;
  if (
    /information|more info|learn more|tooltip|what is|definition|measuring|how to measure|watch video|see details|read more|show details|help with|help me choose|about (the |this )?(mount|opacity|width|height|lift|cassette|valance)/.test(
      combined
    )
  ) {
    return true;
  }
  if (/\b(info|help|tooltip|infotip|popover)[-_]?(icon|btn|button)?\b|information[_-]?icon|icon[_-]?info/.test(cls)) {
    return true;
  }
  if (/\b(info|help|tooltip)\b/.test(tid) && !/(color|fabric|swatch)/.test(tid)) return true;
  const r = el.getBoundingClientRect();
  const tag = el.tagName.toUpperCase();
  const hasSvg = !!el.querySelector('svg');
  const txt = (el.textContent || '').trim();
  if (
    hasSvg &&
    (tag === 'BUTTON' || el.getAttribute('role') === 'button' || tag === 'A') &&
    txt.length <= 4 &&
    r.width > 0 &&
    r.width <= 40 &&
    r.height > 0 &&
    r.height <= 40
  ) {
    if (/\b(color|fabric|swatch|palette|shade|finish|select)\b/.test(combined)) return false;
    return true;
  }
  return false;
}

function isLikelyDimensionSelect(sel) {
  const opts = Array.from(sel.options).filter((o) => o.value);
  if (opts.length < 2) return false;
  let dimLike = 0;
  for (const o of opts) {
    const t = (o.textContent || '').trim();
    if (/^\d+(\.\d+)?"\s*$/.test(t) || /^\d+\s*["']?\s*x\s*\d+/i.test(t)) dimLike++;
    else if (/^\d{1,3}$/.test(t)) {
      const n = parseInt(t, 10);
      if (n >= 8 && n <= 120) dimLike++;
    }
  }
  return dimLike / opts.length > 0.55;
}

function isAccessDenied() {
  const bodyText = document.body?.textContent || '';
  const title = document.title || '';
  const url = window.location.href || '';
  return (
    bodyText.includes('Access Denied') ||
    title.includes('Access Denied') ||
    url.includes('errors.edgesuite.net') ||
    bodyText.includes("You don't have permission")
  );
}

async function clickCustomize() {
  const selectors = [
    'button[aria-label*="Customize" i]',
    'a[aria-label*="Customize" i]',
    '[data-testid*="customize" i]',
    'a[href*="customize" i]'
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && isVisible(el)) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      await pauseAwareSleep(400);
      el.click();
      await pauseAwareSleep(2000 + Math.random() * 1000);
      return true;
    }
  }
  const nodes = document.querySelectorAll('button, a, [role="button"]');
  for (const el of nodes) {
    const t = (el.textContent || '').trim().toLowerCase();
    if (t.includes('customize') && isVisible(el)) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      await pauseAwareSleep(400);
      el.click();
      await pauseAwareSleep(2000 + Math.random() * 1000);
      return true;
    }
  }
  return false;
}

async function selectSelectValue(keyword, value) {
  const kw = keyword.toLowerCase();
  const selects = document.querySelectorAll('select');
  for (const sel of selects) {
    const meta = `${sel.name || ''} ${sel.id || ''} ${sel.getAttribute('aria-label') || ''}`.toLowerCase();
    if (!meta.includes(kw)) continue;
    const strVal = String(value);
    const opt =
      Array.from(sel.options).find((o) => o.value === strVal) ||
      Array.from(sel.options).find((o) => (o.textContent || '').includes(strVal));
    if (opt) {
      setNativeSelectValue(sel, opt.value);
      await pauseAwareSleep(800);
      return true;
    }
  }
  return false;
}

async function selectWidthHeight(width, height) {
  let ok = await selectSelectValue('width', width);
  if (!ok) {
    for (const sel of document.querySelectorAll('select')) {
      const opt = Array.from(sel.options).find((o) => o.value === String(width));
      if (opt) {
        setNativeSelectValue(sel, opt.value);
        await pauseAwareSleep(800);
        ok = true;
        break;
      }
    }
  }

  ok = (await selectSelectValue('height', height)) || ok;
  if (!ok) {
    for (const sel of document.querySelectorAll('select')) {
      const opt = Array.from(sel.options).find((o) => o.value === String(height));
      if (opt) {
        setNativeSelectValue(sel, opt.value);
        await pauseAwareSleep(800);
        break;
      }
    }
  }
}

async function dismissLowesOverlays(maxPasses = 8) {
  for (let pass = 0; pass < maxPasses; pass++) {
    let dismissed = false;
    const modals = document.querySelectorAll('[role="dialog"], [aria-modal="true"]');
    for (const modal of modals) {
      if (!isVisible(modal)) continue;
      const candidates = modal.querySelectorAll('button, [role="button"], a[href="#"]');
      for (const b of candidates) {
        if (!isVisible(b)) continue;
        const tx = (b.textContent || '').trim().toLowerCase();
        const aria = (b.getAttribute('aria-label') || '').toLowerCase();
        if (
          aria.includes('close') ||
          tx === 'close' ||
          tx === '×' ||
          tx === '✕' ||
          tx === 'got it' ||
          tx === 'ok'
        ) {
          b.click();
          dismissed = true;
          await pauseAwareSleep(450);
          break;
        }
      }
      if (dismissed) break;
    }
    if (!dismissed) {
      for (const b of document.querySelectorAll('button[aria-label*="close" i]')) {
        const modal = b.closest('[role="dialog"], [aria-modal="true"]');
        if (modal && isVisible(modal) && isVisible(b)) {
          b.click();
          dismissed = true;
          await pauseAwareSleep(450);
          break;
        }
      }
    }
    if (!dismissed) break;
  }
}

/**
 * Full-page capture: prefer scrolling the *window* when the document actually scrolls — that matches
 * captureVisibleTab. Inner divs were winning before and often didn’t move the captured viewport.
 */
function findBestScrollContainer() {
  const winVH = window.innerHeight;
  const se = document.scrollingElement || document.documentElement;
  const docH = Math.max(
    se.scrollHeight,
    document.documentElement.scrollHeight,
    document.body?.scrollHeight || 0
  );
  const winExtra = Math.max(0, docH - winVH);

  let innerBest = null;
  let maxInnerExtra = 0;

  const tryEl = (el) => {
    if (!el || el === document.body || el === document.documentElement) return;
    try {
      const sh = el.scrollHeight;
      const ch = el.clientHeight;
      if (sh <= ch + 60) return;
      const extra = sh - ch;
      if (extra > maxInnerExtra) {
        maxInnerExtra = extra;
        innerBest = { mode: 'element', el, fullHeight: sh, viewHeight: ch };
      }
    } catch (_) {}
  };

  const scanRoot = (root) => {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('main, section, aside, article, div, [role="main"]').forEach(tryEl);
  };
  scanRoot(configuratorRoot());
  scanRoot(document.body);
  document.querySelectorAll('*').forEach((host) => {
    if (host.shadowRoot) scanRoot(host.shadowRoot);
  });

  if (winExtra >= 48) {
    return { mode: 'window', el: null, fullHeight: docH, viewHeight: winVH };
  }
  if (innerBest && maxInnerExtra > winExtra + 80) {
    return innerBest;
  }
  if (innerBest && maxInnerExtra > 160) {
    return innerBest;
  }
  return { mode: 'window', el: null, fullHeight: Math.max(docH, winVH), viewHeight: winVH };
}

/** When capturing via window scroll, reset nested scrollable panels to top so slice 0 isn’t mid-column. */
function resetConfiguratorInnerScrollTops() {
  try {
    configuratorRoot().querySelectorAll('div, section, main, aside').forEach((el) => {
      try {
        if (el.scrollHeight > el.clientHeight + 60) el.scrollTop = 0;
      } catch (_) {}
    });
  } catch (_) {}
}

let lastFullPageCaptureContext = null;

function applyFullPageScrollY(y) {
  const top = Math.max(0, Math.round(y));
  const ctx = lastFullPageCaptureContext || findBestScrollContainer();
  lastFullPageCaptureContext = ctx;
  if (ctx.mode === 'element' && ctx.el) {
    ctx.el.scrollTop = top;
  } else {
    const root = document.scrollingElement || document.documentElement;
    root.scrollTop = top;
    document.documentElement.scrollTop = top;
    if (document.body) document.body.scrollTop = top;
    window.scrollTo({ top, left: 0, behavior: 'instant' });
  }
}

/** Dismiss help modals and scroll capture target to top before full-page capture. */
async function prepareForFullPageScreenshot() {
  await dismissLowesOverlays(10);
  await pauseAwareSleep(200);
  lastFullPageCaptureContext = findBestScrollContainer();
  if (lastFullPageCaptureContext.mode === 'window') {
    resetConfiguratorInnerScrollTops();
  }
  applyFullPageScrollY(0);
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  await pauseAwareSleep(250);
}

function querySelectorAllDeep(selector, root = document.documentElement) {
  const out = [];
  const seen = new Set();
  function walk(node) {
    if (!node) return;
    if (node.nodeType === 1) {
      try {
        if (node.matches?.(selector) && !seen.has(node)) {
          seen.add(node);
          out.push(node);
        }
        for (const ch of node.children || []) {
          walk(ch);
          if (ch.shadowRoot) walk(ch.shadowRoot);
        }
      } catch (_) {}
    } else if (node.nodeType === 11) {
      for (const ch of node.children || []) {
        walk(ch);
      }
    }
  }
  walk(root);
  return out;
}

function getElementColorLabel(el) {
  if (!el) return '';
  const t = (el.textContent || '').trim();
  const firstLine = t.split('\n').map((s) => s.trim()).find(Boolean) || '';
  if (firstLine.length >= 2 && firstLine.length <= 96) return firstLine;
  const aria = (el.getAttribute('aria-label') || '').trim();
  if (aria.length >= 2 && aria.length <= 80) {
    return aria
      .replace(/\s*,?\s*selected\s*/i, '')
      .replace(/^select\s+/i, '')
      .trim();
  }
  const title = (el.getAttribute('title') || '').trim();
  if (title.length >= 2) return title;
  const lid = el.getAttribute('aria-labelledby');
  if (lid) {
    for (const id of lid.split(/\s+/)) {
      const lb = document.getElementById(id);
      if (lb) {
        const x = (lb.textContent || '').trim().split('\n')[0];
        if (x) return x.slice(0, 96);
      }
    }
  }
  return '';
}

function looksLikeColorNameText(s) {
  if (!s || s.length < 2 || s.length > 96) return false;
  const line = s.trim().split('\n')[0].trim();
  if (/^\d+$/.test(line)) return false;
  if (/^(filter|search|select|choose|view|more|less)$/i.test(line)) return false;
  const lower = line.toLowerCase();
  if (lower.includes('width') || lower.includes('height') || lower.includes('price')) return false;
  const known =
    /\b(white|ivory|cream|beige|tan|sand|bone|linen|pebble|granite|gray|grey|charcoal|black|brown|walnut|oak|maple|cherry|mahogany|natural|espresso|wheat|khaki|taupe|blue|navy|green|red|yellow|snow|mist|stone|canvas|silk|woven|cellular|fabric|material|faux|wood|bamboo|iron|nickel|daylight|barley|toulouse|bellamy|brushed|satin|pvc|vinyl|alabaster)\b/;
  if (known.test(lower)) return true;
  return line.split(/\s+/).length <= 8 && /^[A-Za-z0-9][A-Za-z0-9\s\-'/.]+$/.test(line);
}

async function pickMaterialStyleFromSelect() {
  const selects = document.querySelectorAll('select');
  for (const sel of selects) {
    const meta = `${sel.name || ''} ${sel.id || ''} ${sel.getAttribute('aria-label') || ''}`.toLowerCase();
    const fs = sel.closest('fieldset');
    const leg = (fs?.querySelector('legend')?.textContent || '').toLowerCase();
    const combined = `${meta} ${leg}`;
    if (!combined.includes('material')) continue;
    if (combined.includes('color name')) continue;
    const opts = Array.from(sel.options).filter((o) => {
      if (!o.value) return false;
      const tx = (o.textContent || '').trim();
      if (/^choose|^select|^--|^\.\.\./i.test(tx)) return false;
      return true;
    });
    if (opts.length < 1) continue;
    const pick = opts[Math.floor(Math.random() * opts.length)];
    sel.focus();
    setNativeSelectValue(sel, pick.value);
    await pauseAwareSleep(900);
    return ((pick.textContent || '').trim() || pick.value).slice(0, 80);
  }
  return null;
}

function normLiftText(s) {
  return (s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[()]/g, ' ')
    .trim();
}

/** Match order: Cordless → Continuous Cord Loop → Motorization (Tethered Wand) → Motorization. */
const LIFT_MATCHERS = [
  (n) => /\bcordless\b/.test(n),
  (n) => /\bcontinuous\s+cord\s+loop\b/.test(n) || /\bcord\s+loop\b/.test(n),
  (n) => /\bmotorization\b/.test(n) && /\btethered\b/.test(n),
  (n) => /\bmotorization\b/.test(n) && !/\btethered\b/.test(n)
];

function pickLiftChoiceFromLabels(labels) {
  const rows = labels
    .map((text) => ({ text: (text || '').trim(), n: normLiftText(text) }))
    .filter((r) => r.text.length > 2 && !/^choose|^select|^--/i.test(r.text));
  if (!rows.length) return null;
  for (const match of LIFT_MATCHERS) {
    for (const r of rows) {
      if (match(r.n)) return r.text;
    }
  }
  return rows[0].text;
}

/**
 * Lowe's ECP lift row uses the same tile pattern as color: `input.tile-input-radio[data-testid^="ecp-button-select-"]`
 * with lift-specific suffixes (not color slugs).
 */
const ECP_LIFT_SUFFIX_GROUPS = [
  ['CORDLESS'],
  ['CONTINUOUS_LOOP', 'CONTINUOUS_CORD_LOOP'],
  ['IN_WAND'],
  ['IN_MOTORIZED', 'MOTORIZED']
];

const ECP_LIFT_SUFFIX_READABLE = {
  CORDLESS: 'Cordless',
  CONTINUOUS_LOOP: 'Continuous Cord Loop',
  CONTINUOUS_CORD_LOOP: 'Continuous Cord Loop',
  IN_WAND: 'Motorization (Tethered Wand)',
  IN_MOTORIZED: 'Motorization',
  MOTORIZED: 'Motorization'
};

function ecpButtonSelectSuffix(input) {
  const tid = (input.getAttribute('data-testid') || '').trim();
  const m = /^ecp-button-select-(.+)$/i.exec(tid);
  return m ? m[1].toUpperCase().replace(/\s+/g, '_') : '';
}

function isEcpLiftTileSuffix(suf) {
  return ECP_LIFT_SUFFIX_GROUPS.some((g) => g.includes(suf));
}

async function trySelectLiftFromEcpTileRadios() {
  const root = configuratorRoot();
  const seen = new Set();
  const inputs = [];
  const add = (el) => {
    if (!el || seen.has(el) || el.disabled || isLikelyInfoOrHelpControl(el)) return;
    const tid = el.getAttribute('data-testid') || '';
    if (!/^ecp-button-select-/i.test(tid)) return;
    const cls = elementClassString(el).toLowerCase();
    if (!cls.includes('tile-input-radio')) return;
    if (el.closest('#colorId, [data-testid="colorId"]')) return;
    const suf = ecpButtonSelectSuffix(el);
    if (!isEcpLiftTileSuffix(suf)) return;
    seen.add(el);
    inputs.push(el);
  };
  root.querySelectorAll('input[type="radio"][data-testid^="ecp-button-select-"]').forEach(add);
  querySelectorAllDeep('input[type="radio"][data-testid^="ecp-button-select-"]', root).forEach(add);

  if (inputs.length < 1) return null;

  for (const group of ECP_LIFT_SUFFIX_GROUPS) {
    for (const suf of group) {
      const input = inputs.find((inp) => ecpButtonSelectSuffix(inp) === suf);
      if (!input) continue;
      const clickEl = resolveLowesColorTileClickTarget(input, document.documentElement);
      if (!clickEl || !isVisible(clickEl)) continue;
      const readable = ECP_LIFT_SUFFIX_READABLE[suf] || suf.replace(/_/g, ' ');
      clickEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
      await pauseAwareSleep(400);
      clickEl.click();
      await pauseAwareSleep(400);
      if (!input.checked) {
        try {
          input.click();
        } catch (_) {}
        await pauseAwareSleep(400);
      }
      await pauseAwareSleep(600);
      return readable;
    }
  }
  return null;
}

function hasLiftContext(el) {
  let p = el;
  for (let d = 0; d < 12 && p; d++) {
    const txt = (p.textContent || '').slice(0, 1400).toLowerCase();
    if (/\blift\b/.test(txt)) return true;
    p = p.parentElement;
  }
  return false;
}

/** Lowe’s often renders lift below color — scroll until a Lift heading exists or we reach the bottom. */
async function scrollConfiguratorTowardsLift() {
  for (let i = 0; i < 16; i++) {
    const legends = [...document.querySelectorAll('fieldset legend, h2, h3, h4, h5')];
    const liftHead = legends.find((l) => /\blift\b/i.test(l.textContent || ''));
    if (liftHead) {
      liftHead.scrollIntoView({ block: 'center', behavior: 'smooth' });
      await pauseAwareSleep(550);
      return;
    }
    const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 80;
    if (nearBottom) break;
    window.scrollBy({ top: Math.min(480, window.innerHeight * 0.75), behavior: 'smooth' });
    await pauseAwareSleep(380);
  }
}

async function scrollLiftSectionIntoView() {
  const heads = document.querySelectorAll('legend, h2, h3, h4, h5, [class*="label" i]');
  for (const h of heads) {
    const t = (h.textContent || '').trim();
    if (!/\blift\b/i.test(t)) continue;
    if (/\blift\b/i.test(t) && (/\boption\b/i.test(t) || t.length <= 48)) {
      h.scrollIntoView({ block: 'center', behavior: 'smooth' });
      await pauseAwareSleep(450);
      return;
    }
  }
  for (const h of heads) {
    if (/\blift\b/i.test(h.textContent || '')) {
      h.scrollIntoView({ block: 'center', behavior: 'smooth' });
      await pauseAwareSleep(450);
      return;
    }
  }
}

function liftDirectClickOk(el, n) {
  if (/\bcontinuous\s+cord\s+loop\b/.test(n)) return true;
  if (/\bmotorization\b/.test(n) && /\btethered\b/.test(n)) return true;
  if (/\bmotorization\b/.test(n) && !/\btethered\b/.test(n) && n.length < 48) return true;
  if (/\bcordless\b/.test(n)) return hasLiftContext(el);
  return false;
}

/** Tile / card rows: visible text matches a lift product name (Levolor often uses non-fieldset tiles). */
async function trySelectLiftFromDirectPhrases() {
  const root = configuratorRoot();
  const nodes = root.querySelectorAll(
    'button, [role="button"], [role="radio"], [role="option"], label, li, div[tabindex="0"], span[tabindex="0"], a'
  );
  const list = [...nodes].filter(
    (el) =>
      isVisible(el) &&
      !isLikelyInfoOrHelpControl(el) &&
      !el.closest('nav, header, footer, [class*="cart" i], [role="dialog"], [aria-modal="true"]')
  );
  for (const match of LIFT_MATCHERS) {
    for (const el of list) {
      const t = (el.textContent || '').trim().replace(/\s+/g, ' ');
      const aria = el.getAttribute('aria-label') || '';
      if (t.length > 160 || t.length < 3) continue;
      const n = normLiftText(`${t} ${aria}`);
      if (!match(n)) continue;
      if (!liftDirectClickOk(el, n)) continue;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      await pauseAwareSleep(400);
      el.click();
      await pauseAwareSleep(1200);
      return t.split('\n')[0].trim().slice(0, 120);
    }
  }
  return null;
}

async function trySelectLiftFromSelect() {
  for (const fs of document.querySelectorAll('fieldset')) {
    const leg = (fs.querySelector('legend')?.textContent || '').toLowerCase();
    const blob = (fs.textContent || '').slice(0, 500).toLowerCase();
    if (!/\blift\b/.test(leg) && !/\blift\s*option\b/.test(blob)) continue;
    const sel = fs.querySelector('select');
    if (!sel || !isVisible(sel)) continue;
    const opts = Array.from(sel.options).filter((o) => {
      if (!o.value) return false;
      const tx = (o.textContent || '').trim();
      if (/^choose|^select|^--|^\.\.\./i.test(tx)) return false;
      return true;
    });
    if (opts.length < 1) continue;
    const label = pickLiftChoiceFromLabels(opts.map((o) => (o.textContent || '').trim()));
    const opt =
      opts.find((o) => (o.textContent || '').trim() === label) ||
      opts.find((o) => normLiftText(o.textContent || '') === normLiftText(label)) ||
      opts[0];
    sel.focus();
    setNativeSelectValue(sel, opt.value);
    await pauseAwareSleep(900);
    return ((opt.textContent || '').trim() || opt.value).slice(0, 120);
  }
  for (const sel of document.querySelectorAll('select')) {
    if (!isVisible(sel)) continue;
    const meta = `${sel.name || ''} ${sel.id || ''} ${sel.getAttribute('aria-label') || ''}`.toLowerCase();
    if (!/\blift\b/.test(meta)) continue;
    const opts = Array.from(sel.options).filter((o) => {
      if (!o.value) return false;
      const tx = (o.textContent || '').trim();
      if (/^choose|^select|^--|^\.\.\./i.test(tx)) return false;
      return true;
    });
    if (opts.length < 1) continue;
    const label = pickLiftChoiceFromLabels(opts.map((o) => (o.textContent || '').trim()));
    const opt =
      opts.find((o) => (o.textContent || '').trim() === label) ||
      opts.find((o) => normLiftText(o.textContent || '') === normLiftText(label)) ||
      opts[0];
    sel.focus();
    setNativeSelectValue(sel, opt.value);
    await pauseAwareSleep(900);
    return ((opt.textContent || '').trim() || opt.value).slice(0, 120);
  }
  return null;
}

async function trySelectLiftFromRadios() {
  for (const fs of document.querySelectorAll('fieldset')) {
    const leg = (fs.querySelector('legend')?.textContent || '').toLowerCase();
    const blob = (fs.textContent || '').slice(0, 500).toLowerCase();
    if (!/\blift\b/.test(leg) && !/\blift\s*option\b/.test(blob)) continue;
    const radios = [...fs.querySelectorAll('input[type="radio"]')].filter((r) => isVisible(r));
    const cands = [];
    for (const r of radios) {
      let label = null;
      if (r.id) {
        try {
          label = document.querySelector(`label[for="${CSS.escape(r.id)}"]`);
        } catch (_) {
          label = document.querySelector(`label[for="${r.id.replace(/"/g, '\\"')}"]`);
        }
      }
      if (!label) label = r.closest('label');
      const text = (label?.textContent || r.getAttribute('aria-label') || r.value || '').trim();
      if (text.length < 3) continue;
      const click = label && isVisible(label) ? label : r;
      cands.push({ text, click });
    }
    if (cands.length < 1) continue;
    const label = pickLiftChoiceFromLabels(cands.map((c) => c.text));
    const hit =
      cands.find((c) => c.text === label) ||
      cands.find((c) => normLiftText(c.text) === normLiftText(label)) ||
      cands[0];
    hit.click.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await pauseAwareSleep(350);
    hit.click.click();
    await pauseAwareSleep(1100);
    return hit.text.slice(0, 120);
  }
  return null;
}

async function trySelectLiftFromRoleRadios() {
  const groups = document.querySelectorAll('[role="radiogroup"], fieldset');
  for (const g of groups) {
    const blob = (g.textContent || '').slice(0, 900).toLowerCase();
    if (!/\blift\b/.test(blob)) continue;
    const roles = [...g.querySelectorAll('[role="radio"]')].filter((el) => isVisible(el));
    if (roles.length < 1) continue;
    const cands = roles.map((el) => ({
      text: (el.textContent || el.getAttribute('aria-label') || '').trim().split('\n')[0].slice(0, 120),
      el
    }));
    const label = pickLiftChoiceFromLabels(cands.map((c) => c.text));
    const hit =
      cands.find((c) => c.text === label) ||
      cands.find((c) => normLiftText(c.text) === normLiftText(label)) ||
      cands[0];
    hit.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await pauseAwareSleep(350);
    hit.el.click();
    await pauseAwareSleep(1100);
    return hit.text.slice(0, 120);
  }
  return null;
}

async function trySelectLiftFromCombobox() {
  const root = configuratorRoot();
  const triggers = new Set([
    ...root.querySelectorAll(
      '[role="combobox"], [aria-haspopup="listbox"], button[aria-expanded][aria-controls], [data-testid*="combobox" i]'
    ),
    ...document.querySelectorAll('[role="combobox"]')
  ]);
  for (const combo of triggers) {
    if (!combo || !isVisible(combo)) continue;
    if (isLikelyInfoOrHelpControl(combo)) continue;
    if (combo.closest('[role="dialog"], [aria-modal="true"]')) continue;
    const block = (combo.closest('div, section, li, fieldset, tr')?.textContent || '').slice(0, 520).toLowerCase();
    if (!/\blift\b/.test(block)) continue;
    if (/\b(color|fabric|swatch|finish)\b/.test(block) && !/\blift\b/.test((combo.getAttribute('aria-label') || '').toLowerCase())) {
      continue;
    }
    combo.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await pauseAwareSleep(400);
    combo.click();
    await pauseAwareSleep(650);
    let options = [];
    const ctlId = combo.getAttribute('aria-controls');
    if (ctlId) {
      try {
        const lb0 = document.getElementById(ctlId.split(/\s+/)[0]);
        if (lb0 && isVisible(lb0)) {
          const opts = [...lb0.querySelectorAll('[role="option"], [role="menuitem"], [role="menuitemradio"]')].filter(
            isVisible
          );
          if (opts.length >= 1) options = opts;
        }
      } catch (_) {}
    }
    if (options.length < 1) {
      for (const lb of document.querySelectorAll('[role="listbox"]')) {
        if (!isVisible(lb)) continue;
        const opts = [...lb.querySelectorAll('[role="option"], [role="menuitem"], [role="menuitemradio"]')].filter(
          isVisible
        );
        if (opts.length >= 1) {
          options = opts;
          break;
        }
      }
    }
    if (options.length < 1) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await pauseAwareSleep(200);
      continue;
    }
    const cands = options.map((el) => ({
      text: (el.textContent || '').trim().split('\n')[0].slice(0, 120),
      el
    }));
    const label = pickLiftChoiceFromLabels(cands.map((c) => c.text));
    const hit =
      cands.find((c) => c.text === label) ||
      cands.find((c) => normLiftText(c.text) === normLiftText(label)) ||
      cands[0];
    hit.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await pauseAwareSleep(280);
    hit.el.click();
    await pauseAwareSleep(1200);
    return hit.text.slice(0, 120);
  }
  return null;
}

/**
 * Ensures a lift control is set (Cordless, Continuous Cord Loop, Motorization, etc.).
 * Call after color so lift tiles below the fold are mounted. No-op if the page has no lift block.
 */
async function selectLiftOptionPreferred() {
  await scrollConfiguratorTowardsLift();
  await scrollLiftSectionIntoView();
  await dismissLowesOverlays(4);
  let picked =
    (await trySelectLiftFromEcpTileRadios()) ||
    (await trySelectLiftFromDirectPhrases()) ||
    (await trySelectLiftFromSelect()) ||
    (await trySelectLiftFromRadios()) ||
    (await trySelectLiftFromRoleRadios()) ||
    (await trySelectLiftFromCombobox());
  if (!picked) {
    await scrollConfiguratorTowardsLift();
    picked =
      (await trySelectLiftFromEcpTileRadios()) ||
      (await trySelectLiftFromDirectPhrases()) ||
      (await trySelectLiftFromCombobox()) ||
      (await trySelectLiftFromRadios());
  }
  return picked || null;
}

/**
 * Cassette valance must run only after lift is applied. When Lowe’s uses ECP lift
 * tile radios, wait until one is checked (or briefly settle if lift is non-ECP).
 */
async function waitForLiftSelectionApplied() {
  for (let i = 0; i < 36; i++) {
    await stopGuard();
    const root = configuratorRoot();
    const liftRadios = [...root.querySelectorAll('input[type="radio"][data-testid^="ecp-button-select-"]')].filter(
      (r) => isEcpLiftTileSuffix(ecpButtonSelectSuffix(r))
    );
    if (liftRadios.length < 1) {
      await pauseAwareSleep(700);
      return;
    }
    if (liftRadios.some((r) => r.checked)) {
      await pauseAwareSleep(550);
      return;
    }
    await pauseAwareSleep(200);
  }
  await pauseAwareSleep(400);
}

/** Top-row valance style (not size). “Cassette Valance Size” only appears after Curved Cassette. */
const ECP_VALANCE_STYLE_SUFFIXES = ['NO_VALANCE', 'CURVED_CASSETTE', 'DELUXE_VALANCE'];

const ECP_VALANCE_STYLE_READABLE = {
  NO_VALANCE: 'No Valance',
  CURVED_CASSETTE: 'Curved Cassette',
  DELUXE_VALANCE: 'Deluxe Valance'
};

function isEcpValanceStyleSuffix(suf) {
  return ECP_VALANCE_STYLE_SUFFIXES.includes(suf);
}

async function scrollConfiguratorTowardsValance() {
  for (let i = 0; i < 14; i++) {
    const legends = [...document.querySelectorAll('fieldset legend, h2, h3, h4, h5')];
    const head = legends.find((l) => {
      const t = (l.textContent || '').trim();
      if (/cassette\s+valance\s+size/i.test(t)) return false;
      return /^valance\b/i.test(t) || /^\s*valance\s*:/i.test(t);
    });
    if (head) {
      head.scrollIntoView({ block: 'center', behavior: 'smooth' });
      await pauseAwareSleep(520);
      return;
    }
    const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 80;
    if (nearBottom) break;
    window.scrollBy({ top: Math.min(480, window.innerHeight * 0.72), behavior: 'smooth' });
    await pauseAwareSleep(360);
  }
}

/** Random among available ECP valance tiles (No / Curved Cassette / Deluxe). */
async function trySelectValanceStyleFromEcpTileRadios() {
  const root = configuratorRoot();
  const seen = new Set();
  const inputs = [];
  const add = (el) => {
    if (!el || seen.has(el) || el.disabled || isLikelyInfoOrHelpControl(el)) return;
    const tid = el.getAttribute('data-testid') || '';
    if (!/^ecp-button-select-/i.test(tid)) return;
    const cls = elementClassString(el).toLowerCase();
    if (!cls.includes('tile-input-radio')) return;
    if (el.closest('#colorId, [data-testid="colorId"]')) return;
    const suf = ecpButtonSelectSuffix(el);
    if (!isEcpValanceStyleSuffix(suf)) return;
    seen.add(el);
    inputs.push(el);
  };
  root.querySelectorAll('input[type="radio"][data-testid^="ecp-button-select-"]').forEach(add);
  querySelectorAllDeep('input[type="radio"][data-testid^="ecp-button-select-"]', root).forEach(add);
  const available = ECP_VALANCE_STYLE_SUFFIXES.filter((suf) => inputs.some((inp) => ecpButtonSelectSuffix(inp) === suf));
  if (available.length < 1) return null;
  const sufPick = available[Math.floor(Math.random() * available.length)];
  const input = inputs.find((inp) => ecpButtonSelectSuffix(inp) === sufPick);
  if (!input) return null;
  const clickEl = resolveLowesColorTileClickTarget(input, document.documentElement);
  if (!clickEl || !isVisible(clickEl)) return null;
  clickEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
  await pauseAwareSleep(400);
  clickEl.click();
  await pauseAwareSleep(400);
  if (!input.checked) {
    try {
      input.click();
    } catch (_) {}
    await pauseAwareSleep(400);
  }
  await pauseAwareSleep(500);
  return sufPick;
}

/**
 * ECP cassette valance — Lowe’s uses the same tile radios as color/lift, e.g.
 * data-testid="ecp-button-select-MEDIUM_CASSETTE" | "ecp-button-select-LARGE_CASSETTE"
 * (input.backyard.radio.tile-input-radio).
 */
const ECP_CASSETTE_SUFFIX_GROUPS = [
  [
    'MEDIUM_CASSETTE',
    'MEDIUM_CASSETTE_VALANCE',
    'CASSETTE_VALANCE_MEDIUM',
    'CASSETTE_MEDIUM',
    'MEDIUM_VALANCE',
    'CASSETTE_M'
  ],
  [
    'LARGE_CASSETTE',
    'LARGE_CASSETTE_VALANCE',
    'CASSETTE_VALANCE_LARGE',
    'CASSETTE_LARGE',
    'LARGE_VALANCE',
    'CASSETTE_L'
  ]
];

const ECP_CASSETTE_SUFFIX_READABLE = {
  MEDIUM_CASSETTE_VALANCE: 'Medium Cassette Valance',
  MEDIUM_CASSETTE: 'Medium Cassette Valance',
  CASSETTE_VALANCE_MEDIUM: 'Medium Cassette Valance',
  CASSETTE_MEDIUM: 'Medium Cassette Valance',
  MEDIUM_VALANCE: 'Medium Cassette Valance',
  CASSETTE_M: 'Medium Cassette Valance',
  LARGE_CASSETTE_VALANCE: 'Large Cassette Valance',
  LARGE_CASSETTE: 'Large Cassette Valance',
  CASSETTE_VALANCE_LARGE: 'Large Cassette Valance',
  CASSETTE_LARGE: 'Large Cassette Valance',
  LARGE_VALANCE: 'Large Cassette Valance',
  CASSETTE_L: 'Large Cassette Valance'
};

function isEcpCassetteSuffix(suf) {
  return ECP_CASSETTE_SUFFIX_GROUPS.some((g) => g.includes(suf));
}

function hasCassetteValanceContext(el) {
  let p = el;
  for (let d = 0; d < 14 && p; d++) {
    const txt = (p.textContent || '').slice(0, 1600).toLowerCase();
    if (/\bcassette\b/.test(txt) && /\bvalance\b/.test(txt)) return true;
    if (/cassette\s+valance/i.test(txt)) return true;
    p = p.parentElement;
  }
  return false;
}

async function scrollConfiguratorTowardsCassetteValance() {
  for (let i = 0; i < 16; i++) {
    const legends = [...document.querySelectorAll('fieldset legend, h2, h3, h4, h5')];
    const head = legends.find((l) => /cassette|valance/i.test(l.textContent || ''));
    if (head) {
      head.scrollIntoView({ block: 'center', behavior: 'smooth' });
      await pauseAwareSleep(550);
      return;
    }
    const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 80;
    if (nearBottom) break;
    window.scrollBy({ top: Math.min(480, window.innerHeight * 0.75), behavior: 'smooth' });
    await pauseAwareSleep(380);
  }
}

async function trySelectCassetteValanceFromEcpTileRadios() {
  const root = configuratorRoot();
  const seen = new Set();
  const inputs = [];
  const add = (el) => {
    if (!el || seen.has(el) || el.disabled || isLikelyInfoOrHelpControl(el)) return;
    const tid = el.getAttribute('data-testid') || '';
    if (!/^ecp-button-select-/i.test(tid)) return;
    const cls = elementClassString(el).toLowerCase();
    if (!cls.includes('tile-input-radio')) return;
    if (el.closest('#colorId, [data-testid="colorId"]')) return;
    const suf = ecpButtonSelectSuffix(el);
    if (isEcpLiftTileSuffix(suf)) return;
    if (!isEcpCassetteSuffix(suf)) return;
    seen.add(el);
    inputs.push(el);
  };
  root.querySelectorAll('input[type="radio"][data-testid^="ecp-button-select-"]').forEach(add);
  querySelectorAllDeep('input[type="radio"][data-testid^="ecp-button-select-"]', root).forEach(add);
  if (inputs.length < 1) return null;

  const pool = [];
  for (const suf of ['MEDIUM_CASSETTE', 'LARGE_CASSETTE']) {
    const inp = inputs.find((i) => ecpButtonSelectSuffix(i) === suf);
    if (inp) pool.push({ input: inp, suf });
  }
  if (pool.length < 1) {
    for (const group of ECP_CASSETTE_SUFFIX_GROUPS) {
      for (const suf of group) {
        if (suf === 'MEDIUM_CASSETTE' || suf === 'LARGE_CASSETTE') continue;
        const input = inputs.find((inp) => ecpButtonSelectSuffix(inp) === suf);
        if (!input) continue;
        pool.push({ input, suf });
      }
      if (pool.length) break;
    }
  }
  if (pool.length < 1) return null;
  const { input, suf } = pool[Math.floor(Math.random() * pool.length)];
  const clickEl = resolveLowesColorTileClickTarget(input, document.documentElement);
  if (!clickEl || !isVisible(clickEl)) return null;
  const readable = ECP_CASSETTE_SUFFIX_READABLE[suf] || suf.replace(/_/g, ' ');
  clickEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
  await pauseAwareSleep(400);
  clickEl.click();
  await pauseAwareSleep(400);
  if (!input.checked) {
    try {
      input.click();
    } catch (_) {}
    await pauseAwareSleep(400);
  }
  await pauseAwareSleep(600);
  return readable;
}

async function trySelectCassetteValanceFromSelect() {
  for (const fs of document.querySelectorAll('fieldset')) {
    const leg = (fs.querySelector('legend')?.textContent || '').toLowerCase();
    const blob = (fs.textContent || '').slice(0, 600).toLowerCase();
    const hit =
      /cassette\s+valance\s+size/i.test(leg + blob) ||
      (/\bcassette\b/i.test(leg) && /\bsize\b/i.test(leg)) ||
      (/cassette\s+valance/i.test(blob) && /\bsize\b/i.test(blob) && !/^valance\s*$/i.test(leg.trim()));
    if (!hit) continue;
    const sel = fs.querySelector('select');
    if (!sel || !isVisible(sel)) continue;
    const opts = Array.from(sel.options).filter((o) => {
      if (!o.value) return false;
      const tx = (o.textContent || '').trim();
      if (/^choose|^select|^--|^\.\.\./i.test(tx)) return false;
      return true;
    });
    if (opts.length < 1) continue;
    const sizeLike = opts.filter((o) => /medium|large/i.test((o.textContent || '').trim()));
    const pickPool = sizeLike.length ? sizeLike : opts;
    const pick = pickPool[Math.floor(Math.random() * pickPool.length)];
    sel.focus();
    setNativeSelectValue(sel, pick.value);
    await pauseAwareSleep(900);
    return ((pick.textContent || '').trim() || pick.value).slice(0, 120);
  }
  return null;
}

async function trySelectCassetteValanceFromRadios() {
  for (const fs of document.querySelectorAll('fieldset')) {
    const leg = (fs.querySelector('legend')?.textContent || '').toLowerCase();
    const blob = (fs.textContent || '').slice(0, 600).toLowerCase();
    if (!/cassette\s+valance\s+size/i.test(leg) && !/cassette\s+valance/i.test(blob)) continue;
    if (/^valance\s*$/i.test(leg.trim()) && !/size/i.test(leg)) continue;
    const radios = [...fs.querySelectorAll('input[type="radio"]')].filter((r) => isVisible(r));
    const cands = [];
    for (const r of radios) {
      let label = null;
      if (r.id) {
        try {
          label = document.querySelector(`label[for="${CSS.escape(r.id)}"]`);
        } catch (_) {
          label = document.querySelector(`label[for="${r.id.replace(/"/g, '\\"')}"]`);
        }
      }
      if (!label) label = r.closest('label');
      const text = (label?.textContent || r.getAttribute('aria-label') || r.value || '').trim();
      if (text.length < 3) continue;
      const click = label && isVisible(label) ? label : r;
      cands.push({ text, click });
    }
    if (cands.length < 1) continue;
    const sizeCands = cands.filter((c) => /medium|large/i.test(c.text));
    const pool = sizeCands.length ? sizeCands : cands;
    const hit = pool[Math.floor(Math.random() * pool.length)];
    hit.click.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await pauseAwareSleep(350);
    hit.click.click();
    await pauseAwareSleep(1100);
    return hit.text.slice(0, 120);
  }
  return null;
}

async function trySelectCassetteValanceDirectPhrases() {
  const root = configuratorRoot();
  const nodes = root.querySelectorAll(
    'button, [role="button"], [role="radio"], label, li, div[tabindex="0"], span[tabindex="0"], a'
  );
  const list = [...nodes].filter(
    (el) =>
      isVisible(el) &&
      !isLikelyInfoOrHelpControl(el) &&
      !el.closest('nav, header, footer, [class*="cart" i], [role="dialog"], [aria-modal="true"]')
  );
  const tryClick = async (el, name) => {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await pauseAwareSleep(400);
    el.click();
    await pauseAwareSleep(1200);
    return name;
  };
  const candidates = [];
  for (const el of list) {
    const t = (el.textContent || '').trim().replace(/\s+/g, ' ');
    if (t.length > 120 || t.length < 8) continue;
    if (!/medium\s+cassette\s+valance|large\s+cassette\s+valance/i.test(t)) continue;
    if (!hasCassetteValanceContext(el) && !/^medium\s+cassette\s+valance$/i.test(t) && !/^large\s+cassette\s+valance$/i.test(t)) {
      continue;
    }
    const name = /^large\s+/i.test(t) ? 'Large Cassette Valance' : 'Medium Cassette Valance';
    candidates.push({ el, name });
  }
  if (candidates.length < 1) return null;
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  return tryClick(pick.el, pick.name);
}

/**
 * Random valance style (No / Curved Cassette / Deluxe). Cassette size (M/L) only if Curved Cassette
 * — that row is hidden for other styles. Call after lift + {@link waitForLiftSelectionApplied}.
 */
async function selectValanceStyleAndOptionalCassetteSize() {
  await scrollConfiguratorTowardsValance();
  await dismissLowesOverlays(4);
  let styleSuf = await trySelectValanceStyleFromEcpTileRadios();
  if (!styleSuf) {
    await scrollConfiguratorTowardsValance();
    styleSuf = await trySelectValanceStyleFromEcpTileRadios();
  }
  await pauseAwareSleep(850);
  await dismissLowesOverlays(4);

  let cassetteLabel = null;
  if (styleSuf === 'CURVED_CASSETTE') {
    await scrollConfiguratorTowardsCassetteValance();
    await dismissLowesOverlays(4);
    cassetteLabel =
      (await trySelectCassetteValanceFromEcpTileRadios()) ||
      (await trySelectCassetteValanceFromSelect()) ||
      (await trySelectCassetteValanceFromRadios()) ||
      (await trySelectCassetteValanceDirectPhrases());
    if (!cassetteLabel) {
      await scrollConfiguratorTowardsCassetteValance();
      cassetteLabel =
        (await trySelectCassetteValanceFromEcpTileRadios()) ||
        (await trySelectCassetteValanceDirectPhrases()) ||
        (await trySelectCassetteValanceFromRadios());
    }
    await pauseAwareSleep(500);
  }

  const styleLabel = styleSuf ? ECP_VALANCE_STYLE_READABLE[styleSuf] || styleSuf.replace(/_/g, ' ') : null;
  return { valance_style: styleLabel, valance_suffix: styleSuf, cassette_valance: cassetteLabel };
}

/** Blinds per headrail — ECP tiles after color on many SKUs. */
const ECP_HEADRAIL_BLINDS_SUFFIXES = ['SINGLE_RAIL', 'TWO_ON_ONE'];

const ECP_HEADRAIL_READABLE = {
  SINGLE_RAIL: 'Single rail',
  TWO_ON_ONE: 'Two on one headrail'
};

function isEcpHeadrailBlindsSuffix(suf) {
  return ECP_HEADRAIL_BLINDS_SUFFIXES.includes(suf);
}

async function scrollConfiguratorTowardsHeadrailBlinds() {
  for (let i = 0; i < 14; i++) {
    const legends = [...document.querySelectorAll('fieldset legend, h2, h3, h4, h5')];
    const head = legends.find((l) => {
      const t = (l.textContent || '').toLowerCase();
      return /\bheadrail\b/.test(t) || /blinds?\s+per\s+headrail/i.test(t) || /\btwo\s+on\s+one\b/i.test(t);
    });
    if (head) {
      head.scrollIntoView({ block: 'center', behavior: 'smooth' });
      await pauseAwareSleep(520);
      return;
    }
    const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 80;
    if (nearBottom) break;
    window.scrollBy({ top: Math.min(480, window.innerHeight * 0.72), behavior: 'smooth' });
    await pauseAwareSleep(360);
  }
}

async function trySelectHeadrailBlindsPerFromEcpTileRadios() {
  const root = configuratorRoot();
  const seen = new Set();
  const inputs = [];
  const add = (el) => {
    if (!el || seen.has(el) || el.disabled || isLikelyInfoOrHelpControl(el)) return;
    const tid = el.getAttribute('data-testid') || '';
    if (!/^ecp-button-select-/i.test(tid)) return;
    const cls = elementClassString(el).toLowerCase();
    if (!cls.includes('tile-input-radio')) return;
    if (el.closest('#colorId, [data-testid="colorId"]')) return;
    const suf = ecpButtonSelectSuffix(el);
    if (!isEcpHeadrailBlindsSuffix(suf)) return;
    seen.add(el);
    inputs.push(el);
  };
  root.querySelectorAll('input[type="radio"][data-testid^="ecp-button-select-"]').forEach(add);
  querySelectorAllDeep('input[type="radio"][data-testid^="ecp-button-select-"]', root).forEach(add);
  const available = ECP_HEADRAIL_BLINDS_SUFFIXES.filter((suf) => inputs.some((inp) => ecpButtonSelectSuffix(inp) === suf));
  if (available.length < 1) return null;
  const sufPick = available[Math.floor(Math.random() * available.length)];
  const input = inputs.find((inp) => ecpButtonSelectSuffix(inp) === sufPick);
  if (!input) return null;
  const clickEl = resolveLowesColorTileClickTarget(input, document.documentElement);
  if (!clickEl || !isVisible(clickEl)) return null;
  clickEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
  await pauseAwareSleep(400);
  clickEl.click();
  await pauseAwareSleep(400);
  if (!input.checked) {
    try {
      input.click();
    } catch (_) {}
    await pauseAwareSleep(400);
  }
  await pauseAwareSleep(500);
  return ECP_HEADRAIL_READABLE[sufPick] || sufPick.replace(/_/g, ' ');
}

/** Call right after color. */
async function selectBlindsPerHeadrailPreferred() {
  await scrollConfiguratorTowardsHeadrailBlinds();
  await dismissLowesOverlays(4);
  let picked = await trySelectHeadrailBlindsPerFromEcpTileRadios();
  if (!picked) {
    await scrollConfiguratorTowardsHeadrailBlinds();
    picked = await trySelectHeadrailBlindsPerFromEcpTileRadios();
  }
  return picked || null;
}

/** Side channels — ECP after valance / cassette block when shown. */
const ECP_SIDECHANNEL_SUFFIXES = ['YES_SIDECHANNEL', 'NO_SIDECHANNEL'];

const ECP_SIDECHANNEL_READABLE = {
  YES_SIDECHANNEL: 'Yes — side channels',
  NO_SIDECHANNEL: 'No side channels'
};

function isEcpSideChannelSuffix(suf) {
  return ECP_SIDECHANNEL_SUFFIXES.includes(suf);
}

async function scrollConfiguratorTowardsSideChannels() {
  for (let i = 0; i < 14; i++) {
    const legends = [...document.querySelectorAll('fieldset legend, h2, h3, h4, h5')];
    const head = legends.find((l) => /\bside\s*channels?\b/i.test(l.textContent || ''));
    if (head) {
      head.scrollIntoView({ block: 'center', behavior: 'smooth' });
      await pauseAwareSleep(520);
      return;
    }
    const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 80;
    if (nearBottom) break;
    window.scrollBy({ top: Math.min(480, window.innerHeight * 0.72), behavior: 'smooth' });
    await pauseAwareSleep(360);
  }
}

async function trySelectSideChannelsFromEcpTileRadios() {
  const root = configuratorRoot();
  const seen = new Set();
  const inputs = [];
  const add = (el) => {
    if (!el || seen.has(el) || el.disabled || isLikelyInfoOrHelpControl(el)) return;
    const tid = el.getAttribute('data-testid') || '';
    if (!/^ecp-button-select-/i.test(tid)) return;
    const cls = elementClassString(el).toLowerCase();
    if (!cls.includes('tile-input-radio')) return;
    if (el.closest('#colorId, [data-testid="colorId"]')) return;
    const suf = ecpButtonSelectSuffix(el);
    if (!isEcpSideChannelSuffix(suf)) return;
    seen.add(el);
    inputs.push(el);
  };
  root.querySelectorAll('input[type="radio"][data-testid^="ecp-button-select-"]').forEach(add);
  querySelectorAllDeep('input[type="radio"][data-testid^="ecp-button-select-"]', root).forEach(add);
  const available = ECP_SIDECHANNEL_SUFFIXES.filter((suf) => inputs.some((inp) => ecpButtonSelectSuffix(inp) === suf));
  if (available.length < 1) return null;
  const sufPick = available[Math.floor(Math.random() * available.length)];
  const input = inputs.find((inp) => ecpButtonSelectSuffix(inp) === sufPick);
  if (!input) return null;
  const clickEl = resolveLowesColorTileClickTarget(input, document.documentElement);
  if (!clickEl || !isVisible(clickEl)) return null;
  clickEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
  await pauseAwareSleep(400);
  clickEl.click();
  await pauseAwareSleep(400);
  if (!input.checked) {
    try {
      input.click();
    } catch (_) {}
    await pauseAwareSleep(400);
  }
  await pauseAwareSleep(500);
  return ECP_SIDECHANNEL_READABLE[sufPick] || sufPick.replace(/_/g, ' ');
}

/** Call after {@link selectValanceStyleAndOptionalCassetteSize}. */
async function selectSideChannelsPreferred() {
  await scrollConfiguratorTowardsSideChannels();
  await dismissLowesOverlays(4);
  let picked = await trySelectSideChannelsFromEcpTileRadios();
  if (!picked) {
    await scrollConfiguratorTowardsSideChannels();
    picked = await trySelectSideChannelsFromEcpTileRadios();
  }
  return picked || null;
}

async function pickMaterialFromFieldset() {
  for (const fs of document.querySelectorAll('fieldset')) {
    const leg = (fs.querySelector('legend')?.textContent || '').toLowerCase();
    if (!leg.includes('material') && !leg.includes('style') && !leg.includes('product type')) continue;
    const btns = fs.querySelectorAll('button, [role="button"], [role="radio"], input[type="radio"]');
    const vis = [...btns].filter((b) => isVisible(b) && !isLikelyInfoOrHelpControl(b));
    if (vis.length < 1) continue;
    const pick = vis[Math.floor(Math.random() * vis.length)];
    let target = pick;
    if (pick.tagName === 'INPUT' && pick.type === 'radio') {
      if (pick.id) {
        try {
          const lab = document.querySelector(`label[for="${CSS.escape(pick.id)}"]`);
          if (lab && isVisible(lab)) target = lab;
        } catch (_) {}
      } else {
        const lab = pick.closest('label');
        if (lab && isVisible(lab)) target = lab;
      }
    }
    if (!isVisible(target)) continue;
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await pauseAwareSleep(350);
    target.click();
    await pauseAwareSleep(1100);
    return (leg || 'material').slice(0, 40);
  }
  return null;
}

async function tryExpandColorSection() {
  const root = configuratorRoot();
  const clickers = root.querySelectorAll(
    'button, [role="button"], [role="tab"], div[tabindex="0"], span[tabindex="0"]'
  );
  for (const el of clickers) {
    if (!isVisible(el)) continue;
    if (isLikelyInfoOrHelpControl(el)) continue;
    if (el.closest('[role="dialog"], [aria-modal="true"]')) continue;
    const t = (el.textContent || '').trim().replace(/\s+/g, ' ');
    if (t.length > 56) continue;
    const lower = t.toLowerCase();
    if (/(credit|cart|checkout|payment|sign in)/i.test(lower)) continue;
    const row = el.closest('div, li, section, tr, [class*="row" i]') || el;
    const ctx = ((row.textContent || '') + ' ' + t).slice(0, 300).toLowerCase();
    let isColorHeader =
      /^(color|colors|color name|fabric|finish|shade|slat color)s?$/i.test(lower) ||
      /^color\s*name$/i.test(t.trim()) ||
      /^choose\s+a\s+color/i.test(t);
    if (!isColorHeader && /color name/i.test(ctx) && t.length < 44) {
      if (
        /color|swatch|fabric|shade|select|choose|paint|finish/i.test(lower) ||
        el.getAttribute('aria-expanded') === 'false'
      ) {
        isColorHeader = true;
      }
    }
    if (!isColorHeader) continue;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await pauseAwareSleep(300);
    el.click();
    await pauseAwareSleep(700);
    return true;
  }
  return false;
}

/** Radios under #colorId (and shadow roots inside it) — Lowe's Levolor / ECP color tiles. */
function queryRadiosUnderElement(rootEl) {
  const out = [];
  const seen = new Set();
  function walk(node) {
    if (!node) return;
    if (node.nodeType === 1) {
      try {
        if (node.matches?.('input[type="radio"]') && !seen.has(node)) {
          seen.add(node);
          out.push(node);
        }
      } catch (_) {}
      try {
        if (node.shadowRoot) walk(node.shadowRoot);
      } catch (_) {}
      for (const ch of node.children || []) walk(ch);
    } else if (node.nodeType === 11) {
      for (const ch of node.children || []) walk(ch);
    }
  }
  walk(rootEl);
  return out;
}

function resolveLowesColorTileClickTarget(input, stopAncestor) {
  if (!input) return null;
  const doc = input.ownerDocument || document;
  let label = null;
  if (input.id) {
    try {
      label = doc.querySelector(`label[for="${CSS.escape(input.id)}"]`);
    } catch (_) {
      label = doc.querySelector(`label[for="${String(input.id).replace(/"/g, '\\"')}"]`);
    }
  }
  if (!label) label = input.closest('label');
  const rectOk = (el) => {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 20 && r.height >= 20;
  };
  if (label && isVisible(label) && rectOk(label)) {
    return label;
  }
  let cur = input.parentElement;
  for (let d = 0; d < 10 && cur && cur !== stopAncestor; d++) {
    if (cur !== input && isVisible(cur) && rectOk(cur)) {
      return cur;
    }
    cur = cur.parentElement;
  }
  if (isVisible(input) && rectOk(input)) return input;
  return label || input.parentElement || null;
}

/** Color picker wrapper from Lowe's PDP: <div id="colorId" data-testid="colorId"> */
async function pickColorFromColorIdContainer() {
  const box = document.querySelector('#colorId, [data-testid="colorId"]');
  if (!box) return null;
  box.scrollIntoView({ block: 'center', behavior: 'smooth' });
  await pauseAwareSleep(450);

  const inputs = queryRadiosUnderElement(box).filter((inp) => inp && !inp.disabled && !isLikelyInfoOrHelpControl(inp));
  const cands = [];
  for (const input of inputs) {
    const clickEl = resolveLowesColorTileClickTarget(input, box);
    if (!clickEl) continue;
    const tid = (input.getAttribute('data-testid') || '').replace(/^ecp-button-select-/i, '');
    const slug = tid.replace(/_/g, ' ').trim().slice(0, 80);
    const name =
      getElementColorLabel(clickEl) ||
      getElementColorLabel(input.closest('[class*="swatch" i], [class*="color" i]')) ||
      slug ||
      'Color';
    cands.push({ el: clickEl, name, input });
  }

  function walkRoleRadio(node) {
    const out = [];
    if (!node) return out;
    if (node.nodeType === 1) {
      try {
        if (node.matches?.('[role="radio"]') && isVisible(node)) out.push(node);
      } catch (_) {}
      try {
        if (node.shadowRoot) out.push(...walkRoleRadio(node.shadowRoot));
      } catch (_) {}
      for (const ch of node.children || []) out.push(...walkRoleRadio(ch));
    } else if (node.nodeType === 11) {
      for (const ch of node.children || []) out.push(...walkRoleRadio(ch));
    }
    return out;
  }
  if (cands.length < 1) {
    for (const el of walkRoleRadio(box)) {
      if (isLikelyInfoOrHelpControl(el)) continue;
      const name = getElementColorLabel(el) || (el.textContent || '').trim().slice(0, 80) || 'Color';
      cands.push({ el, name, input: null });
    }
  }

  if (cands.length < 1) return null;
  const pick = cands[Math.floor(Math.random() * cands.length)];
  pick.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  await pauseAwareSleep(350);
  pick.el.click();
  await pauseAwareSleep(400);
  if (pick.input && !pick.input.checked) {
    try {
      pick.input.click();
    } catch (_) {}
    await pauseAwareSleep(400);
  }
  await pauseAwareSleep(400);
  return pick.name;
}

/** Lowe's ECP: color as tile radios, e.g. input.tile-input-radio[data-testid^="ecp-button-select-"]. */
async function pickColorFromEcpTileRadios() {
  const seen = new Set();
  const inputs = [];
  const add = (el) => {
    if (!el || seen.has(el)) return;
    seen.add(el);
    inputs.push(el);
  };
  const root = configuratorRoot();
  root.querySelectorAll('input.tile-input-radio[type="radio"][data-testid^="ecp-button-select-"]').forEach(add);
  root
    .querySelectorAll('input.tile-input-radio[type="radio"], input.backyard.radio[type="radio"], input.radio.tile-input-radio[type="radio"]')
    .forEach(add);
  querySelectorAllDeep('input.tile-input-radio[type="radio"][data-testid^="ecp-button-select-"]', root).forEach(add);
  querySelectorAllDeep('input.tile-input-radio[type="radio"]', root).forEach(add);

  const cands = [];
  for (const input of inputs) {
    if (!input || input.disabled) continue;
    if (isLikelyInfoOrHelpControl(input)) continue;
    const tidRaw = input.getAttribute('data-testid') || '';
    if (/^ecp-button-select-/i.test(tidRaw)) {
      const suf = ecpButtonSelectSuffix(input);
      if (
        isEcpLiftTileSuffix(suf) ||
        isEcpCassetteSuffix(suf) ||
        isEcpValanceStyleSuffix(suf) ||
        isEcpHeadrailBlindsSuffix(suf) ||
        isEcpSideChannelSuffix(suf)
      ) {
        continue;
      }
    }
    const clickTarget = resolveLowesColorTileClickTarget(input, document.documentElement);
    if (!clickTarget) continue;
    const tid = tidRaw.replace(/^ecp-button-select-/i, '');
    const slug = tid.replace(/_/g, ' ').trim().slice(0, 80);
    const name =
      getElementColorLabel(clickTarget) ||
      getElementColorLabel(input.closest('[class*="swatch" i], [class*="color" i]')) ||
      slug ||
      'Color';
    cands.push({ el: clickTarget, name, input });
  }
  if (cands.length < 1) return null;
  const pick = cands[Math.floor(Math.random() * cands.length)];
  pick.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  await pauseAwareSleep(350);
  pick.el.click();
  await pauseAwareSleep(400);
  if (pick.input && !pick.input.checked) {
    try {
      pick.input.click();
    } catch (_) {}
    await pauseAwareSleep(400);
  }
  await pauseAwareSleep(400);
  return pick.name;
}

async function pickColorFromCombobox() {
  const root = configuratorRoot();
  const triggers = new Set([
    ...root.querySelectorAll(
      '[role="combobox"], [aria-haspopup="listbox"], button[aria-expanded][aria-controls], [data-testid*="combobox" i]'
    ),
    ...querySelectorAllDeep('[role="combobox"]', document.documentElement)
  ]);
  for (const combo of triggers) {
    if (!combo || !isVisible(combo)) continue;
    if (isLikelyInfoOrHelpControl(combo)) continue;
    if (combo.closest('[role="dialog"], [aria-modal="true"]')) continue;
    const aria = `${combo.getAttribute('aria-label') || ''} ${combo.getAttribute('placeholder') || ''}`.toLowerCase();
    const block = (combo.closest('div, section, li, fieldset, tr')?.textContent || '').slice(0, 450).toLowerCase();
    const blob = `${aria} ${block}`;
    const isColorish =
      /color|fabric|finish|shade|swatch|paint|wood.?tone|material color/i.test(blob) &&
      !/filter\s+by|sort\s+by/i.test(blob);
    if (!isColorish) continue;
    if (
      /\b(opacity|mount|width|height|quantity|cell size|headrail|lift)\b/i.test(block) &&
      !/\b(color|fabric|swatch|shade|finish)\b/i.test(aria)
    ) {
      continue;
    }
    combo.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await pauseAwareSleep(400);
    combo.click();
    await pauseAwareSleep(600);
    let options = [];
    const listboxes = document.querySelectorAll('[role="listbox"]');
    for (const lb of listboxes) {
      if (!isVisible(lb)) continue;
      const opts = [...lb.querySelectorAll('[role="option"], [role="menuitem"], [role="menuitemradio"]')].filter(
        isVisible
      );
      if (opts.length >= 1) {
        options = opts;
        break;
      }
    }
    if (options.length < 1) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await pauseAwareSleep(200);
      continue;
    }
    const pick = options[Math.floor(Math.random() * options.length)];
    pick.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await pauseAwareSleep(280);
    pick.click();
    await pauseAwareSleep(1400);
    return (
      getElementColorLabel(pick) || (pick.textContent || '').trim().split('\n')[0].slice(0, 80) || 'Color'
    );
  }
  return null;
}

async function pickColorFromSelect() {
  const selects = querySelectorAllDeep('select', document.documentElement);
  for (const sel of selects) {
    const meta = `${sel.name || ''} ${sel.id || ''} ${sel.getAttribute('aria-label') || ''}`.toLowerCase();
    if (meta.includes('material') && !meta.includes('color')) continue;
    const near = sel.closest('[class*="color" i], [class*="fabric" i], [data-testid*="color" i], fieldset');
    const nearTxt = (near && (near.textContent || '').slice(0, 400).toLowerCase()) || '';
    const hit =
      meta.includes('color') ||
      meta.includes('fabric') ||
      meta.includes('finish') ||
      nearTxt.includes('color name');
    if (!hit) continue;
    const opts = Array.from(sel.options).filter((o) => {
      if (!o.value) return false;
      const tx = (o.textContent || '').trim();
      if (/^choose|^select|^--|^\.\.\./i.test(tx)) return false;
      return true;
    });
    if (opts.length < 1) continue;
    const pick = opts[Math.floor(Math.random() * opts.length)];
    const name = ((pick.textContent || '').trim() || pick.value).slice(0, 80);
    sel.focus();
    setNativeSelectValue(sel, pick.value);
    await pauseAwareSleep(900);
    return name;
  }
  return null;
}

/** Any select whose real options look like color names (Lowe's sometimes omits "color" in name/id). */
async function pickColorFromSelectByOptionText() {
  const selects = new Set([
    ...configuratorRoot().querySelectorAll('select'),
    ...querySelectorAllDeep('select', document.documentElement)
  ]);
  for (const sel of selects) {
    if (!isVisible(sel)) continue;
    if (isLikelyDimensionSelect(sel)) continue;
    const meta = `${sel.name || ''} ${sel.id || ''} ${sel.getAttribute('aria-label') || ''}`.toLowerCase();
    if (meta.includes('width') || meta.includes('height')) continue;
    const opts = Array.from(sel.options).filter((o) => {
      if (!o.value) return false;
      const tx = (o.textContent || '').trim();
      if (/^choose|^select|^--|^\.\.\./i.test(tx)) return false;
      return looksLikeColorNameText(tx);
    });
    if (opts.length < 1) continue;
    const pick = opts[Math.floor(Math.random() * opts.length)];
    const name = ((pick.textContent || '').trim() || pick.value).slice(0, 80);
    sel.focus();
    setNativeSelectValue(sel, pick.value);
    await pauseAwareSleep(900);
    return name;
  }
  return null;
}

async function pickColorFromListbox() {
  for (const lb of document.querySelectorAll('[role="listbox"]')) {
    if (!isVisible(lb)) continue;
    if (lb.closest('nav, header, footer, [class*="cart" i], [role="dialog"], [aria-modal="true"]')) continue;
    let blob = '';
    const labelledBy = lb.getAttribute('aria-labelledby');
    if (labelledBy) {
      for (const id of labelledBy.split(/\s+/)) {
        const n = document.getElementById(id);
        if (n) blob += `${n.textContent || ''} `;
      }
    }
    const owner = lb.closest('section, [class*="option" i], fieldset, div');
    const heading = owner?.querySelector('h2, h3, h4, h5, legend');
    if (heading) blob += `${heading.textContent || ''} `;
    const lower = blob.toLowerCase();
    if (/\bopacity\b/.test(lower)) continue;
    if (!/(color|finish|fabric|shade|slat)/.test(lower)) continue;
    if (/(width|height|quantity)/.test(lower) && !/(color|finish|fabric|shade)/.test(lower)) continue;
    const opts = [...lb.querySelectorAll('[role="option"]')].filter(isVisible);
    if (opts.length < 2) continue;
    const pick = opts[Math.floor(Math.random() * opts.length)];
    const name = getElementColorLabel(pick) || (pick.textContent || '').trim().slice(0, 80) || 'Option';
    pick.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await pauseAwareSleep(350);
    pick.click();
    await pauseAwareSleep(1200);
    return name;
  }
  return null;
}

async function pickColorRadioOrRole() {
  const tryClick = async (el, nameGuess) => {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await pauseAwareSleep(350);
    el.click();
    await pauseAwareSleep(1200);
    return nameGuess || 'Color option';
  };

  const radios = document.querySelectorAll('input[type="radio"]');
  const radioCand = [];
  for (const r of radios) {
    const meta = `${r.name || ''} ${r.id || ''} ${r.getAttribute('aria-label') || ''}`.toLowerCase();
    if (!meta.includes('color') && !meta.includes('fabric') && !meta.includes('finish')) continue;
    let label = null;
    if (r.id) {
      try {
        label = document.querySelector(`label[for="${CSS.escape(r.id)}"]`);
      } catch (_) {
        label = document.querySelector(`label[for="${r.id.replace(/"/g, '\\"')}"]`);
      }
    }
    if (!label) label = r.closest('label');
    const clickTarget = label && isVisible(label) ? label : r;
    if (!isVisible(clickTarget)) continue;
    const name =
      getElementColorLabel(label) ||
      getElementColorLabel(r.closest('[class*="swatch" i], [class*="color" i]')) ||
      (r.getAttribute('value') || '');
    radioCand.push({ el: clickTarget, name });
  }
  if (radioCand.length >= 1) {
    const pick = radioCand[Math.floor(Math.random() * radioCand.length)];
    return tryClick(pick.el, pick.name || null);
  }

  const roleRadios = document.querySelectorAll('[role="radio"]');
  const roleCand = [];
  for (const el of roleRadios) {
    if (!isVisible(el)) continue;
    if (el.closest('header, nav, [class*="cart" i], [class*="payment" i]')) continue;
    const inColor = el.closest(
      '[class*="color" i], [class*="swatch" i], [class*="fabric" i], [class*="option" i], [data-testid*="color" i], [data-testid*="swatch" i]'
    );
    const meta = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('name') || ''}`.toLowerCase();
    const inMain = el.closest('main, [role="main"], [class*="configur" i]');
    if (!inColor && !(inMain && /color|fabric|swatch|finish|shade/i.test(meta))) continue;
    const name = getElementColorLabel(el);
    roleCand.push({ el, name: name || 'Swatch' });
  }
  if (roleCand.length >= 1) {
    const pick = roleCand[Math.floor(Math.random() * roleCand.length)];
    return tryClick(pick.el, pick.name);
  }
  return null;
}

async function pickLowesCompoundSwatch() {
  const compound =
    /\b(iron|daylight|nickel|barley|pebble|granite|canvas|linen|snow|mist|walnut|oak|cherry|espresso|natural)\s+[A-Za-z][A-Za-z-]+/i;
  const nodes = document.querySelectorAll(
    'li, button, div[role="button"], [role="option"], span[tabindex="0"], div[tabindex="0"]'
  );
  const candidates = [];
  for (const el of nodes) {
    if (!isVisible(el)) continue;
    if (isLikelyInfoOrHelpControl(el)) continue;
    if (el.closest('nav, header, footer, [class*="cart" i], [role="dialog"], [aria-modal="true"]')) continue;
    const t = (el.textContent || '').trim().replace(/\s+/g, ' ');
    if (t.length < 6 || t.length > 100) continue;
    if (!compound.test(t) && !/\b(toulouse|bellamy)\b/i.test(t)) continue;
    if (
      !el.closest(
        'main, [class*="configur" i], [class*="product-detail" i], [id*="product" i], [class*="customize" i], [class*="option" i]'
      )
    ) {
      continue;
    }
    candidates.push({ el, name: t.split('\n')[0].trim().slice(0, 96) });
  }
  if (candidates.length === 0) return null;
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  pick.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  await pauseAwareSleep(450);
  pick.el.click();
  await pauseAwareSleep(1800);
  return pick.name;
}

async function pickConfiguratorColorChips() {
  const root = configuratorRoot();
  const nodes = root.querySelectorAll(
    'button, [role="button"], div[tabindex="0"], li[tabindex="0"], span[tabindex="0"]'
  );
  const candidates = [];
  for (const el of nodes) {
    if (!isVisible(el)) continue;
    if (isLikelyInfoOrHelpControl(el)) continue;
    if (el.closest('nav, header, footer, [class*="cart" i], [role="dialog"], [aria-modal="true"]')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 18 || r.width > 96 || r.height < 18 || r.height > 96) continue;
    const ar = r.width / r.height;
    if (ar < 0.72 || ar > 1.4) continue;
    const cs = getComputedStyle(el);
    const hasBg = cs.backgroundImage && cs.backgroundImage !== 'none';
    const hasChildImg = el.querySelector('img');
    const cls = elementClassString(el).toLowerCase();
    const aria = (el.getAttribute('aria-label') || '').toLowerCase();
    const looksChip =
      hasBg ||
      hasChildImg ||
      /\b(swatch|chip|tile|thumbnail|variant|color|fabric)\b/.test(cls) ||
      /\b(color|fabric|finish)\b/.test(aria);
    if (!looksChip) continue;
    const t = (el.textContent || '').trim();
    if (t.length > 100) continue;
    const name = getElementColorLabel(el) || t.split('\n')[0].trim().slice(0, 80) || 'Chip';
    candidates.push({ el, name });
  }
  if (candidates.length === 0) return null;
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  pick.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  await pauseAwareSleep(400);
  pick.el.click();
  await pauseAwareSleep(1800);
  return pick.name;
}

async function pickColorSwatch() {
  const excludePatterns = ['credit', 'card', 'payment', 'checkout', 'cart', 'sign in', 'login'];
  const swatches = [];

  const consider = (el) => {
    if (!isVisible(el)) return;
    if (isLikelyInfoOrHelpControl(el)) return;
    if (el.closest('header, nav, footer, [class*="cart" i], [class*="checkout" i]')) return;
    const className = elementClassString(el).toLowerCase();
    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
    const text = (el.textContent || '').trim();
    if (excludePatterns.some((p) => text.toLowerCase().includes(p) || ariaLabel.includes(p))) return;

    const inColorRegion = el.closest(
      '[class*="color" i], [class*="swatch" i], [class*="fabric" i], [class*="finish" i], [data-testid*="color" i], [data-testid*="swatch" i], fieldset[class*="option" i]'
    );
    const looksLikeTile =
      className.includes('swatch') ||
      className.includes('color-chip') ||
      ariaLabel.includes('color') ||
      ariaLabel.includes('fabric') ||
      inColorRegion;

    const hasImg =
      el.querySelector('img') ||
      (el.style && el.style.backgroundImage && el.style.backgroundImage !== 'none') ||
      (getComputedStyle(el).backgroundImage && getComputedStyle(el).backgroundImage !== 'none');

    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor;
    const hasSolidFill =
      bg &&
      bg !== 'rgba(0, 0, 0, 0)' &&
      bg !== 'transparent' &&
      !bg.startsWith('rgba(0, 0, 0, 0');

    const r = el.getBoundingClientRect();
    const smallish = r.width >= 6 && r.width <= 200 && r.height >= 6 && r.height <= 200;

    const name = getElementColorLabel(el);
    const nameOk = name && looksLikeColorNameText(name);

    if (nameOk && looksLikeTile) {
      swatches.push({ name: name.split('\n')[0].trim(), el });
      return;
    }
    if (looksLikeTile && (hasImg || (hasSolidFill && smallish))) {
      swatches.push({ name: name ? name.split('\n')[0].trim() : 'Swatch', el });
    }
  };

  document
    .querySelectorAll(
      'button, [role="button"], [role="option"], li, div[role="gridcell"], [role="gridcell"], div[tabindex="0"]'
    )
    .forEach(consider);

  if (swatches.length === 0) return null;
  const pick = swatches[Math.floor(Math.random() * swatches.length)];
  pick.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  await pauseAwareSleep(400);
  pick.el.click();
  await pauseAwareSleep(2000);
  return pick.name;
}

async function fallbackColorClick() {
  const colorNames = [
    'Iron Toulouse',
    'Daylight Bellamy',
    'Cream',
    'Granite',
    'Ivory',
    'White',
    'Pebble',
    'Beige',
    'Gray',
    'Grey',
    'Black',
    'Brown',
    'Natural',
    'Walnut',
    'Snow',
    'Linen',
    'Canvas',
    'Toulouse',
    'Bellamy',
    'Iron',
    'Nickel',
    'Daylight',
    'Barley',
    'Alabaster',
    'Espresso'
  ];
  const root = configuratorRoot();
  const clickables = root.querySelectorAll(
    'button, a, div[role="button"], [role="radio"], [role="option"], span[role="button"], li[role="option"]'
  );
  const list = [...clickables].filter(
    (el) => isVisible(el) && !isLikelyInfoOrHelpControl(el) && !el.closest('header, nav, [class*="cart" i], [role="dialog"]')
  );
  for (const colorName of colorNames) {
    const esc = colorName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(esc.replace(/\s+/g, '\\s+'), 'i');
    for (const el of list) {
      const text = el.textContent || '';
      const aria = el.getAttribute('aria-label') || '';
      const title = el.getAttribute('title') || '';
      if (!re.test(text) && !re.test(aria) && !re.test(title)) continue;
      try {
        el.scrollIntoView({ block: 'center' });
        await pauseAwareSleep(220);
        el.click();
        await pauseAwareSleep(2000);
        return colorName;
      } catch (_) {}
    }
  }
  return null;
}

function extractPricesFromDom() {
  const priceData = { original_price: null, promotional_price: null };
  const priceElements = [];
  const priceContainers = document.querySelectorAll(
    'h1, h2, h3, h4, h5, h6, [class*="price"], [class*="Price"], [data-testid*="price"]'
  );

  priceContainers.forEach((el) => {
    const text = el.textContent || '';
    const priceMatches = text.match(/\$[\d,]+\.?\d*/g);
    if (!priceMatches) return;
    priceMatches.forEach((match) => {
      const priceValue = parseFloat(match.replace(/[$,]/g, ''));
      if (priceValue <= 5 || priceValue >= 100000) return;
      const style = window.getComputedStyle(el);
      const isStruck =
        style.textDecoration.includes('line-through') ||
        el.closest('s, strike') !== null ||
        el.className.toString().toLowerCase().includes('original') ||
        el.className.toString().toLowerCase().includes('was');
      const fontSize = parseFloat(style.fontSize);
      const fontWeight = parseInt(style.fontWeight, 10) || 400;
      const isLarge = fontSize >= 14 || fontWeight >= 500;
      const fullText = el.textContent || '';
      const isSaveText =
        /Save\s+\$[\d,]+\.?\d*/i.test(fullText) && fullText.toLowerCase().includes('save') && !isLarge;
      if (!isSaveText) {
        priceElements.push({ value: priceValue, isStruck, isLarge, fontSize, fontWeight });
      }
    });
  });

  const uniquePriceElements = [];
  const seen = new Set();
  priceElements.forEach((p) => {
    const key = `${p.value}-${p.isStruck}-${p.isLarge}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniquePriceElements.push(p);
    }
  });

  const struckPrices = uniquePriceElements.filter((p) => p.isStruck);
  const nonStruckPrices = uniquePriceElements.filter((p) => !p.isStruck);
  const allPrices = [...new Set(uniquePriceElements.map((p) => p.value))].sort((a, b) => b - a);

  if (allPrices.length === 2) {
    if (struckPrices.length === 1) {
      priceData.original_price = struckPrices[0].value;
      priceData.promotional_price =
        nonStruckPrices.find((p) => p.value !== struckPrices[0].value)?.value || allPrices[1];
    } else {
      priceData.original_price = allPrices[0];
      priceData.promotional_price = allPrices[1];
    }
  } else if (struckPrices.length > 0) {
    priceData.original_price = Math.max(...struckPrices.map((p) => p.value));
    if (nonStruckPrices.length > 0) {
      const sortedNonStruck = nonStruckPrices.sort((a, b) => {
        if (a.isLarge && !b.isLarge) return -1;
        if (!a.isLarge && b.isLarge) return 1;
        if (a.fontSize !== b.fontSize) return b.fontSize - a.fontSize;
        return b.fontWeight - a.fontWeight;
      });
      priceData.promotional_price = sortedNonStruck[0].value;
    } else if (allPrices.length > 1) {
      priceData.promotional_price = allPrices[allPrices.length - 1];
    }
  } else if (nonStruckPrices.length > 0) {
    if (allPrices.length >= 2) {
      priceData.original_price = allPrices[0];
      priceData.promotional_price = allPrices[1];
    } else if (allPrices.length === 1) {
      priceData.promotional_price = allPrices[0];
      priceData.original_price = allPrices[0];
    }
  }

  if (allPrices.length === 1 && !priceData.promotional_price) {
    priceData.promotional_price = allPrices[0];
    if (!priceData.original_price) priceData.original_price = allPrices[0];
  }

  if (priceData.original_price && priceData.promotional_price) {
    if (priceData.original_price < priceData.promotional_price) {
      const t = priceData.original_price;
      priceData.original_price = priceData.promotional_price;
      priceData.promotional_price = t;
    }
    if (Math.abs(priceData.original_price - priceData.promotional_price) < 0.01) {
      priceData.original_price = priceData.promotional_price;
    }
  }

  return priceData;
}

function extractPricesRetry() {
  const priceData = { original_price: null, promotional_price: null };
  const priceElements = [];
  document.querySelectorAll('h1, h2, h3, h4, h5, h6, [class*="price"], [class*="Price"]').forEach((el) => {
    const text = el.textContent || '';
    const priceMatches = text.match(/\$[\d,]+\.?\d*/g);
    if (!priceMatches) return;
    priceMatches.forEach((match) => {
      const priceValue = parseFloat(match.replace(/[$,]/g, ''));
      if (priceValue <= 5 || priceValue >= 100000) return;
      const style = window.getComputedStyle(el);
      const isStruck = style.textDecoration.includes('line-through');
      const fullText = text.toLowerCase();
      const isSaveText = fullText.includes('save') && /save\s+\$[\d,]+\.?\d*/i.test(text);
      if (!isSaveText) priceElements.push({ value: priceValue, isStruck });
    });
  });
  const uniquePrices = [...new Set(priceElements.map((p) => p.value))].sort((a, b) => b - a);
  const struckPrices = priceElements.filter((p) => p.isStruck).map((p) => p.value);
  if (uniquePrices.length >= 2) {
    if (struckPrices.length > 0) {
      priceData.original_price = Math.max(...struckPrices);
      priceData.promotional_price = uniquePrices.find((p) => !struckPrices.includes(p)) || uniquePrices[1];
    } else {
      priceData.original_price = uniquePrices[0];
      priceData.promotional_price = uniquePrices[1];
    }
  } else if (uniquePrices.length === 1) {
    priceData.promotional_price = uniquePrices[0];
    priceData.original_price = uniquePrices[0];
  }
  return priceData;
}

function normalizedColorLine(s) {
  if (s == null || s === '') return '';
  return String(s)
    .trim()
    .split(/\n/)[0]
    .trim()
    .toLowerCase();
}

function colorLabelsMatch(savedRaw, optionText) {
  const a = normalizedColorLine(savedRaw);
  const b = normalizedColorLine(optionText);
  if (!a || !b) return false;
  if (a === b) return true;
  if (b.includes(a) || a.includes(b)) return true;
  const words = a.split(/\s+/).filter((w) => w.length > 2);
  if (words.length && words.every((w) => b.includes(w))) return true;
  return false;
}

/** Try to pick a color control whose label matches a previously saved result color. */
async function selectColorBySavedName(savedColor) {
  const needle = normalizedColorLine(savedColor);
  if (!needle) return false;
  await tryExpandColorSection();
  const selects = new Set([
    ...configuratorRoot().querySelectorAll('select'),
    ...querySelectorAllDeep('select', document.documentElement)
  ]);
  for (const sel of selects) {
    if (!isVisible(sel)) continue;
    if (isLikelyDimensionSelect(sel)) continue;
    const meta = `${sel.name || ''} ${sel.id || ''} ${sel.getAttribute('aria-label') || ''}`.toLowerCase();
    if (meta.includes('width') || meta.includes('height')) continue;
    const opts = Array.from(sel.options).filter((o) => {
      if (!o.value) return false;
      const tx = (o.textContent || '').trim();
      if (/^choose|^select|^--|^\.\.\./i.test(tx)) return false;
      return true;
    });
    for (const o of opts) {
      const tx = (o.textContent || '').trim();
      if (!colorLabelsMatch(savedColor, tx)) continue;
      sel.focus();
      setNativeSelectValue(sel, o.value);
      await pauseAwareSleep(900);
      return true;
    }
  }
  for (const lb of document.querySelectorAll('[role="listbox"]')) {
    if (!isVisible(lb)) continue;
    if (lb.closest('nav, header, footer, [class*="cart" i], [role="dialog"], [aria-modal="true"]')) continue;
    const opts = [...lb.querySelectorAll('[role="option"]')].filter(isVisible);
    for (const opt of opts) {
      const name = getElementColorLabel(opt) || (opt.textContent || '').trim();
      if (!colorLabelsMatch(savedColor, name)) continue;
      opt.scrollIntoView({ block: 'center', behavior: 'instant' });
      await pauseAwareSleep(200);
      opt.click();
      await pauseAwareSleep(900);
      return true;
    }
  }
  for (const r of document.querySelectorAll('input[type="radio"]')) {
    const meta = `${r.name || ''} ${r.id || ''} ${r.getAttribute('aria-label') || ''}`.toLowerCase();
    if (!meta.includes('color') && !meta.includes('fabric') && !meta.includes('finish')) continue;
    let label = null;
    if (r.id) {
      try {
        label = document.querySelector(`label[for="${CSS.escape(r.id)}"]`);
      } catch (_) {
        label = document.querySelector(`label[for="${String(r.id).replace(/"/g, '\\"')}"]`);
      }
    }
    if (!label) label = r.closest('label');
    const blob = `${r.getAttribute('aria-label') || ''} ${(label && label.textContent) || ''}`;
    if (!colorLabelsMatch(savedColor, blob)) continue;
    const clickTarget = label && isVisible(label) ? label : r;
    if (!isVisible(clickTarget)) continue;
    clickTarget.scrollIntoView({ block: 'center', behavior: 'instant' });
    await pauseAwareSleep(200);
    clickTarget.click();
    await pauseAwareSleep(900);
    return true;
  }
  return false;
}

async function tryPickColorAny() {
  await tryExpandColorSection();
  return (
    (await pickColorFromColorIdContainer()) ||
    (await pickColorFromEcpTileRadios()) ||
    (await pickColorFromCombobox()) ||
    (await pickColorFromSelect()) ||
    (await pickColorFromSelectByOptionText()) ||
    (await pickColorFromListbox()) ||
    (await pickColorRadioOrRole()) ||
    (await pickLowesCompoundSwatch()) ||
    (await pickConfiguratorColorChips()) ||
    (await pickColorSwatch()) ||
    (await fallbackColorClick())
  );
}

/**
 * Re-open customize, set width/height/color from a saved result row, then prepare for screenshot.
 * Used by “Capture webpage” so the shot matches the card, not whatever was on screen.
 */
async function applySavedResultForScreenshot(config) {
  await stopGuard();
  if (isAccessDenied()) {
    throw new Error('Access denied — open the product in this tab and retry.');
  }
  window.scrollTo(0, 0);
  await pauseAwareSleep(400);
  await clickCustomize();
  await pauseAwareSleep(2200);
  await dismissLowesOverlays(8);

  const w = parseInt(String(config.width ?? ''), 10);
  const h = parseInt(String(config.height ?? ''), 10);
  if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
    await selectWidthHeight(w, h);
    await pauseAwareSleep(3200);
  }
  await dismissLowesOverlays(6);
  const matLabel = await pickMaterialStyleFromSelect();
  if (!matLabel) await pickMaterialFromFieldset();
  await pauseAwareSleep(800);
  await dismissLowesOverlays(6);

  if (config.color) {
    const picked = await selectColorBySavedName(String(config.color));
    if (!picked) {
      await pauseAwareSleep(600);
      await dismissLowesOverlays(4);
      await tryExpandColorSection();
      await selectColorBySavedName(String(config.color));
    }
    await pauseAwareSleep(1800);
  }
  await dismissLowesOverlays(6);

  await selectBlindsPerHeadrailPreferred();
  await pauseAwareSleep(700);
  await dismissLowesOverlays(6);

  await selectLiftOptionPreferred();
  await waitForLiftSelectionApplied();
  await pauseAwareSleep(400);
  await dismissLowesOverlays(6);

  await selectValanceStyleAndOptionalCassetteSize();
  await pauseAwareSleep(700);
  await dismissLowesOverlays(6);

  await selectSideChannelsPreferred();
  await pauseAwareSleep(700);
  await dismissLowesOverlays(6);

  await prepareForFullPageScreenshot();
  await pauseAwareSleep(500);
  window.scrollTo(0, 0);
  applyFullPageScrollY(0);
  await pauseAwareSleep(300);
  return { ok: true };
}

async function runTest(product) {
  await stopGuard();
  if (isAccessDenied()) {
    throw new Error('Access denied — open the product in this tab and retry.');
  }

  await pauseAwareSleep(1500);
  window.scrollTo(0, 0);
  await pauseAwareSleep(500);
  await stopGuard();

  await clickCustomize();
  await pauseAwareSleep(1500);
  await stopGuard();

  try {
    window.scrollTo(0, Math.random() * 800);
    await pauseAwareSleep(500 + Math.random() * 500);
    window.scrollTo(0, Math.random() * 400);
    await pauseAwareSleep(400);
  } catch (_) {}

  const w = Math.floor(Math.random() * (84 - 18 + 1)) + 18;
  const h = Math.floor(Math.random() * (84 - 16 + 1)) + 16;
  await selectWidthHeight(w, h);
  await pauseAwareSleep(3500 + Math.random() * 2500);
  await stopGuard();

  await dismissLowesOverlays(6);
  const matLabel = await pickMaterialStyleFromSelect();
  if (!matLabel) await pickMaterialFromFieldset();
  await pauseAwareSleep(1200);
  await dismissLowesOverlays(6);

  let color = await tryPickColorAny();
  if (!color) {
    await pauseAwareSleep(1600);
    await dismissLowesOverlays(6);
    await tryExpandColorSection();
    color = await tryPickColorAny();
  }

  await pauseAwareSleep(2500 + Math.random() * 1500);
  await dismissLowesOverlays(6);
  await stopGuard();

  const blinds_per_headrail = await selectBlindsPerHeadrailPreferred();
  await pauseAwareSleep(700);
  await dismissLowesOverlays(6);

  const lift = await selectLiftOptionPreferred();
  await waitForLiftSelectionApplied();
  await pauseAwareSleep(400);
  await dismissLowesOverlays(6);

  const valancePick = await selectValanceStyleAndOptionalCassetteSize();
  const cassette_valance = valancePick.cassette_valance;
  const valance_style = valancePick.valance_style;
  await pauseAwareSleep(700);
  await dismissLowesOverlays(6);

  const side_channels = await selectSideChannelsPreferred();
  await pauseAwareSleep(700);
  await dismissLowesOverlays(6);

  let prices = extractPricesFromDom();
  let original_price = prices.original_price;
  let promotional_price = prices.promotional_price;

  if (!original_price || !promotional_price || promotional_price < 5) {
    await pauseAwareSleep(2500);
    const els = document.querySelectorAll('[class*="price"], [class*="Price"], h5, h4, h3');
    if (els[0]) els[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    await pauseAwareSleep(1500);
    const retry = extractPricesRetry();
    if (retry.original_price && retry.promotional_price) {
      original_price = retry.original_price;
      promotional_price = retry.promotional_price;
    }
  }

  let promo_percentage = null;
  if (original_price && promotional_price && original_price > promotional_price) {
    promo_percentage = (((original_price - promotional_price) / original_price) * 100).toFixed(2);
  } else if (original_price === promotional_price) {
    promo_percentage = '0';
  }

  await prepareForFullPageScreenshot();
  await pauseAwareSleep(500);

  return {
    product_id: product.id,
    product_name: formatProductName(product.name || product.model),
    product_url: product.url || window.location.href,
    model: product.model || 'Unknown',
    width: w,
    height: h,
    color: color || null,
    blinds_per_headrail: blinds_per_headrail || null,
    lift: lift || null,
    valance_style: valance_style || null,
    cassette_valance: cassette_valance || null,
    side_channels: side_channels || null,
    original_price,
    promotional_price,
    promo_percentage,
    success: true,
    error: null
  };
}

if (!globalThis.__LOWES_PROMO_TESTER_LISTENER__) {
  globalThis.__LOWES_PROMO_TESTER_LISTENER__ = true;
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'RUN_LOWES_TEST') {
      (async () => {
        try {
          if (isAccessDenied()) {
            throw new Error('Access denied on this page');
          }
          const partial = await runTest(msg.product);
          await pauseAwareSleep(1200);
          sendResponse({ ok: true, partial });
        } catch (e) {
          const errText = e.message || String(e);
          sendResponse({ ok: false, error: errText });
        }
      })();
      return true;
    }
    if (msg.type === 'PING') {
      sendResponse({ ok: true });
      return false;
    }
    if (msg.type === 'PREPARE_SCREENSHOT') {
      (async () => {
        try {
          await prepareForFullPageScreenshot();
          sendResponse({ ok: true });
        } catch (_) {
          sendResponse({ ok: false });
        }
      })();
      return true;
    }
    if (msg.type === 'GET_FULL_PAGE_CAPTURE_METRICS') {
      (async () => {
        try {
          await prepareForFullPageScreenshot();
          await pauseAwareSleep(200);
          const ctx = lastFullPageCaptureContext || findBestScrollContainer();
          lastFullPageCaptureContext = ctx;
          sendResponse({
            ok: true,
            fullHeight: ctx.fullHeight,
            viewHeight: ctx.viewHeight,
            dpr: window.devicePixelRatio || 1,
            scrollMode: ctx.mode
          });
        } catch (_) {
          sendResponse({ ok: false });
        }
      })();
      return true;
    }
    if (msg.type === 'SCROLL_FULL_CAPTURE_Y') {
      (async () => {
        try {
          const y = Math.max(0, Math.round(Number(msg.y) || 0));
          applyFullPageScrollY(y);
          await new Promise((r) => setTimeout(r, 100));
          const ctx = lastFullPageCaptureContext || findBestScrollContainer();
          const reportedY =
            ctx.mode === 'element' && ctx.el ? ctx.el.scrollTop : window.scrollY || window.pageYOffset;
          sendResponse({ ok: true, y: reportedY, scrollMode: ctx.mode });
        } catch (_) {
          sendResponse({ ok: false });
        }
      })();
      return true;
    }
    if (msg.type === 'APPLY_RESULT_FOR_SCREENSHOT') {
      (async () => {
        try {
          if (isAccessDenied()) {
            throw new Error('Access denied on this page');
          }
          await applySavedResultForScreenshot(msg.config || {});
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ ok: false, error: e.message || String(e) });
        }
      })();
      return true;
    }
    return false;
  });
}
