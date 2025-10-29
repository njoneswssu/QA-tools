// Floating Crouton Content Script for CitiShop Merchant Tester
// This script manages the floating crouton UI on merchant websites

let croutonContainer = null;
let croutonData = null;
let periodicSyncInterval = null; // Periodic status sync

// Scan all links on the page for merchant names or domains
function scanLinksForMerchants(testingMerchants) {
  // Get all links on the page
  const links = document.querySelectorAll('a[href]');
  
  for (const link of links) {
    const href = link.href;
    const text = link.textContent.trim();
    
    // Check if link text or URL contains any merchant name
    for (const merchant of testingMerchants) {
      const merchantName = merchant.name.toLowerCase();
      const linkText = text.toLowerCase();
      const url = href.toLowerCase();
      
      // Check if merchant name appears in link text or URL
      if (linkText.includes(merchantName) || url.includes(merchantName)) {
        return {
          found: true,
          merchant: merchant,
          link: link,
          matchType: linkText.includes(merchantName) ? 'text' : 'url'
        };
      }
    }
  }
  
  return { found: false };
}

// Check if current page matches any testing merchant
function checkCurrentPageMatch(testingMerchants) {
  const currentUrl = window.location.href.toLowerCase();
  
  for (const merchant of testingMerchants) {
    const merchantUrl = merchant.url.toLowerCase();
    const merchantDomain = new URL(merchantUrl).hostname;
    const currentDomain = new URL(currentUrl).hostname;
    
    // Check if current page matches merchant URL or domain
    if (currentUrl.includes(merchantUrl) || currentDomain === merchantDomain) {
      return {
        found: true,
        merchant: merchant,
        matchType: currentUrl.includes(merchantUrl) ? 'url' : 'domain'
      };
    }
  }
  
  return { found: false };
}

// Check for active testing on page load
async function checkForActiveTestingOnLoad() {
  try {
    const result = await chrome.storage.local.get(['extensionState']);
    const state = result.extensionState;
    
    if (state && state.testingControlsActive && state.testingMerchants && state.testingMerchants.length > 0) {
      // Check if current page matches any testing merchant
      const pageMatch = checkCurrentPageMatch(state.testingMerchants);
      
      if (pageMatch.found) {
        const croutonData = {
          currentMerchant: pageMatch.merchant,
          currentIndex: state.testingMerchants.findIndex(m => m.name === pageMatch.merchant.name),
          totalMerchants: state.testingMerchants.length,
          testingMerchants: state.testingMerchants,
          status: `Testing ${pageMatch.merchant.name}`,
          merchantStatus: state.merchantStatuses ? 
            state.merchantStatuses[`${pageMatch.merchant.name}|${pageMatch.merchant.url}`] || '' : ''
        };
        
        // Show crouton directly
        await createFloatingCrouton(croutonData);
        
        // Force expansion and progress update after creation with a delay to ensure DOM is ready
        setTimeout(() => {
          const croutonElement = document.getElementById('citishop-floating-crouton');
          if (croutonElement) {
            const isExpanded = croutonElement.classList.contains('citishop-crouton-expanded');
            if (!isExpanded) {
              croutonElement.classList.remove('citishop-crouton-minimized');
              croutonElement.classList.add('citishop-crouton-expanded');
              
              // Update toggle button state
              const toggleBtn = croutonElement.querySelector('#crouton-toggle-btn');
              if (toggleBtn) {
                toggleBtn.textContent = '−';
                toggleBtn.title = 'Minimize';
              }
            }
            
            // Update progress
            updateCroutonProgress();
          }
        }, 1000);
      } else {
        console.log('Current page does not match any testing merchants - crouton will not be shown');
        console.log('Current URL:', window.location.href);
        console.log('Available merchants:', state.testingMerchants.map(m => `${m.name}: ${m.url}`));
      }
    }
  } catch (error) {
    console.error('Error checking for active testing:', error);
  }
}

// Periodic check for active testing (fallback)
let periodicCheckCount = 0;
const periodicCheck = setInterval(() => {
  periodicCheckCount++;
  
  if (croutonContainer || periodicCheckCount >= 2) {
    clearInterval(periodicCheck);
    return;
  }
  
  checkForActiveTestingOnLoad();
}, 3000);

// Delayed check for slow-loading pages
setTimeout(() => {
  if (!croutonContainer) {
    checkForActiveTestingOnLoad();
  }
}, 5000);

// Check immediately if DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkForActiveTestingOnLoad);
} else {
  checkForActiveTestingOnLoad();
}

// Save collapse preference to storage
async function saveCollapsePreference(collapsed) {
  try {
    await chrome.storage.local.set({ croutonCollapsed: collapsed });
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
    if (existingCrouton && !croutonContainer) {
      // Sync the global variable if it's out of sync
      croutonContainer = existingCrouton;
    }
    // Update existing crouton
    await updateCroutonData(data);
    return;
  }
  
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
  
  // Create expanded state (full controls)
  const expandedView = document.createElement('div');
  expandedView.className = 'citishop-crouton-expanded';
  // Start expanded for testing - force hide minimized view
  expandedView.style.display = 'block';
  expandedView.style.visibility = 'visible';
  
  minimizedView.style.display = 'none !important';
  minimizedView.style.visibility = 'hidden';
  minimizedView.style.opacity = '0';
  
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
      <button class="crouton-btn crouton-btn-secondary" id="crouton-prev">← Previous</button>
      <button class="crouton-btn crouton-btn-secondary" id="crouton-next">Next →</button>
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
      <button id="crouton-search-btn" class="crouton-btn crouton-btn-primary">🔍 Go</button>
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
  
  // Update button states before setting up event listeners
  await updateCroutonButtons(data);
  
  // Add event listeners
  setupCroutonEventListeners();
  
  // Reset scroll position to top on initial load
  const croutonContent = croutonContainer.querySelector('.crouton-content');
  if (croutonContent) {
    croutonContent.scrollTop = 0;
  }
  
  // Ensure minimize button works on initial load
  setTimeout(() => {
    const minimizeBtn = croutonContainer.querySelector('.crouton-minimize');
    if (minimizeBtn) {
      // Remove any existing listeners and re-add
      const newMinimizeBtn = minimizeBtn.cloneNode(true);
      minimizeBtn.parentNode.replaceChild(newMinimizeBtn, minimizeBtn);
      newMinimizeBtn.addEventListener('click', async () => {
        await minimizeCrouton();
      });
    }
  }, 100);
  
  // Add click-to-close functionality for initial expanded state
  const initialExpandedView = croutonContainer.querySelector('.citishop-crouton-expanded');
  if (initialExpandedView && !initialExpandedView.hasAttribute('data-click-to-close')) {
    initialExpandedView.addEventListener('click', async (e) => {
      // Don't close if clicking on buttons or interactive elements
      if (e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.closest('input')) {
        return;
      }
      
      // Close the crouton
      await minimizeCrouton();
    });
    initialExpandedView.setAttribute('data-click-to-close', 'true');
  }
}

// Update crouton data
async function updateCroutonData(data) {
  croutonData = { ...data };
  
  if (!croutonContainer) return;
  
  // Update merchant info
  const merchantName = croutonContainer.querySelector('.crouton-merchant-name');
  const merchantUrl = croutonContainer.querySelector('.crouton-merchant-url');
  const progress = croutonContainer.querySelector('.crouton-progress');
  const status = croutonContainer.querySelector('.crouton-status');
  
  if (merchantName) {
    const cleanMerchantName = data.currentMerchant?.name ? data.currentMerchant.name.replace(/\\+$/, "'s") : 'Loading...';
    merchantName.textContent = cleanMerchantName;
  }
  
  if (merchantUrl) {
    merchantUrl.textContent = data.currentMerchant?.url || '';
  }
  
  if (progress) {
    progress.textContent = `${data.currentIndex + 1} / ${data.totalMerchants}`;
  }
  
  if (status) {
    const cleanStatus = data.status ? data.status.replace(/\\+$/, "'s") : 'Ready to test';
    status.textContent = cleanStatus;
  }
  
  // Update button states
  await updateCroutonButtons(data);
  
  // Update progress
  updateCroutonProgress();
}

// Update crouton buttons
async function updateCroutonButtons(data) {
  if (!croutonContainer) return;
  
  const prevBtn = croutonContainer.querySelector('#crouton-prev');
  const nextBtn = croutonContainer.querySelector('#crouton-next');
  const flagBtn = croutonContainer.querySelector('#crouton-flag');
  const successBtn = croutonContainer.querySelector('#crouton-success');
  
  // Update navigation buttons
  if (prevBtn) {
    prevBtn.disabled = data.currentIndex <= 0;
    prevBtn.style.opacity = data.currentIndex <= 0 ? '0.5' : '1';
  }
  
  if (nextBtn) {
    nextBtn.disabled = data.currentIndex >= data.totalMerchants - 1;
    nextBtn.style.opacity = data.currentIndex >= data.totalMerchants - 1 ? '0.5' : '1';
  }
  
  // Update action buttons based on merchant status
  const merchantKey = `${data.currentMerchant?.name}|${data.currentMerchant?.url}`;
  const merchantStatus = data.merchantStatus || '';
  
  if (flagBtn) {
    flagBtn.disabled = merchantStatus === 'flagged';
    flagBtn.style.opacity = merchantStatus === 'flagged' ? '0.5' : '1';
  }
  
  if (successBtn) {
    successBtn.disabled = merchantStatus === 'successful';
    successBtn.style.opacity = merchantStatus === 'successful' ? '0.5' : '1';
  }
}

// Update crouton progress
function updateCroutonProgress() {
  if (!croutonContainer || !croutonData) return;
  
  const progressFill = croutonContainer.querySelector('#crouton-progress-fill');
  const progressText = croutonContainer.querySelector('#crouton-progress-text');
  const successfulCount = croutonContainer.querySelector('#crouton-successful-count');
  const flaggedCount = croutonContainer.querySelector('#crouton-flagged-count');
  const totalCount = croutonContainer.querySelector('#crouton-total-count');
  
  if (progressFill) {
    const progress = ((croutonData.currentIndex + 1) / croutonData.totalMerchants) * 100;
    progressFill.style.width = `${progress}%`;
  }
  
  if (progressText) {
    const progress = ((croutonData.currentIndex + 1) / croutonData.totalMerchants) * 100;
    progressText.textContent = `${Math.round(progress)}% Complete`;
  }
  
  if (successfulCount) {
    const successful = croutonData.testingMerchants?.filter(m => 
      croutonData.merchantStatuses?.[`${m.name}|${m.url}`] === 'successful'
    ).length || 0;
    successfulCount.textContent = successful;
  }
  
  if (flaggedCount) {
    const flagged = croutonData.testingMerchants?.filter(m => 
      croutonData.merchantStatuses?.[`${m.name}|${m.url}`] === 'flagged'
    ).length || 0;
    flaggedCount.textContent = flagged;
  }
  
  if (totalCount) {
    totalCount.textContent = croutonData.totalMerchants || 0;
  }
}

// Show crouton autocomplete
function showCroutonAutocomplete(searchTerm) {
  const autocomplete = croutonContainer?.querySelector('#crouton-search-autocomplete');
  if (!autocomplete || !croutonData?.testingMerchants) return;
  
  // Clear previous results
  autocomplete.innerHTML = '';
  
  if (searchTerm.length < 2) {
    autocomplete.style.display = 'none';
    return;
  }
  
  // Find matching merchants
  const matches = croutonData.testingMerchants.filter(merchant => 
    merchant.name.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 5);
  
  if (matches.length === 0) {
    autocomplete.style.display = 'none';
    return;
  }
  
  // Create autocomplete items
  matches.forEach((match, index) => {
    const item = document.createElement('div');
    item.className = 'crouton-autocomplete-item';
    item.textContent = match.name;
    item.addEventListener('click', () => {
      selectCroutonAutocompleteItem(match.name, index);
    });
    autocomplete.appendChild(item);
  });
  
  autocomplete.style.display = 'block';
}

// Hide crouton autocomplete
function hideCroutonAutocomplete() {
  const autocomplete = croutonContainer?.querySelector('#crouton-search-autocomplete');
  if (autocomplete) {
    autocomplete.style.display = 'none';
  }
}

// Select crouton autocomplete item
function selectCroutonAutocompleteItem(merchantName, merchantIndex) {
  const searchInput = croutonContainer?.querySelector('#crouton-search-input');
  if (searchInput) {
    searchInput.value = merchantName;
  }
  
  hideCroutonAutocomplete();
  
  // Find and navigate to the merchant
  const merchant = croutonData?.testingMerchants?.find(m => m.name === merchantName);
  if (merchant) {
    // Update crouton to show this merchant
    const newData = {
      ...croutonData,
      currentMerchant: merchant,
      currentIndex: merchantIndex,
      status: `Testing ${merchant.name}`
    };
    updateCroutonData(newData);
  }
}

// Remove existing event listeners to prevent duplicates
function removeCroutonEventListeners() {
  // Remove all event listeners by cloning the elements
  if (croutonContainer) {
    const newContainer = croutonContainer.cloneNode(true);
    croutonContainer.parentNode.replaceChild(newContainer, croutonContainer);
    croutonContainer = newContainer;
  }
}

// Setup event listeners for crouton interactions
function setupCroutonEventListeners() {
  // Remove existing listeners first to prevent duplicates
  removeCroutonEventListeners();
  
  if (!croutonContainer) return;
  
  const minimizedView = croutonContainer.querySelector('.citishop-crouton-minimized');
  const minimizeBtn = croutonContainer.querySelector('.crouton-minimize');
  const prevBtn = croutonContainer.querySelector('#crouton-prev');
  const nextBtn = croutonContainer.querySelector('#crouton-next');
  const flagBtn = croutonContainer.querySelector('#crouton-flag');
  const successBtn = croutonContainer.querySelector('#crouton-success');
  const searchInput = croutonContainer.querySelector('#crouton-search-input');
  const searchBtn = croutonContainer.querySelector('#crouton-search-btn');
  const copySuccessfulBtn = croutonContainer.querySelector('#crouton-copy-successful');
  const copyFlaggedBtn = croutonContainer.querySelector('#crouton-copy-flagged');
  
  // Minimized view click to expand
  if (minimizedView) {
    minimizedView.addEventListener('click', async () => {
      await expandCrouton();
    });
  }
  
  // Minimize button
  if (minimizeBtn) {
    minimizeBtn.addEventListener('click', async () => {
      await minimizeCrouton();
    });
  }
  
  // Navigation buttons
  if (prevBtn) {
    prevBtn.addEventListener('click', async () => {
      await navigateToPreviousMerchant();
    });
  }
  
  if (nextBtn) {
    nextBtn.addEventListener('click', async () => {
      await navigateToNextMerchant();
    });
  }
  
  // Action buttons
  if (flagBtn) {
    flagBtn.addEventListener('click', async () => {
      await flagCurrentMerchant();
    });
  }
  
  if (successBtn) {
    successBtn.addEventListener('click', async () => {
      await markCurrentMerchantSuccessful();
    });
  }
  
  // Search functionality
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      showCroutonAutocomplete(e.target.value);
    });
    
    searchInput.addEventListener('blur', () => {
      setTimeout(() => hideCroutonAutocomplete(), 150);
    });
    
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (searchBtn) {
          searchBtn.click();
        }
      }
    });
  }
  
  if (searchBtn) {
    searchBtn.addEventListener('click', async () => {
      await searchForMerchant();
    });
  }
  
  // Copy buttons
  if (copySuccessfulBtn) {
    copySuccessfulBtn.addEventListener('click', async () => {
      await copySuccessfulMerchants();
    });
  }
  
  if (copyFlaggedBtn) {
    copyFlaggedBtn.addEventListener('click', async () => {
      await copyFlaggedMerchants();
    });
  }
}

// Navigate to previous merchant
async function navigateToPreviousMerchant() {
  if (!croutonData || croutonData.currentIndex <= 0) return;
  
  const newIndex = croutonData.currentIndex - 1;
  const newMerchant = croutonData.testingMerchants[newIndex];
  
  if (newMerchant) {
    const newData = {
      ...croutonData,
      currentMerchant: newMerchant,
      currentIndex: newIndex,
      status: `Testing ${newMerchant.name}`
    };
    
    await updateCroutonData(newData);
    
    // Navigate to merchant URL
    if (newMerchant.url) {
      window.location.href = newMerchant.url;
    }
  }
}

// Navigate to next merchant
async function navigateToNextMerchant() {
  if (!croutonData || croutonData.currentIndex >= croutonData.totalMerchants - 1) return;
  
  const newIndex = croutonData.currentIndex + 1;
  const newMerchant = croutonData.testingMerchants[newIndex];
  
  if (newMerchant) {
    const newData = {
      ...croutonData,
      currentMerchant: newMerchant,
      currentIndex: newIndex,
      status: `Testing ${newMerchant.name}`
    };
    
    await updateCroutonData(newData);
    
    // Navigate to merchant URL
    if (newMerchant.url) {
      window.location.href = newMerchant.url;
    }
  }
}

// Flag current merchant
async function flagCurrentMerchant() {
  if (!croutonData?.currentMerchant) return;
  
  const merchantKey = `${croutonData.currentMerchant.name}|${croutonData.currentMerchant.url}`;
  
  try {
    const result = await chrome.storage.local.get(['extensionState']);
    const state = result.extensionState || {};
    
    if (!state.merchantStatuses) {
      state.merchantStatuses = {};
    }
    
    state.merchantStatuses[merchantKey] = 'flagged';
    
    await chrome.storage.local.set({ extensionState: state });
    
    // Update crouton data
    croutonData.merchantStatuses = state.merchantStatuses;
    await updateCroutonData(croutonData);
    
    // Update progress
    updateCroutonProgress();
  } catch (error) {
    console.error('Error flagging merchant:', error);
  }
}

// Mark current merchant as successful
async function markCurrentMerchantSuccessful() {
  if (!croutonData?.currentMerchant) return;
  
  const merchantKey = `${croutonData.currentMerchant.name}|${croutonData.currentMerchant.url}`;
  
  try {
    const result = await chrome.storage.local.get(['extensionState']);
    const state = result.extensionState || {};
    
    if (!state.merchantStatuses) {
      state.merchantStatuses = {};
    }
    
    state.merchantStatuses[merchantKey] = 'successful';
    
    await chrome.storage.local.set({ extensionState: state });
    
    // Update crouton data
    croutonData.merchantStatuses = state.merchantStatuses;
    await updateCroutonData(croutonData);
    
    // Update progress
    updateCroutonProgress();
  } catch (error) {
    console.error('Error marking merchant successful:', error);
  }
}

// Search for merchant
async function searchForMerchant() {
  const searchInput = croutonContainer?.querySelector('#crouton-search-input');
  if (!searchInput || !croutonData?.testingMerchants) return;
  
  const searchTerm = searchInput.value.trim();
  if (!searchTerm) return;
  
  // Find matching merchant
  const merchant = croutonData.testingMerchants.find(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  if (merchant) {
    const newIndex = croutonData.testingMerchants.findIndex(m => m.name === merchant.name);
    const newData = {
      ...croutonData,
      currentMerchant: merchant,
      currentIndex: newIndex,
      status: `Testing ${merchant.name}`
    };
    
    await updateCroutonData(newData);
    
    // Navigate to merchant URL
    if (merchant.url) {
      window.location.href = merchant.url;
    }
  }
}

// Copy successful merchants
async function copySuccessfulMerchants() {
  if (!croutonData?.testingMerchants) return;
  
  const successful = croutonData.testingMerchants.filter(m => 
    croutonData.merchantStatuses?.[`${m.name}|${m.url}`] === 'successful'
  );
  
  const text = successful.map(m => m.name).join('\n');
  
  try {
    await navigator.clipboard.writeText(text);
    alert(`Copied ${successful.length} successful merchants to clipboard`);
  } catch (error) {
    console.error('Error copying successful merchants:', error);
  }
}

// Copy flagged merchants
async function copyFlaggedMerchants() {
  if (!croutonData?.testingMerchants) return;
  
  const flagged = croutonData.testingMerchants.filter(m => 
    croutonData.merchantStatuses?.[`${m.name}|${m.url}`] === 'flagged'
  );
  
  const text = flagged.map(m => m.name).join('\n');
  
  try {
    await navigator.clipboard.writeText(text);
    alert(`Copied ${flagged.length} flagged merchants to clipboard`);
  } catch (error) {
    console.error('Error copying flagged merchants:', error);
  }
}

// Expand crouton
async function expandCrouton() {
  if (!croutonContainer) return;
  
  croutonContainer.classList.remove('citishop-crouton-minimized');
  croutonContainer.classList.add('citishop-crouton-expanded');
  
  // Update toggle button
  const toggleBtn = croutonContainer.querySelector('.crouton-minimize');
  if (toggleBtn) {
    toggleBtn.textContent = '⬇️';
    toggleBtn.title = 'Minimize';
  }
  
  await saveCollapsePreference(false);
}

// Minimize crouton
async function minimizeCrouton() {
  if (!croutonContainer) return;
  
  croutonContainer.classList.remove('citishop-crouton-expanded');
  croutonContainer.classList.add('citishop-crouton-minimized');
  
  // Update toggle button
  const toggleBtn = croutonContainer.querySelector('.crouton-minimize');
  if (toggleBtn) {
    toggleBtn.textContent = '⬆️';
    toggleBtn.title = 'Expand';
  }
  
  await saveCollapsePreference(true);
}

// Apply crouton position setting
async function applyCroutonPosition() {
  try {
    const result = await chrome.storage.local.get(['croutonPosition']);
    const position = result.croutonPosition || 'center';
    
    if (croutonContainer) {
      // Remove existing position classes
      croutonContainer.classList.remove(
        'position-bottom-right',
        'position-bottom-left',
        'position-top-right',
        'position-top-left',
        'position-middle-left'
      );
      
      // Apply new position class
      if (position !== 'center') {
        croutonContainer.classList.add(`position-${position}`);
      }
    }
  } catch (error) {
    console.error('Error applying crouton position:', error);
  }
}

// Make element draggable
function makeDraggable(element) {
  let isDragging = false;
  let startX, startY, initialX, initialY;
  
  element.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    
    const rect = element.getBoundingClientRect();
    initialX = rect.left;
    initialY = rect.top;
    
    element.style.cursor = 'grabbing';
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    element.style.left = `${initialX + deltaX}px`;
    element.style.top = `${initialY + deltaY}px`;
    element.style.position = 'fixed';
  });
  
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      element.style.cursor = 'move';
    }
  });
}

// Remove any restore buttons
function removeAnyRestoreButtons() {
  const existingRestoreButtons = document.querySelectorAll('.citishop-restore-button');
  existingRestoreButtons.forEach(button => button.remove());
}

// Listen for messages from extension
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  switch (message.action) {
    case 'showFloatingCrouton':
      try {
        await createFloatingCrouton(message.data);
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
      break;
      
    case 'updateFloatingCrouton':
      await updateCroutonData(message.data);
      sendResponse({ success: true });
      break;
      
    case 'updateCroutonPosition':
      if (croutonContainer) {
        // Remove existing position classes
        croutonContainer.classList.remove(
          'position-bottom-right',
          'position-bottom-left', 
          'position-top-right',
          'position-top-left',
          'position-middle-left'
        );
        
        // Apply new position class
        if (message.position !== 'center') {
          croutonContainer.classList.add(`position-${message.position}`);
        }
      }
      sendResponse({ success: true });
      break;
      
    case 'hideFloatingCrouton':
      if (croutonContainer) {
        croutonContainer.remove();
        croutonContainer = null;
        croutonData = null;
      }
      sendResponse({ success: true });
      break;
      
    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

console.log('🏪 CitiShop floating crouton script loaded');
