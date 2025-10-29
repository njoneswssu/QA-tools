// YouTube Ad Blocker Content Script - Clean Version
let blockedAdsCount = 0;
let observer = null;
let videoObserver = null;
let adBlockingInterval = null;
let lastVideoSrc = '';
let adDetectionActive = true;
let blockedElements = new Set(); // Track already blocked elements
let blockedVideoAds = new Set(); // Track blocked video ads by URL/ID
let searchFocusTimeout = null; // Track search focus state

// Initialize the extension
function init() {
  loadBlockedAdsCount();
  setupSearchProtection(); // Set up search focus protection first
  startEnhancedAdBlocking();
  console.log('YouTube Ad Blocker - initialized (no floating controls)');
}

// Listen for messages from popup for manual ad blocking
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

// Setup comprehensive search protection
function setupSearchProtection() {
  // Add event listeners to all search-related elements
  const searchSelectors = [
    'input[type="search"]', 'input[type="text"]', 'textarea',
    '[contenteditable]', '.ytd-searchbox input', '#search input',
    '.search-input', '#search-input'
  ];
  
  // Function to pause extension when search is active
  function pauseExtensionForSearch() {
    adDetectionActive = false;
    if (observer) observer.disconnect();
    console.log('Extension paused for search interaction');
    
    // Clear any existing timeout
    if (searchFocusTimeout) clearTimeout(searchFocusTimeout);
    
    // Resume after search interaction ends
    searchFocusTimeout = setTimeout(() => {
      adDetectionActive = true;
      setupMutationObserver(); // Reconnect observer
      console.log('Extension resumed after search interaction');
    }, 3000); // Wait 3 seconds after last search interaction
  }
  
  // Function to resume extension
  function resumeExtension() {
    if (searchFocusTimeout) clearTimeout(searchFocusTimeout);
    searchFocusTimeout = setTimeout(() => {
      adDetectionActive = true;
      if (!observer || !observer.takeRecords) {
        setupMutationObserver(); // Reconnect observer if needed
      }
      console.log('Extension resumed');
    }, 1000);
  }
  
  // Monitor for search interactions
  document.addEventListener('focusin', (event) => {
    if (event.target && (
      event.target.matches('input, textarea, [contenteditable]') ||
      event.target.closest('.ytd-searchbox, #search, .search-container')
    )) {
      pauseExtensionForSearch();
    }
  }, true);
  
  document.addEventListener('focusout', (event) => {
    if (event.target && (
      event.target.matches('input, textarea, [contenteditable]') ||
      event.target.closest('.ytd-searchbox, #search, .search-container')
    )) {
      resumeExtension();
    }
  }, true);
  
  // Also monitor for typing in search
  document.addEventListener('input', (event) => {
    if (event.target && (
      event.target.matches('input, textarea, [contenteditable]') ||
      event.target.closest('.ytd-searchbox, #search, .search-container')
    )) {
      pauseExtensionForSearch();
    }
  }, true);
  
  // Monitor clicks on search elements
  document.addEventListener('click', (event) => {
    if (event.target && (
      event.target.matches('input, textarea, [contenteditable]') ||
      event.target.closest('.ytd-searchbox, #search, .search-container')
    )) {
      pauseExtensionForSearch();
    }
  }, true);
  
  console.log('Search protection listeners added');
}

// Enhanced ad blocking functionality
function startEnhancedAdBlocking() {
  // Immediate blocking on page load
  blockAllAds();

  // Enhanced mutation observer for dynamic content
  setupMutationObserver();
  
  // Video-specific monitoring
  setupVideoMonitoring();
  
  // Aggressive interval checking for stubborn ads
  setupAdBlockingIntervals();
  
  // Monitor for page navigation (YouTube SPA)
  setupNavigationDetection();
  
  console.log('Enhanced ad blocking systems activated');
}

// Setup mutation observer with enhanced detection
function setupMutationObserver() {
  if (observer) observer.disconnect();
  
  observer = new MutationObserver((mutations) => {
    // Don't process any mutations if extension is paused for search
    if (!adDetectionActive) {
      return;
    }
    
    mutations.forEach((mutation) => {
      // Skip mutations related to input elements or focus
      if (mutation.target && (
        mutation.target.tagName === 'INPUT' ||
        mutation.target.tagName === 'TEXTAREA' ||
        mutation.target.matches && mutation.target.matches('[contenteditable]') ||
        mutation.target.closest && mutation.target.closest('.ytd-searchbox, #search, input, textarea')
      )) {
        return; // Don't interfere with input elements
      }
      
      // Check for added nodes (new ads)
      if (mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) { // Element node
            // Skip if it's an input-related element
            if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || 
                (node.matches && node.matches('[contenteditable]')) ||
                (node.closest && node.closest('.ytd-searchbox, #search, input, textarea'))) {
              return;
            }
            checkAndBlockNode(node);
          }
        });
      }
      
      // Check for attribute changes that might reveal ads (but not on inputs)
      if (mutation.type === 'attributes' && mutation.target && 
          mutation.target.tagName !== 'INPUT' && 
          mutation.target.tagName !== 'TEXTAREA' &&
          !(mutation.target.matches && mutation.target.matches('[contenteditable]'))) {
        checkAndBlockNode(mutation.target);
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'id', 'data-ad-slot-id', 'data-ad-type']
  });
}

// Setup video-specific monitoring
function setupVideoMonitoring() {
  // Monitor all video elements
  const videos = document.querySelectorAll('video');
  videos.forEach(video => {
    monitorVideo(video);
  });
  
  // Watch for new videos
  const videoObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach(node => {
        if (node.tagName === 'VIDEO') {
          monitorVideo(node);
        } else if (node.querySelectorAll) {
          const newVideos = node.querySelectorAll('video');
          newVideos.forEach(video => monitorVideo(video));
        }
      });
    });
  });
  
  videoObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Monitor individual video for ad patterns
function monitorVideo(video) {
  if (video.dataset.monitored) return;
  video.dataset.monitored = 'true';
  
  // Listen for video events
  video.addEventListener('loadstart', () => checkVideoForAd(video));
  video.addEventListener('loadedmetadata', () => checkVideoForAd(video));
  video.addEventListener('timeupdate', () => checkVideoForAd(video));
  video.addEventListener('play', () => checkVideoForAd(video));
}

// Setup aggressive interval checking
function setupAdBlockingIntervals() {
  // Clear existing interval
  if (adBlockingInterval) clearInterval(adBlockingInterval);
  
  // Gentle interval for ad detection (completely disabled during search)
  adBlockingInterval = setInterval(() => {
    if (adDetectionActive && 
        !document.activeElement.matches('input, textarea, [contenteditable]') &&
        !document.activeElement.closest('.ytd-searchbox, #search, .search-container')) {
      detectAndSkipVideoAds(); // Focus on video ads primarily
      blockDisplayAds(); // Only block display ads, not everything
    }
  }, 3000); // Check every 3 seconds (even less frequent)
  
  // Slower comprehensive scan (completely disabled during search)
  setInterval(() => {
    if (adDetectionActive && 
        !document.activeElement.matches('input, textarea, [contenteditable]') &&
        !document.activeElement.closest('.ytd-searchbox, #search, .search-container')) {
      blockAllAds();
      ensureVideoVisibility(); // Ensure videos are visible
    }
  }, 10000); // Full scan every 10 seconds (much less frequent)
}

// Setup navigation detection for YouTube SPA
function setupNavigationDetection() {
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      console.log('YouTube navigation detected:', url);
      // Reset ad detection after navigation
      setTimeout(() => {
        // Clear tracking for new page
        blockedVideoAds.clear();
        // Keep element tracking but clean up old elements
        cleanupOldBlockedElements();
        blockAllAds();
        setupVideoMonitoring();
      }, 1000);
    }
  }).observe(document, { subtree: true, childList: true });
}

// Conservative display ad blocking (safer)
function blockDisplayAds() {
  let adsBlocked = 0;
  
  // Only target obvious ad containers, not videos
  const safeAdSelectors = [
    '.masthead-ad', '.ytd-display-ad-renderer',
    '.ytd-promoted-sparkles-web-renderer', 
    '.pyv-afc-ads-container', '.ytd-companion-slot-renderer',
    '[data-ad-slot-id]', '[data-ad-type]',
    'ytd-in-feed-ad-layout-renderer', 'ytd-search-promoted-item-renderer'
  ];
  
  safeAdSelectors.forEach(selector => {
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
    console.log(`Blocked ${adsBlocked} display ads`);
  }
}

// Enhanced comprehensive ad blocking
function blockAllAds() {
  let adsBlocked = 0;
  
  // Modern YouTube ad selectors (updated for 2024)
  const enhancedAdSelectors = [
    // Video player ads
    '.video-ads', '.ytp-ad-module', '.ytp-ad-overlay-container',
    '.ytp-ad-text-overlay', '.ytp-ad-player-overlay',
    '.ytp-ad-image-overlay', '.ytp-ad-preview-container',
    
    // Skip button and ad controls
    '.ytp-ad-skip-button-container', '.ytp-ad-skip-button',
    '.ytp-skip-ad-button', '.ytp-ad-button',
    
    // Display and banner ads
    '.masthead-ad', '.ytd-display-ad-renderer',
    '.ytd-promoted-sparkles-web-renderer', '.ytd-ad-slot-renderer',
    '.ytd-promoted-video-renderer', '.ytd-compact-promoted-video-renderer',
    
    // Feed and search ads
    'ytd-in-feed-ad-layout-renderer', 'ytd-search-promoted-item-renderer',
    'ytd-promoted-video-renderer', 'ytd-ad-slot-renderer',
    
    // Sidebar and overlay ads
    '.pyv-afc-ads-container', '.ytd-companion-slot-renderer',
    '.ytd-banner-promo-renderer', '.ytd-popup-container',
    
    // Data attribute selectors
    '[data-ad-slot-id]', '[data-ad-type]', '[data-ad-creative-id]',
    '[data-test-id*="ad"]', '[id*="google_ads"]',
    
    // Modern YouTube components
    'ytd-statement-banner-renderer', 'ytd-brand-video-singleton-renderer',
    'ytd-player-legacy-desktop-watch-ads-renderer',
    
    // Generic ad patterns
    '[class*="ad-"]', '[id*="ad-"]', '[class*="ads-"]',
    '[class*="advertisement"]', '[class*="sponsor"]'
  ];

  // Block using selectors
  enhancedAdSelectors.forEach(selector => {
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
  adsBlocked += detectAndSkipVideoAds();
  
  // Block ads by URL patterns
  adsBlocked += blockAdsByURL();
  
  // Block ads by text content
  adsBlocked += blockAdsByContent();

  if (adsBlocked > 0) {
    incrementBlockedCount(adsBlocked);
    console.log(`Blocked ${adsBlocked} ads`);
  }
}

// Enhanced video ad detection and skipping
function detectAndSkipVideoAds() {
  let adsBlocked = 0;
  const video = document.querySelector('video');
  
  if (!video) return adsBlocked;

  // Multiple skip button selectors
  const skipSelectors = [
    '.ytp-ad-skip-button', '.ytp-skip-ad-button',
    '.ytp-ad-skip-button-container button',
    '.ytp-ad-skip-button-text', '[aria-label*="Skip"]',
    '.videoAdUiSkipButton', '.skip-button'
  ];

  // Try to click skip button
  for (const selector of skipSelectors) {
    const skipButton = document.querySelector(selector);
    if (skipButton && skipButton.offsetParent !== null) {
      const skipButtonId = createElementId(skipButton);
      if (!blockedElements.has(skipButtonId)) {
        skipButton.click();
        blockedElements.add(skipButtonId);
        adsBlocked++;
        showNotification('Ad skipped!');
      }
      break;
    }
  }

  // Check for ad indicators in DOM
  const adIndicators = [
    '.ytp-ad-text', '.ytp-ad-duration-remaining',
    '.ytp-ad-preview-text', '[class*="ad-showing"]',
    '.video-ads-text', '[data-ad-slot-id]'
  ];

  const hasAdIndicator = adIndicators.some(selector => 
    document.querySelector(selector)
  );

  // Enhanced video ad detection
  if (hasAdIndicator || isVideoCurrentlyAd(video)) {
    const videoId = createElementId(video);
    const videoAdId = `video_ad_${video.src}_${video.currentTime}`;
    
    // Only count this video ad once
    if (!blockedVideoAds.has(videoAdId)) {
      blockedVideoAds.add(videoAdId);
      
      // Method 1: Skip to end of video
      if (video.duration && video.duration > 0 && video.duration < 999) {
        video.currentTime = video.duration;
      }
      
      // Method 2: Increase playback rate dramatically
      video.playbackRate = 16;
      
      // Method 3: Mute and hide temporarily
      video.muted = true;
      video.style.opacity = '0';
      
      // Restore video after a short delay
      setTimeout(() => {
        restoreVideoVisibility(video);
      }, 2000);
      
      adsBlocked++;
      console.log('Video ad blocked and counted:', videoAdId);
    }
  } else {
    // Ensure video is visible if it's not an ad
    restoreVideoVisibility(video);
  }

  return adsBlocked;
}

// Enhanced but safer check if current video is an ad
function isVideoCurrentlyAd(video) {
  // Primary indicator: Check for explicit ad overlay elements
  const adIndicators = document.querySelectorAll([
    '.ytp-ad-text', '.ytp-ad-duration-remaining',
    '.ytp-ad-preview-text', '.ytp-ad-overlay-container',
    '.ytp-ad-skip-button', '.ytp-skip-ad-button'
  ].join(','));
  
  if (adIndicators.length > 0) {
    console.log('Ad detected: Found ad overlay elements');
    return true;
  }

  // Secondary: Check video source for ad domains (be more specific)
  if (video.src) {
    const adDomains = [
      'googleadservices.com', 'googlesyndication.com', 
      'doubleclick.net', 'googleads.g.doubleclick.net'
    ];
    
    if (adDomains.some(domain => video.src.includes(domain))) {
      console.log('Ad detected: Ad domain in video source');
      return true;
    }
  }

  // Tertiary: Check for ad-specific YouTube player classes
  const playerContainer = video.closest('.html5-video-player');
  if (playerContainer) {
    const hasAdClass = Array.from(playerContainer.classList).some(className => 
      className.includes('ad-showing') || className.includes('ad-mode')
    );
    if (hasAdClass) {
      console.log('Ad detected: Player has ad classes');
      return true;
    }
  }

  // Check for "Skip Ad" text in page
  const skipText = document.querySelector('*[class*="skip"], *[aria-label*="skip" i]');
  if (skipText && skipText.textContent.toLowerCase().includes('skip ad')) {
    console.log('Ad detected: Skip ad text found');
    return true;
  }

  return false;
}

// Block ads by URL patterns
function blockAdsByURL() {
  let adsBlocked = 0;
  
  // Find elements with ad URLs
  const elementsWithUrls = document.querySelectorAll('a[href], iframe[src], img[src], video[src]');
  
  elementsWithUrls.forEach(element => {
    const url = element.href || element.src || '';
    const adPatterns = [
      'googleadservices', 'googlesyndication', 'doubleclick',
      'googleads', 'adsystem', 'youtube.com/ads',
      'youtube.com/ptracking', 'google.com/pagead'
    ];
    
    if (adPatterns.some(pattern => url.includes(pattern))) {
      hideElement(element);
      adsBlocked++;
    }
  });
  
  return adsBlocked;
}

// Block ads by content text
function blockAdsByContent() {
  let adsBlocked = 0;
  
  const adTexts = [
    'advertisement', 'sponsored', 'promoted', 'ad •',
    'ads by', 'includes paid promotion', 'skip ad',
    'skip ads', 'video will play after ad'
  ];
  
  const textElements = document.querySelectorAll('span, div, p, a');
  textElements.forEach(element => {
    const text = element.textContent.toLowerCase();
    if (adTexts.some(adText => text.includes(adText))) {
      const adContainer = element.closest('.ytd-ad-slot-renderer, .ytd-display-ad-renderer, [data-ad-slot-id]');
      if (adContainer) {
        hideElement(adContainer);
        adsBlocked++;
      }
    }
  });
  
  return adsBlocked;
}

// Enhanced but safer element hiding
function hideElement(element) {
  if (element.dataset.blocked) return;
  
  // Create unique identifier for this element
  const elementId = createElementId(element);
  
  // Skip if already blocked
  if (blockedElements.has(elementId)) {
    return;
  }
  
  // Don't block video elements unless we're absolutely sure they're ads
  if (element.tagName === 'VIDEO') {
    if (!isVideoCurrentlyAd(element)) {
      console.log('Skipping video element - not confirmed as ad');
      return;
    }
  }
  
  // Don't block main content containers or YouTube UI elements
  const protectedSelectors = [
    // Core video and content areas
    '#player', '#movie_player', '.html5-video-player',
    '#primary', '#secondary', '.watch-flexy', '#content',
    
    // YouTube header and navigation
    '#masthead', '.ytd-masthead', '#header', '.header',
    '.ytd-searchbox', '#search-form', '#search', '.search-container',
    '.ytd-topbar-menu-button-renderer', '.topbar-header',
    
    // YouTube sidebar and navigation
    '#guide', '.ytd-guide-renderer', '.guide-wrapper',
    '.ytd-mini-guide-renderer', '#guide-content',
    
    // YouTube page structure
    '.ytd-page-manager', '.ytd-app', '#page-manager',
    
    // Input elements and forms (critical for search)
    'input', 'textarea', 'form', '[contenteditable]',
    '.ytd-searchbox-spt', '#search-input', '.search-input',
    'ytd-searchbox', 'input[type="search"]', 'input[type="text"]'
  ];
  
  if (protectedSelectors.some(selector => 
    element.matches && (element.matches(selector) || element.closest(selector) === element)
  )) {
    console.log('Skipping protected YouTube UI element:', element.className || element.id || element.tagName);
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
  `;
  
  // Track this element as blocked
  blockedElements.add(elementId);
  
  console.log('Hidden element:', element.className || element.tagName);
}

// Create unique identifier for element tracking
function createElementId(element) {
  // Use multiple attributes to create a unique identifier
  const className = element.className || '';
  const id = element.id || '';
  const tagName = element.tagName || '';
  const src = element.src || '';
  const href = element.href || '';
  const textContent = element.textContent ? element.textContent.substring(0, 50) : '';
  
  return `${tagName}_${className}_${id}_${src}_${href}_${textContent}`.replace(/\s+/g, '_');
}

// Cleanup old blocked elements to prevent memory leaks
function cleanupOldBlockedElements() {
  // Only keep elements that still exist in the DOM
  const existingElements = new Set();
  
  blockedElements.forEach(elementId => {
    // Check if any element with this pattern still exists
    // This is a simple cleanup - more complex logic could be added
    if (Math.random() > 0.7) { // Randomly clean up some old entries
      existingElements.add(elementId);
    }
  });
  
  blockedElements = existingElements;
  console.log('Cleaned up blocked elements tracking');
}

// Check and block individual nodes (more conservative)
function checkAndBlockNode(node) {
  if (!node || node.nodeType !== 1) return;
  
  // Never interfere with input elements
  if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || 
      (node.matches && node.matches('[contenteditable]')) ||
      (node.closest && node.closest('.ytd-searchbox, #search, input, textarea, form'))) {
    return;
  }
  
  // Skip if it's a protected YouTube UI element
  const protectedPatterns = [
    /header/, /search/, /guide/, /masthead/, /topbar/, /nav/, /menu/, /input/, /form/
  ];
  
  const nodeInfo = `${node.className} ${node.id} ${node.tagName}`.toLowerCase();
  
  if (protectedPatterns.some(pattern => pattern.test(nodeInfo))) {
    return; // Don't block YouTube UI elements
  }
  
  // Only check for very specific ad patterns
  const specificAdPatterns = [
    /^ad[_-]/, /[_-]ad$/, /advertisement/, /sponsored/, /promotion/,
    /google[_-]?ads/, /doubleclick/, /adsystem/
  ];
  
  if (specificAdPatterns.some(pattern => pattern.test(nodeInfo))) {
    hideElement(node);
    incrementBlockedCount(1);
    return;
  }
  
  // Check for explicit ad data attributes
  if (node.dataset && (node.dataset.adSlotId || node.dataset.adType || node.dataset.adCreativeId)) {
    hideElement(node);
    incrementBlockedCount(1);
    return;
  }
  
  // Only check children for very specific ad selectors
  if (node.querySelectorAll) {
    const adChildren = node.querySelectorAll([
      '[data-ad-slot-id]', '[data-ad-type]', '[data-ad-creative-id]',
      '.ytd-display-ad-renderer', '.ytd-promoted-sparkles-web-renderer',
      '.masthead-ad', '.pyv-afc-ads-container'
    ].join(','));
    
    adChildren.forEach(adChild => {
      hideElement(adChild);
      incrementBlockedCount(1);
    });
  }
}

// Enhanced video monitoring
function checkVideoForAd(video) {
  if (isVideoCurrentlyAd(video)) {
    detectAndSkipVideoAds();
  } else {
    // Ensure video is visible for non-ads
    restoreVideoVisibility(video);
  }
}

// Restore video visibility and normal playback
function restoreVideoVisibility(video) {
  if (!video) return;
  
  // Don't restore if it's still an ad
  if (isVideoCurrentlyAd(video)) {
    return;
  }
  
  // Restore normal video properties
  video.style.opacity = '1';
  video.style.visibility = 'visible';
  video.style.display = '';
  
  // Restore normal playback rate
  if (video.playbackRate > 2) {
    video.playbackRate = 1;
  }
  
  // Only unmute if user hasn't manually muted
  const muteButton = document.querySelector('.ytp-mute-button');
  if (muteButton && !muteButton.classList.contains('ytp-muted')) {
    video.muted = false;
  }
  
  console.log('Video visibility restored');
}

// Ensure all videos are visible when they should be
function ensureVideoVisibility() {
  const videos = document.querySelectorAll('video');
  videos.forEach(video => {
    // Skip if it's currently an ad
    if (isVideoCurrentlyAd(video)) {
      return;
    }
    
    // Restore visibility if video is hidden but shouldn't be
    if (video.style.opacity === '0' || video.style.visibility === 'hidden') {
      restoreVideoVisibility(video);
    }
  });
}

// Enhanced manual block ad function
function manualBlockAd() {
  let adsBlocked = 0;
  
  console.log('Manual ad blocking triggered');
  
  // Force immediate comprehensive blocking
  adsBlocked += detectAndSkipVideoAds();
  
  // Aggressive video ad handling
  const video = document.querySelector('video');
  if (video) {
    // Try multiple skip methods
    const skipSelectors = [
      '.ytp-ad-skip-button', '.ytp-skip-ad-button',
      '.ytp-ad-skip-button-container button',
      '[aria-label*="Skip"]', '.videoAdUiSkipButton'
    ];
    
    let skipped = false;
    for (const selector of skipSelectors) {
      const skipButton = document.querySelector(selector);
      if (skipButton && skipButton.offsetParent !== null) {
        skipButton.click();
        adsBlocked++;
        skipped = true;
        break;
      }
    }
    
    // If no skip button, force skip the video
    if (!skipped && isVideoCurrentlyAd(video)) {
      if (video.duration && video.duration > 0) {
        video.currentTime = video.duration;
      } else {
        video.currentTime = 999; // Force to end
      }
      video.playbackRate = 16; // Speed up
      adsBlocked++;
    }
  }
  
  // Force block all visible ads
  blockAllAds();
  
  // Additional aggressive blocking
  adsBlocked += forceBlockStubbornAds();
  
  // Ensure video is visible after blocking
  setTimeout(() => {
    ensureVideoVisibility();
  }, 1000);
  
  if (adsBlocked > 0) {
    showNotification(`Blocked ${adsBlocked} ads!`);
  } else {
    showNotification('Scan completed - no ads found');
  }
}

// Force block stubborn ads that resist normal blocking
function forceBlockStubbornAds() {
  let adsBlocked = 0;
  
  // Block by partial class names and common ad patterns
  const aggressiveSelectors = [
    '*[class*="ad"]', '*[id*="ad"]', '*[class*="ads"]',
    '*[class*="advertisement"]', '*[class*="promo"]',
    '*[class*="sponsor"]', '*[data-ad]', '*[data-ads]'
  ];
  
  aggressiveSelectors.forEach(selector => {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        // Only block if it looks like an ad container
        const text = element.textContent.toLowerCase();
        const adKeywords = ['skip ad', 'advertisement', 'sponsored', 'promoted'];
        
        if (adKeywords.some(keyword => text.includes(keyword)) ||
            element.offsetHeight < 200 && element.offsetWidth > 300) {
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
  const notification = document.createElement('div');
  notification.className = 'ad-blocker-notification';
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 2000);
}

// Increment blocked ads count
function incrementBlockedCount(count = 1) {
  blockedAdsCount += count;
  updateCounterDisplay();
  saveBlockedAdsCount();
}

// Update counter (now only updates storage and badge)
function updateCounterDisplay() {
  // Update extension badge
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

// Also initialize on page changes (YouTube SPA)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setTimeout(init, 1000); // Delay to let page load
  }
}).observe(document, { subtree: true, childList: true });
