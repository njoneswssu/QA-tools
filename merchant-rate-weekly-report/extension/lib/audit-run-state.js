/** Persisted merchant-rate audit job so the popup can close while work continues in the service worker. */

export const AUDIT_JOB_STORAGE_KEY = 'merchantRateAuditJob';

/** @returns {Promise<Record<string, unknown>>} */
export async function readAuditJob() {
  const { [AUDIT_JOB_STORAGE_KEY]: job } = await chrome.storage.local.get(AUDIT_JOB_STORAGE_KEY);
  return job && typeof job === 'object' ? job : { phase: 'idle' };
}

/** @param {Record<string, unknown>} job */
export async function writeAuditJob(job) {
  await chrome.storage.local.set({ [AUDIT_JOB_STORAGE_KEY]: job });
}
