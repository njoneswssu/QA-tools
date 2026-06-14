/**
 * Injects `window.__wlPulseAt(clientX, clientY)` on every document load so automated
 * clicks can flash a short-lived ring at the target (see page-organic-pick + latency-core).
 *
 * @param {import('playwright').BrowserContext} context
 */
export async function installClickPulseOnContext(context) {
  await context.addInitScript(() => {
    const w = /** @type {any} */ (window);
    if (w.__wlLatencyPulseInstalled) return;
    w.__wlLatencyPulseInstalled = true;
    const css = document.createElement('style');
    css.textContent = `@keyframes __wlLatencyPulseRing {
      0% { transform: scale(0.55); opacity: 1; }
      100% { transform: scale(2.1); opacity: 0; }
    }`;
    document.documentElement.appendChild(css);
    w.__wlPulseAt = (cx, cy) => {
      const ring = document.createElement('div');
      ring.setAttribute('data-wl-latency-pulse', '1');
      ring.style.cssText = [
        'position:fixed',
        `left:${cx}px`,
        `top:${cy}px`,
        'width:36px',
        'height:36px',
        'margin:-18px 0 0 -18px',
        'border:3px solid #e53935',
        'border-radius:50%',
        'pointer-events:none',
        'z-index:2147483647',
        'box-shadow:0 0 0 3px rgba(229,57,53,0.25)',
        'animation:__wlLatencyPulseRing 0.55s ease-out forwards'
      ].join(';');
      const root = document.body || document.documentElement;
      root.appendChild(ring);
      setTimeout(() => ring.remove(), 600);
    };
  });
}
