/**
 * Validates manifest oauth2.client_id before chrome.identity.getAuthToken.
 * Placeholder IDs cause: OAuth2 request failed: ... 'bad client id'
 */

export function getManifestOAuthClientId() {
  try {
    const m = chrome.runtime.getManifest();
    return (m.oauth2 && String(m.oauth2.client_id || '').trim()) || '';
  } catch {
    return '';
  }
}

export function isOAuthClientConfigured() {
  const id = getManifestOAuthClientId();
  if (!id || !/\.apps\.googleusercontent\.com$/i.test(id)) return false;
  const lower = id.toLowerCase();
  if (lower.includes('paste_')) return false;
  if (lower.includes('your_client')) return false;
  if (lower.includes('example')) return false;
  if (/^[\d.]+-your/i.test(id)) return false;
  return true;
}

export function oauthClientPrecheckMessage() {
  if (isOAuthClientConfigured()) return null;
  const id = getManifestOAuthClientId();
  return (
    'Google OAuth is not configured yet. In Google Cloud Console create an OAuth client ID of type **Chrome extension** ' +
    '(use this extension’s ID from chrome://extensions), copy the Client ID, put it in **extension/manifest.json** as ' +
    '`oauth2.client_id` (replace the whole placeholder string), then click **Reload** on the extension. ' +
    (id ? `Current value looks like a placeholder: ${id.slice(0, 40)}…` : 'No client_id found in manifest.')
  );
}

/** Turn Google’s opaque error into something actionable when possible. */
export function friendlyGoogleAuthError(err) {
  const msg = (err && err.message) || String(err || '');
  if (/bad client id/i.test(msg) || /invalid_client/i.test(msg)) {
    return (
      'Invalid OAuth Client ID. Use a **Chrome extension** OAuth client from Google Cloud Console, paste its full ID ' +
      'into manifest.json → oauth2.client_id, reload this extension, then try Sign in again. ' +
      '(Details: ' +
      msg +
      ')'
    );
  }
  return msg;
}
