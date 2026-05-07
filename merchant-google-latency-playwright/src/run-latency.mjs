/**
 * Browser-level latency: Google -> first organic -> wait for wild.link offer-view OR Citi EMA.
 * Uses Chrome for Testing via Playwright (`channel: 'chrome'` after `npx playwright install chrome`).
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { homedir } from 'os';
import { createInterface } from 'readline';
import { basename, dirname, isAbsolute, join, relative, resolve as pathResolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import {
  appendOutputRecord,
  fetchMerchants,
  runMerchantLatencyOnDedicatedPage
} from './latency-core.mjs';
import { exportLatencyToGoogleSheet, parseSpreadsheetIdFromUrlOrId } from './google-sheets-export.mjs';
import { installClickPulseOnContext } from './click-pulse.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

/** Default latency results workbook (override with GOOGLE_LATENCY_SPREADSHEET_ID or --google-sheet-id). */
const DEFAULT_GOOGLE_SPREADSHEET_ID = '1MrzC7t3bDXDzS5NTxQaFeMj7xPI3HLzFm2AH0KEoTSY';

/** Default unpacked Citi Shop build (override with `--citi-extension` or `CITI_EXTENSION_PATH`). */
const DEFAULT_CITI_EXTENSION_PATH = '/Users/neiljones/Downloads/dist 4';

/** Citi Shop: Web Store build auto-resolved from Chrome profiles (latency profile first, then system Chrome). */
const CITI_SHOP_WEB_STORE_URL =
  'https://chromewebstore.google.com/detail/citi-shop%C2%AE-program-add-sh/coilflpnmfnnbdpjfcglhgommahebcci';
const CITI_SHOP_EXTENSION_ID = 'coilflpnmfnnbdpjfcglhgommahebcci';

const APP_ID = Number(process.env.APP_ID || '209');

/** Let unpacked MV3 extensions (e.g. Citi) register service workers before the first real navigation. */
const EXTENSION_WARMUP_MS = Number(process.env.EXTENSION_WARMUP_MS || '5000');
const EXTENSION_WARMUP_SW_DEADLINE_MS = Number(process.env.EXTENSION_WARMUP_SW_DEADLINE_MS || '12000');
const EXTENSION_WARMUP_URL = process.env.EXTENSION_WARMUP_URL || 'https://www.example.com/';

/**
 * Persistent Chrome user-data dir for this tool (sign-in + Web Store installs survive across runs).
 * Override with `WL_LATENCY_CHROME_USER_DATA` (absolute path recommended).
 */
function latencyPlaywrightChromeUserDataDir() {
  const e = process.env.WL_LATENCY_CHROME_USER_DATA?.trim();
  if (e) return pathResolve(e);
  return join(homedir(), '.wl-latency-chrome-profile');
}

function listProfileDirNames(chromeUserDataDir) {
  try {
    return readdirSync(chromeUserDataDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }
}

function listVersionDirNames(extIdRoot) {
  try {
    return readdirSync(extIdRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }
}

/** Chrome version folder names, e.g. 1.17.0_0; higher segment values mean newer. */
function compareChromeExtensionVersions(a, b) {
  const pa = a.split(/[._]+/).map((p) => parseInt(p, 10) || 0);
  const pb = b.split(/[._]+/).map((p) => parseInt(p, 10) || 0);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}

function systemChromeUserDataRoots() {
  const h = homedir();
  if (process.platform === 'darwin') {
    return [join(h, 'Library/Application Support/Google/Chrome')];
  }
  if (process.platform === 'win32') {
    const la = process.env.LOCALAPPDATA;
    return la ? [join(la, 'Google', 'Chrome', 'User Data')] : [];
  }
  return [join(h, '.config', 'google-chrome'), join(h, '.config', 'chromium')];
}

/** True if `child` is the user-data root or a path inside it (e.g. .../Default/Extensions/...). */
function pathIsUnderUserData(child, userDataRoot) {
  const rel = relative(pathResolve(userDataRoot), pathResolve(child));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

/**
 * @param {string} extensionId
 * @param {string[]} userDataRoots
 * @returns {{ dir: string; version: string; mtime: number }[]}
 */
function collectExtensionCandidates(extensionId, userDataRoots) {
  const candidates = [];
  for (const userData of userDataRoots) {
    if (!existsSync(userData)) continue;
    for (const prof of listProfileDirNames(userData)) {
      const extRoot = join(userData, prof, 'Extensions', extensionId);
      if (!existsSync(extRoot)) continue;
      for (const ver of listVersionDirNames(extRoot)) {
        const dir = join(extRoot, ver);
        if (!existsSync(join(dir, 'manifest.json'))) continue;
        candidates.push({ dir, version: ver, mtime: statSync(dir).mtimeMs });
      }
    }
  }
  return candidates;
}

function pickBestExtensionCandidate(candidates) {
  let best = /** @type {{ dir: string; version: string; mtime: number } | null} */ (null);
  for (const c of candidates) {
    if (!best) {
      best = c;
      continue;
    }
    const cmp = compareChromeExtensionVersions(c.version, best.version);
    if (cmp > 0 || (cmp === 0 && c.mtime > best.mtime)) best = c;
  }
  return best;
}

/**
 * `--load-extension` needs a directory with `manifest.json`. Chrome Web Store installs live under
 * `.../<Profile>/Extensions/<id>/<version>/`.
 * Prefers the Playwright latency profile so a Web Store install from `--chrome-setup` is found first.
 */
function findInstalledChromeWebStoreExtensionDir(extensionId) {
  const latency = latencyPlaywrightChromeUserDataDir();
  const fromLatency = pickBestExtensionCandidate(collectExtensionCandidates(extensionId, [latency]));
  if (fromLatency) return fromLatency.dir;
  const fromSystem = pickBestExtensionCandidate(
    collectExtensionCandidates(extensionId, systemChromeUserDataRoots())
  );
  return fromSystem?.dir ?? null;
}

function suggestedCitiExtensionPathForHints() {
  const fromStore = findInstalledChromeWebStoreExtensionDir(CITI_SHOP_EXTENSION_ID);
  if (fromStore) return fromStore;
  if (existsSync(DEFAULT_CITI_EXTENSION_PATH)) return DEFAULT_CITI_EXTENSION_PATH;
  return DEFAULT_CITI_EXTENSION_PATH;
}

export function resolveCitiExtensionPath(cliPath) {
  if (cliPath) return cliPath;
  if (process.env.CITI_EXTENSION_PATH) return process.env.CITI_EXTENSION_PATH;
  const fromStore = findInstalledChromeWebStoreExtensionDir(CITI_SHOP_EXTENSION_ID);
  if (fromStore) return fromStore;
  if (existsSync(DEFAULT_CITI_EXTENSION_PATH)) return DEFAULT_CITI_EXTENSION_PATH;
  return null;
}

/** e.g. `9222` or `http://127.0.0.1:9222` */
function normalizeCdpUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return `http://127.0.0.1:${s}`;
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  return `http://${s}`;
}

function parseCli() {
  const argv = process.argv.slice(2);
  const out = {
    merchants: [],
    limit: null,
    citiExt: null,
    cdpUrl: process.env.CDP_URL?.trim() || null,
    skipWarmup: process.env.SKIP_EXTENSION_WARMUP === '1',
    traceDir: process.env.TRACE_DIR || join(ROOT, 'traces'),
    outputDir: process.env.OUTPUT_DIR || join(ROOT, 'output'),
    chromeSetup: process.env.CHROME_SETUP === '1',
    exportToGoogleSheet: process.env.GOOGLE_LATENCY_EXPORT_SHEET === '1',
    googleSpreadsheetId: parseSpreadsheetIdFromUrlOrId(
      process.env.GOOGLE_LATENCY_SPREADSHEET_ID?.trim() || DEFAULT_GOOGLE_SPREADSHEET_ID
    ),
    googleTabTitle: process.env.GOOGLE_LATENCY_SHEET_TAB?.trim() || null,
    browserLabelForSheet: process.env.GOOGLE_SHEET_BROWSER?.trim() || null
  };
  let citiCli = null;
  if (process.env.MERCHANTS) {
    out.merchants = process.env.MERCHANTS.split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => ({ id: '', name }));
  }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--merchant' && argv[i + 1]) {
      out.merchants.push({ id: '', name: argv[++i] });
    } else if (argv[i] === '--merchants' && argv[i + 1]) {
      out.merchants = argv[++i]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((name) => ({ id: '', name }));
    } else if (argv[i] === '--limit' && argv[i + 1]) {
      out.limit = Number(argv[++i]);
    } else if (argv[i] === '--citi-extension' && argv[i + 1]) {
      citiCli = argv[++i];
    } else if (argv[i] === '--cdp-url' && argv[i + 1]) {
      out.cdpUrl = argv[++i];
    } else if (argv[i] === '--skip-warmup') {
      out.skipWarmup = true;
    } else if (argv[i] === '--chrome-setup') {
      out.chromeSetup = true;
    } else if (argv[i] === '--trace-dir' && argv[i + 1]) {
      out.traceDir = argv[++i];
    } else if (argv[i] === '--output-dir' && argv[i + 1]) {
      out.outputDir = argv[++i];
    } else if (argv[i] === '--google-sheet') {
      out.exportToGoogleSheet = true;
    } else if (argv[i] === '--google-sheet-id' && argv[i + 1]) {
      out.googleSpreadsheetId = parseSpreadsheetIdFromUrlOrId(argv[++i]);
    } else if (argv[i] === '--google-sheet-tab' && argv[i + 1]) {
      out.googleTabTitle = argv[++i];
    } else if (argv[i] === '--google-sheet-browser' && argv[i + 1]) {
      out.browserLabelForSheet = argv[++i];
    }
  }
  out.citiExt = resolveCitiExtensionPath(citiCli);
  return out;
}

/**
 * @param {string[]} chromeArgs
 * @param {{ recordVideoDir?: string | null }} [extra]
 */
function getChromeLaunchOptions(chromeArgs = [], extra = {}) {
  /** @type {import('playwright').LaunchPersistentContextOptions} */
  const o = {
    headless: false,
    args: chromeArgs,
    viewport: { width: 1280, height: 900 },
    // Playwright's Chromium defaults include `--disable-extensions`, which blocks Chrome Web Store
    // ("Installation is not enabled"). Drop that switch; keep dropping automation branding.
    ignoreDefaultArgs: ['--enable-automation', '--disable-extensions']
  };
  const chromeBin = process.env.CHROME_EXECUTABLE?.trim() || process.env.GOOGLE_CHROME_BIN?.trim();
  if (chromeBin) o.executablePath = chromeBin;
  else o.channel = 'chrome';
  const vidDir = extra.recordVideoDir?.trim();
  const recordVideoOff =
    process.env.WL_LATENCY_NO_VIDEO === '1' || process.env.WL_LATENCY_RECORD_VIDEO === '0';
  if (vidDir && !recordVideoOff) {
    mkdirSync(vidDir, { recursive: true });
    o.recordVideo = { dir: vidDir, size: { width: 1280, height: 900 } };
    console.log('[latency] recordVideo enabled; .webm files go to:', vidDir);
  } else if (vidDir && recordVideoOff) {
    console.log(
      '[latency] recordVideo disabled (set WL_LATENCY_NO_VIDEO=1 or WL_LATENCY_RECORD_VIDEO=0).'
    );
  }
  return o;
}

/** @param {string | null} citiExtensionDir @param {string} traceDir */
async function launchContext(citiExtensionDir, traceDir) {
  const userDataDir = latencyPlaywrightChromeUserDataDir();
  mkdirSync(userDataDir, { recursive: true });
  mkdirSync(traceDir, { recursive: true });
  const args = [];
  if (citiExtensionDir) {
    if (pathIsUnderUserData(citiExtensionDir, userDataDir)) {
      console.log(
        'Citi is already installed under this Chrome user-data dir; skipping --load-extension (normal profile load).'
      );
    } else {
      args.push(`--load-extension=${citiExtensionDir}`);
    }
  }
  return chromium.launchPersistentContext(
    userDataDir,
    getChromeLaunchOptions(args, { recordVideoDir: traceDir })
  );
}

/** One-time: open persistent Chrome, no --load-extension, so Google sign-in + Web Store install work. */
async function runChromeSetup() {
  const userDataDir = latencyPlaywrightChromeUserDataDir();
  mkdirSync(userDataDir, { recursive: true });
  const chromeBin = process.env.CHROME_EXECUTABLE?.trim() || process.env.GOOGLE_CHROME_BIN?.trim();
  console.log(
    [
      'Chrome setup: persistent profile for Google account + Chrome Web Store.',
      `User data dir (reused every run): ${userDataDir}`,
      'Override with WL_LATENCY_CHROME_USER_DATA if you want a different folder.',
      chromeBin
        ? `Browser binary: ${chromeBin}`
        : 'Browser: Playwright channel "chrome" (use CHROME_EXECUTABLE if Web Store is still blocked).',
      '',
      `Opening ${CITI_SHOP_WEB_STORE_URL}`,
      'Sign in to Google, install Citi Shop, then press Enter here to save and exit.'
    ].join('\n')
  );
  const context = await chromium.launchPersistentContext(userDataDir, getChromeLaunchOptions([]));
  const page = context.pages()[0] || (await context.newPage());
  await page.goto(CITI_SHOP_WEB_STORE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch((e) => {
    console.warn('Navigation to Web Store:', e?.message || e);
  });
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  await new Promise((res) => {
    rl.question('Press Enter when finished... ', () => {
      rl.close();
      res(undefined);
    });
  });
  await context.close();
  console.log('Setup saved. Run latency without --chrome-setup; the same profile loads Citi automatically.');
}

/**
 * Extensions are not ready the instant the browser opens. Load a real HTTPS tab, wait for any
 * extension service workers to appear, then hold so MV3 extensions can finish startup.
 */
async function preloadExtensions(context, page) {
  console.log(
    `Preloading extensions: ${EXTENSION_WARMUP_URL} (load), then service workers (up to ${EXTENSION_WARMUP_SW_DEADLINE_MS}ms), then ${EXTENSION_WARMUP_MS}ms settle.`
  );

  await page.goto(EXTENSION_WARMUP_URL, { waitUntil: 'load', timeout: 120000 }).catch((err) => {
    console.warn('Warmup URL failed, continuing:', err?.message || err);
  });

  const swDeadline = Date.now() + EXTENSION_WARMUP_SW_DEADLINE_MS;
  while (Date.now() < swDeadline) {
    try {
      const n = context.serviceWorkers().length;
      if (n > 0) {
        console.log(`Service worker(s) registered: ${n}`);
        break;
      }
    } catch {
      /* ignore */
    }
    await page.waitForTimeout(200);
  }

  await page.waitForTimeout(EXTENSION_WARMUP_MS);
  console.log('Extension preload finished; starting tests.');
}

/**
 * Attach to Chrome you already started with `--remote-debugging-port` (and extensions loaded).
 * No warmup waits; extensions and SWs are assumed ready.
 */
async function assertCdpReachable(cdpUrl) {
  let origin;
  try {
    origin = new URL(cdpUrl).origin;
  } catch {
    throw new Error(`Invalid CDP URL: ${cdpUrl}`);
  }
  const versionUrl = `${origin}/json/version`;
  try {
    const res = await fetch(versionUrl, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    const hint = [
      '',
      `Could not reach Chrome DevTools at ${versionUrl}`,
      `(Playwright needs Chrome already running with --remote-debugging-port.)`,
      '',
      'Start Chrome first, for example:',
      '  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \\',
      '    --remote-debugging-port=9222 \\',
      '    --user-data-dir="$HOME/.wl-latency-cdp-profile" \\',
      `    --load-extension="${suggestedCitiExtensionPathForHints()}"`,
      `  (Install Citi Shop in Google Chrome first if needed: ${CITI_SHOP_WEB_STORE_URL})`,
      '',
      'Check the port responds:',
      `  curl -s ${versionUrl} | head`,
      '',
      'Or run without CDP_URL so Playwright launches Chrome itself (includes extension warmup).'
    ].join('\n');
    const err = new Error((e?.message || String(e)) + hint);
    err.cause = e;
    throw err;
  }
}

async function attachOverCdp(cdpUrl) {
  await assertCdpReachable(cdpUrl);
  const browser = await chromium.connectOverCDP(cdpUrl);
  const context = browser.contexts()[0];
  if (!context) {
    throw new Error(
      `CDP ${cdpUrl}: no browser context. Start Chrome with a normal window open, then retry.`
    );
  }
  const page = context.pages()[0] || (await context.newPage());
  return { browser, context, page };
}

/** Start browser for latency runs (CLI or UI). */
export async function startLatencyBrowser(opts) {
  const traceDir = opts.traceDir || join(ROOT, 'traces');
  const cdpUrl = opts.cdpUrl ? normalizeCdpUrl(String(opts.cdpUrl)) : null;
  if (cdpUrl) {
    const { browser, context, page } = await attachOverCdp(cdpUrl);
    mkdirSync(traceDir, { recursive: true });
    await installClickPulseOnContext(context);
    console.warn(
      '[latency] CDP attach: Playwright recordVideo cannot target this existing Chrome context; ' +
        'run without CDP_URL for per-merchant .webm screen recordings. Traces (.zip) still work.'
    );
    return { cdpBrowser: browser, context, page, traceDir };
  }
  const context = await launchContext(opts.citiExt ?? null, traceDir);
  await installClickPulseOnContext(context);
  const page = context.pages()[0] || (await context.newPage());
  const needsWarmup = Boolean(opts.citiExt) && !opts.skipWarmup;
  if (needsWarmup) await preloadExtensions(context, page);
  // Close the warmup tab so each merchant run uses a fresh page (trace zip + video per merchant).
  await page.close().catch(() => {});
  return { cdpBrowser: null, context, page: null, traceDir };
}

export async function stopLatencyBrowser(session) {
  if (session.cdpBrowser) await session.cdpBrowser.close();
  else await session.context.close();
}

async function main() {
  const opts = parseCli();
  if (opts.cdpUrl) {
    opts.cdpUrl = normalizeCdpUrl(opts.cdpUrl);
    if (!opts.cdpUrl) throw new Error('Invalid --cdp-url / CDP_URL (empty after normalize).');
  }

  if (opts.chromeSetup) {
    if (opts.cdpUrl) throw new Error('--chrome-setup cannot be used with CDP_URL / --cdp-url.');
    await runChromeSetup();
    return;
  }

  if (opts.citiExt && !existsSync(opts.citiExt)) {
    console.warn(`Citi extension path not found (continuing without it): ${opts.citiExt}`);
    opts.citiExt = null;
  } else if (opts.citiExt && !opts.cdpUrl) {
    const latencyRoot = latencyPlaywrightChromeUserDataDir();
    if (pathIsUnderUserData(opts.citiExt, latencyRoot)) {
      console.log('Using Citi Shop from latency Chrome profile (Web Store / sign-in data persists here):', opts.citiExt);
    } else {
      const fromProfile = findInstalledChromeWebStoreExtensionDir(CITI_SHOP_EXTENSION_ID);
      if (fromProfile && opts.citiExt === fromProfile) {
        console.log('Using Citi Shop from system Chrome profile (Chrome Web Store install):', opts.citiExt);
      } else {
        console.log('Using Citi extension:', opts.citiExt);
      }
    }
  }
  if (opts.cdpUrl) {
    console.log('CDP: attach to existing Chrome (extension warmup skipped; load Citi in that window first).');
  }
  let merchants = opts.merchants;
  if (!merchants.length) {
    const all = await fetchMerchants(APP_ID);
    merchants = opts.limit != null ? all.slice(0, opts.limit) : all.slice(0, 5);
    console.log(
      `No --merchant(s) or MERCHANTS= env; using first ${merchants.length} from app ${APP_ID} feed.`
    );
  }

  mkdirSync(opts.traceDir, { recursive: true });
  mkdirSync(opts.outputDir, { recursive: true });

  const session = await startLatencyBrowser({
    cdpUrl: opts.cdpUrl,
    citiExt: opts.citiExt,
    skipWarmup: opts.skipWarmup,
    traceDir: opts.traceDir
  });
  const { context } = session;

  const chromeBinForLabel =
    process.env.CHROME_EXECUTABLE?.trim() || process.env.GOOGLE_CHROME_BIN?.trim();
  const defaultBrowserLabel = chromeBinForLabel
    ? basename(chromeBinForLabel)
    : 'Google Chrome (Playwright)';
  const browserLabelForSheet = opts.browserLabelForSheet || defaultBrowserLabel;

  /** @type {object[]} */
  const sheetRows = [];

  let lastOutputPath = null;
  for (const m of merchants) {
    const name = typeof m === 'string' ? m : m.name;
    console.log(`\n--- ${name} ---`);
    const row = await runMerchantLatencyOnDedicatedPage(context, name, { traceDir: opts.traceDir });
    sheetRows.push(row);
    lastOutputPath = appendOutputRecord(opts.outputDir, row);
    if (row.secondsToSignalFromNav != null) {
      console.log(
        `Signal: ${row.endReason} ? ${row.secondsToSignalFromNav}s from merchant navigation`,
        row.detail || ''
      );
    } else {
      console.log(`Signal: ${row.endReason}`, row.detail || '');
    }
    if (row.tracePath) console.log('Trace:', row.tracePath);
    if (row.videoPath) console.log('Video:', row.videoPath);
  }

  await stopLatencyBrowser(session);
  console.log('\nRecorded results:', lastOutputPath);

  if (opts.exportToGoogleSheet && sheetRows.length > 0) {
    try {
      const gs = await exportLatencyToGoogleSheet(opts.googleSpreadsheetId, sheetRows, {
        browserLabel: browserLabelForSheet,
        tabTitle: opts.googleTabTitle
      });
      console.log('\nGoogle Sheet new tab:', gs.tabTitle);
      console.log('Open:', gs.spreadsheetUrl);
    } catch (e) {
      console.error('\nGoogle Sheet export failed:', /** @type {any} */ (e)?.message || e);
    }
  }
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
