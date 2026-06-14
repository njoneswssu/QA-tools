import { readExtensionSettings } from './extension-settings.js';
import { getNextScheduledRunMs } from './schedule-next-run.js';

export const SCHEDULE_ALARM_NAME = 'merchantRateWeeklyScheduled';

export async function rescheduleMerchantRateAlarm() {
  try {
    await chrome.alarms.clear(SCHEDULE_ALARM_NAME);
  } catch {
    /* ignore */
  }
  let s;
  try {
    s = await readExtensionSettings();
  } catch (e) {
    console.warn('[schedule] readExtensionSettings failed:', e);
    return;
  }
  if (!s.scheduleEnabled) return;
  const day = Number(s.scheduleDayOfWeek);
  const time = String(s.scheduleTimeLocal || '').trim();
  const when = getNextScheduledRunMs(day, time);
  if (when == null) return;
  const delay = when - Date.now();
  if (delay < 1000) return;
  try {
    chrome.alarms.create(SCHEDULE_ALARM_NAME, { when });
  } catch (e) {
    console.warn('[schedule] alarms.create failed:', e);
  }
}
