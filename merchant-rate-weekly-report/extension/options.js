import {
  signInWithGoogleInteractive,
  revokeGoogleAuth,
  getGoogleAuthToken
} from './lib/google-auth.js';
import {
  readExtensionSettings,
  writeExtensionSettings,
  sanitizeImportedSettings
} from './lib/extension-settings.js';
import {
  isOAuthClientConfigured,
  oauthClientPrecheckMessage,
  friendlyGoogleAuthError,
  isUserCancelledAuthError
} from './lib/oauth-helper.js';

const STORAGE_KEY = 'extensionSettings';

const useBigQueryEl = document.getElementById('useBigQuery');
const syncToSheetsEl = document.getElementById('syncToSheets');
const spreadsheetIdEl = document.getElementById('spreadsheetId');
const bqProjectIdEl = document.getElementById('bqProjectId');
const bqDateColumnEl = document.getElementById('bqDateColumn');
const bqLookbackMonthsEl = document.getElementById('bqLookbackMonths');
const scheduleEnabledEl = document.getElementById('scheduleEnabled');
const scheduleDayOfWeekEl = document.getElementById('scheduleDayOfWeek');
const scheduleTimeLocalEl = document.getElementById('scheduleTimeLocal');
const signInBtn = document.getElementById('signIn');
const authStatusEl = document.getElementById('authStatus');
const oauthHintEl = document.getElementById('oauthHint');
const saveBtn = document.getElementById('save');
const exportJsonBtn = document.getElementById('exportJson');
const importJsonBtn = document.getElementById('importJson');
const importFileEl = document.getElementById('importFile');
const saveStatusEl = document.getElementById('saveStatus');
const bqSettingsWrap = document.getElementById('bqSettingsWrap');
const bqRequiresSignIn = document.getElementById('bqRequiresSignIn');
const optionsSelectedAppIdsEl = document.getElementById('optionsSelectedAppIds');

/** Cached token presence — BigQuery form and readFromForm use this. */
let googleSignedIn = false;
/** Prevents overlapping identity UI (double-click or Chrome quirks). */
let authActionInFlight = false;

function syncGoogleAuthButton() {
  if (!signInBtn) return;
  if (!isOAuthClientConfigured()) {
    signInBtn.textContent = 'Sign in with Google';
    signInBtn.classList.remove('secondary');
    signInBtn.classList.add('primary');
    return;
  }
  if (googleSignedIn) {
    signInBtn.textContent = 'Sign out';
    signInBtn.classList.remove('primary');
    signInBtn.classList.add('secondary');
  } else {
    signInBtn.textContent = 'Sign in with Google';
    signInBtn.classList.remove('secondary');
    signInBtn.classList.add('primary');
  }
}

function applyToForm(s) {
  useBigQueryEl.checked = googleSignedIn ? !!s.useBigQuery : false;
  syncToSheetsEl.checked = !!s.syncToSheets;
  spreadsheetIdEl.value = s.spreadsheetId || '';
  bqProjectIdEl.value = s.bqProjectId || 'wildfire-1000';
  bqDateColumnEl.value = s.bqDateColumn || '';
  bqLookbackMonthsEl.value = Number(s.bqLookbackMonths) || 6;
  scheduleEnabledEl.checked = !!s.scheduleEnabled;
  scheduleDayOfWeekEl.value = String(Math.min(7, Math.max(1, Number(s.scheduleDayOfWeek) || 1)));
  const t = String(s.scheduleTimeLocal || '09:00').trim();
  scheduleTimeLocalEl.value = /^\d{1,2}:\d{2}$/.test(t)
    ? `${String(parseInt(t.split(':')[0], 10)).padStart(2, '0')}:${String(parseInt(t.split(':')[1], 10)).padStart(2, '0')}`
    : '09:00';
}

function readFromForm() {
  return {
    useBigQuery: googleSignedIn && useBigQueryEl.checked,
    syncToSheets: syncToSheetsEl.checked,
    spreadsheetId: spreadsheetIdEl.value.trim(),
    bqProjectId: bqProjectIdEl.value.trim() || 'wildfire-1000',
    bqDateColumn: bqDateColumnEl.value.trim(),
    bqLookbackMonths: Math.max(1, Math.min(36, parseInt(String(bqLookbackMonthsEl.value), 10) || 6)),
    scheduleEnabled: scheduleEnabledEl.checked,
    scheduleDayOfWeek: Math.min(7, Math.max(1, parseInt(String(scheduleDayOfWeekEl.value), 10) || 1)),
    scheduleTimeLocal: scheduleTimeLocalEl.value || '09:00'
  };
}

async function refreshSelectedAppIdsDisplay() {
  if (!optionsSelectedAppIdsEl) return;
  try {
    const s = await readExtensionSettings();
    const ids = Array.isArray(s.appIdsSelected) ? s.appIdsSelected : [];
    optionsSelectedAppIdsEl.textContent = ids.length
      ? ids.join(', ')
      : '(none — open the extension popup and check one or more App IDs)';
  } catch {
    optionsSelectedAppIdsEl.textContent = '(could not load)';
  }
}

async function refreshGoogleAndBqUi() {
  if (!isOAuthClientConfigured()) {
    googleSignedIn = false;
    oauthHintEl.textContent = oauthClientPrecheckMessage() || '';
    oauthHintEl.style.color = 'var(--err, #f06b6b)';
    if (bqRequiresSignIn) bqRequiresSignIn.hidden = true;
    if (bqSettingsWrap) bqSettingsWrap.hidden = true;
    syncGoogleAuthButton();
    return;
  }

  let token = null;
  try {
    token = await getGoogleAuthToken(false);
  } catch {
    /* no cached token */
  }
  googleSignedIn = !!token;

  if (googleSignedIn) {
    oauthHintEl.textContent = 'Signed in with Google (Wildfire company account for BigQuery + Sheets).';
    oauthHintEl.style.color = 'var(--ok, #3ecf8e)';
    if (bqRequiresSignIn) bqRequiresSignIn.hidden = true;
    if (bqSettingsWrap) bqSettingsWrap.hidden = false;
  } else {
    oauthHintEl.textContent =
      'Sign in with your Wildfire company Google account to enable BigQuery commission loading and Google Sheets export.';
    oauthHintEl.style.color = 'var(--muted)';
    if (bqRequiresSignIn) bqRequiresSignIn.hidden = false;
    if (bqSettingsWrap) bqSettingsWrap.hidden = true;
  }

  const s = await readExtensionSettings();
  useBigQueryEl.checked = googleSignedIn ? !!s.useBigQuery : false;
  syncGoogleAuthButton();
}

async function load() {
  try {
    const s = await readExtensionSettings();
    await refreshGoogleAndBqUi();
    applyToForm(s);
    saveStatusEl.textContent = '';
    await refreshSelectedAppIdsDisplay();
  } catch (e) {
    saveStatusEl.textContent = `Load failed: ${e.message || e}`;
  }
}

async function save() {
  saveBtn.disabled = true;
  saveStatusEl.textContent = 'Saving…';
  saveStatusEl.style.color = '';
  try {
    const cur = await readExtensionSettings();
    const next = { ...cur, ...readFromForm() };
    await writeExtensionSettings(next);
    await refreshGoogleAndBqUi();
    applyToForm(next);
    await refreshSelectedAppIdsDisplay();
    saveStatusEl.textContent = 'Settings saved.';
    saveStatusEl.style.color = 'var(--ok, #3ecf8e)';
    setTimeout(() => {
      saveStatusEl.textContent = '';
      saveStatusEl.style.color = '';
    }, 3500);
  } catch (e) {
    saveStatusEl.textContent = `Save failed: ${e.message || e}`;
    saveStatusEl.style.color = 'var(--err, #f06b6b)';
  } finally {
    saveBtn.disabled = false;
  }
}

signInBtn.addEventListener('click', async () => {
  if (authActionInFlight) return;

  authStatusEl.textContent = '';
  authStatusEl.style.color = '';
  const precheck = oauthClientPrecheckMessage();
  if (precheck) {
    authStatusEl.textContent = precheck;
    authStatusEl.style.color = 'var(--err, #f06b6b)';
    await refreshGoogleAndBqUi();
    return;
  }

  let existingToken = null;
  try {
    existingToken = await getGoogleAuthToken(false);
  } catch {
    existingToken = null;
  }

  authActionInFlight = true;
  signInBtn.disabled = true;
  try {
    if (existingToken) {
      authStatusEl.textContent = 'Signing out…';
      authStatusEl.style.color = 'var(--muted)';
      googleSignedIn = false;
      if (bqSettingsWrap) bqSettingsWrap.hidden = true;
      if (bqRequiresSignIn) bqRequiresSignIn.hidden = false;
      oauthHintEl.textContent = 'You are signed out. Sign in again to use BigQuery or Sheets export.';
      oauthHintEl.style.color = 'var(--muted)';
      useBigQueryEl.checked = false;
      try {
        await revokeGoogleAuth();
        try {
          const cur = await readExtensionSettings();
          await writeExtensionSettings({ ...cur, useBigQuery: false });
        } catch (e) {
          console.warn('[options] could not clear useBigQuery on sign out:', e);
        }
        await new Promise((r) => setTimeout(r, 200));
        await refreshGoogleAndBqUi();
        const s = await readExtensionSettings();
        applyToForm(s);
        authStatusEl.textContent =
          'Signed out. BigQuery stays off until you sign in with your Wildfire Google account again.';
        authStatusEl.style.color = 'var(--ok, #3ecf8e)';
      } catch (e) {
        authStatusEl.textContent = `Sign-out had an issue: ${e.message || e}. Try reloading this page.`;
        authStatusEl.style.color = 'var(--err, #f06b6b)';
        await refreshGoogleAndBqUi();
      }
      return;
    }

    authStatusEl.textContent = 'Opening Google sign-in…';
    try {
      const token = await signInWithGoogleInteractive();
      if (!token) {
        authStatusEl.textContent =
          'No token returned. Confirm oauth2.client_id in manifest.json matches a Chrome-extension OAuth client for this extension ID, then reload.';
        authStatusEl.style.color = 'var(--err, #f06b6b)';
        return;
      }
      authStatusEl.textContent = 'Signed in. BigQuery options are available below when you scroll.';
      authStatusEl.style.color = 'var(--ok, #3ecf8e)';
      await refreshGoogleAndBqUi();
      const s = await readExtensionSettings();
      applyToForm(s);
    } catch (e) {
      if (isUserCancelledAuthError(e)) {
        authStatusEl.textContent =
          'Sign-in was cancelled or the Google window was closed. Click Sign in with Google when you want to try again.';
        authStatusEl.style.color = 'var(--muted)';
      } else {
        authStatusEl.textContent = friendlyGoogleAuthError(e);
        authStatusEl.style.color = 'var(--err, #f06b6b)';
      }
    }
  } finally {
    authActionInFlight = false;
    signInBtn.disabled = false;
    await refreshGoogleAndBqUi();
  }
});

saveBtn.addEventListener('click', save);

exportJsonBtn.addEventListener('click', async () => {
  saveStatusEl.style.color = '';
  try {
    const s = await readExtensionSettings();
    const body = JSON.stringify(s, null, 2);
    const blob = new Blob([body], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'merchant-rate-audit-settings.json';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    saveStatusEl.textContent = 'Downloaded merchant-rate-audit-settings.json';
    setTimeout(() => {
      if (saveStatusEl.textContent.includes('Downloaded')) saveStatusEl.textContent = '';
    }, 4000);
  } catch (e) {
    saveStatusEl.textContent = `Export failed: ${e.message || e}`;
    saveStatusEl.style.color = 'var(--err, #f06b6b)';
  }
});

importJsonBtn.addEventListener('click', () => {
  importFileEl.value = '';
  importFileEl.click();
});

importFileEl.addEventListener('change', async () => {
  const file = importFileEl.files && importFileEl.files[0];
  importFileEl.value = '';
  if (!file) return;
  saveStatusEl.style.color = '';
  try {
    const text = await file.text();
    const next = sanitizeImportedSettings(text);
    await writeExtensionSettings(next);
    await refreshGoogleAndBqUi();
    applyToForm(await readExtensionSettings());
    await refreshSelectedAppIdsDisplay();
    saveStatusEl.textContent = 'Imported settings from JSON and saved.';
    saveStatusEl.style.color = 'var(--ok, #3ecf8e)';
    setTimeout(() => {
      if (saveStatusEl.textContent.includes('Imported')) saveStatusEl.textContent = '';
    }, 4000);
  } catch (e) {
    saveStatusEl.textContent = `Import failed: ${e.message || e}`;
    saveStatusEl.style.color = 'var(--err, #f06b6b)';
  }
});

useBigQueryEl.addEventListener('change', () => {
  saveStatusEl.textContent = '';
});
syncToSheetsEl.addEventListener('change', () => {
  saveStatusEl.textContent = '';
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[STORAGE_KEY]) return;
  void refreshSelectedAppIdsDisplay();
});

load();
