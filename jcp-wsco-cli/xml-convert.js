/**
 * Mirrors xml-converter.html XML mode + blue button (convertXML):
 * For each qualifying <Comergent> block: emit ACCEPT-converted block, then SHIPMENT block (regenerated like the HTML).
 */

export const SHIPMENT = 'ORDER INPUT SHIPMENT';
export const ACCEPT = 'ORDER INPUT ORDER STATUS UPDATE ACCEPT';

function poPadWidth() {
  const n = Number(process.env.JCP_PO_PAD_WIDTH);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 8;
}

/**
 * Trim, strip BOM, and left-pad pure-digit order numbers to a fixed width (default 8).
 * Matches XML `<OrderNumber>` values that include leading zeros when the pasted PO omits them.
 * Non-numeric PO strings are returned trimmed only. Set `JCP_PO_PAD_WIDTH` to change width.
 * @param {string | number | null | undefined} s
 * @returns {string}
 */
export function canonicalOrderKey(s) {
  const t = String(s ?? '')
    .trim()
    .replace(/^\uFEFF/, '');
  if (!t) return '';
  const w = poPadWidth();
  if (/^\d+$/.test(t) && t.length < w) {
    return t.padStart(w, '0');
  }
  return t;
}

/**
 * First `<Comergent>...</Comergent>` using depth counting (avoids stopping at a spurious inner `</Comergent>`).
 * @param {string} s
 * @returns {{ openTag: string, inner: string } | null}
 */
function parseComergentElement(s) {
  const text = String(s);
  const start = text.search(/<Comergent\b/i);
  if (start < 0) return null;
  const openMatch = text.slice(start).match(/^<Comergent\b[^>]*>/i);
  if (!openMatch) return null;
  const openEnd = start + openMatch[0].length;
  let depth = 1;
  const re = /<Comergent\b[^>]*>|<\/Comergent>/gi;
  re.lastIndex = openEnd;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (/^<\/Comergent>/i.test(m[0])) {
      depth -= 1;
      if (depth === 0) {
        const inner = text.slice(openEnd, m.index);
        return { openTag: openMatch[0], inner };
      }
    } else {
      depth += 1;
    }
  }
  return null;
}

/** Same algorithm as generateCurrentDate() in xml-converter.html */
function generateCurrentDate() {
  const now = new Date();
  const randomDaysAgo = Math.floor(Math.random() * 10) + 1;
  const shipmentDate = new Date(now);
  shipmentDate.setDate(now.getDate() - randomDaysAgo);
  const year = shipmentDate.getFullYear();
  const month = String(shipmentDate.getMonth() + 1).padStart(2, '0');
  const day = String(shipmentDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day} 0:0:0.0`;
}

function applyShipmentInnerTransforms(inner) {
  let shipmentBlock = inner;
  shipmentBlock = shipmentBlock.replace(/<ShipmentDate>.*?<\/ShipmentDate>/g, '');
  shipmentBlock = shipmentBlock.replace(/ORDER INPUT SHIPMENT/g, SHIPMENT);
  shipmentBlock = shipmentBlock.replace(/ORDER INPUT ORDER STATUS UPDATE ACCEPT/g, SHIPMENT);
  shipmentBlock = shipmentBlock.replace(
    /(<LineStatus>ACCEPT<\/LineStatus>)/g,
    `$1\n                    <ShipmentDate>${generateCurrentDate()}</ShipmentDate>`
  );

  if (!shipmentBlock.includes('<JCPOrderShipmentUpdateInfoList>')) {
    shipmentBlock = shipmentBlock.replace(
      /(<\/OrderShipmentUpdateLineItemList>)/g,
      `$1
            <JCPOrderShipmentUpdateInfoList state="INSERTED">
                <JCPOrderShipmentUpdateInfo state="INSERTED">
                    <TrackingNumber>1Z3A06R10318464892</TrackingNumber>
                    <ShipCarrier>UPS Ground</ShipCarrier>
                    <CarrierSCAC>UPS</CarrierSCAC>
                </JCPOrderShipmentUpdateInfo>
            </JCPOrderShipmentUpdateInfoList>`
    );
  }

  shipmentBlock = shipmentBlock.replace(/\n\s*\n\s*\n/g, '\n\n');
  shipmentBlock = shipmentBlock.replace(/^\s*\n/gm, '');

  return shipmentBlock;
}

/**
 * Second half of the HTML blue-button output: ORDER INPUT SHIPMENT block with dates / tracking.
 * @param {string} block - one <Comergent>...</Comergent> chunk (source may be SHIPMENT or ACCEPT)
 * @returns {string}
 */
export function buildShipmentBlockLikeHtml(block) {
  const parsed = parseComergentElement(block);
  if (!parsed) {
    const t = applyShipmentInnerTransforms(String(block).trim());
    return `<Comergent>\n${t}\n</Comergent>`;
  }
  const inner = applyShipmentInnerTransforms(parsed.inner);
  return `${parsed.openTag}${inner}</Comergent>`;
}

function applyAcceptInnerTransforms(inner) {
  let convertedBlock = inner;
  convertedBlock = convertedBlock.replace(/ORDER INPUT SHIPMENT/g, ACCEPT);
  convertedBlock = convertedBlock.replace(/ORDER INPUT ORDER STATUS UPDATE ACCEPT/g, ACCEPT);
  convertedBlock = convertedBlock.replace(/<ShipmentDate>.*?<\/ShipmentDate>/g, '');
  convertedBlock = convertedBlock.replace(
    /<JCPOrderShipmentUpdateInfoList[^>]*>[\s\S]*?<\/JCPOrderShipmentUpdateInfoList>/g,
    ''
  );
  convertedBlock = convertedBlock.replace(/\n\s*\n\s*\n/g, '\n\n');
  convertedBlock = convertedBlock.replace(/^\s*\n/gm, '');
  return convertedBlock;
}

/**
 * First half of the HTML blue-button output: ORDER INPUT ORDER STATUS UPDATE ACCEPT, no shipment noise.
 * @param {string} block
 * @returns {string}
 */
export function buildAcceptBlockLikeHtml(block) {
  const parsed = parseComergentElement(block);
  if (!parsed) {
    const t = applyAcceptInnerTransforms(String(block).trim());
    return `<Comergent>\n${t}\n</Comergent>`;
  }
  const inner = applyAcceptInnerTransforms(parsed.inner);
  return `${parsed.openTag}${inner}</Comergent>`;
}

/**
 * @param {string} block - one <Comergent>...</Comergent> chunk
 * @returns {string} convertedBlock + shipmentBlock (concatenated, no separator), matching the HTML tool
 */
export function convertComergentBlockPairLikeHtml(block) {
  return buildAcceptBlockLikeHtml(block) + buildShipmentBlockLikeHtml(block);
}

/**
 * When the source is already ACCEPT: export only the SHIPMENT block (per your rule).
 * @param {string} block
 * @returns {string}
 */
export function convertAcceptBlockToShipmentOnlyLikeHtml(block) {
  return buildShipmentBlockLikeHtml(block);
}

/**
 * @param {string} block
 * @returns {string}
 */
export function getOrderNumberFromComergentBlock(block) {
  const m = block.match(/<OrderNumber>\s*([^<]*?)\s*<\/OrderNumber>/i);
  return m ? m[1].trim() : '';
}

/**
 * @param {string} xmlText
 * @returns {string[]}
 */
export function splitComergentBlocks(xmlText) {
  return xmlText
    .split(/(?=<Comergent\b)/i)
    .map((b) => b.trim())
    .filter((b) => /^\s*<Comergent\b/i.test(b));
}

/**
 * Source XML often wraps `<Comergent>` in `<ComergentData>`; split chunks may include trailing `</ComergentData>`.
 * @param {string} fragment
 * @returns {string}
 */
export function isolateComergentElement(fragment) {
  let s = String(fragment)
    .trim()
    .replace(/^\s*<\?xml[^?]*\?>\s*/i, '');
  s = s.replace(/<ComergentData[^>]*>/gi, '').replace(/<\/ComergentData>/gi, '');
  const parsed = parseComergentElement(s);
  if (parsed) return `${parsed.openTag}${parsed.inner}</Comergent>`.trim();
  return s.trim();
}

/**
 * First <Comergent> for this PO that is either regular (SHIPMENT) or accept-only (ACCEPT, no SHIPMENT).
 * @param {string} xmlText
 * @param {string} enteredOrder
 * @returns {{ kind: 'regular' | 'acceptOnly', block: string } | null}
 */
export function getFirstExportBlockForOrder(xmlText, enteredOrder) {
  const normalized = canonicalOrderKey(enteredOrder);
  for (const block of splitComergentBlocks(xmlText)) {
    if (canonicalOrderKey(getOrderNumberFromComergentBlock(block)) !== normalized) continue;
    const isolated = isolateComergentElement(block);
    if (isolated.includes(SHIPMENT)) return { kind: 'regular', block: isolated };
    if (isolated.includes(ACCEPT)) return { kind: 'acceptOnly', block: isolated };
  }
  return null;
}

/**
 * Only <Comergent> blocks whose <OrderNumber> matches enteredOrder and that contain ORDER INPUT SHIPMENT.
 * Output matches the HTML textarea: for each block, ACCEPT version then SHIPMENT version (concatenated).
 *
 * @param {string} xmlText
 * @param {string} enteredOrder - PO the user searched for
 * @param {{ maxMatchingBlocks?: number }} [options] - default: all matches; use 1 for a single pair per document
 */
export function convertXmlForEnteredOrder(xmlText, enteredOrder, options = {}) {
  const maxMatchingBlocks =
    typeof options.maxMatchingBlocks === 'number' && options.maxMatchingBlocks > 0
      ? options.maxMatchingBlocks
      : Number.POSITIVE_INFINITY;

  const normalized = canonicalOrderKey(enteredOrder);
  const blocks = splitComergentBlocks(xmlText);
  let skippedNoShipment = 0;
  let skippedWrongOrder = 0;
  const parts = [];

  for (const block of blocks) {
    if (!block.includes(SHIPMENT)) {
      skippedNoShipment += 1;
      continue;
    }
    const on = canonicalOrderKey(getOrderNumberFromComergentBlock(block));
    if (on !== normalized) {
      skippedWrongOrder += 1;
      continue;
    }
    parts.push(convertComergentBlockPairLikeHtml(isolateComergentElement(block)));
    if (parts.length >= maxMatchingBlocks) {
      break;
    }
  }

  return {
    output: parts.join(''),
    paired: parts.length,
    skippedNoShipment,
    skippedWrongOrder,
    comergentBlockCount: blocks.length,
  };
}

/**
 * Accept-only blocks for this PO: ORDER INPUT ORDER STATUS UPDATE ACCEPT and no SHIPMENT in block.
 * @param {string} xmlText
 * @param {string} enteredOrder
 * @param {{ maxMatchingBlocks?: number }} [options]
 */
export function convertXmlAcceptOnlyToShipmentOnly(xmlText, enteredOrder, options = {}) {
  const maxMatchingBlocks =
    typeof options.maxMatchingBlocks === 'number' && options.maxMatchingBlocks > 0
      ? options.maxMatchingBlocks
      : Number.POSITIVE_INFINITY;

  const normalized = canonicalOrderKey(enteredOrder);
  const blocks = splitComergentBlocks(xmlText);
  let skippedHasShipment = 0;
  let skippedNoAccept = 0;
  const parts = [];

  for (const block of blocks) {
    if (canonicalOrderKey(getOrderNumberFromComergentBlock(block)) !== normalized) continue;
    if (block.includes(SHIPMENT)) {
      skippedHasShipment += 1;
      continue;
    }
    if (!block.includes(ACCEPT)) {
      skippedNoAccept += 1;
      continue;
    }
    parts.push(convertAcceptBlockToShipmentOnlyLikeHtml(isolateComergentElement(block)));
    if (parts.length >= maxMatchingBlocks) {
      break;
    }
  }

  return {
    output: parts.join(''),
    paired: parts.length,
    skippedHasShipment,
    skippedNoAccept,
    comergentBlockCount: blocks.length,
  };
}

/**
 * Same as HTML download: ComergentData wrapper only (no XML declaration).
 * @param {string} inner - concatenated <Comergent> pairs from convertXmlForEnteredOrder
 * @returns {string}
 */
export function wrapComergentData(inner) {
  let body = String(inner).trim();
  if (!body) return '';
  body = body.replace(/<ComergentData[^>]*>/gi, '').replace(/<\/ComergentData>/gi, '');
  body = body.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
  return `<ComergentData>\n${body}\n</ComergentData>\n`;
}
