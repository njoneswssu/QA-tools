// Twitch Ad Blocker Background Script

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Twitch Ad Blocker installed');
  
  // Set default storage values
  chrome.storage.local.set({
    blockedAdsCount: 0,
    extensionEnabled: true,
    twitchAdBlockingEnabled: true,
    aggressiveMode: false
  });
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // If on Twitch, toggle the extension
  if (tab.url.includes('twitch.tv')) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: toggleTwitchExtensionOnPage
    });
  } else {
    // Navigate to Twitch if not already there
    chrome.tabs.update(tab.id, { url: 'https://www.twitch.tv' });
  }
});

// Function to inject into page to toggle extension
function toggleTwitchExtensionOnPage() {
  const controls = document.getElementById('twitch-ad-blocker-controls');
  if (controls) {
    controls.style.display = controls.style.display === 'none' ? 'block' : 'none';
  }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateBadge') {
    // Update extension badge with blocked ads count
    const count = request.count;
    chrome.action.setBadgeText({
      text: count > 0 ? count.toString() : '',
      tabId: sender.tab.id
    });
    
    chrome.action.setBadgeBackgroundColor({
      color: '#9146ff' // Twitch purple
    });
  }
  
  if (request.action === 'getBlockedCount') {
    chrome.storage.local.get(['blockedAdsCount'], (result) => {
      sendResponse({ count: result.blockedAdsCount || 0 });
    });
    return true; // Keep message channel open for async response
  }

  if (request.action === 'getTwitchSettings') {
    chrome.storage.local.get([
      'extensionEnabled', 
      'twitchAdBlockingEnabled', 
      'aggressiveMode'
    ], (result) => {
      sendResponse({
        extensionEnabled: result.extensionEnabled !== false,
        twitchAdBlockingEnabled: result.twitchAdBlockingEnabled !== false,
        aggressiveMode: result.aggressiveMode || false
      });
    });
    return true;
  }

  if (request.action === 'updateTwitchSettings') {
    chrome.storage.local.set(request.settings, () => {
      sendResponse({ success: true });
      
      // Notify all Twitch tabs about settings change
      chrome.tabs.query({ url: '*://*.twitch.tv/*' }, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, {
            action: 'settingsUpdated',
            settings: request.settings
          });
        });
      });
    });
    return true;
  }

  if (request.action === 'resetTwitchStats') {
    chrome.storage.local.set({ blockedAdsCount: 0 }, () => {
      sendResponse({ success: true });
      
      // Update badge on all Twitch tabs
      chrome.tabs.query({ url: '*://*.twitch.tv/*' }, (tabs) => {
        tabs.forEach(tab => {
          chrome.action.setBadgeText({
            text: '',
            tabId: tab.id
          });
        });
      });
    });
    return true;
  }
});

// Update badge when tab changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url && tab.url.includes('twitch.tv')) {
      // Get current blocked count and update badge
      chrome.storage.local.get(['blockedAdsCount'], (result) => {
        const count = result.blockedAdsCount || 0;
        chrome.action.setBadgeText({
          text: count > 0 ? count.toString() : '',
          tabId: activeInfo.tabId
        });
        
        chrome.action.setBadgeBackgroundColor({
          color: '#9146ff'
        });
      });
    } else {
      // Clear badge for non-Twitch tabs
      chrome.action.setBadgeText({
        text: '',
        tabId: activeInfo.tabId
      });
    }
  } catch (error) {
    console.log('Error updating badge:', error);
  }
});

// Handle tab updates (URL changes)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    if (tab.url.includes('twitch.tv')) {
      // Update badge for Twitch tabs
      chrome.storage.local.get(['blockedAdsCount'], (result) => {
        const count = result.blockedAdsCount || 0;
        chrome.action.setBadgeText({
          text: count > 0 ? count.toString() : '',
          tabId: tabId
        });
        
        chrome.action.setBadgeBackgroundColor({
          color: '#9146ff'
        });
      });
    } else {
      // Clear badge for non-Twitch tabs
      chrome.action.setBadgeText({
        text: '',
        tabId: tabId
      });
    }
  }
});

// Context menu for manual ad blocking
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'blockTwitchAd',
    title: 'Block Twitch Ads',
    contexts: ['all'],
    documentUrlPatterns: ['*://*.twitch.tv/*']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'blockTwitchAd' && tab.url.includes('twitch.tv')) {
    chrome.tabs.sendMessage(tab.id, { action: 'manualBlock' });
  }
});

// Clear badge when extension is disabled
chrome.management.onDisabled.addListener((info) => {
  if (info.id === chrome.runtime.id) {
    chrome.action.setBadgeText({ text: '' });
  }
});

// Alarm for periodic cleanup
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'twitchCleanup') {
    // Clean up old data periodically
    chrome.storage.local.get(['blockedAdsCount'], (result) => {
      const count = result.blockedAdsCount || 0;
      console.log(`Twitch Ad Blocker - Total ads blocked: ${count}`);
    });
  }
});

// Set up periodic cleanup alarm
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('twitchCleanup', { 
    delayInMinutes: 60, 
    periodInMinutes: 60 
  });
});
