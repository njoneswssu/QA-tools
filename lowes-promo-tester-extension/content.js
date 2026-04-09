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
      sel.value = opt.value;
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
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
        sel.value = opt.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
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
        sel.value = opt.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        await pauseAwareSleep(800);
        break;
      }
    }
  }
}

async function pickColorSwatch() {
  const allElements = Array.from(document.querySelectorAll('button, div[role="button"], [class*="swatch"], [class*="color"]'));
  const swatches = [];

  allElements.forEach((el) => {
    const hasImage =
      el.querySelector('img') ||
      el.style.backgroundImage ||
      getComputedStyle(el).backgroundImage !== 'none';
    if (!hasImage) return;

    const text = (el.textContent || '').trim();
    const className = (el.className || '').toString().toLowerCase();
    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
    const excludePatterns = ['credit', 'center', 'card', 'payment', 'checkout', 'cart', 'filter', 'search', 'sign in', 'login'];
    if (excludePatterns.some((p) => text.toLowerCase().includes(p) || ariaLabel.includes(p))) return;

    if (text && text.length >= 3 && text.length <= 25) {
      const isColorName =
        !text.match(/^\d+$/) &&
        text.split(/\s+/).length <= 3 &&
        !/^(Filter|Search|Select|Choose|View|More|Less)$/i.test(text);
      if (!isColorName) return;
      const parent = el.closest('[class*="color"], [class*="swatch"], [class*="option"]');
      const isInColorArea =
        parent !== null || className.includes('swatch') || className.includes('color') || ariaLabel.includes('color');
      if (isInColorArea) swatches.push({ name: text.split('\n')[0].trim(), el });
    }
  });

  if (swatches.length === 0) return null;
  const pick = swatches[Math.floor(Math.random() * swatches.length)];
  pick.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  await pauseAwareSleep(400);
  pick.el.click();
  await pauseAwareSleep(2000);
  return pick.name;
}

async function fallbackColorClick() {
  const colorNames = ['Cream', 'Granite', 'Ivory', 'White', 'Pebble', 'Beige', 'Gray', 'Black', 'Brown'];
  const clickables = document.querySelectorAll('button, a, div[role="button"]');
  for (const colorName of colorNames) {
    for (const el of Array.from(clickables).slice(0, 120)) {
      const text = el.textContent || '';
      if (text.includes(colorName) && isVisible(el)) {
        try {
          el.scrollIntoView({ block: 'center' });
          await pauseAwareSleep(200);
          el.click();
          await pauseAwareSleep(2000);
          return colorName;
        } catch (_) {}
      }
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

  let color = await pickColorSwatch();
  if (!color) color = await fallbackColorClick();

  await pauseAwareSleep(3500 + Math.random() * 2500);
  await stopGuard();

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

  window.scrollTo(0, 0);
  await pauseAwareSleep(600);

  return {
    product_id: product.id,
    product_name: formatProductName(product.name || product.model),
    product_url: product.url || window.location.href,
    model: product.model || 'Unknown',
    width: w,
    height: h,
    color: color || null,
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
      try {
        const selectors = [
          '[class*="PriceSummary" i]',
          '[class*="price-summary" i]',
          '[data-testid*="price" i]',
          '[class*="Configurator" i]',
          '[class*="configure" i]',
          'main [class*="price" i]',
          '[class*="ProductPricing" i]'
        ];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el && isVisible(el)) {
            el.scrollIntoView({ block: 'center', behavior: 'auto' });
            sendResponse({ ok: true });
            return false;
          }
        }
        const prices = document.querySelectorAll('[class*="price"], [class*="Price"], h5, h4, h3');
        if (prices[0]) prices[0].scrollIntoView({ block: 'center', behavior: 'auto' });
        sendResponse({ ok: true });
      } catch (_) {
        sendResponse({ ok: false });
      }
      return false;
    }
    return false;
  });
}
