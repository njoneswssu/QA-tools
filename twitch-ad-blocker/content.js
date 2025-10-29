// Twitch Ad Blocker Content Script
let blockedAdsCount = 0;
let observer = null;
let videoObserver = null;
let adBlockingInterval = null;
let chatObserver = null;
let adDetectionActive = true;
let blockedElements = new Set();
let blockedVideoAds = new Set();
let chatFocusTimeout = null;
let lastStreamCheck = 0;

// Debug function to check video status
function debugVideoStatus() {
  const videos = document.querySelectorAll('video');
  const playerContainers = document.querySelectorAll('[data-a-target="video-player"], .video-player');
  
  console.log('=== VIDEO DEBUG INFO ===');
  console.log(`Found ${videos.length} video elements`);
  console.log(`Found ${playerContainers.length} player containers`);
  
  videos.forEach((video, index) => {
    console.log(`Video ${index}:`, {
      src: video.src,
      display: getComputedStyle(video).display,
      visibility: getComputedStyle(video).visibility,
      opacity: getComputedStyle(video).opacity,
      blocked: video.dataset.blocked,
      className: video.className,
      parentClassName: video.parentElement?.className
    });
  });
  
  playerContainers.forEach((container, index) => {
    console.log(`Container ${index}:`, {
      display: getComputedStyle(container).display,
      visibility: getComputedStyle(container).visibility,
      opacity: getComputedStyle(container).opacity,
      className: container.className,
      dataTarget: container.dataset.aTarget
    });
  });
  console.log('=== END DEBUG INFO ===');
}

// Initialize the extension
function init() {
  loadBlockedAdsCount();
  setupChatProtection(); // Protect chat interactions
  startTwitchAdBlocking();
  
  // Debug video status
  setTimeout(debugVideoStatus, 2000);
  
  console.log('Twitch Ad Blocker - initialized');
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
  } else if (request.action === 'debugVideo') {
    debugVideoStatus();
    forceRestoreMainVideoPlayer();
    sendResponse({ success: true });
  }
});

// Setup chat protection to avoid interfering with user interactions
function setupChatProtection() {
  const chatSelectors = [
    '[data-a-target="chat-input"]', 
    '.chat-input', 
    'textarea', 
    'input[type="text"]',
    '[contenteditable]',
    '.tw-textarea',
    '[data-a-target="search-input"]'
  ];
  
  function pauseExtensionForChat() {
    adDetectionActive = false;
    if (observer) observer.disconnect();
    console.log('Extension paused for chat interaction');
    
    if (chatFocusTimeout) clearTimeout(chatFocusTimeout);
    
    chatFocusTimeout = setTimeout(() => {
      adDetectionActive = true;
      setupMutationObserver();
      console.log('Extension resumed after chat interaction');
    }, 2000);
  }
  
  function resumeExtension() {
    if (chatFocusTimeout) clearTimeout(chatFocusTimeout);
    chatFocusTimeout = setTimeout(() => {
      adDetectionActive = true;
      if (!observer || !observer.takeRecords) {
        setupMutationObserver();
      }
      console.log('Extension resumed');
    }, 1000);
  }
  
  // Monitor for chat interactions
  document.addEventListener('focusin', (event) => {
    if (event.target && (
      event.target.matches('input, textarea, [contenteditable]') ||
      event.target.closest('[data-a-target="chat-input"], .chat-input, .tw-textarea')
    )) {
      pauseExtensionForChat();
    }
  }, true);
  
  document.addEventListener('focusout', (event) => {
    if (event.target && (
      event.target.matches('input, textarea, [contenteditable]') ||
      event.target.closest('[data-a-target="chat-input"], .chat-input, .tw-textarea')
    )) {
      resumeExtension();
    }
  }, true);
  
  document.addEventListener('input', (event) => {
    if (event.target && (
      event.target.matches('input, textarea, [contenteditable]') ||
      event.target.closest('[data-a-target="chat-input"], .chat-input, .tw-textarea')
    )) {
      pauseExtensionForChat();
    }
  }, true);
  
  console.log('Chat protection listeners added');
}

// Enhanced Twitch ad blocking functionality
function startTwitchAdBlocking() {
  // Immediate blocking on page load
  blockAllTwitchAds();

  // Enhanced mutation observer for dynamic content
  setupMutationObserver();
  
  // Video-specific monitoring for Twitch streams
  setupTwitchVideoMonitoring();
  
  // Aggressive interval checking for random ads
  setupTwitchAdBlockingIntervals();
  
  // Monitor for page navigation (Twitch SPA)
  setupTwitchNavigationDetection();
  
  console.log('Twitch ad blocking systems activated');
}

// Setup mutation observer with Twitch-specific detection
function setupMutationObserver() {
  if (observer) observer.disconnect();
  
  observer = new MutationObserver((mutations) => {
    if (!adDetectionActive) return;
    
    mutations.forEach((mutation) => {
      // Skip mutations related to chat and input elements
      if (mutation.target && (
        mutation.target.tagName === 'INPUT' ||
        mutation.target.tagName === 'TEXTAREA' ||
        mutation.target.matches && mutation.target.matches('[contenteditable]') ||
        mutation.target.closest && mutation.target.closest('[data-a-target="chat-input"], .chat-input, .tw-textarea')
      )) {
        return;
      }
      
      // Check for added nodes (new ads)
      if (mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) { // Element node
            // Skip if it's a chat-related element
            if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || 
                (node.matches && node.matches('[contenteditable]')) ||
                (node.closest && node.closest('[data-a-target="chat-input"], .chat-input, .tw-textarea'))) {
              return;
            }
            checkAndBlockTwitchNode(node);
          }
        });
      }
      
      // Check for attribute changes that might reveal ads
      if (mutation.type === 'attributes' && mutation.target && 
          mutation.target.tagName !== 'INPUT' && 
          mutation.target.tagName !== 'TEXTAREA' &&
          !(mutation.target.matches && mutation.target.matches('[contenteditable]'))) {
        checkAndBlockTwitchNode(mutation.target);
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'id', 'data-a-target', 'data-test-selector']
  });
}

// Setup Twitch video monitoring for random stream ads
function setupTwitchVideoMonitoring() {
  // Monitor all video elements
  const videos = document.querySelectorAll('video');
  videos.forEach(video => {
    monitorTwitchVideo(video);
  });
  
  // Watch for new videos
  const videoObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach(node => {
        if (node.tagName === 'VIDEO') {
          monitorTwitchVideo(node);
        } else if (node.querySelectorAll) {
          const newVideos = node.querySelectorAll('video');
          newVideos.forEach(video => monitorTwitchVideo(video));
        }
      });
    });
  });
  
  videoObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Monitor individual Twitch video for ad patterns
function monitorTwitchVideo(video) {
  if (video.dataset.twitchMonitored) return;
  video.dataset.twitchMonitored = 'true';
  
  // Listen for video events
  video.addEventListener('loadstart', () => checkTwitchVideoForAd(video));
  video.addEventListener('loadedmetadata', () => checkTwitchVideoForAd(video));
  video.addEventListener('timeupdate', () => checkTwitchVideoForAd(video));
  video.addEventListener('play', () => checkTwitchVideoForAd(video));
  video.addEventListener('pause', () => checkTwitchVideoForAd(video));
}

// Setup aggressive interval checking for random Twitch ads
function setupTwitchAdBlockingIntervals() {
  if (adBlockingInterval) clearInterval(adBlockingInterval);
  
  // Frequent check for video ads (Twitch ads appear randomly)
  adBlockingInterval = setInterval(() => {
    if (adDetectionActive && 
        !document.activeElement.matches('input, textarea, [contenteditable]') &&
        !document.activeElement.closest('[data-a-target="chat-input"], .chat-input, .tw-textarea')) {
      detectAndSkipTwitchVideoAds();
      blockTwitchDisplayAds();
    }
  }, 2000); // Check every 2 seconds for random ads
  
  // Comprehensive scan less frequently
  setInterval(() => {
    if (adDetectionActive && 
        !document.activeElement.matches('input, textarea, [contenteditable]') &&
        !document.activeElement.closest('[data-a-target="chat-input"], .chat-input, .tw-textarea')) {
      blockAllTwitchAds();
      ensureTwitchVideoVisibility();
    }
  }, 8000); // Full scan every 8 seconds
}

// Setup navigation detection for Twitch SPA
function setupTwitchNavigationDetection() {
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      console.log('Twitch navigation detected:', url);
      setTimeout(() => {
        blockedVideoAds.clear();
        cleanupOldBlockedElements();
        blockAllTwitchAds();
        setupTwitchVideoMonitoring();
      }, 1500); // Give Twitch time to load
    }
  }).observe(document, { subtree: true, childList: true });
}

// Block Twitch display ads (safer approach)
function blockTwitchDisplayAds() {
  if (DISABLE_ALL_BLOCKING) {
    return 0;
  }
  let adsBlocked = 0;
  
  const twitchAdSelectors = [
    // Twitch ad containers
    '[data-a-target="ad-banner"]',
    '[data-a-target="player-ad-notice"]', 
    '[data-test-selector="ad-banner"]',
    '.player-ad-notice',
    '.ad-banner',
    '.tw-ad-banner',
    
    // Video ad overlays
    '.video-ad',
    '.video-ads',
    '.player-overlay-ad',
    '.ads-overlay',
    
    // Promotional content
    '.promotion-banner',
    '.sponsored-content',
    '[data-a-target="promotion"]',
    
    // Generic ad patterns
    '[class*="ad-"]', 
    '[class*="ads-"]',
    '[data-a-target*="ad"]'
  ];
  
  twitchAdSelectors.forEach(selector => {
    try {
      const ads = document.querySelectorAll(selector);
      ads.forEach(ad => {
        if (!ad.dataset.blocked && ad.offsetParent !== null) {
          const elementId = createElementId(ad);
          if (!blockedElements.has(elementId)) {
            hideElement(ad);
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
    console.log(`Blocked ${adsBlocked} Twitch display ads`);
  }
}

// Enhanced comprehensive Twitch ad blocking
function blockAllTwitchAds() {
  if (DISABLE_ALL_BLOCKING) {
    console.log('Ad blocking disabled for debugging');
    return 0;
  }
  let adsBlocked = 0;
  
  // Twitch-specific ad selectors
  const twitchAdSelectors = [
    // Video player ads
    '.video-ads', '.video-ad', '.player-ad', '.player-overlay-ad',
    '.ads-overlay', '.ad-overlay', '.player-ad-notice',
    '[data-a-target="player-ad-notice"]',
    '[data-a-target="ad-banner"]',
    '[data-test-selector="ad-banner"]',
    
    // Stream ads and overlays
    '.stream-ad', '.live-ad', '.preroll-ad',
    '.midroll-ad', '.postroll-ad',
    
    // Twitch promotional content
    '.promotion-banner', '.sponsored-content',
    '.tw-ad-banner', '.tw-promotion',
    '[data-a-target="promotion"]',
    '[data-a-target="sponsored"]',
    
    // Ad containers and wrappers
    '.ad-banner', '.ads-container', '.advertisement',
    '.promo-container', '.sponsor-container',
    
    // Generic patterns for Twitch
    '[class*="ad-"]', '[class*="ads-"]', '[class*="advertisement"]',
    '[class*="sponsor"]', '[class*="promo"]',
    '[data-a-target*="ad"]', '[data-test-selector*="ad"]',
    
    // Third-party ad networks
    '[class*="google-ad"]', '[class*="amazon-ad"]'
  ];

  // Block using selectors
  twitchAdSelectors.forEach(selector => {
    try {
      const ads = document.querySelectorAll(selector);
      ads.forEach(ad => {
        if (!ad.dataset.blocked && ad.offsetParent !== null) {
          const elementId = createElementId(ad);
          if (!blockedElements.has(elementId)) {
            hideElement(ad);
            adsBlocked++;
          }
        }
      });
    } catch (e) {
      // Ignore invalid selectors
    }
  });

  // Advanced video ad detection and blocking
  adsBlocked += detectAndSkipTwitchVideoAds();
  
  // Block ads by URL patterns
  adsBlocked += blockTwitchAdsByURL();
  
  // Block ads by text content
  adsBlocked += blockTwitchAdsByContent();

  if (adsBlocked > 0) {
    incrementBlockedCount(adsBlocked);
    console.log(`Blocked ${adsBlocked} Twitch ads`);
  }
}

// Enhanced Twitch video ad detection and skipping
function detectAndSkipTwitchVideoAds() {
  let adsBlocked = 0;
  const video = document.querySelector('video[data-a-target="video-player"]') || document.querySelector('video');
  
  if (!video) return adsBlocked;

  // Check for Twitch ad indicators
  const twitchAdIndicators = [
    '[data-a-target="player-ad-notice"]',
    '.player-ad-notice',
    '.ad-banner',
    '.ads-overlay',
    '.video-ad',
    '[data-test-selector="ad-banner"]'
  ];

  const hasAdIndicator = twitchAdIndicators.some(selector => 
    document.querySelector(selector)
  );

  // Enhanced Twitch video ad detection
  if (hasAdIndicator || isTwitchVideoCurrentlyAd(video)) {
    const videoId = createElementId(video);
    const videoAdId = `twitch_video_ad_${video.src}_${video.currentTime}_${Date.now()}`;
    
    // Only count this video ad once per occurrence
    if (!blockedVideoAds.has(videoAdId)) {
      blockedVideoAds.add(videoAdId);
      
      // Method 1: Try to skip to end (works for preroll/midroll)
      if (video.duration && video.duration > 0 && video.duration < 999) {
        video.currentTime = video.duration - 0.1; // Skip to near end
      }
      
      // Method 2: Dramatically increase playback rate
      const originalRate = video.playbackRate;
      video.playbackRate = 16;
      
      // Method 3: Temporarily mute and hide
      const originalMuted = video.muted;
      video.muted = true;
      video.style.opacity = '0.1';
      
      // Method 4: Simulate ad completion
      setTimeout(() => {
        // Check if ad is still playing
        if (isTwitchVideoCurrentlyAd(video)) {
          // Force progress through ad
          if (video.currentTime < video.duration - 1) {
            video.currentTime += 30; // Skip forward 30 seconds
          }
        }
      }, 1000);
      
      // Restore video after delay
      setTimeout(() => {
        restoreTwitchVideoVisibility(video, originalRate, originalMuted);
      }, 3000);
      
      adsBlocked++;
      console.log('Twitch video ad blocked:', videoAdId);
      showNotification('Twitch ad skipped!');
    }
  } else {
    // Ensure video is visible if it's not an ad
    restoreTwitchVideoVisibility(video);
  }

  return adsBlocked;
}

// Check if current Twitch video is an ad
function isTwitchVideoCurrentlyAd(video) {
  // NEVER consider the main video player as an ad - CRITICAL PROTECTION
  if (video.matches('[data-a-target="video-player"]') || 
      video.closest('[data-a-target="video-player"]') ||
      video.matches('.video-player video') ||
      video.closest('.video-player')) {
    console.log('Protecting main video player from blocking');
    return false; // Always protect main video player
  }

  // Primary indicator: Check for explicit Twitch ad notice elements
  const adNoticeElements = document.querySelectorAll([
    '[data-a-target="player-ad-notice"]',
    '.player-ad-notice',
    '.ad-banner',
    '.ads-overlay',
    '[data-test-selector="ad-banner"]'
  ].join(','));
  
  if (adNoticeElements.length > 0) {
    // Only consider it an ad if the notice is actually visible
    const visibleAdNotice = Array.from(adNoticeElements).some(el => 
      el.offsetParent !== null && el.offsetHeight > 0
    );
    if (visibleAdNotice) {
      console.log('Twitch ad detected: Found visible ad notice elements');
      return true;
    }
  }

  // Only check video source for very specific ad domains - be more conservative
  if (video.src) {
    const definitiveAdDomains = [
      'doubleclick.net', 'googlesyndication.com',
      'amazon-adsystem.com', 'googleadservices.com'
    ];
    
    if (definitiveAdDomains.some(domain => video.src.includes(domain))) {
      console.log('Twitch ad detected: Definitive ad domain in video source');
      return true;
    }
  }

  // Check for very specific ad indicators in DOM - be conservative
  const adSkipButton = document.querySelector('[data-a-target="player-ad-skip-button"]') ||
                      document.querySelector('.player-ad-skip-button');
  if (adSkipButton && adSkipButton.offsetParent !== null) {
    console.log('Twitch ad detected: Ad skip button visible');
    return true;
  }

  // Default to NOT blocking - safer approach
  console.log('Video not identified as ad - allowing playback');
  return false;
}

// Block Twitch ads by URL patterns
function blockTwitchAdsByURL() {
  let adsBlocked = 0;
  
  const elementsWithUrls = document.querySelectorAll('a[href], iframe[src], img[src], video[src]');
  
  elementsWithUrls.forEach(element => {
    const url = element.href || element.src || '';
    const twitchAdPatterns = [
      'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
      'amazon-adsystem.com', 'adsystem.amazon.com',
      'video-ad-', 'ads.twitch.tv', 'gql.twitch.tv/ad',
      'pubads.g.doubleclick.net', 'tpc.googlesyndication.com'
    ];
    
    if (twitchAdPatterns.some(pattern => url.includes(pattern))) {
      hideElement(element);
      adsBlocked++;
    }
  });
  
  return adsBlocked;
}

// Block Twitch ads by content text
function blockTwitchAdsByContent() {
  let adsBlocked = 0;
  
  const twitchAdTexts = [
    'advertisement', 'sponsored', 'promoted', 'ad •',
    'ads in', 'this ad', 'skip ad', 'video ad',
    'commercial break', 'advertisement break',
    'sponsor', 'sponsorship'
  ];
  
  const textElements = document.querySelectorAll('span, div, p, a, [data-a-target]');
  textElements.forEach(element => {
    const text = element.textContent.toLowerCase();
    if (twitchAdTexts.some(adText => text.includes(adText))) {
      const adContainer = element.closest('[data-a-target*="ad"], .ad-banner, .ads-overlay, .player-ad-notice');
      if (adContainer) {
        hideElement(adContainer);
        adsBlocked++;
      }
    }
  });
  
  return adsBlocked;
}

// Enhanced element hiding for Twitch
function hideElement(element) {
  if (DISABLE_ALL_BLOCKING) {
    console.log('Blocking disabled - not hiding element:', element.tagName, element.className);
    return;
  }
  if (element.dataset.blocked) return;
  
  const elementId = createElementId(element);
  
  if (blockedElements.has(elementId)) {
    return;
  }
  
  // NEVER block video elements - too risky for main player
  if (element.tagName === 'VIDEO') {
    console.log('PROTECTED: Never blocking video elements to preserve playback');
    return;
  }
  
  // Don't block important Twitch UI elements
  const protectedTwitchSelectors = [
    // Core player and content
    '[data-a-target="video-player"]', '.video-player',
    '[data-a-target="player-controls"]', '.player-controls',
    
    // Twitch header and navigation
    '[data-a-target="top-nav"]', '.top-nav',
    '[data-a-target="search-input"]', '.tw-search-input',
    
    // Chat and interactions
    '[data-a-target="chat-input"]', '.chat-input', 
    '.chat-container', '.tw-textarea',
    
    // Stream info and controls
    '.stream-info', '.channel-info-content',
    '[data-a-target="stream-title"]',
    
    // Input elements
    'input', 'textarea', 'form', '[contenteditable]'
  ];
  
  if (protectedTwitchSelectors.some(selector => 
    element.matches && (element.matches(selector) || element.closest(selector) === element)
  )) {
    console.log('Skipping protected Twitch UI element:', element.className || element.id || element.tagName);
    return;
  }
  
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
    pointer-events: none !important;
  `;
  
  blockedElements.add(elementId);
  console.log('Hidden Twitch ad element:', element.className || element.tagName);
}

// Create unique identifier for element tracking
function createElementId(element) {
  const className = element.className || '';
  const id = element.id || '';
  const tagName = element.tagName || '';
  const dataTarget = element.dataset.aTarget || '';
  const dataTest = element.dataset.testSelector || '';
  const src = element.src || '';
  const href = element.href || '';
  const textContent = element.textContent ? element.textContent.substring(0, 50) : '';
  
  return `${tagName}_${className}_${id}_${dataTarget}_${dataTest}_${src}_${href}_${textContent}`.replace(/\s+/g, '_');
}

// Cleanup old blocked elements
function cleanupOldBlockedElements() {
  const existingElements = new Set();
  
  blockedElements.forEach(elementId => {
    if (Math.random() > 0.6) { // Clean up 40% of old entries
      existingElements.add(elementId);
    }
  });
  
  blockedElements = existingElements;
  console.log('Cleaned up Twitch blocked elements tracking');
}

// Check and block individual Twitch nodes
function checkAndBlockTwitchNode(node) {
  if (!node || node.nodeType !== 1) return;
  
  // Never interfere with chat and input elements
  if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || 
      (node.matches && node.matches('[contenteditable]')) ||
      (node.closest && node.closest('[data-a-target="chat-input"], .chat-input, .tw-textarea'))) {
    return;
  }
  
  // Skip if it's a protected Twitch UI element
  const protectedPatterns = [
    /chat/, /input/, /search/, /nav/, /player-controls/, /stream-info/
  ];
  
  const nodeInfo = `${node.className} ${node.id} ${node.tagName} ${node.dataset.aTarget || ''}`.toLowerCase();
  
  if (protectedPatterns.some(pattern => pattern.test(nodeInfo))) {
    return;
  }
  
  // Check for specific Twitch ad patterns
  const twitchAdPatterns = [
    /ad[_-]/, /[_-]ad$/, /advertisement/, /sponsored/, /promotion/,
    /video[_-]ad/, /player[_-]ad/, /ads[_-]/, /[_-]ads$/
  ];
  
  if (twitchAdPatterns.some(pattern => pattern.test(nodeInfo))) {
    hideElement(node);
    incrementBlockedCount(1);
    return;
  }
  
  // Check for Twitch ad data attributes
  if (node.dataset && (
    node.dataset.aTarget && node.dataset.aTarget.includes('ad') ||
    node.dataset.testSelector && node.dataset.testSelector.includes('ad')
  )) {
    hideElement(node);
    incrementBlockedCount(1);
    return;
  }
  
  // Check children for Twitch ad selectors
  if (node.querySelectorAll) {
    const adChildren = node.querySelectorAll([
      '[data-a-target*="ad"]', '[data-test-selector*="ad"]',
      '.ad-banner', '.ads-overlay', '.player-ad-notice',
      '.video-ad', '.promotion-banner'
    ].join(','));
    
    adChildren.forEach(adChild => {
      hideElement(adChild);
      incrementBlockedCount(1);
    });
  }
}

// Check Twitch video for ads
function checkTwitchVideoForAd(video) {
  if (isTwitchVideoCurrentlyAd(video)) {
    detectAndSkipTwitchVideoAds();
  } else {
    restoreTwitchVideoVisibility(video);
  }
}

// Restore Twitch video visibility and normal playback
function restoreTwitchVideoVisibility(video, originalRate = 1, originalMuted = false) {
  if (!video) return;
  
  // Don't restore if it's still an ad
  if (isTwitchVideoCurrentlyAd(video)) {
    return;
  }
  
  // Restore normal video properties
  video.style.opacity = '1';
  video.style.visibility = 'visible';
  video.style.display = '';
  
  // Restore normal playback rate
  if (video.playbackRate > 2) {
    video.playbackRate = originalRate || 1;
  }
  
  // Restore mute state
  video.muted = originalMuted || false;
  
  console.log('Twitch video visibility restored');
}

// Ensure all Twitch videos are visible when they should be
function ensureTwitchVideoVisibility() {
  const videos = document.querySelectorAll('video');
  videos.forEach(video => {
    if (isTwitchVideoCurrentlyAd(video)) {
      return;
    }
    
    if (video.style.opacity === '0' || video.style.visibility === 'hidden') {
      restoreTwitchVideoVisibility(video);
    }
  });
}

// Enhanced manual block ad function for Twitch
function manualBlockAd() {
  let adsBlocked = 0;
  
  console.log('Manual Twitch ad blocking triggered');
  
  // Force immediate comprehensive blocking
  adsBlocked += detectAndSkipTwitchVideoAds();
  
  // Aggressive video ad handling
  const video = document.querySelector('video[data-a-target="video-player"]') || document.querySelector('video');
  if (video && isTwitchVideoCurrentlyAd(video)) {
    // Force skip the ad
    if (video.duration && video.duration > 0) {
      video.currentTime = video.duration - 0.1;
    } else {
      video.currentTime = 999; // Force to end
    }
    video.playbackRate = 16; // Speed up dramatically
    adsBlocked++;
  }
  
  // Force block all visible ads
  blockAllTwitchAds();
  
  // Additional aggressive blocking
  adsBlocked += forceBlockStubbornTwitchAds();
  
  // Ensure video is visible after blocking
  setTimeout(() => {
    ensureTwitchVideoVisibility();
    forceRestoreMainVideoPlayer(); // Emergency restoration
  }, 1000);
  
  if (adsBlocked > 0) {
    showNotification(`Blocked ${adsBlocked} Twitch ads!`);
  } else {
    showNotification('Scan completed - no Twitch ads found');
  }
}

// Force block stubborn Twitch ads
function forceBlockStubbornTwitchAds() {
  let adsBlocked = 0;
  
  const aggressiveTwitchSelectors = [
    '*[class*="ad"]', '*[id*="ad"]', '*[class*="ads"]',
    '*[class*="advertisement"]', '*[class*="promo"]',
    '*[class*="sponsor"]', '*[data-a-target*="ad"]',
    '*[data-test-selector*="ad"]'
  ];
  
  aggressiveTwitchSelectors.forEach(selector => {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        const text = element.textContent.toLowerCase();
        const twitchAdKeywords = ['advertisement', 'sponsored', 'promoted', 'video ad', 'commercial'];
        
        if (twitchAdKeywords.some(keyword => text.includes(keyword)) ||
            (element.offsetHeight < 300 && element.offsetWidth > 200)) {
          hideElement(element);
          adsBlocked++;
        }
      });
    } catch (e) {
      // Ignore errors
    }
  });
  
  return adsBlocked;
}

// Show notification
function showNotification(message) {
  // Remove existing notifications
  const existingNotifications = document.querySelectorAll('.twitch-ad-blocker-notification');
  existingNotifications.forEach(notif => notif.remove());
  
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

// Emergency function to force restore main video player
function forceRestoreMainVideoPlayer() {
  const videoSelectors = [
    '[data-a-target="video-player"]',
    '[data-a-target="video-player"] video',
    '.video-player video',
    '.video-player__container video',
    'video[src*="twitch"]',
    'video[src*="hls"]',
    'video'
  ];
  
  videoSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(element => {
      if (element.tagName === 'VIDEO' || element.querySelector('video')) {
        const video = element.tagName === 'VIDEO' ? element : element.querySelector('video');
        
        // Force restore visibility with maximum specificity
        const forceVisibleStyle = `
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          position: relative !important;
          left: auto !important;
          top: auto !important;
          right: auto !important;
          bottom: auto !important;
          height: auto !important;
          width: auto !important;
          pointer-events: auto !important;
          transform: none !important;
          margin: auto !important;
          z-index: auto !important;
          clip: auto !important;
          clip-path: none !important;
          mask: none !important;
          filter: none !important;
          max-width: none !important;
          max-height: none !important;
          min-width: auto !important;
          min-height: auto !important;
        `;
        
        element.style.cssText = forceVisibleStyle;
        if (video && video !== element) {
          video.style.cssText = forceVisibleStyle;
        }
        
        // Remove any blocking attributes
        if (element.dataset.blocked) {
          delete element.dataset.blocked;
        }
        if (video && video.dataset.blocked) {
          delete video.dataset.blocked;
        }
        
        // Remove any classes that might hide the video
        element.classList.remove('hidden', 'invisible', 'ad-blocked');
        if (video) {
          video.classList.remove('hidden', 'invisible', 'ad-blocked');
        }
        
        console.log('Emergency restoration applied to video element:', element.tagName, element.className);
      }
    });
  });
  
  // Also check for hidden parent containers
  const playerContainers = document.querySelectorAll('[data-a-target="video-player"], .video-player, .video-player__container');
  playerContainers.forEach(container => {
    if (container.style.display === 'none' || container.style.visibility === 'hidden' || container.style.opacity === '0') {
      container.style.cssText = `
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        position: relative !important;
        height: auto !important;
        width: auto !important;
      `;
      console.log('Restored hidden video container:', container.className);
    }
  });
}

// DISABLE ALL AD BLOCKING TEMPORARILY FOR DEBUGGING
let DISABLE_ALL_BLOCKING = true;

// Run emergency restoration immediately and periodically
forceRestoreMainVideoPlayer(); // Run immediately
setInterval(forceRestoreMainVideoPlayer, 2000); // Every 2 seconds
setTimeout(forceRestoreMainVideoPlayer, 500); // Also after 500ms delay

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
    setTimeout(init, 1500); // Delay to let Twitch page load
  }
}).observe(document, { subtree: true, childList: true });
