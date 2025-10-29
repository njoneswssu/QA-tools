// Twitch Ad Blocker - SAFE VERSION
// This version focuses ONLY on blocking ads without touching video elements

let blockedAdsCount = 0;
let observer = null;
let adDetectionActive = true;
let blockedElements = new Set();

console.log('Twitch Ad Blocker - SAFE VERSION loaded');

// Initialize the extension
function init() {
  loadBlockedAdsCount();
  setupSafeAdBlocking();
  console.log('Twitch Ad Blocker - SAFE VERSION initialized');
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'manualBlock') {
    manualBlockAd();
    sendResponse({ success: true });
  } else if (request.action === 'getStats') {
    sendResponse({ 
      blockedCount: blockedAdsCount,
      isActive: adDetectionActive 
    });
  }
});

// Setup SAFE ad blocking that NEVER touches video elements
function setupSafeAdBlocking() {
  // Only block very specific, safe ad selectors
  blockSafeAdElements();
  
  // Setup mutation observer with STRICT filtering
  setupSafeMutationObserver();
  
  // Periodic safe blocking
  setInterval(blockSafeAdElements, 5000);
  
  console.log('Safe ad blocking activated');
}

// Setup mutation observer that NEVER affects video
function setupSafeMutationObserver() {
  if (observer) observer.disconnect();
  
  observer = new MutationObserver((mutations) => {
    if (!adDetectionActive) return;
    
    mutations.forEach((mutation) => {
      // Skip ANY mutation that involves video elements
      if (mutation.target && (
        mutation.target.tagName === 'VIDEO' ||
        mutation.target.closest('[data-a-target="video-player"]') ||
        mutation.target.closest('.video-player')
      )) {
        return; // NEVER touch video-related elements
      }
      
      // Only check for very specific ad elements
      if (mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) {
            checkSafeAdElement(node);
          }
        });
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Block only VERY specific, safe ad elements
function blockSafeAdElements() {
  let adsBlocked = 0;
  
  // ONLY target elements that are definitely ads and NOT video-related
  const safeAdSelectors = [
    // Banner ads only
    '[data-a-target="ad-banner"]',
    '[data-test-selector="ad-banner"]',
    '.masthead-ad',
    
    // Specific promotional elements (not video)
    '.promotion-banner:not([data-a-target*="video"])',
    '.sponsored-content:not([data-a-target*="video"])',
    
    // Side panel ads only
    '.right-column .ad-banner',
    '.side-nav .advertisement'
  ];
  
  safeAdSelectors.forEach(selector => {
    try {
      const ads = document.querySelectorAll(selector);
      ads.forEach(ad => {
        // DOUBLE CHECK: Never block if it's near video
        if (ad.closest('[data-a-target="video-player"]') || 
            ad.closest('.video-player') ||
            ad.querySelector('video')) {
          console.log('SAFETY: Skipping ad near video player');
          return;
        }
        
        if (!ad.dataset.blocked && ad.offsetParent !== null) {
          const elementId = createElementId(ad);
          if (!blockedElements.has(elementId)) {
            hideSafeElement(ad);
            adsBlocked++;
          }
        }
      });
    } catch (e) {
      // Ignore invalid selectors
    }
  });
  
  if (adsBlocked > 0) {
    incrementBlockedCount(adsBlocked);
    console.log(`Safely blocked ${adsBlocked} ads`);
  }
}

// Check if element is safe to block (NEVER video-related)
function checkSafeAdElement(node) {
  if (!node || node.nodeType !== 1) return;
  
  // NEVER touch anything video-related
  if (node.tagName === 'VIDEO' ||
      node.closest('[data-a-target="video-player"]') ||
      node.closest('.video-player') ||
      node.querySelector('video')) {
    return;
  }
  
  // Only block very specific ad patterns
  const specificAdPatterns = [
    /^ad-banner/, /promotion-banner/, /masthead-ad/
  ];
  
  const nodeInfo = `${node.className} ${node.id}`.toLowerCase();
  
  if (specificAdPatterns.some(pattern => pattern.test(nodeInfo))) {
    hideSafeElement(node);
    incrementBlockedCount(1);
  }
}

// Hide element SAFELY (with extra video protection)
function hideSafeElement(element) {
  if (element.dataset.blocked) return;
  
  // FINAL SAFETY CHECK: Never hide anything video-related
  if (element.tagName === 'VIDEO' ||
      element.closest('[data-a-target="video-player"]') ||
      element.closest('.video-player') ||
      element.querySelector('video')) {
    console.log('SAFETY: Refusing to hide video-related element');
    return;
  }
  
  const elementId = createElementId(element);
  if (blockedElements.has(elementId)) return;
  
  element.dataset.blocked = 'true';
  element.style.cssText = `
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    height: 0px !important;
    width: 0px !important;
    overflow: hidden !important;
    position: absolute !important;
    left: -9999px !important;
  `;
  
  blockedElements.add(elementId);
  console.log('Safely hidden ad element:', element.className || element.tagName);
}

// Manual block - SAFE version
function manualBlockAd() {
  console.log('Manual SAFE ad blocking triggered');
  
  // Only block safe elements
  blockSafeAdElements();
  
  showNotification('Safe ad blocking completed');
}

// Create unique identifier for element tracking
function createElementId(element) {
  const className = element.className || '';
  const id = element.id || '';
  const tagName = element.tagName || '';
  const dataTarget = element.dataset.aTarget || '';
  
  return `${tagName}_${className}_${id}_${dataTarget}`.replace(/\s+/g, '_');
}

// Show notification
function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'twitch-ad-blocker-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #9146ff;
    color: white;
    padding: 10px 15px;
    border-radius: 5px;
    font-family: 'Roobert', Arial, sans-serif;
    font-size: 14px;
    font-weight: bold;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    border: 2px solid #772ce8;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Increment blocked ads count
function incrementBlockedCount(count = 1) {
  blockedAdsCount += count;
  updateCounterDisplay();
  saveBlockedAdsCount();
}

// Update counter
function updateCounterDisplay() {
  chrome.runtime.sendMessage({ 
    action: 'updateBadge', 
    count: blockedAdsCount 
  });
}

// Save blocked ads count to storage
function saveBlockedAdsCount() {
  chrome.storage.local.set({ blockedAdsCount: blockedAdsCount });
}

// Load blocked ads count from storage
function loadBlockedAdsCount() {
  chrome.storage.local.get(['blockedAdsCount'], (result) => {
    blockedAdsCount = result.blockedAdsCount || 0;
    updateCounterDisplay();
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Also initialize on page changes (Twitch SPA)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setTimeout(() => {
      blockedElements.clear();
      blockSafeAdElements();
    }, 1500);
  }
}).observe(document, { subtree: true, childList: true });
