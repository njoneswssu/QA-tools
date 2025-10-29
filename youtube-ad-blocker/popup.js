// YouTube Ad Blocker Popup Script

let sessionStartTime = Date.now();

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  setupEventListeners();
  startSessionTimer();
});

// Load statistics
function loadStats() {
  chrome.storage.local.get(['blockedAdsCount', 'sessionStartTime'], (result) => {
    const blockedCount = result.blockedAdsCount || 0;
    document.getElementById('blocked-count').textContent = blockedCount;
    
    if (result.sessionStartTime) {
      sessionStartTime = result.sessionStartTime;
    } else {
      chrome.storage.local.set({ sessionStartTime: sessionStartTime });
    }
    
    updateSessionTime();
  });
}

// Setup event listeners
function setupEventListeners() {
  document.getElementById('goto-youtube').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://www.youtube.com' });
    window.close();
  });
  
  document.getElementById('manual-block').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url.includes('youtube.com')) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'manualBlock' }, (response) => {
          if (response && response.success) {
            showTemporaryMessage('Ad blocking triggered!');
          }
        });
      } else {
        showTemporaryMessage('Please go to YouTube first');
      }
    });
  });
  
  document.getElementById('reset-counter').addEventListener('click', () => {
    chrome.storage.local.set({ 
      blockedAdsCount: 0,
      sessionStartTime: Date.now()
    }, () => {
      document.getElementById('blocked-count').textContent = '0';
      sessionStartTime = Date.now();
      updateSessionTime();
      
      showTemporaryMessage('Counter reset!');
    });
  });
}

// Show temporary message in popup
function showTemporaryMessage(message) {
  const statusText = document.getElementById('status-text');
  const originalText = statusText.textContent;
  statusText.textContent = message;
  statusText.style.color = '#00ff88';
  
  setTimeout(() => {
    statusText.textContent = originalText;
    statusText.style.color = '';
  }, 2000);
}

// Start session timer
function startSessionTimer() {
  setInterval(updateSessionTime, 1000);
}

// Update session time display
function updateSessionTime() {
  const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000 / 60);
  document.getElementById('session-time').textContent = `${elapsed}m`;
}

// Listen for storage changes to update display
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.blockedAdsCount) {
    document.getElementById('blocked-count').textContent = changes.blockedAdsCount.newValue || 0;
  }
});
