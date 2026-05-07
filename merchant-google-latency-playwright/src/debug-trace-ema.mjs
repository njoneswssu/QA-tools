#!/usr/bin/env node
/**
 * Inspect a Playwright trace .zip for wild.link offer-view pixels (EMA vs generic).
 *
 * Usage:
 *   node src/debug-trace-ema.mjs traces/verizon-1778079334600.zip
 */
import { execFileSync } from 'child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { basename, join } from 'path';
import { fileURLToPath } from 'url';
import { isOfferViewUrl, isWildlinkEmaPixelUrl } from './latency-core.mjs';

const zipArg = process.argv[2];
if (!zipArg) {
  console.error(`Usage: node ${basename(fileURLToPath(import.meta.url))} <trace.zip>`);
  process.exit(1);
}

const zip = zipArg.startsWith('/') ? zipArg : join(process.cwd(), zipArg);
if (!existsSync(zip)) {
  console.error('File not found:', zip);
  process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), 'wl-trace-ema-'));
try {
  execFileSync('unzip', ['-q', '-o', zip, '-d', dir], { stdio: 'inherit' });
} catch {
  console.error('unzip failed (install unzip or use a valid .zip)');
  process.exit(1);
}

const netPath = join(dir, 'trace.network');
if (!existsSync(netPath)) {
  console.error('No trace.network in archive');
  rmSync(dir, { recursive: true, force: true });
  process.exit(1);
}

const text = readFileSync(netPath, 'utf8');
/** @type {{ url: string; ema: boolean; offer: boolean }[]} */
const hits = [];
for (const line of text.split('\n')) {
  if (!line.includes('wild.link') || !line.includes('offer-view')) continue;
  let obj;
  try {
    obj = JSON.parse(line);
  } catch {
    continue;
  }
  const snap = obj?.snapshot;
  const url = snap?.request?.url || snap?.response?.url;
  if (typeof url !== 'string' || !url.includes('wild.link')) continue;
  const ema = isWildlinkEmaPixelUrl(url);
  const offer = isOfferViewUrl(url);
  if (ema || offer) hits.push({ url, ema, offer });
}

console.log('Trace:', zip);
console.log('wild.link offer-view pixels:', hits.length);
for (const h of hits) {
  console.log(
    h.ema ? '[EMA pixel view=EMA]' : '[offer_view only]',
    '\n ',
    h.url.length > 220 ? h.url.slice(0, 220) + '?' : h.url
  );
}

const tracePath = join(dir, 'trace.trace');
if (existsSync(tracePath)) {
  const tt = readFileSync(tracePath, 'utf8');
  const extFonts = (tt.match(/chrome-extension:\/\/[a-z0-9]{32}\//gi) || []).length;
  const iframeCount = (tt.match(/"IFRAME"/g) || []).length;
  console.log('\nHeuristic counts in trace.trace (compressed snapshots may hide tags):');
  console.log('  chrome-extension://? substrings:', extFonts);
  console.log('  literal "IFRAME" strings:', iframeCount);
}

rmSync(dir, { recursive: true, force: true });
