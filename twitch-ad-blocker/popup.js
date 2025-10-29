// Twitch Ad Blocker Popup Script

document.addEventListener('DOMContentLoaded', function() {
  // Get DOM elements
  const blockedCountElement = document.getElementById('blockedCount');
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  const extensionEnabledToggle = document.getElementById('extensionEnabled');
  const twitchAdBlockingToggle = document.getElementById('twitchAdBlocking');
  const aggressiveModeToggle = document.getElementById('aggressiveMode');
  const manualBlockButton = document.getElementById('manualBlock');
  const resetStatsButton = document.getElementById('resetStats');
  const debugVideoButton = document.getElementById('debugVideo');
  const helpLink = document.getElementById('helpLink');
  const reportLink = document.getElementById('reportLink');

  // Initialize popup
  init();

  async function init() {
    await loadSettings();
    await loadStats();
    setupEventListeners();
    checkTwitchTab();
  }

  // Load extension settings
  async function loadSettings() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getTwitchSettings' });
      
      extensionEnabledToggle.checked = response.extensionEnabled;
      twitchAdBlockingToggle.checked = response.twitchAdBlockingEnabled;
      aggressiveModeToggle.checked = response.aggressiveMode;
      
      updateStatusDisplay(response.extensionEnabled && response.twitchAdBlockingEnabled);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  // Load statistics
  async function loadStats() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getBlockedCount' });
      updateBlockedCount(response.count || 0);
    } catch (error) {
      console.error('Error loading stats:', error);
      updateBlockedCount(0);
    }
  }

  // Setup event listeners
  function setupEventListeners() {
    // Toggle switches
    extensionEnabledToggle.addEventListener('change', handleExtensionToggle);
    twitchAdBlockingToggle.addEventListener('change', handleTwitchAdBlockingToggle);
    aggressiveModeToggle.addEventListener('change', handleAggressiveModeToggle);

    // Action buttons
    manualBlockButton.addEventListener('click', handleManualBlock);
    resetStatsButton.addEventListener('click', handleResetStats);
    debugVideoButton.addEventListener('click', handleDebugVideo);

    // Help and report links
    helpLink.addEventListener('click', handleHelpClick);
    reportLink.addEventListener('click', handleReportClick);
  }

  // Check if current tab is Twitch
  async function checkTwitchTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const isTwitchTab = tab.url && tab.url.includes('twitch.tv');
      
      // Enable/disable manual block button based on current tab
      manualBlockButton.disabled = !isTwitchTab;
      
      if (!isTwitchTab) {
        manualBlockButton.innerHTML = '<span class="button-icon">🌐</span>Not on Twitch';
        manualBlockButton.title = 'Navigate to Twitch to use this feature';
      } else {
        manualBlockButton.innerHTML = '<span class="button-icon">🛡️</span>Block Ads Now';
        manualBlockButton.title = 'Manually block ads on current page';
      }
    } catch (error) {
      console.error('Error checking tab:', error);
    }
  }

  // Handle extension toggle
  async function handleExtensionToggle() {
    const enabled = extensionEnabledToggle.checked;
    
    try {
      await chrome.runtime.sendMessage({
        action: 'updateTwitchSettings',
        settings: { extensionEnabled: enabled }
      });
      
      updateStatusDisplay(enabled && twitchAdBlockingToggle.checked);
      
      // Show visual feedback
      showToast(enabled ? 'Extension enabled' : 'Extension disabled');
    } catch (error) {
      console.error('Error updating extension setting:', error);
      // Revert toggle on error
      extensionEnabledToggle.checked = !enabled;
    }
  }

  // Handle Twitch ad blocking toggle
  async function handleTwitchAdBlockingToggle() {
    const enabled = twitchAdBlockingToggle.checked;
    
    try {
      await chrome.runtime.sendMessage({
        action: 'updateTwitchSettings',
        settings: { twitchAdBlockingEnabled: enabled }
      });
      
      updateStatusDisplay(extensionEnabledToggle.checked && enabled);
      
      showToast(enabled ? 'Twitch ad blocking enabled' : 'Twitch ad blocking disabled');
    } catch (error) {
      console.error('Error updating Twitch ad blocking setting:', error);
      twitchAdBlockingToggle.checked = !enabled;
    }
  }

  // Handle aggressive mode toggle
  async function handleAggressiveModeToggle() {
    const enabled = aggressiveModeToggle.checked;
    
    try {
      await chrome.runtime.sendMessage({
        action: 'updateTwitchSettings',
        settings: { aggressiveMode: enabled }
      });
      
      showToast(enabled ? 'Aggressive mode enabled' : 'Aggressive mode disabled');
    } catch (error) {
      console.error('Error updating aggressive mode setting:', error);
      aggressiveModeToggle.checked = !enabled;
    }
  }

  // Handle manual block
  async function handleManualBlock() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url || !tab.url.includes('twitch.tv')) {
        showToast('Please navigate to Twitch first');
        return;
      }

      // Disable button temporarily
      manualBlockButton.disabled = true;
      manualBlockButton.innerHTML = '<span class="button-icon">⏳</span>Blocking...';

      const response = await chrome.tabs.sendMessage(tab.id, { action: 'manualBlock' });
      
      if (response && response.success) {
        showToast('Manual ad blocking triggered');
        // Refresh stats after a delay
        setTimeout(loadStats, 1000);
      } else {
        showToast('Failed to trigger manual blocking');
      }
    } catch (error) {
      console.error('Error triggering manual block:', error);
      showToast('Error: Could not communicate with page');
    } finally {
      // Re-enable button
      setTimeout(() => {
        manualBlockButton.disabled = false;
        manualBlockButton.innerHTML = '<span class="button-icon">🛡️</span>Block Ads Now';
      }, 2000);
    }
  }

  // Handle reset stats
  async function handleResetStats() {
    try {
      // Show confirmation
      if (!confirm('Are you sure you want to reset the ad blocking statistics?')) {
        return;
      }

      const response = await chrome.runtime.sendMessage({ action: 'resetTwitchStats' });
      
      if (response && response.success) {
        updateBlockedCount(0);
        showToast('Statistics reset successfully');
      } else {
        showToast('Failed to reset statistics');
      }
    } catch (error) {
      console.error('Error resetting stats:', error);
      showToast('Error resetting statistics');
    }
  }

  // Handle help click
  function handleHelpClick(e) {
    e.preventDefault();
    chrome.tabs.create({ 
      url: 'https://github.com/your-username/twitch-ad-blocker/wiki/help' 
    });
  }

  // Handle debug video
  async function handleDebugVideo() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url || !tab.url.includes('twitch.tv')) {
        showToast('Please navigate to Twitch first');
        return;
      }

      const response = await chrome.tabs.sendMessage(tab.id, { action: 'debugVideo' });
      
      if (response && response.success) {
        showToast('Debug info logged to console');
      } else {
        showToast('Failed to run debug');
      }
    } catch (error) {
      console.error('Error running debug:', error);
      showToast('Error: Could not run debug');
    }
  }

  // Handle report click
  function handleReportClick(e) {
    e.preventDefault();
    chrome.tabs.create({ 
      url: 'https://github.com/your-username/twitch-ad-blocker/issues/new' 
    });
  }

  // Update blocked count display
  function updateBlockedCount(count) {
    const currentCount = parseInt(blockedCountElement.textContent) || 0;
    blockedCountElement.textContent = count.toLocaleString();
    
    // Add animation if count increased
    if (count > currentCount) {
      blockedCountElement.classList.add('updated');
      setTimeout(() => {
        blockedCountElement.classList.remove('updated');
      }, 600);
    }
  }

  // Update status display
  function updateStatusDisplay(isActive) {
    if (isActive) {
      statusIndicator.classList.remove('inactive');
      statusIndicator.style.color = '#00f593';
      statusText.textContent = 'Active';
    } else {
      statusIndicator.classList.add('inactive');
      statusIndicator.style.color = '#ff6b6b';
      statusText.textContent = 'Inactive';
    }
  }

  // Show toast notification
  function showToast(message) {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());

    // Create new toast
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #9146ff;
      color: white;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      opacity: 0;
      transition: all 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
    }, 10);
    
    // Remove after delay
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(-10px)';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  // Listen for real-time updates from content script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'statsUpdated') {
      updateBlockedCount(request.count);
    }
    
    if (request.action === 'statusChanged') {
      updateStatusDisplay(request.isActive);
    }
  });

  // Periodically refresh stats while popup is open
  const statsRefreshInterval = setInterval(loadStats, 5000);
  
  // Clean up interval when popup closes
  window.addEventListener('unload', () => {
    clearInterval(statsRefreshInterval);
  });
});
