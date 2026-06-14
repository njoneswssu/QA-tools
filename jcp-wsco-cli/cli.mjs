#!/usr/bin/env node
/**
 * Interactive CLI: search JCP WSCO POs on transfer.levsuite.com, inspect XML hits,
 * and convert using the same rules as ../xml-converter.html.
 *
 * Flow: enter POs (one line, or type "paste" for a column) → shipment-only vs regular → search → summary → write.
 * Compact terminal output by default; VERBOSE=1 or --verbose for per-file details.
 */

import { createInterface } from 'node:readline/promises';
import readline from 'node:readline';
import { stdin as input, stdout as output, argv, exit } from 'node:process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

import {
  SHIPMENT,
  ACCEPT,
  convertXmlForEnteredOrder,
  convertComergentBlockPairLikeHtml,
  buildShipmentBlockLikeHtml,
  getOrderNumberFromComergentBlock,
  getFirstExportBlockForOrder,
  wrapComergentData,
  splitComergentBlocks,
  canonicalOrderKey,
} from './xml-convert.js';

const SEARCH_URL = 'http://transfer.levsuite.com/search_wsco.php';
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, 'output');

function normPo(s) {
  return canonicalOrderKey(s);
}

/**
 * Same PO pasted twice → one entry (first wins for shipment/regular grouping).
 * @param {string[]} normalizedOrderNumbers already normPo'd
 */
function dedupePoListInOrder(normalizedOrderNumbers) {
  const seen = new Set();
  const out = [];
  for (const o of normalizedOrderNumbers) {
    if (seen.has(o)) continue;
    seen.add(o);
    out.push(o);
  }
  return out;
}

/**
 * Parses PO lists: commas/spaces/tabs on one line, or one PO per line (column paste / spreadsheet).
 * Strips BOM. Splits lines on \r\n; each line also splits on comma, semicolon, or tab.
 * @param {string} line
 * @returns {string[]}
 */
function parseOrderLine(line) {
  const raw = String(line ?? '').replace(/^\uFEFF/, '');
  if (!normPo(raw)) return [];

  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out = [];

  if (lines.length > 1) {
    for (const l of lines) {
      const cells = l.split(/[,;\t]+/).map(normPo).filter(Boolean);
      if (cells.length) out.push(...cells);
      else out.push(normPo(l));
    }
  } else {
    out.push(...lines[0].split(/[,;\s\t]+/).map(normPo).filter(Boolean));
  }

  return out;
}

/**
 * Read a pasted column reliably. `readline.question()` only consumes one line per call, so a
 * multi-line paste would drop middle rows. We pause the main UI and use a temporary interface.
 * @param {import('node:readline/promises').Interface} rl
 * @param {string[]} introLines
 * @returns {Promise<string>} non-empty lines joined with \n
 */
async function readColumnUntilBlank(rl, introLines) {
  for (const line of introLines) {
    console.log(line);
  }
  if (!input.isTTY) {
    console.log('(Non-interactive: use one line, commas between POs.)');
    return rl.question('> ');
  }

  console.log('Paste one PO per line, then press Enter on an empty line when finished.');
  rl.pause();
  const lines = [];

  return await new Promise((resolve, reject) => {
    let settled = false;
    const iface = readline.createInterface({ input, output, terminal: true });

    const finish = (value) => {
      if (settled) return;
      settled = true;
      iface.removeAllListeners();
      iface.close();
      rl.resume();
      resolve(value);
    };

    iface.on('line', (line) => {
      if (!normPo(line)) {
        finish(lines.join('\n'));
        return;
      }
      lines.push(line);
    });

    iface.on('close', () => finish(lines.join('\n')));

    iface.on('error', (err) => {
      if (settled) return;
      settled = true;
      iface.removeAllListeners();
      iface.close();
      rl.resume();
      reject(err);
    });
  });
}

/**
 * One line (commas/spaces) = single Enter. Type **paste** + Enter to paste a column.
 * @param {import('node:readline/promises').Interface} rl
 * @param {string} title
 * @returns {Promise<string[]>}
 */
async function promptPoList(rl, title) {
  console.log(title);
  console.log(
    'Enter POs on one line (commas or spaces), or type **paste** and press Enter to paste a column (one PO per line), then a blank line.'
  );
  const first = await rl.question('> ');
  if (/^paste$/i.test(first.trim())) {
    const block = await readColumnUntilBlank(rl, []);
    return parseOrderLine(block);
  }
  return parseOrderLine(first);
}

/**
 * @param {string[]} tokens from parseOrderLine
 * @param {Set<string>} orderSet
 * @returns {{ set: Set<string>, unknown: string[] }}
 */
function resolveShipmentOnlySelection(tokens, orderSet) {
  const t = tokens.map(normPo).filter(Boolean);
  if (t.length === 1 && /^all$/i.test(t[0])) {
    return { set: new Set(orderSet), unknown: [] };
  }
  if (t.length === 1 && /^(none|no)$/i.test(t[0])) {
    return { set: new Set(), unknown: [] };
  }
  const unknown = t.filter((p) => !orderSet.has(p));
  const known = t.filter((p) => orderSet.has(p));
  return { set: new Set(known), unknown };
}

function parseOrderArgs() {
  const args = argv.slice(2);
  const orders = [];
  let verbose = false;
  /** @type {string[]} */
  let shipmentOnly = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--verbose' || a === '-v') {
      verbose = true;
      continue;
    }
    if (a === '--shipment-only' && args[i + 1]) {
      shipmentOnly = parseOrderLine(args[++i]);
      continue;
    }
    if (a === '--orders' && args[i + 1]) {
      orders.push(...parseOrderLine(args[++i]));
      continue;
    }
    if (!a.startsWith('--')) {
      orders.push(normPo(a));
    }
  }

  return { orders: orders.filter(Boolean), verbose, shipmentOnly };
}

/**
 * @param {import('node:readline/promises').Interface} rl
 * @param {Set<string>} orderSet
 * @param {string[]} orderNumbers
 * @returns {Promise<Set<string>>}
 */
async function promptShipmentOnlyMode(rl, orderSet, orderNumbers) {
  console.log(`\nThis run: ${orderNumbers.join(', ')}`);
  console.log(
    `Which PO(s) should be ${SHIPMENT} only (one shipment XML block each)?\n` +
      `• **all** — every PO shipment-only (one line).\n` +
      `• **none** or leave blank — all regular (${ACCEPT} + ${SHIPMENT} pair).\n` +
      `• Or list POs on one line (commas/spaces), or type **paste** for a column (blank line to finish).`
  );
  const first = await rl.question('> ');
  let requested;
  if (/^paste$/i.test(first.trim())) {
    const block = await readColumnUntilBlank(rl, []);
    requested = parseOrderLine(block);
  } else {
    requested = parseOrderLine(first);
  }
  const { set, unknown } = resolveShipmentOnlySelection(requested, orderSet);
  if (unknown.length) {
    console.log(`Note: ignoring PO(s) not in this run: ${unknown.join(', ')}`);
  }
  return set;
}

/**
 * @param {import('node:readline/promises').Interface} rl
 * @param {string} question
 * @returns {Promise<boolean>}
 */
async function promptYesNo(rl, question) {
  let q = question;
  while (true) {
    const a = (await rl.question(q)).trim().toLowerCase();
    if (a === 'y' || a === 'yes') return true;
    if (a === 'n' || a === 'no') return false;
    console.log('Please answer y or n (yes/no).');
    q = 'Try again [y/N]: ';
  }
}

/**
 * @param {import('playwright').Page} page
 * @param {string} orderNumber
 */
async function runSearch(page, orderNumber) {
  await page.goto(SEARCH_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

  const poInput = page
    .getByLabel(/jcp.*wsco.*po/i)
    .or(page.locator('input[type="text"]'))
    .or(page.locator('input:not([type])'))
    .first();

  await poInput.waitFor({ state: 'visible', timeout: 30000 });
  await poInput.fill(orderNumber);

  const searchBtn = page
    .getByRole('button', { name: /search/i })
    .or(page.locator('input[type="submit"]'))
    .first();
  await searchBtn.click();
  await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
}

function linkCategory(href) {
  const h = href.toLowerCase();
  if (h.includes('/status/') || h.startsWith('status/')) return 'Status';
  if (h.includes('/order') || h.includes('order/')) return 'Orders';
  return 'Other';
}

/**
 * @param {import('playwright').APIRequestContext} request
 * @param {string} pageUrl
 * @param {string} href
 */
async function fetchXmlText(request, pageUrl, href) {
  const abs = new URL(href, pageUrl).href;
  const res = await request.get(abs, { timeout: 120000 });
  const status = res.status();
  const text = await res.text();
  return { abs, status, text };
}

function buildSummaryAndConvert(text, searchedOrder) {
  const hasShipment = text.includes(SHIPMENT);
  const hasAccept = text.includes(ACCEPT);
  const blocks = splitComergentBlocks(text);
  const blockCount = blocks.length;
  const orderInputMatch = text.match(/<OrderInput>\s*([^<]+)\s*<\/OrderInput>/i);
  const orderInput = orderInputMatch ? orderInputMatch[1].trim() : '(no OrderInput tag found)';
  const orderNumbersInFile = [...new Set(blocks.map((b) => getOrderNumberFromComergentBlock(b)).filter(Boolean))];
  const normalized = normPo(searchedOrder);
  let acceptOnlyBlocksMatchingSearchedPo = 0;
  for (const block of blocks) {
    if (normPo(getOrderNumberFromComergentBlock(block)) !== normalized) continue;
    if (block.includes(SHIPMENT)) continue;
    if (block.includes(ACCEPT)) acceptOnlyBlocksMatchingSearchedPo += 1;
  }
  const converted = convertXmlForEnteredOrder(text, searchedOrder);
  return {
    hasShipment,
    hasAccept,
    blockCount,
    orderInput,
    orderNumbersInFile,
    acceptOnlyBlocksMatchingSearchedPo,
    blocksMatchingSearchedPo: converted.paired,
    skippedWrongOrder: converted.skippedWrongOrder,
    skippedNoShipment: converted.skippedNoShipment,
    convertOutput: converted.output,
  };
}

/**
 * @param {import('playwright').Page} page
 * @param {import('playwright').BrowserContext} context
 * @param {string[]} orderNumbers
 * @param {(po: string, index: number, total: number) => void} [onProgress]
 */
async function fillReport(page, context, orderNumbers, onProgress) {
  /** @type {Array<{ order: string, findings: Array<any>, ordersNoMatch: boolean, statusNoMatch: boolean }>} */
  const report = [];
  const total = orderNumbers.length;

  for (let i = 0; i < orderNumbers.length; i++) {
    const order = orderNumbers[i];
    onProgress?.(order, i + 1, total);
    await runSearch(page, order);
    const pageUrl = page.url();

    const hrefs = await page.locator('a[href]').evaluateAll((anchors) =>
      anchors.map((a) => a.getAttribute('href')).filter(Boolean)
    );

    const xmlHrefs = [...new Set(hrefs.filter((h) => /\.xml(\?|$)/i.test(h) || h.toLowerCase().endsWith('.xml')))];

    const findings = [];
    for (const href of xmlHrefs) {
      const category = linkCategory(href);
      try {
        const { abs, status, text } = await fetchXmlText(context.request, pageUrl, href);
        const summary = buildSummaryAndConvert(text, order);
        findings.push({
          category,
          href,
          abs,
          httpStatus: status,
          summary,
          rawXml: status >= 200 && status < 300 ? text : undefined,
        });
      } catch (e) {
        const abs = (() => {
          try {
            return new URL(href, pageUrl).href;
          } catch {
            return href;
          }
        })();
        findings.push({
          category,
          href,
          abs,
          httpStatus: 0,
          summary: {
            hasShipment: false,
            hasAccept: false,
            blockCount: 0,
            orderInput: '(fetch failed)',
            orderNumbersInFile: [],
            acceptOnlyBlocksMatchingSearchedPo: 0,
            blocksMatchingSearchedPo: 0,
            skippedWrongOrder: 0,
            skippedNoShipment: 0,
            convertOutput: '',
          },
          fetchError: e instanceof Error ? e.message : String(e),
        });
      }
    }

    const bodyText = await page.locator('body').innerText().catch(() => '');
    const ordersNoMatch = /order files returned no results/i.test(bodyText);
    const statusNoMatch = /status files returned no results/i.test(bodyText);

    report.push({ order, findings, ordersNoMatch, statusNoMatch });
  }

  return report;
}

/**
 * @param {{ order: string, findings: Array<{ rawXml?: string }> }} row
 */
function getExportSource(row) {
  for (const f of row.findings) {
    if (!f.rawXml) continue;
    const hit = getFirstExportBlockForOrder(f.rawXml, row.order);
    if (hit) return { finding: f, kind: hit.kind, block: hit.block };
  }
  return null;
}

/**
 * @param {Array<{ order: string, findings: Array<any>, ordersNoMatch: boolean, statusNoMatch: boolean }>} report
 */
function printVerboseReport(report) {
  console.log('\n========== RESULTS (verbose) ==========\n');

  for (const row of report) {
    console.log(`--- PO ${row.order} ---`);
    if (row.findings.length === 0) {
      console.log('  No .xml links on the results page.');
      if (row.ordersNoMatch) console.log('  (Orders: no results message present.)');
      if (row.statusNoMatch) console.log('  (Status: no results message present.)');
    }
    for (const f of row.findings) {
      console.log(`  [${f.category}] ${f.abs}`);
      console.log(`    HTTP: ${f.httpStatus || '—'}${f.fetchError ? `  Error: ${f.fetchError}` : ''}`);
      console.log(
        `    ${SHIPMENT}: ${f.summary.hasShipment ? 'yes' : 'no'}  |  ${ACCEPT}: ${f.summary.hasAccept ? 'yes' : 'no'}  |  <Comergent> blocks: ${f.summary.blockCount}`
      );
      console.log(`    <OrderInput>: ${f.summary.orderInput}`);
      if (f.summary.orderNumbersInFile.length) {
        console.log(`    <OrderNumber> in file: ${f.summary.orderNumbersInFile.join(', ')}`);
      }
      console.log(
        `    Match ${SHIPMENT}: ${f.summary.blocksMatchingSearchedPo}  |  ${ACCEPT}-only: ${f.summary.acceptOnlyBlocksMatchingSearchedPo}`
      );
    }
    const src = getExportSource(row);
    if (src) {
      console.log(`  First export block: ${src.kind}`);
    }
    console.log('');
  }
}

/**
 * @param {string[]} orderNumbers
 * @param {Set<string>} shipmentOnlySet
 * @param {Array<{ order: string, findings: any[], ordersNoMatch: boolean, statusNoMatch: boolean }>} report
 */
function printCompactSummary(orderNumbers, shipmentOnlySet, report) {
  console.log('\n========== SUMMARY ==========');
  const regularList = orderNumbers.filter((o) => !shipmentOnlySet.has(normPo(o)));
  const shipList = orderNumbers.filter((o) => shipmentOnlySet.has(normPo(o)));
  console.log(
    `Shipment-only (${SHIPMENT} block): ${shipList.length ? shipList.join(', ') : '(none)'}  |  Regular (${ACCEPT} + ${SHIPMENT} pair): ${regularList.length ? regularList.join(', ') : '(none)'}`
  );
  console.log('PO          Mode         XML files  Export');
  console.log('----------  -----------  ---------  ------');

  const issues = [];

  for (let i = 0; i < orderNumbers.length; i++) {
    const order = normPo(orderNumbers[i]);
    const row = report[i];
    if (!row) continue;
    const mode = shipmentOnlySet.has(order) ? 'shipment' : 'regular';
    const n = row.findings.length;
    const src = getExportSource(row);
    let exportCol = '—';
    if (src) {
      exportCol = 'ok';
    } else {
      exportCol = 'skip';
      let why = 'no matching <Comergent>';
      if (n === 0) why = 'no .xml links';
      issues.push(`  ${order}  (${why})`);
    }
    const modePad = mode.padEnd(11);
    const orderPad = order.padEnd(10);
    console.log(`${orderPad}  ${modePad}  ${String(n).padEnd(9)}  ${exportCol}`);
  }

  if (issues.length) {
    console.log('\nNot exported:');
    console.log(issues.join('\n'));
  }
  console.log('');
}

async function main() {
  const parsed = parseOrderArgs();
  let verbose = parsed.verbose || process.env.VERBOSE === '1' || process.env.VERBOSE === 'true';
  let orderNumbers = parsed.orders;
  let shipmentOnlyFromArgs = parsed.shipmentOnly.map(normPo);

  const rl = createInterface({ input, output });

  if (orderNumbers.length === 0) {
    orderNumbers = await promptPoList(rl, 'JCP WCSO PO number(s) for this run:');
  }

  if (orderNumbers.length === 0) {
    console.error('No order numbers provided.');
    await rl.close();
    exit(1);
  }

  orderNumbers = orderNumbers.map(normPo).filter(Boolean);
  const countBeforeDedupe = orderNumbers.length;
  orderNumbers = dedupePoListInOrder(orderNumbers);
  if (orderNumbers.length < countBeforeDedupe) {
    const n = countBeforeDedupe - orderNumbers.length;
    console.log(
      `Note: removed ${n} duplicate PO entr${n === 1 ? 'y' : 'ies'} — each PO is searched and converted once.`
    );
  }

  const orderSet = new Set(orderNumbers);

  /** @type {Set<string>} */
  let shipmentOnlySet = new Set();

  if (shipmentOnlyFromArgs.length > 0) {
    const { set, unknown } = resolveShipmentOnlySelection(shipmentOnlyFromArgs, orderSet);
    shipmentOnlySet = set;
    if (unknown.length) {
      console.log(`Note: ignoring PO(s) not in this run: ${unknown.join(', ')}`);
    }
  } else if (input.isTTY) {
    shipmentOnlySet = await promptShipmentOnlyMode(rl, orderSet, orderNumbers);
  }

  console.log(`\nSearching ${SEARCH_URL} … (${orderNumbers.length} PO(s))`);

  const headless = process.env.HEADFUL === '1' || process.env.HEADFUL === 'true' ? false : true;
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page = await context.newPage();
  let report;
  try {
    report = await fillReport(page, context, orderNumbers, (po, idx, total) => {
      if (!verbose) {
        process.stdout.write(`  [${idx}/${total}] ${po}\n`);
      }
    });
  } finally {
    await browser.close();
  }

  if (verbose) {
    printVerboseReport(report);
  } else {
    printCompactSummary(orderNumbers, shipmentOnlySet, report);
  }

  /** @type {string[]} */
  const shipmentOnlyParts = [];
  /** @type {string[]} */
  const regularParts = [];

  for (let i = 0; i < orderNumbers.length; i++) {
    const order = normPo(orderNumbers[i]);
    const row = report[i];
    if (!row) continue;
    const src = getExportSource(row);
    if (!src) continue;

    if (shipmentOnlySet.has(order)) {
      shipmentOnlyParts.push(buildShipmentBlockLikeHtml(src.block));
    } else {
      regularParts.push(convertComergentBlockPairLikeHtml(src.block));
    }
  }

  const combinedInner = shipmentOnlyParts.join('') + regularParts.join('');

  if (!combinedInner.trim()) {
    console.log('No exportable XML for any PO. Done.\n');
    await rl.close();
    return;
  }

  const okWrite = await promptYesNo(
    rl,
    `\nWrite one ComergentData file: ${shipmentOnlyParts.length} shipment-only block(s), ${regularParts.length} regular pair(s) (no XML declaration on line 1)? [y/N] `
  );

  if (!okWrite) {
    console.log('Skipped write.\n');
    await rl.close();
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = join(OUT_DIR, `converted_order_status_${ts}.xml`);
  const wrapped = wrapComergentData(combinedInner);
  writeFileSync(outPath, wrapped, 'utf8');
  console.log(`Wrote: ${outPath}\n`);

  await rl.close();
}

main().catch((err) => {
  console.error(err);
  exit(1);
});
