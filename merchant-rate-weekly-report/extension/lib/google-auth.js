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

/**
 * Fully sign out: revoke token with Google, remove Chrome cache, clear all cached tokens.
 * `removeCachedAuthToken` alone is often not enough — the next `getAuthToken(false)` can still succeed.
 */
export async function revokeGoogleAuth() {
  let token = null;
  try {
    token = await getGoogleAuthToken(false);
  } catch {
    /* no token */
  }

  if (token) {
    try {
      await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `token=${encodeURIComponent(token)}`
      });
    } catch {
      /* network / revoke errors — still try to clear local cache */
    }

    await new Promise((resolve) => {
      chrome.identity.removeCachedAuthToken({ token }, () => resolve());
    });
  }

  if (typeof chrome.identity.clearAllCachedAuthTokens === 'function') {
    await new Promise((resolve) => {
      chrome.identity.clearAllCachedAuthTokens(() => resolve());
    });
  }
}

/**
 * Opens Google’s interactive OAuth UI. Only drops a **cached** token locally (no revoke URL) so closing
 * the sign-in window does not leave Chrome retrying or chaining prompts the way a full revoke + clear-all
 * before every interactive flow sometimes does.
 */
export async function signInWithGoogleInteractive() {
  try {
    const t = await getGoogleAuthToken(false);
    if (t) {
      await new Promise((resolve) => {
        chrome.identity.removeCachedAuthToken({ token: t }, () => resolve());
      });
    }
  } catch {
    /* no cached token */
  }
  await new Promise((r) => setTimeout(r, 100));
  return getGoogleAuthToken(true);
}
