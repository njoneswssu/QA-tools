/**
 * Fallback when the Wildlink GCS catalog has not loaded yet or fetch failed.
 * Live list comes from `wildlink-app-catalog-cache.js` (merchant-rate–valid apps only).
 */
export const FALLBACK_APP_IDS = [451, 206, 209];

/** @deprecated use FALLBACK_APP_IDS */
export const AUDITABLE_APP_IDS = FALLBACK_APP_IDS;

export function unionIdsForPicker(catalog, selected) {
  const a = Array.isArray(catalog) ? catalog : [];
  const b = Array.isArray(selected) ? selected : [];
  return [...new Set([...a, ...b])].sort((x, y) => x - y);
}
