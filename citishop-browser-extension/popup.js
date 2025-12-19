// Global state
let merchantDatabase = [];
let currentValidation = null;
let currentValidationFilter = null; // null = show all, 'successful', 'flagged', 'tested'
// Session stats removed (stats section eliminated)

// Sample merchants for testing (line format to match user preference)
const sampleMerchants = [
  'Best Buy', 
  'Sephora',
  'PetSmart',
  'Gap',
  'StubHub',
  'NIKE',
  'Fanatics',
  'adidas',
  'Groupon',
  'LEGO'
];

// DOM Elements - will be defined inside DOMContentLoaded
let merchantInput, validateBtn, sampleBtn, clearBtn, resultsSection, codeSection, downloadTableBtn, copyCodeBtn, downloadBtn, newTestBtn, loading, toast;

// Test execution elements
// Test execution section removed

// Built-in floating controls elements (removed - testing window eliminated)

// Merchant search elements (for validation results) - will be initialized in DOMContentLoaded
let merchantSearchInput = null;
let searchMerchantBtn = null;
let searchAutocomplete = null;

// Merchant testing elements removed (testing window eliminated)

// Testing controls state
let testingControlsActive = false;
let testExecutionActive = false;
let currentMerchantIndex = 0;
let testingMerchants = [];
let merchantStatuses = {}; // Track merchant statuses: flagged, successful
let croutonActionPolling = null; // Polling interval for crouton actions
let validationSyncPolling = null; // Polling interval for validation results sync
let selectedAutocompleteIndex = -1; // Track selected autocomplete item for keyboard navigation
let selectedValidationIndex = -1; // Track selected validation result for keyboard navigation

// Statistics elements (removed - stats section eliminated)

// Initialize when popup opens
// Debug function to check all testing control elements
function debugTestingControls() {
  console.log('=== Testing Controls Debug ===');
  console.log('testingControlsSection:', testingControlsSection);
  console.log('testingControlsSection visible:', testingControlsSection?.style.display !== 'none');
  console.log('testingControlsActive:', testingControlsActive);
  console.log('testingMerchants length:', testingMerchants?.length || 0);
  console.log('currentMerchantIndex:', currentMerchantIndex);
  console.log('=== End Debug ===');
}

// Debug function to test main buttons
function testMainButtons() {
  console.log('🧪 Testing main buttons...');
  
  const vBtn = document.getElementById('validateBtn');
  const sBtn = document.getElementById('sampleBtn');
  const cBtn = document.getElementById('clearBtn');
  
  console.log('🧪 validateBtn found:', !!vBtn);
  console.log('🧪 sampleBtn found:', !!sBtn);
  console.log('🧪 clearBtn found:', !!cBtn);
  
  if (vBtn) {
    console.log('🧪 validateBtn classes:', vBtn.className);
    console.log('🧪 validateBtn style.display:', vBtn.style.display);
    console.log('🧪 validateBtn disabled:', vBtn.disabled);
  }
  
  if (sBtn) {
    console.log('🧪 sampleBtn classes:', sBtn.className);
    console.log('🧪 sampleBtn style.display:', sBtn.style.display);
    console.log('🧪 sampleBtn disabled:', sBtn.disabled);
  }
  
  if (cBtn) {
    console.log('🧪 clearBtn classes:', cBtn.className);
    console.log('🧪 clearBtn style.display:', cBtn.style.display);
    console.log('🧪 clearBtn disabled:', cBtn.disabled);
  }
}

// Add to global scope for manual testing
window.testMainButtons = testMainButtons;

// Test function to manually apply animations
window.testAnimations = function() {
  console.log('🧪 Testing animations manually...');
  const merchantItems = document.querySelectorAll('.merchant-item');
  console.log('🧪 Found merchant items:', merchantItems.length);
  
  merchantItems.forEach((item, index) => {
    const testStatus = index % 2 === 0 ? 'successful' : 'flagged';
    console.log(`🧪 Applying ${testStatus} to item ${index}`);
    
    // Remove existing classes
    item.classList.remove('merchant-item-successful', 'merchant-item-flagged');
    
    // Add new class
    item.classList.add(`merchant-item-${testStatus}`);
    
    // Apply inline styles - solid borders
    if (testStatus === 'successful') {
      item.style.border = '3px solid #27ae60';
      item.style.backgroundColor = 'rgba(39, 174, 96, 0.1)';
    } else if (testStatus === 'flagged') {
      item.style.border = '3px solid #e74c3c';
      item.style.backgroundColor = 'rgba(231, 76, 60, 0.1)';
    }
    
    console.log(`🧪 Applied to item ${index}:`, item.className, item.style.cssText);
  });
};

// Debug function to check merchant statuses
window.debugMerchantStatuses = async function() {
  console.log('🔍 Debugging merchant statuses...');
  console.log('🔍 Current merchantStatuses variable:', merchantStatuses);
  
  try {
    const result = await chrome.storage.local.get(['extensionState']);
    console.log('🔍 Storage extensionState:', result.extensionState);
    console.log('🔍 Storage merchantStatuses:', result.extensionState?.merchantStatuses);
    
    if (currentValidation?.foundMerchants) {
      console.log('🔍 Current validation merchants:');
      currentValidation.foundMerchants.forEach((merchant, index) => {
        const merchantKey = `${merchant.name}_${merchant.url}`;
        const status = merchantStatuses[merchantKey];
        console.log(`  ${index}: ${merchant.name} -> Key: ${merchantKey} -> Status: ${status}`);
      });
    }
  } catch (error) {
    console.error('🔍 Error checking storage:', error);
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 DOMContentLoaded event fired!');
  
  // Initialize all DOM elements
  merchantInput = document.getElementById('merchantInput');
  validateBtn = document.getElementById('validateBtn');
  sampleBtn = document.getElementById('sampleBtn');
  clearBtn = document.getElementById('clearBtn');
  resultsSection = document.getElementById('resultsSection');
  codeSection = document.getElementById('codeSection');
  downloadTableBtn = document.getElementById('downloadTableBtn');
  copyCodeBtn = document.getElementById('copyCodeBtn');
  downloadBtn = document.getElementById('downloadBtn');
  newTestBtn = document.getElementById('newTestBtn');
  loading = document.getElementById('loading');
  toast = document.getElementById('toast');
  
  // Initialize search elements
  merchantSearchInput = document.getElementById('merchantSearchInput');
  searchMerchantBtn = document.getElementById('searchMerchantBtn');
  searchAutocomplete = document.getElementById('searchAutocomplete');
  
  // Initialize tabs and stats
  setupTabs();
  setupCroutonInjection();
  setupStats();
  
  console.log('🔍 DOMContentLoaded element check:');
  console.log('🔍 merchantSearchInput:', merchantSearchInput);
  console.log('🔍 searchMerchantBtn:', searchMerchantBtn);
  console.log('🔍 searchAutocomplete:', searchAutocomplete);
  console.log('🔍 validateBtn:', validateBtn);
  console.log('🔍 sampleBtn:', sampleBtn);
  console.log('🔍 clearBtn:', clearBtn);
  console.log('🔍 resultsSection:', resultsSection);
  
  // Test function to manually show autocomplete
  window.testAutocomplete = function() {
    console.log('🧪 Testing autocomplete manually');
    if (searchAutocomplete) {
      searchAutocomplete.innerHTML = '<div class="autocomplete-item">Test Item 1</div><div class="autocomplete-item">Test Item 2</div>';
      searchAutocomplete.style.display = 'block';
      console.log('🧪 Autocomplete should be visible now');
    } else {
      console.log('🧪 searchAutocomplete element not found');
    }
  };
  
  // Test function to manually highlight the first merchant
  window.testHighlight = function() {
    console.log('🧪 Testing highlighting manually');
    const foundList = document.getElementById('foundList');
    if (foundList) {
      const firstMerchant = foundList.querySelector('.merchant-item');
      if (firstMerchant) {
        firstMerchant.classList.add('highlighted');
        console.log('🧪 Applied highlighted class to first merchant');
        console.log('🧪 First merchant classes:', firstMerchant.className);
        firstMerchant.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        console.log('🧪 No merchant items found');
      }
    } else {
      console.log('🧪 foundList not found');
    }
  };
  
  // Test function to manually test citiList.txt loading
  window.testCitiListLoading = async function() {
    console.log('🧪 Testing citiList.txt loading manually');
    try {
      const merchantListUrl = chrome.runtime.getURL('citiList.txt');
      console.log('🧪 Testing URL:', merchantListUrl);
      const response = await fetch(merchantListUrl);
      console.log('🧪 Response status:', response.status, response.ok);
      if (response.ok) {
        const text = await response.text();
        console.log('🧪 Response length:', text.length);
        console.log('🧪 First 200 chars:', text.substring(0, 200));
        console.log('🧪 Contains "const websites":', text.includes('const websites'));
        console.log('🧪 Contains "];":', text.includes('];'));
        
        // Test the regex pattern
        const arrayMatch = text.match(/\s*const websites = \[([\s\S]*?)\];/);
        if (arrayMatch) {
          console.log('🧪 Regex match successful');
          let arrayContent = '[' + arrayMatch[1] + ']';
          console.log('🧪 Raw array content length:', arrayContent.length);
          
          // Apply the same cleaning as the main function
          arrayContent = arrayContent.replace(/,(\s*\]\s*)$/, '$1');
          arrayContent = arrayContent.replace(/%\s*$/, '');
          arrayContent = arrayContent.replace(/\\'/g, "'");
          arrayContent = arrayContent.trim();
          
          console.log('🧪 Cleaned array content length:', arrayContent.length);
          console.log('🧪 Last 100 chars of cleaned array:', arrayContent.slice(-100));
          
          try {
            const testArray = JSON.parse(arrayContent);
            console.log('🧪 JSON parsing successful! Merchant count:', testArray.length);
            console.log('🧪 First merchant:', testArray[0]);
            console.log('🧪 Last merchant:', testArray[testArray.length - 1]);
          } catch (jsonError) {
            console.error('🧪 JSON parsing failed:', jsonError);
            console.log('🧪 First 200 chars of cleaned array:', arrayContent.substring(0, 200));
          }
        } else {
          console.log('🧪 Regex match failed');
        }
      } else {
        console.log('🧪 Response not OK:', response.statusText);
      }
    } catch (error) {
      console.error('🧪 Error testing citiList.txt:', error);
    }
  };
  
  // Setup search input event listeners
  if (merchantSearchInput) {
    console.log('✅ Search input found, adding event listeners');
    merchantSearchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        console.log('🔍 Enter key pressed in search input');
        searchMerchantInResults();
      }
    });
    
    merchantSearchInput.addEventListener('keydown', (e) => {
      // Handle autocomplete navigation
      if (searchAutocomplete && searchAutocomplete.style.display === 'block') {
        handleAutocompleteKeydown(e);
      }
    });
    
    merchantSearchInput.addEventListener('input', (e) => {
      console.log('🔍 Search input event triggered');
      console.log('🔍 searchAutocomplete element exists:', !!searchAutocomplete);
      console.log('🔍 searchAutocomplete element:', searchAutocomplete);
      
      // Show autocomplete suggestions
      const searchTerm = e.target.value.trim();
      console.log('🔍 Search term:', searchTerm, 'Length:', searchTerm.length);
      if (searchTerm.length >= 2) {
        console.log('🔍 Calling showAutocomplete');
        showAutocomplete(searchTerm);
        // Don't clear highlights when typing - highlights persist
      } else {
        console.log('🔍 Hiding autocomplete - search term too short');
        hideAutocomplete();
        // Don't clear highlights - highlights persist until manually cleared
      }
    });
    
    // Hide autocomplete when input loses focus (with delay for clicks)
    merchantSearchInput.addEventListener('blur', () => {
      setTimeout(() => {
        hideAutocomplete();
      }, 150);
    });
  } else {
    console.error('❌ Search input not found in DOM');
  }
  
  // Setup search button event listener
  if (searchMerchantBtn) {
    console.log('✅ Search button found, adding click listener');
    searchMerchantBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('🔍 Search button clicked!');
      searchMerchantInResults();
    });
  } else {
    console.error('❌ Search button not found in DOM');
  }
  
  // No scroll-based highlight clearing - highlights persist until manually cleared
  
  // Always reset popup positioning first (in case of previous pin tab issues)
  console.log('🧹 Ensuring popup positioning is reset...');
  document.documentElement.style.removeProperty('transform');
  document.documentElement.style.removeProperty('position');
  document.body.style.removeProperty('transform');
  
  // Setup status count click handlers
  setupStatusCountClickHandlers();
  document.body.style.removeProperty('position');
  document.body.style.removeProperty('top');
  document.body.style.removeProperty('left');
  const mainContainer = document.querySelector('.container');
  if (mainContainer) {
    mainContainer.style.removeProperty('transform');
    mainContainer.style.removeProperty('position');
  }
  
  // Check and clean up any pinned tab state first
  await checkAndCleanupPinnedState();
  
  // Check if extension was just reloaded/refreshed
  await checkExtensionReload();
  
  // Force clear old cached data if needed
  await checkAndClearOldData();
  
  // Check if extension was just updated and reset if needed
  await checkForExtensionUpdate();
  
  // Setup additional buttons that might not be visible initially
  if (downloadTableBtn) {
    console.log('✅ Download table button found at startup:', downloadTableBtn);
    // If results section is visible, set up the button now
    if (downloadTableBtn.closest('.results-section').style.display !== 'none') {
      setupDownloadButton();
    } else {
      console.log('📄 Download button not visible yet, will setup when validation results are shown');
    }
  } else {
    console.log('📄 Download button not found at startup - will setup when needed');
  }
  
  if (copyCodeBtn) {
    copyCodeBtn.addEventListener('click', copyGeneratedCode);
  }
  if (downloadBtn) {
    downloadBtn.addEventListener('click', downloadTestFile);
  }
  if (newTestBtn) {
    newTestBtn.addEventListener('click', startNewTest);
  }
  
  // Initialize extension after update check to ensure fresh database load
  await initializeExtension();
  // loadSessionStats call removed (stats section eliminated)
  
  await restoreExtensionState();
  
  // Load stats data (merchantStatuses, merchantTestDates, merchantNotes) from storage
  const statsState = await chrome.storage.local.get(['extensionState']);
  if (statsState.extensionState) {
    if (statsState.extensionState.merchantStatuses) {
      merchantStatuses = statsState.extensionState.merchantStatuses;
      console.log('📊 Loaded merchantStatuses:', Object.keys(merchantStatuses).length, 'entries');
    }
    // merchantTestDates and merchantNotes will be loaded when refreshStats() is called
  }
  
  // Restore filter state
  await restoreFilterState();
  
  // Immediately refresh validation results to show current statuses
  if (currentValidation && currentValidation.foundMerchants) {
    console.log('🔄 Immediately refreshing validation results on popup open...');
    
    // First, check if background sync has flagged validation results for refresh
    chrome.runtime.sendMessage({ action: 'checkValidationRefreshFlag' }, (response) => {
      if (response && response.success) {
        if (response.needsRefresh) {
          console.log('🔄 Background sync detected changes - forcing fresh validation refresh');
          console.log('🔄 Last update timestamp:', response.lastUpdate);
        } else {
          console.log('🔄 No background changes detected - regular refresh');
        }
        
        // Always get fresh data from storage before refreshing
        chrome.storage.local.get(['extensionState'], (result) => {
          if (result.extensionState && result.extensionState.merchantStatuses) {
            // Update local merchantStatuses with fresh data from storage
            const oldStatuses = { ...merchantStatuses };
            merchantStatuses = { ...(result.extensionState.merchantStatuses || {}) };
            console.log('🔄 Updated merchantStatuses from storage:', merchantStatuses);
            console.log('🔄 Previous merchantStatuses:', oldStatuses);
            console.log('🔄 Current filter during update:', currentValidationFilter);
            
            // Now refresh validation results with the updated data
            refreshValidationResults();
            updateValidationStatusCounts();
            
            console.log('✅ Validation results refreshed with fresh storage data');
          } else {
            // Fallback to regular refresh if no storage data
            refreshValidationResults();
            updateValidationStatusCounts();
          }
        });
      } else {
        console.warn('⚠️ Failed to check validation refresh flag, proceeding with regular refresh');
        // Fallback to regular refresh
        chrome.storage.local.get(['extensionState'], (result) => {
          if (result.extensionState && result.extensionState.merchantStatuses) {
            merchantStatuses = { ...(result.extensionState.merchantStatuses || {}) };
            refreshValidationResults();
            updateValidationStatusCounts();
          }
        });
      }
    });
    
    // Start validation sync polling to keep results updated
    startValidationSyncPolling();
  }
  
  // updateStatsDisplay call removed (stats section eliminated)
  
  // Debug testing controls after DOM is ready
  setTimeout(() => {
    debugTestingControls();
    testMainButtons(); // Test main buttons
  }, 100);
  
  // Note: Testing controls will show when merchants are validated or test is started
  
  // Run debug after everything loads
  setTimeout(() => {
    debugTestingControls();
    console.log('=== TESTING: Click any merchant button to test ===');
    
    // Add working button handlers
    console.log('=== TESTING CONTROLS READY ===');
    
    // Reset testing button removed (testing reset section eliminated)
    
    console.log('=== DIRECT ONCLICK HANDLERS ADDED ===');
    
    // Make sure buttons are fully interactive
    console.log('=== ENSURING BUTTONS ARE INTERACTIVE ===');
    [prevMerchantBtn, testCurrentMerchantBtn, nextMerchantBtn, flagMerchantBtn].forEach((btn, index) => {
      if (btn) {
        const btnName = ['prev', 'test', 'next', 'flag'][index];
        console.log(`Checking ${btnName} button:`, {
          disabled: btn.disabled,
          style: btn.style.cssText,
          display: getComputedStyle(btn).display,
          visibility: getComputedStyle(btn).visibility,
          pointerEvents: getComputedStyle(btn).pointerEvents
        });
        
        // Force enable and make visible
        btn.disabled = false;
        btn.style.pointerEvents = 'auto';
        btn.style.opacity = '1';
        btn.style.display = 'flex';
        
        console.log(`✅ ${btnName} button forced interactive`);
      }
    });
  }, 200);
  
  // Setup Help, About, and Settings button event listeners
  console.log('🔧 Setting up Help, About, and Settings button event listeners...');
  
  const helpBtn = document.getElementById('helpBtn');
  const aboutBtn = document.getElementById('aboutBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  
  if (helpBtn) {
    console.log('✅ Help button found, adding click listener');
    helpBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('❓ Help button clicked');
      showHelp();
    });
  } else {
    console.error('❌ Help button not found');
  }
  
  if (aboutBtn) {
    console.log('✅ About button found, adding click listener');
    aboutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('ℹ️ About button clicked');
      showAbout();
    });
  } else {
    console.error('❌ About button not found');
  }
  
  if (settingsBtn) {
    console.log('✅ Settings button found, adding click listener');
    settingsBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      console.log('⚙️ Settings button clicked');
      await showSettings();
    });
  } else {
    console.error('❌ Settings button not found');
  }
  
  // Keep Open button
  const keepOpenBtn = document.getElementById('keepOpenBtn');
  if (keepOpenBtn) {
    console.log('✅ Keep Open button found, adding click listener');
    keepOpenBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('📌 Pin to Tab button clicked');
      pinExtensionToTab();
    });
  } else {
    console.error('❌ Keep Open button not found');
  }

  // Setup main button event listeners
console.log('🔧 Setting up main button event listeners...');
console.log('🔧 validateBtn exists:', !!validateBtn);
console.log('🔧 sampleBtn exists:', !!sampleBtn);
console.log('🔧 clearBtn exists:', !!clearBtn);
  console.log('🔧 validateBtn element:', validateBtn);
  console.log('🔧 sampleBtn element:', sampleBtn);
  console.log('🔧 clearBtn element:', clearBtn);

if (validateBtn) {
  validateBtn.addEventListener('click', (e) => {
    console.log('✅ Validate button clicked!');
    e.preventDefault();
    validateMerchants();
  });
  console.log('✅ Validate button listener added');
} else {
  console.error('❌ validateBtn not found!');
}

if (sampleBtn) {
  sampleBtn.addEventListener('click', (e) => {
    console.log('📋 Sample button clicked!');
    e.preventDefault();
    loadSampleMerchants();
  });
  console.log('✅ Sample button listener added');
} else {
  console.error('❌ sampleBtn not found!');
}

if (clearBtn) {
  clearBtn.addEventListener('click', (e) => {
    console.log('🗑️ Clear button clicked!');
    e.preventDefault();
    clearAll();
  });
  console.log('✅ Clear button listener added');
} else {
  console.error('❌ clearBtn not found!');
}

  // Add keyboard navigation to buttons
  navigationButtons.forEach(buttonId => {
    const button = document.getElementById(buttonId);
    if (button) {
      button.addEventListener('keydown', handleButtonNavigation);
      button.setAttribute('tabindex', '0'); // Make buttons focusable
    }
  });
  
  // Setup generate test button
});

// Event Listeners moved to DOMContentLoaded
// injectFloatingBtn event listener removed
// Download button setup function (called when validation results are shown)
function setupDownloadButton() {
  const downloadTableBtn = document.getElementById('downloadTableBtn');
  if (downloadTableBtn) {
    console.log('✅ Setting up download table button:', downloadTableBtn);
    console.log('✅ Button ID:', downloadTableBtn.id);
    console.log('✅ Button text:', downloadTableBtn.textContent);
    console.log('✅ Button parent section visible:', downloadTableBtn.closest('.results-section').style.display !== 'none');
    
    // Remove any existing event listeners
    const newBtn = downloadTableBtn.cloneNode(true);
    downloadTableBtn.parentNode.replaceChild(newBtn, downloadTableBtn);
    
    newBtn.addEventListener('click', (e) => {
      console.log('📄 Download table button clicked!', e);
      console.log('📄 Event target:', e.target);
      console.log('📄 Event currentTarget:', e.currentTarget);
      addButtonPressEffect(newBtn);
      downloadMerchantTable();
    });
    
    console.log('✅ Download table button listener added successfully');
    
    // Test if button is clickable
    console.log('✅ Button disabled?', newBtn.disabled);
    console.log('✅ Button computed style display:', window.getComputedStyle(newBtn).display);
  } else {
    console.error('❌ downloadTableBtn not found when setting up!');
  }
}

// Move button setup inside DOMContentLoaded to ensure elements exist

// Reset testing button removed (testing reset section eliminated)

// Merchant search event listeners will be set up in DOMContentLoaded

// Event listeners will be set up in DOMContentLoaded

// Test execution event listeners
// Test execution button listeners removed

// Merchant testing buttons removed - all functionality moved to floating crouton

// Keyboard shortcuts and auto-save
merchantInput.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'Enter') {
    validateMerchants();
  }
});

// Auto-save input as user types and setup autocomplete
merchantInput.addEventListener('input', debounce(() => {
  saveExtensionState();
  setupMainAutocomplete();
}, 1000));

// Setup autocomplete for main input
merchantInput.addEventListener('input', (e) => {
  setupMainAutocomplete();
});

merchantInput.addEventListener('keydown', (e) => {
  handleMainAutocompleteKeydown(e);
  
  // Handle navigation from input to buttons when no autocomplete is shown
  if (!mainAutocompleteContainer || mainAutocompleteContainer.style.display === 'none') {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      navigateToButtons();
    }
  }
});

merchantInput.addEventListener('blur', () => {
  setTimeout(() => {
    hideMainAutocomplete();
  }, 150);
});

// Debounce function to avoid saving too frequently
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Help, About, and Settings buttons will be set up in DOMContentLoaded

// Setup search event listeners (called after validation results are displayed)
function setupSearchEventListeners() {
  console.log('✅ Search event listeners already set up during initialization');
  // Event listeners are already set up in the main initialization
  // No need to add them again here to avoid duplicates and focus issues
}

// Setup testing control buttons (called when testing controls are shown)
// setupTestingControlButtons function removed (testing window eliminated)

// Merchant search functions
function searchMerchantInResults() {
  console.log('🔍 searchMerchantInResults called - searching within validation results only');
  console.log('🔍 Call stack:', new Error().stack);
  
  // Get fresh reference to search input (since elements may be recreated)
  const currentSearchInput = document.getElementById('merchantSearchInput');
  
  if (!currentSearchInput) {
    console.error('❌ merchantSearchInput element not found in DOM');
    showToast('Search input not found', 'error');
    return;
  }
  
  console.log('✅ Found search input element');
  console.log('📝 Search input value:', `"${currentSearchInput.value}"`);
  console.log('📝 Search input length:', currentSearchInput.value.length);
  
  if (!currentValidation) {
    console.error('❌ currentValidation not found');
    showToast('No validation results to search', 'error');
    return;
  }
  
  const searchTerm = currentSearchInput.value.trim();
  console.log('📝 Trimmed search term:', `"${searchTerm}"`);
  
  if (!searchTerm) {
    console.error('❌ Search term is empty after trim');
    showToast('Please enter a search term', 'warning');
    return;
  }
  
  console.log('🔍 Searching for:', searchTerm);
  console.log('📋 Current validation has', currentValidation.foundMerchants?.length || 0, 'found merchants');
  
  // Debug current validation data - only show key info for Dr Ho's issue
  if (currentValidation && currentValidation.foundMerchants) {
    // Only debug Dr Ho's specifically
    const drHoFound = currentValidation.foundMerchants.find(m => m.name.toLowerCase().includes('dr ho'));
    if (drHoFound) {
      console.log('🔍 Dr Ho\'s FOUND:', `"${drHoFound.name}" (${drHoFound.url})`);
    } else {
      console.log('❌ Dr Ho\'s NOT FOUND in validation results');
    }
  }
  
  const foundList = document.getElementById('foundList');
  if (!foundList) {
    console.error('❌ foundList element not found');
    return;
  }
  
  console.log('📋 foundList innerHTML:', foundList.innerHTML);
  
  // Clear previous highlights
  clearSearchHighlights();
  
  // Find matching merchants
  const merchantItems = foundList.querySelectorAll('.merchant-item');
  console.log('🔍 Found', merchantItems.length, 'merchant items in DOM');
  
  // Debug: Log first few and last few merchant names
  console.log('📋 First 3 merchants in DOM:');
  for (let i = 0; i < Math.min(3, merchantItems.length); i++) {
    const nameEl = merchantItems[i].querySelector('.merchant-name');
    console.log(`  ${i}: ${nameEl ? nameEl.textContent : 'NO NAME'}`);
  }
  
  console.log('📋 Last 3 merchants in DOM:');
  for (let i = Math.max(0, merchantItems.length - 3); i < merchantItems.length; i++) {
    const nameEl = merchantItems[i].querySelector('.merchant-name');
    console.log(`  ${i}: ${nameEl ? nameEl.textContent : 'NO NAME'}`);
  }
  
  if (merchantItems.length === 0) {
    console.error('❌ No merchant items found in DOM! foundList structure:');
    console.log('foundList children:', foundList.children);
    showToast('No merchants found in results to search', 'error');
    return;
  }
  
  // First pass: find all matches and score them
  const matches = [];
  const normalizedSearchTerm = normalizeMerchantName(searchTerm);
  const lowercaseSearchTerm = searchTerm.toLowerCase();
  const searchTermNoApostrophes = lowercaseSearchTerm.replace(/['`'']/g, '');
  
  for (let i = 0; i < merchantItems.length; i++) {
    const item = merchantItems[i];
    const merchantNameElement = item.querySelector('.merchant-name');
    
    if (!merchantNameElement) {
      console.log(`❌ No .merchant-name found in item ${i}`);
      continue;
    }
    
    const merchantName = merchantNameElement.textContent || '';
    const normalizedMerchantName = normalizeMerchantName(merchantName);
    const lowercaseMerchantName = merchantName.toLowerCase();
    const merchantNameNoApostrophes = lowercaseMerchantName.replace(/['`'']/g, '');
    
    console.log(`🔍 Item ${i}: "${merchantName}" -> normalized: "${normalizedMerchantName}" | lowercase: "${lowercaseMerchantName}"`);
    
    // Try multiple matching strategies with improved scoring
    let score = 0;
    let matchType = '';
    
    // Exact matches get highest priority (case and normalization variations)
    if (merchantName.toLowerCase() === searchTerm.toLowerCase()) {
      score = 1000; // Perfect exact match (case insensitive)
      matchType = 'exact-case-insensitive';
    } else if (normalizedMerchantName === normalizedSearchTerm) {
      score = 900; // Exact normalized match
      matchType = 'exact-normalized';
    } else if (lowercaseMerchantName === lowercaseSearchTerm) {
      score = 850; // Exact lowercase match
      matchType = 'exact-lowercase';
    } 
    // Start-of-string matches (higher priority than contains)
    else if (lowercaseMerchantName.startsWith(lowercaseSearchTerm)) {
      score = 800; // Starts with search term
      matchType = 'starts-with-lowercase';
    } else if (normalizedMerchantName.startsWith(normalizedSearchTerm)) {
      score = 750; // Starts with normalized
      matchType = 'starts-with-normalized';
    }
    // Contains matches (word boundary preferred)
    else if (lowercaseMerchantName.includes(' ' + lowercaseSearchTerm) || lowercaseMerchantName.includes(lowercaseSearchTerm + ' ')) {
      score = 700; // Word boundary match
      matchType = 'word-boundary-lowercase';
    } else if (lowercaseMerchantName.includes(lowercaseSearchTerm)) {
      score = 600; // General contains lowercase
      matchType = 'contains-lowercase';
    } else if (normalizedMerchantName.includes(normalizedSearchTerm)) {
      score = 550; // General contains normalized
      matchType = 'contains-normalized';
    } else if (merchantNameNoApostrophes.includes(searchTermNoApostrophes)) {
      score = 500; // Contains without apostrophes
      matchType = 'contains-no-apostrophes';
    }
    // Reverse matches (search term contains merchant name - less precise)
    else if (lowercaseSearchTerm.includes(lowercaseMerchantName)) {
      score = 300; // Search term contains merchant name
      matchType = 'reverse-lowercase';
    } else if (normalizedSearchTerm.includes(normalizedMerchantName)) {
      score = 250; // Reverse normalized
      matchType = 'reverse-normalized';
    }
    
    if (score > 0) {
      matches.push({
        item,
        merchantName,
        score,
        matchType,
        index: i
      });
      console.log(`✅ MATCH FOUND at item ${i}: "${merchantName}" (score: ${score}, type: ${matchType})`);
    }
  }
  
  // Debug: Log all matches found
  console.log(`🎯 Found ${matches.length} total matches:`);
  matches.forEach((match, i) => {
    console.log(`  ${i}: "${match.merchantName}" at index ${match.index} (score: ${match.score}, type: ${match.matchType})`);
  });
  
  // Find the best match (highest score, if tied then prefer later position for exact matches)
  if (matches.length > 0) {
    const bestMatch = matches.reduce((best, current) => {
      if (current.score > best.score) return current;
      if (current.score === best.score) {
        // For exact matches (score >= 800), prefer later in list
        // For partial matches, prefer earlier in list
        if (current.score >= 800) {
          return current.index > best.index ? current : best;
        } else {
          return current.index < best.index ? current : best;
        }
      }
      return best;
    });
    
    console.log(`🎯 Best match: "${bestMatch.merchantName}" at index ${bestMatch.index} (score: ${bestMatch.score})`);
    
    // Highlight the best match (previous highlights already cleared at start of function)
    bestMatch.item.classList.add('highlighted');
    console.log('🎯 Applied highlighted class to merchant item');
    console.log('🎯 Item classes after highlighting:', bestMatch.item.className);
    
    // Verify highlighting is still there after a longer delay
    setTimeout(() => {
      const stillHighlighted = bestMatch.item.classList.contains('highlighted');
      console.log('🎯 Highlighting still present after 500ms:', stillHighlighted);
      if (!stillHighlighted) {
        console.log('⚠️ Highlighting was removed! Re-applying...');
    bestMatch.item.classList.add('highlighted');
      }
    }, 500);
      
      // Scroll to found merchant using scrollIntoView for better reliability
      console.log('📍 Scrolling to found merchant in validation results');
    console.log(`📍 Found "${bestMatch.merchantName}" at index ${bestMatch.index} of ${merchantItems.length} items`);
    
      // Use scrollIntoView for reliable scrolling
            bestMatch.item.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
              inline: 'nearest'
            });
      
      console.log('📍 Applied scrollIntoView to center the merchant');
    
    // Show success feedback
    showToast(`Found: ${bestMatch.merchantName}`, 'success');
    
    return; // Found best match, exit early
  }
  
  // If we reach here, no matches were found
    console.log('❌ No matches found for:', searchTerm);
    showToast(`No merchants found matching "${searchTerm}"`, 'error');
  
  // Clear search input after search
  if (currentSearchInput) {
    currentSearchInput.value = '';
  }
}

// Testing window functions removed (testing window eliminated)

// Test function to simulate search
function testMerchantSearch() {
  console.log('🧪 Testing merchant search functionality');
  console.log('🧪 testingMerchants available:', testingMerchants?.length);
  console.log('🧪 testingControlsActive:', testingControlsActive);
  
  if (testingMerchants && testingMerchants.length > 0) {
    console.log('🧪 First few merchants:', testingMerchants.slice(0, 3).map(m => m.name));
    
    // Try jumping to merchant index 1 (second merchant)
    if (testingMerchants.length > 1) {
      console.log('🧪 Testing jump to index 1');
      jumpToMerchantInTesting(1);
    }
  } else {
    console.log('🧪 No testing merchants available for test');
  }
}

// Debug function to test search input
function testSearchInput() {
  console.log('🧪 Testing search input element');
  
  const input = document.getElementById('merchantTestingSearchInput');
  const button = document.getElementById('merchantTestingSearchBtn');
  
  console.log('🧪 Input element found:', !!input);
  console.log('🧪 Button element found:', !!button);
  
  if (input) {
    console.log('🧪 Input current value:', `"${input.value}"`);
    console.log('🧪 Input type:', input.type);
    console.log('🧪 Input placeholder:', input.placeholder);
    
    // Set a test value
    input.value = 'best';
    console.log('🧪 Set test value "best"');
    
    // Try calling search function
    console.log('🧪 Calling searchMerchantsInTesting...');
    searchMerchantsInTesting();
  }
  
  if (button) {
    console.log('🧪 Button text:', button.textContent);
    console.log('🧪 Button click test...');
    button.click();
  }
}

function clearSearchHighlights() {
  console.log('🧹 Clearing search highlights (preserving status colors)');
  console.log('🧹 Call stack:', new Error().stack);
  const foundList = document.getElementById('foundList');
  if (foundList) {
    const highlightedItems = foundList.querySelectorAll('.merchant-item.highlighted');
    console.log(`🧹 Found ${highlightedItems.length} highlighted items to clear`);
    highlightedItems.forEach(item => {
      // Only remove the 'highlighted' class, preserve status classes
      item.classList.remove('highlighted');
      console.log('🧹 Removed highlighted class from item, remaining classes:', item.className);
    });
  }
}

// Autocomplete functionality for search

function showAutocomplete(searchTerm) {
  console.log('🔍 showAutocomplete called with:', searchTerm);
  console.log('🔍 currentValidation exists:', !!currentValidation);
  console.log('🔍 foundMerchants exists:', !!(currentValidation && currentValidation.foundMerchants));
  console.log('🔍 merchantDatabase length:', merchantDatabase.length);
  console.log('🔍 searchTerm length:', searchTerm.length);
  
  if (searchTerm.length < 2) {
    console.log('🔍 Hiding autocomplete - search term too short');
    hideAutocomplete();
    return;
  }
  
  // Use validation results if available, otherwise use merchant database
  let merchantsToSearch = [];
  if (currentValidation && currentValidation.foundMerchants) {
    console.log('🔍 Using validation results for autocomplete');
    merchantsToSearch = currentValidation.foundMerchants;
  } else if (merchantDatabase && merchantDatabase.length > 0) {
    console.log('🔍 Using merchant database for autocomplete');
    merchantsToSearch = merchantDatabase;
  } else {
    console.log('🔍 No merchants available for autocomplete');
    hideAutocomplete();
    return;
  }
  
  const matches = [];
  const lowercaseSearchTerm = searchTerm.toLowerCase();
  
  merchantsToSearch.forEach((merchant, index) => {
    const merchantName = merchant.name.toLowerCase();
    
    if (merchantName.includes(lowercaseSearchTerm)) {
      // Calculate relevance score
      let score = 0;
      if (merchantName.startsWith(lowercaseSearchTerm)) {
        score = 1000; // Starts with search term
      } else if (merchantName.includes(' ' + lowercaseSearchTerm)) {
        score = 500; // Word boundary match
      } else {
        score = 100; // Contains search term
      }
      
      matches.push({
        merchant,
        index,
        score,
        name: merchant.name
      });
    }
  });
  
  // Sort by relevance
  matches.sort((a, b) => b.score - a.score);
  
  // Limit to top 5 results
  const limitedMatches = matches.slice(0, 5);
  
  if (limitedMatches.length === 0) {
    hideAutocomplete();
    return;
  }
  
  // Build autocomplete HTML
  console.log('🔍 Building autocomplete with', limitedMatches.length, 'matches');
  searchAutocomplete.innerHTML = '';
  limitedMatches.forEach((match, index) => {
    const item = document.createElement('div');
    item.className = 'autocomplete-item';
    item.dataset.index = index;
    item.dataset.merchantIndex = match.index;
    
    // Clean merchant name for display (convert trailing backslashes to apostrophes)
    const cleanMerchantName = match.name.replace(/\\+$/, "'s");
    // Highlight matching part and add navigation indicator
    const highlightedName = highlightSearchTerm(cleanMerchantName, searchTerm);
    item.innerHTML = `${highlightedName} <span style="float: right; color: #6c757d; font-size: 12px;">→</span>`;
    
    // Add click handler with visual feedback
    item.addEventListener('click', (e) => {
      console.log('🎯 Autocomplete item clicked:', match.name, 'index:', match.index);
      e.preventDefault();
      e.stopPropagation();
      
      // Add visual feedback for the click
      item.style.background = '#007bff';
      item.style.color = 'white';
      
      // Immediately set the search input and call search function
      console.log('🎯 Direct autocomplete handling for:', match.name);
      const searchInput = document.getElementById('merchantSearchInput');
      if (searchInput) {
        // Use clean merchant name for input (convert trailing backslashes to apostrophes)
        const cleanMerchantName = match.name.replace(/\\+$/, "'s");
        searchInput.value = cleanMerchantName;
        console.log('🎯 Set search input to:', searchInput.value);
        
        // Hide autocomplete immediately
        hideAutocomplete();
        
        // Call search function directly with a small delay
        setTimeout(() => {
          console.log('🎯 Calling searchMerchantInResults from autocomplete click');
          searchMerchantInResults();
        }, 100);
      } else {
        console.error('🎯 Search input not found in autocomplete click handler');
      }
    });
    
    // Add hover effect
    item.addEventListener('mouseenter', () => {
      item.style.background = '#f8f9fa';
    });
    
    item.addEventListener('mouseleave', () => {
      if (!item.classList.contains('selected')) {
        item.style.background = '';
      }
    });
    
    searchAutocomplete.appendChild(item);
  });
  
  searchAutocomplete.style.display = 'block';
  selectedAutocompleteIndex = -1;
  console.log('🔍 Autocomplete displayed with', limitedMatches.length, 'items');
}

function highlightSearchTerm(text, searchTerm) {
  const regex = new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi');
  return text.replace(regex, '<span class="autocomplete-match">$1</span>');
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hideAutocomplete() {
  if (searchAutocomplete) {
    searchAutocomplete.style.display = 'none';
    selectedAutocompleteIndex = -1;
  }
}

function selectAutocompleteItem(merchantName, merchantIndex) {
  console.log('🎯 selectAutocompleteItem called with:', merchantName, 'index:', merchantIndex);
  
  // Get fresh reference to search input
  const currentSearchInput = document.getElementById('merchantSearchInput');
  if (currentSearchInput) {
    console.log('🎯 Setting search input value to:', merchantName);
    currentSearchInput.value = merchantName;
    console.log('🎯 Search input value after setting:', currentSearchInput.value);
  } else {
    console.error('🎯 Search input not found!');
    return;
  }
  
  hideAutocomplete();
  
  // Add a small delay to ensure the input value is set before searching
  console.log('🎯 About to call searchMerchantInResults with value:', currentSearchInput.value);
  
  // Use the same search function as the search button for identical behavior
  setTimeout(() => {
    console.log('🎯 Calling searchMerchantInResults (same as search button)');
    console.log('🎯 Current search input value before search:', document.getElementById('merchantSearchInput')?.value);
    searchMerchantInResults();
  }, 50); // Small delay to ensure DOM is updated
}

// Autocomplete now uses the same searchMerchantInResults function as the search button

function handleAutocompleteKeydown(e) {
  const items = searchAutocomplete.querySelectorAll('.autocomplete-item');
  
  if (items.length === 0) return;
  
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      selectedAutocompleteIndex = Math.min(selectedAutocompleteIndex + 1, items.length - 1);
      updateAutocompleteSelection(items);
      break;
      
    case 'ArrowUp':
      e.preventDefault();
      selectedAutocompleteIndex = Math.max(selectedAutocompleteIndex - 1, -1);
      updateAutocompleteSelection(items);
      break;
      
    case 'Enter':
    case 'Tab':
      e.preventDefault();
      let targetItem = null;
      let merchantName = '';
      
      if (selectedAutocompleteIndex >= 0) {
        targetItem = items[selectedAutocompleteIndex];
        const merchantIndex = parseInt(targetItem.dataset.merchantIndex);
        merchantName = currentValidation.foundMerchants[merchantIndex].name;
      } else if (items.length > 0) {
        // If no item is selected but autocomplete is showing, select the first item
        targetItem = items[0];
        const merchantIndex = parseInt(targetItem.dataset.merchantIndex);
        merchantName = currentValidation.foundMerchants[merchantIndex].name;
      }
      
      if (targetItem && merchantName) {
        console.log('🎯 Autocomplete keyboard selection:', merchantName);
        
        // Set search input immediately (use clean merchant name)
        const searchInput = document.getElementById('merchantSearchInput');
        if (searchInput) {
          // Use clean merchant name for input (convert trailing backslashes to apostrophes)
          const cleanMerchantName = merchantName.replace(/\\+$/, "'s");
          searchInput.value = cleanMerchantName;
          console.log('🎯 Set search input to:', searchInput.value);
          
          // Hide autocomplete immediately
          hideAutocomplete();
          
          // Call search function directly
          setTimeout(() => {
            console.log('🎯 Calling searchMerchantInResults from keyboard selection');
            searchMerchantInResults();
          }, 100);
        }
      }
      break;
      
    case 'Escape':
      hideAutocomplete();
      break;
  }
}

function updateAutocompleteSelection(items) {
  items.forEach((item, index) => {
    item.classList.toggle('selected', index === selectedAutocompleteIndex);
  });
}

// Setup keyboard navigation for validation results
function setupValidationKeyboardNavigation() {
  console.log('⌨️ Setting up validation results keyboard navigation');
  
  const foundList = document.getElementById('foundList');
  if (!foundList) {
    console.error('❌ foundList not found for keyboard navigation');
    return;
  }
  
  // Reset selection index
  selectedValidationIndex = -1;
  
  // Remove any existing keyboard listeners to avoid duplicates
  foundList.removeEventListener('keydown', handleValidationKeydown);
  
  // Make the found list focusable
  foundList.setAttribute('tabindex', '0');
  
  // Add keyboard event listener
  foundList.addEventListener('keydown', handleValidationKeydown);
  
  console.log('✅ Validation keyboard navigation setup complete');
}

// Handle keyboard navigation in validation results
function handleValidationKeydown(e) {
  const foundList = document.getElementById('foundList');
  if (!foundList) return;
  
  const merchantItems = foundList.querySelectorAll('.merchant-item');
  if (merchantItems.length === 0) return;
  
  console.log('⌨️ Validation key pressed:', e.key, 'Current index:', selectedValidationIndex);
  
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      selectedValidationIndex = Math.min(selectedValidationIndex + 1, merchantItems.length - 1);
      updateValidationSelection(merchantItems);
      scrollToSelectedValidationItem(merchantItems[selectedValidationIndex]);
      break;
      
    case 'ArrowUp':
      e.preventDefault();
      selectedValidationIndex = Math.max(selectedValidationIndex - 1, -1);
      updateValidationSelection(merchantItems);
      if (selectedValidationIndex >= 0) {
        scrollToSelectedValidationItem(merchantItems[selectedValidationIndex]);
      }
      break;
      
    case 'Enter':
      e.preventDefault();
      if (selectedValidationIndex >= 0) {
        const selectedItem = merchantItems[selectedValidationIndex];
        const merchantNameElement = selectedItem.querySelector('.merchant-name');
        if (merchantNameElement) {
          const merchantName = merchantNameElement.textContent;
          console.log('⌨️ Validation Enter pressed for:', merchantName);
          
          // Highlight the selected merchant (same as search)
          clearSearchHighlights();
          selectedItem.classList.add('highlighted');
          
          // Show feedback
          showToast(`Selected: ${merchantName}`, 'success');
        }
      }
      break;
      
    case 'Escape':
      e.preventDefault();
      selectedValidationIndex = -1;
      updateValidationSelection(merchantItems);
      foundList.blur(); // Remove focus from the list
      break;
  }
}

// Update visual selection in validation results
function updateValidationSelection(items) {
  items.forEach((item, index) => {
    if (index === selectedValidationIndex) {
      item.classList.add('keyboard-selected');
      item.style.backgroundColor = '#e3f2fd';
      item.style.border = '2px solid #2196f3';
    } else {
      item.classList.remove('keyboard-selected');
      item.style.backgroundColor = '';
      item.style.border = '';
    }
  });
}

// Scroll to the selected validation item
function scrollToSelectedValidationItem(item) {
  if (!item) return;
  
  const foundList = document.getElementById('foundList');
  if (!foundList) return;
  
  // Calculate scroll position to center the item
  const containerHeight = foundList.clientHeight;
  const itemHeight = item.offsetHeight;
  const itemOffsetTop = item.offsetTop;
  
  const targetScrollTop = itemOffsetTop - (containerHeight / 2) + (itemHeight / 2);
  const maxScrollTop = foundList.scrollHeight - containerHeight;
  const finalScrollTop = Math.max(0, Math.min(targetScrollTop, maxScrollTop));
  
  foundList.scrollTo({
    top: finalScrollTop,
    behavior: 'smooth'
  });
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'testProgress') {
    handleTestProgress(message.progress);
  } else if (message.action === 'testCompleted') {
    handleTestCompleted(message.results);
  } else if (message.action === 'controlsInjected') {
    handleControlsInjected(message);
  }
  
  sendResponse({ success: true });
});


// Load merchant database from the generated merchant-list.json
async function loadMerchantDatabase() {
  try {
    console.log('🚀 LOADING MERCHANT DATABASE FROM CITILIST.TXT - THIS IS THE CORRECT FUNCTION');
    console.log('📚 Loading merchant database...');
    console.log('🌐 Browser:', navigator.userAgent.includes('Edg') ? 'Microsoft Edge' : 'Other');
    
    // Check if database is already loaded
    if (merchantDatabase && merchantDatabase.length > 0) {
      console.log('✅ Merchant database already loaded, skipping reload');
      return;
    }
    
    // Try to load from storage first
    const stored = await chrome.storage.local.get(['merchantDatabase', 'databaseVersion']);
    
    if (stored.merchantDatabase && stored.merchantDatabase.length > 0) {
      console.log('📦 Loading merchant database from storage...');
      merchantDatabase = stored.merchantDatabase;
      console.log(`✅ Loaded ${merchantDatabase.length} merchants from storage`);
      return;
    }
    
    console.log('🔄 No cached database found, loading fresh from file...');
    
        // Use the converted JSON file
        const databaseFileName = 'merchant-list.json';
    const merchantListUrl = chrome.runtime.getURL(databaseFileName);
    console.log('📂 Merchant list URL:', merchantListUrl);
        console.log('📂 Using database file:', databaseFileName, '(Converted from citiList.txt)');
    
    let response;
    try {
      response = await fetch(merchantListUrl);
      console.log('📡 Fetch response status:', response.status, response.statusText);
      console.log('📡 Fetch response ok:', response.ok);
    } catch (fetchError) {
      console.error('❌ Fetch failed:', fetchError);
      throw new Error(`Failed to fetch merchant database: ${fetchError.message}`);
    }
    
    if (response.ok) {
      let database;
      try {
        const responseText = await response.text();
        console.log('📄 Response text length:', responseText.length);
        console.log('📄 Response text preview:', responseText.substring(0, 200) + '...');
        
        // Check if response text is complete by looking for the closing brace
        const hasClosingBrace = responseText.trim().endsWith('}');
        console.log('📄 Response has closing brace:', hasClosingBrace);
        
        // Check for JSON completeness markers
        const hasStatsSection = responseText.includes('"stats"');
        const hasTotalMerchants = responseText.includes('"totalMerchants"');
        console.log('📄 Response completeness check:');
        console.log('  Has stats section:', hasStatsSection);
        console.log('  Has totalMerchants:', hasTotalMerchants);
        
        // Parse the JSON directly (no conversion needed)
        let merchantArray;
        try {
          console.log('🔍 Parsing JSON from merchant-list.json...');
          console.log('🔍 Response text length:', responseText.length);
          console.log('🔍 First 200 chars:', responseText.substring(0, 200));
          console.log('🔍 Last 200 chars:', responseText.slice(-200));
          
          // Parse the JSON directly
          const merchantData = JSON.parse(responseText);
          console.log('✅ JSON parsing successful');
          console.log('🔍 Parsed data structure:', {
            hasMerchants: !!merchantData.merchants,
            merchantCount: merchantData.merchants?.length || 0,
            totalMerchants: merchantData.totalMerchants || 0,
            lastUpdated: merchantData.lastUpdated || 'N/A'
          });
          
          // Extract merchants array
          merchantArray = merchantData.merchants || [];
          console.log('🔍 Extracted merchant count:', merchantArray.length);
          
        } catch (parseError) {
          console.error('❌ JSON parsing failed:', parseError);
          console.log('📄 First 200 chars of response:', responseText.substring(0, 200));
          console.log('📄 Last 200 chars of response:', responseText.slice(-200));
          throw new Error(`Failed to parse merchant database: ${parseError.message}`);
        }
        
        // Now use merchantArray outside the try block
        console.log('Loading fresh merchant database from merchant-list.json');
        merchantDatabase = merchantArray;
        
        console.log('📊 Parsed merchant array structure:', {
          merchantCount: merchantArray?.length || 0,
          firstMerchant: merchantArray?.[0]?.name || 'N/A',
          lastMerchant: merchantArray?.[merchantArray.length - 1]?.name || 'N/A'
        });
        
        // Check if merchants array is valid
        if (merchantArray && merchantArray.length > 0) {
             console.log('🔍 First 3 merchants:', merchantArray.slice(0, 3).map(m => m.name));
             console.log('🔍 Last 3 merchants:', merchantArray.slice(-3).map(m => m.name));
             console.log('🔍 Total merchants loaded:', merchantArray.length);
             
             // Debug: Check for specific merchants that should be in the database
             
             
             
            
            // Check if the merchants array appears to be cut off mid-stream
          if (merchantArray.length < 100) {
              console.warn('⚠️ Very few merchants loaded - likely a parsing or memory issue');
          }
          
          // Test if Renpho is in the loaded merchants
          const renphoTest = merchantArray.find(m => m.name.toLowerCase().includes('renpho'));
          console.log('🔍 Renpho test:', renphoTest ? `Found: ${renphoTest.name}` : 'NOT FOUND in loaded merchants');
        }
      } catch (parseError) {
        console.error('❌ JSON parse failed:', parseError);
        throw new Error(`Failed to parse merchant database: ${parseError.message}`);
      }
      
      // merchantDatabase is already assigned above
        
        if (!merchantDatabase || merchantDatabase.length === 0) {
        console.error('❌ No merchants found in merchant-list.json');
          throw new Error('Merchant database is empty or invalid');
        }
        
        // Debug: Check if Kiehl's is in the new database
        const kiehls = merchantDatabase.find(m => m.name.toLowerCase().includes('kiehl'));
        console.log('🔍 Kiehl\'s in fresh database:', kiehls ? `"${kiehls.name}"` : 'NOT FOUND');
        
      // Note: Some merchant names legitimately contain backslashes (e.g., "Kohl\\", "Kiehl\\")
      // These are not corrupted data, so we don't need to check for them
      
      // Save to storage with current timestamp as version
      const currentVersion = new Date().toISOString();
        await chrome.storage.local.set({ 
          merchantDatabase: merchantDatabase,
        databaseVersion: currentVersion,
        databaseMetadata: { source: 'citiList.txt', loadedAt: currentVersion }
        });
        
      console.log(`✅ Successfully loaded ${merchantDatabase.length} merchants from citiList.txt`);
      console.log('🔍 First 10 merchants from database:', merchantDatabase.slice(0, 10).map(m => m.name));
      showToast(`Loaded ${merchantDatabase.length} merchants from citiList.txt`, 'success');
      } else {
      console.error('❌ Failed to fetch merchant database, response not ok');
      throw new Error(`Failed to fetch merchant database: ${response.status} ${response.statusText}`);
    }
    
    // Final validation
    if (!merchantDatabase || merchantDatabase.length === 0) {
      throw new Error('No merchant database available - all loading methods failed');
    }
    
    console.log('✅ Merchant database loaded successfully:', merchantDatabase.length, 'merchants');
    
  } catch (error) {
    console.error('❌ Error loading merchant database:', error);
    throw error;
  }
}

// Find merchant match with fuzzy matching for apostrophes and variations
function findMerchantMatch(inputName, merchantDatabase) {
  // Debug for Kohl's and other apostrophe merchants
  const isApostropheMerchant = inputName.toLowerCase().includes("'") || inputName.toLowerCase().includes("'");
  
  if (isApostropheMerchant) {
    console.log(`🔍 FINDING MATCH for: "${inputName}"`);
  }
  
  const normalizedInput = normalizeMerchantName(inputName);
  
  // First try exact match (case-insensitive)
  let match = merchantDatabase.find(
    merchant => merchant.name.toLowerCase() === inputName.toLowerCase()
  );
  
  // If no exact match, try with apostrophe normalization
  if (!match) {
    const normalizedInput = inputName.toLowerCase().replace(/'/g, "'").replace(/'/g, "'");
    match = merchantDatabase.find(
      merchant => {
        const normalizedMerchant = merchant.name.toLowerCase().replace(/'/g, "'").replace(/'/g, "'");
        return normalizedMerchant === normalizedInput;
      }
    );
  }
  
  // If still no match, try matching against merchants with trailing backslashes
  // (these are converted from escaped apostrophes in the database)
  if (!match) {
    const inputWithBackslash = inputName.toLowerCase().replace(/'/g, '\\').replace(/'/g, '\\');
    match = merchantDatabase.find(
      merchant => {
        const merchantWithBackslash = merchant.name.toLowerCase();
        // Only match if the merchant name ends with backslash and matches the input
        return merchantWithBackslash === inputWithBackslash && merchantWithBackslash.endsWith('\\');
      }
    );
  }
  
  if (match) {
    if (isApostropheMerchant) {
      console.log(`✅ EXACT MATCH: "${match.name}"`);
    }
    return match;
  } else {
    if (isApostropheMerchant) {
      console.log(`❌ No exact match for: "${inputName}"`);
    }
  }
  
  // Try normalized match (handles apostrophes, spaces, etc.)
  match = merchantDatabase.find(
    merchant => normalizeMerchantName(merchant.name) === normalizedInput
  );
  
  // If still no match, try with more flexible apostrophe handling
  if (!match) {
    const flexibleInput = inputName.toLowerCase()
      .replace(/[''`]/g, "'") // Normalize all apostrophe types to standard apostrophe
      .trim();
    
    match = merchantDatabase.find(
      merchant => {
        const flexibleMerchant = merchant.name.toLowerCase()
          .replace(/[''`]/g, "'") // Normalize all apostrophe types to standard apostrophe
          .trim();
        return flexibleMerchant === flexibleInput;
      }
    );
  }
  
  if (match) {
    if (isApostropheMerchant) {
      console.log(`✅ NORMALIZED MATCH: "${match.name}"`);
    }
    return match;
  }
  
  // Try partial matches for common variations (only for longer names to avoid false matches)
  if (inputName.length >= 3) {
  match = merchantDatabase.find(merchant => {
    const merchantNormalized = normalizeMerchantName(merchant.name);
    const inputNormalized = normalizedInput;
    
      // Only match if the input is a significant part of the merchant name
      // or if the merchant name is a significant part of the input
      const isMatch = (merchantNormalized.includes(inputNormalized) && inputNormalized.length >= 3) || 
                     (inputNormalized.includes(merchantNormalized) && merchantNormalized.length >= 3);
      
      if (isMatch && isApostropheMerchant) {
        console.log(`✅ PARTIAL MATCH: "${merchant.name}"`);
    }
    
    return isMatch;
  });
  }
  
  if (!match && isApostropheMerchant) {
    console.log(`❌ NO MATCH FOUND for: "${inputName}"`);
  }
  
  return match || null;
}

// Normalize merchant names for better matching
function normalizeMerchantName(name) {
  return name
    .toLowerCase()
    .replace(/'/g, "'") // Normalize apostrophes: "Dick's" -> "dick's"
    .replace(/'/g, "'") // Normalize smart quotes: "Dick's" -> "dick's"
    .replace(/`/g, "'") // Normalize backticks
    .replace(/&/g, 'and') // Replace & with "and": "H&M" -> "handm"
    .replace(/\+/g, '') // Remove plus signs: "Malin+Goetz" -> "malingoetz"
    .replace(/[^\w\s']/g, '') // Remove other special characters but keep apostrophes
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

// Main input autocomplete functionality
let mainAutocompleteContainer = null;
let selectedMainAutocompleteIndex = -1;

// Button navigation system
let currentButtonIndex = -1;
const navigationButtons = ['validateBtn', 'sampleBtn', 'clearBtn'];

function setupMainAutocomplete() {
  const input = merchantInput.value.trim();
  
  if (!input || input.length < 2) {
    hideMainAutocomplete();
    return;
  }
  
  if (!merchantDatabase || merchantDatabase.length === 0) {
    console.log('⚠️ Merchant database not loaded for autocomplete');
    return;
  }
  
  // Find matching merchants
  const matches = merchantDatabase.filter(merchant => {
    const merchantName = merchant.name.toLowerCase();
    const normalizedMerchant = normalizeMerchantName(merchant.name);
    const normalizedInput = normalizeMerchantName(input);
    
    return merchantName.includes(input.toLowerCase()) || 
           normalizedMerchant.includes(normalizedInput);
  }).slice(0, 10); // Limit to 10 suggestions
  
  if (matches.length === 0) {
    hideMainAutocomplete();
    return;
  }
  
  showMainAutocomplete(matches);
}

function showMainAutocomplete(matches) {
  // Remove existing autocomplete
  hideMainAutocomplete();
  
  // Create autocomplete container
  mainAutocompleteContainer = document.createElement('div');
  mainAutocompleteContainer.id = 'main-autocomplete';
  mainAutocompleteContainer.className = 'main-autocomplete';
  
  // Style the autocomplete
  Object.assign(mainAutocompleteContainer.style, {
    position: 'absolute',
    top: '100%',
    left: '0',
    right: '0',
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderTop: 'none',
    borderRadius: '0 0 4px 4px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    zIndex: '1000',
    maxHeight: '200px',
    overflowY: 'auto'
  });
  
  // Add matches
  matches.forEach((merchant, index) => {
    const item = document.createElement('div');
    item.className = 'main-autocomplete-item';
    // Clean merchant name for display (convert trailing backslashes to apostrophes)
    const cleanMerchantName = merchant.name.replace(/\\+$/, "'s");
    item.textContent = cleanMerchantName;
    item.dataset.index = index;
    
    // Style the item
    Object.assign(item.style, {
      padding: '8px 12px',
      cursor: 'pointer',
      borderBottom: '1px solid #eee'
    });
    
    // Add hover effect
    item.addEventListener('mouseenter', () => {
      selectedMainAutocompleteIndex = index;
      updateMainAutocompleteSelection();
    });
    
    item.addEventListener('click', () => {
      selectMainAutocompleteItem(merchant);
    });
    
    mainAutocompleteContainer.appendChild(item);
  });
  
  // Position relative to input
  const inputContainer = merchantInput.parentElement;
  inputContainer.style.position = 'relative';
  inputContainer.appendChild(mainAutocompleteContainer);
  
  selectedMainAutocompleteIndex = -1;
  updateMainAutocompleteSelection();
}

function hideMainAutocomplete() {
  if (mainAutocompleteContainer) {
    mainAutocompleteContainer.remove();
    mainAutocompleteContainer = null;
  }
  selectedMainAutocompleteIndex = -1;
}

function updateMainAutocompleteSelection() {
  if (!mainAutocompleteContainer) return;
  
  const items = mainAutocompleteContainer.querySelectorAll('.main-autocomplete-item');
  items.forEach((item, index) => {
    if (index === selectedMainAutocompleteIndex) {
      item.style.backgroundColor = '#e3f2fd';
      item.style.color = '#1976d2';
    } else {
      item.style.backgroundColor = '';
      item.style.color = '';
    }
  });
}

function selectMainAutocompleteItem(merchant) {
  // Add the merchant to the input (append to existing content)
  const currentValue = merchantInput.value.trim();
  const newValue = currentValue ? `${currentValue}\n${merchant.name}` : merchant.name;
  merchantInput.value = newValue;
  
  hideMainAutocomplete();
  merchantInput.focus();
}

function handleMainAutocompleteKeydown(e) {
  if (!mainAutocompleteContainer) return;
  
  const items = mainAutocompleteContainer.querySelectorAll('.main-autocomplete-item');
  if (items.length === 0) return;
  
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      // If at last item, navigate to buttons
      if (selectedMainAutocompleteIndex >= items.length - 1) {
        hideMainAutocomplete();
        navigateToButtons();
        return;
      }
      selectedMainAutocompleteIndex = (selectedMainAutocompleteIndex + 1) % items.length;
      updateMainAutocompleteSelection();
      break;
      
    case 'ArrowUp':
      e.preventDefault();
      // If at first item, navigate to buttons
      if (selectedMainAutocompleteIndex <= 0) {
        hideMainAutocomplete();
        navigateToButtons();
        return;
      }
      selectedMainAutocompleteIndex = selectedMainAutocompleteIndex <= 0 ? items.length - 1 : selectedMainAutocompleteIndex - 1;
      updateMainAutocompleteSelection();
      break;
      
    case 'Enter':
    case 'Tab':
      e.preventDefault();
      if (selectedMainAutocompleteIndex >= 0 && selectedMainAutocompleteIndex < items.length) {
        const targetItem = items[selectedMainAutocompleteIndex];
        const merchantName = targetItem.textContent;
        const currentValue = merchantInput.value.trim();
        const newValue = currentValue ? `${currentValue}\n${merchantName}` : merchantName;
        merchantInput.value = newValue;
        hideMainAutocomplete();
      }
      break;
      
    case 'Escape':
      hideMainAutocomplete();
      break;
  }
}

// Navigation functions
function navigateToButtons() {
  currentButtonIndex = 0;
  highlightCurrentButton();
}

function navigateToInput() {
  currentButtonIndex = -1;
  clearButtonHighlights();
  merchantInput.focus();
}

function highlightCurrentButton() {
  clearButtonHighlights();
  
  if (currentButtonIndex >= 0 && currentButtonIndex < navigationButtons.length) {
    const buttonId = navigationButtons[currentButtonIndex];
    const button = document.getElementById(buttonId);
    if (button) {
      button.style.outline = '2px solid #007bff';
      button.style.outlineOffset = '2px';
    }
  }
}

function clearButtonHighlights() {
  navigationButtons.forEach(buttonId => {
    const button = document.getElementById(buttonId);
    if (button) {
      button.style.outline = '';
      button.style.outlineOffset = '';
    }
  });
}

function handleButtonNavigation(e) {
  if (currentButtonIndex === -1) return; // Not in button navigation mode
  
  switch (e.key) {
    case 'ArrowDown':
    case 'ArrowRight':
      e.preventDefault();
      currentButtonIndex = (currentButtonIndex + 1) % navigationButtons.length;
      highlightCurrentButton();
      break;
      
    case 'ArrowUp':
    case 'ArrowLeft':
      e.preventDefault();
      // If at first button, go back to input
      if (currentButtonIndex <= 0) {
        navigateToInput();
        return;
      }
      currentButtonIndex = currentButtonIndex - 1;
      highlightCurrentButton();
      break;
      
    case 'Enter':
    case ' ':
      e.preventDefault();
      if (currentButtonIndex >= 0 && currentButtonIndex < navigationButtons.length) {
        const buttonId = navigationButtons[currentButtonIndex];
        const button = document.getElementById(buttonId);
        if (button) {
          button.click();
        }
      }
      break;
      
    case 'Escape':
      e.preventDefault();
      navigateToInput();
      break;
  }
}

// Get sample merchants as fallback
function getSampleMerchants() {
  return [
    { name: 'Ulta', url: 'https://www.ulta.com/' },
    { name: 'Best Buy', url: 'https://www.bestbuy.com/' },
    { name: 'Kohl\'s', url: 'https://www.kohls.com/' },
    { name: 'Macy\'s', url: 'https://www.macys.com/' },
    { name: 'Sephora', url: 'https://www.sephora.com/' },
    { name: 'StubHub', url: 'https://www.stubhub.com/' },
    { name: 'LL Bean', url: 'https://www.llbean.com/' },
    { name: 'Gap', url: 'https://www.gap.com/' },
    { name: 'Total Wine', url: 'https://www.totalwine.com/' },
    { name: 'PetSafe', url: 'https://www.petsafe.com/' },
    { name: 'PetSmart', url: 'https://www.petsmart.com/' },
    { name: 'Dick\'s', url: 'https://www.dickssportinggoods.com/' },
    { name: 'TEVA', url: 'https://www.teva.com/' },
    { name: 'ASICS', url: 'https://www.asics.com/' },
    { name: 'Old Navy', url: 'https://www.oldnavy.com/' },
    { name: 'Crocs', url: 'https://www.crocs.com/' },
    { name: 'Bombas', url: 'https://www.bombas.com/' },
    { name: 'Saks Fifth Avenue', url: 'https://www.saksfifthavenue.com/' },
    { name: 'Solo Stove', url: 'https://www.solostove.com/' },
    { name: 'KitchenAid', url: 'https://www.kitchenaid.com/' }
  ];
}

// Load sample merchants
function loadSampleMerchants() {
  merchantInput.value = sampleMerchants.join('\n');
  merchantInput.focus();
}

// Clear all inputs and sections
async function clearAll() {
  console.log('🗑️ clearAll() called - clearing all validation results and state');
  
  // Clear input
  merchantInput.value = '';
  
  // Hide sections
  resultsSection.style.display = 'none';
  codeSection.style.display = 'none';
  
  // Clear validation data
  currentValidation = null;
  
  // Clear filter state
  currentValidationFilter = null;
  saveFilterState();
  
  // Clear validation results from DOM
  const foundList = document.getElementById('foundList');
  if (foundList) {
    foundList.innerHTML = '';
    console.log('🗑️ Cleared foundList innerHTML');
  }
  
  const notFoundList = document.getElementById('notFoundList');
  if (notFoundList) {
    notFoundList.innerHTML = '';
    console.log('🗑️ Cleared notFoundList innerHTML');
  }
  
  // Reset testing state completely
  await resetTestingState();
  
  // Clear search highlights
  clearSearchHighlights();
  
  // Reset validation status counts
  updateValidationStatusCounts();
  
  // Clear saved state
  saveExtensionState();
  
  // Focus input
  merchantInput.focus();
  
  console.log('✅ clearAll() completed - all validation results cleared');
  showToast('All cleared!', 'success');
}

// Validate merchants against database
async function validateMerchants() {
  const input = merchantInput.value.trim();
  
  console.log('🚀 Starting merchant validation in browser:', navigator.userAgent.includes('Edg') ? 'Microsoft Edge' : 'Other');
  console.log('📝 Input received:', input.substring(0, 100) + (input.length > 100 ? '...' : ''));
  
  if (!input) {
    showToast('Please enter at least one merchant name', 'error');
    return;
  }
  
  // Clear any pending crouton actions to prevent auto-marking
  await chrome.storage.local.remove(['pendingCroutonAction']);
  console.log('🧹 Cleared pending crouton actions before validation');
  
  showLoading('Validating merchants...');
  
  try {
    // Check if merchant database is loaded
    console.log('📊 Pre-validation database check:');
    console.log('  merchantDatabase exists:', !!merchantDatabase);
    console.log('  merchantDatabase length:', merchantDatabase?.length || 0);
    
    if (!merchantDatabase || merchantDatabase.length === 0) {
      console.warn('⚠️ Merchant database not loaded, attempting to load...');
      await loadMerchantDatabase();
      console.log('📊 Post-load database check:');
      console.log('  merchantDatabase exists:', !!merchantDatabase);
      console.log('  merchantDatabase length:', merchantDatabase?.length || 0);
      
      if (!merchantDatabase || merchantDatabase.length === 0) {
        throw new Error('Failed to load merchant database - no merchants available for validation');
      }
    }
    
    // Parse input merchants - handle both comma-separated and line-separated
    let inputMerchants;
    
    // Smart detection: if input has newlines, prioritize line-separated parsing
    // Only use comma-separated if there are no newlines and multiple commas
    const hasNewlines = input.includes('\n') || input.includes('\r');
    const commaCount = (input.match(/,/g) || []).length;
    const lineCount = input.split(/\r?\n/).filter(line => line.trim().length > 0).length;
    
    console.log('🔍 Input parsing analysis:');
    console.log('  Has newlines:', hasNewlines);
    console.log('  Comma count:', commaCount);
    console.log('  Line count:', lineCount);
    
    if (hasNewlines && lineCount > 1) {
      // Line-separated format (one merchant per line) - most common
      console.log('📋 Using line-separated parsing');
      inputMerchants = input
        .split(/\r?\n/)
        .map(name => name.trim())
        .filter(name => name.length > 0);
    } else if (!hasNewlines && commaCount > 0) {
      // Comma-separated format: "Ulta, Best Buy, Sephora"
      console.log('📋 Using comma-separated parsing');
      inputMerchants = input
        .split(',')
        .map(name => name.trim())
        .filter(name => name.length > 0);
    } else {
      // Single merchant or unclear format - treat as single item
      console.log('📋 Using single merchant parsing');
      inputMerchants = [input.trim()].filter(name => name.length > 0);
    }
    
    console.log('📋 Parsed merchants:', inputMerchants);
    console.log('📊 Total merchants to validate:', inputMerchants.length);
    
    const foundMerchants = [];
    const notFoundMerchants = [];
    
    // Validate each merchant
    console.log('🔍 Starting individual merchant validation...');
    inputMerchants.forEach((inputName, index) => {
    // Debug apostrophe merchants
    const isApostropheMerchant = inputName.toLowerCase().includes("'") || inputName.toLowerCase().includes("'");
    
    if (isApostropheMerchant) {
      console.log(`🔍 DEBUGGING "${inputName}" - Input characters:`, inputName.split('').map(c => c.charCodeAt(0)));
    }
    
      const matchingMerchant = findMerchantMatch(inputName, merchantDatabase);
      
      if (matchingMerchant) {
      if (isApostropheMerchant) {
        console.log(`✅ MATCH FOUND for "${inputName}": "${matchingMerchant.name}"`);
        console.log(`🔍 Matched URL: ${matchingMerchant.url}`);
        console.log(`🔍 Matched name characters:`, matchingMerchant.name.split('').map(c => c.charCodeAt(0)));
      }
        foundMerchants.push(matchingMerchant);
      } else {
      if (isApostropheMerchant) {
        console.log(`❌ NO MATCH for "${inputName}"`);
      }
        notFoundMerchants.push(inputName);
      }
    });
    
    console.log('📊 Validation results summary:');
    console.log('  Total input merchants:', inputMerchants.length);
    console.log('  Found merchants:', foundMerchants.length);
    console.log('  Not found merchants:', notFoundMerchants.length);
    console.log('  Found merchant names:', foundMerchants.map(m => m.name));
    console.log('  Not found names:', notFoundMerchants);
    
    currentValidation = {
      foundMerchants,
      notFoundMerchants,
      inputCount: inputMerchants.length,
      foundCount: foundMerchants.length
    };
    
    console.log('🎯 Displaying validation results...');
    displayValidationResults(currentValidation, true); // Auto-scroll when validate button is pressed
    
    // Session stats removed (stats section eliminated)
    // updateStatsDisplay call removed (stats section eliminated)
    // saveSessionStats call removed (stats section eliminated)
    
    // Save extension state after validation
    await saveExtensionState();
    
    hideLoading();
    
    console.log('✅ Merchant validation completed successfully');
    
  } catch (error) {
    console.error('❌ Validation failed with error:', error);
    hideLoading();
    showToast('Validation failed: ' + error.message, 'error');
  }
}

// Display validation results
function displayValidationResults(validation, shouldAutoScroll = false) {
  // Handle null validation object
  if (!validation) {
    console.log('📊 No validation results to display');
    return;
  }
  
  const { foundMerchants, notFoundMerchants, foundCount } = validation;
  
  // Apply current filter to found merchants
  let filteredMerchants = foundMerchants;
  let filteredCount = foundCount;
  
  if (currentValidationFilter && foundMerchants) {
    filteredMerchants = foundMerchants.filter(merchant => {
      const merchantKey = merchant.name.toLowerCase();
      const status = merchantStatuses[merchantKey];
      
      switch (currentValidationFilter) {
        case 'successful':
          return status === 'successful';
        case 'flagged':
          return status === 'flagged';
        case 'tested':
          return status === 'successful' || status === 'flagged';
        default:
          return true;
      }
    });
    filteredCount = filteredMerchants.length;
  }
  
  // Update found merchants
  const foundList = document.getElementById('foundList');
  const foundCountEl = document.getElementById('foundCount');
  foundList.innerHTML = '';
  foundCountEl.textContent = filteredCount;
  
  filteredMerchants.forEach(merchant => {
    const div = document.createElement('div');
    div.className = 'merchant-item';
    
    // Check merchant status for visual feedback - try multiple key formats
    const merchantKey1 = `${merchant.name}_${merchant.url}`; // Format: "Ulta_https://www.ulta.com"
    const merchantKey2 = merchant.name.toLowerCase(); // Format: "ulta"
    const merchantKey3 = merchant.name; // Format: "Ulta"
    
    let status = merchantStatuses[merchantKey1] || merchantStatuses[merchantKey2] || merchantStatuses[merchantKey3] || '';
    const statusClass = status ? `merchant-status-${status}` : '';
    
    // Debug logging
    console.log(`🔍 Merchant: ${merchant.name}`);
    console.log(`🔍 Merchant name length: ${merchant.name.length}`);
    console.log(`🔍 Merchant name chars: ${merchant.name.split('').map(c => c.charCodeAt(0)).join(',')}`);
    console.log(`🔍 Tried keys: ${merchantKey1}, ${merchantKey2}, ${merchantKey3}`);
    console.log(`🔍 Found status: ${status}`);
    
    // Add status icon based on merchant status
    let statusIcon = '';
    let statusLabel = '';
    if (status === 'successful') {
      statusIcon = '✅';
      statusLabel = 'Successful';
    } else if (status === 'flagged') {
      statusIcon = '🚩';
      statusLabel = 'Flagged';
    }
    
    // Clean merchant name for display (convert trailing backslashes to apostrophes)
    const cleanMerchantName = merchant.name.replace(/\\+$/, "'s");
    
    div.innerHTML = `
      <div class="merchant-header">
      <span class="merchant-name">${cleanMerchantName}</span>
        <div class="merchant-actions">
          <button class="merchant-action-btn flag-btn" data-merchant-name="${merchant.name}" data-action="flag" title="Flag this merchant">
            🚩
          </button>
          <button class="merchant-action-btn success-btn" data-merchant-name="${merchant.name}" data-action="success" title="Mark as successful">
            ✅
          </button>
          ${statusIcon ? `<span class="merchant-status-badge ${status}" title="${statusLabel}">${statusIcon}</span>` : ''}
        </div>
      </div>
      <span class="merchant-url-link ${statusClass}" data-url="${merchant.url}" title="Click to open ${merchant.name}">
        ${merchant.url}
      </span>
    `;
    
    // Add status class to the entire item for pulsating animation
    if (status) {
      const animationClass = `merchant-item-${status}`;
      div.classList.add(animationClass);
      
      // Also add inline styles to ensure visibility - solid borders
      if (status === 'successful') {
        div.style.border = '3px solid #27ae60';
        div.style.backgroundColor = 'rgba(39, 174, 96, 0.1)';
      } else if (status === 'flagged') {
        div.style.border = '3px solid #e74c3c';
        div.style.backgroundColor = 'rgba(231, 76, 60, 0.1)';
      }
      
      console.log(`🎨 Applied animation class: ${animationClass} to merchant: ${merchant.name}`);
      console.log(`🎨 Applied inline styles for: ${status} status`);
      
      // Force immediate animation start
      setTimeout(() => {
        div.offsetHeight; // Force reflow for immediate animation
        console.log(`✨ Animation triggered for: ${merchant.name}`);
        console.log(`✨ Element classes:`, div.className);
        console.log(`✨ Element styles:`, div.style.cssText);
      }, 0);
    } else {
      console.log(`⚠️ No status found for merchant: ${merchant.name}`);
      console.log(`⚠️ Available merchant statuses:`, Object.keys(merchantStatuses));
    }
    
    foundList.appendChild(div);
  });
  
  // Add click event listeners to merchant URL links
  setupValidationResultsClickHandlers();
  
  // Re-attach search event listeners after results are displayed
  setupSearchEventListeners();
  
  // Update not found merchants
  const notFoundBox = document.getElementById('notFoundBox');
  const notFoundList = document.getElementById('notFoundList');
  const notFoundCountEl = document.getElementById('notFoundCount');
  
  if (notFoundMerchants.length > 0) {
    notFoundBox.style.display = 'block';
    notFoundList.innerHTML = '';
    notFoundCountEl.textContent = notFoundMerchants.length;
    
    notFoundMerchants.forEach(merchant => {
      const div = document.createElement('div');
      div.className = 'merchant-item';
      div.innerHTML = `<span class="merchant-name">${merchant}</span>`;
      notFoundList.appendChild(div);
    });
  } else {
    notFoundBox.style.display = 'none';
  }
  
  // Show testing controls section if we have valid merchants
  if (foundCount > 0) {
    showTestingControls();
  }
  
  // Show results section
  resultsSection.style.display = 'block';
  
  // Auto-scroll to validation results only when explicitly requested (e.g., validate button pressed)
  if (shouldAutoScroll) {
    console.log('📍 Auto-scrolling to validation results after validation...');
    
    // Try multiple approaches to find the validation results
    let targetElement = null;
    
    // Approach 1: Look for validation results by content
    const headings = document.querySelectorAll('h3');
    for (const heading of headings) {
      if (heading.textContent && heading.textContent.includes('Validation Results')) {
        targetElement = heading.closest('section') || heading.parentElement;
        console.log('📍 Found validation results by heading text');
        break;
      }
    }
    
    // Approach 2: Look for the found-box (validation results container)
    if (!targetElement) {
      const foundBox = document.querySelector('.found-box');
      if (foundBox) {
        targetElement = foundBox.closest('section') || foundBox.parentElement;
        console.log('📍 Found validation results by found-box');
      }
    }
    
    // Approach 3: Look for stats section and scroll slightly above it
    if (!targetElement) {
      const statsSection = document.querySelector('.stats-section');
      if (statsSection) {
        targetElement = statsSection;
        console.log('📍 Using stats section as target');
      }
    }
    
    if (targetElement) {
      console.log('📍 Scrolling to show validation results + stats area');
      targetElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start',    // Show from the top to include stats above
        inline: 'nearest' 
      });
    } else {
      console.log('📍 No suitable scroll target found - skipping auto-scroll');
    }
  } else {
    console.log('📍 Skipping auto-scroll - not explicitly requested');
  }
  codeSection.style.display = 'none';
  
  // Setup download button when results are shown
  setupDownloadButton();
  
  // Update validation status counts after displaying results
  updateValidationStatusCounts();
  
  // Start validation sync polling to keep results updated
  startValidationSyncPolling();
  
  // Setup keyboard navigation for validation results
  setupValidationKeyboardNavigation();
}

// Refresh validation results display to show updated status colors
function refreshValidationResults() {
  console.log('🔄 Refreshing validation results display for status updates');
  console.log('🔄 Current merchantStatuses:', merchantStatuses);
  console.log('🔄 Current validation merchants:', currentValidation?.foundMerchants?.map(m => m.name));
  console.log('🔄 Current filter:', currentValidationFilter);
  
  if (!currentValidation || !currentValidation.foundMerchants) {
    console.log('⚠️ No validation results to refresh');
    return;
  }
  
  const foundList = document.getElementById('foundList');
  if (!foundList) {
    console.error('❌ foundList element not found');
    return;
  }
  
  // Get all merchant items in the validation results
  const merchantItems = foundList.querySelectorAll('.merchant-item');
  
  merchantItems.forEach((item, index) => {
    // Get merchant name from the DOM element instead of relying on index
    const merchantNameElement = item.querySelector('.merchant-name');
    if (!merchantNameElement) {
      console.warn(`⚠️ No merchant name element found for item ${index}`);
      return;
    }
    
    const merchantName = merchantNameElement.textContent;
    const merchantKey = merchantName.toLowerCase(); // Primary key format used by crouton
    const status = merchantStatuses[merchantKey] || '';
    
    console.log(`🔄 Refreshing status for "${merchantName}" (key: "${merchantKey}"): ${status || 'none'}`);
    
    // Find the corresponding merchant in validation results for verification
    const merchant = currentValidation.foundMerchants.find(m => m.name === merchantName);
    if (!merchant) {
      console.warn(`⚠️ Merchant "${merchantName}" not found in validation results`);
      return;
    }
    
    // Remove existing status classes from the item
    item.classList.remove('merchant-item-successful', 'merchant-item-flagged');
    
    // Add new status class if applicable
    if (status) {
      item.classList.add(`merchant-item-${status}`);
      console.log(`✅ Applied ${status} class to "${merchantName}"`);
      
      // Also add inline styles to ensure visibility - solid borders
      if (status === 'successful') {
        item.style.border = '3px solid #27ae60';
        item.style.backgroundColor = 'rgba(39, 174, 96, 0.1)';
        console.log(`🟢 Applied green border to "${merchantName}"`);
      } else if (status === 'flagged') {
        item.style.border = '3px solid #e74c3c';
        item.style.backgroundColor = 'rgba(231, 76, 60, 0.1)';
        console.log(`🔴 Applied red border to "${merchantName}"`);
      }
    } else {
      // Reset styles if no status
      item.style.border = '';
      item.style.backgroundColor = '';
    }
    
    // Update the URL link status class
    const urlLink = item.querySelector('.merchant-url-link');
    if (urlLink) {
      // Remove existing status classes
      urlLink.classList.remove('merchant-status-successful', 'merchant-status-flagged');
      
      // Add new status class if applicable
      if (status) {
        urlLink.classList.add(`merchant-status-${status}`);
      }
    }
    
    // Update or add status badge
    const merchantHeader = item.querySelector('.merchant-header');
    const merchantNameEl = item.querySelector('.merchant-name');
    
    if (merchantHeader && merchantNameEl) {
      // Remove existing badge
      const existingBadge = merchantHeader.querySelector('.merchant-status-badge');
      if (existingBadge) {
        existingBadge.remove();
      }
      
      // Add new badge if status exists
      if (status) {
        let statusIcon = '';
        let statusLabel = '';
        if (status === 'successful') {
          statusIcon = '✅';
          statusLabel = 'Successful';
        } else if (status === 'flagged') {
          statusIcon = '🚩';
          statusLabel = 'Flagged';
        }
        
        if (statusIcon) {
          const badge = document.createElement('span');
          badge.className = `merchant-status-badge merchant-status-${status}`;
          badge.title = statusLabel;
          badge.textContent = statusIcon;
          merchantHeader.appendChild(badge);
        }
      }
    } else {
      // Fallback: recreate the entire HTML structure if elements are missing
      console.log('⚠️ Merchant header structure missing, recreating...');
      
      // Add status icon based on merchant status
      let statusIcon = '';
      let statusLabel = '';
      if (status === 'successful') {
        statusIcon = '✅';
        statusLabel = 'Successful';
      } else if (status === 'flagged') {
        statusIcon = '🚩';
        statusLabel = 'Flagged';
      }
      
      const statusClass = status ? `merchant-status-${status}` : '';
      
      item.innerHTML = `
        <div class="merchant-header">
          <span class="merchant-name">${merchantName}</span>
          <div class="merchant-actions">
            <button class="merchant-action-btn flag-btn" data-merchant-name="${merchantName}" data-action="flag" title="Flag this merchant">
              🚩
            </button>
            <button class="merchant-action-btn success-btn" data-merchant-name="${merchantName}" data-action="success" title="Mark as successful">
              ✅
            </button>
            ${statusIcon ? `<span class="merchant-status-badge ${statusClass}" title="${statusLabel}">${statusIcon}</span>` : ''}
          </div>
        </div>
        <span class="merchant-url-link ${statusClass}" data-url="${merchant.url}" title="Click to open ${merchantName}">
          ${merchant.url}
        </span>
      `;
    }
  });
  
  // Re-setup click handlers after refreshing the display
  // Instead of manually updating DOM, re-display with filter preserved
  displayValidationResults(currentValidation, false);
  
  // Update validation status counts
  updateValidationStatusCounts();
  
  console.log('✅ Validation results display refreshed with current status and filter preserved');
}

// Update validation status counts in the validation results section
function updateValidationStatusCounts() {
  console.log('📊 Updating validation status counts...');
  
  const statusCountsSection = document.getElementById('validationStatusCounts');
  const successfulCountEl = document.getElementById('validationSuccessfulCount');
  const testedCountEl = document.getElementById('validationTestedCount');
  const flaggedCountEl = document.getElementById('validationFlaggedCount');
  
  if (!statusCountsSection || !successfulCountEl || !testedCountEl || !flaggedCountEl) {
    console.error('❌ Validation status count elements not found');
    return;
  }
  
  // Count successful, flagged, and total tested merchants from current validation results
  let successfulCount = 0;
  let flaggedCount = 0;
  let totalMerchants = 0;
  let testedCount = 0;
  
  if (currentValidation && currentValidation.foundMerchants && merchantStatuses) {
    totalMerchants = currentValidation.foundMerchants.length;
    
    currentValidation.foundMerchants.forEach(merchant => {
      const merchantKey = merchant.name.toLowerCase();
      const status = merchantStatuses[merchantKey];
      
      if (status === 'successful') {
        successfulCount++;
        testedCount++;
      } else if (status === 'flagged') {
        flaggedCount++;
        testedCount++;
      }
    });
  }
  
  // Update the counts
  successfulCountEl.textContent = successfulCount;
  testedCountEl.textContent = `${testedCount}/${totalMerchants}`;
  flaggedCountEl.textContent = flaggedCount;
  
  // Show the section if we have validation results (even if no testing done yet)
  const hasValidation = currentValidation && currentValidation.foundMerchants && currentValidation.foundMerchants.length > 0;
  statusCountsSection.style.display = hasValidation ? 'flex' : 'none';
  
  // Update visual state of filter buttons
  updateFilterButtonStates();
  
  console.log(`📊 Validation status counts updated: ${successfulCount} successful, ${testedCount}/${totalMerchants} tested, ${flaggedCount} flagged`);
}

// Update visual state of filter buttons
function updateFilterButtonStates() {
  const successfulCountEl = document.getElementById('validationSuccessfulCount');
  const testedCountEl = document.getElementById('validationTestedCount');
  const flaggedCountEl = document.getElementById('validationFlaggedCount');
  
  // Remove active class from all buttons
  [successfulCountEl, testedCountEl, flaggedCountEl].forEach(el => {
    if (el) {
      el.parentElement.classList.remove('status-count-active');
    }
  });
  
  // Add active class to current filter
  if (currentValidationFilter === 'successful' && successfulCountEl) {
    successfulCountEl.parentElement.classList.add('status-count-active');
  } else if (currentValidationFilter === 'flagged' && flaggedCountEl) {
    flaggedCountEl.parentElement.classList.add('status-count-active');
  } else if (currentValidationFilter === 'tested' && testedCountEl) {
    testedCountEl.parentElement.classList.add('status-count-active');
  }
}

// Filter validation results by status
function filterValidationResults(filterType) {
  console.log(`🔍 Filtering validation results by: ${filterType || 'all'}`);
  
  // Toggle filter: if clicking the same filter, clear it
  if (currentValidationFilter === filterType) {
    currentValidationFilter = null;
  } else {
    currentValidationFilter = filterType;
  }
  
  // Save filter state to storage
  saveFilterState();
  
  // Re-display the validation results with the new filter
  if (currentValidation) {
    displayValidationResults(currentValidation, false);
  }
  
  // Update button states
  updateFilterButtonStates();
}

// Save filter state to storage
function saveFilterState() {
  try {
    chrome.storage.local.set({ 
      validationFilter: currentValidationFilter 
    });
    console.log(`💾 Saved filter state: ${currentValidationFilter || 'none'}`);
  } catch (error) {
    console.error('Failed to save filter state:', error);
  }
}

// Restore filter state from storage
async function restoreFilterState() {
  try {
    const result = await chrome.storage.local.get(['validationFilter']);
    if (result.validationFilter !== undefined) {
      currentValidationFilter = result.validationFilter;
      console.log(`🔄 Restored filter state: ${currentValidationFilter || 'none'}`);
      
      // Apply the restored filter if we have validation results
      if (currentValidation && currentValidation.foundMerchants) {
        displayValidationResults(currentValidation, false);
        updateFilterButtonStates();
      }
    }
  } catch (error) {
    console.error('Failed to restore filter state:', error);
  }
}

// Setup click handlers for status count filtering
function setupStatusCountClickHandlers() {
  console.log('🔗 Setting up status count click handlers');
  
  const successfulCountEl = document.getElementById('validationSuccessfulCount');
  const testedCountEl = document.getElementById('validationTestedCount');
  const flaggedCountEl = document.getElementById('validationFlaggedCount');
  
  // Add click handlers to status count elements
  if (successfulCountEl) {
    successfulCountEl.parentElement.style.cursor = 'pointer';
    successfulCountEl.parentElement.title = 'Click to filter by successful merchants';
    successfulCountEl.parentElement.addEventListener('click', () => {
      filterValidationResults('successful');
    });
  }
  
  if (flaggedCountEl) {
    flaggedCountEl.parentElement.style.cursor = 'pointer';
    flaggedCountEl.parentElement.title = 'Click to filter by flagged merchants';
    flaggedCountEl.parentElement.addEventListener('click', () => {
      filterValidationResults('flagged');
    });
  }
  
  if (testedCountEl) {
    testedCountEl.parentElement.style.cursor = 'pointer';
    testedCountEl.parentElement.title = 'Click to filter by tested merchants';
    testedCountEl.parentElement.addEventListener('click', () => {
      filterValidationResults('tested');
    });
  }
}

// Setup click handlers for validation results merchant URL links
function setupValidationResultsClickHandlers() {
  console.log('🔗 Setting up validation results click handlers');
  
  const foundList = document.getElementById('foundList');
  if (!foundList) {
    console.error('❌ foundList element not found');
    return;
  }
  
  // Add click event listeners to all merchant URL links
  const urlLinks = foundList.querySelectorAll('.merchant-url-link');
  
  urlLinks.forEach((link, index) => {
    const url = link.getAttribute('data-url');
    if (!url) return;
    
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      try {
        console.log(`🔗 Validation results link clicked: ${url}`);
        
        // Navigate current tab to the URL
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.tabs.update(tab.id, { url: url });
        
        // Find the corresponding merchant in the testing list and set as current
        if (currentValidation && currentValidation.foundMerchants) {
          const merchant = currentValidation.foundMerchants[index];
          if (merchant && testingMerchants && testingMerchants.length > 0) {
            const merchantIndex = testingMerchants.findIndex(m => m.name === merchant.name);
            if (merchantIndex !== -1) {
              console.log(`🎯 Setting current merchant to: ${merchant.name} (index ${merchantIndex})`);
              currentMerchantIndex = merchantIndex;
              // updateStatsDisplay call removed (stats section eliminated)
              saveExtensionState();
              
              showToast(`Navigated to: ${merchant.name}`, 'success');
              
              // Ensure testing controls are active
              if (!testingControlsActive) {
                testingControlsActive = true;
                await showTestingControls();
                
                // Start background validation sync
                startBackgroundValidationSync();
              }
              
              // Show crouton on new page
              await showFloatingCrouton();
            }
          }
        }
        
      } catch (error) {
        console.error('❌ Error navigating to merchant URL:', error);
        showToast(`Error opening ${url}: ${error.message}`, 'error');
      }
    });
    
    // Add cursor pointer for better UX
    link.style.cursor = 'pointer';
  });
  
  // Add click event listeners to all merchant action buttons
  const actionButtons = foundList.querySelectorAll('.merchant-action-btn');
  
  actionButtons.forEach((button) => {
    const merchantName = button.getAttribute('data-merchant-name');
    const action = button.getAttribute('data-action');
    
    if (!merchantName || !action) return;
    
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      try {
        console.log(`🎯 Merchant action clicked: ${action} for ${merchantName}`);
        
        // Add pressed effect
        addButtonPressEffect(button);
        
        // Ensure testing is active
        if (!testingControlsActive) {
          console.log('🔄 Auto-activating testing controls for merchant action');
          testingControlsActive = true;
          
          // Start background validation sync
          startBackgroundValidationSync();
          
          // Set testing merchants from validation results if needed
          if ((!testingMerchants || testingMerchants.length === 0) && currentValidation && currentValidation.foundMerchants) {
            testingMerchants = currentValidation.foundMerchants;
            console.log(`🔄 Set testing merchants from validation: ${testingMerchants.length} merchants`);
          }
          
          await showTestingControls();
        }
        
        // Find the merchant in testing merchants
        if (!testingMerchants || testingMerchants.length === 0) {
          showToast('No merchants available for testing', 'error');
          return;
        }
        
        const merchantIndex = testingMerchants.findIndex(m => m.name === merchantName);
        if (merchantIndex === -1) {
          showToast(`Merchant "${merchantName}" not found in testing list`, 'error');
          return;
        }
        
        // Perform the action
        const merchantKey = merchantName.toLowerCase();
        
        if (action === 'flag') {
          // Check if already flagged
          if (merchantStatuses[merchantKey] === 'flagged') {
            // Removed toast notification
            return;
          }
          
          // Flag the merchant
          merchantStatuses[merchantKey] = 'flagged';
          // Removed toast notification
          console.log(`🚩 Flagged ${merchantName} from validation list`);
          
        } else if (action === 'success') {
          // Check if already successful
          if (merchantStatuses[merchantKey] === 'successful') {
            // Removed toast notification
            return;
          }
          
          // Mark as successful
          merchantStatuses[merchantKey] = 'successful';
          // Removed toast notification
          console.log(`✅ Marked ${merchantName} as successful from validation list`);
        }
        
        // Store test date
        const state = await chrome.storage.local.get(['extensionState']);
        const currentExtensionState = state.extensionState || {};
        if (!currentExtensionState.merchantTestDates) {
          currentExtensionState.merchantTestDates = {};
        }
        currentExtensionState.merchantTestDates[merchantKey] = new Date().toISOString();
        currentExtensionState.merchantStatuses = merchantStatuses; // Update statuses too
        await chrome.storage.local.set({ extensionState: currentExtensionState });
        
        // Save state and update displays
        saveExtensionState();
        refreshValidationResults();
        updateValidationStatusCounts();
        
        // Update crouton if it's showing this merchant
        updateFloatingCrouton();
        
        // Refresh stats if stats tab is active
        const statsTab = document.getElementById('statsTab');
        if (statsTab && statsTab.style.display !== 'none') {
          refreshStats();
        }
        
      } catch (error) {
        console.error('❌ Error performing merchant action:', error);
        showToast(`Error: ${error.message}`, 'error');
      }
    });
  });
  
  console.log(`✅ Set up click handlers for ${urlLinks.length} merchant URL links and ${actionButtons.length} action buttons`);
}

// Start the test with validated merchants
async function startTest() {
  if (!currentValidation || currentValidation.foundMerchants.length === 0) {
    showToast('No valid merchants to test', 'error');
    return;
  }

  // Show test execution section
  testExecutionSection.style.display = 'block';
  codeSection.style.display = 'none';
  // testExecutionSection.scrollIntoView({ behavior: 'smooth' }); // Removed auto-scroll

  // Initialize test state
  updateTestStatus('🚀', 'Initializing test...');
  updateTestProgress(0, currentValidation.foundMerchants.length);
  clearTestLog();
  addTestLog('Starting CitiShop test execution...', 'info');
  addTestLog(`Testing ${currentValidation.foundMerchants.length} merchants`, 'info');

  // Test execution buttons removed

  try {
    // Create a new tab for testing with the first merchant URL
    const firstMerchant = currentValidation.foundMerchants[0];
    const testTab = await chrome.tabs.create({ 
      url: firstMerchant.url,
      active: false
    });

    addTestLog('Created test tab', 'success');
    addTestLog(`Loading first merchant: ${firstMerchant.name}`, 'info');

    // Wait for tab to load, then send test configuration
    // Show testing controls in extension popup immediately
    showTestingControls();
    
    addTestLog('✅ Test started - use extension controls to navigate', 'success');
    updateTestStatus('🔄', 'Test running - use testing controls below');

    // Update session stats
    sessionStats.totalGenerated++;
    // updateStatsDisplay call removed (stats section eliminated)
    // saveSessionStats call removed (stats section eliminated)

  } catch (error) {
    addTestLog(`Error starting test: ${error.message}`, 'error');
    updateTestStatus('❌', 'Test failed to start');
    
    // Reset control buttons
    // Test execution buttons removed
  }
}

// Start simple test (inject controls on current page)
async function startSimpleTest() {
  if (!currentValidation || currentValidation.foundMerchants.length === 0) {
    showToast('No valid merchants to test', 'error');
    return;
  }

  // Show test execution section but keep results visible
  testExecutionSection.style.display = 'block';
  codeSection.style.display = 'none';
  // Keep results section visible
  resultsSection.style.display = 'block';

  // Initialize test state
  updateTestStatus('📌', 'Starting simple test mode...');
  clearTestLog();
  addTestLog('Starting simple test mode...', 'info');
  addTestLog(`Will test ${currentValidation.foundMerchants.length} merchants`, 'info');

  try {
    // Get current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Try to inject content script first (in case it's not loaded)
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['content.css']
      });
      
      addTestLog('✅ Content script injected', 'success');
    } catch (scriptError) {
      addTestLog('Content script already loaded or injection failed', 'warning');
    }
    
    // Wait a moment for script to initialize
    // Show testing controls directly in extension popup
    showTestingControls();
    
    addTestLog('✅ Simple test started - use extension controls below', 'success');
    updateTestStatus('🎯', 'Testing controls active - ready to test!');
    addTestLog('Use the testing controls below to navigate between merchants', 'info');
    
    // Update session stats
    sessionStats.totalGenerated++;
    // updateStatsDisplay call removed (stats section eliminated)
    // saveSessionStats call removed (stats section eliminated)
    
    showToast('Testing controls activated! Use them to test.', 'success');
    
  } catch (error) {
    addTestLog(`❌ Error accessing tab: ${error.message}`, 'error');
    updateTestStatus('❌', 'Failed to access page');
    
    // Show built-in floating controls as fallback
    showBuiltInFloatingControls();
  }
}

// Stop the running test
function stopTest() {
  updateTestStatus('⏹️', 'Test stopped');
  addTestLog('Test stopped by user', 'warning');
  
  // Reset button states
  stopTestBtn.disabled = true;
  pauseTestBtn.disabled = true;
  // Test execution buttons removed
}

// Pause the running test
function pauseTest() {
  updateTestStatus('⏸️', 'Test paused');
  addTestLog('Test paused by user', 'warning');
  
  // Toggle pause/resume buttons
  // Test execution buttons removed
}

// Resume the paused test
function resumeTest() {
  updateTestStatus('🔄', 'Test resumed');
  addTestLog('Test resumed by user', 'info');
  
  // Toggle pause/resume buttons
  // Test execution buttons removed
}

// Update test status display
function updateTestStatus(indicator, text) {
  // Console logging only - test execution section removed
  console.log(`Status: ${indicator} ${text}`);
}

// Update test progress
function updateTestProgress(current, total) {
  // Console logging only - test execution section removed
  const percentage = total > 0 ? (current / total) * 100 : 0;
  console.log(`Progress: ${current}/${total} (${percentage.toFixed(1)}%)`);
}

// Add entry to test log
function addTestLog(message, type = 'info') {
  // Console logging only - test execution section removed
  console.log(`[${type.toUpperCase()}] ${new Date().toLocaleTimeString()} - ${message}`);
}

// Clear test log
function clearTestLog() {
  // Console logging only - test execution section removed  
  console.log('Test log cleared');
}

// Fallback method to inject floating controls on current page
async function injectFloatingControlsFallback() {
  try {
    addTestLog('Using fallback: injecting controls on current page', 'warning');
    
    // Get current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Send merchants to current tab's content script
    await chrome.tabs.sendMessage(tab.id, {
      action: 'injectFloatingControls',
      merchants: currentValidation.foundMerchants
    });
    
    addTestLog('Floating controls injected on current page', 'success');
    updateTestStatus('📌', 'Controls injected - use them to navigate');
    
    // Close popup after injection
    setTimeout(() => {
      window.close();
    }, 1000);
    
  } catch (error) {
    addTestLog(`Fallback also failed: ${error.message}`, 'error');
    updateTestStatus('❌', 'Failed to start test');
    
    // Reset control buttons
    // Test execution buttons removed
  }
}

// Handle test progress updates from content script
function handleTestProgress(progress) {
  updateTestProgress(progress.current, progress.total);
  
  if (progress.currentMerchant) {
    const cleanMerchantName = progress.currentMerchant.name.replace(/\\+$/, "'s");
    updateTestStatus('🔄', `Testing ${cleanMerchantName}...`);
    addTestLog(`Testing ${cleanMerchantName} (${progress.current}/${progress.total})`, 'info');
  }
  
  if (progress.successful > 0) {
    addTestLog(`✅ ${progress.successful} merchants successful so far`, 'success');
  }
  
  if (progress.flagged > 0) {
    addTestLog(`🚩 ${progress.flagged} merchants flagged`, 'warning');
  }
}

// Handle test completion
function handleTestCompleted(results) {
  updateTestStatus('✅', 'Test completed');
  updateTestProgress(results.total, results.total);
  
  addTestLog(`Test completed: ${results.successful}/${results.total} successful`, 'success');
  
  if (results.flagged > 0) {
    addTestLog(`${results.flagged} merchants had issues`, 'warning');
  }
  
  // Show detailed results
  addTestLog('--- SUCCESSFUL MERCHANTS ---', 'info');
  results.successfulMerchants.forEach(merchant => {
    addTestLog(`✅ ${merchant.name} - ${merchant.citishopWorking ? 'CitiShop OK' : 'CitiShop not detected'}`, 'success');
  });
  
  if (results.flaggedMerchants.length > 0) {
    addTestLog('--- FLAGGED MERCHANTS ---', 'warning');
    results.flaggedMerchants.forEach(merchant => {
      addTestLog(`🚩 ${merchant.merchant.name} - ${merchant.reason}`, 'error');
    });
  }
  
  // Reset button states
  stopTestBtn.disabled = true;
  pauseTestBtn.disabled = true;
  // Test execution buttons removed
  
  // Update session stats
  sessionStats.totalGenerated++;
  if (results.successful === results.total) {
    sessionStats.successfulValidations++;
  }
  // updateStatsDisplay call removed (stats section eliminated)
  saveSessionStats();
}

// Handle floating controls injection confirmation
function handleControlsInjected(message) {
  addTestLog(`✅ Floating controls confirmed: ${message.merchantCount} merchants`, 'success');
  addTestLog(`Starting with: ${message.currentMerchant}`, 'info');
  updateTestStatus('🎯', 'Controls active - ready to test!');
}

// Reset all testing state for fresh start (used internally)
async function resetTestingState() {
  console.log('Resetting testing state...');
  
  // Reset testing flags
  testingControlsActive = false;
  testExecutionActive = false;
  
  // Stop background validation sync
  stopBackgroundValidationSync();
  
  // Stop polling
  stopCroutonActionPolling();
  stopValidationSyncPolling();
  
  // Reset merchant data
  testingMerchants = [];
  currentMerchantIndex = 0;
  merchantStatuses = {};
  
  // Update stats to reflect reset
  // updateStatsDisplay call removed (stats section eliminated)
  
  // Clear validation status counts
  updateValidationStatusCounts();
  
  // Hide testing sections (testing window eliminated)
  
  // Hide floating crouton
  await hideFloatingCrouton();
  
  // Stop polling for crouton actions
  stopCroutonActionPolling();
  
  // Clear the saved testing state from storage
  await chrome.storage.local.remove(['extensionState']);
  
  console.log('✅ Testing state reset and cleared from storage');
}

// Reset testing only (user-triggered button)
async function resetTestingOnly() {
  console.log('User requested testing reset...');
  
  if (confirm('Reset all testing data?\n\nThis will clear:\n• Current testing progress\n• Merchant statuses\n• Test logs\n\nValidated merchants will remain.')) {
    await resetTestingState();
    
    // If we have validated merchants, show fresh testing controls
    if (currentValidation && currentValidation.foundMerchants.length > 0) {
      showTestingControls();
    }
    
    showToast('Testing data reset! 🔄', 'success');
    addTestLog('🔄 Testing data reset by user', 'info');
  }
}

// Show built-in floating controls as fallback
async function showTestingControls() {
  addTestLog('💡 Showing testing controls in extension', 'info');
  
  testingMerchants = currentValidation.foundMerchants;
  // Only reset currentMerchantIndex if we don't have an active testing session
  if (!testingControlsActive) {
  currentMerchantIndex = 0;
    console.log('🔄 Reset currentMerchantIndex to 0 (new testing session)');
  } else {
    console.log(`🔄 Preserving currentMerchantIndex: ${currentMerchantIndex} (existing testing session)`);
  }
  testingControlsActive = true;
  
  // Start background validation sync for real-time updates
  startBackgroundValidationSync();
  
  // Reset testing button removed (testing reset section eliminated)
  
  updateTestStatus('🎯', 'Testing controls active');
  addTestLog('✅ Testing controls ready - use them to test merchants', 'success');
  
  // Ensure content script is loaded on current tab before showing crouton
  await ensureContentScriptLoaded();
  
  // Show floating crouton on current page
  showFloatingCrouton();
  
  // Start polling for crouton actions
  startCroutonActionPolling();
  
  // Start validation sync polling if we have validation results
  if (currentValidation && currentValidation.foundMerchants) {
    startValidationSyncPolling();
  }
  
  // Save state
  saveExtensionState();
}

// Ensure content script is loaded on current tab
async function ensureContentScriptLoaded() {
  try {
    console.log('🔄 Ensuring content script is loaded on current tab...');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('🔄 Current tab:', tab.id, tab.url);
    
    // Skip injection for chrome:// and extension pages
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      console.log('⏭️ Skipping content script injection for chrome:// or extension page');
      return;
    }
    
    try {
      // Try to inject content script
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['floating-crouton.js']
  });

  console.log('✅ Content script injected successfully');
      
      // Also inject CSS
      try {
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['content.css']
        });
        console.log('✅ Content CSS injected successfully');
      } catch (cssError) {
        console.log('CSS injection failed:', cssError.message);
      }
      
    } catch (injectionError) {
      console.log('Content script injection failed (may already be loaded):', injectionError.message);
    }
    
    // Wait for script to initialize
    await new Promise(resolve => setTimeout(resolve, 500));
    
  } catch (error) {
    console.error('Failed to ensure content script:', error);
  }
}

// Show floating crouton on current page
async function showFloatingCrouton() {
  try {
    console.log('🚀 showFloatingCrouton called from popup');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('🚀 Active tab:', tab.id, tab.url);
    
    // Check if current tab URL matches any testing merchant
    const currentUrl = tab.url;
    const matchingMerchant = testingMerchants.find(merchant => {
      if (!merchant.url) return false;
      
      try {
        const merchantUrl = new URL(merchant.url);
        const tabUrl = new URL(currentUrl);
        
        // Match by hostname (with and without www)
        const merchantHostname = merchantUrl.hostname.replace(/^www\./, '');
        const tabHostname = tabUrl.hostname.replace(/^www\./, '');
        
        return merchantHostname === tabHostname;
      } catch (error) {
        console.error(`Error comparing URLs for ${merchant.name}:`, error);
        return false;
      }
    });
    
    // Only use matching merchant - don't show crouton on non-merchant websites
    if (!matchingMerchant) {
      console.log('🚫 Current tab does not match any testing merchant - skipping crouton display');
      console.log('🚫 Current URL:', currentUrl);
      console.log('🚫 Available merchants:', testingMerchants.map(m => `${m.name}: ${m.url}`));
      return;
    }
    
    const merchantToUse = matchingMerchant;
    
    console.log('✅ Using merchant for crouton:', merchantToUse.name);
    
    const croutonData = {
      currentMerchant: merchantToUse,
      currentIndex: testingMerchants.findIndex(m => m.name === merchantToUse.name),
      totalMerchants: testingMerchants.length,
      testingMerchants: testingMerchants,
      status: `Ready to test ${merchantToUse.name}`,
      merchantStatus: getMerchantStatus(merchantToUse.name)
    };
    
    console.log('🚀 Sending crouton data:', croutonData);
    console.log('🚀 Current merchant:', croutonData.currentMerchant?.name);
    
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'showFloatingCrouton',
      data: croutonData
    });
    
    console.log('✅ Message sent successfully, response:', response);
    addTestLog('🏪 Floating crouton displayed', 'info');
  } catch (error) {
    console.error('❌ Failed to show floating crouton:', error);
    addTestLog('❌ Failed to show floating crouton: ' + error.message, 'error');
    
    // Try to inject content script if it's not loaded
    try {
      console.log('🔄 Attempting to inject content script...');
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['floating-crouton.js']
      });
      
      console.log('✅ Content script injected, retrying crouton display...');
      
      // Retry after injection
      setTimeout(async () => {
        try {
          const croutonData = {
            currentMerchant: testingMerchants[currentMerchantIndex],
            currentIndex: currentMerchantIndex,
            totalMerchants: testingMerchants.length,
            testingMerchants: testingMerchants,
            status: `Ready to test ${testingMerchants[currentMerchantIndex]?.name}`,
            merchantStatus: getMerchantStatus(testingMerchants[currentMerchantIndex]?.name)
          };
          
          await chrome.tabs.sendMessage(tab.id, {
            action: 'showFloatingCrouton',
            data: croutonData
          });
          
          console.log('✅ Crouton displayed after content script injection');
          addTestLog('🏪 Floating crouton displayed (after script injection)', 'info');
        } catch (retryError) {
          console.error('❌ Failed to show crouton even after injection:', retryError);
          addTestLog('❌ Failed to show crouton even after script injection', 'error');
        }
      }, 1000);
      
    } catch (injectionError) {
      console.error('❌ Failed to inject content script:', injectionError);
      addTestLog('❌ Failed to inject content script: ' + injectionError.message, 'error');
    }
  }
}

// Update floating crouton with current data
async function updateFloatingCrouton() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Only update crouton if testing is active and we have merchants
    if (!testingControlsActive || !testingMerchants || testingMerchants.length === 0) {
      console.log('🔍 Testing not active or no merchants - skipping crouton update');
      return;
    }
    
    // Check if the current tab matches any testing merchant
    const matchingMerchant = testingMerchants.find(merchant => {
      if (!merchant.url) return false;
      
      try {
        const merchantUrl = new URL(merchant.url);
        const currentUrl = new URL(tab.url);
        
        // Only match by exact hostname (domain) - be strict
        const hostnameMatch = merchantUrl.hostname === currentUrl.hostname;
        
        // Also check without www prefix
        const merchantHostnameClean = merchantUrl.hostname.replace(/^www\./, '');
        const currentHostnameClean = currentUrl.hostname.replace(/^www\./, '');
        const cleanHostnameMatch = merchantHostnameClean === currentHostnameClean;
        
        return hostnameMatch || cleanHostnameMatch;
      } catch (error) {
        console.error(`Error parsing URLs for ${merchant.name}:`, error);
        return false;
      }
    });
    
    // Only send crouton update if current tab matches a testing merchant
    if (!matchingMerchant) {
      console.log('🔍 Current tab does not match any testing merchant - skipping crouton update');
      console.log('🔍 Current URL:', tab.url);
      console.log('🔍 Testing merchants:', testingMerchants.map(m => m.url));
      return;
    }
    
    console.log('🔍 Current tab matches testing merchant - updating crouton');
    
    const croutonData = {
      currentMerchant: testingMerchants[currentMerchantIndex],
      currentIndex: currentMerchantIndex,
      totalMerchants: testingMerchants.length,
      testingMerchants: testingMerchants,
      status: `Testing ${testingMerchants[currentMerchantIndex]?.name ? testingMerchants[currentMerchantIndex].name.replace(/\\+$/, "'s") : 'merchant'}`,
      merchantStatus: getMerchantStatus(testingMerchants[currentMerchantIndex]?.name)
    };
    
    await chrome.tabs.sendMessage(tab.id, {
      action: 'updateFloatingCrouton',
      data: croutonData
    });
  } catch (error) {
    console.error('Failed to update floating crouton:', error);
  }
}

// Hide floating crouton
async function hideFloatingCrouton() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    await chrome.tabs.sendMessage(tab.id, {
      action: 'hideFloatingCrouton'
    });
    
    addTestLog('🏪 Floating crouton hidden', 'info');
  } catch (error) {
    console.error('Failed to hide floating crouton:', error);
  }
}

// Get merchant status for display
function getMerchantStatus(merchantName) {
  if (!merchantName) return '';
  const merchantKey = merchantName.toLowerCase();
  return merchantStatuses[merchantKey] || '';
}

// Update testing controls display
// updateTestingControlsDisplay function removed (testing window eliminated)

// Get merchant status badge HTML
function getMerchantStatusBadge(status) {
  if (!status) return '';
  
  const badges = {
    'flagged': '<span class="merchant-status flagged">🚩 Flagged</span>',
    'successful': '<span class="merchant-status successful">✅ Success</span>'
  };
  
  return badges[status] || '';
}

// Navigation functions removed (testing window eliminated)

// Navigation functions
function goToPreviousMerchant() {
  console.log('goToPreviousMerchant called');
  
  if (!testingMerchants || testingMerchants.length === 0) {
    showToast('No merchants loaded!', 'error');
    console.error('No testing merchants available');
    return;
  }
  
  if (currentMerchantIndex > 0) {
    currentMerchantIndex--;
    const previousMerchant = testingMerchants[currentMerchantIndex];
    console.log(`✅ Moved to previous merchant: ${previousMerchant?.name}`);
    
    // Navigate to the previous merchant's website
    if (previousMerchant && previousMerchant.url) {
      console.log(`🌐 Navigating to previous merchant: ${previousMerchant.url}`);
      chrome.tabs.update({ url: previousMerchant.url });
    }
    
    updateFloatingCrouton();
    saveExtensionState();
  } else {
    console.log('❌ Already at first merchant');
    showToast('Already at first merchant', 'warning');
  }
}

function goToNextMerchant() {
  console.log('goToNextMerchant called');
  
  if (!testingMerchants || testingMerchants.length === 0) {
    showToast('No merchants loaded!', 'error');
    console.error('No testing merchants available');
    return;
  }
  
  if (currentMerchantIndex < testingMerchants.length - 1) {
    currentMerchantIndex++;
    const nextMerchant = testingMerchants[currentMerchantIndex];
    console.log(`✅ Moved to next merchant: ${nextMerchant?.name}`);
    
    // Navigate to the next merchant's website
    if (nextMerchant && nextMerchant.url) {
      console.log(`🌐 Navigating to next merchant: ${nextMerchant.url}`);
      chrome.tabs.update({ url: nextMerchant.url });
    }
    
    updateFloatingCrouton();
    saveExtensionState();
  } else {
    console.log('❌ Already at last merchant');
    showToast('Already at last merchant', 'warning');
  }
}

async function testCurrentMerchant() {
  console.log('testCurrentMerchant called');
  
  if (!testingMerchants || testingMerchants.length === 0) {
    console.error('No testing merchants available');
    showToast('No merchants available to test', 'error');
    return;
  }
  
  // Start testing mode if not already active
  if (!testExecutionActive) {
    testExecutionActive = true;
    updateTestStatus('🎯', 'Testing mode active');
    addTestLog('🚀 Testing mode started', 'info');
    saveExtensionState();
  }
  
  const currentMerchant = testingMerchants[currentMerchantIndex];
  console.log('Testing merchant:', currentMerchant);
  
  const cleanMerchantName = currentMerchant.name.replace(/\\+$/, "'s");
  controlsStatus.textContent = `Testing ${cleanMerchantName}...`;
  controlsStatus.className = 'controls-status testing';
  
  addTestLog(`🧪 Testing ${cleanMerchantName}`, 'info');
  
  try {
    // Navigate to merchant URL in current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.update(tab.id, { url: currentMerchant.url });
    
    // Show crouton on new page
    await showFloatingCrouton();
    
    addTestLog(`✅ Navigated to ${cleanMerchantName}`, 'success');
    controlsStatus.textContent = `🧪 Testing ${cleanMerchantName}`;
    controlsStatus.className = 'controls-status';
    
    // Don't mark as tested - only navigation
    updateFloatingCrouton();
    saveExtensionState();
    
    console.log(`📝 Navigation only - merchant not marked as tested. Use Success button to mark as tested.`);
    
  } catch (error) {
    addTestLog(`❌ Error testing ${currentMerchant.name}: ${error.message}`, 'error');
    controlsStatus.textContent = `❌ Error testing ${currentMerchant.name}`;
    controlsStatus.className = 'controls-status error';
    showToast(`Error testing ${currentMerchant.name}`, 'error');
  }
}

async function flagCurrentMerchant() {
  console.log('🚩 flagCurrentMerchant called - STACK TRACE:');
  console.trace();
  
  const currentMerchant = testingMerchants[currentMerchantIndex];
  const merchantKey = currentMerchant.name.toLowerCase();
  
  // Check if already flagged - if so, show already flagged status
  if (merchantStatuses[merchantKey] === 'flagged') {
    // Removed toast notification
    return;
  }
  
  // Flag the merchant without prompt
  console.log(`🚩 MARKING MERCHANT AS FLAGGED: ${currentMerchant.name}`);
  merchantStatuses[merchantKey] = 'flagged';
  // Removed toast notification
  
  // Store test date
  const state = await chrome.storage.local.get(['extensionState']);
  const extensionState = state.extensionState || {};
  if (!extensionState.merchantTestDates) {
    extensionState.merchantTestDates = {};
  }
  extensionState.merchantTestDates[merchantKey] = new Date().toISOString();
  extensionState.merchantStatuses = merchantStatuses; // Update statuses too
  await chrome.storage.local.set({ extensionState });
  
  // Save state first to ensure background script gets latest data
  saveExtensionState();
  
  updateFloatingCrouton();
  
  // Refresh stats if stats tab is active
  const statsTab = document.getElementById('statsTab');
  if (statsTab && statsTab.style.display !== 'none') {
    refreshStats();
  }
  // updateStatsDisplay call removed (stats section eliminated)
  refreshValidationResults(); // Update validation results colors
  updateValidationStatusCounts(); // Update validation status counts
  
  // Also trigger immediate refresh for any open popup
  console.log('🔄 Triggering immediate validation refresh for popup after flagging');
  setTimeout(() => {
    forceValidationRefresh('after flagging');
  }, 50);
}

async function markCurrentMerchantSuccessful() {
  console.log('✅ markCurrentMerchantSuccessful called - STACK TRACE:');
  console.trace();
  
  const currentMerchant = testingMerchants[currentMerchantIndex];
  if (!currentMerchant) {
    console.error('No current merchant to mark as successful');
    return;
  }
  
  const merchantKey = currentMerchant.name.toLowerCase();
  
  // Mark the merchant as successful
  console.log(`✅ MARKING MERCHANT AS SUCCESSFUL: ${currentMerchant.name}`);
  merchantStatuses[merchantKey] = 'successful';
  // Removed toast notification
  
  // Store test date
  const state = await chrome.storage.local.get(['extensionState']);
  const extensionState = state.extensionState || {};
  if (!extensionState.merchantTestDates) {
    extensionState.merchantTestDates = {};
  }
  extensionState.merchantTestDates[merchantKey] = new Date().toISOString();
  extensionState.merchantStatuses = merchantStatuses; // Update statuses too
  await chrome.storage.local.set({ extensionState });
  
  // Save state first to ensure background script gets latest data
  saveExtensionState();
  
  updateFloatingCrouton();
  // updateStatsDisplay call removed (stats section eliminated)
  refreshValidationResults(); // Update validation results colors
  updateValidationStatusCounts(); // Update validation status counts
  
  // Refresh stats if stats tab is active
  const statsTab = document.getElementById('statsTab');
  if (statsTab && statsTab.style.display !== 'none') {
    refreshStats();
  }
  
  // Also trigger immediate refresh for any open popup
  console.log('🔄 Triggering immediate validation refresh for popup after success');
  setTimeout(() => {
    forceValidationRefresh('after success');
  }, 50);
}

function searchToMerchant(targetIndex) {
  console.log(`🔍 searchToMerchant called with index: ${targetIndex}`);
  console.log(`📊 Current testingMerchants length: ${testingMerchants?.length || 0}`);
  
  if (!testingMerchants || targetIndex < 0 || targetIndex >= testingMerchants.length) {
    console.error('Invalid merchant index:', targetIndex);
    console.error('testingMerchants:', testingMerchants);
    showToast('Invalid merchant selection', 'error');
    return;
  }
  
  const previousIndex = currentMerchantIndex;
  currentMerchantIndex = targetIndex;
  const targetMerchant = testingMerchants[currentMerchantIndex];
  
  console.log(`📍 Search changed index from ${previousIndex} to ${targetIndex}`);
  console.log(`🎯 Target merchant: ${targetMerchant?.name}`);
  console.log(`📌 Next button will now go to index ${targetIndex + 1}`);
  
  updateFloatingCrouton();
  // updateStatsDisplay call removed (stats section eliminated)
  saveExtensionState();
  
  console.log(`✅ Search navigated to merchant: ${targetMerchant.name} (index ${targetIndex})`);
  showToast(`Found: ${targetMerchant.name}`, 'success');
  
  // Force update the crouton with new data
  setTimeout(async () => {
    await updateFloatingCrouton();
  }, 100);
}

function completeTest() {
  addTestLog('✅ Test completed by user', 'success');
  testingControlsActive = false;
  
  // Stop background validation sync
  stopBackgroundValidationSync();
  
  updateTestStatus('✅', 'Test completed');
  
  // Update session stats
  sessionStats.totalGenerated++;
  // updateStatsDisplay call removed (stats section eliminated)
  saveSessionStats();
}

// Toggle controls minimize/maximize
function toggleControlsMinimize(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  
  console.log('Toggling controls minimize:', isControlsMinimized);
  isControlsMinimized = !isControlsMinimized;
  
  if (isControlsMinimized) {
    floatingControlsSection.classList.add('minimized');
    minimizeControlsBtn.textContent = '+';
    minimizeControlsBtn.title = 'Maximize';
    addTestLog('📦 Controls minimized', 'info');
  } else {
    floatingControlsSection.classList.remove('minimized');
    minimizeControlsBtn.textContent = '−';
    minimizeControlsBtn.title = 'Minimize';
    addTestLog('📖 Controls expanded', 'info');
  }
  
  saveExtensionState();
}

// Expand controls if minimized when clicked
function expandIfMinimized(event) {
  if (isControlsMinimized && !event.target.closest('.controls-actions')) {
    toggleControlsMinimize();
  }
}

// Copy functions removed (replaced with download table functionality)

// Download merchant table as .txt file
async function downloadMerchantTable() {
  console.log('📄 downloadMerchantTable called');
  console.log('📄 currentValidation:', currentValidation);
  console.log('📄 testingMerchants:', testingMerchants);
  
  // Use validation results if available, otherwise fall back to testing merchants
  const merchantList = currentValidation?.foundMerchants || testingMerchants || [];
  console.log('📄 merchantList:', merchantList);
  console.log('📄 merchantList.length:', merchantList.length);
  
  if (merchantList.length === 0) {
    console.log('📄 No merchants to download');
    showToast('No merchants to download', 'warning');
    return;
  }
  
  // Create table data
  let tableData = 'Merchant Name\tStatus\tReason\n';
  
  merchantList.forEach(merchant => {
    const key = merchant.name.toLowerCase();
    const status = merchantStatuses[key] || 'Not tested';
    let reason = 'N/A';
    
    // Determine reason based on status
    if (status === 'successful') {
      reason = 'Passed validation and testing';
    } else if (status === 'flagged') {
      reason = 'Flagged for review';
    } else {
      reason = 'Not yet tested';
    }
    
    // Escape merchant name if it contains tabs or newlines
    const safeName = merchant.name.replace(/\t/g, ' ').replace(/\n/g, ' ');
    tableData += `${safeName}\t${status}\t${reason}\n`;
  });
  
  // Create and download the file
  try {
    console.log('📄 Creating blob with table data...');
    console.log('📄 Table data preview:', tableData.substring(0, 200) + '...');
    
    const filename = `merchant_table_${new Date().toISOString().split('T')[0]}.txt`;
    
    // Try Chrome downloads API first (if available in extension context)
    if (chrome && chrome.downloads) {
      console.log('📄 Using Chrome downloads API...');
      const blob = new Blob([tableData], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: false
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error('📄 Chrome downloads API error:', chrome.runtime.lastError);
          fallbackDownload();
        } else {
          console.log('📄 Download started with ID:', downloadId);
          showToast(`Downloaded table with ${merchantList.length} merchants`, 'success');
          addTestLog(`📄 Downloaded merchant table with ${merchantList.length} entries`, 'info');
          // Cleanup after a delay
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      });
    } else {
      console.log('📄 Chrome downloads API not available, using fallback...');
      fallbackDownload();
    }
    
    function fallbackDownload() {
      console.log('📄 Using fallback download method...');
      const blob = new Blob([tableData], { type: 'text/plain' });
      console.log('📄 Blob created, size:', blob.size);
      
      const url = URL.createObjectURL(blob);
      console.log('📄 Object URL created:', url);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none'; // Ensure it's hidden
      
      console.log('📄 Download link created:', a.download);
      console.log('📄 Adding link to document...');
      
      document.body.appendChild(a);
      
      console.log('📄 Triggering click...');
      a.click();
      
      // Small delay before cleanup
      setTimeout(() => {
        console.log('📄 Cleaning up download link...');
        try {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          console.log('📄 Cleanup completed');
        } catch (cleanupError) {
          console.error('📄 Cleanup error:', cleanupError);
        }
      }, 100);
      
      console.log('📄 Download initiated successfully');
      showToast(`Downloaded table with ${merchantList.length} merchants`, 'success');
      addTestLog(`📄 Downloaded merchant table with ${merchantList.length} entries`, 'info');
    }
    
  } catch (error) {
    console.error('📄 Download error details:', error);
    console.error('📄 Error stack:', error.stack);
    showToast('Failed to download table', 'error');
  }
}

// Clear all merchant status (flagged, successful)
function clearAllMerchantStatus() {
  if (confirm('Clear all merchant testing status? This will remove all flagged and successful markers.')) {
    merchantStatuses = {};
    // updateStatsDisplay call removed (stats section eliminated)
    refreshValidationResults(); // Update validation results colors
    updateValidationStatusCounts(); // Update validation status counts
    addTestLog('🔄 Cleared all merchant status', 'info');
    showToast('All merchant status cleared', 'success');
    saveExtensionState();
  }
}

// Reset all extension data
async function resetExtensionData() {
  console.log('resetExtensionData called');
  
  // Stop background validation sync
  stopBackgroundValidationSync();
  
  const confirmMessage = 'Reset ALL extension data?\n\nThis will clear everything:\n• Merchants\n• Validation results\n• Test logs\n• Status markers\n• UI state\n\nThis cannot be undone.';
  
  if (confirm(confirmMessage)) {
    try {
      console.log('User confirmed reset, proceeding...');
      
      // Clear all stored data
      await chrome.storage.local.clear();
      console.log('Storage cleared');
      
      // Stop all polling
      stopCroutonActionPolling();
      stopValidationSyncPolling();
      
      // Reset all variables
      currentValidation = null;
      merchantStatuses = {};
      testingControlsActive = false;
      currentMerchantIndex = 0;
      testingMerchants = [];
      
      // Clear UI elements
      if (merchantInput) merchantInput.value = '';
      if (resultsSection) resultsSection.style.display = 'none';
      if (codeSection) codeSection.style.display = 'none';
      // testExecutionSection removed
      // testingControlsSection removed
      // testLogContainer removed - test execution section removed
      
      // Reset buttons - no start test buttons
      
      // Update displays to reflect reset
      // updateStatsDisplay call removed (stats section eliminated)
      refreshValidationResults();
      
      showToast('Extension completely reset! 🔄', 'success');
      addTestLog('🗑️ Extension data completely reset', 'info');
      
      console.log('Reset completed successfully');
      
    } catch (error) {
      console.error('Error resetting extension:', error);
      showToast(`Error resetting extension: ${error.message}`, 'error');
      addTestLog(`❌ Reset failed: ${error.message}`, 'error');
    }
  } else {
    console.log('User cancelled reset');
    showToast('Reset cancelled', 'info');
  }
}

// Generate test code
function generateTestCode() {
  if (!currentValidation || currentValidation.foundMerchants.length === 0) {
    showToast('No valid merchants to generate code for', 'error');
    return;
  }
  
  const websites = currentValidation.foundMerchants.map(merchant => 
    `{ name: '${merchant.name.replace(/'/g, "\\'")}', url: '${merchant.url}' }`
  ).join(',\n      ');
  
  const generatedCode = `    const websites = [
      ${websites}
    ];`;
  
  document.getElementById('generatedCode').textContent = generatedCode;
  codeSection.style.display = 'block';
  
  // Update session stats
  sessionStats.totalGenerated++;
  // updateStatsDisplay call removed (stats section eliminated)
  saveSessionStats();
  
  showToast('Test code generated successfully!', 'success');
}

// Note: Floating controls functionality removed - all testing now in extension popup

// Edit merchants (go back to input)
// editMerchants function removed (replaced with copy buttons)

// Copy generated code to clipboard
async function copyGeneratedCode() {
  const code = document.getElementById('generatedCode').textContent;
  
  try {
    await navigator.clipboard.writeText(code);
    showToast('Code copied to clipboard!', 'success');
  } catch (error) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = code;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    showToast('Code copied to clipboard!', 'success');
  }
}

// Download test file
function downloadTestFile() {
  const code = document.getElementById('generatedCode').textContent;
  const fullCode = `// Generated CitiShop Test Code
// Generated on: ${new Date().toLocaleString()}
// Merchants: ${currentValidation.foundCount} found, ${currentValidation.notFoundMerchants.length} not found

${code}

// To use this code:
// 1. Copy the websites array above
// 2. Replace the existing websites array in your quick-citishop-test.spec.js file
// 3. Run your Playwright test as usual`;

  const blob = new Blob([fullCode], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `citishop-merchants-${Date.now()}.js`;
  a.click();
  URL.revokeObjectURL(url);
  
  showToast('Test file downloaded!', 'success');
}

// Start new test
function startNewTest() {
  clearAll();
}

// updateStatsDisplay function removed (stats section eliminated)

// saveSessionStats and loadSessionStats functions removed (stats section eliminated)

// Save current extension state
async function saveExtensionState() {
  // Get existing stats data to preserve it
  const existingState = await chrome.storage.local.get(['extensionState']);
  const existingExtensionState = existingState.extensionState || {};
  
  const state = {
    currentValidation: currentValidation,
    merchantInput: merchantInput.value,
    testingControlsActive: testingControlsActive,
    currentMerchantIndex: currentMerchantIndex,
    testingMerchants: testingMerchants,
    merchantStatuses: merchantStatuses,
    // Preserve stats data (test dates and notes)
    merchantTestDates: existingExtensionState.merchantTestDates || {},
    merchantNotes: existingExtensionState.merchantNotes || {},
    testExecutionActive: false, // test execution section removed
    resultsVisible: resultsSection.style.display !== 'none',
    codeVisible: codeSection.style.display !== 'none',
    // testingControlsVisible removed (testing window eliminated),
    // lastTestLog removed - test execution section removed
    lastSavedAt: Date.now()
  };
  
  await chrome.storage.local.set({ extensionState: state });
  
  // Update auto-inject crouton data if it exists
  try {
    const autoInjectState = await chrome.storage.local.get(['autoInjectCrouton']);
    const autoInject = autoInjectState.autoInjectCrouton || {};
    
    // Update croutonData for all enabled auto-inject entries
    for (const hostname in autoInject) {
      if (autoInject[hostname].enabled && autoInject[hostname].croutonData) {
        const storedData = autoInject[hostname].croutonData;
        const merchantKey = storedData.currentMerchant?.name?.toLowerCase();
        
        if (merchantKey && state.merchantStatuses) {
          // Update merchant status in stored crouton data
          autoInject[hostname].croutonData.merchantStatus = state.merchantStatuses[merchantKey] || 'pending';
          autoInject[hostname].croutonData.testingMerchants = state.testingMerchants || storedData.testingMerchants;
          autoInject[hostname].croutonData.totalMerchants = (state.testingMerchants || storedData.testingMerchants || []).length;
        }
      }
    }
    
    await chrome.storage.local.set({ autoInjectCrouton: autoInject });
  } catch (error) {
    console.error('Error updating auto-inject crouton data:', error);
  }
}

// Restore extension state
async function restoreExtensionState() {
  try {
    const result = await chrome.storage.local.get(['extensionState']);
    const state = result.extensionState;
    
    if (!state) return;
    
    // Only restore if saved within the last 24 hours
    const hoursSinceLastSave = (Date.now() - state.lastSavedAt) / (1000 * 60 * 60);
    if (hoursSinceLastSave > 24) {
      console.log('State too old, not restoring');
      return;
    }
    
    // Restore merchant input
    if (state.merchantInput) {
      merchantInput.value = state.merchantInput;
    }
    
    // Restore merchant statuses first (before displaying validation results)
    if (state.merchantStatuses) {
      merchantStatuses = state.merchantStatuses;
      console.log('🔄 Restored merchant statuses:', Object.keys(merchantStatuses).length, 'entries');
    } else {
      merchantStatuses = {};
    }
    
    // Stats data (merchantTestDates and merchantNotes) are preserved in storage
    // and will be loaded when refreshStats() is called
    
    // Restore validation results (after merchant statuses are loaded)
    if (state.currentValidation) {
      currentValidation = state.currentValidation;
      displayValidationResults(currentValidation, false); // Don't auto-scroll on state restoration
      console.log('🔄 Displayed validation results with current merchant statuses');
    }
    
    // Restore testing controls state
    if (state.testingControlsActive && state.testingMerchants && state.testingMerchants.length > 0) {
      testingControlsActive = state.testingControlsActive;
      currentMerchantIndex = state.currentMerchantIndex || 0;
      testingMerchants = state.testingMerchants;
      
      // testingControlsSection removed (testing window eliminated)
      updateValidationStatusCounts(); // Update validation status counts after restoring state
    }
    
    // Test execution section restore removed - section no longer exists
    
    if (state.resultsVisible) {
      resultsSection.style.display = 'block';
      // Setup download button when results are restored
      setupDownloadButton();
    }
    
    if (state.codeVisible) {
      codeSection.style.display = 'block';
    }
    
    // testingControlsVisible check removed (testing window eliminated)
    
    console.log('Extension state restored successfully');
    
  } catch (error) {
    console.error('Error restoring extension state:', error);
  }
}

// Show loading overlay
function showLoading(message = 'Loading...') {
  document.getElementById('loadingText').textContent = message;
  loading.style.display = 'flex';
}

// Hide loading overlay
function hideLoading() {
  loading.style.display = 'none';
}

// Show toast notification
function showToast(message, type = 'info') {
  const toastEl = document.getElementById('toast');
  const messageEl = document.getElementById('toastMessage');
  
  messageEl.textContent = message;
  toastEl.className = `toast toast-${type}`;
  toastEl.style.display = 'block';
  
  setTimeout(() => {
    toastEl.style.display = 'none';
  }, 3000);
}

// Add visual feedback effect to button presses
function addButtonPressEffect(button) {
  console.log('🎨 Adding button press effect to:', button);
  console.log('🎨 Button current classes:', button.classList.toString());
  
  // Add a pressed class for visual feedback
  button.classList.add('btn-pressed');
  console.log('🎨 Added btn-pressed class, new classes:', button.classList.toString());
  
  // Create a ripple effect
  const ripple = document.createElement('span');
  ripple.className = 'btn-ripple';
  button.appendChild(ripple);
  console.log('🎨 Added ripple element');
  
  // Remove the effect after animation
  setTimeout(() => {
    console.log('🎨 Removing button press effect');
    button.classList.remove('btn-pressed');
    if (ripple.parentNode) {
      ripple.parentNode.removeChild(ripple);
    }
    console.log('🎨 Effect removed, final classes:', button.classList.toString());
  }, 200);
}

// Show help modal
function showHelp() {
  console.log('❓ showHelp function called');
  const helpContent = `
    <h4>🚀 Getting Started</h4>
    <p>Follow these steps to test merchants efficiently:</p>
    
    <div class="feature-list">
      <div class="feature-item">
        <div class="feature-icon">📝</div>
        <div class="feature-content">
          <h5>1. Enter Merchants</h5>
          <p>Paste merchant names in the text area (comma-separated or one per line)</p>
        </div>
      </div>
      
      <div class="feature-item">
        <div class="feature-icon">✅</div>
        <div class="feature-content">
          <h5>2. Validate</h5>
          <p>Click "Validate" to check which merchants exist in the CitiShop database</p>
        </div>
      </div>
      
      <div class="feature-item">
        <div class="feature-icon">🧪</div>
        <div class="feature-content">
          <h5>3. Start Testing</h5>
          <p>Click on any merchant URL to navigate and start testing with the floating crouton</p>
        </div>
      </div>
      
      <div class="feature-item">
        <div class="feature-icon">🎯</div>
        <div class="feature-content">
          <h5>4. Navigate & Test</h5>
          <p>Use Previous/Next buttons to navigate between merchants</p>
        </div>
      </div>
      
      <div class="feature-item">
        <div class="feature-icon">🚩</div>
        <div class="feature-content">
          <h5>5. Mark Status</h5>
          <p>Flag problematic merchants or mark successful ones using the action buttons</p>
        </div>
      </div>
      
      <div class="feature-item">
        <div class="feature-icon">📋</div>
        <div class="feature-content">
          <h5>6. Export Results</h5>
          <p>Copy successful or flagged merchant lists for reporting</p>
        </div>
      </div>
    </div>
    
    <h4>🔍 Search Features</h4>
    <ul>
      <li><strong>Merchant Search:</strong> Use the search bar in validation results to quickly find specific merchants</li>
      <li><strong>Crouton Search:</strong> Search for merchants directly from the floating crouton</li>
      <li><strong>Smart Matching:</strong> Searches work with partial names and domain URLs</li>
    </ul>
    
    <h4>💡 Pro Tips</h4>
    <ul>
      <li>The crouton only appears on merchant websites that match your testing list</li>
      <li>Your testing progress is saved automatically and persists across browser sessions</li>
      <li>Use the Flag/Success buttons in the validation list to mark merchants without navigating</li>
    </ul>
  `;
  
  showModal('❓ Help & Usage Guide', helpContent);
}

// Show about modal
function showAbout() {
  console.log('ℹ️ showAbout function called');
  const aboutContent = `
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="font-size: 48px; margin-bottom: 12px;">🏪</div>
      <h4 style="margin: 0; color: #007bff;">CitiShop Merchant Tester</h4>
      <p style="margin: 4px 0 0 0; color: #6c757d; font-size: 14px;">Version 2.0.0</p>
    </div>
    
    <h4>📋 Description</h4>
    <p>A powerful browser extension designed to streamline merchant testing workflows for CitiShop. This tool enables QA teams to efficiently test multiple merchant websites with automated validation and comprehensive tracking.</p>
    
    <h4>✨ Key Features</h4>
    <div class="feature-list">
      <div class="feature-item">
        <div class="feature-icon">📝</div>
        <div class="feature-content">
          <h5>Dynamic Merchant Input</h5>
          <p>Paste merchant lists and validate against comprehensive database</p>
        </div>
      </div>
      
      <div class="feature-item">
        <div class="feature-icon">🎯</div>
        <div class="feature-content">
          <h5>Floating Testing Controls</h5>
          <p>Persistent crouton across all merchant websites with smart URL matching</p>
        </div>
      </div>
      
      <div class="feature-item">
        <div class="feature-icon">🧭</div>
        <div class="feature-content">
          <h5>Smart Navigation</h5>
          <p>Previous/Next/Search functionality with comprehensive status tracking</p>
        </div>
      </div>
      
      <div class="feature-item">
        <div class="feature-icon">📊</div>
        <div class="feature-content">
          <h5>Status Management</h5>
          <p>Flag issues or mark successful tests with real-time progress tracking</p>
        </div>
      </div>
      
      <div class="feature-item">
        <div class="feature-icon">💾</div>
        <div class="feature-content">
          <h5>Cross-Page Persistence</h5>
          <p>Testing state maintained across browser navigation and sessions</p>
        </div>
      </div>
      
      <div class="feature-item">
        <div class="feature-icon">📋</div>
        <div class="feature-content">
          <h5>Export Functionality</h5>
          <p>Copy successful or flagged merchant lists for comprehensive reporting</p>
        </div>
      </div>
    </div>
    
    <h4>🎯 Typical Workflow</h4>
    <ol>
      <li>Paste merchant names (comma-separated or line-by-line)</li>
      <li>Validate against CitiShop merchant database</li>
      <li>Start testing with floating controls on merchant websites</li>
      <li>Navigate through merchants and mark status</li>
      <li>Export results for reporting and analysis</li>
    </ol>
    
    <h4>🔧 Technical Details</h4>
    <ul>
      <li><strong>Compatibility:</strong> Chrome, Safari, and Edge browsers</li>
      <li><strong>Database:</strong> ${merchantDatabase?.length || 0} merchants loaded</li>
      <li><strong>Storage:</strong> Local browser storage with 24-hour persistence</li>
      <li><strong>Performance:</strong> Optimized for large merchant lists</li>
    </ul>
    
    <div style="text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e9ecef;">
      <p style="margin: 0; color: #6c757d; font-size: 13px;">
        Developed by <strong>Neil QA Team</strong><br>
        Built with ❤️ for efficient merchant testing
      </p>
    </div>
  `;
  
  showModal('ℹ️ About CitiShop Tester', aboutContent);
}

// Show settings modal
async function showSettings() {
  console.log('⚙️ showSettings function called');
  
  // Database should already be loaded from extension startup
  // No need to reload it every time settings is opened
  
  const kiehls = merchantDatabase.find(m => m.name.toLowerCase().includes('kiehl'));
  const drhos = merchantDatabase.find(m => m.name.toLowerCase().includes('dr ho'));
  
  console.log('📊 Settings database status:');
  console.log('  Total merchants:', merchantDatabase?.length || 0);
  console.log('  Kiehl\'s found:', kiehls ? `"${kiehls.name}"` : 'NOT FOUND');
  console.log('  Dr Ho\'s found:', drhos ? `"${drhos.name}"` : 'NOT FOUND');
  
  // Get current settings from storage
  chrome.storage.local.get(['extensionSettings'], (result) => {
    const settings = result.extensionSettings || {
      autoSave: true,
      showNotifications: true,
      persistState: true,
      debugMode: false,
      croutonPosition: 'middle-left'
    };
    
    const settingsContent = `
      <div class="settings-section">
        <h5>⚙️ Extension Settings</h5>
        <div class="setting-item">
          <span class="setting-label">Auto-save Progress</span>
          <div class="setting-control">
            <div class="toggle-switch ${settings.autoSave ? 'active' : ''}" data-setting="autoSave">
            </div>
          </div>
        </div>
        <div class="setting-item">
          <span class="setting-label">Show Notifications</span>
          <div class="setting-control">
            <div class="toggle-switch ${settings.showNotifications ? 'active' : ''}" data-setting="showNotifications">
            </div>
          </div>
        </div>
        <div class="setting-item">
          <span class="setting-label">Persist State (24h)</span>
          <div class="setting-control">
            <div class="toggle-switch ${settings.persistState ? 'active' : ''}" data-setting="persistState">
            </div>
          </div>
        </div>
        <div class="setting-item">
          <span class="setting-label">Debug Mode</span>
          <div class="setting-control">
            <div class="toggle-switch ${settings.debugMode ? 'active' : ''}" data-setting="debugMode">
            </div>
          </div>
        </div>
      </div>
      
      <div class="settings-section">
        <h5>🔧 Maintenance</h5>
        <div class="setting-item">
          <span class="setting-label">Force Refresh Database</span>
          <div class="setting-control">
            <button class="btn btn-secondary" id="forceRefreshBtn" style="font-size: 12px; padding: 4px 12px;">
              🔄 Refresh Now
            </button>
          </div>
        </div>
        <div class="setting-item">
          <span class="setting-label">Clear All Data</span>
          <div class="setting-control">
            <button class="btn btn-tertiary" id="clearAllDataBtn" style="font-size: 12px; padding: 4px 12px; background: #dc3545; color: white;">
              🗑️ Clear All
            </button>
          </div>
        </div>
      </div>
    `;
    
    showModal('⚙️ Settings & Configuration', settingsContent, () => {
      // Setup event listeners for settings controls
      setupSettingsEventListeners(settings);
      
      // Ensure settings modal scroll is reset to top
      const modalBody = document.getElementById('modalBody');
      if (modalBody) {
        modalBody.scrollTop = 0;
        console.log('🔍 Reset settings modal scroll position to top');
      }
    });
  });
  
  // Note: Some merchant names legitimately contain backslashes (e.g., "Kohl\\", "Kiehl\\")
  // These are not corrupted data, so we don't need to auto-refresh
}

// Check and clear old cached data that might be corrupted
async function checkAndClearOldData() {
  try {
    const result = await chrome.storage.local.get(['databaseVersion']);
    const currentVersion = result.databaseVersion;
    
    console.log('📦 Current cached database version:', currentVersion);
    console.log('📦 Expected database version: 2.0.0');
    
    // If version is old or not present, clear everything
    if (!currentVersion || currentVersion !== '2.0.0') {
      console.log('🧹 Clearing old cached data...');
      await chrome.storage.local.clear();
      console.log('✅ Old data cleared, will load fresh database');
    } else {
      // Even if version is correct, check for corrupted data
      const merchantResult = await chrome.storage.local.get(['merchantDatabase']);
      if (merchantResult.merchantDatabase) {
        const corruptedEntries = merchantResult.merchantDatabase.filter(m => m.name.endsWith('\\'));
        if (corruptedEntries.length > 0) {
          console.log('🧹 Found corrupted entries, clearing cache...');
          await chrome.storage.local.clear();
        }
      }
    }
  } catch (error) {
    console.error('Error checking cached data:', error);
    // If there's any error, clear cache to be safe
    await chrome.storage.local.clear();
  }
}

// Force refresh merchant database (for debugging)
async function forceRefreshDatabase() {
  try {
    showToast('Refreshing merchant database...', 'info');
    console.log('🔄 Force refreshing database...');
    
    // Clear ALL stored data to force fresh load
    await chrome.storage.local.clear();
    console.log('✅ Cleared all storage');
    
    // Reset global variables
    merchantDatabase = [];
    currentValidation = null;
    testingMerchants = [];
    testingControlsActive = false;
    
    // Reload the database
    await loadMerchantDatabase();
    
    showToast(`Database refreshed! ${merchantDatabase.length} merchants loaded`, 'success');
    console.log('🔄 Database force refreshed');
    
    // Debug: Check if merchants are now properly loaded
    const kiehls = merchantDatabase.find(m => m.name.toLowerCase().includes('kiehl'));
    const drho = merchantDatabase.find(m => m.name.toLowerCase().includes('dr ho'));
    console.log('🔍 Kiehl\'s after refresh:', kiehls ? `"${kiehls.name}"` : 'NOT FOUND');
    console.log('🔍 Dr Ho\'s after refresh:', drho ? `"${drho.name}"` : 'NOT FOUND');
    
    // Hide any visible sections that depend on validation
    // testingControlsSection and testingResetSection removed (testing sections eliminated)
    if (resultsSection) resultsSection.style.display = 'none';
    
  } catch (error) {
    console.error('Failed to refresh database:', error);
    showToast('Failed to refresh database: ' + error.message, 'error');
  }
}

// Start testing current merchant - navigate to the website
async function startTestingCurrentMerchant() {
  console.log('🚀 Start testing button clicked');
  console.log('📊 Debug state:');
  console.log('  testingControlsActive:', testingControlsActive);
  console.log('  testingMerchants:', testingMerchants);
  console.log('  testingMerchants.length:', testingMerchants?.length);
  console.log('  currentMerchantIndex:', currentMerchantIndex);
  
  if (!testingControlsActive) {
    console.log('❌ Testing controls not active');
    showToast('Testing controls not active. Please validate merchants first.', 'error');
    return;
  }
  
  if (!testingMerchants || testingMerchants.length === 0) {
    console.log('❌ No testing merchants available');
    showToast('No merchants available for testing', 'error');
    return;
  }
  
  const currentMerchant = testingMerchants[currentMerchantIndex];
  console.log('📍 Current merchant:', currentMerchant);
  
  if (!currentMerchant) {
    console.log('❌ No current merchant at index:', currentMerchantIndex);
    showToast('No current merchant selected', 'error');
    return;
  }
  
  try {
    console.log(`🌐 Navigating to: ${currentMerchant.name} - ${currentMerchant.url}`);
    
    // Get the current active tab and navigate to the merchant's URL
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.update(tab.id, { url: currentMerchant.url });
    
    showToast(`Navigating to ${currentMerchant.name}...`, 'success');
    
    // Update the status to indicate testing has started
    if (controlsStatus) {
      const cleanMerchantName = currentMerchant.name.replace(/\\+$/, "'s");
      controlsStatus.textContent = `🌐 Testing ${cleanMerchantName}...`;
    }
    
    // Update the start testing button to show it's in progress
    if (startTestingBtn) {
      startTestingBtn.textContent = '🌐 Testing in progress...';
      startTestingBtn.disabled = true;
      
      // Re-enable the button after a few seconds
      setTimeout(() => {
        startTestingBtn.textContent = '🚀 Start Testing?';
        startTestingBtn.disabled = false;
      }, 3000);
    }
    
  } catch (error) {
    console.error('Failed to navigate to merchant:', error);
    showToast('Failed to navigate to merchant: ' + error.message, 'error');
  }
}

// Duplicate validateMerchants function removed - using the main version above

// Duplicate loadSampleMerchants function removed - using the main version above

// Duplicate clearAll function removed - using the async version above

// Find merchant in database function
function findMerchantInDatabase(searchName) {
  
  if (!merchantDatabase || merchantDatabase.length === 0) {
    console.warn('⚠️ Merchant database not loaded or empty');
    console.warn('⚠️ merchantDatabase:', merchantDatabase);
    return null;
  }

  const normalizedSearch = searchName.toLowerCase().trim();
  console.log(`🔍 Normalized search term: "${normalizedSearch}"`);
  
  // Try exact match first
  let merchant = merchantDatabase.find(m => {
    const normalizedMerchant = m.name.toLowerCase();
    const isExactMatch = normalizedMerchant === normalizedSearch;
    if (isExactMatch) {
      console.log(`✅ Exact match found: "${m.name}"`);
    }
    return isExactMatch;
  });
  
  if (merchant) return merchant;
  
  // Try partial match
  console.log(`🔍 Trying partial match for: "${normalizedSearch}"`);
  merchant = merchantDatabase.find(m => {
    const normalizedMerchant = m.name.toLowerCase();
    const isPartialMatch = normalizedMerchant.includes(normalizedSearch) ||
                          normalizedSearch.includes(normalizedMerchant);
    if (isPartialMatch) {
      console.log(`✅ Partial match found: "${m.name}" (normalized: "${normalizedMerchant}")`);
    }
    return isPartialMatch;
  });
  
  if (!merchant) {
    console.log(`❌ No match found for: "${searchName}"`);
    // Show first few merchants for debugging
    // Use the predefined sample merchants instead of database slice
    console.log(`📋 Using predefined sample merchants:`, sampleMerchants);
  }
  
  return merchant || null;
}


// Initialize extension function
async function initializeExtension() {
  console.log('🚀 Initializing extension...');
  
  try {
    // Always load the full merchant database on startup
    await loadMerchantDatabase();
    console.log('✅ Extension initialized successfully with full database');
  } catch (error) {
    console.error('❌ Extension initialization failed:', error);
    throw error; // Don't fallback to sample data, let the error propagate
  }
}

// Check if extension was reloaded and reset testing state
async function checkExtensionReload() {
  try {
    // Check if this is a fresh extension load (no runtime ID stored)
    const result = await chrome.storage.local.get(['extensionRuntimeId', 'extensionState']);
    const currentRuntimeId = chrome.runtime.id;
    const storedRuntimeId = result.extensionRuntimeId;
    
    console.log('🔄 Extension runtime check:', { current: currentRuntimeId, stored: storedRuntimeId });
    
    // If runtime ID changed or doesn't exist, extension was reloaded
    if (!storedRuntimeId || storedRuntimeId !== currentRuntimeId) {
      console.log('🔄 Extension was reloaded - preserving stats data');
      
      // Preserve stats data (merchantStatuses, merchantTestDates, merchantNotes)
      const preservedStats = {
        merchantStatuses: result.extensionState?.merchantStatuses || {},
        merchantTestDates: result.extensionState?.merchantTestDates || {},
        merchantNotes: result.extensionState?.merchantNotes || {}
      };
      
      // Restore merchantStatuses to local variable
      merchantStatuses = preservedStats.merchantStatuses;
      
      // Reset testing state (but keep stats)
      testingControlsActive = false;
      testingMerchants = [];
      currentMerchantIndex = 0;
      
      // Clear testing-related storage but keep validation results and stats
      const stateToKeep = {
        currentValidation: result.extensionState?.currentValidation,
        merchantInput: result.extensionState?.merchantInput,
        merchantDatabase: result.extensionState?.merchantDatabase,
        resultsVisible: result.extensionState?.resultsVisible,
        codeVisible: result.extensionState?.codeVisible,
        merchantStatuses: preservedStats.merchantStatuses,
        merchantTestDates: preservedStats.merchantTestDates,
        merchantNotes: preservedStats.merchantNotes,
        lastSavedAt: Date.now()
      };
      
      await chrome.storage.local.set({ 
        extensionState: stateToKeep,
        extensionRuntimeId: currentRuntimeId
      });
      
      console.log('✅ Testing state reset, validation results and stats preserved');
    } else {
      console.log('✅ Extension runtime unchanged - preserving state');
      // Restore merchantStatuses from storage
      if (result.extensionState?.merchantStatuses) {
        merchantStatuses = result.extensionState.merchantStatuses;
      } else {
        merchantStatuses = {};
      }
    }
    
    // Always update the runtime ID for next check
    await chrome.storage.local.set({ extensionRuntimeId: currentRuntimeId });
    
  } catch (error) {
    console.error('❌ Failed to check extension reload:', error);
  }
}

// Check if extension was just updated and reset UI accordingly
async function checkForExtensionUpdate() {
  try {
    const result = await chrome.storage.local.get(['extensionVersion', 'lastUpdateTime', 'extensionState']);
    const currentVersion = chrome.runtime.getManifest().version;
    const storedVersion = result.extensionVersion;
    const lastUpdate = result.lastUpdateTime || 0;
    const now = Date.now();
    
    // If version changed or update was recent (within last 30 seconds), reset everything
    if (storedVersion !== currentVersion || (now - lastUpdate) < 30000) {
      console.log('🔄 Extension update detected - resetting UI to clean state');
      console.log('🔄 Previous version:', storedVersion, 'Current version:', currentVersion);
      console.log('🔄 Time since last update:', (now - lastUpdate) / 1000, 'seconds');
      
      // Preserve stats data before clearing
      const statsToPreserve = {
        merchantStatuses: result.extensionState?.merchantStatuses || {},
        merchantTestDates: result.extensionState?.merchantTestDates || {},
        merchantNotes: result.extensionState?.merchantNotes || {}
      };
      
      // Clear all UI state
      currentValidation = null;
      displayValidationResults(null, false);
      
      // Clear all inputs
      if (merchantInput) {
        merchantInput.value = '';
      }
      
      if (merchantSearchInput) {
        merchantSearchInput.value = '';
      }
      
      // Clear highlights
      clearSearchHighlights();
      
      // Reset filter state
      currentValidationFilter = null;
      updateFilterButtonStates();
      
      // Clear UI state but preserve merchant database and stats
      await chrome.storage.local.remove(['validationFilter', 'lastValidationResults']);
      
      // Restore stats to extensionState
      const currentState = await chrome.storage.local.get(['extensionState']);
      const currentExtensionState = currentState.extensionState || {};
      currentExtensionState.merchantStatuses = statsToPreserve.merchantStatuses;
      currentExtensionState.merchantTestDates = statsToPreserve.merchantTestDates;
      currentExtensionState.merchantNotes = statsToPreserve.merchantNotes;
      await chrome.storage.local.set({ extensionState: currentExtensionState });
      
      // Restore merchantStatuses to local variable
      merchantStatuses = statsToPreserve.merchantStatuses;
      
      // Update version and timestamp
      await chrome.storage.local.set({ 
        extensionVersion: currentVersion,
        lastUpdateTime: now
      });
      
      console.log('✅ Extension UI reset after update - database will be reloaded fresh from citiList.txt, stats preserved');
    }
    
  } catch (error) {
    console.error('❌ Error checking for extension update:', error);
  }
}

// Check and clear old data function
async function checkAndClearOldData() {
  try {
    const result = await chrome.storage.local.get(['extensionState']);
    const state = result.extensionState;
    
    if (state && state.lastSavedAt) {
      const daysSinceLastSave = (Date.now() - state.lastSavedAt) / (1000 * 60 * 60 * 24);
      
      if (daysSinceLastSave > 7) {
        console.log('🗑️ Clearing old extension data (>7 days old)');
        await chrome.storage.local.remove(['extensionState']);
      }
    }
  } catch (error) {
    console.error('❌ Failed to check/clear old data:', error);
  }
}

// Start background validation sync
function startBackgroundValidationSync() {
  console.log('🔄 Starting background validation sync...');
  chrome.runtime.sendMessage({ action: 'startValidationSync' }, (response) => {
    if (response && response.success) {
      console.log('✅ Background validation sync started');
    } else {
      console.error('❌ Failed to start background validation sync');
    }
  });
}

// Stop background validation sync
function stopBackgroundValidationSync() {
  console.log('🛑 Stopping background validation sync...');
  chrome.runtime.sendMessage({ action: 'stopValidationSync' }, (response) => {
    if (response && response.success) {
      console.log('✅ Background validation sync stopped');
    } else {
      console.error('❌ Failed to stop background validation sync');
    }
  });
}

// Refresh validation results with current merchant statuses (duplicate function removed)
// Update validation status counts display
function updateValidationStatusCounts() {
  if (!currentValidation || !currentValidation.foundMerchants) {
    console.log('⚠️ No validation data for status count update');
    return;
  }
  
  console.log('🔄 Updating validation status counts...');
  
  let successfulCount = 0;
  let flaggedCount = 0;
  let testedCount = 0;
  
  // Count statuses from current merchant statuses
  currentValidation.foundMerchants.forEach(merchant => {
    const merchantKey = merchant.name.toLowerCase(); // Use same key format as crouton
    const status = merchantStatuses[merchantKey];
    
    console.log(`📊 Counting merchant "${merchant.name}" (key: "${merchantKey}"): status = "${status}"`);
    
    switch (status) {
      case 'successful':
        successfulCount++;
        testedCount++;
        break;
      case 'flagged':
        flaggedCount++;
        testedCount++;
        break;
      case 'tested':
        testedCount++;
        break;
    }
  });
  
  // Update count displays
  const successfulCountEl = document.getElementById('validationSuccessfulCount');
  const flaggedCountEl = document.getElementById('validationFlaggedCount');
  const testedCountEl = document.getElementById('validationTestedCount');
  
  if (successfulCountEl) {
    successfulCountEl.textContent = successfulCount.toString();
  }
  
  if (flaggedCountEl) {
    flaggedCountEl.textContent = flaggedCount.toString();
  }
  
  if (testedCountEl) {
    const totalCount = currentValidation.foundMerchants.length;
    testedCountEl.textContent = `${testedCount}/${totalCount}`;
  }
  
  // Show/hide status counts section
  const statusCountsSection = document.getElementById('validationStatusCounts');
  if (statusCountsSection) {
    // Show if there are any statuses to display
    if (successfulCount > 0 || flaggedCount > 0 || testedCount > 0) {
      statusCountsSection.style.display = 'block';
    } else {
      statusCountsSection.style.display = 'none';
    }
  }
  
  console.log(`✅ Status counts updated: ${successfulCount} successful, ${flaggedCount} flagged, ${testedCount}/${currentValidation.foundMerchants.length} tested`);
}

// Refresh popup state from storage (for sync with background script changes)
async function refreshStateFromStorage() {
  try {
    console.log('🔄 Refreshing popup state from storage...');
    const result = await chrome.storage.local.get(['extensionState']);
    const state = result.extensionState;
    
    if (state) {
      console.log('🔄 Found stored state, updating popup variables...');
      
      // Update key state variables that might have changed
      if (state.merchantStatuses) {
        const oldStatusCount = Object.keys(merchantStatuses).length;
        merchantStatuses = state.merchantStatuses;
        const newStatusCount = Object.keys(merchantStatuses).length;
        console.log(`🔄 Updated merchantStatuses: ${oldStatusCount} -> ${newStatusCount} entries`);
      }
      
      if (state.currentMerchantIndex !== undefined) {
        const oldIndex = currentMerchantIndex;
        currentMerchantIndex = state.currentMerchantIndex;
        console.log(`🔄 Updated currentMerchantIndex: ${oldIndex} -> ${currentMerchantIndex}`);
      }
      
      if (state.testingMerchants) {
        testingMerchants = state.testingMerchants;
        console.log(`🔄 Updated testingMerchants: ${testingMerchants.length} merchants`);
      }
      
      if (state.testingControlsActive !== undefined) {
        testingControlsActive = state.testingControlsActive;
        console.log(`🔄 Updated testingControlsActive: ${testingControlsActive}`);
      }
      
      console.log('✅ State refresh complete');
      
      // Update UI to reflect the refreshed state
      if (currentValidation && currentValidation.foundMerchants) {
        console.log('🔄 Triggering UI updates after state refresh...');
        refreshValidationResults();
        updateValidationStatusCounts();
        
        // Ensure validation sync polling is running if testing is active
        if (testingControlsActive && !validationSyncPolling) {
          startValidationSyncPolling();
        }
        
        console.log('✅ UI updates completed');
      }
    } else {
      console.log('⚠️ No stored state found during refresh');
    }
  } catch (error) {
    console.error('❌ Failed to refresh state from storage:', error);
  }
}

// Check for pending crouton actions
async function checkPendingCroutonActions() {
  try {
    const result = await chrome.storage.local.get(['pendingCroutonAction']);
    
    if (result.pendingCroutonAction) {
      const { action, timestamp } = result.pendingCroutonAction;
      
      console.log(`🔍 Found pending crouton action: ${action}, age: ${Date.now() - timestamp}ms`);
      
      // Only process recent actions (within last 30 seconds)
      if (Date.now() - timestamp < 30000) {
        console.log(`✅ Processing crouton action: ${action}`);
        
        // First refresh state from storage to get latest merchant statuses
        console.log('🔄 Refreshing popup state before processing crouton action...');
        await refreshStateFromStorage();
        
        switch (action) {
          case 'previousMerchant':
            // Update index if action comes from crouton with specific position
            if (result.pendingCroutonAction.currentIndex !== undefined) {
              console.log(`🔄 Previous from crouton: updating index from ${currentMerchantIndex} to ${result.pendingCroutonAction.currentIndex}`);
              currentMerchantIndex = result.pendingCroutonAction.currentIndex;
            }
            goToPreviousMerchant();
            break;
          case 'testCurrentMerchant':
            // Check if we have action data with specific merchant info
            if (result.pendingCroutonAction.currentMerchant && result.pendingCroutonAction.currentIndex !== undefined) {
              console.log(`🎯 Using merchant from crouton: ${result.pendingCroutonAction.currentMerchant.name} (index ${result.pendingCroutonAction.currentIndex})`);
              currentMerchantIndex = result.pendingCroutonAction.currentIndex;
              testCurrentMerchant();
            } else {
              testCurrentMerchant();
            }
            break;
          case 'nextMerchant':
            // Update index if action comes from crouton with specific position
            if (result.pendingCroutonAction.currentIndex !== undefined) {
              console.log(`🔄 Next from crouton: updating index from ${currentMerchantIndex} to ${result.pendingCroutonAction.currentIndex}`);
              currentMerchantIndex = result.pendingCroutonAction.currentIndex;
            }
            goToNextMerchant();
            break;
          case 'flagMerchant':
            // Use specific merchant data from crouton if provided
            if (result.pendingCroutonAction.merchantName) {
              console.log('🚩 Processing flag action for specific merchant:', result.pendingCroutonAction.merchantName);
              const merchantKey = result.pendingCroutonAction.merchantName.toLowerCase();
              
              // Check if already flagged
              if (merchantStatuses[merchantKey] === 'flagged') {
                // Removed toast notification
                return;
              }
              
              // Mark the specific merchant as flagged
              merchantStatuses[merchantKey] = 'flagged';
              // Removed toast notification
              console.log(`🚩 Flagged ${result.pendingCroutonAction.merchantName} via crouton`);
              
              // Store test date
              const flagState = await chrome.storage.local.get(['extensionState']);
              const flagExtensionState = flagState.extensionState || {};
              if (!flagExtensionState.merchantTestDates) {
                flagExtensionState.merchantTestDates = {};
              }
              flagExtensionState.merchantTestDates[merchantKey] = new Date().toISOString();
              flagExtensionState.merchantStatuses = merchantStatuses; // Update statuses too
              await chrome.storage.local.set({ extensionState: flagExtensionState });
              
              // Save state and wait for completion
              await saveExtensionState();
              console.log('✅ Extension state saved after flagging');
              
              // Update UI
              setTimeout(() => {
                forceValidationRefresh('crouton flag action - specific merchant');
              }, 50);
              
              // Refresh stats if stats tab is active
              const statsTab = document.getElementById('statsTab');
              if (statsTab && statsTab.style.display !== 'none') {
                refreshStats();
              }
            } else {
              // Fallback to current merchant
              flagCurrentMerchant();
            }
            
            // Immediately sync validation results
            setTimeout(() => {
              forceValidationRefresh('crouton flag action');
            }, 100);
            break;
          case 'successMerchant':
            // Use specific merchant data from crouton if provided
            if (result.pendingCroutonAction.merchantName) {
              console.log('✅ Processing success action for specific merchant:', result.pendingCroutonAction.merchantName);
              const merchantKey = result.pendingCroutonAction.merchantName.toLowerCase();
              
              // Mark the specific merchant as successful
              merchantStatuses[merchantKey] = 'successful';
              // Removed toast notification
              console.log(`✅ Marked ${result.pendingCroutonAction.merchantName} as successful via crouton`);
              
              // Store test date
              const successState = await chrome.storage.local.get(['extensionState']);
              const successExtensionState = successState.extensionState || {};
              if (!successExtensionState.merchantTestDates) {
                successExtensionState.merchantTestDates = {};
              }
              successExtensionState.merchantTestDates[merchantKey] = new Date().toISOString();
              successExtensionState.merchantStatuses = merchantStatuses; // Update statuses too
              await chrome.storage.local.set({ extensionState: successExtensionState });
              
              // Save state and wait for completion
              await saveExtensionState();
              console.log('✅ Extension state saved after marking successful');
              
              // Update UI
              setTimeout(() => {
                forceValidationRefresh('crouton success action - specific merchant');
              }, 50);
              
              // Refresh stats if stats tab is active
              const statsTab = document.getElementById('statsTab');
              if (statsTab && statsTab.style.display !== 'none') {
                refreshStats();
              }
            } else {
              // Fallback to current merchant
              markCurrentMerchantSuccessful();
            }
            
            // Immediately sync validation results
            setTimeout(() => {
              forceValidationRefresh('crouton success action');
            }, 100);
            break;
          case 'searchMerchant':
            searchToMerchant(result.pendingCroutonAction.targetIndex);
            break;
          case 'copySuccessfulMerchants':
            copySuccessfulMerchants();
            break;
          case 'copyFlaggedMerchants':
            copyFlaggedMerchants();
            break;
          default:
            console.log('Unknown crouton action:', action);
        }
        
        // Removed crouton action toast notification
      } else {
        console.log(`⏰ Crouton action too old (${Date.now() - timestamp}ms > 30000ms), ignoring`);
      }
      
      // Clear the pending action
      await chrome.storage.local.remove(['pendingCroutonAction']);
    }
  } catch (error) {
    console.error('Failed to check pending crouton actions:', error);
  }
}

// Start polling for crouton actions when testing is active
function startCroutonActionPolling() {
  if (croutonActionPolling) {
    console.log('🏪 Crouton polling already active');
    return; // Already polling
  }
  
  croutonActionPolling = setInterval(() => {
    // Less verbose logging to avoid console spam
    checkPendingCroutonActions();
  }, 250); // Check every 250ms for faster sync
  
  console.log('🏪 Started crouton action polling (every 250ms for faster sync)');
}

function stopCroutonActionPolling() {
  if (croutonActionPolling) {
    clearInterval(croutonActionPolling);
    croutonActionPolling = null;
    console.log('🏪 Stopped crouton action polling');
  }
}

// Force immediate validation results refresh
function forceValidationRefresh(reason = 'manual') {
  console.log(`🔄 Force validation refresh requested: ${reason}`);
  
  if (!currentValidation || !currentValidation.foundMerchants) {
    console.log('📊 No validation results to refresh');
    return;
  }
  
  // First, get fresh merchant statuses from storage to ensure we have the latest data
  chrome.storage.local.get(['extensionState'], (result) => {
    if (result.extensionState && result.extensionState.merchantStatuses) {
      // Update local merchantStatuses with fresh data from storage
      merchantStatuses = { ...result.extensionState.merchantStatuses };
      console.log(`🔄 Force refresh: Updated merchantStatuses from storage (${reason}):`, merchantStatuses);
    }
    
    // Refresh validation results display with fresh data
    refreshValidationResults();
    
    // Update status counts with fresh data
    updateValidationStatusCounts();
    
    console.log(`✅ Force validation refresh completed: ${reason}`);
  });
}

// Start validation results sync polling
function startValidationSyncPolling() {
  // Stop any existing polling
  stopValidationSyncPolling();
  
  // Only start if we have validation results to sync
  if (!currentValidation || !currentValidation.foundMerchants) {
    console.log('📊 No validation results to sync - skipping polling');
    return;
  }
  
  // Start polling every 2 seconds for faster updates
  validationSyncPolling = setInterval(() => {
    console.log('📊 Validation sync poll - checking for status updates...');
    
    // Get fresh data from storage before refreshing
    chrome.storage.local.get(['extensionState'], (result) => {
      if (result.extensionState && result.extensionState.merchantStatuses) {
        // Update local merchantStatuses with fresh data from storage
        merchantStatuses = { ...result.extensionState.merchantStatuses };
        console.log('📊 Sync poll: Updated merchantStatuses from storage');
      }
      
      // Refresh validation results with fresh data
      refreshValidationResults();
      updateValidationStatusCounts();
    });
  }, 2000);
  
  console.log('📊 Started validation sync polling (every 2 seconds)');
}

// Stop validation results sync polling
function stopValidationSyncPolling() {
  if (validationSyncPolling) {
    clearInterval(validationSyncPolling);
    validationSyncPolling = null;
    console.log('📊 Stopped validation sync polling');
  }
}

// Modal utility functions
function showModal(title, content, onShow = null) {
  console.log('🎭 showModal called with title:', title);
  
  const modalOverlay = document.getElementById('modalOverlay');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const modalClose = document.getElementById('modalClose');
  const modalCancelBtn = document.getElementById('modalCancelBtn');
  const modalConfirmBtn = document.getElementById('modalConfirmBtn');
  
  console.log('🎭 Modal elements found:', {
    modalOverlay: !!modalOverlay,
    modalTitle: !!modalTitle,
    modalBody: !!modalBody,
    modalClose: !!modalClose,
    modalCancelBtn: !!modalCancelBtn,
    modalConfirmBtn: !!modalConfirmBtn
  });
  
  if (!modalOverlay) {
    console.error('❌ Modal overlay not found!');
    return;
  }
  
  modalTitle.textContent = title;
  modalBody.innerHTML = content;
  modalOverlay.style.display = 'flex';
  
  // Reset scroll position to top when modal is shown
  modalBody.scrollTop = 0;
  console.log('🔍 Reset modal body scroll position to top');
  
  console.log('✅ Modal should now be visible');
  
  // Setup close handlers
  const closeModal = () => {
    modalOverlay.style.display = 'none';
  };
  
  modalClose.onclick = closeModal;
  modalCancelBtn.onclick = closeModal;
  modalConfirmBtn.onclick = closeModal;
  
  // Close on overlay click
  modalOverlay.onclick = (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  };
  
  // Close on Escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
  
  // Call onShow callback if provided
  if (onShow) {
    setTimeout(onShow, 100);
  }
}

// Setup settings event listeners
function setupSettingsEventListeners(currentSettings) {
  // Toggle switches
  document.querySelectorAll('.toggle-switch').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const setting = toggle.dataset.setting;
      const isActive = toggle.classList.contains('active');
      
      // Toggle visual state
      toggle.classList.toggle('active');
      
      // Update settings
      currentSettings[setting] = !isActive;
      saveExtensionSettings(currentSettings);
      
      console.log(`⚙️ Setting ${setting} changed to:`, !isActive);
    });
  });
  
  
  // Force refresh button
  const forceRefreshBtn = document.getElementById('forceRefreshBtn');
  if (forceRefreshBtn) {
    forceRefreshBtn.addEventListener('click', async () => {
      forceRefreshBtn.disabled = true;
      forceRefreshBtn.textContent = '🔄 Refreshing...';
      
      try {
        await forceRefreshDatabase();
        forceRefreshBtn.textContent = '✅ Refreshed!';
        setTimeout(() => {
          forceRefreshBtn.disabled = false;
          forceRefreshBtn.textContent = '🔄 Refresh Now';
        }, 2000);
      } catch (error) {
        forceRefreshBtn.textContent = '❌ Failed';
        setTimeout(() => {
          forceRefreshBtn.disabled = false;
          forceRefreshBtn.textContent = '🔄 Refresh Now';
        }, 2000);
      }
    });
  }
  
  // Clear all data button
  const clearAllDataBtn = document.getElementById('clearAllDataBtn');
  if (clearAllDataBtn) {
    clearAllDataBtn.addEventListener('click', () => {
      if (confirm('⚠️ Are you sure you want to clear ALL extension data? This cannot be undone.')) {
        clearAllExtensionData();
      }
    });
  }
}

// Save extension settings
async function saveExtensionSettings(settings) {
  try {
    await chrome.storage.local.set({ extensionSettings: settings });
    console.log('⚙️ Settings saved:', settings);
  } catch (error) {
    console.error('❌ Failed to save settings:', error);
  }
}

// Clear all extension data
async function clearAllExtensionData() {
  try {
    await chrome.storage.local.clear();
    showToast('All extension data cleared! Please refresh the page.', 'success');
    console.log('🗑️ All extension data cleared');
    
    // Reset variables
    merchantDatabase = [];
    currentValidation = null;
    testingMerchants = [];
    merchantStatuses = {};
    currentMerchantIndex = 0;
    testingControlsActive = false;
    
    // Reset UI
    merchantInput.value = '';
    resultsSection.style.display = 'none';
    codeSection.style.display = 'none';
    
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  } catch (error) {
    console.error('❌ Failed to clear data:', error);
    showToast('Failed to clear data', 'error');
  }
}

// Pin extension to current tab as persistent overlay
async function pinExtensionToTab() {
  console.log('📌 Pinning extension to current tab...');
  
  try {
    // Get the current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      showToast('Unable to pin to current tab', 'error');
      return;
    }
    
    console.log('📌 Current tab:', tab.url);
    
    // Store the original popup state before pinning
    await chrome.storage.local.set({
      pinnedTabInfo: {
        tabId: tab.id,
        url: tab.url,
        timestamp: Date.now()
      }
    });
    
    // Inject the persistent overlay content script
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: createPersistentExtensionOverlay,
      args: [chrome.runtime.getURL('popup.html')]
    });
    
    // Also inject the CSS for the overlay
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      css: `
        #citishop-persistent-overlay {
          position: fixed !important;
          top: 20px !important;
          right: 20px !important;
          width: 380px !important;
          height: 580px !important;
          z-index: 2147483647 !important;
          background: white !important;
          border: 2px solid #007bff !important;
          border-radius: 10px !important;
          box-shadow: 0 10px 30px rgba(0, 123, 255, 0.3) !important;
          overflow: hidden !important;
          resize: both !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          isolation: isolate !important;
          min-width: 300px !important;
          min-height: 400px !important;
          max-width: 90vw !important;
          max-height: 90vh !important;
          transform: none !important;
          left: auto !important;
          bottom: auto !important;
          margin: 0 !important;
        }
        
        #citishop-persistent-overlay iframe {
          width: 100% !important;
          height: calc(100% - 40px) !important;
          border: none !important;
          display: block !important;
          transform-origin: top left !important;
          transition: transform 0.2s ease !important;
        }
        
        .citishop-resize-handle {
          position: absolute !important;
          background: transparent !important;
          z-index: 10 !important;
          transition: background-color 0.2s ease !important;
        }
        
        .citishop-resize-handle:hover {
          background: rgba(0, 123, 255, 0.15) !important;
        }
        
        #citishop-overlay-header {
          background: linear-gradient(135deg, #007bff 0%, #0056b3 100%) !important;
          color: white !important;
          padding: 8px 12px !important;
          font-size: 14px !important;
          font-weight: 600 !important;
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          cursor: move !important;
          user-select: none !important;
          flex-shrink: 0 !important;
        }
        
        #citishop-overlay-controls {
          display: flex !important;
          gap: 8px !important;
          align-items: center !important;
        }
        
        #citishop-overlay-scale {
          background: rgba(255, 255, 255, 0.2) !important;
          border: 1px solid rgba(255, 255, 255, 0.3) !important;
          color: white !important;
          border-radius: 4px !important;
          padding: 2px 6px !important;
          font-size: 11px !important;
          min-width: 60px !important;
          text-align: center !important;
        }
        
        #citishop-overlay-close {
          background: rgba(255, 255, 255, 0.2) !important;
          border: 1px solid rgba(255, 255, 255, 0.3) !important;
          color: white !important;
          border-radius: 4px !important;
          padding: 4px 8px !important;
          cursor: pointer !important;
          font-size: 12px !important;
          transition: all 0.2s ease !important;
        }
        
        #citishop-overlay-close:hover {
          background: rgba(255, 255, 255, 0.3) !important;
          transform: scale(1.05) !important;
        }
      `
    });
    
    showToast('Extension pinned to tab - stays visible when clicking away', 'success');
    
    // Close the popup after a short delay
    setTimeout(() => {
      window.close();
    }, 1000);
    
  } catch (error) {
    console.error('❌ Failed to pin extension to tab:', error);
    showToast('Failed to pin extension to tab', 'error');
  }
}

// Check and clean up any pinned tab state on popup load
async function checkAndCleanupPinnedState() {
  console.log('🧹 Checking for pinned tab state to cleanup...');
  
  try {
    const result = await chrome.storage.local.get(['pinnedTabInfo']);
    
    if (result.pinnedTabInfo) {
      console.log('📌 Found pinned tab info:', result.pinnedTabInfo);
      
      // Check if the pinned tab still exists
      try {
        await chrome.tabs.get(result.pinnedTabInfo.tabId);
        console.log('📌 Pinned tab still exists');
      } catch (error) {
        // Tab was closed, clean up the state
        console.log('🧹 Pinned tab was closed, cleaning up state...');
        await chrome.storage.local.remove(['pinnedTabInfo']);
        
        // Reset any popup positioning that might have been affected
        console.log('🧹 Resetting popup positioning...');
        
        // Reset document and body styles
        document.documentElement.style.removeProperty('transform');
        document.documentElement.style.removeProperty('position');
        document.documentElement.style.removeProperty('top');
        document.documentElement.style.removeProperty('left');
        document.documentElement.style.removeProperty('right');
        document.documentElement.style.removeProperty('bottom');
        
        document.body.style.removeProperty('transform');
        document.body.style.removeProperty('position');
        document.body.style.removeProperty('top');
        document.body.style.removeProperty('left');
        document.body.style.removeProperty('right');
        document.body.style.removeProperty('bottom');
        document.body.style.removeProperty('margin');
        document.body.style.removeProperty('padding');
        
        // Reset main container styles
        const mainContainer = document.querySelector('.container');
        if (mainContainer) {
          mainContainer.style.removeProperty('transform');
          mainContainer.style.removeProperty('position');
          mainContainer.style.removeProperty('top');
          mainContainer.style.removeProperty('left');
          mainContainer.style.removeProperty('right');
          mainContainer.style.removeProperty('bottom');
          mainContainer.style.removeProperty('margin');
          mainContainer.style.removeProperty('padding');
        }
        
        // Force a reflow to ensure styles are reset
        document.body.offsetHeight;
        
        console.log('✅ Cleaned up pinned tab state and reset popup position');
      }
    } else {
      console.log('🧹 No pinned tab state found - popup position should be normal');
    }
  } catch (error) {
    console.error('❌ Error checking pinned state:', error);
  }
}

// Function that gets injected into the page to create the persistent overlay
function createPersistentExtensionOverlay(popupUrl) {
  console.log('📌 Creating persistent extension overlay...');
  
  // Remove any existing overlay
  const existingOverlay = document.getElementById('citishop-persistent-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }
  
  // Create the overlay container
  const overlay = document.createElement('div');
  overlay.id = 'citishop-persistent-overlay';
  
  // Create header with title, scale indicator, and close button
  const header = document.createElement('div');
  header.id = 'citishop-overlay-header';
  header.innerHTML = `
    <span>📊 CitiShop Tester (Pinned)</span>
    <div id="citishop-overlay-controls">
      <span id="citishop-overlay-scale">100%</span>
      <button id="citishop-overlay-close">✕ Close</button>
    </div>
  `;
  
  // Create iframe to load the popup content
  const iframe = document.createElement('iframe');
  iframe.src = popupUrl;
  iframe.style.cssText = `
    width: 100% !important;
    height: calc(100% - 40px) !important;
    border: none !important;
    display: block !important;
    transform-origin: top left !important;
    transition: transform 0.2s ease !important;
  `;
  
  // Assemble the overlay
  overlay.appendChild(header);
  overlay.appendChild(iframe);
  
  // Create resize handles for all edges and corners
  const resizeHandles = [
    { position: 'top', cursor: 'n-resize' },
    { position: 'right', cursor: 'e-resize' },
    { position: 'bottom', cursor: 's-resize' },
    { position: 'left', cursor: 'w-resize' },
    { position: 'top-left', cursor: 'nw-resize' },
    { position: 'top-right', cursor: 'ne-resize' },
    { position: 'bottom-left', cursor: 'sw-resize' },
    { position: 'bottom-right', cursor: 'se-resize' }
  ];
  
  resizeHandles.forEach(handle => {
    const resizeHandle = document.createElement('div');
    resizeHandle.className = `citishop-resize-handle citishop-resize-${handle.position}`;
    resizeHandle.style.cssText = `
      position: absolute !important;
      background: transparent !important;
      z-index: 10 !important;
    `;
    
    // Set position and size based on handle type
    if (handle.position === 'top') {
      resizeHandle.style.cssText += `
        top: -5px !important;
        left: 10px !important;
        right: 10px !important;
        height: 10px !important;
        cursor: ${handle.cursor} !important;
      `;
    } else if (handle.position === 'right') {
      resizeHandle.style.cssText += `
        top: 10px !important;
        right: -5px !important;
        bottom: 10px !important;
        width: 10px !important;
        cursor: ${handle.cursor} !important;
      `;
    } else if (handle.position === 'bottom') {
      resizeHandle.style.cssText += `
        bottom: -5px !important;
        left: 10px !important;
        right: 10px !important;
        height: 10px !important;
        cursor: ${handle.cursor} !important;
      `;
    } else if (handle.position === 'left') {
      resizeHandle.style.cssText += `
        top: 10px !important;
        left: -5px !important;
        bottom: 10px !important;
        width: 10px !important;
        cursor: ${handle.cursor} !important;
      `;
    } else if (handle.position === 'top-left') {
      resizeHandle.style.cssText += `
        top: -5px !important;
        left: -5px !important;
        width: 15px !important;
        height: 15px !important;
        cursor: ${handle.cursor} !important;
      `;
    } else if (handle.position === 'top-right') {
      resizeHandle.style.cssText += `
        top: -5px !important;
        right: -5px !important;
        width: 15px !important;
        height: 15px !important;
        cursor: ${handle.cursor} !important;
      `;
    } else if (handle.position === 'bottom-left') {
      resizeHandle.style.cssText += `
        bottom: -5px !important;
        left: -5px !important;
        width: 15px !important;
        height: 15px !important;
        cursor: ${handle.cursor} !important;
      `;
    } else if (handle.position === 'bottom-right') {
      resizeHandle.style.cssText += `
        bottom: -5px !important;
        right: -5px !important;
        width: 15px !important;
        height: 15px !important;
        cursor: ${handle.cursor} !important;
      `;
    }
    
    overlay.appendChild(resizeHandle);
  });
  
  // Add resize observer to handle content scaling
  let currentScale = 1;
  const baseWidth = 380;
  const baseHeight = 580;
  
  const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
      const { width, height } = entry.contentRect;
      
      // Calculate scale based on width and height changes
      const widthScale = width / baseWidth;
      const heightScale = height / baseHeight;
      const newScale = Math.min(widthScale, heightScale);
      
      // Clamp scale between 0.5 and 2.0
      const clampedScale = Math.max(0.5, Math.min(2.0, newScale));
      
      if (Math.abs(clampedScale - currentScale) > 0.01) {
        currentScale = clampedScale;
        
        // Update iframe scale
        iframe.style.transform = `scale(${currentScale})`;
        
        // Update scale indicator
        const scaleIndicator = header.querySelector('#citishop-overlay-scale');
        if (scaleIndicator) {
          scaleIndicator.textContent = `${Math.round(currentScale * 100)}%`;
        }
        
        console.log(`📏 Overlay resized: ${width}x${height}, scale: ${Math.round(currentScale * 100)}%`);
      }
    }
  });
  
  // Start observing the overlay for size changes
  resizeObserver.observe(overlay);
  
  // Add to page
  document.body.appendChild(overlay);
  
  // Make draggable
  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;
  
  header.addEventListener('mousedown', dragStart);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', dragEnd);
  
  function dragStart(e) {
    // Don't start drag if clicking on controls or resize handles
    if (e.target.id === 'citishop-overlay-close' || 
        e.target.id === 'citishop-overlay-scale' ||
        e.target.classList.contains('citishop-resize-handle')) {
      return;
    }
    
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
    
    if (e.target === header || header.contains(e.target)) {
      isDragging = true;
      // Disable iframe pointer events during drag
      iframe.style.pointerEvents = 'none';
      console.log('🔄 Started dragging overlay');
    }
  }
  
  function drag(e) {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      
      xOffset = currentX;
      yOffset = currentY;
      
      overlay.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    }
  }
  
  function dragEnd(e) {
    if (isDragging) {
      initialX = currentX;
      initialY = currentY;
      isDragging = false;
      // Re-enable iframe pointer events
      iframe.style.pointerEvents = 'auto';
      console.log('✅ Stopped dragging overlay');
    }
  }
  
  // Resize functionality
  let isResizing = false;
  let resizeDirection = '';
  let startX, startY, startWidth, startHeight, startLeft, startTop;
  
  // Add resize event listeners to all resize handles
  overlay.querySelectorAll('.citishop-resize-handle').forEach(handle => {
    handle.addEventListener('mousedown', startResize);
  });
  
  function startResize(e) {
    e.preventDefault();
    e.stopPropagation();
    
    isResizing = true;
    resizeDirection = e.target.className.split('citishop-resize-')[1];
    
    startX = e.clientX;
    startY = e.clientY;
    
    const rect = overlay.getBoundingClientRect();
    startWidth = rect.width;
    startHeight = rect.height;
    startLeft = rect.left;
    startTop = rect.top;
    
    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);
    
    // Disable iframe pointer events during resize
    iframe.style.pointerEvents = 'none';
    
    console.log('🔄 Started resizing overlay:', resizeDirection);
  }
  
  function doResize(e) {
    if (!isResizing) return;
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    let newWidth = startWidth;
    let newHeight = startHeight;
    let newLeft = startLeft;
    let newTop = startTop;
    
    // Handle different resize directions
    if (resizeDirection.includes('right')) {
      newWidth = Math.max(300, startWidth + deltaX);
    }
    if (resizeDirection.includes('left')) {
      newWidth = Math.max(300, startWidth - deltaX);
      newLeft = startLeft + deltaX;
      if (newWidth === 300) {
        newLeft = startLeft + startWidth - 300;
      }
    }
    if (resizeDirection.includes('bottom')) {
      newHeight = Math.max(400, startHeight + deltaY);
    }
    if (resizeDirection.includes('top')) {
      newHeight = Math.max(400, startHeight - deltaY);
      newTop = startTop + deltaY;
      if (newHeight === 400) {
        newTop = startTop + startHeight - 400;
      }
    }
    
    // Apply new dimensions and position
    overlay.style.width = newWidth + 'px';
    overlay.style.height = newHeight + 'px';
    overlay.style.left = newLeft + 'px';
    overlay.style.top = newTop + 'px';
    
    // Reset transform to avoid conflicts
    overlay.style.transform = 'none';
    
    // Update offset tracking for dragging
    xOffset = newLeft;
    yOffset = newTop;
  }
  
  function stopResize() {
    if (!isResizing) return;
    
    isResizing = false;
    resizeDirection = '';
    
    document.removeEventListener('mousemove', doResize);
    document.removeEventListener('mouseup', stopResize);
    
    // Re-enable iframe pointer events
    iframe.style.pointerEvents = 'auto';
    
    console.log('✅ Stopped resizing overlay');
  }
  
  // Add close functionality
  const closeBtn = header.querySelector('#citishop-overlay-close');
  closeBtn.addEventListener('click', () => {
    // Clean up resize observer
    resizeObserver.disconnect();
    
    // Remove overlay
    overlay.remove();
    console.log('📌 Persistent overlay closed');
  });
  
  console.log('✅ Persistent extension overlay created');
}

// Open detached popup window that stays open
async function openDetachedPopup() {
  console.log('📌 Opening detached popup window...');
  
  try {
    // Get current popup dimensions
    const currentWindow = await chrome.windows.getCurrent();
    const popupWidth = 400;
    const popupHeight = 600;
    
    // Calculate position (offset from current window)
    const left = currentWindow.left + 50;
    const top = currentWindow.top + 50;
    
    // Create new detached popup window
    const newWindow = await chrome.windows.create({
      url: chrome.runtime.getURL('popup.html'),
      type: 'popup',
      width: popupWidth,
      height: popupHeight,
      left: left,
      top: top,
      focused: true
    });
    
    console.log('✅ Detached popup window created:', newWindow.id);
    showToast('Extension pinned to tab - stays visible when clicking away', 'success');
    
    // Close the original popup after a short delay
    setTimeout(() => {
      window.close();
    }, 1000);
    
  } catch (error) {
    console.error('❌ Failed to open detached popup:', error);
    showToast('Failed to open detached window', 'error');
  }
}

// Detect if running in detached window and hide Keep Open button
function setupDetachedWindowUI() {
  chrome.windows.getCurrent((currentWindow) => {
    if (currentWindow.type === 'popup') {
      console.log('📌 Running in detached popup window');
      
      // Hide the Keep Open button since we're already detached
      const keepOpenBtn = document.getElementById('keepOpenBtn');
      if (keepOpenBtn) {
        keepOpenBtn.style.display = 'none';
        console.log('📌 Hidden Keep Open button in detached window');
      }
      
      // Add indicator that this is a detached window
      const header = document.querySelector('.header .version');
      if (header) {
        header.textContent = 'v2.0.0 📌 Detached';
        header.title = 'This is a detached popup window that stays open';
      }
    }
  });
}

// Setup detached window UI when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Add a small delay to ensure other DOM setup is complete
  setTimeout(() => {
    setupDetachedWindowUI();
  }, 100);
});

// Tab switching functionality
function setupTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;
      
      // Remove active class from all tabs and contents
      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => {
        c.classList.remove('active');
        c.style.display = 'none';
      });
      
      // Add active class to clicked tab and corresponding content
      btn.classList.add('active');
      const targetContent = document.getElementById(`${targetTab}Tab`);
      if (targetContent) {
        targetContent.classList.add('active');
        targetContent.style.display = 'block';
      }
      
      // Refresh stats when switching to stats tab
      if (targetTab === 'stats') {
        refreshStats();
      }
    });
  });
}

// Setup crouton injection button
function setupCroutonInjection() {
  const injectCroutonBtn = document.getElementById('injectCroutonBtn');
  if (injectCroutonBtn) {
    injectCroutonBtn.addEventListener('click', async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab || !tab.url || (!tab.url.startsWith('http://') && !tab.url.startsWith('https://'))) {
          showToast('Please navigate to a valid webpage first', 'error');
          return;
        }
        
        // Inject the floating crouton script
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['floating-crouton.js']
          });
          
          // Get current testing state
          const state = await chrome.storage.local.get(['extensionState']);
          const extensionState = state.extensionState || {};
          const testingMerchants = extensionState.testingMerchants || [];
          const currentMerchantIndex = extensionState.currentMerchantIndex || 0;
          const merchantStatuses = extensionState.merchantStatuses || {};
          
          if (testingMerchants.length === 0) {
            showToast('No merchants available. Please validate merchants first.', 'warning');
            return;
          }
          
          const currentMerchant = testingMerchants[currentMerchantIndex];
          if (!currentMerchant) {
            showToast('No current merchant selected', 'warning');
            return;
          }
          
          // Send message to show crouton
          const croutonData = {
            currentMerchant: currentMerchant,
            currentIndex: currentMerchantIndex,
            totalMerchants: testingMerchants.length,
            testingMerchants: testingMerchants,
            status: `Ready to test ${currentMerchant.name}`,
            merchantStatus: merchantStatuses[currentMerchant.name.toLowerCase()] || 'pending'
          };
          
          await chrome.tabs.sendMessage(tab.id, {
            action: 'showFloatingCrouton',
            data: croutonData
          });
          
          // Store that crouton should be auto-injected for this URL
          const url = new URL(tab.url);
          const hostname = url.hostname.replace(/^www\./, '');
          const autoInjectState = await chrome.storage.local.get(['autoInjectCrouton']);
          const autoInject = autoInjectState.autoInjectCrouton || {};
          autoInject[hostname] = {
            enabled: true,
            lastInjected: Date.now(),
            croutonData: croutonData
          };
          await chrome.storage.local.set({ autoInjectCrouton: autoInject });
          console.log(`✅ Stored auto-inject flag for ${hostname}`);
          
          showToast('Crouton injected successfully!', 'success');
        } catch (error) {
          console.error('Error injecting crouton:', error);
          showToast('Failed to inject crouton: ' + error.message, 'error');
        }
      } catch (error) {
        console.error('Error in crouton injection:', error);
        showToast('Error: ' + error.message, 'error');
      }
    });
  }
}

// Setup stats functionality
function setupStats() {
  const filterButtons = document.querySelectorAll('.filter-btn[data-filter]');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      refreshStats(btn.dataset.filter);
    });
  });
  
  // Setup search functionality
  const statsSearchInput = document.getElementById('statsSearchInput');
  const statsSearchBtn = document.getElementById('statsSearchBtn');
  
  if (statsSearchInput) {
    statsSearchInput.addEventListener('input', () => {
      const activeFilter = document.querySelector('.filter-btn[data-filter].active');
      const filter = activeFilter ? activeFilter.dataset.filter : 'all';
      refreshStats(filter);
    });
    
    statsSearchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const activeFilter = document.querySelector('.filter-btn[data-filter].active');
        const filter = activeFilter ? activeFilter.dataset.filter : 'all';
        refreshStats(filter);
      }
    });
  }
  
  if (statsSearchBtn) {
    statsSearchBtn.addEventListener('click', () => {
      const activeFilter = document.querySelector('.filter-btn[data-filter].active');
      const filter = activeFilter ? activeFilter.dataset.filter : 'all';
      refreshStats(filter);
    });
  }
  
  // Setup clear all stats button
  const clearAllStatsBtn = document.getElementById('clearAllStatsBtn');
  if (clearAllStatsBtn) {
    clearAllStatsBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to clear all stats?\n\nThis will remove:\n• All flagged/successful statuses\n• All test dates\n• All notes\n\nThis cannot be undone.')) {
        try {
          const state = await chrome.storage.local.get(['extensionState']);
          const extensionState = state.extensionState || {};
          
          // Clear only stats-related data
          extensionState.merchantStatuses = {};
          extensionState.merchantTestDates = {};
          extensionState.merchantNotes = {};
          
          // Update local variables
          merchantStatuses = {};
          
          // Save to storage
          await chrome.storage.local.set({ extensionState });
          
          // Clear search input
          if (statsSearchInput) {
            statsSearchInput.value = '';
          }
          
          // Refresh stats display
          refreshStats();
          
          showToast('All stats cleared!', 'success');
          console.log('✅ All stats cleared');
        } catch (error) {
          console.error('❌ Error clearing stats:', error);
          showToast('Failed to clear stats: ' + error.message, 'error');
        }
      }
    });
  }
}

// Refresh stats display
async function refreshStats(filter = 'all') {
  try {
    const state = await chrome.storage.local.get(['extensionState']);
    const extensionState = state.extensionState || {};
    let merchantStatuses = extensionState.merchantStatuses || {};
    const testingMerchants = extensionState.testingMerchants || [];
    let merchantNotes = extensionState.merchantNotes || {}; // Store notes separately
    let merchantTestDates = extensionState.merchantTestDates || {}; // Store test dates
    
    // Preserve current textarea values before recreating HTML
    const statsList = document.getElementById('statsList');
    if (!statsList) return;
    
    const currentNotes = {};
    statsList.querySelectorAll('.merchant-note-input').forEach(textarea => {
      const merchantKey = textarea.dataset.merchantKey;
      if (merchantKey) {
        currentNotes[merchantKey] = textarea.value;
      }
    });
    
    // Merge current notes with saved notes (current takes precedence if user is typing)
    Object.keys(currentNotes).forEach(key => {
      if (currentNotes[key].trim() !== '') {
        merchantNotes[key] = currentNotes[key];
      }
    });
    
    // Count flagged and successful, and ensure dates exist for merchants with status
    let flaggedCount = 0;
    let successfulCount = 0;
    const flaggedMerchants = [];
    const successfulMerchants = [];
    let datesUpdated = false;
    
    testingMerchants.forEach(merchant => {
      const merchantKey = merchant.name.toLowerCase();
      const status = merchantStatuses[merchantKey];
      
      // If merchant has a status but no date, add a date now (for merchants marked before date tracking)
      if (status && !merchantTestDates[merchantKey]) {
        merchantTestDates[merchantKey] = new Date().toISOString();
        datesUpdated = true;
      }
      
      if (status === 'flagged') {
        flaggedCount++;
        flaggedMerchants.push(merchant);
      } else if (status === 'successful') {
        successfulCount++;
        successfulMerchants.push(merchant);
      }
    });
    
    // Save updated dates if any were added
    if (datesUpdated) {
      extensionState.merchantTestDates = merchantTestDates;
      await chrome.storage.local.set({ extensionState });
    }
    
    // Update summary
    const statsTotalFlagged = document.getElementById('statsTotalFlagged');
    const statsTotalSuccessful = document.getElementById('statsTotalSuccessful');
    if (statsTotalFlagged) statsTotalFlagged.textContent = flaggedCount;
    if (statsTotalSuccessful) statsTotalSuccessful.textContent = successfulCount;
    
    // Filter merchants based on selected filter
    let merchantsToShow = [];
    if (filter === 'flagged') {
      merchantsToShow = flaggedMerchants;
    } else if (filter === 'successful') {
      merchantsToShow = successfulMerchants;
    } else {
      merchantsToShow = [...flaggedMerchants, ...successfulMerchants];
    }
    
    if (merchantsToShow.length === 0) {
      statsList.innerHTML = '<div class="empty-state">No merchants match the selected filter.</div>';
      return;
    }
    
    // Format date helper
    const formatDate = (dateString) => {
      if (!dateString) {
        return 'Date not recorded';
      }
      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
          return 'Date not recorded';
        }
        return date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch (e) {
        return 'Date not recorded';
      }
    };
    
    // Get search filter if any
    const statsSearchInput = document.getElementById('statsSearchInput');
    const searchTerm = statsSearchInput ? statsSearchInput.value.toLowerCase().trim() : '';
    
    // Filter by search term if provided
    let filteredMerchants = merchantsToShow;
    if (searchTerm) {
      filteredMerchants = merchantsToShow.filter(merchant => {
        const merchantName = merchant.name.toLowerCase();
        const merchantUrl = (merchant.url || '').toLowerCase();
        return merchantName.includes(searchTerm) || merchantUrl.includes(searchTerm);
      });
    }
    
    if (filteredMerchants.length === 0) {
      statsList.innerHTML = '<div class="empty-state">No merchants match the search criteria.</div>';
      return;
    }
    
    statsList.innerHTML = filteredMerchants.map(merchant => {
      const merchantKey = merchant.name.toLowerCase();
      const status = merchantStatuses[merchantKey];
      const note = merchantNotes[merchantKey] || '';
      const testDate = merchantTestDates[merchantKey];
      const statusClass = status === 'flagged' ? 'flagged' : 'successful';
      
      return `
        <div class="stat-merchant-card ${statusClass}">
          <div class="stat-merchant-header">
            <div class="stat-merchant-name">${escapeHtml(merchant.name)}</div>
            <div class="stat-merchant-status ${statusClass}">${status === 'flagged' ? '🚩 Flagged' : '✅ Successful'}</div>
          </div>
          <div class="stat-merchant-url">${escapeHtml(merchant.url || 'N/A')}</div>
          <div class="stat-merchant-date">Tested: ${formatDate(testDate)}</div>
          <div class="stat-merchant-notes">
            <label>Notes:</label>
            <textarea 
              class="merchant-note-input" 
              data-merchant-key="${merchantKey}"
              placeholder="Enter notes about this merchant..."
            >${escapeHtml(note)}</textarea>
          </div>
        </div>
      `;
    }).join('');
    
    // Add event listeners for note inputs with debounced saving
    statsList.querySelectorAll('.merchant-note-input').forEach(textarea => {
      let saveTimeout = null;
      
      const saveNote = async () => {
        const merchantKey = textarea.dataset.merchantKey;
        const note = textarea.value.trim();
        
        // Save note to storage
        const currentState = await chrome.storage.local.get(['extensionState']);
        const currentExtensionState = currentState.extensionState || {};
        if (!currentExtensionState.merchantNotes) {
          currentExtensionState.merchantNotes = {};
        }
        
        if (note) {
          currentExtensionState.merchantNotes[merchantKey] = note;
        } else {
          delete currentExtensionState.merchantNotes[merchantKey];
        }
        
        await chrome.storage.local.set({ extensionState: currentExtensionState });
        console.log(`Saved note for ${merchantKey}:`, note);
      };
      
      // Save on blur (when user clicks away)
      textarea.addEventListener('blur', saveNote);
      
      // Save on input with debounce (saves 1 second after user stops typing)
      textarea.addEventListener('input', () => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(saveNote, 1000);
      });
      
      // Save immediately when user presses Enter (but allow newline with Shift+Enter)
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          clearTimeout(saveTimeout);
          saveNote();
          textarea.blur(); // Remove focus after saving
        }
      });
    });
    
  } catch (error) {
    console.error('Error refreshing stats:', error);
  }
}

// Utility function for HTML escaping
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

console.log('CitiShop Browser Extension popup loaded successfully!');
