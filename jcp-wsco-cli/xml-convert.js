/**
 * Forward conversion from xml-converter.html (XML mode, blue button):
 * ORDER INPUT SHIPMENT → ORDER INPUT ORDER STATUS UPDATE ACCEPT,
 * strip ShipmentDate and JCPOrderShipmentUpdateInfoList.
 */

export const SHIPMENT = 'ORDER INPUT SHIPMENT';
export const ACCEPT = 'ORDER INPUT ORDER STATUS UPDATE ACCEPT';

/**
 * @param {string} block - one <Comergent>...</Comergent> chunk
 * @returns {string}
 */
export function convertComergentBlockToAccept(block) {
  let convertedBlock = block;
  convertedBlock = convertedBlock.replace(/ORDER INPUT SHIPMENT/g, ACCEPT);
  convertedBlock = convertedBlock.replace(/ORDER INPUT ORDER STATUS UPDATE ACCEPT/g, ACCEPT);
  convertedBlock = convertedBlock.replace(/<ShipmentDate>.*?<\/ShipmentDate>/gs, '');
  convertedBlock = convertedBlock.replace(
    /<JCPOrderShipmentUpdateInfoList[^>]*>[\s\S]*?<\/JCPOrderShipmentUpdateInfoList>/g,
    ''
  );
  convertedBlock = convertedBlock.replace(/\n\s*\n\s*\n/g, '\n\n');
  convertedBlock = convertedBlock.replace(/^\s*\n/gm, '');
  return convertedBlock.trim();
}

/**
 * @param {string} xmlText
 * @returns {string[]}
 */
export function splitComergentBlocks(xmlText) {
  return xmlText.split(/(?=<Comergent>)/g).map((b) => b.trim()).filter(Boolean);
}

/**
 * Only blocks that contain ORDER INPUT SHIPMENT are converted.
 * @param {string} xmlText
 * @returns {{ converted: string, skippedBlocks: number, shipmentBlocks: number }}
 */
export function convertXmlDocumentToAcceptOnly(xmlText) {
  const blocks = splitComergentBlocks(xmlText);
  let skippedBlocks = 0;
  let shipmentBlocks = 0;
  const out = [];

  for (const block of blocks) {
    if (!block.includes(SHIPMENT)) {
      skippedBlocks += 1;
      continue;
    }
    shipmentBlocks += 1;
    out.push(convertComergentBlockToAccept(block));
  }

  return {
    converted: out.join('\n\n'),
    skippedBlocks,
    shipmentBlocks,
  };
}

/**
 * @param {string} inner - concatenated <Comergent> blocks
 * @returns {string}
 */
export function wrapComergentData(inner) {
  const body = inner.trim();
  if (!body) return '';
  return `<?xml version="1.0" encoding="UTF-8"?>\n<ComergentData>\n${body}\n</ComergentData>\n`;
}
