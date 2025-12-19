// Background service worker for Citi Extension Tester

// API endpoints for merchant data
const MERCHANT_API_ENDPOINTS = {
  googleStorage: 'https://storage.googleapis.com/wildlink/cloud-db/1/206/active-domain/2025-10-31T214203.model.json',
  wildlinkAPI: 'https://api.wfi.re/v2/merchant/451/merchant_offer/search?q=*&sortBy=MerchantScore&pageSize=50&sortOrder=asc&pageNumber=1'
};

// Flag keywords for exclusions
const EXCLUSION_FLAGS = [
  'ShareASale commission',
  'Earn commissions',
  'Online purchase'
];

// Load merchants from API
async function loadMerchantsFromAPI() {
  const merchants = [];
  
  try {
    // Try Google Storage first
    try {
      const response = await fetch(MERCHANT_API_ENDPOINTS.googleStorage);
      if (response.ok) {
        const data = await response.json();
        // Parse the data structure (adjust based on actual API response)
        if (Array.isArray(data)) {
          merchants.push(...data);
        } else if (data.merchants || data.domains) {
          const merchantList = data.merchants || data.domains || [];
          merchantList.forEach((merchant, index) => {
            merchants.push({
              id: merchant.id || merchant.merchantId || `gs-${index}`,
              name: merchant.name || merchant.domain || merchant.merchantName || 'Unknown',
              domain: merchant.domain || merchant.url || '',
              appId: merchant.appId || merchant.app_id || '206',
              url: merchant.url || merchant.domain || ''
            });
          });
        }
      }
    } catch (error) {
      console.log('Google Storage API failed:', error);
    }
    
    // Try Wildlink API
    try {
      const response = await fetch(MERCHANT_API_ENDPOINTS.wildlinkAPI);
      if (response.ok) {
        const data = await response.json();
        if (data.merchants || data.data) {
          const merchantList = data.merchants || data.data || [];
          merchantList.forEach((merchant) => {
            // Avoid duplicates
            if (!merchants.find(m => m.id === merchant.id || m.name === merchant.name)) {
              merchants.push({
                id: merchant.id || merchant.merchantId || `wl-${merchants.length}`,
                name: merchant.name || merchant.merchantName || 'Unknown',
                domain: merchant.domain || merchant.url || '',
                appId: merchant.appId || merchant.app_id || '451',
                url: merchant.url || merchant.domain || ''
              });
            }
          });
        }
      }
    } catch (error) {
      console.log('Wildlink API failed:', error);
    }
  } catch (error) {
    console.error('Error loading merchants:', error);
  }
  
  return merchants;
}

// Get browser name
function getBrowserName() {
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes('edg')) return 'Edge';
  if (userAgent.includes('chrome') && !userAgent.includes('edg')) return 'Chrome';
  if (userAgent.includes('safari') && !userAgent.includes('chrome')) return 'Safari';
  return 'Unknown';
}

// Save test results
async function saveTestResult(result) {
  try {
    const { testResults = [] } = await chrome.storage.local.get(['testResults']);
    testResults.push(result);
    await chrome.storage.local.set({ testResults });
    return true;
  } catch (error) {
    console.error('Error saving test result:', error);
    return false;
  }
}

// Get all test results
async function getAllTestResults() {
  try {
    const { testResults = [] } = await chrome.storage.local.get(['testResults']);
    return testResults;
  } catch (error) {
    console.error('Error getting test results:', error);
    return [];
  }
}

// Clear test results
async function clearTestResults() {
  try {
    await chrome.storage.local.set({ testResults: [] });
    return true;
  } catch (error) {
    console.error('Error clearing test results:', error);
    return false;
  }
}

// Update merchant in queue
async function updateMerchantQueue(merchantId, action) {
  try {
    const { merchantQueue = [] } = await chrome.storage.local.get(['merchantQueue']);
    
    if (action === 'add') {
      if (!merchantQueue.includes(merchantId)) {
        merchantQueue.unshift(merchantId); // Add to top
      }
    } else if (action === 'remove') {
      const index = merchantQueue.indexOf(merchantId);
      if (index > -1) {
        merchantQueue.splice(index, 1);
      }
    }
    
    await chrome.storage.local.set({ merchantQueue });
    return merchantQueue;
  } catch (error) {
    console.error('Error updating merchant queue:', error);
    return [];
  }
}

// Get merchant queue
async function getMerchantQueue() {
  try {
    const { merchantQueue = [] } = await chrome.storage.local.get(['merchantQueue']);
    return merchantQueue;
  } catch (error) {
    console.error('Error getting merchant queue:', error);
    return [];
  }
}

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'loadMerchants') {
    loadMerchantsFromAPI().then(merchants => {
      sendResponse({ success: true, merchants });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  
  if (message.action === 'saveTestResult') {
    saveTestResult(message.result).then(success => {
      sendResponse({ success });
    });
    return true;
  }
  
  if (message.action === 'getTestResults') {
    getAllTestResults().then(results => {
      sendResponse({ success: true, results });
    });
    return true;
  }
  
  if (message.action === 'clearTestResults') {
    clearTestResults().then(success => {
      sendResponse({ success });
    });
    return true;
  }
  
  if (message.action === 'updateQueue') {
    updateMerchantQueue(message.merchantId, message.queueAction).then(queue => {
      sendResponse({ success: true, queue });
    });
    return true;
  }
  
  if (message.action === 'getQueue') {
    getMerchantQueue().then(queue => {
      sendResponse({ success: true, queue });
    });
    return true;
  }
  
  if (message.action === 'getBrowserName') {
    sendResponse({ browser: getBrowserName() });
    return true;
  }
  
  if (message.action === 'testResult') {
    // Handle test result from click-to-test
    if (message.result) {
      saveTestResult(message.result).then(success => {
        sendResponse({ success });
      });
    }
    return true;
  }
  
  return false;
});

// Initialize on install
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Citi Extension Tester installed', details.reason);
  if (details.reason === 'install') {
    chrome.storage.local.set({ 
      testResults: [],
      merchantQueue: [],
      testingState: { isPaused: false, isRunning: false }
    });
  }
});

