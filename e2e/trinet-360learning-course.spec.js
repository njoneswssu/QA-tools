// @ts-check
/**
 * Trinet PEO / 360Learning course automation (videos, Next, questions).
 * The lesson UI is served from OpenSesame (player.opensesame.com) inside an iframe; interactions
 * are scoped there first, with waits while that frame loads.
 *
 * Required env:
 *   TRINET_360_EMAIL
 *   TRINET_360_PASSWORD
 *
 * Optional env:
 *   TRINET_COURSE_URL — open this after login (deep link to the course or lesson).
 *   TRINET_MAX_STEPS — max Next/Submit advances (default 800).
 *   TRINET_VIDEO_SPEED — number, e.g. 2 or 4 to set HTML5 video playbackRate in the player frame (default 1).
 *   TRINET_PAUSE_AFTER_LOGIN — set to "1" to call page.pause() after login for manual navigation to the course.
 *   TRINET_OPENSESAME_FRAME_TIMEOUT_MS — wait for player.opensesame.com iframe (default 120000).
 *   TRINET_OPENSESAME_SETTLE_MS — extra ms after iframe appears before driving Next (default 2500).
 *
 * Run from repo root:
 *   TRINET_360_EMAIL=you@example.com TRINET_360_PASSWORD=secret npx playwright test e2e/trinet-360learning-course.spec.js
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = 'https://trinet-peo.360learning.com/';

/** Embedded SCORM / OpenSesame player origin (iframe URL on the course page). */
const OPENSESAME_URL_RE = /player\.opensesame\.com/i;

/**
 * @param {import('@playwright/test').Frame} frame
 */
function isOpenSesameFrame(frame) {
  try {
    return OPENSESAME_URL_RE.test(frame.url());
  } catch {
    return false;
  }
}

/**
 * @param {import('@playwright/test').Page} page
 */
function openSesameFrames(page) {
  return page.frames().filter((f) => !f.isDetached() && isOpenSesameFrame(f));
}

/**
 * OpenSesame iframes first, then other frames, then the 360Learning top page.
 * @param {import('@playwright/test').Page} page
 */
function prioritizedContexts(page) {
  /** @type {import('@playwright/test').Page | import('@playwright/test').Frame} */
  const ordered = [];
  /** @type {import('@playwright/test').Frame[]} */
  const rest = [];
  for (const frame of page.frames()) {
    if (frame.isDetached()) continue;
    if (isOpenSesameFrame(frame)) ordered.push(frame);
    else rest.push(frame);
  }
  return [...ordered, ...rest, page];
}

/**
 * Wait until the OpenSesame player iframe exists (can appear several seconds after the shell loads).
 * @param {import('@playwright/test').Page} page
 * @param {{ timeoutMs?: number, required?: boolean }} opts
 * @returns {Promise<import('@playwright/test').Frame | null>}
 */
async function waitForOpenSesameFrame(page, opts = {}) {
  const timeoutMs =
    opts.timeoutMs ??
    (Number(process.env.TRINET_OPENSESAME_FRAME_TIMEOUT_MS || '120000') || 120000);
  const required = opts.required ?? false;

  try {
    await expect
      .poll(
        () => openSesameFrames(page).length > 0,
        {
          message: 'Waiting for OpenSesame player iframe (player.opensesame.com)',
          timeout: timeoutMs,
          intervals: [300, 500, 1000, 2000, 3000],
        }
      )
      .toBeTruthy();
  } catch (e) {
    if (required) throw e;
    return null;
  }

  const frames = openSesameFrames(page);
  for (const f of frames) {
    await f.waitForLoadState('domcontentloaded').catch(() => {});
  }
  return frames[0] ?? null;
}

/** @param {import('@playwright/test').Page} page */
async function login360Learning(page) {
  const email = process.env.TRINET_360_EMAIL='caliremotework';
  const password = process.env.TRINET_360_PASSWORD='komxi9-sadgAq-zasram';
  if (!email || !password) {
    throw new Error(
      'Set TRINET_360_EMAIL and TRINET_360_PASSWORD in the environment before running this test.'
    );
  }

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

  const emailField = page
    .locator(
      'input[type="email"], input[name*="email" i], input[id*="email" i], input[autocomplete="username"], input[placeholder*="mail" i]'
    )
    .first();
  await emailField.waitFor({ state: 'visible', timeout: 30000 });
  await emailField.fill(email);

  const passwordField = page.locator('input[type="password"]').first();
  await passwordField.waitFor({ state: 'visible', timeout: 15000 });
  await passwordField.fill(password);

  const loginClicked =
    (await tryClick(
      page.getByRole('button', { name: /sign\s*in|log\s*in|continue|submit/i })
    )) ||
    (await tryClick(page.locator('button[type="submit"]').first())) ||
    (await tryClick(page.locator('input[type="submit"]').first()));

  if (!loginClicked) {
    throw new Error(
      'Could not find a login button. Inspect trinet-peo.360learning.com and extend the selectors in login360Learning().'
    );
  }

  await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2000);
}

/**
 * @param {import('@playwright/test').Locator} locator
 */
async function tryClick(locator) {
  try {
    const el = locator.first();
    if (await el.isVisible({ timeout: 2500 })) {
      await el.click();
      return true;
    }
  } catch {
    /* continue */
  }
  return false;
}


/**
 * @param {import('@playwright/test').Page | import('@playwright/test').Frame} ctx
 */
function nextLocator(ctx) {
  return ctx
    .getByRole('button', { name: /next/i })
    .or(ctx.locator('a, button, [role="button"]').filter({ hasText: /^>\s*NEXT|NEXT\s*>$/i }))
    .or(ctx.locator('button, a, [role="button"]').filter({ hasText: /NEXT/i }));
}

/**
 * @param {import('@playwright/test').Page | import('@playwright/test').Frame} ctx
 */
function submitLocator(ctx) {
  return ctx.getByRole('button', { name: /^submit$/i });
}

/**
 * Prefer player.opensesame.com frame(s) so Next / Submit / video match the real course UI.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<import('@playwright/test').Page | import('@playwright/test').Frame | null>}
 */
async function findPlayerContext(page) {
  for (const ctx of prioritizedContexts(page)) {
    const next = nextLocator(ctx).first();
    try {
      if ((await next.count()) > 0 && (await next.first().isVisible().catch(() => false))) {
        return ctx;
      }
    } catch {
      /* try next context */
    }
  }
  for (const ctx of prioritizedContexts(page)) {
    const v = ctx.locator('video').first();
    if ((await v.count()) > 0 && (await v.isVisible().catch(() => false))) {
      return ctx;
    }
  }
  return null;
}

/**
 * Speed up HTML5 videos inside a context (SCORM often uses <video>).
 * @param {import('@playwright/test').Page | import('@playwright/test').Frame} ctx
 * @param {number} rate
 */
async function bumpVideoSpeed(ctx, rate) {
  if (!rate || rate <= 1) return;
  await ctx
    .evaluate((r) => {
      document.querySelectorAll('video').forEach((v) => {
        try {
          v.playbackRate = r;
        } catch {
          /* ignore */
        }
      });
    }, rate)
    .catch(() => {});
}

/**
 * @param {import('@playwright/test').Page | import('@playwright/test').Frame} ctx
 * @param {import('@playwright/test').Page} page
 */
function sleep(page, ms) {
  return page.waitForTimeout(ms);
}

/**
 * If the course requires picking an answer before Submit enables, try common patterns.
 * @param {import('@playwright/test').Page | import('@playwright/test').Frame} ctx
 * @param {import('@playwright/test').Page} page
 */
async function ensureAnswerSelectedIfNeeded(ctx, page) {
  const submit = submitLocator(ctx).first();
  if (!(await submit.isVisible().catch(() => false))) return;

  if (await submit.isEnabled().catch(() => false)) return;

  const candidates = [
    ctx.locator('input[type="radio"]:not(:checked)').first(),
    ctx.locator('input[type="checkbox"]:not(:checked)').first(),
    ctx.locator('[role="radio"][aria-checked="false"]').first(),
    ctx.locator('[role="checkbox"][aria-checked="false"]').first(),
    ctx.locator('label').filter({ hasNotText: /submit|next|prev/i }).first(),
  ];

  for (const loc of candidates) {
    try {
      if ((await loc.count()) > 0 && (await loc.first().isVisible({ timeout: 500 }))) {
        await loc.first().click({ timeout: 3000 });
        await sleep(page, 400);
        if (await submit.isEnabled().catch(() => false)) return;
      }
    } catch {
      /* try next */
    }
  }

  const genericTile = ctx
    .locator('div, button, span')
    .filter({ hasText: /^(Yes|No|Probably|True|False|Agree|Disagree)\b/i })
    .first();
  try {
    if ((await genericTile.count()) > 0 && (await genericTile.isVisible({ timeout: 500 }))) {
      await genericTile.click();
      await sleep(page, 400);
    }
  } catch {
    /* ignore */
  }
}

/**
 * @param {import('@playwright/test').Page | import('@playwright/test').Frame} ctx
 * @param {import('@playwright/test').Locator} next
 * @param {number} perStepMs
 */
async function waitUntilNextEnabled(ctx, next, perStepMs) {
  const video = ctx.locator('video').first();
  const speed = Number(process.env.TRINET_VIDEO_SPEED || '1') || 1;

  await expect
    .poll(
      async () => {
        await bumpVideoSpeed(ctx, speed);
        try {
          await video.evaluate((v) => {
            if (v.ended || v.readyState < 2) return;
            const nearEnd = v.duration > 0 && v.currentTime < v.duration - 0.35;
            if (nearEnd) v.currentTime = v.duration - 0.05;
          });
        } catch {
          /* no video in this ctx */
        }

        const enabled = await next.isEnabled().catch(() => false);
        return enabled;
      },
      {
        message: 'Waiting for Next to become enabled (video end or interaction complete)',
        timeout: perStepMs,
        intervals: [500, 1000, 2000, 4000],
      }
    )
    .toBeTruthy();
}

test.describe('Trinet 360Learning course', () => {
  test('login and advance through course (videos, Next, Submit)', async ({ page }) => {
    test.setTimeout(0);

    await login360Learning(page);

    if (process.env.TRINET_PAUSE_AFTER_LOGIN === '1') {
      // Opens Playwright Inspector pause — navigate manually to the course, then resume.
      await page.pause();
    }

    const courseUrl = process.env.TRINET_COURSE_URL;
    if (courseUrl) {
      await page.goto(courseUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
    }

    const settleMs = Number(process.env.TRINET_OPENSESAME_SETTLE_MS || '2500') || 2500;
    await waitForOpenSesameFrame(page, { required: Boolean(courseUrl) });
    if (settleMs > 0) {
      await sleep(page, settleMs);
    }

    const maxSteps = Math.max(1, Number(process.env.TRINET_MAX_STEPS || '800') || 800);
    const perStepTimeout = 20 * 60 * 1000; // 20 minutes per slide (long videos)

    let ticksWithoutPlayer = 0;
    let idleIterations = 0;

    for (let step = 0; step < maxSteps; step++) {
      let advanced = false;
      let ctx = await findPlayerContext(page);
      if (!ctx) {
        await waitForOpenSesameFrame(page, { required: false, timeoutMs: 8000 });
        await sleep(page, 1500);
        ctx = await findPlayerContext(page);
      }
      if (!ctx) {
        ticksWithoutPlayer++;
        if (ticksWithoutPlayer > 120) {
          await page.screenshot({ path: 'playwright-test-results/trinet-no-player-context.png', fullPage: true });
          throw new Error(
            'No player context in player.opensesame.com (Next/video). Set TRINET_COURSE_URL, wait longer (TRINET_OPENSESAME_FRAME_TIMEOUT_MS), or TRINET_PAUSE_AFTER_LOGIN=1.'
          );
        }
        idleIterations++;
        if (idleIterations > 400) {
          await page.screenshot({ path: 'playwright-test-results/trinet-stuck.png', fullPage: true });
          throw new Error(
            'Stuck: no Submit/Next progress for many iterations (iframe or selectors may need tuning). See trinet-stuck.png.'
          );
        }
        continue;
      }
      ticksWithoutPlayer = 0;

      await bumpVideoSpeed(ctx, Number(process.env.TRINET_VIDEO_SPEED || '1') || 1);

      const submit = submitLocator(ctx).first();
      if (await submit.isVisible().catch(() => false)) {
        await ensureAnswerSelectedIfNeeded(ctx, page);
        if (await submit.isEnabled().catch(() => false)) {
          await submit.click();
          await sleep(page, 800);
          advanced = true;
        }
      }

      const next = nextLocator(ctx).first();
      if (!(await next.isVisible().catch(() => false))) {
        await sleep(page, 500);
        idleIterations = advanced ? 0 : idleIterations + 1;
        if (idleIterations > 400) {
          await page.screenshot({ path: 'playwright-test-results/trinet-stuck.png', fullPage: true });
          throw new Error(
            'Stuck: Next never appeared after many iterations. See trinet-stuck.png.'
          );
        }
        continue;
      }

      await waitUntilNextEnabled(ctx, next, perStepTimeout);
      await next.click();
      await sleep(page, 600);
      idleIterations = 0;
    }

    console.log(`Stopped after ${maxSteps} advance steps (set TRINET_MAX_STEPS to continue longer).`);
  });
});
