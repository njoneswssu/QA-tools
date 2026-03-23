#!/usr/bin/env node
/**
 * Interactive CLI: search JCP WSCO POs on transfer.levsuite.com, inspect XML hits,
 * and optionally convert ORDER INPUT SHIPMENT → ORDER INPUT ORDER STATUS UPDATE ACCEPT
 * using the same rules as ../xml-converter.html (XML mode, blue button).
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
  getOrderNumberFromComergentBlock,
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

async function promptLine(rl, question) {
  const answer = (await rl.question(question)).trim();
  return answer;
}

async function promptYesNo(rl, question) {
  const a = (await rl.question(question)).trim().toLowerCase();
  return a === 'y' || a === 'yes';
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

/**
 * Categorize links from results (best-effort from href).
 * @param {string} href
 */
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
  const converted = convertXmlForEnteredOrder(text, searchedOrder);
  return {
    hasShipment,
    hasAccept,
    blockCount,
    orderInput,
    orderNumbersInFile,
    blocksMatchingSearchedPo: converted.paired,
    skippedWrongOrder: converted.skippedWrongOrder,
    skippedNoShipment: converted.skippedNoShipment,
    convertOutput: converted.output,
  };
}

async function main() {
  const headless = process.env.HEADFUL === '1' || process.env.HEADFUL === 'true' ? false : true;

  let orderNumbers = parseOrderArgs();
  const rl = createInterface({ input, output });

  if (orderNumbers.length === 0) {
    const line = await promptLine(
      rl,
      'Enter JCP WCSO PO number(s), separated by commas or spaces: '
    );
    orderNumbers = line
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
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

  /** @type {Array<{ order: string, findings: Array<{ category: string, href: string, abs: string, httpStatus: number, summary: ReturnType<typeof buildSummaryAndConvert>, rawXml?: string, fetchError?: string }>, ordersNoMatch: boolean, statusNoMatch: boolean }>} */
  const report = [];

  try {
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
  } finally {
    await browser.close();
  }

  console.log('========== RESULTS ==========\n');

  /** @type {string[]} */
  const allConvertedInner = [];

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
        `    Blocks matching searched PO ${row.order} with ${SHIPMENT}: ${f.summary.blocksMatchingSearchedPo}  (other PO in file: ${f.summary.skippedWrongOrder}, no ${SHIPMENT}: ${f.summary.skippedNoShipment})`
      );

      if (f.summary.convertOutput) {
        allConvertedInner.push(f.summary.convertOutput);
      }
    }
    console.log('');
  }

  const convertibleCount = allConvertedInner.length;
  if (convertibleCount === 0) {
    console.log(
      `No <Comergent> blocks with ${SHIPMENT} and <OrderNumber> matching your entered PO(s) were found. Done.\n`
    );
    rl.close();
    return;
  }

  const ok = await promptYesNo(
    rl,
    `\nWrite ${convertibleCount} result bundle(s) (${ACCEPT} block + ${SHIPMENT} block each, as in xml-converter.html) into one ComergentData file (no XML declaration)? [y/N] `
  );

  if (!ok) {
    console.log('Skipped write.\n');
    rl.close();
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = join(OUT_DIR, `converted_order_status_${ts}.xml`);
  const wrapped = wrapComergentData(allConvertedInner.join(''));
  writeFileSync(outPath, wrapped, 'utf8');
  console.log(`Wrote: ${outPath}\n`);

  rl.close();
}

main().catch((err) => {
  console.error(err);
  exit(1);
});
