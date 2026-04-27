import { loadWildlinkAppDisplayNameMap, displayNameFromMap } from './wildlink-app-display-name-map.js';

const MANIFEST_URL = (id) =>
  `https://storage.googleapis.com/wildlink/cloud-db/1/${id}/merchant-rate-model-manifest.json`;

/** Concurrent manifest checks per batch (same origin). */
const BATCH = 14;

/**
 * @param {number} id
 * @param {Record<string, string>} nameMap
 * @returns {Promise<{ id: number, label: string, feedItemCount: number | null } | null>}
 */
async function fetchOneIfNamed(id, nameMap) {
  const displayName = displayNameFromMap(nameMap, id);
  if (!displayName) return null;

  try {
    const res = await fetch(MANIFEST_URL(id));
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const m = await res.json();
    const n = Number(m && m.FeedItemCount);
    const feedItemCount = !isNaN(n) && n >= 0 ? n : null;
    return { id, label: displayName, feedItemCount };
  } catch {
    return null;
  }
}

/**
 * Apps that publish a merchant-rate manifest **and** have a display name in
 * `data/wildlink-app-display-names.json`.
 * @param {number[]} candidateIds
 * @returns {Promise<Array<{ id: number, label: string, feedItemCount: number | null }>>}
 */
export async function enrichCatalogWithValidMerchantRateFeeds(candidateIds) {
  const nameMap = await loadWildlinkAppDisplayNameMap();
  const fromGcs = [...new Set(candidateIds.map(Number).filter((n) => !isNaN(n) && n > 0))];
  const fromJson = Object.keys(nameMap)
    .filter((k) => /^\d+$/.test(k))
    .map((k) => parseInt(k, 10))
    .filter((n) => n > 0);
  const merged = [...new Set([...fromGcs, ...fromJson])].sort((a, b) => a - b);
  /** Only IDs with a display name are checked for a merchant-rate manifest (avoids hundreds of HTTP calls). */
  const namedOnly = merged.filter((id) => displayNameFromMap(nameMap, id));
  const out = [];
  for (let i = 0; i < namedOnly.length; i += BATCH) {
    const chunk = namedOnly.slice(i, i + BATCH);
    const batch = await Promise.all(chunk.map((id) => fetchOneIfNamed(id, nameMap)));
    for (const row of batch) {
      if (row) out.push(row);
    }
  }
  return out.sort((a, b) => a.id - b.id);
}
