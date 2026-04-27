import { fetchWildlinkAppIdsFromGcs } from './wildlink-app-catalog-fetch.js';
import { enrichCatalogWithValidMerchantRateFeeds } from './wildlink-app-catalog-enrich.js';
import { FALLBACK_APP_IDS } from './app-id-catalog.js';
import { loadWildlinkAppDisplayNameMap, displayNameFromMap } from './wildlink-app-display-name-map.js';

const STORAGE_KEY = 'wildlinkAppIdCatalog';
const CACHE_VERSION = 4;
/** Refresh catalog after this many ms. */
const TTL_MS = 24 * 60 * 60 * 1000;

/**
 * @typedef {{ id: number, label: string, feedItemCount?: number | null }} WildlinkAppCatalogEntry
 */

/**
 * @returns {Promise<WildlinkAppCatalogEntry[]|null>}
 */
export async function readFreshCachedWildlinkCatalogEntries() {
  const { [STORAGE_KEY]: entry } = await chrome.storage.local.get(STORAGE_KEY);
  if (!entry || entry.version !== CACHE_VERSION || !Array.isArray(entry.entries) || !entry.fetchedAt) {
    return null;
  }
  const age = Date.now() - new Date(entry.fetchedAt).getTime();
  if (age > TTL_MS) return null;
  const entries = entry.entries
    .filter((e) => e && typeof e.id === 'number' && e.id > 0 && typeof e.label === 'string')
    .map((e) => ({ id: e.id, label: e.label, feedItemCount: e.feedItemCount ?? null }));
  return entries.length ? entries : null;
}

/** @param {WildlinkAppCatalogEntry[]} entries */
export async function writeWildlinkAppCatalogCache(entries) {
  const normalized = [...entries]
    .filter((e) => e && typeof e.id === 'number' && e.id > 0 && String(e.label || '').trim())
    .map((e) => ({
      id: e.id,
      label: String(e.label).trim(),
      feedItemCount: e.feedItemCount ?? null
    }))
    .sort((a, b) => a.id - b.id);
  await chrome.storage.local.set({
    [STORAGE_KEY]: {
      version: CACHE_VERSION,
      entries: normalized,
      fetchedAt: new Date().toISOString()
    }
  });
  return normalized;
}

async function fallbackCatalogEntriesAsync() {
  const map = await loadWildlinkAppDisplayNameMap();
  const rows = [];
  for (const id of FALLBACK_APP_IDS) {
    const label = displayNameFromMap(map, id);
    if (label) rows.push({ id, label, feedItemCount: null });
  }
  return rows;
}

/**
 * Cached validated catalog when fresh; otherwise lists GCS prefixes, filters to merchant-rate feeds, caches.
 * @returns {Promise<WildlinkAppCatalogEntry[]>}
 */
export async function getWildlinkAppCatalogEntries() {
  const cached = await readFreshCachedWildlinkCatalogEntries();
  if (cached) return cached;

  try {
    const candidates = await fetchWildlinkAppIdsFromGcs();
    const entries = await enrichCatalogWithValidMerchantRateFeeds(candidates);
    if (entries.length) {
      return writeWildlinkAppCatalogCache(entries);
    }
  } catch (e) {
    console.warn('[wildlink catalog] build failed:', e);
  }

  return fallbackCatalogEntriesAsync();
}
