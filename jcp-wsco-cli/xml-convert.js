/**
 * Mirrors xml-converter.html XML mode + blue button (convertXML):
 * For each qualifying <Comergent> block: emit ACCEPT-converted block, then SHIPMENT block (regenerated like the HTML).
 */

export const SHIPMENT = 'ORDER INPUT SHIPMENT';
export const ACCEPT = 'ORDER INPUT ORDER STATUS UPDATE ACCEPT';

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

/**
 * @param {string} block - one <Comergent>...</Comergent> chunk
 * @returns {string} convertedBlock + shipmentBlock (concatenated, no separator), matching the HTML tool
 */
export function convertComergentBlockPairLikeHtml(block) {
  let convertedBlock = block;

  convertedBlock = convertedBlock.replace(/ORDER INPUT SHIPMENT/g, ACCEPT);
  convertedBlock = convertedBlock.replace(/ORDER INPUT ORDER STATUS UPDATE ACCEPT/g, ACCEPT);
  convertedBlock = convertedBlock.replace(/<ShipmentDate>.*?<\/ShipmentDate>/g, '');
  convertedBlock = convertedBlock.replace(
    /<JCPOrderShipmentUpdateInfoList[^>]*>[\s\S]*?<\/JCPOrderShipmentUpdateInfoList>/g,
    ''
  );

  let shipmentBlock = block;
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

  convertedBlock = convertedBlock.replace(/\n\s*\n\s*\n/g, '\n\n');
  convertedBlock = convertedBlock.replace(/^\s*\n/gm, '');
  shipmentBlock = shipmentBlock.replace(/\n\s*\n\s*\n/g, '\n\n');
  shipmentBlock = shipmentBlock.replace(/^\s*\n/gm, '');

  return convertedBlock + shipmentBlock;
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

  const normalized = enteredOrder.trim();
  const blocks = splitComergentBlocks(xmlText);
  let skippedNoShipment = 0;
  let skippedWrongOrder = 0;
  const parts = [];

  for (const block of blocks) {
    if (!block.includes(SHIPMENT)) {
      skippedNoShipment += 1;
      continue;
    }
    const on = getOrderNumberFromComergentBlock(block);
    if (on !== normalized) {
      skippedWrongOrder += 1;
      continue;
    }
    parts.push(convertComergentBlockPairLikeHtml(block));
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
 * Same as HTML download: ComergentData wrapper only (no XML declaration).
 * @param {string} inner - concatenated <Comergent> pairs from convertXmlForEnteredOrder
 * @returns {string}
 */
export function wrapComergentData(inner) {
  const body = inner.trim();
  if (!body) return '';
  return `<ComergentData>\n${body}\n</ComergentData>\n`;
}
