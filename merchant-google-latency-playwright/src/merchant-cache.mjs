/**
 * Local JSON backup of Wildlink merchants per app id (default app 209) so the UI
 * does not hit the network on every page load.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

/** @param {string} root Project root (parent of `data/`). @param {number} appId */
export function merchantBackupPath(root, appId) {
  return join(root, 'data', `merchants-app-${appId}.json`);
}

/**
 * @param {string} root
 * @param {number} appId
 * @param {number} maxAgeMs
 * @returns {{ merchants: { id: string; name: string }[]; fetchedAt: string } | null}
 */
export function readCachedMerchants(root, appId, maxAgeMs) {
  const p = merchantBackupPath(root, appId);
  if (!existsSync(p)) return null;
  try {
    const data = JSON.parse(readFileSync(p, 'utf8'));
    if (!Array.isArray(data.merchants)) return null;
    const fetchedAt = data.fetchedAt ? new Date(data.fetchedAt).getTime() : 0;
    if (!fetchedAt || Number.isNaN(fetchedAt)) return null;
    if (Date.now() - fetchedAt > maxAgeMs) return null;
    return { merchants: data.merchants, fetchedAt: data.fetchedAt };
  } catch {
    return null;
  }
}

/** Read backup ignoring TTL (used when network fails or `refresh` is forced after failed fetch). */
export function readStaleMerchantBackup(root, appId) {
  const p = merchantBackupPath(root, appId);
  if (!existsSync(p)) return null;
  try {
    const data = JSON.parse(readFileSync(p, 'utf8'));
    if (!Array.isArray(data.merchants)) return null;
    return { merchants: data.merchants, fetchedAt: data.fetchedAt || null };
  } catch {
    return null;
  }
}

/**
 * @param {string} root
 * @param {number} appId
 * @param {{ id: string; name: string }[]} merchants
 */
export function writeMerchantBackup(root, appId, merchants) {
  mkdirSync(join(root, 'data'), { recursive: true });
  const payload = {
    appId,
    fetchedAt: new Date().toISOString(),
    merchants
  };
  writeFileSync(merchantBackupPath(root, appId), JSON.stringify(payload));
}
