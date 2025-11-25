// Background service worker for Wildlink Traffic Monitor Extension

// Wildlink domains to monitor
const wildlinkDomains = [
  'wild.link',
  'www.wildlink.me',
  'wildlink.me',
  'wildlink.ai',
  'wfi.re',
  'storage.googleapis.com'
];

// Check if URL matches Wildlink domains
function isWildlinkUrl(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    // Check for storage.googleapis.com - only include if it's Wildlink-related
    if (hostname.includes('storage.googleapis.com')) {
      // Exclude Google Drive requests
      if (url.includes('/drive.google.com') || 
          url.includes('/drive/') ||
          url.includes('drive') ||
          url.includes('googleusercontent.com')) {
        return false;
      }
      // Only include if it contains wildlink in the path
      const path = urlObj.pathname.toLowerCase();
      if (!path.includes('wildlink') && !path.includes('wl-')) {
        return false;
      }
    }
    
    // Check other Wildlink domains
    return wildlinkDomains.some(domain => {
      if (domain === 'storage.googleapis.com') {
        // Already handled above
        return false;
      }
      return hostname.includes(domain);
    });
  } catch (error) {
    return false;
  }
}

// Parse important parameters from URL
function parseImportantParams(url) {
  try {
    const urlObj = new URL(url);
    const params = {};
    const importantKeys = ['d', 's', 'io', 'c', 'tc', 'st', 'nm', 'sender', 'device', 'auth', 'token', 'id', 'uid', 'url'];
    
    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    
    const importantParams = {};
    importantKeys.forEach(key => {
      if (params[key]) {
        importantParams[key] = params[key];
      }
    });
    
    return { queryParams: params, importantParams };
  } catch (error) {
    return { queryParams: {}, importantParams: {} };
  }
}

// Create log entry
function createLogEntry(requestDetails, responseHeaders = null, statusCode = null) {
  const timestamp = new Date().toISOString();
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const url = requestDetails.url;
  
  try {
    const urlObj = new URL(url);
    const { queryParams, importantParams } = parseImportantParams(url);
    
    return {
      id: requestId,
      timestamp: timestamp,
      type: 'request',
      method: requestDetails.method,
      url: url,
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      queryParams: queryParams,
      importantParams: importantParams,
      headers: requestDetails.requestHeaders || {},
      requestBody: requestDetails.requestBody || '',
      clientIp: 'browser',
      source: 'chrome_extension',
      statusCode: statusCode,
      responseHeaders: responseHeaders || {},
      responseBody: '',
      completed: statusCode !== null,
      completedTimestamp: statusCode ? timestamp : null,
      tabId: requestDetails.tabId,
      tabUrl: requestDetails.tabUrl || ''
    };
  } catch (error) {
    return null;
  }
}

// Load existing logs from storage
async function loadLogs() {
  try {
    const result = await chrome.storage.local.get(['wildlinkLogs']);
    const logs = result.wildlinkLogs || [];
    console.log(`Loaded ${logs.length} logs from storage`);
    return logs;
  } catch (error) {
    console.error('Error loading logs:', error);
    return [];
  }
}

// Save logs to storage
async function saveLogs(logs) {
  try {
    // Keep only the most recent 10000 requests
    const trimmedLogs = logs.length > 10000 ? logs.slice(-10000) : logs;
    // Use set with callback to ensure it's saved
    await chrome.storage.local.set({ wildlinkLogs: trimmedLogs });
    console.log(`Saved ${trimmedLogs.length} logs to storage`);
    return true;
  } catch (error) {
    console.error('Error saving logs:', error);
    return false;
  }
}

// Add log entry
async function addLogEntry(logEntry) {
  if (!logEntry) return;
  
  const logs = await loadLogs();
  
  // Check if log already exists (avoid duplicates)
  const existingIndex = logs.findIndex(log => 
    log.url === logEntry.url && 
    Math.abs(new Date(log.timestamp) - new Date(logEntry.timestamp)) < 5000
  );
  
  if (existingIndex !== -1) {
    // Update existing log
    logs[existingIndex] = logEntry;
  } else {
    // Add new log
    logs.push(logEntry);
  }
  
  await saveLogs(logs);
  
  // Notify popup of new log
  chrome.runtime.sendMessage({
    action: 'newLog',
    log: logEntry
  }).catch(() => {
    // Popup might not be open, ignore
  });
}

// Listen to web requests
chrome.webRequest.onBeforeRequest.addListener(
  async (details) => {
    if (isWildlinkUrl(details.url)) {
      console.log('🎯 WILDLINK REQUEST:', details.method, details.url);
      
      // Get tab info
      let tabUrl = '';
      let tabTitle = '';
      try {
        const tab = await chrome.tabs.get(details.tabId);
        tabUrl = tab.url || '';
        tabTitle = tab.title || '';
      } catch (error) {
        // Tab might not exist
      }
      
      const logEntry = createLogEntry({
        ...details,
        tabUrl: tabUrl
      });
      
      if (logEntry) {
        logEntry.pageUrl = tabUrl;
        logEntry.pageTitle = tabTitle;
        await addLogEntry(logEntry);
      }
    }
  },
  { urls: ['<all_urls>'] },
  ['requestBody']
);

// Listen to web request headers (to capture response)
chrome.webRequest.onCompleted.addListener(
  async (details) => {
    if (isWildlinkUrl(details.url)) {
      console.log('✅ WILDLINK RESPONSE:', details.statusCode, details.url);
      
      // Get tab info
      let tabUrl = '';
      let tabTitle = '';
      try {
        const tab = await chrome.tabs.get(details.tabId);
        tabUrl = tab.url || '';
        tabTitle = tab.title || '';
      } catch (error) {
        // Tab might not exist
      }
      
      const logEntry = createLogEntry(
        details,
        details.responseHeaders || {},
        details.statusCode
      );
      
      if (logEntry) {
        logEntry.pageUrl = tabUrl;
        logEntry.pageTitle = tabTitle;
        await addLogEntry(logEntry);
      }
    }
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getLogs') {
    loadLogs().then(logs => {
      sendResponse({ success: true, logs: logs });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep channel open for async response
  }
  
  if (message.action === 'clearLogs') {
    chrome.storage.local.set({ wildlinkLogs: [] }).then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  
  if (message.action === 'getStats') {
    loadLogs().then(logs => {
      const stats = {
        total: logs.length,
        byDomain: {},
        recent: logs.slice(-10)
      };
      
      logs.forEach(log => {
        const domain = log.hostname || 'unknown';
        stats.byDomain[domain] = (stats.byDomain[domain] || 0) + 1;
      });
      
      sendResponse({ success: true, stats: stats });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  
  // Return false if action not handled
  return false;
});

// Initialize on install (only clear on first install, not on reload)
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Wildlink Traffic Monitor Extension installed/reloaded', details.reason);
  // Only clear logs on first install, never on reload or update
  if (details.reason === 'install') {
    console.log('First install - initializing empty logs');
    chrome.storage.local.set({ wildlinkLogs: [] });
  } else {
    // On reload or update, preserve existing logs
    console.log('Extension reloaded/updated - preserving existing logs');
    // Do nothing - logs will persist in storage
  }
});

// Ensure logs are preserved on service worker startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Service worker started - logs should persist');
});

