// Twitch Ad Blocker - MINIMAL VERSION
// This version does almost nothing to avoid any interference

let blockedAdsCount = 0;
let currentAdSpeedApplied = false; // Flag to prevent multiple speed applications
let adMonitorInterval = null; // Track the current monitoring interval

console.log('Twitch Ad Blocker - MINIMAL VERSION loaded');

// Initialize the extension
function init() {
  loadBlockedAdsCount();
  console.log('Twitch Ad Blocker - MINIMAL VERSION initialized');
  
  // Run initial blocking after page loads
  setTimeout(() => {
    blockOnlyObviousAds();
  }, 3000);
  
  // Check for ads periodically (less aggressive to avoid page issues)
  setInterval(() => {
    blockOnlyObviousAds();
  }, 5000);
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'manualBlock') {
    blockOnlyObviousAds();
    showNotification('Manual blocking completed');
    sendResponse({ success: true });
  } else if (request.action === 'getStats') {
    sendResponse({ 
      blockedCount: blockedAdsCount,
      isActive: true 
    });
  }
});

// Enhanced ad detection for Twitch video ads and overlays
function blockOnlyObviousAds() {
  let adsBlocked = 0;
  
  // Block video ad overlays and banners
  adsBlocked += blockTwitchVideoAdOverlays();
  
  // Block obvious banner ads
  adsBlocked += blockObviousBannerAds();
  
  // Try to skip video ads
  adsBlocked += detectAndSkipVideoAds();
  
  if (adsBlocked > 0) {
    incrementBlockedCount(adsBlocked);
    console.log(`Blocked ${adsBlocked} ads`);
  }
}

// Block Twitch video ad overlays (the banners over the video)
function blockTwitchVideoAdOverlays() {
  let adsBlocked = 0;
  
  // Target ad overlay elements that appear over the video
  const adOverlaySelectors = [
    '[data-a-target="player-ad-notice"]',
    '.player-ad-notice',
    '[data-test-selector="ad-banner"]',
    '.ads-overlay',
    '.video-ads-overlay',
    '.player-overlay-ad'
  ];
  
  adOverlaySelectors.forEach(selector => {
    try {
      const overlays = document.querySelectorAll(selector);
      overlays.forEach(overlay => {
        if (!overlay.dataset.blocked && overlay.offsetParent !== null) {
          overlay.dataset.blocked = 'true';
          overlay.style.cssText = `
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
          `;
          adsBlocked++;
          console.log('Blocked ad overlay:', overlay.className);
        }
      });
    } catch (e) {
      // Ignore errors
    }
  });
  
  return adsBlocked;
}

// Block obvious banner ads (not video-related)
function blockObviousBannerAds() {
  let adsBlocked = 0;
  
  const bannerAdSelectors = [
    '[data-a-target="ad-banner"]',
    '.masthead-ad',
    '.right-column .ad-banner'
  ];
  
  bannerAdSelectors.forEach(selector => {
    try {
      const ads = document.querySelectorAll(selector);
      ads.forEach(ad => {
        if (!ad.closest('[data-a-target="video-player"]') && 
            !ad.closest('.video-player') &&
            !ad.querySelector('video') &&
            !ad.dataset.blocked) {
          
          ad.dataset.blocked = 'true';
          ad.style.display = 'none';
          adsBlocked++;
        }
      });
    } catch (e) {
      // Ignore errors
    }
  });
  
  return adsBlocked;
}

// Detect and skip video ads by looking for ad indicators
function detectAndSkipVideoAds() {
  let adsBlocked = 0;
  
  // Look for text indicators of ads (enhanced for longer ads)
  const adTextIndicators = [
    'is taking an ad break',
    'stick around to support the stream',
    'Ad (',
    'Advertisement',
    'Sponsored content',
    'seconds left',
    'Skip Ad',
    'Learn More',
    'Shop Now',
    'Get the App'
  ];
  
  // Check ONLY specific ad overlay elements for ad text (not all elements)
  const adOverlayElements = document.querySelectorAll([
    '[data-a-target="player-ad-notice"]',
    '.player-ad-notice', 
    '[data-test-selector="ad-banner"]',
    '.ads-overlay',
    '.video-ads-overlay',
    '.player-overlay-ad',
    '.tw-flex-column .tw-pd-05',
    '.player-overlay-background'
  ].join(','));
  
  let adDetected = false;
  
  for (const element of adOverlayElements) {
    const text = element.textContent || '';
    if (adTextIndicators.some(indicator => text.includes(indicator))) {
      console.log('Ad detected by text in overlay:', text.substring(0, 100));
      adDetected = true;
      
      // Safety check: Never hide essential page elements
      if (!element.dataset.blocked && 
          element.offsetParent !== null &&
          !element.closest('body') === element && // Don't hide body
          !element.closest('[data-a-target="video-player"]') && // Don't hide video player
          !element.closest('.video-player') && // Don't hide video player
          !element.matches('html') && // Don't hide html
          !element.matches('body')) { // Don't hide body
        
        element.dataset.blocked = 'true';
        element.style.cssText = `
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        `;
        adsBlocked++;
      }
      break;
    }
  }
  
  // Also check for ad detection without hiding text elements
  if (!adDetected) {
    const allElements = document.querySelectorAll('*');
    for (const element of allElements) {
      const text = element.textContent || '';
      if (adTextIndicators.some(indicator => text.includes(indicator))) {
        console.log('Ad detected by text (not hiding element):', text.substring(0, 100));
        adDetected = true;
        break;
      }
    }
  }
  
  // If ad detected, focus on speeding through it (but only once)
  if (adDetected && !currentAdSpeedApplied) {
    // Try to find ALL video elements, not just the first one
    const videos = document.querySelectorAll('video');
    console.log(`Found ${videos.length} video elements on the page`);
    
    let targetVideo = null;
    
    // Find the video that's actually playing (not paused, has duration, etc.)
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      console.log(`Video ${i}: paused=${video.paused}, duration=${video.duration}, currentTime=${video.currentTime}, src=${video.src?.substring(0, 50)}...`);
      
      // Look for video that's actually playing content
      if (!video.paused && video.duration > 0 && video.currentTime > 0) {
        targetVideo = video;
        console.log(`Selected video ${i} as target (actively playing)`);
        break;
      }
    }
    
    // If no actively playing video found, use the first one with duration
    if (!targetVideo && videos.length > 0) {
      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        if (video.duration > 0) {
          targetVideo = video;
          console.log(`Selected video ${i} as fallback target (has duration)`);
          break;
        }
      }
    }
    
    // Final fallback to first video
    if (!targetVideo && videos.length > 0) {
      targetVideo = videos[0];
      console.log(`Using first video as last resort`);
    }
    
    if (targetVideo) {
      console.log('Ad detected - applying speed boost (first time only)');
      
      // Set flag to prevent multiple applications
      currentAdSpeedApplied = true;
      
      // Clear any existing monitoring interval
      if (adMonitorInterval) {
        clearInterval(adMonitorInterval);
      }
      
      // Store original video settings
      const originalMuted = targetVideo.muted;
      const originalVolume = targetVideo.volume;
      const originalRate = targetVideo.playbackRate || 1;
      
      // Mute and speed up the ad
      targetVideo.muted = true;
      targetVideo.volume = 0;
      
      // Apply aggressive speed for long ads
      const targetSpeed = 10; // 10x speed to handle 2-minute ads quickly
      
      // Debug video state before applying speed
      console.log(`Video state before speed: paused=${targetVideo.paused}, readyState=${targetVideo.readyState}, currentRate=${targetVideo.playbackRate}`);
      console.log(`Video element details:`, {
        tagName: targetVideo.tagName,
        src: targetVideo.src,
        currentSrc: targetVideo.currentSrc,
        duration: targetVideo.duration,
        currentTime: targetVideo.currentTime
      });
      
      // Try multiple approaches to speed up the video
      try {
        // Approach 1: Direct playback rate
        targetVideo.playbackRate = targetSpeed;
        console.log(`Approach 1: Set playbackRate to ${targetSpeed}`);
        
        // Approach 2: Use setAttribute as backup
        targetVideo.setAttribute('playbackRate', targetSpeed);
        console.log(`Approach 2: Set attribute playbackRate to ${targetSpeed}`);
        
        // Approach 3: Force via property descriptor
        Object.defineProperty(targetVideo, 'playbackRate', {
          value: targetSpeed,
          writable: true,
          configurable: true
        });
        console.log(`Approach 3: Defined property playbackRate as ${targetSpeed}`);
        
      } catch (error) {
        console.log('Error setting playback rate:', error);
      }
      
      // Ensure video is playing (ads might be paused)
      if (targetVideo.paused) {
        console.log('Video is paused, attempting to play...');
        try {
          targetVideo.play().catch(e => console.log('Could not auto-play:', e.message));
        } catch (e) {
          console.log('Play method error:', e);
        }
      }
      
      // Verify the speed was actually applied (multiple checks)
      setTimeout(() => {
        console.log(`Speed verification: requested=${targetSpeed}x, actual=${targetVideo.playbackRate}x, paused=${targetVideo.paused}`);
        console.log(`Video properties:`, {
          playbackRate: targetVideo.playbackRate,
          defaultPlaybackRate: targetVideo.defaultPlaybackRate,
          paused: targetVideo.paused,
          currentTime: targetVideo.currentTime
        });
        
        if (targetVideo.playbackRate !== targetSpeed) {
          console.log('Speed was not applied correctly, trying aggressive approach...');
          
          // Aggressive retry with event dispatch
          targetVideo.playbackRate = targetSpeed;
          targetVideo.defaultPlaybackRate = targetSpeed;
          
          // Dispatch rate change event
          try {
            targetVideo.dispatchEvent(new Event('ratechange'));
          } catch (e) {
            console.log('Could not dispatch ratechange event:', e);
          }
          
          // Try to play again if still paused
          if (targetVideo.paused) {
            try {
              targetVideo.play().catch(e => console.log('Second play attempt failed:', e.message));
            } catch (e) {
              console.log('Second play method error:', e);
            }
          }
        }
      }, 500); // Increased delay to 500ms
      
      console.log(`Muted ad and increased speed to ${targetSpeed}x for potentially long ad`);
      
      // Enhanced monitoring - check for ad completion and time remaining
      const adMonitorInterval = setInterval(() => {
        // Continuously enforce speed during ad (Twitch might reset it)
        if (targetVideo.playbackRate !== targetSpeed) {
          console.log(`Speed was reset by Twitch (${targetVideo.playbackRate}x), re-applying ${targetSpeed}x...`);
          targetVideo.playbackRate = targetSpeed;
          targetVideo.muted = true; // Re-ensure muted
        }
        
        // Check for ad time remaining patterns
        const adTimePatterns = [
          /Ad \((\d+):(\d+)\)/,  // "Ad (0:08)" format
          /(\d+):(\d+)\s*left/i, // "0:08 left" format
          /(\d+)\s*seconds?\s*left/i, // "8 seconds left" format
          /(\d+)\s*sec\s*left/i  // "8 sec left" format
        ];
        
        let timeRemaining = null;
        let adStillPlaying = false;
        
        // Check for time indicators in the page
        const pageText = document.body.textContent;
        for (const pattern of adTimePatterns) {
          const match = pageText.match(pattern);
          if (match) {
            adStillPlaying = true;
            if (match[1] && match[2]) {
              // Format: minutes:seconds
              timeRemaining = parseInt(match[1]) * 60 + parseInt(match[2]);
            } else if (match[1]) {
              // Format: seconds only
              timeRemaining = parseInt(match[1]);
            }
            console.log(`Ad time remaining: ${timeRemaining} seconds`);
            break;
          }
        }
        
        // Also check for general ad text indicators
        if (!adStillPlaying) {
          adStillPlaying = adTextIndicators.some(indicator => 
            pageText.includes(indicator)
          );
        }
        
        // If we detect the ad is almost over (3 seconds or less), prepare for restoration
        if (timeRemaining !== null && timeRemaining <= 3) {
          console.log(`Ad ending soon (${timeRemaining}s left), preparing to restore normal playback`);
          // Don't restore yet, just log - let the normal detection handle it
        }
        
        // Restore if no ad indicators found
        if (!adStillPlaying) {
          console.log('Ad appears to be over, restoring normal speed and audio');
          targetVideo.playbackRate = originalRate;
          targetVideo.muted = originalMuted;
          targetVideo.volume = originalVolume;
          clearInterval(adMonitorInterval);
          currentAdSpeedApplied = false; // Reset flag for next ad
        }
      }, 2000); // Check every 2 seconds for better time tracking
      
      // Fallback: restore everything after 3 minutes max (for very long ads)
      setTimeout(() => {
        console.log('Fallback: Restoring normal speed and audio after 3 minutes');
        targetVideo.playbackRate = originalRate;
        targetVideo.muted = originalMuted;
        targetVideo.volume = originalVolume;
        clearInterval(adMonitorInterval);
        currentAdSpeedApplied = false; // Reset flag for next ad
      }, 180000); // 3 minutes = 180 seconds
      
      // Method 3: Avoid manipulating video source as it breaks livestreams
      // Just log if we detect ad patterns in the source
      if (targetVideo.src && (targetVideo.src.includes('video-ad') || targetVideo.src.includes('ads'))) {
        console.log('Detected ad video source pattern, but not blocking to preserve livestream');
      }
    }
  }
  
  return adsBlocked;
}

// Show notification
function showNotification(message) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #9146ff;
    color: white;
    padding: 10px 15px;
    border-radius: 5px;
    font-size: 14px;
    z-index: 10000;
    pointer-events: none;
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
  chrome.runtime.sendMessage({ 
    action: 'updateBadge', 
    count: blockedAdsCount 
  });
  saveBlockedAdsCount();
}

// Save blocked ads count to storage
function saveBlockedAdsCount() {
  chrome.storage.local.set({ blockedAdsCount: blockedAdsCount });
}

// Load blocked ads count from storage
function loadBlockedAdsCount() {
  chrome.storage.local.get(['blockedAdsCount'], (result) => {
    blockedAdsCount = result.blockedAdsCount || 0;
    chrome.runtime.sendMessage({ 
      action: 'updateBadge', 
      count: blockedAdsCount 
    });
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
