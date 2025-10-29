// Background service worker for Purchase Automation Extension
// Handles cross-tab communication, data storage, and automation coordination

let automationState = {
  isActive: false,
  currentTab: null,
  sessionStats: {
    totalAttempts: 0,
    successfulPurchases: 0,
    failedAttempts: 0,
    totalSpent: 0
  },
  purchaseResults: []
};

// Extension lifecycle
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Purchase Automation Extension installed:', details.reason);
  
  if (details.reason === 'install') {
    initializeExtension();
  } else if (details.reason === 'update') {
    resetAllExtensionData();
  }
});

// Reset all extension data on startup/refresh
chrome.runtime.onStartup.addListener(() => {
  console.log('Extension starting up - resetting data');
  resetAllExtensionData();
});

// Reset data function
async function resetAllExtensionData() {
  try {
    console.log('Resetting all extension data');
    
    // Clear all stored data
    await chrome.storage.local.clear();
    
    // Reset automation state
    automationState = {
      isActive: false,
      currentTab: null,
      sessionStats: {
        totalAttempts: 0,
        successfulPurchases: 0,
        failedAttempts: 0,
        totalSpent: 0
      },
      purchaseResults: []
    };
    
    // Reinitialize with default settings
    await initializeExtension();
    
    console.log('Extension data reset complete');
  } catch (error) {
    console.error('Failed to reset extension data:', error);
  }
}

// Initialize extension on first install
async function initializeExtension() {
  try {
    await chrome.storage.local.set({
      automationState: automationState,
      settings: {
        autoInjectCrouton: true,
        showNotifications: true,
        debugMode: false,
        defaultPriceRange: { min: 0, max: 100 }
      }
    });
    
    console.log('Purchase Automation Extension initialized successfully');
    
    // Show welcome notification
    if (chrome.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Purchase Automation Extension',
        message: 'Extension installed! Click the extension icon to get started.'
      });
    }
  } catch (error) {
    console.error('Failed to initialize extension:', error);
  }
}

// Handle extension updates
async function handleExtensionUpdate() {
  try {
    const result = await chrome.storage.local.get(['automationState']);
    if (result.automationState) {
      automationState = { ...automationState, ...result.automationState };
    }
    console.log('Extension updated successfully');
  } catch (error) {
    console.error('Failed to handle extension update:', error);
  }
}

// Message handling from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);
  
  switch (request.action) {
    case 'getAutomationState':
      sendResponse({ success: true, state: automationState });
      break;
      
    case 'updateAutomationState':
      automationState = { ...automationState, ...request.state };
      chrome.storage.local.set({ automationState });
      sendResponse({ success: true });
      break;
      
    case 'injectCrouton':
      handleInjectCrouton(request.tabId, sendResponse);
      return true; // Keep message channel open for async response
      
    case 'startPurchaseAutomation':
      handleStartPurchaseAutomation(request.config, sender.tab, sendResponse);
      return true;
      
    case 'purchaseComplete':
      handlePurchaseComplete(request.results, sendResponse);
      break;
      
    case 'purchaseError':
      handlePurchaseError(request.error, sendResponse);
      break;
      
    case 'getSessionStats':
      sendResponse({ success: true, stats: automationState.sessionStats });
      break;
      
    case 'exportResults':
      handleExportResults(sendResponse);
      return true;
      
    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

// Inject crouton into specified tab
async function handleInjectCrouton(tabId, sendResponse) {
  try {
    // First inject the crouton script
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['crouton-injector.js']
    });
    
    // Then inject the styles
    await chrome.scripting.insertCSS({
      target: { tabId: tabId },
      files: ['crouton-styles.css']
    });
    
    // Initialize the crouton
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        if (window.initializePurchaseCrouton) {
          window.initializePurchaseCrouton();
        }
      }
    });
    
    automationState.isActive = true;
    automationState.currentTab = tabId;
    await chrome.storage.local.set({ automationState });
    
    sendResponse({ success: true, message: 'Crouton injected successfully' });
  } catch (error) {
    console.error('Failed to inject crouton:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Start purchase automation
async function handleStartPurchaseAutomation(config, tab, sendResponse) {
  try {
    automationState.sessionStats.totalAttempts++;
    
    // Send automation config to content script
    await chrome.tabs.sendMessage(tab.id, {
      action: 'executePurchaseAutomation',
      config: config
    });
    
    await chrome.storage.local.set({ automationState });
    sendResponse({ success: true, message: 'Purchase automation started' });
  } catch (error) {
    console.error('Failed to start purchase automation:', error);
    automationState.sessionStats.failedAttempts++;
    await chrome.storage.local.set({ automationState });
    sendResponse({ success: false, error: error.message });
  }
}

// Handle successful purchase completion
async function handlePurchaseComplete(results, sendResponse) {
  try {
    automationState.sessionStats.successfulPurchases++;
    
    // Add to results
    automationState.purchaseResults.push({
      timestamp: new Date().toISOString(),
      website: results.website,
      category: results.category,
      priceRange: results.priceRange,
      orderDetails: results.orderDetails
    });
    
    // Update total spent
    if (results.orderDetails && results.orderDetails.orderTotal) {
      automationState.sessionStats.totalSpent += results.orderDetails.orderTotal;
    }
    
    await chrome.storage.local.set({ automationState });
    
    // Show success notification
    if (chrome.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Purchase Automation Complete',
        message: `Successfully extracted order details: $${results.orderDetails?.orderTotal || 'N/A'}`
      });
    }
    
    // Broadcast to all extension contexts
    broadcastMessage({
      action: 'purchaseCompleted',
      results: results
    });
    
    sendResponse({ success: true });
  } catch (error) {
    console.error('Failed to handle purchase completion:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle purchase automation error
async function handlePurchaseError(error, sendResponse) {
  try {
    automationState.sessionStats.failedAttempts++;
    await chrome.storage.local.set({ automationState });
    
    // Show error notification
    if (chrome.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Purchase Automation Failed',
        message: error.message || 'Unknown error occurred'
      });
    }
    
    // Broadcast error to all extension contexts
    broadcastMessage({
      action: 'purchaseError',
      error: error
    });
    
    sendResponse({ success: true });
  } catch (err) {
    console.error('Failed to handle purchase error:', err);
    sendResponse({ success: false, error: err.message });
  }
}

// Export results as downloadable file
async function handleExportResults(sendResponse) {
  try {
    if (automationState.purchaseResults.length === 0) {
      sendResponse({ success: false, error: 'No results to export' });
      return;
    }
    
    const exportData = {
      timestamp: new Date().toISOString(),
      sessionStats: automationState.sessionStats,
      results: automationState.purchaseResults
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const filename = `purchase-results-${new Date().toISOString().split('T')[0]}.json`;
    
    await chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true
    });
    
    sendResponse({ success: true, message: 'Results exported successfully' });
  } catch (error) {
    console.error('Failed to export results:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Broadcast message to all extension contexts
async function broadcastMessage(message) {
  try {
    // Send to all tabs with content scripts
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, message);
      } catch (error) {
        // Tab might not have content script, ignore
      }
    }
    
    // Send to popup if open
    chrome.runtime.sendMessage(message).catch(() => {
      // Popup might not be open, ignore
    });
  } catch (error) {
    console.error('Failed to broadcast message:', error);
  }
}

// Tab updates - auto-inject crouton if enabled and on target merchant
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
    try {
      const result = await chrome.storage.local.get(['settings', 'targetMerchants', 'automationState']);
      const settings = result.settings || { autoInjectCrouton: true };
      const targetMerchants = result.targetMerchants || [];
      const currentAutomationState = result.automationState || automationState;
      
      console.log('Tab updated:', tab.url, 'Merchants:', targetMerchants, 'Auto-inject:', settings.autoInjectCrouton);
      
      if (settings.autoInjectCrouton && targetMerchants.length > 0) {
        // Check if current site is a target merchant
        const isTargetMerchant = await checkIfTargetMerchant(tab.url, targetMerchants);
        
        console.log('Is target merchant:', isTargetMerchant, 'for URL:', tab.url);
        
        if (isTargetMerchant) {
          console.log('Auto-injecting crouton on target merchant site:', tab.url);
          // Auto-inject crouton on target merchant sites
          setTimeout(() => {
            handleInjectCrouton(tabId, (response) => {
              console.log('Crouton injection result:', response);
            });
          }, 2000); // Increased delay to ensure page is fully loaded
        }
      }
    } catch (error) {
      console.error('Failed to auto-inject crouton:', error);
    }
  }
});

// Helper function to check if URL matches target merchants
async function checkIfTargetMerchant(url, targetMerchants) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase().replace(/^www\./, '');
    
    console.log('Checking hostname:', hostname, 'against merchants:', targetMerchants);
    
    const isMatch = targetMerchants.some(merchant => {
      // Normalize merchant name - add .com if not present
      let normalizedMerchant = merchant.toLowerCase();
      if (!normalizedMerchant.includes('.')) {
        normalizedMerchant = `${normalizedMerchant}.com`;
      }
      
      console.log('Comparing:', hostname, 'with:', normalizedMerchant);
      
      // Check exact match or if hostname contains merchant
      return hostname === normalizedMerchant || 
             hostname.includes(normalizedMerchant) || 
             normalizedMerchant.includes(hostname);
    });
    
    console.log('Match result:', isMatch);
    return isMatch;
  } catch (error) {
    console.error('Error checking target merchant:', error);
    return false;
  }
}

// Clean up when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (automationState.currentTab === tabId) {
    automationState.isActive = false;
    automationState.currentTab = null;
    chrome.storage.local.set({ automationState });
  }
});
