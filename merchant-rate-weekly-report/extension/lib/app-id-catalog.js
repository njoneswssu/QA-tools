/**
 * Fallback when the Wildlink GCS catalog has not loaded yet or fetch failed.
 * Shown immediately in the popup (no GCS wait). Live list replaces this when the cache loads.
 */
export const FALLBACK_APP_IDS = [402, 206, 209, 451];

/** Default checkbox selection on first install / empty saved selection. */
export const DEFAULT_SELECTED_APP_IDS = [402];

/** @deprecated use FALLBACK_APP_IDS */
export const AUDITABLE_APP_IDS = FALLBACK_APP_IDS;

export function unionIdsForPicker(catalog, selected) {
  const a = Array.isArray(catalog) ? catalog : [];
  const b = Array.isArray(selected) ? selected : [];
  return [...new Set([...a, ...b])].sort((x, y) => x - y);
}
