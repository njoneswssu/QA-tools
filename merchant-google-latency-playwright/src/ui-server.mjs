/**
 * Local UI: pick merchants from Wildlink app 209, run latency, stream JSON rows (SSE-style chunks).
 */
import { createReadStream, existsSync, mkdirSync, statSync } from 'fs';
import http from 'http';
import { basename, dirname, extname, join, relative, resolve as pathResolve } from 'path';
import { fileURLToPath } from 'url';
import {
  appendOutputRecord,
  fetchMerchants,
  runMerchantLatencyOnDedicatedPage
} from './latency-core.mjs';
import {
  readCachedMerchants,
  readStaleMerchantBackup,
  writeMerchantBackup
} from './merchant-cache.mjs';
import {
  exportLatencyToGoogleSheet,
  parseSpreadsheetIdFromUrlOrId,
  resolveSheetsKeyFile
} from './google-sheets-export.mjs';
import { resolveCitiExtensionPath, startLatencyBrowser, stopLatencyBrowser } from './run-latency.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PUBLIC = join(ROOT, 'ui', 'public');
const DEFAULT_APP_ID = Number(process.env.APP_ID || '209');
const PORT = Number(process.env.UI_PORT || 8787);
/** Same workbook as merchant-rate / latency template (tab gid in URL only selects a view). */
const DEFAULT_GOOGLE_SPREADSHEET_ID = '1MrzC7t3bDXDzS5NTxQaFeMj7xPI3HLzFm2AH0KEoTSY';
/** Serve `.webm` recordings for the UI (basename only). Tries env `TRACE_DIR` then repo `traces/`. */
const TRACE_MEDIA_ROOT = process.env.TRACE_DIR ? pathResolve(process.env.TRACE_DIR) : join(ROOT, 'traces');
const TRACE_MEDIA_FALLBACK = join(ROOT, 'traces');
/** Cap merchants returned to the UI (full feed can be 10k+ rows and locks the browser). Override with `?limit=` or `UI_MERCHANTS_LIMIT`. */
const DEFAULT_UI_MERCHANTS_LIMIT = Math.min(10000, Math.max(50, Number(process.env.UI_MERCHANTS_LIMIT || '400')));
/** How long `data/merchants-app-<id>.json` is considered fresh before refetch (unless `?refresh=1`). */
const MERCHANT_CACHE_MAX_AGE_MS = Number(
  process.env.MERCHANT_CACHE_MAX_AGE_MS ?? String(7 * 24 * 60 * 60 * 1000)
);

/** Updated each `/api/run-stream` so `/api/traces/media` finds `.webm` in the same folder as the run. */
let LAST_LATENCY_TRACE_DIR = pathResolve(join(ROOT, 'traces'));

function contentType(p) {
  const e = extname(p);
  if (e === '.html') return 'text/html; charset=utf-8';
  if (e === '.js') return 'application/javascript; charset=utf-8';
  if (e === '.css') return 'text/css; charset=utf-8';
  return 'application/octet-stream';
}

function sendFile(res, relPath) {
  const p = join(PUBLIC, relPath);
  if (!existsSync(p)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': contentType(p) });
  createReadStream(p).pipe(res);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** Basename only; reject path tricks. Playwright uses names like `page@<hex>.webm`. */
function isSafeWebmBasename(base) {
  const b = String(base || '');
  if (!b || b.length > 240 || !/\.webm$/i.test(b)) return false;
  if (/[\\/]/.test(b) || b.includes('..') || b !== basename(b)) return false;
  return true;
}

/** @param {string | null | undefined} nameParam */
function resolveTraceMediaFile(nameParam) {
  const base = basename(String(nameParam || ''));
  if (!isSafeWebmBasename(base)) return null;
  const roots = [
    pathResolve(LAST_LATENCY_TRACE_DIR),
    pathResolve(TRACE_MEDIA_ROOT),
    pathResolve(TRACE_MEDIA_FALLBACK)
  ].filter((r, i, a) => a.indexOf(r) === i);
  for (const root of roots) {
    const full = pathResolve(join(root, base));
    const rel = relative(root, full);
    if (rel.startsWith('..') || rel.split(/[/\\]/).includes('..')) continue;
    if (existsSync(full)) return full;
  }
  return null;
}

function handleTraceMedia(req, res, url) {
  const u = new URL(url, 'http://localhost');
  const full = resolveTraceMediaFile(u.searchParams.get('name'));
  if (!full) {
    res.writeHead(400);
    res.end('Invalid or missing recording');
    return;
  }
  let size = 0;
  try {
    size = statSync(full).size;
  } catch {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  res.writeHead(200, {
    'Content-Type': 'video/webm',
    'Content-Length': String(size),
    'Cache-Control': 'private, max-age=3600'
  });
  createReadStream(full).pipe(res);
}

async function handleMerchants(req, res, url) {
  const u = new URL(url, 'http://localhost');
  const appId = Number(u.searchParams.get('appId') || DEFAULT_APP_ID);
  const limRaw = u.searchParams.get('limit');
  const limit = Math.min(
    10000,
    Math.max(50, limRaw != null && limRaw !== '' ? Number(limRaw) || DEFAULT_UI_MERCHANTS_LIMIT : DEFAULT_UI_MERCHANTS_LIMIT)
  );
  const mustRefresh = u.searchParams.get('refresh') === '1';

  /** @type {{ id: string; name: string }[] | null} */
  let all = null;
  let fromCache = false;
  let stale = false;

  if (!mustRefresh) {
    const cached = readCachedMerchants(ROOT, appId, MERCHANT_CACHE_MAX_AGE_MS);
    if (cached) {
      all = cached.merchants;
      fromCache = true;
    }
  }

  if (!all) {
    try {
      all = await fetchMerchants(appId);
      writeMerchantBackup(ROOT, appId, all);
      fromCache = false;
      stale = false;
    } catch (e) {
      const staleData = readStaleMerchantBackup(ROOT, appId);
      if (staleData?.merchants?.length) {
        all = staleData.merchants;
        fromCache = true;
        stale = true;
      } else {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(/** @type {any} */ (e)?.message || e) }));
        return;
      }
    }
  }

  const merchants = all.slice(0, limit);
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(
    JSON.stringify({
      appId,
      merchants,
      merchantTotal: all.length,
      limitedTo: merchants.length < all.length ? limit : null,
      fromCache,
      stale,
      cacheMaxAgeMs: MERCHANT_CACHE_MAX_AGE_MS
    })
  );
}

async function handleRunStream(req, res) {
  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    res.writeHead(400);
    res.end('Invalid JSON');
    return;
  }
  const merchants = Array.isArray(body.merchants) ? body.merchants.map(String).filter(Boolean) : [];
  if (!merchants.length) {
    res.writeHead(400);
    res.end('merchants[] required');
    return;
  }

  const traceDir = body.traceDir || join(ROOT, 'traces');
  const outputDir = body.outputDir || join(ROOT, 'output');
  LAST_LATENCY_TRACE_DIR = pathResolve(traceDir);
  mkdirSync(traceDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  let clientClosed = false;
  const onReqClose = () => {
    clientClosed = true;
  };
  req.on('close', onReqClose);
  req.on('aborted', onReqClose);

  /** Add a ready-to-play URL when the file is on disk (helps the UI avoid table/innerHTML issues). */
  function latencyRowForSse(row) {
    if (!row || typeof row !== 'object' || row.type != null || row.merchantName == null) return row;
    const vp = row.videoPath;
    if (!vp || typeof vp !== 'string') return row;
    const base = basename(vp);
    if (!isSafeWebmBasename(base)) return row;
    if (!resolveTraceMediaFile(base)) return row;
    return {
      ...row,
      videoMediaUrl: `/api/traces/media?name=${encodeURIComponent(base)}`
    };
  }

  const send = (obj) => {
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
  };

  function formatSheetsExportError(err) {
    const e = /** @type {any} */ (err);
    const api = e?.response?.data?.error;
    let msg = api ? `${e?.message || 'Google API error'}: ${JSON.stringify(api)}` : String(e?.message || e);
    if (api?.code === 403 || api?.status === 'PERMISSION_DENIED' || /PERMISSION_DENIED|403/i.test(msg)) {
      msg +=
        ' ? The spreadsheet is not shared with your service account (or the ID is wrong). In Google Sheets: Share ? add the `client_email` from your JSON key as Editor. The Sheets API must also be enabled for the Google Cloud project attached to that key.';
    }
    return msg;
  }

  /** @type {{ cdpBrowser: import('playwright').Browser | null; context: import('playwright').BrowserContext; page: import('playwright').Page | null; traceDir: string } | undefined} */
  let session;
  try {
    const citiExt = resolveCitiExtensionPath(body.citiExtensionPath || null);
    session = await startLatencyBrowser({
      cdpUrl: body.cdpUrl || process.env.CDP_URL?.trim() || null,
      citiExt,
      // UI: skip long extension warmup unless client sends skipExtensionWarmup: false (or skipWarmup: true for older clients).
      skipWarmup: Boolean(body.skipWarmup) || body.skipExtensionWarmup !== false,
      traceDir
    });
    const { context } = session;

    const chromeBin =
      process.env.CHROME_EXECUTABLE?.trim() || process.env.GOOGLE_CHROME_BIN?.trim();
    const browserLabelForSheet =
      body.browserLabel?.trim() ||
      (chromeBin ? basename(chromeBin) : 'Google Chrome (Playwright)');

    /** @type {object[]} */
    const sheetRows = [];
    for (const name of merchants) {
      if (clientClosed) break;
      let row;
      try {
        row = await runMerchantLatencyOnDedicatedPage(context, name, { traceDir });
      } catch (e) {
        if (clientClosed) break;
        throw e;
      }
      sheetRows.push(row);
      appendOutputRecord(outputDir, row);
      send(latencyRowForSse(row));
    }

    const wantsGoogleSheet =
      body.exportGoogleSheet === true ||
      body.exportGoogleSheet === 1 ||
      body.exportGoogleSheet === 'true' ||
      body.exportGoogleSheet === '1';

    let googleSheet = null;
    if (!clientClosed && wantsGoogleSheet && sheetRows.length > 0) {
      const sidRaw =
        String(body.googleSpreadsheetId || '').trim() ||
        process.env.GOOGLE_LATENCY_SPREADSHEET_ID?.trim() ||
        DEFAULT_GOOGLE_SPREADSHEET_ID;
      const sid = parseSpreadsheetIdFromUrlOrId(sidRaw);
      try {
        console.log('[latency-ui] Exporting', sheetRows.length, 'row(s) to Google Sheet', sid.slice(0, 12) + '?');
        googleSheet = await exportLatencyToGoogleSheet(sid, sheetRows, {
          browserLabel: browserLabelForSheet,
          tabTitle: body.googleTabTitle || null
        });
        console.log('[latency-ui] Google Sheet tab:', googleSheet.tabTitle, googleSheet.spreadsheetUrl);
      } catch (err) {
        const msg = formatSheetsExportError(err);
        console.error('[latency-ui] Google Sheet export failed:', msg);
        googleSheet = { error: msg };
      }
    } else if (!clientClosed && wantsGoogleSheet && sheetRows.length === 0) {
      googleSheet = { error: 'No result rows to export.' };
    }

    send({
      type: 'done',
      outputDir,
      traceDir,
      googleSheet,
      cancelled: Boolean(clientClosed)
    });
  } catch (e) {
    send({ type: 'error', message: String(/** @type {any} */ (e)?.message || e) });
  } finally {
    if (session) await stopLatencyBrowser(session).catch(() => {});
    try {
      res.end();
    } catch {
      /* closed */
    }
  }
}

const server = http.createServer(async (req, res) => {
  const url = req.url || '/';
  try {
    if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
      sendFile(res, 'index.html');
      return;
    }
    if (req.method === 'GET' && url.startsWith('/app.js')) {
      sendFile(res, 'app.js');
      return;
    }
    if (req.method === 'GET' && url.startsWith('/styles.css')) {
      sendFile(res, 'styles.css');
      return;
    }
    if (req.method === 'GET' && url.startsWith('/api/merchants')) {
      await handleMerchants(req, res, url);
      return;
    }
    if (req.method === 'GET' && url.startsWith('/api/traces/media')) {
      handleTraceMedia(req, res, url);
      return;
    }
    if (req.method === 'POST' && url.startsWith('/api/run-stream')) {
      await handleRunStream(req, res);
      return;
    }
    res.writeHead(404);
    res.end('Not found');
  } catch (e) {
    res.writeHead(500);
    res.end(String(/** @type {any} */ (e)?.message || e));
  }
});

mkdirSync(PUBLIC, { recursive: true });
mkdirSync(TRACE_MEDIA_ROOT, { recursive: true });
server.listen(PORT, () => {
  console.log(`Merchant latency UI: http://127.0.0.1:${PORT}/`);
  console.log(`Using OUTPUT_DIR default ${join(ROOT, 'output')} (override in request body).`);
  console.log(`Trace / video files for playback: ${TRACE_MEDIA_ROOT}`);
  const sheetsKey = resolveSheetsKeyFile();
  if (sheetsKey) {
    console.log('[latency-ui] Google Sheets credentials file:', sheetsKey);
  } else {
    console.log(
      '[latency-ui] Google Sheets: no service-account JSON found. Set GOOGLE_APPLICATION_CREDENTIALS, or add secrets/google-sheets-key.json under this package or merchant-rate-weekly-report.'
    );
  }
});
