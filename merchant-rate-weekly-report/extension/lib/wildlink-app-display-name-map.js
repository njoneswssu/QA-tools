/**
 * Human-readable application names (Wildlink campaign / app IDs).
 * Source: extension/data/wildlink-app-display-names.json (ship + edit locally).
 */

/** @type {Record<string, string> | null} */
let cachedMap = null;

function normalizeMap(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw)) {
    if (k.startsWith('_')) continue;
    if (!/^\d+$/.test(k)) continue;
    if (typeof v !== 'string' || !v.trim()) continue;
    out[k] = v.trim();
  }
  return out;
}

/**
 * @returns {Promise<Record<string, string>>}
 */
export async function loadWildlinkAppDisplayNameMap() {
  if (cachedMap) return cachedMap;
  const url = chrome.runtime.getURL('data/wildlink-app-display-names.json');
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn('[wildlink] display names JSON HTTP', res.status);
      cachedMap = {};
      return cachedMap;
    }
    cachedMap = normalizeMap(await res.json());
    return cachedMap;
  } catch (e) {
    console.warn('[wildlink] display names JSON load failed:', e);
    cachedMap = {};
    return cachedMap;
  }
}

/** @param {Record<string, string>} map */
export function displayNameFromMap(map, id) {
  if (!map || id == null) return '';
  const v = map[String(id)];
  return typeof v === 'string' && v.trim() ? v.trim() : '';
}

/** All numeric application IDs present in the display-name map (same rules as `normalizeMap`). */
export function sortedAppIdsFromDisplayNameMap(map) {
  if (!map || typeof map !== 'object') return [];
  const ids = [];
  for (const k of Object.keys(map)) {
    if (k.startsWith('_')) continue;
    if (!/^\d+$/.test(k)) continue;
    const n = parseInt(k, 10);
    if (n > 0) ids.push(n);
  }
  return [...new Set(ids)].sort((a, b) => a - b);
}
