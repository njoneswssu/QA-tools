/**
 * Refresh `data/merchants-app-<APP_ID>.json` from Wildlink (same source as the UI).
 * Run: `npm run sync:merchants` or `APP_ID=209 node src/sync-merchant-cache.mjs`
 */
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { fetchMerchants } from './latency-core.mjs';
import { writeMerchantBackup } from './merchant-cache.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const APP_ID = Number(process.env.APP_ID || '209');

const merchants = await fetchMerchants(APP_ID);
writeMerchantBackup(ROOT, APP_ID, merchants);
console.log(`Wrote ${merchants.length} merchants for app ${APP_ID} ?`, join(ROOT, 'data', `merchants-app-${APP_ID}.json`));
