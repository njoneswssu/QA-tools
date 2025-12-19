// Floating Crouton for CitiShop Merchant Testing
// This creates a minimizable floating control panel

let croutonContainer = null;
let croutonData = null;
let periodicSyncInterval = null; // Periodic status sync
let selectedAutocompleteIndex = -1; // Global autocomplete selection index



// Scan all links on the page for merchant names or domains
function scanLinksForMerchants(testingMerchants) {
  
  // Get all links on the page
  const links = document.querySelectorAll('a[href]');
  console.log(`🔍 Found ${links.length} links on page`);
  
  for (const link of links) {
    const href = link.href.toLowerCase();
    const linkText = link.textContent.toLowerCase().trim();
    
    // Skip empty links or very short text
    if (!href || linkText.length < 2) continue;
    
    // Check each merchant
    for (const merchant of testingMerchants) {
      const merchantName = merchant.name.toLowerCase();
      const merchantNameNormalized = merchantName.replace(/[^a-z0-9]/g, '');
      
      // Skip if merchant name is too short (avoid false positives)
      if (merchantNameNormalized.length < 3) {
        continue;
      }
      
      try {
        // Parse merchant URL to get the domain
        const merchantUrl = new URL(merchant.url);
        const merchantHostname = merchantUrl.hostname.toLowerCase();
        const merchantHostnameClean = merchantHostname.replace(/^www\./, '');
        
        // Parse the link URL
        let linkUrl;
        try {
          linkUrl = new URL(href);
        } catch (e) {
          // Invalid URL, skip this link
          continue;
        }
        
        // METHOD 1: Check if link directly points to merchant's domain
        const linkHostname = linkUrl.hostname.toLowerCase();
        const linkHostnameClean = linkHostname.replace(/^www\./, '');
        
        if (linkHostname === merchantHostname || linkHostnameClean === merchantHostnameClean) {
          console.log(`✅ Found direct link to ${merchant.name} domain: ${href}`);
          return merchant;
        }
        
        // METHOD 2: Check if merchant domain is in the link URL (for redirect links)
        // Only match if it's part of the hostname or a clear URL parameter
        if (href.includes(merchantHostnameClean) && 
            (href.includes(`//${merchantHostnameClean}`) || 
             href.includes(`.${merchantHostnameClean}`) ||
             href.includes(`=${merchantHostnameClean}`) ||
             href.includes(`%2F%2F${merchantHostnameClean}`))) { // URL encoded
          console.log(`✅ Found link containing ${merchant.name} domain: ${href}`);
          return merchant;
        }
        
        // METHOD 3: Check if merchant name appears in URL path as a complete segment
        // Only for longer merchant names to avoid false positives
        if (merchantNameNormalized.length >= 4) {
          const urlPath = linkUrl.pathname.toLowerCase();
          const urlSearch = linkUrl.search.toLowerCase();
          
          // Check if normalized name appears as a word boundary in path or query
          const pathSegments = urlPath.split(/[\/\-_]/);
          const queryParams = urlSearch.split(/[&=]/);
          
          for (const segment of [...pathSegments, ...queryParams]) {
            if (segment === merchantNameNormalized) {
              console.log(`✅ Found link with ${merchant.name} in URL path/query: ${href}`);
              return merchant;
            }
          }
        }
        
        // METHOD 4: Check if link text is exactly or nearly the merchant name
        // Be very strict here - require close match
        const linkTextNormalized = linkText.replace(/[^a-z0-9]/g, '');
        
        // Exact match after normalization
        if (linkTextNormalized === merchantNameNormalized) {
          console.log(`✅ Found link with exact merchant name in text: "${linkText}" -> ${href}`);
          return merchant;
        }
        
        // Check if the link text contains the merchant name as a complete word
        // Use word boundaries to avoid partial matches
        const merchantNameWords = merchantName.split(/\s+/);
        const linkTextWords = linkText.split(/\s+/);
        
        // For multi-word merchant names, check if all words appear in order
        if (merchantNameWords.length > 1) {
          let merchantWordIndex = 0;
          for (const word of linkTextWords) {
            if (word.includes(merchantNameWords[merchantWordIndex])) {
              merchantWordIndex++;
              if (merchantWordIndex === merchantNameWords.length) {
                console.log(`✅ Found link with merchant name words in text: "${linkText}" -> ${href}`);
                return merchant;
              }
            }
          }
        } else {
          // For single-word merchant names, require exact word match
          for (const word of linkTextWords) {
            if (word === merchantName || word === merchantNameNormalized) {
              console.log(`✅ Found link with merchant name as word in text: "${linkText}" -> ${href}`);
              return merchant;
            }
          }
        }
        
      } catch (error) {
        // Invalid merchant URL, skip
        console.log(`⚠️ Error parsing URL for ${merchant.name}:`, error);
        continue;
      }
    }
  }
  
  console.log('🔍 No merchant links found on page');
  return null;
}

// Check for active testing when page loads
async function checkForActiveTestingOnLoad() {
  try {
    console.log('🔍 Checking for active testing on page load...');
    console.log('🔍 Current URL:', window.location.href);
    
    // Skip common non-merchant domains to avoid unnecessary processing
    const currentHostname = window.location.hostname.toLowerCase();
    const skipDomains = [
      'docs.google.com', 'drive.google.com', 'gmail.com', 'google.com',
      'youtube.com', 'facebook.com', 'twitter.com', 'instagram.com',
      'linkedin.com', 'github.com', 'stackoverflow.com', 'reddit.com',
      'wikipedia.org', 'mozilla.org', 'chrome.google.com', 'extensions',
      'localhost', '127.0.0.1', 'about:', 'chrome:', 'moz-extension:', 'chrome-extension:'
    ];
    
    const shouldSkip = skipDomains.some(domain => 
      currentHostname.includes(domain) || window.location.href.startsWith(domain)
    );
    
    if (shouldSkip) {
      console.log('🔍 Skipping crouton check on non-merchant domain:', currentHostname);
      return;
    }
    
    // Clean up any leftover restore buttons first
    removeAnyRestoreButtons();
    
    // Check if chrome APIs are available
    if (!chrome || !chrome.storage) {
      console.log('🔍 Chrome APIs not available, skipping auto-check');
      return;
    }
    
    // Prevent duplicate crouton creation (but allow updates)
    if (croutonContainer && document.getElementById('citishop-floating-crouton')) {
      console.log('🔍 Crouton already exists, checking if update is needed...');
      // Don't return immediately - allow the function to continue to check if update is needed
    }
    
    // Wait a moment for page to stabilize
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if testing is active
    const result = await chrome.storage.local.get(['extensionState']);
    const state = result.extensionState;
    
    
    if (state && state.testingControlsActive && state.testingMerchants && state.testingMerchants.length > 0) {
      console.log('🔍 Testing is active, checking if current page matches a merchant...');
      
      // Check if the current URL matches any testing merchant
      const matchingMerchant = state.testingMerchants.find(merchant => {
        if (!merchant.url) return false;
        
        try {
          const merchantUrl = new URL(merchant.url);
          const currentUrl = new URL(window.location.href);
          
          // Only match by exact hostname (domain) - be more strict
          const hostnameMatch = merchantUrl.hostname === currentUrl.hostname;
          
          // Also check without www prefix
          const merchantHostnameClean = merchantUrl.hostname.replace(/^www\./, '');
          const currentHostnameClean = currentUrl.hostname.replace(/^www\./, '');
          const cleanHostnameMatch = merchantHostnameClean === currentHostnameClean;
          
          console.log(`🔍 Checking ${merchant.name}:`);
          console.log(`  Merchant URL: ${merchant.url}`);
          console.log(`  Current URL: ${window.location.href}`);
          console.log(`  Merchant hostname: ${merchantUrl.hostname} (clean: ${merchantHostnameClean})`);
          console.log(`  Current hostname: ${currentUrl.hostname} (clean: ${currentHostnameClean})`);
          console.log(`  Hostname match: ${hostnameMatch}`);
          console.log(`  Clean hostname match: ${cleanHostnameMatch}`);
          
          // Only return true for exact hostname matches (be very strict)
          const isMatch = hostnameMatch || cleanHostnameMatch;
          console.log(`  Final match result: ${isMatch}`);
          return isMatch;
        } catch (error) {
          console.error(`Error parsing URLs for ${merchant.name}:`, error);
          return false;
        }
      });
      
      if (matchingMerchant) {
        console.log(`✅ Current page matches merchant: ${matchingMerchant.name} - requesting crouton display`);
        
        // Double-check the match is valid by comparing URLs again
        const currentUrl = window.location.href;
        const merchantUrl = matchingMerchant.url;
        console.log(`🔍 Double-checking match: ${currentUrl} vs ${merchantUrl}`);
        
        try {
          const currentUrlObj = new URL(currentUrl);
          const merchantUrlObj = new URL(merchantUrl);
          const hostnamesMatch = currentUrlObj.hostname === merchantUrlObj.hostname || 
                                currentUrlObj.hostname.replace(/^www\./, '') === merchantUrlObj.hostname.replace(/^www\./, '');
          
          if (!hostnamesMatch) {
            console.log(`❌ Double-check failed: hostnames don't match (${currentUrlObj.hostname} vs ${merchantUrlObj.hostname})`);
            return;
          }
          console.log(`✅ Double-check passed: hostnames match`);
        } catch (error) {
          console.error('❌ Error in double-check:', error);
          return;
        }
        
        // Find merchant index
        const merchantIndex = state.testingMerchants.findIndex(m => m.name === matchingMerchant.name);
        const merchantKey = matchingMerchant.name.toLowerCase();
        
        // Use the stored currentMerchantIndex if this merchant matches it, otherwise use the found index
        let currentIndex = merchantIndex;
        if (state.currentMerchantIndex !== undefined && 
            state.currentMerchantIndex < state.testingMerchants.length &&
            state.testingMerchants[state.currentMerchantIndex].name === matchingMerchant.name) {
          currentIndex = state.currentMerchantIndex;
          console.log(`🔄 Using stored currentMerchantIndex: ${currentIndex} for ${matchingMerchant.name}`);
        } else {
          console.log(`🔄 Using found merchantIndex: ${currentIndex} for ${matchingMerchant.name}`);
        }
        
        const croutonData = {
          currentMerchant: matchingMerchant,
          currentIndex: currentIndex,
          totalMerchants: state.testingMerchants.length,
          testingMerchants: state.testingMerchants,
          status: `Testing ${matchingMerchant.name.replace(/\\+$/, "'s")}`,
          merchantStatus: state.merchantStatuses ? 
            state.merchantStatuses[merchantKey] || '' : ''
        };
        
        // Show crouton directly
        console.log('🔍 Showing crouton directly from content script...');
        await createFloatingCrouton(croutonData);
        
        // Check if crouton was actually created and is visible
        setTimeout(() => {
          const croutonElement = document.getElementById('citishop-floating-crouton');
          if (croutonElement) {
            console.log('✅ Crouton element found in DOM');
            console.log('🔍 Crouton visibility:', {
              display: window.getComputedStyle(croutonElement).display,
              visibility: window.getComputedStyle(croutonElement).visibility,
              opacity: window.getComputedStyle(croutonElement).opacity,
              position: window.getComputedStyle(croutonElement).position,
              zIndex: window.getComputedStyle(croutonElement).zIndex
            });
          } else {
            console.error('❌ Crouton element not found in DOM after creation attempt');
          }
        }, 1000);
        
        // Force expansion and progress update after creation with a delay to ensure DOM is ready
        setTimeout(() => {
          console.log('🔍 Auto-expanding crouton and updating progress...');
          const croutonElement = document.getElementById('citishop-floating-crouton');
          if (croutonElement) {
            const isExpanded = croutonElement.classList.contains('citishop-crouton-expanded');
            if (!isExpanded) {
              console.log('🔍 Crouton not expanded, forcing expansion...');
              croutonElement.classList.remove('citishop-crouton-minimized');
              croutonElement.classList.add('citishop-crouton-expanded');
              
              // Update toggle button state
              const toggleBtn = croutonElement.querySelector('#crouton-toggle-btn');
              if (toggleBtn) {
                toggleBtn.textContent = '−';
                toggleBtn.title = 'Minimize';
              }
              console.log('✅ Crouton force-expanded');
            } else {
              console.log('✅ Crouton already expanded');
            }
            
            // Force progress bar update with fresh state
            console.log('🔍 Forcing progress bar update...');
            updateProgressBar(croutonData);
            
          } else {
            console.log('❌ Crouton element not found for auto-expansion');
          }
        }, 500);
        
      } else {
        console.log('🔍 Current page does not match any testing merchants - crouton will not be shown');
        console.log('🔍 Current URL:', window.location.href);
        console.log('🔍 Available merchants:', state.testingMerchants.map(m => `${m.name}: ${m.url}`));
      }
    } else {
      console.log('🔍 Testing not active or no merchants configured');
    }
  } catch (error) {
    console.error('🔍 Error checking for active testing:', error);
  }
}

// Run check when page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkForActiveTestingOnLoad);
} else {
  // Page already loaded
  checkForActiveTestingOnLoad();
}

// Enhanced cleanup mechanism for extension refresh detection
let extensionHealthCheckInterval = null;
let extensionContextValid = true;

// Start monitoring extension health
function startExtensionHealthCheck() {
  if (extensionHealthCheckInterval) {
    clearInterval(extensionHealthCheckInterval);
  }
  
  extensionHealthCheckInterval = setInterval(() => {
    try {
      // Try to access extension API
      if (!chrome.runtime || !chrome.runtime.id) {
        console.log('🔄 Extension context lost - cleaning up crouton');
        cleanupCrouton();
        return;
      }
      
      // Try to send a ping message
      chrome.runtime.sendMessage({action: 'ping'}, (response) => {
        if (chrome.runtime.lastError) {
          console.log('🔄 Extension ping failed - cleaning up crouton');
          extensionContextValid = false;
          cleanupCrouton();
        } else {
          extensionContextValid = true;
        }
      });
    } catch (error) {
      console.log('🔄 Extension health check error - cleaning up crouton');
      extensionContextValid = false;
      cleanupCrouton();
    }
  }, 2000); // Check every 2 seconds
  
  console.log('🔄 Started extension health monitoring');
}

// Cleanup crouton when extension is disconnected/refreshed
try {
  chrome.runtime.onConnect.addListener((port) => {
    port.onDisconnect.addListener(() => {
      console.log('🔄 Extension port disconnected - cleaning up crouton');
      cleanupCrouton();
    });
  });
} catch (error) {
  console.log('⚠️ Could not set up onConnect listener:', error);
}

// Listen for extension disconnect
if (chrome.runtime) {
  try {
    const port = chrome.runtime.connect();
    port.onDisconnect.addListener(() => {
      console.log('🔄 Extension runtime disconnected - cleaning up crouton');
      cleanupCrouton();
    });
  } catch (error) {
    console.log('⚠️ Could not connect to extension runtime:', error);
  }
}

// Also cleanup on page unload
window.addEventListener('beforeunload', () => {
  console.log('🔄 Page unloading - cleaning up crouton');
  cleanupCrouton();
});

// Enhanced cleanup on page visibility change
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    // Immediate cleanup check
    setTimeout(() => {
      try {
        if (!chrome.runtime || !chrome.runtime.id) {
          console.log('🔄 Extension context invalid on visibility change - cleaning up crouton');
          cleanupCrouton();
        }
      } catch (error) {
        console.log('🔄 Extension context error on visibility change - cleaning up crouton');
        cleanupCrouton();
      }
    }, 100);
  }
});

// Start health monitoring when script loads
startExtensionHealthCheck();

// Update search layout immediately for existing elements
function updateSearchLayout() {
  if (!croutonContainer) {
    console.log('⚠️ No crouton container found for search layout update');
    return;
  }
  
  const searchContainer = croutonContainer.querySelector('.crouton-search-container');
  const searchBtn = croutonContainer.querySelector('.crouton-search-btn');
  
  if (searchContainer) {
    // Apply the new max-width directly to existing element
    searchContainer.style.setProperty('max-width', 'calc(100% - 35px)', 'important');
    console.log('🔍 Updated search container max-width to calc(100% - 35px)');
  }
  
  if (searchBtn) {
    // Apply the new button sizing directly to existing element
    searchBtn.style.setProperty('min-width', '28px', 'important');
    searchBtn.style.setProperty('max-width', '32px', 'important');
    searchBtn.style.setProperty('padding', '4px 6px', 'important');
    console.log('🔍 Updated search button to smaller size (28-32px)');
  }
  
  console.log('✅ Search layout updated immediately');
}

// Cleanup function for crouton
function cleanupCrouton() {
  console.log('🧹 Cleaning up crouton...');
  
  // Stop periodic sync
  if (periodicSyncInterval) {
    clearInterval(periodicSyncInterval);
    periodicSyncInterval = null;
    console.log('⏹️ Stopped periodic sync during cleanup');
  }
  
  // Stop extension health check
  if (extensionHealthCheckInterval) {
    clearInterval(extensionHealthCheckInterval);
    extensionHealthCheckInterval = null;
    console.log('⏹️ Stopped extension health monitoring during cleanup');
  }
  
  // Remove crouton container
  if (croutonContainer) {
    croutonContainer.remove();
    croutonContainer = null;
    console.log('🗑️ Removed crouton container');
  }
  
  // Remove portal container
  const portalContainer = document.getElementById('citishop-portal-container');
  if (portalContainer) {
    portalContainer.remove();
    console.log('🗑️ Removed portal container');
  }
  
  // Clear global variables
  croutonData = null;
  extensionContextValid = false;
  
  console.log('✅ Crouton cleanup completed');
}

// Run a few checks to ensure crouton shows up (less aggressive)
let periodicCheckCount = 0;
const periodicCheck = setInterval(() => {
  periodicCheckCount++;
  console.log(`🔄 Periodic check #${periodicCheckCount} for active testing...`);
  
  // Stop after 2 attempts (4 seconds) - reduced from 3
  if (periodicCheckCount >= 2) {
    console.log('🔄 Stopping periodic checks after 2 attempts');
    clearInterval(periodicCheck);
    return;
  }
  
  // If crouton is already visible, stop checking
  if (croutonContainer && croutonContainer.style.display !== 'none') {
    console.log('✅ Crouton already visible, stopping periodic checks');
    clearInterval(periodicCheck);
    return;
  }
  
  // Run the check
  checkForActiveTestingOnLoad();
}, 3000); // Check every 3 seconds (increased from 2)

// Also add a delayed check for slow-loading pages (reduced frequency)
setTimeout(() => {
  console.log('⏰ Running delayed check for slow-loading page...');
  checkForActiveTestingOnLoad();
}, 5000); // 5 second delay (increased from 3)

// Add navigation detection for browser back/forward buttons
window.addEventListener('popstate', (event) => {
  console.log('🔄 Browser navigation detected (back/forward button)');
  console.log('🔄 Current URL after navigation:', window.location.href);
  
  // Give the page a moment to stabilize after navigation, then check multiple times
  setTimeout(() => {
    console.log('🔄 First check for crouton after browser navigation...');
    checkForActiveTestingOnLoad();
  }, 500);
  
  // Additional checks to ensure reliability
  setTimeout(() => {
    console.log('🔄 Second check for crouton after browser navigation...');
    checkForActiveTestingOnLoad();
  }, 1500);
  
  setTimeout(() => {
    console.log('🔄 Final check for crouton after browser navigation...');
    checkForActiveTestingOnLoad();
  }, 3000);
});

// Also detect pushState/replaceState navigation (SPA navigation)
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function(...args) {
  originalPushState.apply(this, args);
  console.log('🔄 pushState navigation detected');
  setTimeout(() => {
    checkForActiveTestingOnLoad();
  }, 1000);
};

history.replaceState = function(...args) {
  originalReplaceState.apply(this, args);
  console.log('🔄 replaceState navigation detected');
  setTimeout(() => {
    checkForActiveTestingOnLoad();
  }, 1000);
};

// Add visibility change detection (when tab becomes active again)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    console.log('🔄 Page became visible - checking for crouton');
    setTimeout(() => {
      checkForActiveTestingOnLoad();
    }, 500);
  }
});

// Manual debug function to test crouton display
window.debugCroutonDisplay = async function() {
  console.log('🧪 Manual debug of crouton display...');
  console.log('🧪 Current URL:', window.location.href);
  console.log('🧪 Crouton container exists:', !!croutonContainer);
  console.log('🧪 Chrome APIs available:', !!chrome?.storage);
  
  if (chrome?.storage) {
    try {
      const result = await chrome.storage.local.get(['extensionState']);
      const state = result.extensionState;
      console.log('🧪 Extension state:', state);
      console.log('🧪 Testing active:', state?.testingControlsActive);
      console.log('🧪 Merchants count:', state?.testingMerchants?.length);
      console.log('🧪 Merchant statuses:', state?.merchantStatuses);
      
      if (state?.testingMerchants) {
        console.log('🧪 Available merchants:', state.testingMerchants.map(m => `${m.name}: ${m.url}`));
        
        // Look for merchants with similar names to current domain
        const currentDomain = window.location.hostname.replace(/^www\./, '').toLowerCase();
        console.log('🧪 Current domain (clean):', currentDomain);
        
        const similarMerchants = state.testingMerchants.filter(m => {
          if (!m.url) return false;
          try {
            const merchantDomain = new URL(m.url).hostname.replace(/^www\./, '').toLowerCase();
            return currentDomain.includes(merchantDomain) || merchantDomain.includes(currentDomain) || 
                   m.name.toLowerCase().includes(currentDomain.split('.')[0]) ||
                   currentDomain.includes(m.name.toLowerCase().replace(/[^a-z0-9]/g, ''));
          } catch (e) {
            return false;
          }
        });
        
        if (similarMerchants.length > 0) {
          console.log('🧪 Potentially matching merchants by name/domain:');
          similarMerchants.forEach(m => {
            try {
              const merchantDomain = new URL(m.url).hostname.replace(/^www\./, '');
              console.log(`  ${m.name}: ${m.url} (domain: ${merchantDomain})`);
            } catch (e) {
              console.log(`  ${m.name}: ${m.url} (invalid URL)`);
            }
          });
        }
      }
      
      // Try to trigger display
      await checkForActiveTestingOnLoad();
    } catch (error) {
      console.error('🧪 Error in manual debug:', error);
    }
  } else {
    console.log('🧪 Chrome APIs not available');
  }
};

console.log('🧪 Debug function available: debugCroutonDisplay()');

// Make script available globally for testing
window.citishopExtensionLoaded = true;
window.citishopVersion = '1.0.0';
console.log('✅ CitiShop extension content script loaded and available globally');

let isExpanded = true; // Start expanded
let searchOverride = false; // Flag to prevent external updates from overriding search
let isTransitioning = false; // Prevent rapid expand/collapse clicks

// Per-website collapse preferences
function getCurrentWebsiteKey() {
  try {
    // Create a unique key based on the current domain
    const url = new URL(window.location.href);
    const domain = url.hostname.replace(/^www\./, '').toLowerCase();
    return `crouton_collapsed_${domain}`;
  } catch (error) {
    console.error('Error creating website key:', error);
    return `crouton_collapsed_${window.location.hostname}`;
  }
}

// Check if crouton should be collapsed on this website
async function shouldStartCollapsed() {
  try {
    const websiteKey = getCurrentWebsiteKey();
    const result = await chrome.storage.local.get([websiteKey]);
    return result[websiteKey] === true;
  } catch (error) {
    console.error('Error checking collapse preference:', error);
    return false; // Default to expanded if there's an error
  }
}

// Save collapse preference for current website
async function saveCollapsePreference(isCollapsed) {
  try {
    const websiteKey = getCurrentWebsiteKey();
    await chrome.storage.local.set({ [websiteKey]: isCollapsed });
    console.log(`💾 Saved collapse preference for ${websiteKey}: ${isCollapsed}`);
  } catch (error) {
    console.error('Error saving collapse preference:', error);
  }
}

// Create the floating crouton
async function createFloatingCrouton(data) {
  // Remove any existing restore buttons first
  removeAnyRestoreButtons();
  
  // Check for existing crouton by ID as well as global variable
  const existingCrouton = document.getElementById('citishop-floating-crouton');
  if (croutonContainer || existingCrouton) {
    console.log('🔍 Crouton already exists - updating instead of creating new one');
    if (existingCrouton && !croutonContainer) {
      // Sync the global variable if it's out of sync
      croutonContainer = existingCrouton;
    }
    // Update existing crouton
    await updateCroutonData(data);
    return;
  }
  
  console.log('🔍 Creating new floating crouton');

  croutonData = { ...data };
  
  // Ensure we have the full testing merchants list for search
  if (!croutonData.testingMerchants && window.extensionTestingData) {
    croutonData.testingMerchants = window.extensionTestingData.testingMerchants;
  }
  
  // Create main container
  croutonContainer = document.createElement('div');
  croutonContainer.id = 'citishop-floating-crouton';
  croutonContainer.className = 'citishop-crouton-container';
  
  // Apply position setting
  await applyCroutonPosition();
  
  // Since crouton starts in expanded state by default, set expanded position
  // (This will be overridden later if shouldStartCollapsed is true)
  croutonContainer.style.setProperty('top', 'calc(50% - 200px)', 'important');
  console.log('🎯 Set initial position for expanded state (200px above center)');
  
  // Create minimized state (crouton)
  const minimizedView = document.createElement('div');
  minimizedView.className = 'citishop-crouton-minimized';
  minimizedView.innerHTML = `
    <div class="crouton-icon">🏪</div>
    <div class="crouton-text">${data.currentMerchant?.name || 'Testing'}</div>
    <div class="crouton-expand">⬆️</div>
  `;
  
  // Make minimized view draggable
  makeDraggable(minimizedView);
  minimizedView.setAttribute('data-draggable', 'true');
  console.log('🎯 Drag functionality attached to minimized view');
  
  // Create expanded state (full controls)
  const expandedView = document.createElement('div');
  expandedView.className = 'citishop-crouton-expanded';
  // Start expanded for testing - force hide minimized view
  expandedView.style.display = 'block';
  expandedView.style.visibility = 'visible';
  
  minimizedView.style.display = 'none !important';
  minimizedView.style.visibility = 'hidden';
  minimizedView.style.opacity = '0';
  
  console.log('🔍 Initial display states:');
  console.log('  - Expanded view display:', expandedView.style.display);
  console.log('  - Minimized view display:', minimizedView.style.display);
  console.log('  - Minimized view visibility:', minimizedView.style.visibility);
  
  expandedView.innerHTML = `
    <div class="crouton-header">
      <div class="crouton-title-section">
        <div class="crouton-title">🧪 Merchant Testing</div>
        <div class="crouton-subtitle">Neil QA</div>
      </div>
      <button class="crouton-minimize">⬇️</button>
    </div>
    
    <div class="crouton-content">
      <div class="crouton-merchant-info">
      <div class="crouton-merchant-name">${data.currentMerchant?.name ? data.currentMerchant.name.replace(/\\+$/, "'s") : 'Loading...'}</div>
      <div class="crouton-merchant-url">${data.currentMerchant?.url || ''}</div>
      <div class="crouton-progress">${data.currentIndex + 1} / ${data.totalMerchants}</div>
    </div>
    
    <div class="crouton-controls">
      <button class="crouton-btn crouton-btn-navigation" id="crouton-prev">← Previous</button>
      <button class="crouton-btn crouton-btn-navigation" id="crouton-next">Next →</button>
    </div>
    
    <div class="crouton-actions">
      <button class="crouton-btn crouton-btn-warning" id="crouton-flag">🚩 Flag</button>
      <button class="crouton-btn crouton-btn-success" id="crouton-success">✅ Successful</button>
    </div>
    
    <div class="crouton-search">
      <div class="crouton-search-container">
        <input type="text" id="crouton-search-input" placeholder="Search merchant..." class="crouton-search-input">
        <div id="crouton-search-autocomplete" class="crouton-autocomplete"></div>
      </div>
      <button id="crouton-search-btn" class="crouton-btn crouton-btn-primary">🔍</button>
    </div>
    
    <div class="crouton-copy-actions">
      <button id="crouton-copy-successful" class="crouton-btn crouton-btn-success">📋 Copy Successful</button>
      <button id="crouton-copy-flagged" class="crouton-btn crouton-btn-warning">📋 Copy Flagged</button>
    </div>
    
    <div class="crouton-status">${data.status || 'Ready to test'}</div>
    
    <div class="crouton-progress-bar">
      <div class="progress-bar-container">
        <div class="progress-bar-fill" id="crouton-progress-fill"></div>
        <div class="progress-bar-text" id="crouton-progress-text">0% Complete</div>
      </div>
      <div class="progress-stats">
        <span class="stat-item">
          <span class="stat-icon">✅</span>
          <span id="crouton-successful-count">0</span>
        </span>
        <span class="stat-item">
          <span class="stat-icon">🚩</span>
          <span id="crouton-flagged-count">0</span>
        </span>
        <span class="stat-item">
          <span class="stat-icon">📊</span>
          <span id="crouton-total-count">0</span>
        </span>
      </div>
    </div>
    </div>
  `;
  
  // Add both views to container
  croutonContainer.appendChild(minimizedView);
  croutonContainer.appendChild(expandedView);
  
  // Add to page
  // Create a portal container for maximum z-index isolation
  let portalContainer = document.getElementById('citishop-portal-container');
  if (!portalContainer) {
    portalContainer = document.createElement('div');
    portalContainer.id = 'citishop-portal-container';
    portalContainer.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      pointer-events: none !important;
      z-index: 2147483647 !important;
      isolation: isolate !important;
      transform: translateZ(0) !important;
    `;
    document.documentElement.appendChild(portalContainer);
  }
  
  // Append to portal container instead of body for maximum z-index
  portalContainer.appendChild(croutonContainer);
  console.log('🔍 Crouton added to portal container, expanded view display:', expandedView.style.display);
  console.log('🔍 Crouton container in DOM:', !!document.getElementById('citishop-floating-crouton'));
  
  
  // Update button states before setting up event listeners
  await updateCroutonButtons(data);
  
  // Initialize progress bar with current data
  console.log('🔄 Initializing progress bar for new crouton');
  updateProgressBar(data);
  
  // Add event listeners
  setupCroutonEventListeners();
  
  // Reset scroll position to top on initial load
  const croutonContent = croutonContainer.querySelector('.crouton-content');
  if (croutonContent) {
    croutonContent.scrollTop = 0;
    console.log('🔍 Reset crouton content scroll position to top on initial load');
  }
  
  // Ensure minimize button works on initial load
  setTimeout(() => {
    const minimizeBtn = croutonContainer.querySelector('.crouton-minimize');
    if (minimizeBtn) {
      console.log('🔍 Ensuring minimize button works on initial load');
      // Remove any existing listeners and re-add
      const newMinimizeBtn = minimizeBtn.cloneNode(true);
      minimizeBtn.parentNode.replaceChild(newMinimizeBtn, minimizeBtn);
      newMinimizeBtn.addEventListener('click', async () => {
        console.log('🔍 Minimize button clicked (fallback) - minimizing crouton');
        await minimizeCrouton();
      });
      console.log('🔍 Added fallback click listener to minimize button');
    } else {
      console.error('❌ Minimize button not found for fallback setup!');
    }
  }, 100);
  
  // Add click-to-close functionality for initial expanded state
  const initialExpandedView = croutonContainer.querySelector('.citishop-crouton-expanded');
  if (initialExpandedView && !initialExpandedView.hasAttribute('data-click-to-close')) {
    initialExpandedView.addEventListener('click', async (e) => {
      // Don't close if clicking on buttons or interactive elements
      if (e.target.tagName === 'BUTTON' || 
          e.target.closest('button') || 
          e.target.closest('input') ||
          e.target.closest('.crouton-minimize')) {
        console.log('🚫 Click-to-close blocked: clicked on interactive element');
        return;
      }
      
      console.log('🎯 Click-to-close triggered - minimizing crouton');
      await minimizeCrouton();
    });
    
    initialExpandedView.setAttribute('data-click-to-close', 'true');
    console.log('🎯 Added initial click-to-close functionality to expanded crouton');
  }
  
  // Apply styles
  injectCroutonStyles();
  
  // Update search layout immediately for new crouton
  updateSearchLayout();
  
  // Start periodic status sync to keep status updated
  startPeriodicSync();
  
  // Check if this website prefers collapsed crouton
  const shouldCollapse = await shouldStartCollapsed();
  if (shouldCollapse) {
    console.log('💾 Website preference: start collapsed');
    // Start collapsed based on user preference for this website
    await minimizeCrouton();
  }
  
  // Final progress bar update after everything is set up
  setTimeout(() => {
    console.log('🔄 Final progress bar update after crouton creation complete');
    updateProgressBar(data);
    
    // Also ensure search layout is applied
    updateSearchLayout();
  }, 200);
  
  console.log('✅ Floating crouton created');
}

// Global autocomplete functions (defined once at module level)
function showCroutonAutocomplete(searchTerm) {
  console.log('🔍 showCroutonAutocomplete called with term:', searchTerm);
  console.log('🔍 croutonContainer exists:', !!croutonContainer);
  console.log('🔍 croutonData exists:', !!croutonData);
  console.log('🔍 testingMerchants count:', croutonData?.testingMerchants?.length || 0);
  
  // Always get fresh reference to autocomplete element
  const searchAutocomplete = croutonContainer.querySelector('#crouton-search-autocomplete');
  const searchContainer = croutonContainer.querySelector('.crouton-search-container');
  console.log('🔍 Autocomplete element found:', !!searchAutocomplete);
  console.log('🔍 Search container found:', !!searchContainer);
  
  // Debug search container positioning
  if (searchContainer) {
    console.log('🔍 Search container styles:', {
      position: searchContainer.style.position,
      positionComputed: getComputedStyle(searchContainer).position
    });
    console.log('🔍 Search container getBoundingClientRect():', searchContainer.getBoundingClientRect());
  }
  
  if (!croutonData?.testingMerchants || croutonData.testingMerchants.length === 0) {
    console.log('🔍 No testing merchants available, count:', croutonData?.testingMerchants?.length);
    hideCroutonAutocomplete();
    return;
  }
  
  if (!searchTerm || searchTerm.length < 1) {
    console.log('🔍 Search term too short or empty');
    hideCroutonAutocomplete();
    return;
  }
  
  if (!searchAutocomplete) {
    console.log('⚠️ Autocomplete element not found');
    return;
  }
  
  // Find matching merchants
  const matches = croutonData.testingMerchants.filter(merchant => {
    const name = merchant.name.toLowerCase();
    const url = merchant.url.toLowerCase();
    return name.includes(searchTerm.toLowerCase()) || url.includes(searchTerm.toLowerCase());
  });
  
  console.log(`🔍 Found ${matches.length} matches for: ${searchTerm}`);
  
  if (matches.length === 0) {
    hideCroutonAutocomplete();
    return;
  }
  
  // Clear existing items
  searchAutocomplete.innerHTML = '';
  
  // Add matches (limit to 5)
  matches.slice(0, 5).forEach((match, index) => {
    const item = document.createElement('div');
    item.className = 'crouton-autocomplete-item';
    item.style.cssText = `
      padding: 8px 12px;
      cursor: pointer;
      border-bottom: 1px solid #eee;
      font-size: 12px;
      background: white;
    `;
    
    // Highlight matching text
    const displayText = match.name.replace(
      new RegExp(`(${searchTerm})`, 'gi'),
      '<strong>$1</strong>'
    );
    
    item.innerHTML = displayText;
    
    // Click handler - use direct approach like popup
    item.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      console.log('🎯 Crouton autocomplete item clicked:', match.merchant.name);
      
      // Add visual feedback for the click
      item.style.background = '#007bff';
      item.style.color = 'white';
      
      // Set search input immediately
      const searchInput = croutonContainer.querySelector('.crouton-search-input');
      searchInput.value = match.name;
      console.log('🎯 Set crouton search input to:', searchInput.value);
      
      // Hide autocomplete immediately
      hideCroutonAutocomplete();
      
      // Navigate to the merchant directly
      setTimeout(async () => {
        console.log('🎯 Navigating to merchant from crouton autocomplete');
        
        // Send search action to update extension state and navigate (background script handles navigation)
        await sendMessageToExtension('searchMerchant', { targetIndex: match.index });
        
        console.log(`🔄 Sent searchMerchant action to background script for: ${match.name}`);
        // Removed crouton feedback notification
      }, 100);
    });
    
    // Hover effects
    item.addEventListener('mouseenter', () => {
      item.style.background = '#f0f0f0';
    });
    
    item.addEventListener('mouseleave', () => {
      item.style.background = 'white';
    });
    
    searchAutocomplete.appendChild(item);
  });
  
  // Show autocomplete with forced visibility
  searchAutocomplete.style.setProperty('display', 'block', 'important');
  searchAutocomplete.style.setProperty('visibility', 'visible', 'important');
  searchAutocomplete.style.setProperty('opacity', '1', 'important');
  searchAutocomplete.style.setProperty('z-index', '999999', 'important');
  selectedAutocompleteIndex = -1;
  console.log('✅ Crouton autocomplete displayed with', matches.length, 'items');
  
  // Debug: Check if autocomplete is actually visible
  console.log('🔍 Autocomplete visibility check:');
  console.log('🔍 searchAutocomplete.style.display:', searchAutocomplete.style.display);
  console.log('🔍 searchAutocomplete.offsetHeight:', searchAutocomplete.offsetHeight);
  console.log('🔍 searchAutocomplete.offsetWidth:', searchAutocomplete.offsetWidth);
  console.log('🔍 searchAutocomplete.getBoundingClientRect():', searchAutocomplete.getBoundingClientRect());
  
  // Check computed styles
  const computedStyle = getComputedStyle(searchAutocomplete);
  console.log('🔍 Computed styles:', {
    display: computedStyle.display,
    visibility: computedStyle.visibility,
    opacity: computedStyle.opacity,
    position: computedStyle.position,
    top: computedStyle.top,
    left: computedStyle.left,
    right: computedStyle.right,
    zIndex: computedStyle.zIndex,
    transform: computedStyle.transform
  });
  
  // Check if autocomplete is actually in the viewport
  const rect = searchAutocomplete.getBoundingClientRect();
  console.log('🔍 Viewport check:', {
    top: rect.top,
    left: rect.left,
    bottom: rect.bottom,
    right: rect.right,
    width: rect.width,
    height: rect.height,
    inViewport: rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth
  });
  
  // Force visibility with important styles
  searchAutocomplete.style.setProperty('display', 'block', 'important');
  searchAutocomplete.style.setProperty('visibility', 'visible', 'important');
  searchAutocomplete.style.setProperty('opacity', '1', 'important');
  searchAutocomplete.style.setProperty('z-index', '999999', 'important');
  
  // Add bright background to make it more visible for debugging
  searchAutocomplete.style.setProperty('background', '#ffff00', 'important');
  searchAutocomplete.style.setProperty('border', '3px solid #ff0000', 'important');
  searchAutocomplete.style.setProperty('min-height', '50px', 'important');
  console.log('🔍 Applied bright debugging colors');
  
  // Try alternative positioning - position relative to viewport instead of container
  const searchInput = croutonContainer.querySelector('.crouton-search-input');
  if (searchInput) {
    const inputRect = searchInput.getBoundingClientRect();
    console.log('🔍 Search input position:', inputRect);
    
    // Position autocomplete below the search input
    searchAutocomplete.style.setProperty('position', 'fixed', 'important');
    searchAutocomplete.style.setProperty('top', `${inputRect.bottom}px`, 'important');
    searchAutocomplete.style.setProperty('left', `${inputRect.left}px`, 'important');
    searchAutocomplete.style.setProperty('width', `${inputRect.width}px`, 'important');
    searchAutocomplete.style.setProperty('right', 'auto', 'important');
    console.log('🔍 Set fixed positioning relative to search input');
  }
  
  // Ensure search container has proper positioning for absolute autocomplete
  if (searchContainer) {
    searchContainer.style.setProperty('position', 'relative', 'important');
    console.log('🔍 Set search container position to relative');
  }
  
  console.log('🔍 Applied forced visibility styles');
}

function hideCroutonAutocomplete() {
  // Always get fresh reference to autocomplete element
  const searchAutocomplete = croutonContainer.querySelector('#crouton-search-autocomplete');
  
  if (searchAutocomplete) {
    searchAutocomplete.style.display = 'none';
    searchAutocomplete.innerHTML = '';
    selectedAutocompleteIndex = -1;
    console.log('✅ Crouton autocomplete hidden');
  }
}

function selectCroutonAutocompleteItem(merchantName, merchantIndex) {
  console.log('🎯 selectCroutonAutocompleteItem called with:', merchantName, 'index:', merchantIndex);
  
  // Fill the search input
  const searchInput = croutonContainer.querySelector('.crouton-search-input');
  searchInput.value = merchantName;
  
  // Hide autocomplete
  hideCroutonAutocomplete();
  
  // Navigate to the merchant
  console.log(`🔄 Sending searchMerchant action with targetIndex: ${merchantIndex}`);
  sendMessageToExtension('searchMerchant', { targetIndex: merchantIndex });
  // Removed crouton feedback notification
}

function handleCroutonAutocompleteKeydown(e) {
  // Always get fresh reference to autocomplete element
  const searchAutocomplete = croutonContainer.querySelector('#crouton-search-autocomplete');
  
  if (!searchAutocomplete) {
    console.log('⚠️ Autocomplete element not found in keydown handler');
    return;
  }
  
  const items = searchAutocomplete.querySelectorAll('.crouton-autocomplete-item');
  
  if (items.length === 0) {
    return;
  }
  
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      // If no item selected (-1), start at 0. Otherwise, move to next item or wrap to 0
      if (selectedAutocompleteIndex < 0) {
        selectedAutocompleteIndex = 0;
      } else {
        selectedAutocompleteIndex = (selectedAutocompleteIndex + 1) % items.length;
      }
      console.log(`🔽 ArrowDown: selectedIndex = ${selectedAutocompleteIndex} of ${items.length}`);
      updateAutocompleteSelection();
      break;
      
    case 'ArrowUp':
      e.preventDefault();
      // If no item selected (-1), start at last item. Otherwise, move to previous item or wrap to last
      if (selectedAutocompleteIndex < 0) {
        selectedAutocompleteIndex = items.length - 1;
      } else if (selectedAutocompleteIndex === 0) {
        selectedAutocompleteIndex = items.length - 1;
      } else {
        selectedAutocompleteIndex = selectedAutocompleteIndex - 1;
      }
      console.log(`🔼 ArrowUp: selectedIndex = ${selectedAutocompleteIndex} of ${items.length}`);
      updateAutocompleteSelection();
      break;
      
    case 'Enter':
      e.preventDefault();
      if (selectedAutocompleteIndex >= 0 && selectedAutocompleteIndex < items.length) {
        const targetItem = items[selectedAutocompleteIndex];
        const merchantName = targetItem.textContent.replace(/<[^>]*>/g, '').trim();
        const merchantIndex = croutonData.testingMerchants.findIndex(m => m.name === merchantName);
        
        if (targetItem && merchantName && merchantIndex >= 0) {
          console.log('🎯 Crouton autocomplete keyboard selection:', merchantName);
          
          // Set search input immediately
          const searchInput = croutonContainer.querySelector('.crouton-search-input');
          searchInput.value = merchantName;
          console.log('🎯 Set crouton search input to:', searchInput.value);
          
          // Hide autocomplete immediately
          hideCroutonAutocomplete();
          
          // Navigate to the merchant directly
          setTimeout(async () => {
            console.log('🎯 Navigating to merchant from crouton keyboard selection');
            
            // Send search action to update extension state and navigate (background script handles navigation)
            await sendMessageToExtension('searchMerchant', { targetIndex: merchantIndex });
            
            console.log(`🔄 Sent searchMerchant action to background script for: ${merchantName}`);
            // Removed crouton feedback notification
          }, 100);
        }
      }
      break;
        
    case 'Escape':
      hideCroutonAutocomplete();
      break;
  }
}

function updateAutocompleteSelection() {
  const searchAutocomplete = croutonContainer.querySelector('#crouton-search-autocomplete');
  if (!searchAutocomplete) return;
  
  const items = searchAutocomplete.querySelectorAll('.crouton-autocomplete-item');
  
  items.forEach((item, index) => {
    if (index === selectedAutocompleteIndex && selectedAutocompleteIndex >= 0) {
      item.style.background = '#007bff';
      item.style.color = 'white';
      console.log(`✅ Selected item ${index}: ${item.textContent.trim()}`);
    } else {
      item.style.background = 'white';
      item.style.color = 'black';
    }
  });
}

// Remove existing event listeners to prevent duplicates
function removeCroutonEventListeners() {
  console.log('🔍 Removing existing crouton event listeners...');
  
  // Remove all event listeners by cloning the elements
  const searchInput = croutonContainer.querySelector('.crouton-search-input');
  const searchBtn = croutonContainer.querySelector('#crouton-search-btn');
  
  if (searchInput) {
    const newSearchInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newSearchInput, searchInput);
  }
  
  if (searchBtn) {
    const newSearchBtn = searchBtn.cloneNode(true);
    searchBtn.parentNode.replaceChild(newSearchBtn, searchBtn);
  }
  
  console.log('✅ Existing event listeners removed');
}

// Setup event listeners for crouton interactions
function setupCroutonEventListeners() {
  console.log('🔍 Setting up crouton event listeners...');
  
  // Remove existing listeners first to prevent duplicates
  removeCroutonEventListeners();
  
  const minimizedView = croutonContainer.querySelector('.citishop-crouton-minimized');
  const minimizeBtn = croutonContainer.querySelector('.crouton-minimize');
  
  console.log('🔍 Setting up minimize/expand listeners:');
  console.log('🔍 minimizedView found:', !!minimizedView);
  console.log('🔍 minimizeBtn found:', !!minimizeBtn);
  
  // Toggle expand/minimize
  if (minimizedView) {
  minimizedView.addEventListener('click', async () => {
      console.log('🔍 Minimized view clicked - expanding crouton');
    await expandCrouton();
  });
    console.log('🔍 Added click listener to minimized view');
  } else {
    console.error('❌ Minimized view not found!');
  }
  
  if (minimizeBtn) {
  minimizeBtn.addEventListener('click', async () => {
      console.log('🔍 Minimize button clicked - minimizing crouton');
    await minimizeCrouton();
  });
    console.log('🔍 Added click listener to minimize button');
  } else {
    console.error('❌ Minimize button not found!');
  }
  
  // Navigation controls
  const prevBtn = croutonContainer.querySelector('#crouton-prev');
  const nextBtn = croutonContainer.querySelector('#crouton-next');
  const flagBtn = croutonContainer.querySelector('#crouton-flag');
  const successBtn = croutonContainer.querySelector('#crouton-success');
  const searchInput = croutonContainer.querySelector('.crouton-search-input');
  const searchBtn = croutonContainer.querySelector('#crouton-search-btn');
  const searchAutocomplete = croutonContainer.querySelector('#crouton-search-autocomplete');
  
  console.log('🔍 Crouton element check:');
  console.log('🔍 searchInput:', searchInput);
  console.log('🔍 searchBtn:', searchBtn);
  console.log('🔍 searchAutocomplete:', searchAutocomplete);
  const copySuccessfulBtn = croutonContainer.querySelector('#crouton-copy-successful');
  const copyFlaggedBtn = croutonContainer.querySelector('#crouton-copy-flagged');
  
  // Autocomplete state (using global variable)
  
  // Add event listeners with better debugging
  const buttons = [
    { element: prevBtn, action: 'previousMerchant', name: 'Previous' },
    { element: nextBtn, action: 'nextMerchant', name: 'Next' },
    { element: flagBtn, action: 'flagMerchant', name: 'Flag' },
    { element: successBtn, action: 'successMerchant', name: 'Mark Successful' }
  ];
  
  buttons.forEach(({ element, action, name }) => {
    if (element) {
      // Multiple event types for better compatibility
      ['click', 'touchstart'].forEach(eventType => {
        element.addEventListener(eventType, async (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          console.log(`🏪 ${name} button ${eventType} - sending action: ${action}`);
          console.log(`🔄 FLOW START: Button clicked - action: ${action}`);
          console.log(`🔄 FLOW START: Element id:`, element.id);
          console.log(`🔄 FLOW START: Element text:`, element.textContent);
          console.log(`🔄 FLOW START: All attributes:`, Array.from(element.attributes).map(attr => `${attr.name}="${attr.value}"`));
          
          // Check if merchant is already flagged or successful based on data attributes
          if (action === 'flagMerchant' || action === 'successMerchant') {
            console.log(`🔍 Checking ${action} button state:`);
            console.log(`🔍 Element:`, element);
            console.log(`🔍 Element attributes:`, Array.from(element.attributes).map(attr => `${attr.name}="${attr.value}"`));
            console.log(`🔍 Has data-already-flagged:`, element.hasAttribute('data-already-flagged'));
            console.log(`🔍 Has data-already-successful:`, element.hasAttribute('data-already-successful'));
            
            // Check for already flagged by data attribute
            if (action === 'flagMerchant' && element.hasAttribute('data-already-flagged')) {
              console.log('⚠️ Flag button already flagged - no action needed');
              return;
            }
            
            // Check for already successful by data attribute
            if (action === 'successMerchant' && element.hasAttribute('data-already-successful')) {
              console.log('⚠️ Success button already successful - no action needed');
              return;
            }
          }
          
          console.log(`🔄 FLOW CONTINUE: Passed early return checks - proceeding to action processing`);
          
          // Remove immediate visual feedback for button press
          
          // Enhanced visual feedback for successful action (ONLY on first click)
          if (action === 'successMerchant' || action === 'flagMerchant') {
            console.log('🎨 Checking success/flag action feedback conditions...');
            console.log('🎨 Action:', action);
            console.log('🎨 Has data-already-successful:', element.hasAttribute('data-already-successful'));
            console.log('🎨 Has data-already-flagged:', element.hasAttribute('data-already-flagged'));
            console.log('🎨 Will show Marked feedback:', 
              (action === 'successMerchant' && !element.hasAttribute('data-already-successful')) ||
              (action === 'flagMerchant' && !element.hasAttribute('data-already-flagged'))
            );
          }
          
          // Remove first-time success animation - no visual feedback needed
          
          // Enhanced visual feedback for flag action (ONLY on first click)
          console.log('🎨 Checking flag action feedback conditions...');
          console.log('🎨 Action:', action);
          console.log('🎨 Has data-already-flagged:', element.hasAttribute('data-already-flagged'));
          console.log('🎨 Will show Marked feedback:', action === 'flagMerchant' && !element.hasAttribute('data-already-flagged'));
          
          // Remove first-time flag animation - no visual feedback needed
          
          console.log(`🔄 FLOW: About to send message to extension - action: ${action}`);
          console.log(`🔄 FLOW: Current merchant:`, croutonData.currentMerchant?.name);
          console.log(`🔄 FLOW: Current index:`, croutonData.currentIndex);
          
          // For success and flag actions, include the specific merchant info
          const actionData = (action === 'successMerchant' || action === 'flagMerchant') ? {
            merchantName: croutonData.currentMerchant?.name,
            merchantUrl: croutonData.currentMerchant?.url,
            merchantIndex: croutonData.currentIndex
          } : {};
          
          await sendMessageToExtension(action, actionData);
          console.log(`🔄 FLOW: Message sent to extension successfully`);
          
          // For flag and success actions, update button states immediately and refresh progress
          if (action === 'flagMerchant' || action === 'successMerchant') {
            console.log(`🔄 Immediately updating button states for ${action}`);
            
            // Immediately update the button state based on the action
            if (action === 'flagMerchant') {
              // Update flag button
              element.style.background = '#e74c3c';
              element.style.color = 'white';
              element.style.boxShadow = '0 0 10px rgba(231, 76, 60, 0.4)';
              element.style.border = '2px solid #c0392b';
              element.textContent = '🚩 Marked Flagged';
              element.title = 'This merchant is flagged';
              element.setAttribute('data-already-flagged', 'true');
              console.log(`🔄 Flag button immediately updated to "Marked Flagged"`);
              
              // Reset success button to default state (mutual exclusion)
              const successBtn = croutonContainer.querySelector('#crouton-success');
              if (successBtn) {
                successBtn.style.background = '';
                successBtn.style.color = '';
                successBtn.style.boxShadow = '';
                successBtn.style.border = '';
                successBtn.textContent = '✅ Successful';
                successBtn.title = 'Mark this merchant as successful';
                successBtn.removeAttribute('data-already-successful');
                console.log(`🔄 Success button reset to default state (mutual exclusion)`);
              }
              
              // Immediately update progress bar locally without waiting for storage
              console.log('🔄 Immediate local progress update for flag action');
              await updateProgressBarLocally('flagged');
              
              // Wait for popup to process the action before refreshing progress from storage
              setTimeout(() => {
                console.log('🔄 Progress refresh after flag action (waiting for popup processing)');
                forceRefreshProgress();
              }, 100); // Increased delay to allow popup processing
            } else if (action === 'successMerchant') {
              // Update success button
              element.style.background = '#27ae60';
              element.style.color = 'white';
              element.style.boxShadow = '0 0 10px rgba(39, 174, 96, 0.4)';
              element.style.border = '2px solid #229954';
              element.textContent = '✅ Marked Successful';
              element.title = 'This merchant is successful';
              element.setAttribute('data-already-successful', 'true');
              console.log(`🔄 Success button immediately updated to "Marked Successful"`);
              
              // Reset flag button to default state (mutual exclusion)
              const flagBtn = croutonContainer.querySelector('#crouton-flag');
              if (flagBtn) {
                flagBtn.style.background = '';
                flagBtn.style.color = '';
                flagBtn.style.boxShadow = '';
                flagBtn.style.border = '';
                flagBtn.textContent = '🚩 Flag';
                flagBtn.title = 'Flag this merchant';
                flagBtn.removeAttribute('data-already-flagged');
                console.log(`🔄 Flag button reset to default state (mutual exclusion)`);
              }
              
              // Immediately update progress bar locally without waiting for storage
              console.log('🔄 Immediate local progress update for success action');
              await updateProgressBarLocally('successful');
              
              // Wait for popup to process the action before refreshing progress from storage
              setTimeout(() => {
                console.log('🔄 Progress refresh after success action (waiting for popup processing)');
                forceRefreshProgress();
              }, 100); // Increased delay to allow popup processing
            }
            
            // Also schedule progress refresh after a delay for full state sync
            setTimeout(() => {
              console.log('🔄 Scheduling progress refresh after successful/flag action');
              forceRefreshProgress();
              
              // Also force a status sync to ensure progress bar gets updated data
              scheduleStatusSync();
            }, 500); // Wait for background script to update storage
            
            // Also trigger an immediate progress refresh for instant feedback
            setTimeout(() => {
              console.log('🔄 Immediate progress refresh after successful/flag action');
              forceRefreshProgress();
            }, 50); // Even quicker refresh for immediate visual feedback
          }
        }, { passive: false });
      });
      
      console.log(`✅ ${name} button listeners added`);
    } else {
      console.error(`❌ ${name} button not found`);
    }
  });
  
  // Autocomplete helper functions (moved outside to be globally accessible)
  window.showCroutonAutocomplete = function(searchTerm) {
    console.log('🔍 showCroutonAutocomplete called with term:', searchTerm);
    console.log('🔍 croutonContainer exists:', !!croutonContainer);
    console.log('🔍 croutonData exists:', !!croutonData);
    console.log('🔍 testingMerchants count:', croutonData?.testingMerchants?.length || 0);
    console.log('🔍 Global function available:', typeof window.showCroutonAutocomplete);
    
    // Always get fresh reference to autocomplete element
    const searchAutocomplete = croutonContainer.querySelector('#crouton-search-autocomplete');
    console.log('🔍 Autocomplete element found:', !!searchAutocomplete);
    
    if (!croutonData?.testingMerchants || croutonData.testingMerchants.length === 0) {
      console.log('🔍 No testing merchants available, count:', croutonData?.testingMerchants?.length);
      hideCroutonAutocomplete();
      return;
    }
    
    if (!searchTerm || searchTerm.length < 1) {
      console.log('🔍 Search term too short or empty');
      hideCroutonAutocomplete();
      return;
    }
    
    if (!searchAutocomplete) {
      console.log('⚠️ Autocomplete element not found');
      return;
    }
    
    console.log('🔍 Processing', croutonData.testingMerchants.length, 'merchants for autocomplete');
    
    // Find matching merchants with improved search
    const scoredMatches = croutonData.testingMerchants.map((merchant, index) => {
      let score = 0;
      const name = merchant.name.toLowerCase();
      const term = searchTerm.toLowerCase();
      let domain = '';
      
      // Extract domain from URL
      try {
        if (merchant.url) {
          const url = new URL(merchant.url);
          domain = url.hostname.replace(/^www\./, '').toLowerCase();
        }
      } catch (e) {
        // Invalid URL, skip domain matching
      }
      
      // Scoring for autocomplete (similar to main search but lighter)
      if (domain && (term.includes(domain) || domain.includes(term))) {
        if (term.includes('.')) {
          const searchDomain = term.replace(/^www\./, '').replace(/^https?:\/\//, '').split('/')[0];
          if (searchDomain === domain) score += 1000;
          else if (searchDomain.includes(domain) || domain.includes(searchDomain)) score += 800;
        } else {
          score += 600;
        }
      }
      
      if (name === term) score += 500;
      if (name.startsWith(term)) score += 300;
      if (name.includes(term)) score += 100;
      if (term.includes(name) && name.length >= 4 && name.length >= term.length * 0.4) score += 50;
      
      return { merchant, index, score };
    });
    
    const matches = scoredMatches
      .filter(match => match.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5); // Limit to 5 suggestions
    
    console.log('🔍 Found', matches.length, 'matching merchants:', matches.map(m => m.merchant.name));
    
    if (matches.length === 0) {
      console.log('🔍 No matches found, hiding autocomplete');
      hideCroutonAutocomplete();
      return;
    }
    
    // Build autocomplete HTML
    searchAutocomplete.innerHTML = '';
    matches.forEach((match, index) => {
      const item = document.createElement('div');
      item.className = 'crouton-autocomplete-item';
      item.dataset.index = index;
      item.dataset.merchantIndex = match.index;
      
      // Clean merchant name for display (convert trailing backslashes to apostrophes)
      const cleanMerchantName = match.merchant.name.replace(/\\+$/, "'s");
      // Highlight matching part
      const highlightedName = highlightCroutonSearchTerm(cleanMerchantName, searchTerm);
      
      // Add domain info for better context
      let displayText = highlightedName;
      try {
        if (match.merchant.url) {
          const domain = new URL(match.merchant.url).hostname.replace(/^www\./, '');
          displayText += ` <span class="autocomplete-domain">(${domain})</span>`;
        }
      } catch (e) {
        // Invalid URL, just show name
      }
      
      item.innerHTML = displayText;
      
      // Click handler - use direct approach like popup
      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('🎯 Crouton autocomplete item clicked:', match.merchant.name);
        
        // Add visual feedback for the click
        item.style.background = '#007bff';
        item.style.color = 'white';
        
        // Set search input immediately (use clean name for display)
        const cleanMerchantName = match.merchant.name.replace(/\\+$/, "'s");
        searchInput.value = cleanMerchantName;
        console.log('🎯 Set crouton search input to:', searchInput.value);
        
        // Hide autocomplete immediately
        window.hideCroutonAutocomplete();
        
        // Navigate to the merchant directly
        setTimeout(async () => {
          console.log('🎯 Navigating to merchant from crouton autocomplete');
          
          // Send search action to update extension state and navigate (background script handles navigation)
          await sendMessageToExtension('searchMerchant', { targetIndex: match.index });
          
          console.log(`🔄 Sent searchMerchant action to background script for: ${match.merchant.name}`);
          // Removed crouton feedback notification
        }, 100);
      });
      
      searchAutocomplete.appendChild(item);
    });
    
    searchAutocomplete.style.setProperty('display', 'block', 'important');
    searchAutocomplete.style.setProperty('visibility', 'visible', 'important');
    searchAutocomplete.style.setProperty('opacity', '1', 'important');
    searchAutocomplete.style.setProperty('z-index', '999999', 'important');
    selectedAutocompleteIndex = -1;
    console.log('✅ Crouton autocomplete displayed with', matches.length, 'items');
  }
  
  window.hideCroutonAutocomplete = function() {
    // Always get fresh reference to autocomplete element
    const searchAutocomplete = croutonContainer.querySelector('#crouton-search-autocomplete');
    
    if (searchAutocomplete) {
      searchAutocomplete.style.display = 'none';
      selectedAutocompleteIndex = -1;
    }
  }
  
  function highlightCroutonSearchTerm(text, searchTerm) {
    const regex = new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi');
    return text.replace(regex, '<span class="crouton-autocomplete-match">$1</span>');
  }
  
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  window.selectCroutonAutocompleteItem = function(merchantName, merchantIndex) {
    console.log('🎯 selectCroutonAutocompleteItem called with:', merchantName, 'index:', merchantIndex);
    
    // Fill the search input (use clean name for display)
    const cleanMerchantName = merchantName.replace(/\\+$/, "'s");
    searchInput.value = cleanMerchantName;
    
    // Hide autocomplete
    hideCroutonAutocomplete();
    
    // Navigate to the merchant
    console.log(`🔄 Sending searchMerchant action with targetIndex: ${merchantIndex}`);
    sendMessageToExtension('searchMerchant', { targetIndex: merchantIndex });
    // Removed crouton feedback notification
  }
  
  window.handleCroutonAutocompleteKeydown = function(e) {
    // Always get fresh reference to autocomplete element
    const searchAutocomplete = croutonContainer.querySelector('#crouton-search-autocomplete');
    
    if (!searchAutocomplete) {
      console.log('⚠️ Autocomplete element not found in keydown handler');
      return;
    }
    
    const items = searchAutocomplete.querySelectorAll('.crouton-autocomplete-item');
    
    if (items.length === 0) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        // If no item selected (-1), start at 0. Otherwise, move to next item or wrap to 0
        if (selectedAutocompleteIndex < 0) {
          selectedAutocompleteIndex = 0;
        } else {
          selectedAutocompleteIndex = (selectedAutocompleteIndex + 1) % items.length;
        }
        console.log(`🔽 ArrowDown (window): selectedIndex = ${selectedAutocompleteIndex} of ${items.length}`);
        updateCroutonAutocompleteSelection(items);
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        // If no item selected (-1), start at last item. Otherwise, move to previous item or wrap to last
        if (selectedAutocompleteIndex < 0) {
          selectedAutocompleteIndex = items.length - 1;
        } else if (selectedAutocompleteIndex === 0) {
          selectedAutocompleteIndex = items.length - 1;
        } else {
          selectedAutocompleteIndex = selectedAutocompleteIndex - 1;
        }
        console.log(`🔼 ArrowUp (window): selectedIndex = ${selectedAutocompleteIndex} of ${items.length}`);
        updateCroutonAutocompleteSelection(items);
        break;
        
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        let targetItem = null;
        let merchantName = '';
        let merchantIndex = -1;
        
        if (selectedAutocompleteIndex >= 0) {
          targetItem = items[selectedAutocompleteIndex];
          merchantIndex = parseInt(targetItem.dataset.merchantIndex);
          merchantName = croutonData.testingMerchants[merchantIndex].name;
        } else if (items.length > 0) {
          // If no item is selected but autocomplete is showing, select the first item
          targetItem = items[0];
          merchantIndex = parseInt(targetItem.dataset.merchantIndex);
          merchantName = croutonData.testingMerchants[merchantIndex].name;
        }
        
        if (targetItem && merchantName && merchantIndex >= 0) {
          console.log('🎯 Crouton autocomplete keyboard selection:', merchantName);
          
          // Set search input immediately
          searchInput.value = merchantName;
          console.log('🎯 Set crouton search input to:', searchInput.value);
          
          // Hide autocomplete immediately
          hideCroutonAutocomplete();
          
          // Navigate to the merchant directly
          setTimeout(async () => {
            console.log('🎯 Navigating to merchant from crouton keyboard selection');
            
            // Send search action to update extension state and navigate (background script handles navigation)
            await sendMessageToExtension('searchMerchant', { targetIndex: merchantIndex });
            
            console.log(`🔄 Sent searchMerchant action to background script for: ${merchantName}`);
            // Removed crouton feedback notification
          }, 100);
        }
        break;
        
      case 'Escape':
        hideCroutonAutocomplete();
        break;
    }
  }
  
  function updateCroutonAutocompleteSelection(items) {
    items.forEach((item, index) => {
      const isSelected = index === selectedAutocompleteIndex && selectedAutocompleteIndex >= 0;
      item.classList.toggle('selected', isSelected);
      if (isSelected) {
        console.log(`✅ Selected item ${index}: ${item.textContent.trim()}`);
      }
    });
  }
  
  // Add search functionality
  if (searchBtn && searchInput) {
    const handleSearch = async () => {
      const searchTerm = searchInput.value.trim().toLowerCase();
      if (!searchTerm) return;
      
      console.log(`🔍 Searching for merchant: ${searchTerm}`);
      console.log(`🔍 Available merchants:`, croutonData?.testingMerchants?.length || 0);
      console.log(`🔍 Current searchOverride:`, searchOverride);
      
      // Ensure we have merchant data for search
      if (!croutonData?.testingMerchants || croutonData.testingMerchants.length === 0) {
        console.error('❌ No testingMerchants data available for search');
        // Removed crouton feedback notification
        return;
      }
      
      // Find merchant with improved search logic
      const merchantIndex = findBestMerchantMatch(croutonData.testingMerchants, searchTerm);
      
      console.log(`🔍 Search result: index ${merchantIndex}`);
      
      if (merchantIndex !== -1) {
        console.log(`✅ Found merchant at index ${merchantIndex}: ${croutonData.testingMerchants[merchantIndex].name}`);
        console.log(`🔄 Sending searchMerchant action with targetIndex: ${merchantIndex}`);
        
        // Store the search result for persistence
        const foundMerchant = croutonData.testingMerchants[merchantIndex];
        
        // Clear any existing search override first
        searchOverride = false;
        
        // Send search action to update the extension state and navigate (background script handles navigation)
        console.log('🔍 Crouton: About to send searchMerchant action');
        console.log('🔍 Crouton: merchantIndex:', merchantIndex);
        console.log('🔍 Crouton: foundMerchant:', foundMerchant);
        console.log('🔍 Crouton: foundMerchant.url:', foundMerchant.url);
        
        await sendMessageToExtension('searchMerchant', { targetIndex: merchantIndex });
        
        console.log(`🔄 Sent searchMerchant action to background script for: ${foundMerchant.name}`);
        // Removed crouton feedback notification
        
        // Set search override flag to prevent external updates during local update
        searchOverride = true;
        
        // Update local data immediately for visual feedback
        const updatedData = {
          ...croutonData,
          currentMerchant: foundMerchant,
          currentIndex: merchantIndex,
          status: `Testing ${foundMerchant.name.replace(/\\+$/, "'s")}`,
          testingMerchants: croutonData.testingMerchants // Ensure we keep the full list
        };
        
        // Update global croutonData reference
        croutonData = updatedData;
        
        // Force update for immediate visual feedback
        await updateCroutonData(updatedData, true);
        
        // Clear the override flag after local update completes
        setTimeout(() => {
          searchOverride = false;
          console.log('🔄 Cleared search override flag for:', foundMerchant.name);
        }, 500);
        
        console.log(`🔄 Updated crouton to merchant: ${foundMerchant.name} at index ${merchantIndex}`);
        
        searchInput.value = '';
      } else {
        console.log(`❌ Merchant not found: ${searchTerm}`);
        console.log(`Available merchants:`, croutonData.testingMerchants?.map(m => m.name) || []);
        
        // Check if this looks like a domain search
        if (searchTerm.includes('.')) {
          // Removed crouton feedback notification
        } else {
          // Removed crouton feedback notification
        }
        
        searchInput.style.borderColor = '#f44336';
        setTimeout(() => {
          searchInput.style.borderColor = '';
        }, 2000);
      }
    };
    
    // Input event handler for autocomplete
    if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.trim();
      console.log('🔍 Crouton search input event:', searchTerm);
        console.log('🔍 Calling module function:', typeof showCroutonAutocomplete);
        if (typeof showCroutonAutocomplete === 'function') {
      showCroutonAutocomplete(searchTerm);
        } else {
          console.error('❌ Module showCroutonAutocomplete function not available!');
        }
      });
      console.log('✅ Added search input event listener');
    } else {
      console.error('❌ Search input not found for event listener - will retry with timeout');
      // Retry after a short delay in case DOM isn't fully ready
      setTimeout(() => {
        const retrySearchInput = croutonContainer.querySelector('.crouton-search-input');
        if (retrySearchInput) {
          console.log('🔍 Retry: Found search input, adding event listener');
          retrySearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.trim();
            console.log('🔍 Crouton search input event (retry):', searchTerm);
            if (typeof showCroutonAutocomplete === 'function') {
              showCroutonAutocomplete(searchTerm);
            } else {
              console.error('❌ Module showCroutonAutocomplete function not available!');
            }
          });
          console.log('✅ Added search input event listener (retry)');
        } else {
          console.error('❌ Search input still not found after retry');
        }
      }, 100);
    }
    
    // Keydown handler for navigation and search
    if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      // Always get fresh reference to autocomplete element
      const searchAutocomplete = croutonContainer.querySelector('#crouton-search-autocomplete');
      
      // Handle autocomplete navigation
      if (searchAutocomplete && searchAutocomplete.style.display === 'block') {
        handleCroutonAutocompleteKeydown(e);
      }
    });
    
    // Hide autocomplete when input loses focus (with delay for clicks)
    searchInput.addEventListener('blur', () => {
      setTimeout(() => {
        hideCroutonAutocomplete();
      }, 150);
      });
    } else {
      // Retry for keydown and blur listeners too
      setTimeout(() => {
        const retrySearchInput = croutonContainer.querySelector('.crouton-search-input');
        if (retrySearchInput) {
          console.log('🔍 Retry: Adding keydown and blur listeners to search input');
          retrySearchInput.addEventListener('keydown', (e) => {
            const searchAutocomplete = croutonContainer.querySelector('#crouton-search-autocomplete');
            if (searchAutocomplete && searchAutocomplete.style.display === 'block') {
              handleCroutonAutocompleteKeydown(e);
            }
          });
          
          retrySearchInput.addEventListener('blur', () => {
            setTimeout(() => {
              hideCroutonAutocomplete();
            }, 150);
          });
        }
      }, 100);
    }
    
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        console.log('🔍 Crouton search button clicked!');
        handleSearch();
      });
    } else {
      console.error('❌ Crouton search button not found! - will retry with timeout');
      // Retry after a short delay in case DOM isn't fully ready
      setTimeout(() => {
        const retrySearchBtn = croutonContainer.querySelector('#crouton-search-btn');
        if (retrySearchBtn) {
          console.log('🔍 Retry: Found search button, adding click listener');
          retrySearchBtn.addEventListener('click', () => {
            console.log('🔍 Crouton search button clicked! (retry)');
            handleSearch();
          });
          console.log('✅ Added search button event listener (retry)');
        } else {
          console.error('❌ Search button still not found after retry');
        }
      }, 100);
    }
    if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      // Always get fresh reference to autocomplete element
      const searchAutocomplete = croutonContainer.querySelector('#crouton-search-autocomplete');
      
      if (e.key === 'Enter' && (!searchAutocomplete || searchAutocomplete.style.display === 'none')) {
        handleSearch();
      }
    });
    } else {
      // Retry for keypress listener too
      setTimeout(() => {
        const retrySearchInput = croutonContainer.querySelector('.crouton-search-input');
        if (retrySearchInput) {
          console.log('🔍 Retry: Adding keypress listener to search input');
          retrySearchInput.addEventListener('keypress', (e) => {
            const searchAutocomplete = croutonContainer.querySelector('#crouton-search-autocomplete');
            if (e.key === 'Enter' && (!searchAutocomplete || searchAutocomplete.style.display === 'none')) {
              console.log('🔍 Enter key pressed - searching (retry)');
              handleSearch();
            }
          });
        }
      }, 100);
    }
    
    console.log('✅ Search functionality added');
  }
  
  // Add copy functionality with visual feedback
  if (copySuccessfulBtn) {
    copySuccessfulBtn.addEventListener('click', async (e) => {
      console.log('🏪 Copy successful merchants clicked');
      
      // Visual feedback - button animation
      const originalText = copySuccessfulBtn.textContent;
      const originalBg = copySuccessfulBtn.style.background;
      
      // Show loading state
      copySuccessfulBtn.textContent = '📋 Copying...';
      copySuccessfulBtn.style.background = '#3498db';
      copySuccessfulBtn.style.color = 'white';
      copySuccessfulBtn.classList.add('crouton-btn-loading');
      copySuccessfulBtn.disabled = true;
      
      try {
        await sendMessageToExtension('copySuccessfulMerchants');
        
        // Show success state
        copySuccessfulBtn.textContent = '✅ Copied!';
        copySuccessfulBtn.style.background = '#27ae60';
        copySuccessfulBtn.style.color = 'white';
        copySuccessfulBtn.classList.remove('crouton-btn-loading');
        
        // Removed crouton feedback notification
        
        // Reset after delay
        setTimeout(() => {
          copySuccessfulBtn.textContent = originalText;
          copySuccessfulBtn.style.background = originalBg;
          copySuccessfulBtn.style.color = '';
          copySuccessfulBtn.classList.remove('crouton-btn-loading');
          copySuccessfulBtn.disabled = false;
        }, 2000);
        
      } catch (error) {
        // Show error state
        copySuccessfulBtn.textContent = '❌ Failed';
        copySuccessfulBtn.style.background = '#e74c3c';
        copySuccessfulBtn.style.color = 'white';
        copySuccessfulBtn.classList.remove('crouton-btn-loading');
        
        // Removed crouton feedback notification
        
        // Reset after delay
        setTimeout(() => {
          copySuccessfulBtn.textContent = originalText;
          copySuccessfulBtn.style.background = originalBg;
          copySuccessfulBtn.style.color = '';
          copySuccessfulBtn.classList.remove('crouton-btn-loading');
          copySuccessfulBtn.disabled = false;
        }, 2000);
      }
    });
    console.log('✅ Copy successful button listener added');
  } else {
    console.error('❌ Copy successful button not found');
  }
  
  if (copyFlaggedBtn) {
    copyFlaggedBtn.addEventListener('click', async (e) => {
      console.log('🏪 Copy flagged merchants clicked');
      
      // Visual feedback - button animation
      const originalText = copyFlaggedBtn.textContent;
      const originalBg = copyFlaggedBtn.style.background;
      
      // Show loading state
      copyFlaggedBtn.textContent = '📋 Copying...';
      copyFlaggedBtn.style.background = '#f39c12';
      copyFlaggedBtn.style.color = 'white';
      copyFlaggedBtn.classList.add('crouton-btn-loading');
      copyFlaggedBtn.disabled = true;
      
      try {
        await sendMessageToExtension('copyFlaggedMerchants');
        
        // Show success state
        copyFlaggedBtn.textContent = '✅ Copied!';
        copyFlaggedBtn.style.background = '#27ae60';
        copyFlaggedBtn.style.color = 'white';
        copyFlaggedBtn.classList.remove('crouton-btn-loading');
        
        // Removed crouton feedback notification
        
        // Reset after delay
        setTimeout(() => {
          copyFlaggedBtn.textContent = originalText;
          copyFlaggedBtn.style.background = originalBg;
          copyFlaggedBtn.style.color = '';
          copyFlaggedBtn.classList.remove('crouton-btn-loading');
          copyFlaggedBtn.disabled = false;
        }, 2000);
        
      } catch (error) {
        // Show error state
        copyFlaggedBtn.textContent = '❌ Failed';
        copyFlaggedBtn.style.background = '#e74c3c';
        copyFlaggedBtn.style.color = 'white';
        copyFlaggedBtn.classList.remove('crouton-btn-loading');
        
        // Removed crouton feedback notification
        
        // Reset after delay
        setTimeout(() => {
          copyFlaggedBtn.textContent = originalText;
          copyFlaggedBtn.style.background = originalBg;
          copyFlaggedBtn.style.color = '';
          copyFlaggedBtn.classList.remove('crouton-btn-loading');
          copyFlaggedBtn.disabled = false;
        }, 2000);
      }
    });
    console.log('✅ Copy flagged button listener added');
  } else {
    console.error('❌ Copy flagged button not found');
  }
  
  // Drag functionality is handled by individual makeDraggable calls on minimized view
  console.log('✅ All crouton event listeners added');
}

// Update button states based on current merchant status
async function updateCroutonButtons(data) {
  if (!data?.currentMerchant) {
    console.log('🔄 No current merchant data for button update');
    return;
  }

  const flagBtn = croutonContainer.querySelector('#crouton-flag');
  const successBtn = croutonContainer.querySelector('#crouton-success');
  
  if (!flagBtn || !successBtn) {
    console.log('🔄 Flag or success button not found for update');
    return;
  }

  const currentMerchant = data.currentMerchant;
  console.log('🔄 Updating button states for merchant:', currentMerchant.name);
  
  // Get merchant status from storage
  try {
    const result = await chrome.storage.local.get(['extensionState']);
    const merchantStatuses = result.extensionState?.merchantStatuses || {};
    const merchantKey = currentMerchant.name.toLowerCase();
    const status = merchantStatuses[merchantKey];
    
    console.log('🔄 Merchant status from storage:', status);
    
    // Reset buttons to default state first
    flagBtn.style.background = '';
    flagBtn.style.color = '';
    flagBtn.style.boxShadow = '';
    flagBtn.style.border = '';
    flagBtn.textContent = '🚩 Flag';
    flagBtn.title = '';
    flagBtn.removeAttribute('data-already-flagged');
    
    successBtn.style.background = '';
    successBtn.style.color = '';
    successBtn.style.boxShadow = '';
    successBtn.style.border = '';
    successBtn.textContent = '✅ Successful';
    successBtn.title = '';
    successBtn.removeAttribute('data-already-successful');
    
    // Apply status-specific styling
    if (status === 'flagged') {
      flagBtn.style.background = '#e74c3c';
      flagBtn.style.color = 'white';
      flagBtn.style.boxShadow = '0 0 10px rgba(231, 76, 60, 0.4)';
      flagBtn.style.border = '2px solid #c0392b';
      flagBtn.textContent = '🚩 Marked Flagged';
      flagBtn.title = 'This merchant is flagged';
      flagBtn.setAttribute('data-already-flagged', 'true');
      console.log('🔄 Applied flagged styling to flag button');
    } else if (status === 'successful') {
      successBtn.style.background = '#27ae60';
      successBtn.style.color = 'white';
      successBtn.style.boxShadow = '0 0 10px rgba(39, 174, 96, 0.4)';
      successBtn.style.border = '2px solid #229954';
      successBtn.textContent = '✅ Marked Successful';
      successBtn.title = 'This merchant is successful';
      successBtn.setAttribute('data-already-successful', 'true');
      console.log('🔄 Applied successful styling to success button');
    }
    
    console.log('🔄 Button states updated successfully');
  } catch (error) {
    console.error('❌ Error updating button states:', error);
  }
}

// Removed duplicate updateProgressBar function - using the comprehensive one below

// Expand the crouton to show full controls
async function expandCrouton() {
  console.log('🔍 expandCrouton called');
  console.log('🔍 isTransitioning:', isTransitioning);
  console.log('🔍 isExpanded:', isExpanded);
  console.log('🔍 croutonContainer exists:', !!croutonContainer);
  
  // Prevent rapid clicks and duplicate operations
  if (isTransitioning || isExpanded) {
    console.log('🚫 Expand blocked: already transitioning or expanded');
    return;
  }
  
  isTransitioning = true;
  console.log('🔄 Starting expand transition');
  
  const minimizedView = croutonContainer.querySelector('.citishop-crouton-minimized');
  let expandedView = croutonContainer.querySelector('.citishop-crouton-expanded');
  
  // Save expanded preference for this website (clear collapse preference)
  await saveCollapsePreference(false);
  
  // If expanded view was removed, recreate it
  if (!expandedView) {
    // Double-check no expanded view exists to prevent duplicates
    const existingExpanded = croutonContainer.querySelector('.citishop-crouton-expanded');
    if (existingExpanded) {
      console.log('⚠️ Found existing expanded view during recreation');
      expandedView = existingExpanded;
    } else {
      // Load fresh merchant data from storage before recreating
      console.log('🔍 Loading fresh merchant data for crouton recreation');
      try {
        const result = await chrome.storage.local.get(['extensionState', 'merchantDatabase']);
        const state = result.extensionState;
        const merchantDatabase = result.merchantDatabase;
        
        if (state && state.testingMerchants && state.testingMerchants.length > 0) {
          console.log('🔍 Found testing merchants in storage:', state.testingMerchants.length);
          croutonData = {
            ...croutonData,
            testingMerchants: state.testingMerchants,
            totalMerchants: state.testingMerchants.length
          };
        } else if (merchantDatabase && merchantDatabase.length > 0) {
          console.log('🔍 Using merchant database as fallback:', merchantDatabase.length);
          croutonData = {
            ...croutonData,
            testingMerchants: merchantDatabase,
            totalMerchants: merchantDatabase.length
          };
        } else {
          console.log('⚠️ No merchant data found in storage');
        }
      } catch (error) {
        console.error('❌ Error loading merchant data:', error);
      }
      
      expandedView = document.createElement('div');
      expandedView.className = 'citishop-crouton-expanded';
    expandedView.innerHTML = `
      <div class="crouton-header">
        <div class="crouton-title-section">
          <div class="crouton-title">🧪 Merchant Testing</div>
          <div class="crouton-subtitle">Neil QA</div>
        </div>
        <button class="crouton-minimize">⬇️</button>
      </div>
      
      <div class="crouton-content">
        <div class="crouton-merchant-info">
        <div class="crouton-merchant-name">${croutonData?.currentMerchant?.name ? croutonData.currentMerchant.name.replace(/\\+$/, "'s") : 'Loading...'}</div>
        <div class="crouton-merchant-url">${croutonData?.currentMerchant?.url || ''}</div>
        <div class="crouton-progress">${(croutonData?.currentIndex || 0) + 1} / ${croutonData?.totalMerchants || 0}</div>
        <div class="crouton-status">${croutonData?.status ? croutonData.status.replace(/\\+$/, "'s") : 'Testing'}</div>
        </div>
        
        <div class="crouton-controls">
        <button class="crouton-btn crouton-btn-navigation" id="crouton-prev">← Previous</button>
        <button class="crouton-btn crouton-btn-navigation" id="crouton-next">Next →</button>
        </div>
        
        <div class="crouton-actions">
        <button class="crouton-btn crouton-btn-warning" id="crouton-flag">🚩 Flag</button>
        <button class="crouton-btn crouton-btn-success" id="crouton-success">✅ Successful</button>
        </div>
        
        <div class="crouton-search">
        <div class="crouton-search-container">
          <input type="text" id="crouton-search-input" placeholder="Search merchant..." class="crouton-search-input">
        <div id="crouton-search-autocomplete" class="crouton-autocomplete"></div>
        </div>
        <button id="crouton-search-btn" class="crouton-btn crouton-btn-primary">🔍</button>
        </div>
        
        <div class="crouton-copy-actions">
        <button id="crouton-copy-successful" class="crouton-btn crouton-btn-success">📋 Copy Successful</button>
        <button id="crouton-copy-flagged" class="crouton-btn crouton-btn-warning">📋 Copy Flagged</button>
        </div>
        
        <div class="crouton-status">${croutonData?.status || 'Ready to test'}</div>
        
        <div class="crouton-progress-bar">
          <div class="progress-bar-container">
            <div class="progress-bar-fill" id="crouton-progress-fill"></div>
            <div class="progress-bar-text" id="crouton-progress-text">Loading...</div>
          </div>
          <div class="progress-stats">
            <span class="stat-item">
              <span class="stat-icon">✅</span>
              <span class="stat-count" id="crouton-successful-count">-</span>
            </span>
            <span class="stat-item">
              <span class="stat-icon">🚩</span>
              <span class="stat-count" id="crouton-flagged-count">-</span>
            </span>
            <span class="stat-item">
              <span class="stat-icon">📊</span>
              <span class="stat-count" id="crouton-total-count">-</span>
            </span>
          </div>
        </div>
        </div>
      </div>
    `;
    
    croutonContainer.appendChild(expandedView);
    
    // Immediately update progress bar and button states with current data after recreating view
    console.log('🔄 Immediate progress bar and button state update after recreating expanded view');
    updateProgressBar(croutonData);
    updateCroutonButtons(croutonData).catch(console.error);
    
    // Reattach event listeners
    setupCroutonEventListeners();
    
    // Update search layout immediately after recreating expanded view
    updateSearchLayout();
  
  // Reset scroll position to top when reopening
  const croutonContentReopen = croutonContainer.querySelector('.crouton-content');
  if (croutonContentReopen) {
    croutonContentReopen.scrollTop = 0;
    console.log('🔍 Reset crouton content scroll position to top');
  }
  
  // Debug: Check crouton appearance after reopening
  console.log('🔍 Crouton appearance after reopening:');
  console.log('🔍 croutonContainer classes:', croutonContainer.className);
  console.log('🔍 croutonContainer styles:', {
    display: croutonContainer.style.display,
    position: croutonContainer.style.position,
    zIndex: croutonContainer.style.zIndex,
    opacity: croutonContainer.style.opacity,
    visibility: croutonContainer.style.visibility
  });
  
  // Check if styles are applied
  const computedStyle = getComputedStyle(croutonContainer);
  console.log('🔍 Computed styles:', {
    display: computedStyle.display,
    position: computedStyle.position,
    zIndex: computedStyle.zIndex,
    opacity: computedStyle.opacity,
    visibility: computedStyle.visibility
  });
  
  // Force search section layout to be properly restored
  const searchSection = croutonContainer.querySelector('.crouton-search');
  const searchBtn = croutonContainer.querySelector('#crouton-search-btn');
  
  if (searchSection) {
    searchSection.style.setProperty('display', 'flex', 'important');
    searchSection.style.setProperty('gap', '8px', 'important');
    searchSection.style.setProperty('align-items', 'center', 'important');
    searchSection.style.setProperty('width', '100%', 'important');
    console.log('🔍 Fixed search section layout');
  }
  
  if (searchBtn) {
    searchBtn.style.setProperty('flex-shrink', '0', 'important');
    searchBtn.style.setProperty('min-width', '50px', 'important');
    searchBtn.style.setProperty('max-width', '60px', 'important');
    console.log('🔍 Fixed search button layout');
    
    // Re-add search button event listener if it was lost during cloning
    const existingBtnListener = searchBtn.getAttribute('data-search-listener');
    if (!existingBtnListener) {
      searchBtn.addEventListener('click', () => {
        console.log('🔍 Crouton search button clicked (restored)!');
        handleSearch();
      });
      searchBtn.setAttribute('data-search-listener', 'true');
      console.log('🔍 Restored search button event listener');
    }
  }
  
  // Force autocomplete functionality to be properly restored
  const searchAutocomplete = croutonContainer.querySelector('#crouton-search-autocomplete');
  const searchInput = croutonContainer.querySelector('.crouton-search-input');
  
  if (searchAutocomplete) {
    // Ensure autocomplete has proper positioning and visibility
    searchAutocomplete.style.setProperty('position', 'absolute', 'important');
    searchAutocomplete.style.setProperty('top', '100%', 'important');
    searchAutocomplete.style.setProperty('left', '0', 'important');
    searchAutocomplete.style.setProperty('right', '0', 'important');
    searchAutocomplete.style.setProperty('z-index', '999999', 'important');
    searchAutocomplete.style.setProperty('display', 'none', 'important');
    searchAutocomplete.style.setProperty('background', 'white', 'important');
    searchAutocomplete.style.setProperty('border', '1px solid #ddd', 'important');
    searchAutocomplete.style.setProperty('border-top', 'none', 'important');
    searchAutocomplete.style.setProperty('border-radius', '0 0 4px 4px', 'important');
    searchAutocomplete.style.setProperty('max-height', '120px', 'important');
    searchAutocomplete.style.setProperty('overflow-y', 'auto', 'important');
    searchAutocomplete.style.setProperty('box-shadow', '0 2px 8px rgba(0,0,0,0.1)', 'important');
    console.log('🔍 Fixed autocomplete positioning and styling');
  }
  
  if (searchInput) {
    // Ensure search input maintains proper functionality
    searchInput.style.setProperty('width', '100%', 'important');
    searchInput.style.setProperty('box-sizing', 'border-box', 'important');
    console.log('🔍 Fixed search input styling');
    
    // Re-add autocomplete event listeners if they were lost during cloning
    const existingInputListener = searchInput.getAttribute('data-autocomplete-listener');
    if (!existingInputListener) {
      searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.trim();
        console.log('🔍 Crouton search input event (restored):', searchTerm);
        console.log('🔍 Calling module function (restored):', typeof showCroutonAutocomplete);
        if (typeof showCroutonAutocomplete === 'function') {
          showCroutonAutocomplete(searchTerm);
        } else {
          console.error('❌ Module showCroutonAutocomplete function not available (restored)!');
        }
      });
      
      searchInput.addEventListener('keydown', (e) => {
        const searchAutocomplete = croutonContainer.querySelector('#crouton-search-autocomplete');
        if (searchAutocomplete && searchAutocomplete.style.display === 'block') {
          handleCroutonAutocompleteKeydown(e);
        }
      });
      
      searchInput.addEventListener('blur', () => {
        setTimeout(() => {
          hideCroutonAutocomplete();
        }, 150);
      });
      
      searchInput.setAttribute('data-autocomplete-listener', 'true');
      console.log('🔍 Restored autocomplete event listeners to search input');
    }
  }
  
  // Ensure minimize button works after reopening
  const minimizeBtn = croutonContainer.querySelector('.crouton-minimize');
  if (minimizeBtn) {
    const existingMinimizeListener = minimizeBtn.getAttribute('data-minimize-listener');
    if (!existingMinimizeListener) {
      minimizeBtn.addEventListener('click', async () => {
        console.log('🔍 Minimize button clicked (restored) - minimizing crouton');
        await minimizeCrouton();
      });
      minimizeBtn.setAttribute('data-minimize-listener', 'true');
      console.log('🔍 Restored minimize button event listener');
    }
  } else {
    console.error('❌ Minimize button not found for restoration!');
  }
    
  // Reset scroll position to top when expanding
  const croutonContentExpand = croutonContainer.querySelector('.crouton-content');
  if (croutonContentExpand) {
    croutonContentExpand.scrollTop = 0;
    console.log('🔍 Reset crouton content scroll position to top on expand');
  }
  
  // Ensure crouton has access to full merchant database for search
  if (croutonData && (!croutonData.testingMerchants || croutonData.testingMerchants.length < 10)) {
    console.log('🔍 Crouton has limited merchant data, loading full database');
    try {
      const result = await chrome.storage.local.get(['merchantDatabase']);
      const merchantDatabase = result.merchantDatabase;
      
      if (merchantDatabase && merchantDatabase.length > 0) {
        console.log('🔍 Loading full merchant database:', merchantDatabase.length, 'merchants');
        croutonData.testingMerchants = merchantDatabase;
        croutonData.totalMerchants = merchantDatabase.length;
        console.log('✅ Crouton now has access to full merchant database');
      }
    } catch (error) {
      console.error('❌ Error loading full merchant database:', error);
    }
  }
    
      // Update with current data (non-blocking)
      if (croutonData) {
        updateCroutonButtons(croutonData).catch(console.error);
        updateProgressBar(croutonData);
      }
    }
  }
  
  console.log('🎯 Expanding crouton and moving to higher position');
  
  // Remove minimized-only class to restore normal container styling
  croutonContainer.classList.remove('minimized-only');
  
  // Move crouton to higher position when expanded (200px above center)
  croutonContainer.style.setProperty('top', 'calc(50% - 200px)', 'important');
  
  // Force hide minimized view and show expanded view
  minimizedView.style.display = 'none !important';
  minimizedView.style.visibility = 'hidden';
  minimizedView.style.opacity = '0';
  
  expandedView.style.display = 'block !important';
  expandedView.style.visibility = 'visible';
  
  isExpanded = true;
  
  // Add click-to-close functionality for the expanded crouton
  setTimeout(() => {
    const expandedView = croutonContainer.querySelector('.citishop-crouton-expanded');
    if (expandedView && !expandedView.hasAttribute('data-click-to-close')) {
      expandedView.addEventListener('click', async (e) => {
        // Don't close if clicking on buttons or interactive elements
        if (e.target.tagName === 'BUTTON' || 
            e.target.closest('button') || 
            e.target.closest('input') ||
            e.target.closest('.crouton-minimize')) {
          console.log('🚫 Click-to-close blocked: clicked on interactive element');
          return;
        }
        
        console.log('🎯 Click-to-close triggered - minimizing crouton');
        await minimizeCrouton();
      });
      
      expandedView.setAttribute('data-click-to-close', 'true');
      console.log('🎯 Added click-to-close functionality to expanded crouton');
    }
  }, 50);
  
  isExpanded = true;
  
  console.log('🔍 After expand - display states:');
  console.log('  - Minimized view display:', minimizedView.style.display);
  console.log('  - Minimized view visibility:', minimizedView.style.visibility);
  console.log('  - Expanded view display:', expandedView.style.display);
  console.log('  - Expanded view visibility:', expandedView.style.visibility);
  console.log('  - isExpanded:', isExpanded);
  
  // Animate expansion (start from small/transparent)
  expandedView.style.transform = 'scale(0.8)';
  expandedView.style.opacity = '0';
  
  requestAnimationFrame(() => {
    expandedView.style.transition = 'all 0.2s ease-out';
    expandedView.style.transform = 'scale(1)';
    expandedView.style.opacity = '1';
    
    // Reset transition flag after animation completes
    setTimeout(() => {
      isTransitioning = false;
      console.log('✅ Expand transition completed');
      
      // Update progress bar after expansion is complete
      if (croutonData) {
        console.log('🔄 Progress bar update after expand transition complete');
        updateProgressBar(croutonData);
      }
    }, 200);
  });
  
  // Always update progress bar when expanding, regardless of view recreation
  console.log('🔄 Updating progress bar on crouton expand');
  if (croutonData) {
    // Use setTimeout to ensure DOM is ready
    setTimeout(() => {
      console.log('🔄 Delayed progress bar update on expand');
      updateProgressBar(croutonData);
    }, 100);
  }
}

// Minimize the crouton to small state
async function minimizeCrouton() {
  // Prevent rapid clicks and duplicate operations
  if (isTransitioning || !isExpanded) {
    console.log('🚫 Minimize blocked: already transitioning or minimized');
    return;
  }
  
  isTransitioning = true;
  console.log('🔄 Starting minimize transition');
  
  const minimizedView = croutonContainer.querySelector('.citishop-crouton-minimized');
  const expandedView = croutonContainer.querySelector('.citishop-crouton-expanded');
  
  if (!expandedView) {
    console.log('⚠️ No expanded view found to minimize');
    isTransitioning = false;
    return;
  }
  
  expandedView.style.transition = 'all 0.2s ease-in';
  expandedView.style.transform = 'scale(0.8)';
  expandedView.style.opacity = '0';
  
  // Save collapse preference for this website
  await saveCollapsePreference(true);
  
  setTimeout(() => {
    // Completely remove the expanded view from DOM
    if (expandedView && expandedView.parentNode) {
      expandedView.parentNode.removeChild(expandedView);
    }
    
    // Add CSS class to ensure transparent background when minimized
    croutonContainer.classList.add('minimized-only');
    
    // Move crouton back to lower position when minimized (100px above center)
    croutonContainer.style.setProperty('top', 'calc(50% - 100px)', 'important');
    
    // Show minimized view and ensure it's draggable
    minimizedView.style.display = 'flex';
    minimizedView.style.visibility = 'visible';
    minimizedView.style.opacity = '1';
    
    // Re-attach drag functionality if needed
    if (!minimizedView.hasAttribute('data-draggable')) {
      makeDraggable(minimizedView);
      minimizedView.setAttribute('data-draggable', 'true');
      console.log('🎯 Re-attached drag functionality to minimized view');
    }
    
    isExpanded = false;
    
    console.log('🔍 After minimize - display states:');
    console.log('  - Minimized view display:', minimizedView.style.display);
    console.log('  - Minimized view visibility:', minimizedView.style.visibility);
    console.log('  - Expanded view removed from DOM');
    console.log('  - isExpanded:', isExpanded);
    
    // Reset transition flag after animation completes
    isTransitioning = false;
    console.log('✅ Minimize transition completed');
  }, 200);
}

// Remove any existing restore buttons on page load
function removeAnyRestoreButtons() {
  const existingRestore = document.getElementById('citishop-crouton-restore');
  if (existingRestore) {
    existingRestore.remove();
  }
}

// Debug function to check crouton state
function debugCroutonState(context = '') {
  if (!croutonContainer) {
    console.log(`🐛 [${context}] No crouton container found`);
    return;
  }
  
  const minimizedView = croutonContainer.querySelector('.citishop-crouton-minimized');
  const expandedView = croutonContainer.querySelector('.citishop-crouton-expanded');
  
  console.log(`🐛 [${context}] Crouton State Debug:`, {
    isExpanded,
    expandedViewDisplay: expandedView?.style.display,
    expandedViewVisibility: expandedView?.style.visibility,
    expandedViewHasHiddenClass: expandedView?.classList.contains('crouton-hidden'),
    minimizedViewDisplay: minimizedView?.style.display,
    minimizedViewVisibility: minimizedView?.style.visibility
  });
}

// Update crouton with new data
async function updateCroutonData(data, force = false) {
  console.log('🔄 updateCroutonData called with:', data);
  
  // If search override is active and this isn't a forced update, skip external updates
  if (searchOverride && !force) {
    console.log('🚫 Skipping update due to search override');
    return;
  }
  
  // Preserve expansion state
  const wasExpanded = isExpanded;
  
  // Preserve testingMerchants if not provided in new data
  if (!data.testingMerchants && croutonData && croutonData.testingMerchants) {
    data.testingMerchants = croutonData.testingMerchants;
    console.log('📋 Preserved testingMerchants from existing data');
  }
  
  croutonData = { ...croutonData, ...data };
  console.log('💾 Updated croutonData:', {
    currentMerchant: croutonData.currentMerchant?.name,
    currentIndex: croutonData.currentIndex,
    totalMerchants: croutonData.totalMerchants,
    testingMerchantsCount: croutonData.testingMerchants?.length
  });
  
  if (!croutonContainer) return;
  
  // Update minimized view
  const minimizedText = croutonContainer.querySelector('.crouton-text');
  if (minimizedText) {
    minimizedText.textContent = data.currentMerchant?.name || 'Testing';
    console.log('📱 Updated minimized text to:', minimizedText.textContent);
  }
  
  // Update expanded view
  const merchantName = croutonContainer.querySelector('.crouton-merchant-name');
  const merchantUrl = croutonContainer.querySelector('.crouton-merchant-url');
  const progress = croutonContainer.querySelector('.crouton-progress');
  const status = croutonContainer.querySelector('.crouton-status');
  
  if (merchantName) {
    const cleanMerchantName = data.currentMerchant?.name ? data.currentMerchant.name.replace(/\\+$/, "'s") : 'Loading...';
    merchantName.textContent = cleanMerchantName;
    console.log('🏪 Updated merchant name to:', merchantName.textContent);
  }
  if (merchantUrl) {
    merchantUrl.textContent = data.currentMerchant?.url || '';
    console.log('🔗 Updated merchant URL to:', merchantUrl.textContent);
  }
  if (progress) {
    progress.textContent = `${data.currentIndex + 1} / ${data.totalMerchants}`;
    console.log('📊 Updated progress to:', progress.textContent);
  }
  if (status) {
    const cleanStatus = data.status ? data.status.replace(/\\+$/, "'s") : 'Ready to test';
    status.textContent = cleanStatus;
    console.log('📌 Updated status to:', status.textContent);
  }
  
  // Update button states
  await updateCroutonButtons(data);
  
  // Update progress bar immediately
  updateProgressBar(data);
  
  // Update search layout to ensure it's correct
  updateSearchLayout();
  
  // Also schedule a delayed progress bar update to handle any timing issues
  setTimeout(() => {
    console.log('🔄 Delayed progress bar update after crouton data change');
    updateProgressBar(data);
    
    // Also ensure search layout is still correct after delay
    updateSearchLayout();
  }, 100);
  
  // And another one after a longer delay to ensure storage operations complete
  setTimeout(() => {
    console.log('🔄 Secondary delayed progress bar update for storage sync');
    updateProgressBar(data);
  }, 500);
  
  // Restore expansion state if it was expanded before, but respect website preferences
  if (wasExpanded && !isExpanded) {
    const shouldCollapse = await shouldStartCollapsed();
    if (!shouldCollapse) {
      console.log('🔄 Restoring expanded state after update');
      await expandCrouton();
    } else {
      console.log('💾 Website preference overrides expansion - staying collapsed');
    }
  }
  
  // Force visual refresh by triggering a DOM update
  if (croutonContainer) {
    const event = new CustomEvent('croutonUpdated');
    croutonContainer.dispatchEvent(event);
  }
  
  // Schedule a status sync check to ensure the status is up to date
  scheduleStatusSync();
}

// Enhanced status synchronization
let statusSyncTimer = null;
function scheduleStatusSync() {
  // Clear any existing timer
  if (statusSyncTimer) {
    clearTimeout(statusSyncTimer);
  }
  
  // Schedule a status sync in 2 seconds
  statusSyncTimer = setTimeout(async () => {
    await syncMerchantStatus();
  }, 2000);
}

// Sync merchant status from storage
async function syncMerchantStatus() {
  if (!croutonData || !croutonData.currentMerchant || !croutonContainer) {
    return;
  }
  
  try {
    console.log('🔄 Syncing merchant status from storage...');
    const result = await chrome.storage.local.get(['extensionState']);
    const state = result.extensionState;
    
    if (state && state.merchantStatuses) {
      const merchantKey = croutonData.currentMerchant.name.toLowerCase();
      const freshStatus = state.merchantStatuses[merchantKey] || '';
      const currentStatus = croutonData.merchantStatus || '';
      
      if (freshStatus !== currentStatus) {
        console.log(`🔄 Status sync update for ${croutonData.currentMerchant.name}: "${currentStatus}" → "${freshStatus}"`);
        croutonData.merchantStatus = freshStatus;
        await updateCroutonButtons(croutonData);
        
        // Also update the progress bar to reflect any changes
        updateProgressBar(croutonData);
      } else {
        console.log(`✅ Status sync confirmed for ${croutonData.currentMerchant.name}: "${freshStatus}"`);
        
        // Even if status didn't change, refresh progress bar to ensure it's current
        updateProgressBar(croutonData);
      }
    }
  } catch (error) {
    console.error('❌ Failed to sync merchant status:', error);
  }
}

// Start periodic status synchronization
function startPeriodicSync() {
  // Clear any existing interval
  if (periodicSyncInterval) {
    clearInterval(periodicSyncInterval);
  }
  
  // Start periodic sync every 10 seconds
  periodicSyncInterval = setInterval(async () => {
    await syncMerchantStatus();
  }, 10000);
  
  console.log('🔄 Started periodic status sync (every 10 seconds)');
}

// Stop periodic status synchronization
function stopPeriodicSync() {
  if (periodicSyncInterval) {
    clearInterval(periodicSyncInterval);
    periodicSyncInterval = null;
    console.log('⏹️ Stopped periodic status sync');
  }
}

// Update button states based on current data
async function updateCroutonButtons(data) {
  console.log('🔄 updateCroutonButtons called with data:', data);
  
  const prevBtn = croutonContainer.querySelector('#crouton-prev');
  const nextBtn = croutonContainer.querySelector('#crouton-next');
  const flagBtn = croutonContainer.querySelector('#crouton-flag');
  const successBtn = croutonContainer.querySelector('#crouton-success');
  
  if (prevBtn) {
    prevBtn.disabled = data.currentIndex <= 0;
  }
  
  if (nextBtn) {
    nextBtn.disabled = data.currentIndex >= data.totalMerchants - 1;
  }
  
  // Get fresh merchant status from storage instead of relying on data parameter
  let merchantStatus = '';
  if (data.currentMerchant) {
    try {
      const result = await new Promise(resolve => {
        chrome.storage.local.get(['extensionState'], resolve);
      });
      const merchantStatuses = result.extensionState?.merchantStatuses || {};
      const merchantKey = data.currentMerchant.name.toLowerCase();
      merchantStatus = merchantStatuses[merchantKey] || '';
      console.log(`🔍 updateCroutonButtons - Fresh status for ${data.currentMerchant.name}: ${merchantStatus}`);
    } catch (error) {
      console.error('❌ Failed to get fresh status:', error);
      merchantStatus = data.merchantStatus || '';
    }
  }
  
  // Handle mutually exclusive button states - only one can be active at a time
  if (flagBtn && successBtn) {
    console.log(`🔍 Updating mutually exclusive button states - current merchant status: "${merchantStatus}"`);
    
    if (merchantStatus === 'flagged') {
      console.log('🔍 Setting flag button to active state and success button to inactive');
      
      // Activate flag button
      flagBtn.style.background = '#e74c3c';
      flagBtn.style.color = 'white';
      flagBtn.style.boxShadow = '0 0 10px rgba(231, 76, 60, 0.4)';
      flagBtn.style.border = '2px solid #c0392b';
      flagBtn.textContent = '🚩 Marked Flagged';
      flagBtn.title = 'This merchant is flagged';
      flagBtn.setAttribute('data-already-flagged', 'true');
      flagBtn.disabled = false;
      
      // Deactivate success button
      successBtn.style.background = '';
      successBtn.style.color = '';
      successBtn.style.boxShadow = '';
      successBtn.style.border = '';
      successBtn.textContent = '✅ Successful';
      successBtn.title = 'Mark this merchant as successful';
      successBtn.removeAttribute('data-already-successful');
      successBtn.disabled = false;
      
      // Update progress bar
      console.log('🔄 Flagged status detected - updating progress');
      await updateProgressBarLocally('flagged');
      setTimeout(() => {
        forceRefreshProgress();
      }, 50);
      
    } else if (merchantStatus === 'tested' || merchantStatus === 'successful') {
      console.log('🔍 Setting success button to active state and flag button to inactive');
      
      // Activate success button
      successBtn.style.background = '#27ae60';
      successBtn.style.color = 'white';
      successBtn.style.boxShadow = '0 0 10px rgba(39, 174, 96, 0.4)';
      successBtn.style.border = '2px solid #229954';
      successBtn.textContent = '✅ Marked Successful';
      successBtn.title = 'This merchant is successful';
      successBtn.setAttribute('data-already-successful', 'true');
      successBtn.disabled = false;
      
      // Deactivate flag button
      flagBtn.style.background = '';
      flagBtn.style.color = '';
      flagBtn.style.boxShadow = '';
      flagBtn.style.border = '';
      flagBtn.textContent = '🚩 Flag';
      flagBtn.title = 'Flag this merchant';
      flagBtn.removeAttribute('data-already-flagged');
      flagBtn.disabled = false;
      
      // Update progress bar
      console.log('🔄 Successful status detected - updating progress');
      await updateProgressBarLocally('successful');
      setTimeout(() => {
        forceRefreshProgress();
      }, 50);
      
    } else {
      console.log('🔍 Setting both buttons to inactive/normal state');
      
      // Deactivate flag button
      flagBtn.style.background = '';
      flagBtn.style.color = '';
      flagBtn.style.boxShadow = '';
      flagBtn.style.border = '';
      flagBtn.textContent = '🚩 Flag';
      flagBtn.title = 'Flag this merchant';
      flagBtn.removeAttribute('data-already-flagged');
      flagBtn.disabled = false;
      
      // Deactivate success button
      successBtn.style.background = '';
      successBtn.style.color = '';
      successBtn.style.boxShadow = '';
      successBtn.style.border = '';
      successBtn.textContent = '✅ Successful';
      successBtn.title = 'Mark this merchant as successful';
      successBtn.removeAttribute('data-already-successful');
      successBtn.disabled = false;
    }
    
    console.log('🔍 Button states updated:', {
      flagActive: flagBtn.hasAttribute('data-already-flagged'),
      successActive: successBtn.hasAttribute('data-already-successful'),
      merchantStatus: merchantStatus
    });
  }
}

// Test extension context
function testExtensionContext() {
  console.log('🔍 Testing extension context...');
  console.log('  chrome:', !!chrome);
  console.log('  chrome.storage:', !!chrome?.storage);
  console.log('  chrome.runtime:', !!chrome?.runtime);
  console.log('  chrome.tabs:', !!chrome?.tabs);
  console.log('  chrome.runtime.lastError:', chrome?.runtime?.lastError);
  
  if (!chrome || !chrome.storage || !chrome.runtime) {
    console.error('❌ Extension context is invalid - cleaning up crouton');
    cleanupCrouton();
    return false;
  }
  
  // Test runtime ID (becomes null when extension is reloaded)
  if (!chrome.runtime.id) {
    console.error('❌ Extension runtime ID is null - extension reloaded, cleaning up crouton');
    cleanupCrouton();
    return false;
  }
  
  console.log('✅ Extension context is valid');
  return true;
}

// Test direct navigation (for debugging)
async function testDirectNavigation(url = 'https://google.com') {
  console.log('🧪 Testing direct navigation to:', url);
  
  try {
    // Test if we can send a message to background script
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'testNavigation',
        url: url
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
    
    console.log('✅ Navigation test response:', response);
    return response;
  } catch (error) {
    console.error('❌ Navigation test failed:', error);
    return { success: false, error: error.message };
  }
}

// Make element draggable
function makeDraggable(element) {
  let isDragging = false;
  let startX, startY, initialX, initialY;
  let currentX = 0, currentY = 0;
  
  element.addEventListener('mousedown', dragStart);
  element.addEventListener('touchstart', dragStart, { passive: false });
  
  function dragStart(e) {
    // Only allow dragging when the crouton is minimized (not expanded)
    if (isExpanded) {
      console.log('🚫 Drag blocked: crouton is expanded');
      return;
    }
    
    // Don't drag if clicking on buttons or interactive elements
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
      console.log('🚫 Drag blocked: clicked on button');
      return;
    }
    
    console.log('🎯 Drag started on minimized crouton');
    isDragging = true;
    element.style.cursor = 'grabbing';
    
    // Add visual feedback during drag
    element.style.transform = 'scale(1.05)';
    element.style.boxShadow = '0 8px 20px rgba(0,0,0,0.3)';
    
    // Prevent default to avoid text selection
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'mousedown') {
      startX = e.clientX;
      startY = e.clientY;
    } else {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }
    
    // Get current position
    const rect = croutonContainer.getBoundingClientRect();
    initialX = rect.left;
    initialY = rect.top;
    
    // Add global event listeners
    document.addEventListener('mousemove', dragMove);
    document.addEventListener('touchmove', dragMove, { passive: false });
    document.addEventListener('mouseup', dragEnd);
    document.addEventListener('touchend', dragEnd);
    
    e.preventDefault();
  }
  
  function dragMove(e) {
    if (!isDragging) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    let clientX, clientY;
    if (e.type === 'mousemove') {
      clientX = e.clientX;
      clientY = e.clientY;
    } else {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }
    
    currentX = initialX + (clientX - startX);
    currentY = initialY + (clientY - startY);
    
    // Constrain to viewport
    const containerRect = croutonContainer.getBoundingClientRect();
    const maxX = window.innerWidth - containerRect.width;
    const maxY = window.innerHeight - containerRect.height;
    
    currentX = Math.max(0, Math.min(currentX, maxX));
    currentY = Math.max(0, Math.min(currentY, maxY));
    
    // Remove position classes and apply custom position
    croutonContainer.classList.remove(
      'position-bottom-right',
      'position-bottom-left',
      'position-top-right',
      'position-top-left',
      'position-middle-left'
    );
    
    croutonContainer.style.left = `${currentX}px`;
    croutonContainer.style.top = `${currentY}px`;
    croutonContainer.style.transform = 'none';
    croutonContainer.style.right = 'auto';
    croutonContainer.style.bottom = 'auto';
  }
  
  function dragEnd() {
    if (!isDragging) return;
    
    isDragging = false;
    element.style.cursor = 'grab';
    
    // Restore visual state
    element.style.transform = 'scale(1)';
    element.style.boxShadow = '0 2px 6px rgba(0,0,0,0.1)';
    
    // Remove global event listeners
    document.removeEventListener('mousemove', dragMove);
    document.removeEventListener('touchmove', dragMove);
    document.removeEventListener('mouseup', dragEnd);
    document.removeEventListener('touchend', dragEnd);
    
    // Save custom position
    saveCustomPosition(currentX, currentY);
    
    console.log('🎯 Drag ended, position saved:', { currentX, currentY });
  }
}

// Save custom drag position
async function saveCustomPosition(x, y) {
  try {
    const websiteKey = getCurrentWebsiteKey();
    await chrome.storage.local.set({
      [`crouton_custom_position_${websiteKey}`]: { x, y }
    });
    console.log(`💾 Saved custom position: ${x}, ${y} for ${websiteKey}`);
  } catch (error) {
    console.error('❌ Failed to save custom position:', error);
  }
}

// Load custom drag position
async function loadCustomPosition() {
  try {
    const websiteKey = getCurrentWebsiteKey();
    const result = await chrome.storage.local.get([`crouton_custom_position_${websiteKey}`]);
    const position = result[`crouton_custom_position_${websiteKey}`];
    
    if (position && position.x !== undefined && position.y !== undefined) {
      console.log(`📍 Loading custom position: ${position.x}, ${position.y} for ${websiteKey}`);
      
      // Remove position classes and apply custom position
      croutonContainer.classList.remove(
        'position-bottom-right',
        'position-bottom-left',
        'position-top-right',
        'position-top-left',
        'position-middle-left'
      );
      
      croutonContainer.style.left = `${position.x}px`;
      croutonContainer.style.top = `${position.y}px`;
      croutonContainer.style.transform = 'none';
      croutonContainer.style.right = 'auto';
      croutonContainer.style.bottom = 'auto';
      
      return true; // Custom position applied
    }
    
    return false; // No custom position found
  } catch (error) {
    console.error('❌ Failed to load custom position:', error);
    return false;
  }
}

// Apply crouton position setting
async function applyCroutonPosition() {
  try {
    // First check for custom drag position
    const hasCustomPosition = await loadCustomPosition();
    if (hasCustomPosition) {
      console.log('✅ Applied custom drag position');
      return;
    }
    
    // Get position setting from storage
    const result = await chrome.storage.local.get(['extensionSettings']);
    const settings = result.extensionSettings || { croutonPosition: 'middle-left' };
    const position = settings.croutonPosition || 'middle-left';
    
    console.log('🎯 Applying crouton position:', position);
    
    // Remove any existing position classes
    croutonContainer.classList.remove(
      'position-bottom-right',
      'position-bottom-left', 
      'position-top-right',
      'position-top-left',
      'position-middle-left'
    );
    
    // Add the current position class
    croutonContainer.classList.add(`position-${position}`);
    
    // Force a reflow to ensure positioning is applied immediately
    croutonContainer.offsetHeight;
    
    console.log('✅ Crouton position applied:', position, {
      actualTop: window.getComputedStyle(croutonContainer).top,
      actualLeft: window.getComputedStyle(croutonContainer).left,
      classes: Array.from(croutonContainer.classList)
    });
  } catch (error) {
    console.error('❌ Failed to apply crouton position:', error);
    // Fallback to default position (middle-left)
    croutonContainer.classList.add('position-middle-left');
  }
}

// Make functions globally accessible for console testing
window.testDirectNavigation = testDirectNavigation;
window.testExtensionContext = testExtensionContext;

// Simple inline navigation test
window.testNav = async function(url = 'https://google.com') {
  console.log('🧪 Simple navigation test to:', url);
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'testNavigation',
      url: url
    });
    console.log('✅ Test result:', response);
    return response;
  } catch (error) {
    console.error('❌ Test failed:', error);
    return { success: false, error: error.message };
  }
};

// Send message to extension popup
async function sendMessageToExtension(action, extraData = {}) {
  console.log(`🏪 Crouton action: ${action}`, extraData);
  
  // Test extension context first
  if (!testExtensionContext()) {
    // Removed crouton feedback notification
    return;
  }
  
  // Clear search override when any action is taken
  if (searchOverride && action !== 'searchMerchant') {
    searchOverride = false;
    console.log('🔄 Cleared search override for action:', action);
  }
  
  try {
    // Check if chrome extension context is valid
    if (!chrome || !chrome.storage || !chrome.runtime) {
      console.error('❌ Extension context invalidated - cleaning up crouton');
      // Removed crouton feedback notification
      cleanupCrouton();
      return;
    }
    
    // Additional check for runtime connection
    if (chrome.runtime.lastError) {
      console.error('❌ Chrome runtime error:', chrome.runtime.lastError);
      // Removed crouton feedback notification - Extension error - reload needed
      return;
    }
    
    // Store the action directly in storage for popup pickup
    const actionData = {
      action: action,
      currentMerchant: croutonData.currentMerchant,
      currentIndex: croutonData.currentIndex,
      timestamp: Date.now(),
      ...extraData
    };
    
    console.log(`📤 Sending action data:`, {
      action: actionData.action,
      currentMerchant: actionData.currentMerchant?.name,
      currentIndex: actionData.currentIndex
    });
    
    await chrome.storage.local.set({ 
      pendingCroutonAction: actionData 
    });
    
    console.log(`✅ Crouton action ${action} stored successfully`);
    
    // Try to send direct message as backup (may fail if extension reloaded)
    try {
      chrome.runtime.sendMessage({
        action: 'croutonAction',
        data: actionData
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('Direct message failed:', chrome.runtime.lastError.message);
          if (chrome.runtime.lastError.message.includes('Extension context invalidated') || 
              chrome.runtime.lastError.message.includes('message port closed') ||
              chrome.runtime.lastError.message.includes('receiving end does not exist')) {
            console.error('🔧 Extension context invalidated - cleaning up crouton');
            // Removed crouton feedback notification
            cleanupCrouton();
          }
        } else {
          console.log(`✅ Direct message sent for ${action}`);
          if (response && response.success) {
            console.log(`✅ Background script confirmed action: ${action}`);
          }
        }
      });
    } catch (msgError) {
      console.error('Message sending failed:', msgError.message);
      if (msgError.message.includes('Extension context invalidated') ||
          msgError.message.includes('message port closed') ||
          msgError.message.includes('receiving end does not exist')) {
        console.error('🔧 Extension context invalidated - cleaning up crouton');
        // Removed crouton feedback notification
        cleanupCrouton();
      }
    }
    
    // Remove all visual feedback to prevent white background/border issues
    // No feedback needed for any actions - completely silent operation
    
  } catch (error) {
    console.error('Failed to process action:', error);
    
    // Show user-friendly error
    if (error.message.includes('Extension context invalidated')) {
      // Removed crouton feedback notification
    } else {
      // Removed crouton feedback notification
    }
  }
}

// Update progress bar with current testing stats
function updateProgressBar(data) {
  console.log('🔄 updateProgressBar called with data:', data);
  
  if (!croutonContainer || !data.testingMerchants) {
    console.log('❌ updateProgressBar early return - no container or testingMerchants');
    return;
  }
  
  const progressFill = croutonContainer.querySelector('#crouton-progress-fill');
  const progressText = croutonContainer.querySelector('#crouton-progress-text');
  const successfulCount = croutonContainer.querySelector('#crouton-successful-count');
  const flaggedCount = croutonContainer.querySelector('#crouton-flagged-count');
  const totalCount = croutonContainer.querySelector('#crouton-total-count');
  
  console.log('🔄 Progress bar elements found:', {
    progressFill: !!progressFill,
    progressText: !!progressText,
    successfulCount: !!successfulCount,
    flaggedCount: !!flaggedCount
  });
  
  // Get the most recent merchant statuses from extension storage (force fresh retrieval)
  console.log('🔍 Getting fresh merchant statuses from storage...');
  chrome.storage.local.get(['extensionState'], (result) => {
    const state = result.extensionState;
    const merchantStatuses = state?.merchantStatuses || {};
    
    console.log('📊 Progress bar update - merchant statuses from storage:', merchantStatuses);
    console.log('📊 Progress bar update - current crouton data:', data);
    
    // Count successful and flagged merchants
    let successfulMerchants = 0;
    let flaggedMerchants = 0;
    const totalMerchants = data.testingMerchants.length;
    
    data.testingMerchants.forEach((merchant, index) => {
      const merchantKey = merchant.name.toLowerCase();
      const status = merchantStatuses[merchantKey];
      
      console.log(`📊 [${index+1}/${totalMerchants}] Checking merchant "${merchant.name}" (key: "${merchantKey}"): status = "${status}"`);
      
      if (status === 'successful') {
        successfulMerchants++;
        console.log(`  ✅ Counted as successful (total now: ${successfulMerchants})`);
      } else if (status === 'flagged') {
        flaggedMerchants++;
        console.log(`  🚩 Counted as flagged (total now: ${flaggedMerchants})`);
      } else {
        console.log(`  ⚪ No status or unknown status`);
      }
    });
    
    console.log('📊 FINAL COUNTS:', {
      successful: successfulMerchants,
      flagged: flaggedMerchants,
      total: totalMerchants
    });
    
    // Calculate progress percentage
    const completedMerchants = successfulMerchants + flaggedMerchants;
    const progressPercentage = totalMerchants > 0 ? Math.round((completedMerchants / totalMerchants) * 100) : 0;
    
    console.log('📊 PROGRESS CALCULATION:', {
      completed: completedMerchants,
      percentage: progressPercentage
    });
    
    // Update progress bar with enhanced visual feedback
    if (progressFill) {
      // Force a visual update by briefly changing the width
      progressFill.style.width = '0%';
      progressFill.style.transition = 'none';
      
      // Use requestAnimationFrame to ensure the DOM update happens
      requestAnimationFrame(() => {
        // Force important styles to ensure visibility
        progressFill.style.setProperty('transition', 'width 0.5s ease-out', 'important');
        progressFill.style.setProperty('width', `${progressPercentage}%`, 'important');
        progressFill.style.setProperty('background', 'linear-gradient(90deg, #27ae60 0%, #2ecc71 100%)', 'important');
        progressFill.style.setProperty('height', '100%', 'important');
        progressFill.style.setProperty('position', 'absolute', 'important');
        progressFill.style.setProperty('top', '0', 'important');
        progressFill.style.setProperty('left', '0', 'important');
        progressFill.style.setProperty('z-index', '1', 'important');
        
        // Ensure minimum width for visibility
        if (progressPercentage > 0 && progressPercentage < 5) {
          progressFill.style.setProperty('min-width', '8px', 'important');
        }
        
        // Add a subtle glow effect when progress increases
        if (progressPercentage > 0) {
          progressFill.style.setProperty('box-shadow', '0 0 10px rgba(39, 174, 96, 0.3)', 'important');
          setTimeout(() => {
            progressFill.style.setProperty('box-shadow', '', 'important');
          }, 1000);
        }
        
        console.log('📊 Enhanced progress bar update - width set to:', `${progressPercentage}%`);
        console.log('📊 Progress fill element styles:', {
          width: progressFill.style.width,
          background: progressFill.style.background,
          height: progressFill.style.height,
          position: progressFill.style.position,
          zIndex: progressFill.style.zIndex,
          display: getComputedStyle(progressFill).display,
          visibility: getComputedStyle(progressFill).visibility
        });
      });
    } else {
      console.log('❌ Progress fill element not found');
    }
    
    if (progressText) {
      progressText.textContent = `${progressPercentage}% Complete`;
      console.log('📊 Set progress text to:', `${progressPercentage}% Complete`);
    } else {
      console.log('❌ Progress text element not found');
    }
    
    // Update stats with enhanced logging
    if (successfulCount) {
      const previousValue = successfulCount.textContent;
      successfulCount.textContent = successfulMerchants;
      console.log(`📊 Updated successful count: ${previousValue} → ${successfulMerchants}`);
    } else {
      console.log('❌ Successful count element not found');
    }
    
    if (flaggedCount) {
      const previousValue = flaggedCount.textContent;
      flaggedCount.textContent = flaggedMerchants;
      console.log(`📊 Updated flagged count: ${previousValue} → ${flaggedMerchants}`);
    } else {
      console.log('❌ Flagged count element not found');
    }
    
    if (totalCount) {
      const previousValue = totalCount.textContent;
      totalCount.textContent = totalMerchants;
      console.log(`📊 Updated total count: ${previousValue} → ${totalMerchants}`);
    } else {
      console.log('❌ Total count element not found');
    }
    
    console.log('📊 Progress bar updated:', {
      successful: successfulMerchants,
      flagged: flaggedMerchants,
      total: totalMerchants,
      percentage: progressPercentage
    });
  });
}

// Update progress bar locally and immediately (without waiting for storage)
async function updateProgressBarLocally(actionType) {
  console.log(`🔄 updateProgressBarLocally: ${actionType}`);
  
  if (!croutonContainer || !croutonData || !croutonData.testingMerchants) {
    console.log('❌ updateProgressBarLocally: missing data');
    return;
  }
  
  const progressFill = croutonContainer.querySelector('#crouton-progress-fill');
  const progressText = croutonContainer.querySelector('#crouton-progress-text');
  const successfulCount = croutonContainer.querySelector('#crouton-successful-count');
  const flaggedCount = croutonContainer.querySelector('#crouton-flagged-count');
  const totalCount = croutonContainer.querySelector('#crouton-total-count');
  
  if (!progressFill || !progressText || !successfulCount || !flaggedCount || !totalCount) {
    console.log('⚠️ Progress bar elements not found - trying DOM refresh');
    
    if (croutonData) {
      updateCroutonData(croutonData);
      
      // Re-query for elements after refresh
      progressFill = croutonContainer.querySelector('#crouton-progress-fill');
      progressText = croutonContainer.querySelector('#crouton-progress-text');
      successfulCount = croutonContainer.querySelector('#crouton-successful-count');
      flaggedCount = croutonContainer.querySelector('#crouton-flagged-count');
      totalCount = croutonContainer.querySelector('#crouton-total-count');
      
      if (!progressFill || !progressText || !successfulCount || !flaggedCount || !totalCount) {
        console.log('❌ Progress bar elements still not found after refresh');
        return;
      }
      
      console.log('✅ Found progress bar elements after refresh');
    } else {
      console.log('❌ No croutonData for refresh');
      return;
    }
  }
  
  // Get current counts from storage instead of DOM to avoid reset issues
  let currentSuccessful = 0;
  let currentFlagged = 0;
  const totalMerchants = croutonData.testingMerchants.length;
  
  // Get fresh counts from storage
  try {
    const result = await chrome.storage.local.get(['extensionState']);
    const merchantStatuses = result.extensionState?.merchantStatuses || {};
    
    // Count current successful and flagged merchants from storage
    croutonData.testingMerchants.forEach((merchant) => {
      const merchantKey = merchant.name.toLowerCase();
      const status = merchantStatuses[merchantKey];
      
      if (status === 'successful' || status === 'tested') {
        currentSuccessful++;
      } else if (status === 'flagged') {
        currentFlagged++;
      }
    });
    
    console.log(`📊 Storage-based counts before action: ${currentSuccessful}✅ ${currentFlagged}🚩`);
    
    // Apply the new action
    if (actionType === 'successful') {
      currentSuccessful++;
      console.log(`📊 Incremented successful count to: ${currentSuccessful}`);
    } else if (actionType === 'flagged') {
      currentFlagged++;
      console.log(`📊 Incremented flagged count to: ${currentFlagged}`);
    }
  } catch (error) {
    console.error('❌ Error getting storage counts, falling back to DOM:', error);
    // Fallback to DOM values if storage fails
    currentSuccessful = parseInt(successfulCount.textContent) || 0;
    currentFlagged = parseInt(flaggedCount.textContent) || 0;
    
    if (actionType === 'successful') {
      currentSuccessful++;
    } else if (actionType === 'flagged') {
      currentFlagged++;
    }
  }
  
  // Calculate and update progress
  const completedMerchants = currentSuccessful + currentFlagged;
  const progressPercentage = totalMerchants > 0 ? Math.round((completedMerchants / totalMerchants) * 100) : 0;
  
  // Enhanced progress bar update with visual feedback
  const currentWidth = parseInt(progressFill.style.width) || 0;
  
  // Force important styles to ensure visibility
  progressFill.style.setProperty('transition', 'width 0.5s ease-out', 'important');
  progressFill.style.setProperty('width', `${progressPercentage}%`, 'important');
  progressFill.style.setProperty('background', 'linear-gradient(90deg, #27ae60 0%, #2ecc71 100%)', 'important');
  progressFill.style.setProperty('height', '100%', 'important');
  progressFill.style.setProperty('position', 'absolute', 'important');
  progressFill.style.setProperty('z-index', '1', 'important');
  
  // Ensure minimum width for visibility
  if (progressPercentage > 0 && progressPercentage < 5) {
    progressFill.style.setProperty('min-width', '8px', 'important');
  }
  
  // Add visual feedback for progress increase
  if (progressPercentage > currentWidth) {
    progressFill.style.setProperty('box-shadow', '0 0 15px rgba(39, 174, 96, 0.5)', 'important');
    setTimeout(() => {
      progressFill.style.setProperty('box-shadow', '', 'important');
    }, 1000);
    console.log(`📈 Progress increased from ${currentWidth}% to ${progressPercentage}%`);
  }
  
  progressText.textContent = `${progressPercentage}% Complete`;
  
  // Update counters with logging
  const prevSuccessful = successfulCount.textContent;
  const prevFlagged = flaggedCount.textContent;
  const prevTotal = totalCount.textContent;
  
  successfulCount.textContent = currentSuccessful;
  flaggedCount.textContent = currentFlagged;
  totalCount.textContent = totalMerchants;
  
  console.log(`✅ Local progress updated: ${currentSuccessful}✅ ${currentFlagged}🚩 (${progressPercentage}%)`);
  console.log(`📊 Counter changes: ✅${prevSuccessful}→${currentSuccessful} 🚩${prevFlagged}→${currentFlagged} 📊${prevTotal}→${totalMerchants}`);
  console.log('📊 Progress fill styles:', {
    width: progressFill.style.width,
    transition: progressFill.style.transition,
    boxShadow: progressFill.style.boxShadow
  });
}

// Force refresh progress bar by getting fresh data from storage
function forceRefreshProgress() {
  if (!croutonContainer || !croutonData || !croutonData.testingMerchants) {
    console.log('⚠️ forceRefreshProgress: missing data');
    return;
  }
  
  // Get fresh merchant statuses from storage and update progress bar
  chrome.storage.local.get(['extensionState'], (result) => {
    const state = result.extensionState;
    const merchantStatuses = state?.merchantStatuses || {};
    
    const progressFill = croutonContainer.querySelector('#crouton-progress-fill');
    const progressText = croutonContainer.querySelector('#crouton-progress-text');
    const successfulCount = croutonContainer.querySelector('#crouton-successful-count');
    const flaggedCount = croutonContainer.querySelector('#crouton-flagged-count');
    const totalCount = croutonContainer.querySelector('#crouton-total-count');
    
    if (!progressFill || !progressText || !successfulCount || !flaggedCount || !totalCount) {
      console.log('⚠️ forceRefreshProgress: elements not found');
      return;
    }
    
    // Count successful and flagged merchants with fresh data
    let successfulMerchants = 0;
    let flaggedMerchants = 0;
    const totalMerchants = croutonData.testingMerchants.length;
    
    croutonData.testingMerchants.forEach((merchant) => {
      const merchantKey = merchant.name.toLowerCase();
      const status = merchantStatuses[merchantKey];
      
      if (status === 'successful' || status === 'tested') {
        successfulMerchants++;
      } else if (status === 'flagged') {
        flaggedMerchants++;
      }
    });
    
    // Calculate progress percentage
    const completedMerchants = successfulMerchants + flaggedMerchants;
    const progressPercentage = totalMerchants > 0 ? Math.round((completedMerchants / totalMerchants) * 100) : 0;
    
    // Update progress bar elements with enhanced visual feedback
    const currentWidth = parseInt(progressFill.style.width) || 0;
    
    // Force important styles to ensure visibility
    progressFill.style.setProperty('transition', 'width 0.5s ease-out', 'important');
    progressFill.style.setProperty('width', `${progressPercentage}%`, 'important');
    progressFill.style.setProperty('background', 'linear-gradient(90deg, #27ae60 0%, #2ecc71 100%)', 'important');
    progressFill.style.setProperty('height', '100%', 'important');
    progressFill.style.setProperty('position', 'absolute', 'important');
    progressFill.style.setProperty('z-index', '1', 'important');
    
    // Ensure minimum width for visibility
    if (progressPercentage > 0 && progressPercentage < 5) {
      progressFill.style.setProperty('min-width', '8px', 'important');
    }
    
    // Add visual feedback for progress changes
    if (progressPercentage !== currentWidth) {
      progressFill.style.setProperty('box-shadow', '0 0 12px rgba(39, 174, 96, 0.4)', 'important');
      setTimeout(() => {
        progressFill.style.setProperty('box-shadow', '', 'important');
      }, 800);
      console.log(`📊 Storage refresh - progress changed from ${currentWidth}% to ${progressPercentage}%`);
    }
    
    progressText.textContent = `${progressPercentage}% Complete`;
    
    // Update counters with logging
    const prevSuccessful = successfulCount.textContent;
    const prevFlagged = flaggedCount.textContent;
    const prevTotal = totalCount.textContent;
    
    successfulCount.textContent = successfulMerchants;
    flaggedCount.textContent = flaggedMerchants;
    totalCount.textContent = totalMerchants;
    
    console.log(`✅ Storage refresh: ${successfulMerchants}✅ ${flaggedMerchants}🚩 (${progressPercentage}%)`);
    console.log(`📊 Force refresh counter changes: ✅${prevSuccessful}→${successfulMerchants} 🚩${prevFlagged}→${flaggedMerchants} 📊${prevTotal}→${totalMerchants}`);
    console.log('📊 Force refresh progress styles:', {
      width: progressFill.style.width,
      transition: progressFill.style.transition
    });
  });
}

// Find best merchant match with improved search logic
function findBestMerchantMatch(merchants, searchTerm) {
  const term = searchTerm.toLowerCase().trim();
  
  // Score-based matching system
  const scoredMatches = merchants.map((merchant, index) => {
    let score = 0;
    const name = merchant.name.toLowerCase();
    let domain = '';
    
    // Extract domain from URL
    try {
      if (merchant.url) {
        const url = new URL(merchant.url);
        domain = url.hostname.replace(/^www\./, '').toLowerCase();
      }
    } catch (e) {
      // Invalid URL, skip domain matching
    }
    
    // Scoring system (higher score = better match)
    
    // 1. Exact domain match (highest priority)
    if (domain && (term === domain || term.includes(domain) || domain.includes(term))) {
      // Check if search term looks like a domain
      if (term.includes('.')) {
        const searchDomain = term.replace(/^www\./, '').replace(/^https?:\/\//, '').split('/')[0];
        if (searchDomain === domain) {
          score += 1000; // Perfect domain match
        } else if (searchDomain.includes(domain) || domain.includes(searchDomain)) {
          score += 800; // Partial domain match
        }
      } else {
        // Search term is not a domain, but matches domain
        score += 600;
      }
    }
    
    // 2. Exact name match
    if (name === term) {
      score += 500;
    }
    
    // 3. Name starts with search term
    if (name.startsWith(term)) {
      score += 300;
    }
    
    // 4. Name contains search term
    if (name.includes(term)) {
      score += 100;
    }
    
    // 5. Search term contains name (very strict to avoid false positives like "mooglasses" matching "OGL")
    if (term.includes(name) && name.length >= 4 && name.length >= term.length * 0.4) {
      // Only if the name is a significant portion of the search term
      score += 50;
    }
    
    console.log(`🔍 Scoring "${merchant.name}" (${domain}): ${score} points`);
    
    return { merchant, index, score };
  });
  
  // Sort by score (highest first) and return the best match index
  const bestMatch = scoredMatches
    .filter(match => match.score > 0)
    .sort((a, b) => b.score - a.score)[0];
  
  if (bestMatch) {
    console.log(`🎯 Best match: "${bestMatch.merchant.name}" with score ${bestMatch.score}`);
    return bestMatch.index;
  }
  
  console.log(`❌ No matches found for "${searchTerm}"`);
  console.log(`🔍 Search term analysis:`);
  console.log(`  - Length: ${term.length}`);
  console.log(`  - Contains dot: ${term.includes('.')}`);
  console.log(`  - Looks like domain: ${term.includes('.') ? 'Yes' : 'No'}`);
  
  // Show top 3 scored merchants for debugging
  const topScored = scoredMatches
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  console.log(`🔍 Top 3 scored merchants:`, topScored.map(m => `${m.merchant.name}: ${m.score} points`));
  
  return -1;
}

// Show visual feedback for button clicks
function showCroutonFeedback(message, type = 'info') {
  try {
    console.log(`🎨 showCroutonFeedback called: "${message}" (${type})`);
    console.log(`🎨 croutonContainer exists:`, !!croutonContainer);
    
    if (!croutonContainer) {
      console.error(`🎨 No croutonContainer available for feedback`);
      return;
    }
  
  // Create or update feedback toast
  let feedbackEl = croutonContainer?.querySelector('.crouton-feedback-toast');
  console.log(`🎨 Existing feedback element:`, !!feedbackEl);
  
  if (!feedbackEl) {
    feedbackEl = document.createElement('div');
    feedbackEl.className = 'crouton-feedback-toast';
    croutonContainer?.appendChild(feedbackEl);
    console.log(`🎨 Created new feedback element`);
  }
  
  // Set message and type
  feedbackEl.textContent = message;
  feedbackEl.className = `crouton-feedback-toast crouton-feedback-${type}`;
  console.log(`🎨 Set feedback class:`, feedbackEl.className);
  
  // Show with animation
  feedbackEl.style.display = 'block';
  feedbackEl.style.opacity = '0';
  feedbackEl.style.transform = 'translateX(-50%) translateY(10px)'; // Keep centered position
  console.log(`🎨 Showing feedback with animation`);
  // Safe debugging without getComputedStyle
  console.log(`🎨 Toast element styles:`, {
    display: feedbackEl.style.display,
    opacity: feedbackEl.style.opacity,
    transform: feedbackEl.style.transform,
    className: feedbackEl.className,
    textContent: feedbackEl.textContent
  });
  
  // Try to get computed styles safely
  try {
    const computed = getComputedStyle(feedbackEl);
    console.log(`🎨 Toast computed styles:`, {
      position: computed.position,
      zIndex: computed.zIndex,
      visibility: computed.visibility
    });
  } catch (error) {
    console.log(`🎨 Could not get computed styles:`, error.message);
  }
  
  requestAnimationFrame(() => {
    feedbackEl.style.transition = 'all 0.3s ease-out';
    feedbackEl.style.opacity = '1';
    feedbackEl.style.transform = 'translateX(-50%) translateY(0)'; // Keep centered position
    console.log(`🎨 Feedback animation started`);
    console.log(`🎨 Toast element after animation:`, {
      opacity: feedbackEl.style.opacity,
      transform: feedbackEl.style.transform
    });
    
    // Safe computed style check
    try {
      const computed = getComputedStyle(feedbackEl);
      console.log(`🎨 Toast final computed:`, {
        computedOpacity: computed.opacity,
        computedDisplay: computed.display
      });
    } catch (error) {
      console.log(`🎨 Could not get final computed styles:`, error.message);
    }
  });
  
  // Hide after longer delay to match improved animations
  setTimeout(() => {
    feedbackEl.style.transition = 'all 0.4s ease-in';
    feedbackEl.style.opacity = '0';
    feedbackEl.style.transform = 'translateX(-50%) translateY(-10px)'; // Keep centered position
    
    setTimeout(() => {
      feedbackEl.style.display = 'none';
    }, 400);
  }, 4000);
  
  } catch (error) {
    console.error(`🎨 Error in showCroutonFeedback:`, error);
    console.error(`🎨 Error stack:`, error.stack);
    
    // Fallback: try simple text display
    try {
      if (croutonContainer) {
        const simpleMsg = document.createElement('div');
        simpleMsg.textContent = message;
        simpleMsg.style.cssText = `
          position: absolute;
          bottom: -40px;
          left: 50%;
          transform: translateX(-50%);
          background: #333;
          color: white;
          padding: 5px 10px;
          border-radius: 5px;
          font-size: 12px;
          z-index: 999999;
        `;
        croutonContainer.appendChild(simpleMsg);
        setTimeout(() => simpleMsg.remove(), 3000);
      }
    } catch (fallbackError) {
      console.error(`🎨 Fallback feedback also failed:`, fallbackError);
    }
  }
  
  // Legacy support for action-based feedback
  const actionMap = {
    'previousMerchant': '⬅️ Previous',
    'nextMerchant': '➡️ Next', 
    'flagMerchant': '🚩 Marked Flagged',
    'successMerchant': '✅ Marked Successful',
    'skipMerchant': '⏭️ Skipped'
  };
  
  if (actionMap[message]) {
    // Skip showing alert feedback for flag and success actions
    if (message === 'successMerchant' || message === 'flagMerchant') {
      console.log('🚫 Skipping alert feedback for flag/success actions');
      return;
    }
    
    // Use appropriate feedback type based on action
    let feedbackType = 'info';
    
    // Removed crouton feedback notification
  }
}


// Inject CSS styles for the crouton
function injectCroutonStyles() {
  console.log('🎨 Checking if crouton styles already exist...');
  if (document.getElementById('citishop-crouton-styles')) {
    console.log('🎨 Crouton styles already exist, skipping injection');
    return;
  }
  
  console.log('🎨 Injecting crouton styles...');
  
  const styles = document.createElement('style');
  styles.id = 'citishop-crouton-styles';
  styles.textContent = `
    /* Basic CSS protection for crouton elements */
    #citishop-floating-crouton,
    #citishop-floating-crouton * {
      box-sizing: border-box !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    
    /* Force crouton above all website content with maximum z-index */
    #citishop-floating-crouton {
      display: block !important;
      z-index: 2147483647 !important;
      position: fixed !important;
      isolation: isolate !important;
      pointer-events: auto !important;
      /* Create new stacking context */
      transform: translateZ(0) !important;
      will-change: transform !important;
      opacity: 1 !important;
      visibility: visible !important;
    }

    .citishop-crouton-container {
      position: fixed !important;
      z-index: 2147483647 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 14px !important;
      cursor: grab !important;
      user-select: none !important;
      pointer-events: auto !important;
      isolation: isolate !important;
      transform: translateZ(0) !important;
      will-change: transform !important;
    }
    
    /* Position variants */
    .citishop-crouton-container.position-bottom-right {
      bottom: 20px !important;
      right: 20px !important;
    }
    
    .citishop-crouton-container.position-bottom-left {
      bottom: 20px !important;
      left: 20px !important;
    }
    
    .citishop-crouton-container.position-top-right {
      top: 20px !important;
      right: 20px !important;
    }
    
    .citishop-crouton-container.position-top-left {
      top: 20px !important;
      left: 20px !important;
    }
    
    .citishop-crouton-container.position-middle-left {
      top: calc(50% - 100px) !important;
      left: 20px !important;
      transform: translateY(-50%) !important;
    }
    
    /* Default fallback position (middle-left) */
    .citishop-crouton-container:not(.position-bottom-right):not(.position-bottom-left):not(.position-top-right):not(.position-top-left):not(.position-middle-left) {
      top: calc(50% - 100px) !important;
      left: 20px !important;
      transform: translateY(-50%) !important;
    }
    
    .citishop-crouton-container.minimized-only {
      background: transparent !important;
      background-color: transparent !important;
      border: none !important;
      box-shadow: none !important;
      border-radius: 0 !important;
    }
    
    /* Ensure only one view is visible at a time */
    .citishop-crouton-container:not(.minimized-only) .citishop-crouton-minimized {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
    }
    
    .citishop-crouton-container.minimized-only .citishop-crouton-expanded {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
    }
    
    /* Responsive adjustments for small screens */
    @media (max-height: 600px) {
      .citishop-crouton-expanded {
        max-height: 70vh;
        min-height: 220px;
      }
      
      .crouton-content {
        max-height: calc(70vh - 40px);
      }
    }
    
    @media (max-width: 480px) {
      .citishop-crouton-container {
        left: 10px !important;
      }
      
      .citishop-crouton-expanded {
        width: calc(100vw - 40px);
        max-width: 260px;
      }
    }
    
    .citishop-crouton-minimized {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
      color: white !important;
      padding: 5px 10px !important;
      border-radius: 14px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 8px !important;
      box-shadow: 0 2px 6px rgba(0,0,0,0.1) !important;
      cursor: grab !important;
      transition: all 0.2s ease !important;
      min-width: 90px !important;
      max-width: 140px !important;
      font-size: 12px !important;
      z-index: 2147483647 !important;
      position: relative !important;
      transform: translateZ(0) !important;
      isolation: isolate !important;
    }
    
    .citishop-crouton-minimized:hover {
      transform: scale(1.03);
      box-shadow: 0 4px 12px rgba(0,0,0,0.18);
    }
    
    .crouton-icon {
      font-size: 12px;
    }
    
    .crouton-text {
      font-weight: 500;
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 90px;
      min-width: 50px;
      font-size: 12px;
      margin-right: 6px;
    }
    
    .crouton-expand {
      font-size: 10px;
      opacity: 0.8;
      flex-shrink: 0;
      margin-left: 4px;
    }
    
    .citishop-crouton-expanded {
      background: white !important;
      border-radius: 8px !important;
      box-shadow: 0 4px 16px rgba(0,0,0,0.1) !important;
      border: 1px solid #e1e5e9 !important;
      overflow: hidden !important;
      width: 280px !important;
      max-height: 80vh !important;
      height: auto !important;
      min-height: 260px !important;
      display: flex !important;
      flex-direction: column !important;
      z-index: 2147483647 !important;
      position: relative !important;
      transform: translateZ(0) !important;
      isolation: isolate !important;
    }
    
    .crouton-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 6px 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: relative;
      flex-shrink: 0;
    }
    
    .crouton-title-section {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex: 1;
      gap: 6px;
    }
    
    .crouton-title {
      font-weight: 600;
      font-size: 11px;
      line-height: 1;
    }
    
    .crouton-subtitle {
      font-size: 10px;
      opacity: 0.9;
      font-weight: 500;
      line-height: 1;
      letter-spacing: 0.2px;
      white-space: nowrap;
      margin-left: -15px;
    }
    
    .crouton-minimize {
      background: rgba(255,255,255,0.2);
      border: none;
      color: white;
      border-radius: 4px;
      padding: 3px 6px;
      cursor: pointer;
      font-size: 11px;
    }
    
    .crouton-minimize:hover {
      background: rgba(255,255,255,0.3);
    }
    
    .crouton-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      overflow-x: hidden;
      max-height: calc(80vh - 40px);
    }
    
    .crouton-content::-webkit-scrollbar {
      width: 6px;
    }
    
    .crouton-content::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 3px;
    }
    
    .crouton-content::-webkit-scrollbar-thumb {
      background: #c1c1c1;
      border-radius: 3px;
    }
    
    .crouton-content::-webkit-scrollbar-thumb:hover {
      background: #a8a8a8;
    }
    
    .crouton-merchant-info {
      padding: 6px 10px;
      border-bottom: 1px solid #f0f0f0;
      flex-shrink: 0;
      min-height: 0;
    }
    
    .crouton-merchant-name {
      font-weight: 600;
      font-size: 13px;
      color: #2c3e50;
      margin-bottom: 2px;
    }
    
    .crouton-merchant-url {
      color: #666;
      font-size: 10px;
      margin-bottom: 4px;
      word-break: break-all;
    }
    
    .crouton-progress {
      color: #3498db;
      font-weight: 500;
      font-size: 11px;
    }
    
    .crouton-controls, .crouton-actions {
      padding: 6px 10px;
      display: flex;
      gap: 6px;
      flex-shrink: 0;
      min-height: 0;
    }
    
    .crouton-actions {
      border-top: 1px solid #f0f0f0;
      padding-top: 6px;
    }
    
    .crouton-search {
      padding: 6px 10px;
      border-top: 1px solid #f0f0f0;
      display: flex !important;
      gap: 6px !important;
      align-items: center !important;
      flex-shrink: 0 !important;
      min-height: 0 !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }
    
    .crouton-search-container {
      flex: 1 !important;
      position: relative !important;
      min-width: 0 !important;
      max-width: calc(100% - 35px) !important;
    }
    
    .crouton-search-input {
      width: 100%;
      padding: 4px 6px;
      border: 1px solid #ddd;
      border-radius: 3px;
      font-size: 10px;
      outline: none;
    }
    
    .crouton-search-input:focus {
      border-color: #3498db;
      box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
    }
    
    .crouton-search-btn {
      flex-shrink: 0 !important;
      min-width: 28px !important;
      max-width: 32px !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      padding: 4px 6px !important;
    }
    
    .crouton-autocomplete {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border: 1px solid #ddd;
      border-top: none;
      border-radius: 0 0 4px 4px;
      max-height: 120px;
      overflow-y: auto;
      z-index: 999999;
      display: none;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    
    .crouton-autocomplete-item {
      padding: 6px 8px;
      cursor: pointer;
      border-bottom: 1px solid #f0f0f0;
      font-size: 11px;
      transition: background-color 0.2s ease;
    }
    
    .crouton-autocomplete-item:last-child {
      border-bottom: none;
    }
    
    .crouton-autocomplete-item:hover,
    .crouton-autocomplete-item.selected {
      background-color: #f8f9fa;
    }
    
    .crouton-autocomplete-item.selected {
      background-color: #e3f2fd;
    }
    
    .crouton-autocomplete-match {
      background-color: #ffeb3b;
      font-weight: bold;
    }
    
    .autocomplete-domain {
      color: #666;
      font-size: 10px;
      font-weight: normal;
      opacity: 0.8;
    }
    
    .crouton-copy-actions {
      padding: 6px 10px;
      border-top: 1px solid #f0f0f0;
      display: flex;
      gap: 6px;
      flex-shrink: 0;
      min-height: 0;
    }
    
    .crouton-btn {
      border: none;
      border-radius: 4px;
      padding: 5px 8px;
      font-size: 10px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      flex: 1;
      background: #f8f9fa;
      color: #495057;
      position: relative;
      overflow: hidden;
    }
    
    .crouton-btn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    
    .crouton-btn:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: 0 1px 4px rgba(0,0,0,0.1);
    }
    
    /* Enhanced visual states for flagged and successful buttons */
    .crouton-btn.flagged-state {
      background: #e74c3c !important;
      color: white !important;
      border: 2px solid #c0392b !important;
      box-shadow: 0 0 10px rgba(231, 76, 60, 0.4) !important;
      transition: all 0.3s ease;
    }
    
    .crouton-btn.successful-state {
      background: #27ae60 !important;
      color: white !important;
      border: 2px solid #229954 !important;
      box-shadow: 0 0 10px rgba(39, 174, 96, 0.4) !important;
      transition: all 0.3s ease;
    }
    
    .crouton-btn.flagged-state:hover:not(:disabled) {
      background: #c0392b !important;
      transform: translateY(-1px) scale(1.02);
      box-shadow: 0 0 15px rgba(231, 76, 60, 0.6) !important;
    }
    
    .crouton-btn.successful-state:hover:not(:disabled) {
      background: #229954 !important;
      transform: translateY(-1px) scale(1.02);
      box-shadow: 0 0 15px rgba(39, 174, 96, 0.6) !important;
    }
    
    .crouton-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    /* Feedback toast styles */
    .crouton-feedback-toast {
      position: absolute;
      bottom: -60px;
      left: 50%;
      transform: translateX(-50%);
      padding: 10px 18px;
      border-radius: 25px;
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
      z-index: 999999 !important;
      display: none;
      box-shadow: 0 6px 20px rgba(0,0,0,0.25) !important;
      backdrop-filter: blur(10px);
      border: 2px solid rgba(255,255,255,0.2) !important;
      pointer-events: none;
      min-width: 120px;
      text-align: center;
    }
    
    .crouton-feedback-success {
      background: #27ae60 !important;
      color: white !important;
      border-color: #2ecc71 !important;
    }
    
    .crouton-feedback-error {
      background: #e74c3c !important;
      color: white !important;
      border-color: #f39c12 !important;
    }
    
    .crouton-feedback-warning {
      background: #f39c12 !important;
      color: white !important;
      border-color: #e67e22 !important;
    }
    
    .crouton-feedback-info {
      background: #3498db !important;
      color: white !important;
      border-color: #5dade2 !important;
    }
    
    /* Pulse animation for loading states */
    @keyframes crouton-pulse {
      0% { opacity: 1; }
      50% { opacity: 0.7; }
      100% { opacity: 1; }
    }
    
    .crouton-btn-loading {
      animation: crouton-pulse 1.5s ease-in-out infinite;
    }
    
    /* Progress bar styles */
    .crouton-progress-bar {
      padding: 6px 10px;
      border-top: 1px solid #f0f0f0;
      background: #fafafa;
      flex-shrink: 0;
    }
    
    .progress-bar-container {
      position: relative;
      background: #e0e0e0 !important;
      border-radius: 6px !important;
      height: 16px !important;
      margin-bottom: 4px;
      overflow: hidden !important;
      border: 1px solid #ccc !important;
    }
    
    .progress-bar-fill {
      height: 100% !important;
      background: linear-gradient(90deg, #27ae60 0%, #2ecc71 100%) !important;
      border-radius: 6px !important;
      transition: width 0.5s ease-out !important;
      width: 0% !important;
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      z-index: 1 !important;
      min-width: 2px !important;
    }
    
    .progress-bar-text {
      position: absolute !important;
      top: 50% !important;
      left: 50% !important;
      transform: translate(-50%, -50%) !important;
      font-size: 9px !important;
      font-weight: 600 !important;
      color: #333 !important;
      text-shadow: 0 1px 2px rgba(255,255,255,0.9) !important;
      pointer-events: none !important;
      z-index: 2 !important;
      white-space: nowrap !important;
    }
    
    .progress-stats {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
    }
    
    .stat-item {
      display: flex;
      align-items: center;
      gap: 2px;
      font-weight: 500;
    }
    
    .stat-icon {
      font-size: 11px;
    }
    
    .crouton-btn-primary {
      background: #3498db;
      color: white;
    }
    
    .crouton-btn-primary:hover:not(:disabled) {
      background: #2980b9;
    }
    
    .crouton-btn-secondary {
      background: #ecf0f1;
      color: #2c3e50;
    }
    
    .crouton-btn-secondary:hover:not(:disabled) {
      background: #d5dbdb;
    }
    
    .crouton-btn-warning {
      background: #f39c12;
      color: white;
    }
    
    .crouton-btn-warning:hover:not(:disabled) {
      background: #e67e22;
    }
    
    .crouton-btn-tertiary {
      background: #95a5a6;
      color: white;
    }
    
    .crouton-btn-tertiary:hover:not(:disabled) {
      background: #7f8c8d;
    }
    
    .crouton-status {
      padding: 6px 10px;
      background: #f8f9fa;
      color: #666;
      font-size: 10px;
      text-align: center;
      border-top: 1px solid #f0f0f0;
    }
  `;
  
  document.head.appendChild(styles);
  
  // Update any existing crouton search layouts immediately
  const existingCrouton = document.getElementById('citishop-floating-crouton');
  if (existingCrouton) {
    const tempContainer = croutonContainer;
    croutonContainer = existingCrouton;
    updateSearchLayout();
    croutonContainer = tempContainer;
  }
}

// Remove the floating crouton
function removeFloatingCrouton() {
  // Stop periodic status sync
  stopPeriodicSync();
  
  if (croutonContainer) {
    croutonContainer.remove();
    croutonContainer = null;
    croutonData = null;
    isExpanded = false;
  }
  
  // Clean up portal container if empty
  const portalContainer = document.getElementById('citishop-portal-container');
  if (portalContainer && portalContainer.children.length === 0) {
    portalContainer.remove();
  }
  
  const styles = document.getElementById('citishop-crouton-styles');
  if (styles) {
    styles.remove();
  }
  
  console.log('✅ Floating crouton removed');
}

// Duplicate function and calls removed - using the main checkForActiveTestingOnLoad function above

// Listen for messages from extension
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  console.log('📨 Content script received message:', message);
  console.log('📨 Message sender:', sender);
  
  switch (message.action) {
    case 'showFloatingCrouton':
      console.log('🔄 Processing showFloatingCrouton message');
      console.log('🔄 Message data:', message.data);
      
      try {
        await createFloatingCrouton(message.data);
        console.log('✅ Successfully created crouton from message');
        sendResponse({ success: true });
      } catch (error) {
        console.error('❌ Error creating crouton from message:', error);
        sendResponse({ success: false, error: error.message });
      }
      break;
      
    case 'updateFloatingCrouton':
      await updateCroutonData(message.data);
      sendResponse({ success: true });
      break;
      
    case 'updateCroutonPosition':
      console.log('🎯 Updating crouton position to:', message.position);
      if (croutonContainer) {
        // Remove existing position classes
        croutonContainer.classList.remove(
          'position-bottom-right',
          'position-bottom-left', 
          'position-top-right',
          'position-top-left',
          'position-middle-left'
        );
        // Add new position class
        croutonContainer.classList.add(`position-${message.position}`);
        console.log('✅ Crouton position updated to:', message.position);
      }
      sendResponse({ success: true });
      break;
      
    case 'hideFloatingCrouton':
      removeFloatingCrouton();
      sendResponse({ success: true });
      break;
      
    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
  
  return true; // Keep message channel open for async response
});

// Force crouton creation function for debugging
window.forceCreateCrouton = async function() {
  try {
    console.log('🧪 Force creating crouton...');
    
    // Create minimal test data
    const testData = {
      currentMerchant: { name: 'Test Merchant', url: 'https://example.com' },
      currentIndex: 0,
      totalMerchants: 1,
      testingMerchants: [{ name: 'Test Merchant', url: 'https://example.com' }],
      status: 'Force Test',
      merchantStatus: ''
    };
    
    await createFloatingCrouton(testData);
    console.log('✅ Force crouton creation attempted');
    
    // Check if it was created
    setTimeout(() => {
      const croutonElement = document.getElementById('citishop-floating-crouton');
      if (croutonElement) {
        console.log('✅ Force crouton created successfully');
        console.log('🔍 Crouton element:', croutonElement);
      } else {
        console.error('❌ Force crouton creation failed');
      }
    }, 1000);
  } catch (error) {
    console.error('❌ Force crouton creation failed:', error);
  }
};

console.log('🏪 CitiShop floating crouton script loaded');
