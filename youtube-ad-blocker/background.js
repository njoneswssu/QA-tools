// YouTube Ad Blocker Background Script

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('YouTube Ad Blocker installed');
  
  // Set default storage values
  chrome.storage.local.set({
    blockedAdsCount: 0,
    extensionEnabled: true
  });
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // If on YouTube, toggle the extension
  if (tab.url.includes('youtube.com')) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: toggleExtensionOnPage
    });
  } else {
    // Navigate to YouTube if not already there
    chrome.tabs.update(tab.id, { url: 'https://www.youtube.com' });
  }
});

// Function to inject into page to toggle extension
function toggleExtensionOnPage() {
  const controls = document.getElementById('yt-ad-blocker-controls');
  if (controls) {
    controls.style.display = controls.style.display === 'none' ? 'block' : 'none';
  }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateBadge') {
    // Update extension badge with blocked ads count
    chrome.action.setBadgeText({
      text: request.count.toString(),
      tabId: sender.tab.id
    });
    
    chrome.action.setBadgeBackgroundColor({
      color: '#ff6b6b'
    });
  }
  
  if (request.action === 'getBlockedCount') {
    chrome.storage.local.get(['blockedAdsCount'], (result) => {
      sendResponse({ count: result.blockedAdsCount || 0 });
    });
    return true; // Keep message channel open for async response
  }
});

// Update badge when tab changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab.url && tab.url.includes('youtube.com')) {
    // Get current blocked count and update badge
    chrome.storage.local.get(['blockedAdsCount'], (result) => {
      const count = result.blockedAdsCount || 0;
      chrome.action.setBadgeText({
        text: count > 0 ? count.toString() : '',
        tabId: activeInfo.tabId
      });
    });
  } else {
    // Clear badge for non-YouTube tabs
    chrome.action.setBadgeText({
      text: '',
      tabId: activeInfo.tabId
    });
  }
});

// Clear badge when extension is disabled
chrome.management.onDisabled.addListener((info) => {
  if (info.id === chrome.runtime.id) {
    chrome.action.setBadgeText({ text: '' });
  }
});
