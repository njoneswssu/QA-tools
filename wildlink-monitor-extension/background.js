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

// Cache of extension IDs to names for display
const extensionInfoCache = new Map();

// Check if URL matches Wildlink domains
function isWildlinkUrl(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname.toLowerCase();
    
    // Check for storage.googleapis.com - only include if it's Wildlink-related
    if (hostname.includes('storage.googleapis.com')) {
      // Exclude Google Drive requests
      if (pathname.includes('/drive.google.com') || 
          pathname.includes('/drive/') ||
          pathname.includes('/drive') ||
          hostname.includes('googleusercontent.com')) {
        return false;
      }
      // Exclude image requests (wl-image paths are just image files)
      if (pathname.includes('/wl-image/') || 
          pathname.startsWith('/wl-image') ||
          pathname.includes('/images/')) {
        return false;
      }
      // Only include if it contains wildlink in the path (but not wl-image)
      if (pathname.includes('wildlink') || 
          (pathname.includes('wl-') && !pathname.includes('wl-image'))) {
        return true;
      }
      return false;
    }
    
    // Check other Wildlink domains - use exact match or subdomain match
    for (const domain of wildlinkDomains) {
      if (domain === 'storage.googleapis.com') {
        continue; // Already handled above
      }
      
      // Exact match
      if (hostname === domain) {
        return true;
      }
      
      // Subdomain match (e.g., www.wildlink.me matches wildlink.me)
      // Check if hostname ends with .domain or contains .domain/
      if (hostname.endsWith('.' + domain)) {
        return true;
      }
      
      // Contains match (fallback for partial matches)
      if (hostname.includes(domain)) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error parsing URL:', url, error);
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

// Extract extension ID from initiator URL
function getExtensionIdFromInitiator(initiator) {
  if (!initiator) return null;
  
  try {
    // initiator can be a string like "chrome-extension://abc123..." or null
    if (typeof initiator === 'string' && initiator.startsWith('chrome-extension://')) {
      const urlObj = new URL(initiator);
      return urlObj.hostname; // The extension ID is the hostname
    }
  } catch (error) {
    // Invalid URL format
  }
  
  return null;
}

// Get extension name from ID (with caching)
async function getExtensionName(extensionId) {
  if (!extensionId) return null;
  
  // Check cache first
  if (extensionInfoCache.has(extensionId)) {
    return extensionInfoCache.get(extensionId);
  }
  
  try {
    // Try to get extension info using management API
    // Note: This requires management permission, but we'll handle gracefully if not available
    const extension = await chrome.management.get(extensionId);
    if (extension && extension.name) {
      extensionInfoCache.set(extensionId, extension.name);
      return extension.name;
    }
  } catch (error) {
    // Extension might not be accessible or management API not available
    // Fall back to just using the ID
  }
  
  return null;
}

// Create log entry
function createLogEntry(requestDetails, responseHeaders = null, statusCode = null) {
  const timestamp = new Date().toISOString();
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const url = requestDetails.url;
  
  try {
    const urlObj = new URL(url);
    const { queryParams, importantParams } = parseImportantParams(url);
    
    // Extract extension info from initiator
    const initiator = requestDetails.initiator;
    const extensionId = getExtensionIdFromInitiator(initiator);
    
    const logEntry = {
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
      tabUrl: requestDetails.tabUrl || '',
      initiator: initiator || null,
      extensionId: extensionId || null,
      extensionName: null // Will be populated asynchronously
    };
    
    // Populate extension name asynchronously if extension ID found
    if (extensionId) {
      getExtensionName(extensionId).then(name => {
        if (name) {
          logEntry.extensionName = name;
          // Update the log entry in storage
          updateLogEntryExtensionName(requestId, name);
        }
      }).catch(() => {
        // Ignore errors
      });
    }
    
    return logEntry;
  } catch (error) {
    return null;
  }
}

// Update log entry with extension name
async function updateLogEntryExtensionName(logId, extensionName) {
  try {
    const logs = await loadLogs();
    const logIndex = logs.findIndex(log => log.id === logId);
    if (logIndex !== -1) {
      logs[logIndex].extensionName = extensionName;
      await saveLogs(logs);
    }
  } catch (error) {
    // Ignore errors
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
      const extensionId = getExtensionIdFromInitiator(details.initiator);
      const extensionName = extensionId ? await getExtensionName(extensionId) : null;
      
      if (extensionId) {
        console.log(`🎯 WILDLINK REQUEST from extension ${extensionName || extensionId}:`, details.method, details.url);
      } else {
        console.log('🎯 WILDLINK REQUEST CAPTURED:', details.method, details.url);
      }
      
      // Get tab info
      let tabUrl = '';
      let tabTitle = '';
      try {
        if (details.tabId >= 0) {
          const tab = await chrome.tabs.get(details.tabId);
          tabUrl = tab.url || '';
          tabTitle = tab.title || '';
        }
      } catch (error) {
        // Tab might not exist (e.g., service worker requests)
      }
      
      const logEntry = createLogEntry({
        ...details,
        tabUrl: tabUrl
      });
      
      if (logEntry) {
        logEntry.pageUrl = tabUrl;
        logEntry.pageTitle = tabTitle;
        if (extensionName) {
          logEntry.extensionName = extensionName;
        }
        await addLogEntry(logEntry);
        console.log('✅ Log entry added:', logEntry.id);
      } else {
        console.error('❌ Failed to create log entry for:', details.url);
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
      const extensionId = getExtensionIdFromInitiator(details.initiator);
      const extensionName = extensionId ? await getExtensionName(extensionId) : null;
      
      if (extensionId) {
        console.log(`✅ WILDLINK RESPONSE from extension ${extensionName || extensionId}:`, details.statusCode, details.url);
      } else {
        console.log('✅ WILDLINK RESPONSE CAPTURED:', details.statusCode, details.url);
      }
      
      // Get tab info
      let tabUrl = '';
      let tabTitle = '';
      try {
        if (details.tabId >= 0) {
          const tab = await chrome.tabs.get(details.tabId);
          tabUrl = tab.url || '';
          tabTitle = tab.title || '';
        }
      } catch (error) {
        // Tab might not exist (e.g., service worker requests)
      }
      
      const logEntry = createLogEntry(
        details,
        details.responseHeaders || {},
        details.statusCode
      );
      
      if (logEntry) {
        logEntry.pageUrl = tabUrl;
        logEntry.pageTitle = tabTitle;
        if (extensionName) {
          logEntry.extensionName = extensionName;
        }
        await addLogEntry(logEntry);
        console.log('✅ Response log entry added:', logEntry.id);
      } else {
        console.error('❌ Failed to create response log entry for:', details.url);
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

