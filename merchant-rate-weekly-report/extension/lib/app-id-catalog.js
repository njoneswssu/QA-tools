/**
 * Default checkbox selection on first install / empty saved selection.
 * Also used when `wildlink-app-display-names.json` has no numeric keys (should not happen in normal use).
 */
export const DEFAULT_SELECTED_APP_IDS = [402];

export function unionIdsForPicker(catalog, selected) {
  const a = Array.isArray(catalog) ? catalog : [];
  const b = Array.isArray(selected) ? selected : [];
  return [...new Set([...a, ...b])].sort((x, y) => x - y);
}
