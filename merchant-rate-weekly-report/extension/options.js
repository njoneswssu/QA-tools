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
  friendlyGoogleAuthError
} from './lib/oauth-helper.js';

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
const signOutBtn = document.getElementById('signOut');
const authStatusEl = document.getElementById('authStatus');
const oauthHintEl = document.getElementById('oauthHint');
const saveBtn = document.getElementById('save');
const exportJsonBtn = document.getElementById('exportJson');
const importJsonBtn = document.getElementById('importJson');
const importFileEl = document.getElementById('importFile');
const saveStatusEl = document.getElementById('saveStatus');

function applyToForm(s) {
  useBigQueryEl.checked = !!s.useBigQuery;
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
    useBigQuery: useBigQueryEl.checked,
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

async function refreshAuthUi() {
  signInBtn.hidden = false;
  if (!isOAuthClientConfigured()) {
    oauthHintEl.textContent = oauthClientPrecheckMessage() || '';
    oauthHintEl.style.color = 'var(--err, #f06b6b)';
    return;
  }
  try {
    const token = await getGoogleAuthToken(false);
    if (token) {
      oauthHintEl.textContent = 'Google account is connected.';
      oauthHintEl.style.color = 'var(--ok, #3ecf8e)';
      signInBtn.hidden = true;
    } else {
      oauthHintEl.textContent =
        'OAuth Client ID is set — click **Sign in with Google** once to authorize BigQuery and Sheets.';
      oauthHintEl.style.color = 'var(--muted)';
    }
  } catch {
    oauthHintEl.textContent =
      'OAuth Client ID is set — click **Sign in with Google** once to authorize BigQuery and Sheets.';
    oauthHintEl.style.color = 'var(--muted)';
  }
}

async function load() {
  try {
    const s = await readExtensionSettings();
    applyToForm(s);
    saveStatusEl.textContent = '';
    await refreshAuthUi();
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
    applyToForm(next);
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
  authStatusEl.textContent = '';
  authStatusEl.style.color = '';
  const precheck = oauthClientPrecheckMessage();
  if (precheck) {
    authStatusEl.textContent = precheck;
    authStatusEl.style.color = 'var(--err, #f06b6b)';
    await refreshAuthUi();
    return;
  }

  signInBtn.disabled = true;
  authStatusEl.textContent = 'Opening Google sign-in…';
  try {
    const token = await signInWithGoogleInteractive();
    if (!token) {
      authStatusEl.textContent =
        'No token returned. Confirm oauth2.client_id in manifest.json matches a Chrome-extension OAuth client for this extension ID, then reload.';
      authStatusEl.style.color = 'var(--err, #f06b6b)';
      return;
    }
    authStatusEl.textContent = 'Signed in. You can run audits from the extension popup.';
    authStatusEl.style.color = 'var(--ok, #3ecf8e)';
    signInBtn.hidden = true;
    await refreshAuthUi();
  } catch (e) {
    authStatusEl.textContent = friendlyGoogleAuthError(e);
    authStatusEl.style.color = 'var(--err, #f06b6b)';
  } finally {
    signInBtn.disabled = false;
  }
});

signOutBtn.addEventListener('click', async () => {
  authStatusEl.textContent = '';
  authStatusEl.style.color = '';
  await revokeGoogleAuth();
  authStatusEl.textContent = 'Signed out (cached token removed).';
  signInBtn.hidden = false;
  await refreshAuthUi();
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
    applyToForm(await readExtensionSettings());
    saveStatusEl.textContent = 'Imported settings from JSON and saved.';
    saveStatusEl.style.color = 'var(--ok, #3ecf8e)';
    await refreshAuthUi();
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

load();
