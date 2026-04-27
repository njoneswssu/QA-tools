/**
 * First install: open Options so the user can sign in to Google and set the spreadsheet.
 * Merchant rate audits run here so they continue after the popup closes (e.g. switching tabs).
 */
import { runAuditJobInServiceWorker } from './lib/background-audit-runner.js';
import { rescheduleMerchantRateAlarm, SCHEDULE_ALARM_NAME } from './lib/schedule-alarms.js';

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage().catch(() => {});
  }
  rescheduleMerchantRateAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  rescheduleMerchantRateAlarm();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.extensionSettings) {
    rescheduleMerchantRateAlarm();
  }
});

/** @type {Promise<unknown> | null} */
let activeAuditPromise = null;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'RUN_MERCHANT_RATE_AUDIT') return;

  if (activeAuditPromise) {
    sendResponse({ ok: false, busy: true });
    return;
  }

  const payload = msg.payload || {};
  activeAuditPromise = runAuditJobInServiceWorker({
    appIds: payload.appIds
  })
    .catch((err) => {
      console.error('[merchant-rate-audit]', err);
    })
    .finally(() => {
      activeAuditPromise = null;
    });

  sendResponse({ ok: true, started: true });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== SCHEDULE_ALARM_NAME) return;
  void handleScheduledAlarm();
});

async function handleScheduledAlarm() {
  const { readExtensionSettings } = await import('./lib/extension-settings.js');
  const s = await readExtensionSettings();
  if (!s.scheduleEnabled) {
    await rescheduleMerchantRateAlarm();
    return;
  }
  const ids = Array.isArray(s.appIdsSelected)
    ? s.appIdsSelected.map((n) => Number(n)).filter((n) => !isNaN(n) && n > 0)
    : [];
  if (!ids.length) {
    await rescheduleMerchantRateAlarm();
    return;
  }
  if (activeAuditPromise) {
    try {
      chrome.alarms.create(SCHEDULE_ALARM_NAME, { delayInMinutes: 2 });
    } catch (e) {
      console.warn('[scheduled audit] retry alarm failed:', e);
    }
    return;
  }
  activeAuditPromise = runAuditJobInServiceWorker({ appIds: ids })
    .catch((err) => {
      console.error('[scheduled audit]', err);
    })
    .finally(() => {
      activeAuditPromise = null;
      rescheduleMerchantRateAlarm();
    });
}
