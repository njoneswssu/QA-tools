/** Chrome identity OAuth2 (client_id must be set in manifest.json). */

export function getGoogleAuthToken(interactive) {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.identity || !chrome.identity.getAuthToken) {
      reject(new Error('Google sign-in is only available inside the extension.'));
      return;
    }
    chrome.identity.getAuthToken({ interactive: !!interactive }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(token || null);
    });
  });
}

export function revokeGoogleAuth() {
  return new Promise((resolve) => {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (!token) {
        resolve();
        return;
      }
      chrome.identity.removeCachedAuthToken({ token }, () => resolve());
    });
  });
}

/**
 * Clears any cached token first so Chrome opens the Google account / consent UI.
 */
export async function signInWithGoogleInteractive() {
  await revokeGoogleAuth();
  await new Promise((r) => setTimeout(r, 150));
  return getGoogleAuthToken(true);
}
