/**
 * Single source of truth for extension settings (chrome.storage.local).
 * Migrates legacy flat keys from chrome.storage.sync on first read.
 */

import { DEFAULT_SELECTED_APP_IDS } from './app-id-catalog.js';

const STORAGE_KEY = 'extensionSettings';

/** Default Google Sheet for export (from product URL / ID). */
export const DEFAULT_SPREADSHEET_ID = '194oJaxgMLAfoFvPgbqVOfTZnU3mVBSqT-hl8EIOnNQE';

export const DEFAULT_EXTENSION_SETTINGS = {
  appIdsText: DEFAULT_SELECTED_APP_IDS.join(', '),
  appIdsSelected: [...DEFAULT_SELECTED_APP_IDS],
  useBigQuery: true,
  syncToSheets: true,
  spreadsheetId: DEFAULT_SPREADSHEET_ID,
  bqProjectId: 'wildfire-1000',
  bqDateColumn: '',
  bqLookbackMonths: 6,
  /** When true, run audit on scheduleDayOfWeek + scheduleTimeLocal (local time). */
  scheduleEnabled: true,
  /** Monday = 1 … Sunday = 7 */
  scheduleDayOfWeek: 1,
  /** "HH:MM" 24h local */
  scheduleTimeLocal: '09:00'
};

function parseLegacyAppIdsText(txt) {
  const raw = String(txt || '')
    .split(/[,\s\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out = [];
  const seen = new Set();
  for (const t of raw) {
    if (!/^\d+$/.test(t)) continue;
    const n = parseInt(t, 10);
    if (n > 0 && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out.sort((a, b) => a - b);
}

function normalize(s) {
  const src = s && typeof s === 'object' ? { ...s } : {};
  delete src.commissionCsvText;

  let appIdsSelected;
  if (Array.isArray(src.appIdsSelected)) {
    appIdsSelected = [...new Set(src.appIdsSelected.map(Number).filter((n) => !isNaN(n) && n > 0))].sort(
      (a, b) => a - b
    );
  } else if (String(src.appIdsText || '').trim()) {
    appIdsSelected = parseLegacyAppIdsText(src.appIdsText);
  } else {
    appIdsSelected = [...DEFAULT_SELECTED_APP_IDS];
  }

  const useBigQuery =
    src.useBigQuery === undefined || src.useBigQuery === null
      ? DEFAULT_EXTENSION_SETTINGS.useBigQuery
      : !!src.useBigQuery;

  const syncToSheets =
    src.syncToSheets === undefined || src.syncToSheets === null
      ? DEFAULT_EXTENSION_SETTINGS.syncToSheets
      : !!src.syncToSheets;

  const sid = String(src.spreadsheetId || '').trim();
  const spreadsheetId = sid || DEFAULT_EXTENSION_SETTINGS.spreadsheetId;

  const schedDay = Number(src.scheduleDayOfWeek);
  const scheduleDayOfWeek =
    Number.isFinite(schedDay) && schedDay >= 1 && schedDay <= 7
      ? Math.floor(schedDay)
      : DEFAULT_EXTENSION_SETTINGS.scheduleDayOfWeek;

  const schedTime = String(src.scheduleTimeLocal || '').trim();
  const scheduleTimeLocal = /^\d{1,2}:\d{2}$/.test(schedTime)
    ? schedTime
    : DEFAULT_EXTENSION_SETTINGS.scheduleTimeLocal;

  const scheduleEnabled =
    src.scheduleEnabled === undefined || src.scheduleEnabled === null
      ? DEFAULT_EXTENSION_SETTINGS.scheduleEnabled
      : !!src.scheduleEnabled;

  return {
    ...DEFAULT_EXTENSION_SETTINGS,
    ...src,
    appIdsSelected,
    appIdsText: appIdsSelected.join(', '),
    useBigQuery,
    syncToSheets,
    spreadsheetId,
    bqLookbackMonths: Math.max(
      1,
      Math.min(36, Number(src.bqLookbackMonths) || DEFAULT_EXTENSION_SETTINGS.bqLookbackMonths)
    ),
    bqProjectId: String(src.bqProjectId || DEFAULT_EXTENSION_SETTINGS.bqProjectId).trim() || 'wildfire-1000',
    scheduleEnabled,
    scheduleDayOfWeek,
    scheduleTimeLocal
  };
}

export async function readExtensionSettings() {
  const { [STORAGE_KEY]: stored } = await chrome.storage.local.get(STORAGE_KEY);
  if (stored && typeof stored === 'object') {
    return normalize(stored);
  }

  const legacyKeys = [
    'appIdsText',
    'useBigQuery',
    'syncToSheets',
    'spreadsheetId',
    'bqProjectId',
    'bqDateColumn',
    'bqLookbackMonths'
  ];
  const syncFlat = await chrome.storage.sync.get(legacyKeys);
  const migrated = normalize({
    appIdsText: syncFlat.appIdsText ?? '',
    useBigQuery:
      syncFlat.useBigQuery === undefined || syncFlat.useBigQuery === null
        ? DEFAULT_EXTENSION_SETTINGS.useBigQuery
        : !!syncFlat.useBigQuery,
    syncToSheets:
      syncFlat.syncToSheets === undefined || syncFlat.syncToSheets === null
        ? DEFAULT_EXTENSION_SETTINGS.syncToSheets
        : !!syncFlat.syncToSheets,
    spreadsheetId: syncFlat.spreadsheetId || DEFAULT_SPREADSHEET_ID,
    bqProjectId: syncFlat.bqProjectId,
    bqDateColumn: syncFlat.bqDateColumn ?? '',
    bqLookbackMonths: syncFlat.bqLookbackMonths
  });

  await chrome.storage.local.set({ [STORAGE_KEY]: migrated });
  return migrated;
}

/**
 * Parse user JSON (flat object or `{ "extensionSettings": { … } }`).
 * @param {string|object} raw
 * @returns {ReturnType<typeof normalize>}
 */
export function sanitizeImportedSettings(raw) {
  let obj = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch (e) {
      throw new Error('Invalid JSON: ' + (e.message || e));
    }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new Error('JSON must be a single object');
  }
  const inner = obj.extensionSettings && typeof obj.extensionSettings === 'object' ? obj.extensionSettings : obj;
  const picked = {};
  for (const k of Object.keys(DEFAULT_EXTENSION_SETTINGS)) {
    if (inner[k] !== undefined) picked[k] = inner[k];
  }
  if (Object.keys(picked).length === 0) {
    throw new Error('No recognized keys. Expected fields like: ' + Object.keys(DEFAULT_EXTENSION_SETTINGS).join(', '));
  }
  return normalize(picked);
}

export async function writeExtensionSettings(patch) {
  const cur = await readExtensionSettings();
  const next = normalize({ ...cur, ...patch });
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  try {
    await chrome.storage.sync.set({
      appIdsText: next.appIdsText,
      appIdsSelected: next.appIdsSelected,
      useBigQuery: next.useBigQuery,
      syncToSheets: next.syncToSheets,
      spreadsheetId: next.spreadsheetId,
      bqProjectId: next.bqProjectId,
      bqDateColumn: next.bqDateColumn,
      bqLookbackMonths: next.bqLookbackMonths
    });
  } catch (e) {
    console.warn('[extension] chrome.storage.sync.set failed (local save still applied):', e);
  }
  return next;
}
