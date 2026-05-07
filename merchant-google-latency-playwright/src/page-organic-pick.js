/**
 * Passed to page.evaluate ? must be a single function with no outer scope.
 * Ported from merchant-google-latency-runner/content-google-serp.js
 *
 * @param {string | { merchantName: string; dryRun?: boolean }} arg
 *        Pass `{ merchantName, dryRun: true }` to resolve the organic URL without clicking (for Playwright `page.goto`).
 */
export function pickOrganicAndClickInPage(arg) {
  const merchantName = typeof arg === 'string' ? arg : arg.merchantName;
  const dryRun = typeof arg === 'object' && arg != null && arg.dryRun === true;

  /** Visual hint for recordings: red ring at element center (requires `installClickPulseOnContext`). */
  function pulseClickTarget(el) {
    try {
      if (typeof window.__wlPulseAt !== 'function') return;
      const r = el.getBoundingClientRect();
      if (r.width < 2 && r.height < 2) return;
      window.__wlPulseAt(r.left + r.width / 2, r.top + r.height / 2);
    } catch (_) {
      /* ignore */
    }
  }

  function isWwwGoogleHost(hostname) {
    return /^www\.google\./i.test(hostname || '');
  }

  function tryDismissCookieConsent() {
    const candidates = document.querySelectorAll('button, [role="button"], input[type="submit"]');
    for (const el of candidates) {
      const t = (el.textContent || el.value || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (!t || t.includes('reject all') || t.includes('decline')) continue;
      if (
        t === 'accept all' ||
        t.includes('accept all') ||
        t === 'i agree' ||
        t.includes('alle akzeptieren') ||
        t.includes('tout accepter') ||
        t.includes('aceptar todo') ||
        t === 'got it'
      ) {
        try {
          pulseClickTarget(el);
          el.click();
          return true;
        } catch (_) {
          /* ignore */
        }
      }
    }
    return false;
  }

  function canonicalClickHref(a) {
    const raw = a.getAttribute('href');
    if (!raw || raw.startsWith('#')) return '';
    try {
      const abs = new URL(raw, location.href).href;
      const u = new URL(abs);
      const path = u.pathname;

      if (isWwwGoogleHost(u.hostname) && (path === '/url' || path.endsWith('/url'))) {
        const q = u.searchParams.get('q') || u.searchParams.get('url');
        if (q && /^https?:\/\//i.test(q)) return q;
      }
      return abs;
    } catch {
      return '';
    }
  }

  function isSocialOrProfileHost(hostname) {
    const host = String(hostname || '')
      .replace(/\.$/, '')
      .toLowerCase();
    const base = host.startsWith('www.') ? host.slice(4) : host;
    const roots = [
      'instagram.com',
      'instagr.am',
      'facebook.com',
      'm.facebook.com',
      'l.facebook.com',
      'twitter.com',
      'mobile.twitter.com',
      'x.com',
      'tiktok.com',
      'www.tiktok.com',
      'pinterest.com',
      'linkedin.com',
      'reddit.com',
      'threads.net',
      'snapchat.com'
    ];
    return roots.some((r) => base === r || base.endsWith(`.${r}`));
  }

  function shouldSkipHref(href) {
    if (!href || !/^https?:\/\//i.test(href)) return true;
    try {
      const u = new URL(href);
      const host = u.hostname;

      if (isSocialOrProfileHost(host)) return true;

      if (/googleadservices|googlesyndication|doubleclick|g\.doubleclick/i.test(host)) return true;

      if (isWwwGoogleHost(host)) {
        if (u.pathname.startsWith('/search')) return true;
        if (u.pathname.startsWith('/maps') || host.startsWith('maps.')) return true;
        if (/[?&]adurl=/i.test(u.search)) return true;
        if (/\/aclk/i.test(u.pathname + u.search)) return true;
      }
      return false;
    } catch {
      return true;
    }
  }

  function isSponsoredAnchor(a) {
    const href = a.href || '';
    if (/googleadservices\.com|googlesyndication\.com|doubleclick\.net|g\.doubleclick/i.test(href))
      return true;
    if (/\/aclk\?/i.test(href)) return true;
    if (/google\.[^/]+\/url\?/i.test(href) && /[?&]adurl=/i.test(href)) return true;

    let el = a;
    for (let i = 0; i < 12 && el; i++) {
      const id = el.id || '';
      if (/tads|commercial|pla-|shopping|bottomads/i.test(id)) return true;
      if (el.getAttribute?.('data-text-ad') === '1') return true;
      if (el.classList?.contains('uEierd')) return true;
      el = el.parentElement;
    }
    return false;
  }

  function merchantDomainAffinityBonus(name, clickHref) {
    if (!name || !clickHref) return 0;
    try {
      const host = new URL(clickHref).hostname.replace(/^www\./i, '').toLowerCase();
      const slug = host.replace(/\.(com|net|org|co\.uk|co|io|shop|store)$/i, '');
      const words =
        name
          .toLowerCase()
          .replace(/\u2019/g, "'")
          .replace(/'/g, '')
          .match(/[a-z0-9]{3,}/g) || [];
      let bonus = 0;
      for (const w of words) {
        if (slug.includes(w) || host.includes(`${w}.`)) bonus = Math.max(bonus, 120);
      }
      return bonus;
    } catch {
      return 0;
    }
  }

  function scoreCandidate(a, clickHref, docOrder, name) {
    let score = 1000 - Math.min(docOrder, 999);
    const yu = a.closest('.yuRUbf');
    const firstInYu = yu?.querySelector?.('a[href]');
    if (yu && firstInYu === a) score += 900;

    if (a.querySelector('h3')) score += 500;
    const block = a.closest(
      '.g, .Gx5Zad, .tF2Cxc, .yuRUbf, .srg .g, div[jscontroller][data-hveid]'
    );
    if (block) score += 200;
    const t = (a.innerText || '').trim();
    if (t.length > 80) score -= 50;
    if (/^https?:\/\//i.test(t)) score -= 100;
    if (clickHref.includes('google.') && clickHref.includes('/url?')) score += 50;

    score += merchantDomainAffinityBonus(name, clickHref);
    return score;
  }

  function pickOrganicAnchor(name) {
    const groups = [
      '#rso a[href]',
      '#center_col #rso a[href]',
      '#search #rso a[href]',
      '#center_col #res a[href]',
      '#center_col a[href]',
      '#search a[data-ved][href]'
    ];

    const seenHref = new Set();
    const scored = [];
    let order = 0;

    for (const sel of groups) {
      let nodes;
      try {
        nodes = document.querySelectorAll(sel);
      } catch {
        continue;
      }
      for (const a of nodes) {
        if (a.tagName !== 'A') continue;
        const clickHref = canonicalClickHref(a) || (a.href || '');
        if (!clickHref || seenHref.has(clickHref)) continue;
        if (shouldSkipHref(clickHref)) continue;
        if (isSponsoredAnchor(a)) continue;

        seenHref.add(clickHref);
        const s = scoreCandidate(a, clickHref, order, name);
        scored.push({ anchor: a, clickHref: clickHref, score: s, order });
        order += 1;
      }
    }

    if (!scored.length) return null;

    scored.sort((x, y) => {
      if (y.score !== x.score) return y.score - x.score;
      return x.order - y.order;
    });

    const best = scored[0];
    return { anchor: best.anchor, href: best.clickHref };
  }

  tryDismissCookieConsent();
  const picked = pickOrganicAnchor(merchantName);
  if (!picked) return null;
  if (dryRun) return picked.href;
  try {
    picked.anchor.scrollIntoView({ block: 'center', behavior: 'auto' });
  } catch (_) {
    /* ignore */
  }
  try {
    pulseClickTarget(picked.anchor);
    picked.anchor.click();
  } catch (_) {
    /* ignore */
  }
  return picked.href;
}
