// Background script for CitiShop Browser Extension
// Handles data management, cross-tab communication, and background tasks

// Background sync state
let validationSyncInterval = null;
let lastKnownMerchantStatuses = {};

// Start background validation sync
function startBackgroundValidationSync() {
  if (validationSyncInterval) {
    console.log('🔄 Background validation sync already active');
    return;
  }
  
  console.log('🔄 Starting background validation sync...');
  
  validationSyncInterval = setInterval(async () => {
    try {
      // Get current extension state
      const result = await chrome.storage.local.get(['extensionState']);
      const state = result.extensionState;
      
      if (!state || !state.testingControlsActive || !state.merchantStatuses) {
        return; // No active testing or no statuses to sync
      }
      
      // Check if merchant statuses have changed
      const currentStatuses = JSON.stringify(state.merchantStatuses);
      const lastStatuses = JSON.stringify(lastKnownMerchantStatuses);
      
      if (currentStatuses !== lastStatuses) {
        console.log('🔄 Background: Merchant statuses changed, updating validation sync');
        console.log('🔄 Previous statuses:', lastKnownMerchantStatuses);
        console.log('🔄 Current statuses:', state.merchantStatuses);
        
        // Update our tracking
        lastKnownMerchantStatuses = { ...state.merchantStatuses };
        
        // Set a flag to indicate validation results need refresh
        await chrome.storage.local.set({ 
          validationResultsNeedRefresh: true,
          lastValidationUpdate: Date.now()
        });
        
        console.log('✅ Background: Set validation refresh flag');
      }
    } catch (error) {
      console.error('Background validation sync error:', error);
    }
  }, 1000); // Check every second for changes
  
  console.log('✅ Background validation sync started (every 1 second)');
}

// Stop background validation sync
function stopBackgroundValidationSync() {
  if (validationSyncInterval) {
    clearInterval(validationSyncInterval);
    validationSyncInterval = null;
    console.log('🛑 Background validation sync stopped');
  }
}

// Extension lifecycle
chrome.runtime.onInstalled.addListener((details) => {
  console.log('CitiShop Extension installed:', details.reason);
  
  if (details.reason === 'install') {
    // First-time installation
    initializeExtension();
  } else if (details.reason === 'update') {
    // Extension updated
    handleExtensionUpdate();
  }
});

// Initialize extension on first install
async function initializeExtension() {
  try {
    // Set default settings
    await chrome.storage.local.set({
      sessionStats: {
        totalValidated: 0,
        totalGenerated: 0,
        successfulValidations: 0
      },
      settings: {
        autoClosePopup: true,
        showNotifications: true,
        debugMode: false
      },
      merchantDatabase: [] // Will be populated by popup.js
    });
    
    console.log('CitiShop Extension initialized successfully');
    
    // Show welcome notification
    if (chrome.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'CitiShop Extension Installed!',
        message: 'Click the extension icon to start testing merchants.'
      });
    }
    
  } catch (error) {
    console.error('Failed to initialize extension:', error);
  }
}

// Find merchant match with fuzzy matching for apostrophes and variations
function findMerchantMatch(inputName, merchantDatabase) {
  const normalizedInput = normalizeMerchantName(inputName);
  
  // First try exact match (case-insensitive)
  let match = merchantDatabase.find(
    merchant => merchant.name.toLowerCase() === inputName.toLowerCase()
  );
  
  if (match) return match;
  
  // Try normalized match (handles apostrophes, spaces, etc.)
  match = merchantDatabase.find(
    merchant => normalizeMerchantName(merchant.name) === normalizedInput
  );
  
  if (match) return match;
  
  // Try partial matches for common variations
  match = merchantDatabase.find(merchant => {
    const merchantNormalized = normalizeMerchantName(merchant.name);
    const inputNormalized = normalizedInput;
    
    // Check if one contains the other (for cases like "Dick's" vs "Dicks")
    return merchantNormalized.includes(inputNormalized) || 
           inputNormalized.includes(merchantNormalized);
  });
  
  return match || null;
}

// Normalize merchant names for better matching
function normalizeMerchantName(name) {
  return name
    .toLowerCase()
    .replace(/'/g, '') // Remove apostrophes: "Dick's" -> "dicks"
    .replace(/'/g, '') // Remove smart quotes: "Dick's" -> "dicks"
    .replace(/`/g, '') // Remove backticks
    .replace(/'/g, '') // Remove other apostrophe variants
    .replace(/&/g, 'and') // Replace & with "and": "H&M" -> "handm"
    .replace(/[^\w\s]/g, '') // Remove other special characters
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

// Handle extension updates
async function handleExtensionUpdate() {
  try {
    console.log('🔄 Extension updated - preserving stats data');
    
    // Preserve stats data (merchantStatuses, merchantTestDates, merchantNotes)
    const existingState = await chrome.storage.local.get(['extensionState']);
    const preservedStats = {
      merchantStatuses: existingState.extensionState?.merchantStatuses || {},
      merchantTestDates: existingState.extensionState?.merchantTestDates || {},
      merchantNotes: existingState.extensionState?.merchantNotes || {}
    };
    
    // Clear all stored data for a fresh start
    await chrome.storage.local.clear();
    console.log('🧹 Cleared all stored data (except stats)');
    
    // Reinitialize with default settings and restore stats
    await chrome.storage.local.set({
      sessionStats: {
        totalValidated: 0,
        totalGenerated: 0,
        successfulValidations: 0
      },
      settings: {
        autoClosePopup: true,
        showNotifications: true,
        debugMode: false
      },
      extensionSettings: {
        autoSave: true,
        showNotifications: true,
        persistState: true,
        debugMode: false,
        croutonPosition: 'middle-left'
      },
      merchantDatabase: [], // Will be populated by popup.js
      extensionState: {
        merchantStatuses: preservedStats.merchantStatuses,
        merchantTestDates: preservedStats.merchantTestDates,
        merchantNotes: preservedStats.merchantNotes
      },
      validationFilter: null, // Reset filter state
      croutonCollapsed: false, // Reset crouton state
      lastValidationResults: null // Reset validation results
    });
    
    console.log('✅ Extension reset to clean state after update (stats preserved)');
    
  } catch (error) {
    console.error('❌ Failed to reset extension after update:', error);
  }
}

// Message handling between different parts of the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  switch (message.action) {
    case 'validateMerchants':
      handleMerchantValidation(message.merchants, sendResponse);
      return true; // Keep message channel open for async response
      
    case 'generateTestCode':
      handleTestCodeGeneration(message.merchants, sendResponse);
      return true;
      
    case 'getSessionStats':
      handleGetSessionStats(sendResponse);
      return true;
      
    case 'updateSessionStats':
      handleUpdateSessionStats(message.stats, sendResponse);
      return true;
      
    case 'clearSessionData':
      handleClearSessionData(sendResponse);
      return true;
      
    case 'exportData':
      handleExportData(sendResponse);
      return true;
      
    case 'importData':
      handleImportData(message.data, sendResponse);
      return true;
      
    case 'croutonAction':
      handleCroutonAction(message, sender, sendResponse);
      return true;
      
    case 'startValidationSync':
      startBackgroundValidationSync();
      sendResponse({ success: true });
      break;
      
    case 'stopValidationSync':
      stopBackgroundValidationSync();
      sendResponse({ success: true });
      break;
      
    case 'checkValidationRefreshFlag':
      handleCheckValidationRefreshFlag(sendResponse);
      return true;
      
    case 'ping':
      // Simple ping response for extension context validation
      sendResponse({ success: true, timestamp: Date.now() });
      break;
      
    default:
      console.log('Unknown message action:', message.action);
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

// Handle merchant validation requests
async function handleMerchantValidation(inputMerchants, sendResponse) {
  try {
    const result = await chrome.storage.local.get(['merchantDatabase']);
    const merchantDatabase = result.merchantDatabase || [];
    
    if (merchantDatabase.length === 0) {
      sendResponse({ 
        success: false, 
        error: 'Merchant database not loaded. Please open the extension popup first.' 
      });
      return;
    }
    
    // Parse and validate merchants - handle both comma-separated and line-separated
    let merchants;
    
    if (inputMerchants.includes(',')) {
      // Comma-separated format
      merchants = inputMerchants
        .split(',')
        .map(name => name.trim())
        .filter(name => name.length > 0);
    } else {
      // Line-separated format (one merchant per line)
      merchants = inputMerchants
        .split(/\r?\n/)
        .map(name => name.trim())
        .filter(name => name.length > 0);
    }
    
    const foundMerchants = [];
    const notFoundMerchants = [];
    
    merchants.forEach(merchantName => {
      const match = findMerchantMatch(merchantName, merchantDatabase);
      
      if (match) {
        foundMerchants.push(match);
      } else {
        notFoundMerchants.push(merchantName);
      }
    });
    
    sendResponse({
      success: true,
      foundMerchants,
      notFoundMerchants,
      inputCount: merchants.length,
      foundCount: foundMerchants.length
    });
    
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// Handle test code generation
async function handleTestCodeGeneration(merchants, sendResponse) {
  try {
    if (!merchants || merchants.length === 0) {
      sendResponse({ success: false, error: 'No merchants provided' });
      return;
    }
    
    const websites = merchants.map(merchant => 
      `{ name: '${merchant.name.replace(/'/g, "\\'")}', url: '${merchant.url}' }`
    ).join(',\n      ');
    
    const generatedCode = `    const websites = [
      ${websites}
    ];`;
    
    // Update session stats
    const result = await chrome.storage.local.get(['sessionStats']);
    const sessionStats = result.sessionStats || { totalGenerated: 0 };
    sessionStats.totalGenerated++;
    await chrome.storage.local.set({ sessionStats });
    
    sendResponse({
      success: true,
      code: generatedCode,
      merchantCount: merchants.length
    });
    
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// Handle session stats requests
async function handleGetSessionStats(sendResponse) {
  try {
    const result = await chrome.storage.local.get(['sessionStats']);
    const sessionStats = result.sessionStats || {
      totalValidated: 0,
      totalGenerated: 0,
      successfulValidations: 0
    };
    
    sendResponse({ success: true, stats: sessionStats });
    
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// Handle session stats updates
async function handleUpdateSessionStats(newStats, sendResponse) {
  try {
    const result = await chrome.storage.local.get(['sessionStats']);
    const currentStats = result.sessionStats || {
      totalValidated: 0,
      totalGenerated: 0,
      successfulValidations: 0
    };
    
    const updatedStats = { ...currentStats, ...newStats };
    await chrome.storage.local.set({ sessionStats: updatedStats });
    
    sendResponse({ success: true, stats: updatedStats });
    
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// Handle clearing session data
async function handleClearSessionData(sendResponse) {
  try {
    await chrome.storage.local.set({
      sessionStats: {
        totalValidated: 0,
        totalGenerated: 0,
        successfulValidations: 0
      }
    });
    
    sendResponse({ success: true });
    
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// Handle data export
async function handleExportData(sendResponse) {
  try {
    const result = await chrome.storage.local.get(['merchantDatabase', 'sessionStats', 'settings']);
    
    const exportData = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      data: result
    };
    
    sendResponse({ success: true, data: exportData });
    
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// Handle data import
async function handleImportData(importData, sendResponse) {
  try {
    if (!importData || !importData.data) {
      sendResponse({ success: false, error: 'Invalid import data' });
      return;
    }
    
    // Validate import data structure
    const { merchantDatabase, sessionStats, settings } = importData.data;
    
    if (merchantDatabase) {
      await chrome.storage.local.set({ merchantDatabase });
    }
    
    if (sessionStats) {
      await chrome.storage.local.set({ sessionStats });
    }
    
    if (settings) {
      await chrome.storage.local.set({ settings });
    }
    
    sendResponse({ success: true });
    
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// Handle checking validation refresh flag
async function handleCheckValidationRefreshFlag(sendResponse) {
  try {
    const result = await chrome.storage.local.get(['validationResultsNeedRefresh', 'lastValidationUpdate']);
    
    if (result.validationResultsNeedRefresh) {
      // Clear the flag since popup is now handling the refresh
      await chrome.storage.local.remove(['validationResultsNeedRefresh']);
      
      sendResponse({ 
        success: true, 
        needsRefresh: true,
        lastUpdate: result.lastValidationUpdate
      });
    } else {
      sendResponse({ 
        success: true, 
        needsRefresh: false 
      });
    }
    
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// Handle test navigation (for debugging)
async function handleTestNavigation(url, sendResponse) {
  try {
    console.log('🧪 Background: Testing navigation to:', url);
    
    // Get current active tab
    console.log('🔍 Background: Querying for active tab...');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('🔍 Background: Active tab found:', tab);
    
    // Attempt navigation
    console.log('🔍 Background: Attempting test navigation...');
    await chrome.tabs.update(tab.id, { url: url });
    
    console.log('✅ Background: Test navigation successful!');
    sendResponse({ success: true, message: 'Navigation successful' });
    
  } catch (error) {
    console.error('❌ Background: Test navigation failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle floating crouton actions
async function handleCroutonAction(message, sender, sendResponse) {
  try {
    console.log('Background handling crouton action:', message.data.action);
    
    const actionData = {
      action: message.data.action,
      currentMerchant: message.data.currentMerchant,
      currentIndex: message.data.currentIndex,
      timestamp: Date.now(),
      ...message.data // Include all extra data like targetIndex
    };
    
    // Store the action for pickup
    await chrome.storage.local.set({ 
      pendingCroutonAction: actionData 
    });
    
    console.log('✅ Stored crouton action:', actionData);
    
    // Execute the action directly in background since popup might not be open
    await executeActionInBackground(actionData);
    
    sendResponse({ success: true });
    
  } catch (error) {
    console.error('Failed to handle crouton action:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Execute actions directly in background
async function executeActionInBackground(actionData) {
  try {
    const { action } = actionData;
    
    // Get current extension state
    const result = await chrome.storage.local.get(['extensionState']);
    let state = result.extensionState;
    
    if (!state || !state.testingMerchants || state.testingMerchants.length === 0) {
      console.log('No testing state found in background');
      return;
    }
    
    console.log(`🔄 Background executing action: ${action}`);
    
    switch (action) {
      case 'previousMerchant':
        // Use action data index if available (for crouton actions), otherwise use stored index
        let prevStartIndex = actionData.currentIndex !== undefined ? actionData.currentIndex : state.currentMerchantIndex;
        if (prevStartIndex > 0) {
          state.currentMerchantIndex = prevStartIndex - 1;
          console.log(`✅ Background: Moved to previous merchant from ${prevStartIndex} to ${state.currentMerchantIndex}`);
          
          // Navigate to the previous merchant's website
          const prevMerchant = state.testingMerchants[state.currentMerchantIndex];
          if (prevMerchant && prevMerchant.url) {
            console.log(`🔄 Background: Navigating to previous merchant: ${prevMerchant.name} at ${prevMerchant.url}`);
            
            // Save state first to ensure fresh data is available
            await chrome.storage.local.set({ extensionState: state });
            console.log(`💾 Background: Saved state before navigation`);
            
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            await chrome.tabs.update(tab.id, { url: prevMerchant.url });
            
            console.log(`✅ Background: Navigation initiated to ${prevMerchant.name}`);
          }
        } else {
          console.log(`❌ Background: Already at first merchant (index ${prevStartIndex})`);
        }
        break;
        
      case 'nextMerchant':
        // Use action data index if available (for crouton actions), otherwise use stored index
        let nextStartIndex = actionData.currentIndex !== undefined ? actionData.currentIndex : state.currentMerchantIndex;
        if (nextStartIndex < state.testingMerchants.length - 1) {
          state.currentMerchantIndex = nextStartIndex + 1;
          console.log(`✅ Background: Moved to next merchant from ${nextStartIndex} to ${state.currentMerchantIndex}`);
          
          // Navigate to the next merchant's website
          const nextMerchant = state.testingMerchants[state.currentMerchantIndex];
          if (nextMerchant && nextMerchant.url) {
            console.log(`🔄 Background: Navigating to next merchant: ${nextMerchant.name} at ${nextMerchant.url}`);
            
            // Save state first to ensure fresh data is available
            await chrome.storage.local.set({ extensionState: state });
            console.log(`💾 Background: Saved state before navigation`);
            
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            await chrome.tabs.update(tab.id, { url: nextMerchant.url });
            
            console.log(`✅ Background: Navigation initiated to ${nextMerchant.name}`);
          }
        } else {
          console.log(`❌ Background: Already at last merchant (index ${nextStartIndex})`);
        }
        break;
        
      case 'testCurrentMerchant':
        // Use merchant from action data if available, otherwise fallback to stored index
        let currentMerchant;
        if (actionData.currentMerchant && actionData.currentIndex !== undefined) {
          currentMerchant = actionData.currentMerchant;
          console.log(`🎯 Background: Using merchant from action data: ${currentMerchant.name} (index ${actionData.currentIndex})`);
          // Update the state index to match the action
          state.currentMerchantIndex = actionData.currentIndex;
        } else {
          currentMerchant = state.testingMerchants[state.currentMerchantIndex];
          console.log(`📍 Background: Using merchant from state: ${currentMerchant?.name} (index ${state.currentMerchantIndex})`);
        }
        
        if (currentMerchant) {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          await chrome.tabs.update(tab.id, { url: currentMerchant.url });
          
          console.log(`✅ Background: Navigated to ${currentMerchant.name} at ${currentMerchant.url}`);
          console.log(`📝 Note: Merchant not marked as tested - use Success button to mark as tested`);
        } else {
          console.error('❌ Background: No current merchant found');
        }
        break;
        
      case 'flagMerchant':
        const flagMerchant = state.testingMerchants[state.currentMerchantIndex];
        if (flagMerchant) {
          if (!state.merchantStatuses) state.merchantStatuses = {};
          state.merchantStatuses[flagMerchant.name.toLowerCase()] = 'flagged';
          console.log(`✅ Background: Flagged ${flagMerchant.name}`);
          console.log(`📊 Background: Current merchant statuses:`, state.merchantStatuses);
          
          // Trigger validation sync update
          lastKnownMerchantStatuses = { ...state.merchantStatuses };
          await chrome.storage.local.set({ 
            validationResultsNeedRefresh: true,
            lastValidationUpdate: Date.now()
          });
          console.log('🔄 Background: Set validation refresh flag after flagging');
        }
        break;
        
      case 'successMerchant':
        const successMerchant = state.testingMerchants[state.currentMerchantIndex];
        if (successMerchant) {
          if (!state.merchantStatuses) state.merchantStatuses = {};
          state.merchantStatuses[successMerchant.name.toLowerCase()] = 'successful';
          console.log(`✅ Background: Marked ${successMerchant.name} as successful`);
          console.log(`📊 Background: Current merchant statuses:`, state.merchantStatuses);
          
          // Trigger validation sync update
          lastKnownMerchantStatuses = { ...state.merchantStatuses };
          await chrome.storage.local.set({ 
            validationResultsNeedRefresh: true,
            lastValidationUpdate: Date.now()
          });
          console.log('🔄 Background: Set validation refresh flag after success');
        }
        break;
        
      case 'searchMerchant':
        console.log('🔍 Background: Processing searchMerchant action');
        console.log('🔍 Background: actionData:', actionData);
        console.log('🔍 Background: state.testingMerchants length:', state.testingMerchants?.length);
        
        const targetIndex = actionData.targetIndex;
        console.log('🔍 Background: targetIndex:', targetIndex);
        
        if (targetIndex >= 0 && targetIndex < state.testingMerchants.length) {
          state.currentMerchantIndex = targetIndex;
          const targetMerchant = state.testingMerchants[targetIndex];
          console.log(`✅ Background: Searched to merchant ${targetMerchant.name} at index ${targetIndex}`);
          console.log('🔍 Background: targetMerchant:', targetMerchant);
          
          // Navigate to the target merchant's website
          if (targetMerchant && targetMerchant.url) {
            console.log(`🌐 Background: Navigating to searched merchant: ${targetMerchant.name} at ${targetMerchant.url}`);
            
            try {
              console.log('🔍 Background: Querying for active tab...');
              const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
              console.log('🔍 Background: Active tab:', tab);
              
              console.log('🔍 Background: Attempting navigation...');
              await chrome.tabs.update(tab.id, { url: targetMerchant.url });
              
              console.log(`✅ Background: Successfully navigated to searched merchant: ${targetMerchant.name}`);
            } catch (navigationError) {
              console.error('❌ Background: Failed to navigate to searched merchant:', navigationError);
              console.error('❌ Background: Navigation error details:', navigationError.message, navigationError.stack);
            }
          } else {
            console.error('❌ Background: No target merchant or URL found');
            console.error('❌ Background: targetMerchant:', targetMerchant);
            console.error('❌ Background: targetMerchant.url:', targetMerchant?.url);
          }
        } else {
          console.error('❌ Background: Invalid targetIndex or no testing merchants');
          console.error('❌ Background: targetIndex:', targetIndex);
          console.error('❌ Background: state.testingMerchants.length:', state.testingMerchants?.length);
          console.error('❌ Background: Available merchants:', state.testingMerchants?.map(m => m.name));
        }
        break;
        
      case 'copySuccessfulMerchants':
        await copyMerchantsToClipboard(state, 'successful');
        break;
        
      case 'copyFlaggedMerchants':
        await copyMerchantsToClipboard(state, 'flagged');
        break;
    }
    
    // Save updated state (unless already saved during navigation)
    if (action !== 'nextMerchant' && action !== 'previousMerchant') {
      await chrome.storage.local.set({ extensionState: state });
      console.log(`💾 Background: Saved state after ${action} action`);
    }
    
    // Update crouton on the current tab (skip for navigation actions as they will trigger on new page)
    if (action !== 'nextMerchant' && action !== 'previousMerchant') {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const currentMerchant = state.testingMerchants[state.currentMerchantIndex];
        
        const croutonData = {
          currentMerchant: currentMerchant,
          currentIndex: state.currentMerchantIndex,
          totalMerchants: state.testingMerchants.length,
          testingMerchants: state.testingMerchants,
          status: `Testing ${currentMerchant?.name ? currentMerchant.name.replace(/\\+$/, "'s") : 'merchant'}`,
          merchantStatus: state.merchantStatuses ? 
            state.merchantStatuses[currentMerchant?.name?.toLowerCase()] || '' : ''
        };
        
        await chrome.tabs.sendMessage(tab.id, {
          action: 'updateFloatingCrouton',
          data: croutonData
        });
        
        console.log(`✅ Background: Updated crouton after ${action} action`);
      } catch (error) {
        console.log(`Could not update crouton after ${action}:`, error.message);
      }
    } else {
      console.log(`⏭️ Background: Skipping crouton update for navigation action ${action} - new page will handle it`);
    }
    
  } catch (error) {
    console.error('Failed to execute action in background:', error);
  }
}

// Copy merchants to clipboard based on status
async function copyMerchantsToClipboard(state, status) {
  try {
    if (!state.testingMerchants || !state.merchantStatuses) {
      console.log('No merchant data available for copying');
      return;
    }
    
    const filteredMerchants = state.testingMerchants.filter(merchant => {
      const merchantKey = merchant.name.toLowerCase();
      return state.merchantStatuses[merchantKey] === status;
    });
    
    if (filteredMerchants.length === 0) {
      console.log(`No ${status} merchants found`);
      return;
    }
    
    const merchantNames = filteredMerchants.map(merchant => merchant.name).join('\n');
    
    // Use chrome.scripting to inject clipboard code
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (text) => {
        navigator.clipboard.writeText(text).then(() => {
          console.log('Copied to clipboard:', text);
        }).catch(err => {
          console.error('Failed to copy to clipboard:', err);
        });
      },
      args: [merchantNames]
    });
    
    console.log(`✅ Background: Copied ${filteredMerchants.length} ${status} merchants to clipboard`);
    
  } catch (error) {
    console.error('Failed to copy merchants to clipboard:', error);
  }
}

// Handle browser action clicks (when extension icon is clicked)
chrome.action.onClicked.addListener((tab) => {
  // This will be handled by the popup, but we can add fallback logic here
  console.log('Extension icon clicked on tab:', tab.url);
});

// Handle tab updates to show crouton on testing pages
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  console.log('🔄 Tab updated:', {
    tabId,
    status: changeInfo.status,
    url: tab.url,
    changeInfo
  });
  
  if (changeInfo.status === 'complete' && tab.url && 
      (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
    
    console.log('🔄 Tab completed loading, checking for testing...');
    
    try {
      // First check if crouton should be auto-injected for this URL
      const url = new URL(tab.url);
      const hostname = url.hostname.replace(/^www\./, '');
      const autoInjectState = await chrome.storage.local.get(['autoInjectCrouton']);
      const autoInject = autoInjectState.autoInjectCrouton || {};
      
      if (autoInject[hostname] && autoInject[hostname].enabled) {
        console.log(`🔄 Auto-inject crouton enabled for ${hostname}`);
        
        // Wait a moment for page to be ready
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        try {
          // Inject the floating crouton script
          await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['floating-crouton.js']
          });
          
          // Wait for script to initialize
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Always get fresh data from extension state to ensure latest merchant statuses
          const result = await chrome.storage.local.get(['extensionState']);
          const state = result.extensionState;
          
          let croutonData = null;
          
          if (state && state.testingMerchants && state.testingMerchants.length > 0) {
            // Use stored croutonData as base, but update with fresh state
            const storedData = autoInject[hostname].croutonData;
            const currentMerchantIndex = state.currentMerchantIndex || (storedData?.currentIndex || 0);
            const currentMerchant = state.testingMerchants[currentMerchantIndex] || storedData?.currentMerchant;
            
            if (currentMerchant) {
              const merchantKey = currentMerchant.name.toLowerCase();
              croutonData = {
                currentMerchant: currentMerchant,
                currentIndex: currentMerchantIndex,
                totalMerchants: state.testingMerchants.length,
                testingMerchants: state.testingMerchants,
                status: `Ready to test ${currentMerchant.name}`,
                merchantStatus: (state.merchantStatuses || {})[merchantKey] || 'pending'
              };
              
              // Update stored croutonData with fresh data
              autoInject[hostname].croutonData = croutonData;
              await chrome.storage.local.set({ autoInjectCrouton: autoInject });
            }
          } else if (autoInject[hostname].croutonData) {
            // Fallback to stored data if no extension state
            croutonData = autoInject[hostname].croutonData;
          }
          
          if (croutonData) {
            // Send message to show crouton
            await chrome.tabs.sendMessage(tabId, {
              action: 'showFloatingCrouton',
              data: croutonData
            });
            console.log(`✅ Auto-injected crouton on ${hostname} after page refresh`);
          }
        } catch (error) {
          console.error('Error auto-injecting crouton:', error);
        }
      }
      
      // Check if testing is active
      const result = await chrome.storage.local.get(['extensionState']);
      const state = result.extensionState;
      
      if (state && state.testingControlsActive && state.testingMerchants && state.testingMerchants.length > 0) {
        console.log('🏪 Testing active - checking if tab URL matches a merchant:', tabId);
        console.log('🏪 Tab URL:', tab.url);
        console.log('🏪 Available testing merchants:', state.testingMerchants.length);
        console.log('🏪 Merchant statuses in state:', state.merchantStatuses);
        
        // Check if the tab URL matches any testing merchant
        const matchingMerchant = state.testingMerchants.find(merchant => {
          if (!merchant.url || !tab.url) return false;
          
          try {
            const merchantUrl = new URL(merchant.url);
            const tabUrl = new URL(tab.url);
            
            // Match by hostname (domain) or URL prefix
            const hostnameMatch = merchantUrl.hostname === tabUrl.hostname;
            const urlStartsMatch = tab.url.startsWith(merchant.url);
            
            // Additional matching: check if current hostname contains merchant hostname (without www)
            const merchantHostnameClean = merchantUrl.hostname.replace(/^www\./, '');
            const tabHostnameClean = tabUrl.hostname.replace(/^www\./, '');
            const cleanHostnameMatch = merchantHostnameClean === tabHostnameClean;
            
            console.log(`Checking ${merchant.name}: ${merchant.url} against ${tab.url}`);
            console.log(`  Merchant hostname: ${merchantUrl.hostname}`);
            console.log(`  Tab hostname: ${tabUrl.hostname}`);
            console.log(`  Hostname match: ${hostnameMatch}`);
            console.log(`  URL starts match: ${urlStartsMatch}`);
            console.log(`  Clean hostname match: ${cleanHostnameMatch} (${merchantHostnameClean} vs ${tabHostnameClean})`);
            
            // Only use strict hostname matching - remove the broad urlContainsMatch
            const isMatch = hostnameMatch || urlStartsMatch || cleanHostnameMatch;
            console.log(`  Final match result: ${isMatch}`);
            return isMatch;
          } catch (error) {
            console.error(`Error parsing URLs for ${merchant.name}:`, error);
            return false;
          }
        });
        
        // If no direct match, check if page has links to merchants (scan in content script)
        if (!matchingMerchant) {
          console.log('🔍 No direct merchant match, will check for links in content script');
        }
        
        if (matchingMerchant) {
          console.log(`✅ Tab URL matches merchant: ${matchingMerchant.name} - showing crouton`);
          
          // Show crouton with retry logic
          const showCroutonWithRetry = async (retryCount = 0) => {
            try {
              // First ensure content script is injected
              console.log(`🔄 Ensuring content script is injected (attempt ${retryCount + 1})`);
              
              try {
                // Try to inject content script and CSS
                await chrome.scripting.executeScript({
                  target: { tabId: tabId },
                  files: ['floating-crouton.js']
                });
                
                // Also inject CSS if it exists
                try {
                  await chrome.scripting.insertCSS({
                    target: { tabId: tabId },
                    files: ['content.css']
                  });
                } catch (cssError) {
                  console.log('CSS injection failed (file may not exist):', cssError.message);
                }
                
                console.log('✅ Content script injected successfully');
              } catch (injectionError) {
                console.log('Content script injection failed (may already be loaded):', injectionError.message);
              }
              
              // Wait a moment for script to initialize
              await new Promise(resolve => setTimeout(resolve, 500));
              
              // Get fresh state to ensure we have latest merchant statuses
              const freshResult = await chrome.storage.local.get(['extensionState']);
              const freshState = freshResult.extensionState;
              
              if (!freshState || !freshState.testingMerchants) {
                console.log('❌ No fresh state available for crouton');
                return;
              }
              
              const merchantIndex = freshState.testingMerchants.findIndex(m => m.name === matchingMerchant.name);
              const merchantKey = matchingMerchant.name.toLowerCase();
              
              // Update the currentMerchantIndex to match the displayed merchant
              if (merchantIndex !== -1 && freshState.currentMerchantIndex !== merchantIndex) {
                console.log(`🔄 Updating currentMerchantIndex from ${freshState.currentMerchantIndex} to ${merchantIndex} for ${matchingMerchant.name}`);
                freshState.currentMerchantIndex = merchantIndex;
                await chrome.storage.local.set({ extensionState: freshState });
              }
              
              console.log('🔄 Showing crouton with fresh state:');
              console.log('  - Merchant statuses:', freshState.merchantStatuses);
              console.log('  - Current merchant:', matchingMerchant.name);
              console.log('  - Current merchant index:', merchantIndex);
              console.log('  - Merchant status:', freshState.merchantStatuses?.[merchantKey]);
              
              const croutonData = {
                currentMerchant: matchingMerchant,
                currentIndex: merchantIndex,
                totalMerchants: freshState.testingMerchants.length,
                testingMerchants: freshState.testingMerchants,
                status: `Testing ${matchingMerchant.name}`,
                merchantStatus: freshState.merchantStatuses ? 
                  freshState.merchantStatuses[merchantKey] || '' : ''
              };
              
              await chrome.tabs.sendMessage(tabId, {
                action: 'showFloatingCrouton',
                data: croutonData
              });
              
              console.log('✅ Crouton shown on matching merchant tab with fresh data');
            } catch (error) {
              console.log(`Could not show crouton on tab (attempt ${retryCount + 1}):`, error.message);
              
              // Retry up to 3 times with increasing delays
              if (retryCount < 3) {
                const delay = (retryCount + 1) * 1000; // 1s, 2s, 3s
                console.log(`Retrying in ${delay}ms...`);
                setTimeout(() => showCroutonWithRetry(retryCount + 1), delay);
              }
            }
          };
          
          // Start immediately, then retry if needed
          showCroutonWithRetry();
        } else {
          console.log('❌ Tab URL does not match any testing merchants - crouton will not be shown');
          console.log('Available merchants:', state.testingMerchants.map(m => `${m.name}: ${m.url}`));
        }
      } else {
        console.log('🔄 No active testing or no testing merchants found');
        if (!state) {
          console.log('  - No extension state found');
        } else if (!state.testingControlsActive) {
          console.log('  - Testing controls not active');
        } else if (!state.testingMerchants || state.testingMerchants.length === 0) {
          console.log('  - No testing merchants available');
        }
      }
    } catch (error) {
      console.error('Failed to check testing state on tab update:', error);
    }
  } else {
    console.log('🔄 Skipping tab update:', {
      status: changeInfo.status,
      hasUrl: !!tab.url,
      isHttp: tab.url ? (tab.url.startsWith('http://') || tab.url.startsWith('https://')) : false
    });
  }
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('CitiShop Extension started with browser');
});

// Handle context menu creation (optional feature for future)
chrome.runtime.onInstalled.addListener(() => {
  // Could add context menu items here for quick access
  // chrome.contextMenus.create({
  //   id: 'citishop-test-merchant',
  //   title: 'Test with CitiShop',
  //   contexts: ['selection']
  // });
});

// Error handling for uncaught errors
chrome.runtime.onSuspend.addListener(() => {
  console.log('CitiShop Extension suspending');
});

// Debug logging function
function debugLog(message, data = null) {
  chrome.storage.local.get(['settings']).then(result => {
    if (result.settings && result.settings.debugMode) {
      console.log('[CitiShop Debug]', message, data);
    }
  });
}

console.log('CitiShop Extension background script loaded');
