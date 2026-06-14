/**
 * Lists application IDs from Wildlink’s public GCS bucket (same tree as wildlink.me/data/{id}/… redirects).
 * @see https://storage.googleapis.com/wildlink?prefix=cloud-db/1/&delimiter=/
 */

const LIST_URL = 'https://storage.googleapis.com/wildlink';
const PREFIX = 'cloud-db/1/';
const MAX_PAGES = 500;

function parsePrefixes(xml) {
  const out = [];
  const re = /<Prefix>cloud-db\/1\/(\d+)\/<\/Prefix>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const n = parseInt(m[1], 10);
    if (n > 0) out.push(n);
  }
  return out;
}

function parseTruncation(xml) {
  const t = /<IsTruncated>([^<]+)<\/IsTruncated>/.exec(xml);
  return t && String(t[1]).toLowerCase() === 'true';
}

function parseNextMarker(xml) {
  const m = /<NextMarker>([^<]+)<\/NextMarker>/.exec(xml);
  return m ? m[1] : '';
}

export async function fetchWildlinkAppIdsFromGcs() {
  const ids = new Set();
  let marker = '';
  let pages = 0;

  while (pages < MAX_PAGES) {
    pages += 1;
    const url = new URL(LIST_URL);
    url.searchParams.set('prefix', PREFIX);
    url.searchParams.set('delimiter', '/');
    url.searchParams.set('max-keys', '1000');
    if (marker) url.searchParams.set('marker', marker);

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Wildlink catalog list failed: HTTP ${res.status}`);
    }
    const xml = await res.text();
    for (const id of parsePrefixes(xml)) ids.add(id);

    if (!parseTruncation(xml)) break;
    const next = parseNextMarker(xml);
    if (!next) break;
    marker = next;
  }

  return [...ids].sort((a, b) => a - b);
}
