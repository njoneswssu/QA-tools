#!/usr/bin/env node
/**
 * Interactive CLI: search JCP WSCO POs on transfer.levsuite.com, inspect XML hits,
 * and convert using the same rules as ../xml-converter.html.
 */

import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output, argv, exit } from 'node:process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

import {
  SHIPMENT,
  ACCEPT,
  convertXmlForEnteredOrder,
  convertAcceptBlockToShipmentOnlyLikeHtml,
  convertComergentBlockPairLikeHtml,
  getOrderNumberFromComergentBlock,
  getFirstExportBlockForOrder,
  wrapComergentData,
  splitComergentBlocks,
} from './xml-convert.js';

const SEARCH_URL = 'http://transfer.levsuite.com/search_wsco.php';
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, 'output');

function parseOrderArgs() {
  const args = argv.slice(2);
  const orders = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--orders' && args[i + 1]) {
      orders.push(
        ...args[i + 1]
          .split(/[\s,]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      );
      i++;
    } else if (!args[i].startsWith('--')) {
      orders.push(args[i].trim());
    }
  }
  return orders.filter(Boolean);
}

function parseOrderLine(line) {
  return line
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function promptLine(rl, question) {
  return (await rl.question(question)).trim();
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
  const normalized = searchedOrder.trim();
  let acceptOnlyBlocksMatchingSearchedPo = 0;
  for (const block of blocks) {
    if (getOrderNumberFromComergentBlock(block) !== normalized) continue;
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
 */
async function fillReport(page, context, orderNumbers) {
  /** @type {Array<{ order: string, findings: Array<object>, ordersNoMatch: boolean, statusNoMatch: boolean }>} */
  const report = [];

  for (const order of orderNumbers) {
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
function printReport(report) {
  console.log('========== RESULTS ==========\n');

  for (const row of report) {
    console.log(`--- PO ${row.order} (searched) ---`);
    if (row.findings.length === 0) {
      console.log('  No .xml links on the results page.');
      if (row.ordersNoMatch) console.log('  (Orders: no results message present.)');
      if (row.statusNoMatch) console.log('  (Status: no results message present.)');
    }
    for (const f of row.findings) {
      console.log(`  [${f.category}] ${f.abs}`);
      console.log(`    HTTP: ${f.httpStatus || '—'}${f.fetchError ? `  Error: ${f.fetchError}` : ''}`);
      console.log(
        `    ORDER INPUT SHIPMENT: ${f.summary.hasShipment ? 'yes' : 'no'}  |  ${ACCEPT}: ${f.summary.hasAccept ? 'yes' : 'no'}  |  <Comergent> blocks: ${f.summary.blockCount}`
      );
      console.log(`    <OrderInput> value: ${f.summary.orderInput}`);
      if (f.summary.orderNumbersInFile.length) {
        console.log(`    <OrderNumber> in file: ${f.summary.orderNumbersInFile.join(', ')}`);
      }
      console.log(
        `    Blocks matching PO with ${SHIPMENT}: ${f.summary.blocksMatchingSearchedPo}  |  with ${ACCEPT} only (no ${SHIPMENT}): ${f.summary.acceptOnlyBlocksMatchingSearchedPo}  (other PO in file: ${f.summary.skippedWrongOrder}, no ${SHIPMENT}: ${f.summary.skippedNoShipment})`
      );
    }

    const withShipment = row.findings.filter((f) => f.summary.blocksMatchingSearchedPo > 0 && f.rawXml);
    const withAcceptOnly = row.findings.filter((f) => f.summary.acceptOnlyBlocksMatchingSearchedPo > 0 && f.rawXml);
    if (withShipment.length > 1) {
      console.log(
        `  Note: ${withShipment.length} XML files have ${SHIPMENT} blocks for PO ${row.order}; export uses the first such file (one block).`
      );
    } else if (withShipment.length === 1 && withShipment[0].summary.blocksMatchingSearchedPo > 1) {
      console.log(
        `  Note: that file has ${withShipment[0].summary.blocksMatchingSearchedPo} matching ${SHIPMENT} blocks; export uses the first block only.`
      );
    }
    if (withAcceptOnly.length > 1) {
      console.log(
        `  Note: ${withAcceptOnly.length} XML files have ${ACCEPT}-only blocks for PO ${row.order}; export uses the first such file (one block).`
      );
    }

    const src = getExportSource(row);
    if (src) {
      console.log(`  Export classification for PO ${row.order}: ${src.kind === 'regular' ? 'regular (' + ACCEPT + ' + ' + SHIPMENT + ' pair)' : 'ACCEPT-only (shipment block only if you confirm)'}`);
    }

    console.log('');
  }
}

async function main() {
  const headless = process.env.HEADFUL === '1' || process.env.HEADFUL === 'true' ? false : true;

  let orderNumbers = parseOrderArgs();
  const rl = createInterface({ input, output });

  if (orderNumbers.length === 0) {
    const line = await promptLine(rl, 'Enter JCP WCSO PO number(s), separated by commas or spaces: ');
    orderNumbers = parseOrderLine(line);
  }

  if (orderNumbers.length === 0) {
    console.error('No order numbers provided.');
    await rl.close();
    exit(1);
  }

  console.log(`\nSearching ${SEARCH_URL} for: ${orderNumbers.join(', ')}\n`);

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page = await context.newPage();
  let report;
  try {
    report = await fillReport(page, context, orderNumbers);
  } finally {
    await browser.close();
  }

  printReport(report);

  const perPo = report.map((row) => ({ row, src: getExportSource(row) }));
  const acceptList = perPo.filter((p) => p.src?.kind === 'acceptOnly');
  const regularList = perPo.filter((p) => p.src?.kind === 'regular');

  if (acceptList.length === 0 && regularList.length === 0) {
    console.log(
      `No <Comergent> blocks with <OrderNumber> matching your PO(s) and (${SHIPMENT} or ${ACCEPT}) were found. Done.\n`
    );
    await rl.close();
    return;
  }

  /** @type {string[]} */
  const shipmentOnlyParts = [];
  /** @type {string[]} */
  const regularParts = [];

  if (acceptList.length > 0) {
    const poStr = acceptList.map((p) => p.row.order).join(', ');
    const okAccept = await promptYesNo(
      rl,
      `\nHave these POs already been accepted?\nPO(s): ${poStr}\n(${ACCEPT} in the matching block, no ${SHIPMENT}.)\nIf yes, export only the ORDER INPUT SHIPMENT block for these? [y/N] `
    );
    if (okAccept) {
      for (const p of acceptList) {
        shipmentOnlyParts.push(convertAcceptBlockToShipmentOnlyLikeHtml(p.src.block));
      }
    }
  }

  const regularQuestion =
    regularList.length > 0
      ? `\nInclude regular conversion (${ACCEPT} block + ${SHIPMENT} block, as in xml-converter.html) for PO(s): ${regularList.map((p) => p.row.order).join(', ')}? [y/N] `
      : `\nDo you have any order numbers that need regular conversion (${ACCEPT} + ${SHIPMENT} pair)? [y/N] `;

  const wantRegular = await promptYesNo(rl, regularQuestion);

  if (wantRegular) {
    if (regularList.length > 0) {
      for (const p of regularList) {
        regularParts.push(convertComergentBlockPairLikeHtml(p.src.block));
      }
    } else {
      const extraLine = await promptLine(
        rl,
        'Enter PO number(s) for regular conversion (comma or space separated): '
      );
      const extraOrders = parseOrderLine(extraLine);
      if (extraOrders.length === 0) {
        console.log('No POs entered; skipping regular conversion from this step.\n');
      } else {
        console.log(`\nSearching ${SEARCH_URL} for: ${extraOrders.join(', ')}\n`);
        const browser2 = await chromium.launch({ headless });
        const context2 = await browser2.newContext();
        const page2 = await context2.newPage();
        let report2;
        try {
          report2 = await fillReport(page2, context2, extraOrders);
        } finally {
          await browser2.close();
        }
        printReport(report2);
        for (const row of report2) {
          const src = getExportSource(row);
          if (src?.kind === 'regular') {
            regularParts.push(convertComergentBlockPairLikeHtml(src.block));
          } else if (src?.kind === 'acceptOnly') {
            console.log(
              `  Note: PO ${row.order} is ${ACCEPT}-only in this pass; it was not added as a regular pair. Re-run with that PO in the first search if you need ACCEPT-only export.\n`
            );
          } else {
            console.log(`  Note: PO ${row.order} had no exportable block for regular conversion.\n`);
          }
        }
      }
    }
  }

  const combinedInner = shipmentOnlyParts.join('') + regularParts.join('');

  if (!combinedInner.trim()) {
    console.log('Nothing selected to write. Done.\n');
    await rl.close();
    return;
  }

  const okWrite = await promptYesNo(
    rl,
    `\nWrite one ComergentData file with ${shipmentOnlyParts.length} shipment-only <Comergent> block(s) and ${regularParts.length} regular pair(s) (no XML declaration on line 1)? [y/N] `
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
