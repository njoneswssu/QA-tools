/**
 * Weekly schedule in the user's local timezone.
 * Day: Monday = 1 … Sunday = 7 (matches HTML select values).
 */

/**
 * @param {number} dayMon1Sun7 Monday=1 … Sunday=7
 * @param {string} timeHHmm "HH:MM" 24h
 * @param {Date} [from]
 * @returns {Date | null}
 */
export function getNextScheduledRunDate(dayMon1Sun7, timeHHmm, from = new Date()) {
  const d = Number(dayMon1Sun7);
  if (!Number.isFinite(d) || d < 1 || d > 7) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(timeHHmm || '').trim());
  if (!m) return null;
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  const jsDow = d === 7 ? 0 : d;
  const cand = new Date(from);
  cand.setMilliseconds(0);
  cand.setSeconds(0, 0);
  cand.setHours(hh, mm, 0, 0);
  let add = (jsDow - cand.getDay() + 7) % 7;
  cand.setDate(cand.getDate() + add);
  if (cand.getTime() <= from.getTime()) {
    cand.setDate(cand.getDate() + 7);
  }
  return cand;
}

/**
 * @param {number} dayMon1Sun7
 * @param {string} timeHHmm
 * @param {Date} [from]
 * @returns {number | null} epoch ms
 */
export function getNextScheduledRunMs(dayMon1Sun7, timeHHmm, from = new Date()) {
  const d = getNextScheduledRunDate(dayMon1Sun7, timeHHmm, from);
  return d ? d.getTime() : null;
}

/**
 * @param {number} msDelta
 * @returns {string}
 */
export function formatCountdown(msDelta) {
  if (!Number.isFinite(msDelta) || msDelta < 0) return '0s';
  const s = Math.floor(msDelta / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}
