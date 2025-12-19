// Popup script for Citi Extension Tester

// Global state
let testResults = [];
let testingState = {
  isRunning: false,
  isPaused: false,
  currentMerchantIndex: 0
};
let currentMerchant = null;
let searchFilter = '';
let clickToTestEnabled = false;

// DOM elements
let totalTestedEl, totalSuccessEl, totalFlaggedEl;
let startTestingBtn, pauseTestingBtn, restartTestingBtn, clearTestingBtn;
let enableClickToTestBtn, clearResultsBtn, exportCSVBtn;
let searchInput;
let resultsListEl;
let merchantModal, modalTitle, modalBody, closeModalBtn;
let flagMerchantBtn, passMerchantBtn;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  initializeElements();
  setupEventListeners();
  await loadTestResults();
  await loadTestingState(); // Load persisted testing state
  await loadClickToTestState();
  updateUI();
  updateTestingButtons();
  
  // Listen for storage changes to update results when new tests complete
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.testResults) {
      loadTestResults().then(() => {
        updateUI();
      });
    }
  });
});

// Initialize DOM elements
function initializeElements() {
  totalTestedEl = document.getElementById('totalTested');
  totalSuccessEl = document.getElementById('totalSuccess');
  totalFlaggedEl = document.getElementById('totalFlagged');
  
  startTestingBtn = document.getElementById('startTesting');
  pauseTestingBtn = document.getElementById('pauseTesting');
  restartTestingBtn = document.getElementById('restartTesting');
  clearTestingBtn = document.getElementById('clearTesting');
  
  clearResultsBtn = document.getElementById('clearResults');
  exportCSVBtn = document.getElementById('exportCSV');
  
  searchInput = document.getElementById('searchInput');
  
  resultsListEl = document.getElementById('resultsList');
  
  enableClickToTestBtn = document.getElementById('enableClickToTest');
  
  merchantModal = document.getElementById('merchantModal');
  modalTitle = document.getElementById('modalTitle');
  modalBody = document.getElementById('modalBody');
  closeModalBtn = document.getElementById('closeModal');
  
  flagMerchantBtn = document.getElementById('flagMerchant');
  passMerchantBtn = document.getElementById('passMerchant');
}

// Setup event listeners
function setupEventListeners() {
  startTestingBtn.addEventListener('click', startTesting);
  enableClickToTestBtn.addEventListener('click', toggleClickToTest);
  pauseTestingBtn.addEventListener('click', pauseTesting);
  restartTestingBtn.addEventListener('click', restartTesting);
  clearTestingBtn.addEventListener('click', clearTesting);
  
  clearResultsBtn.addEventListener('click', clearResults);
  exportCSVBtn.addEventListener('click', exportCSV);
  
  searchInput.addEventListener('input', handleSearch);
  
  closeModalBtn.addEventListener('click', closeModal);
  merchantModal.addEventListener('click', (e) => {
    if (e.target === merchantModal) closeModal();
  });
  
  flagMerchantBtn.addEventListener('click', () => manuallyFlagMerchant(true));
  passMerchantBtn.addEventListener('click', () => manuallyFlagMerchant(false));
}

// Toggle click-to-test mode
async function toggleClickToTest() {
  clickToTestEnabled = !clickToTestEnabled;
  await saveClickToTestState();
  updateClickToTestButton();
  
  // Send message to content script to enable/disable click-to-test
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      await chrome.tabs.sendMessage(tab.id, {
        action: 'setClickToTest',
        enabled: clickToTestEnabled
      });
    }
  } catch (error) {
    console.error('Error sending click-to-test message:', error);
  }
  
  if (clickToTestEnabled) {
    alert('Click-to-Test enabled! Click on the Citi extension popup to test it.');
  } else {
    alert('Click-to-Test disabled.');
  }
}

// Load click-to-test state
async function loadClickToTestState() {
  try {
    const result = await chrome.storage.local.get(['clickToTestEnabled']);
    clickToTestEnabled = result.clickToTestEnabled || false;
    updateClickToTestButton();
  } catch (error) {
    console.error('Error loading click-to-test state:', error);
  }
}

// Save click-to-test state
async function saveClickToTestState() {
  try {
    await chrome.storage.local.set({ clickToTestEnabled });
  } catch (error) {
    console.error('Error saving click-to-test state:', error);
  }
}

// Update click-to-test button
function updateClickToTestButton() {
  if (enableClickToTestBtn) {
    if (clickToTestEnabled) {
      enableClickToTestBtn.textContent = 'Disable Click-to-Test';
      enableClickToTestBtn.classList.remove('btn-success');
      enableClickToTestBtn.classList.add('btn-warning');
    } else {
      enableClickToTestBtn.textContent = 'Enable Click-to-Test';
      enableClickToTestBtn.classList.remove('btn-warning');
      enableClickToTestBtn.classList.add('btn-success');
    }
  }
}

// Load test results
async function loadTestResults() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getTestResults' });
    if (response.success) {
      testResults = response.results || [];
      renderResults();
    }
  } catch (error) {
    console.error('Error loading test results:', error);
  }
}


// Render results list
function renderResults() {
  if (testResults.length === 0) {
    resultsListEl.innerHTML = '<div class="empty-state">No test results yet. Click on the Citi extension popup or use "Start Testing" to test.</div>';
    return;
  }
  
  let filteredResults = testResults;
  if (searchFilter) {
    const filter = searchFilter.toLowerCase();
    filteredResults = testResults.filter(r => 
      (r.merchantName && r.merchantName.toLowerCase().includes(filter)) ||
      (r.url && r.url.toLowerCase().includes(filter)) ||
      (r.merchantId && r.merchantId.toString().toLowerCase().includes(filter))
    );
  }
  
  // Sort by timestamp (newest first)
  filteredResults.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  resultsListEl.innerHTML = filteredResults.map(result => {
    const isFlagged = result.errors && result.errors.length > 0;
    const status = isFlagged ? 'flagged' : 'success';
    return `
      <div class="result-item ${status}" data-result-id="${result.id}">
        <div class="result-merchant">${escapeHtml(result.merchantName || 'Unknown Merchant')}</div>
        <div class="result-url">${escapeHtml(result.url || '')}</div>
        <div class="result-id">ID: ${escapeHtml(result.merchantId || 'N/A')} | Browser: ${escapeHtml(result.browser || 'Unknown')}</div>
        <div class="result-status ${status}">${isFlagged ? 'FLAGGED' : 'SUCCESS'}</div>
      </div>
    `;
  }).join('');
  
  // Add click listeners
  resultsListEl.querySelectorAll('.result-item').forEach(item => {
    item.addEventListener('click', () => {
      const resultId = item.dataset.resultId;
      const result = testResults.find(r => r.id === resultId);
      if (result) {
        showResultDetails(result);
      }
    });
  });
}


// Show result details in modal
function showResultDetails(result) {
  modalTitle.textContent = `Test Result: ${result.merchantName || 'Unknown'}`;
  
  const isFlagged = result.errors && result.errors.length > 0;
  
  // Store result ID for manual flagging
  modalBody.dataset.resultId = result.id;
  
  modalBody.innerHTML = `
    <div class="detail-item">
      <div class="detail-label">Merchant Name</div>
      <div class="detail-value">${escapeHtml(result.merchantName || 'Unknown')}</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">URL</div>
      <div class="detail-value">${escapeHtml(result.url || 'N/A')}</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">Merchant ID</div>
      <div class="detail-value">${escapeHtml(result.merchantId || 'N/A')}</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">Browser</div>
      <div class="detail-value">${escapeHtml(result.browser || 'Unknown')}</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">Test Date</div>
      <div class="detail-value">${new Date(result.timestamp).toLocaleString()}</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">Status</div>
      <div class="detail-value ${isFlagged ? 'error' : 'success'}">
        ${isFlagged ? 'FLAGGED' : 'SUCCESS'}
      </div>
    </div>
    ${result.exclusions ? `
      <div class="detail-item">
        <div class="detail-label">Exclusions</div>
        <div class="detail-value">${escapeHtml(result.exclusions)}</div>
      </div>
    ` : ''}
    ${result.earningRates ? `
      <div class="detail-item">
        <div class="detail-label">Earning Rates</div>
        <div class="detail-value">${escapeHtml(result.earningRates)}</div>
      </div>
    ` : ''}
    ${result.flags && result.flags.length > 0 ? `
      <div class="detail-item">
        <div class="detail-label">Flags</div>
        <ul class="flag-list">
          ${result.flags.map(flag => `<li>${escapeHtml(flag)}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
    ${result.errors && result.errors.length > 0 ? `
      <div class="detail-item">
        <div class="detail-label">Errors</div>
        <ul class="error-list">
          ${result.errors.map(error => `<li>${escapeHtml(error)}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
    ${result.screenshot ? `
      <div class="detail-item">
        <div class="detail-label">Screenshot</div>
        <img src="${result.screenshot}" alt="Screenshot" class="screenshot-preview">
      </div>
    ` : ''}
  `;
  
  merchantModal.classList.add('show');
}

// Close modal
function closeModal() {
  merchantModal.classList.remove('show');
  currentMerchant = null;
}

// Start testing
async function startTesting() {
  if (testingState.isRunning) return;
  
  // Get current active tab
  const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!currentTab || !currentTab.url) {
    alert('Please navigate to a merchant website first');
    return;
  }
  
  // Check if URL is valid (http/https)
  if (!currentTab.url.startsWith('http://') && !currentTab.url.startsWith('https://')) {
    alert('Please navigate to a valid website (http:// or https://)');
    return;
  }
  
  // Get browser name
  const browserResponse = await chrome.runtime.sendMessage({ action: 'getBrowserName' });
  const browserName = browserResponse.browser || 'Unknown';
  
  // Extract merchant info from current URL
  let merchant = null;
  try {
    const url = new URL(currentTab.url);
    const hostname = url.hostname.replace(/^www\./, '');
    
    // Try to find matching merchant in our list
    merchant = merchants.find(m => {
      if (!m.url && !m.domain) return false;
      try {
        const merchantUrl = new URL(m.url || m.domain);
        const merchantHostname = merchantUrl.hostname.replace(/^www\./, '');
        return merchantHostname === hostname;
      } catch (e) {
        return false;
      }
    });
    
    // If no match found, create a merchant from the URL
    if (!merchant) {
      merchant = {
        id: `url-${hostname}-${Date.now()}`,
        name: hostname,
        domain: hostname,
        url: currentTab.url,
        appId: 'unknown'
      };
    }
  } catch (error) {
    alert('Error parsing current URL: ' + error.message);
    return;
  }
  
  testingState.isRunning = true;
  testingState.isPaused = false;
  
  await saveTestingState(); // Persist state
  updateTestingButtons();
  
  // Test the current tab
  await testCurrentTab(currentTab, merchant, browserName);
}

// Test current tab
async function testCurrentTab(tab, merchant, browserName) {
  try {
    // Ensure content script is loaded
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
    } catch (e) {
      // Content script might already be loaded
      console.log('Content script injection:', e.message);
    }
    
    // Wait a bit for page to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Wait for Citi extension popup to appear (check every 2 seconds, max 30 seconds)
    let popupFound = false;
    for (let i = 0; i < 15; i++) {
      if (testingState.isPaused) {
        testingState.isRunning = false;
        updateTestingButtons();
        return;
      }
      
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'findCitiPopup' });
        if (response && response.found) {
          popupFound = true;
          // Highlight the popup to show it's being tested
          try {
            await chrome.tabs.sendMessage(tab.id, { action: 'highlightPopup' });
          } catch (e) {
            // Ignore highlight errors
          }
          break;
        }
      } catch (error) {
        // Content script might not be ready yet
        console.log('Waiting for popup...', error.message);
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    if (!popupFound) {
      // No popup found, mark as error
      const result = {
        id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        merchantId: merchant.id,
        merchantName: merchant.name,
        url: tab.url,
        browser: browserName,
        errors: ['Citi extension popup not found'],
        flags: [],
        activated: false
      };
      
      await saveTestResult(result);
      testingState.isRunning = false;
      await saveTestingState(); // Persist state
      updateTestingButtons();
      updateUI();
      alert('Citi extension popup not found on this page');
      return;
    }
    
    // Test the popup (this will also add visual indicators)
    const testResponse = await chrome.tabs.sendMessage(tab.id, { action: 'testCitiPopup' });
    
    if (testResponse && testResponse.success) {
      const testResult = testResponse.result;
      
      // Take screenshot
      try {
        const screenshot = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
        testResult.screenshot = screenshot;
      } catch (error) {
        console.error('Error taking screenshot:', error);
      }
      
      // Add merchant info
      testResult.merchantId = merchant.id;
      testResult.merchantName = merchant.name;
      testResult.browser = browserName;
      testResult.id = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      
      await saveTestResult(testResult);
      
      // Show result
      const isFlagged = testResult.errors && testResult.errors.length > 0;
      if (isFlagged) {
        alert(`Merchant flagged! Check results for details.`);
      } else {
        alert(`Test completed successfully!`);
      }
    } else {
      // Test failed
      const result = {
        id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        merchantId: merchant.id,
        merchantName: merchant.name,
        url: tab.url,
        browser: browserName,
        errors: [testResponse.error || 'Test failed'],
        flags: [],
        activated: false
      };
      
      await saveTestResult(result);
      alert('Test failed: ' + (testResponse.error || 'Unknown error'));
    }
    
    testingState.isRunning = false;
    await saveTestingState(); // Persist state
    updateTestingButtons();
    updateUI();
    
  } catch (error) {
    console.error('Error testing current tab:', error);
    
    const result = {
      id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      merchantId: merchant.id,
      merchantName: merchant.name,
      url: tab.url,
      browser: browserName,
      errors: ['Error during testing: ' + error.message],
      flags: [],
      activated: false
    };
    
    await saveTestResult(result);
    testingState.isRunning = false;
    await saveTestingState(); // Persist state
    updateTestingButtons();
    updateUI();
    alert('Error during testing: ' + error.message);
  }
}


// Pause testing
async function pauseTesting() {
  testingState.isPaused = true;
  await saveTestingState(); // Persist state
  updateTestingButtons();
}

// Restart testing
async function restartTesting() {
  testingState.isPaused = false;
  testingState.isRunning = false;
  await saveTestingState(); // Persist state
  updateTestingButtons();
  await startTesting();
}

// Clear testing
async function clearTesting() {
  if (confirm('Are you sure you want to clear testing? This will stop the current test.')) {
    testingState.isRunning = false;
    testingState.isPaused = false;
    testingState.currentMerchantIndex = 0;
    await saveTestingState(); // Persist state
    updateTestingButtons();
  }
}

// Clear results
async function clearResults() {
  if (confirm('Are you sure you want to clear all test results? This cannot be undone.')) {
    const response = await chrome.runtime.sendMessage({ action: 'clearTestResults' });
    if (response.success) {
      // Clear local array
      testResults = [];
      // Reload from storage to ensure it's empty
      await loadTestResults();
      // Update UI
      updateUI();
    }
  }
}

// Export CSV
async function exportCSV() {
  if (testResults.length === 0) {
    alert('No test results to export');
    return;
  }
  
  const csv = [
    ['Date', 'Merchant', 'Merchant ID', 'Browser Tested', 'Errors'].join(','),
    ...testResults.map(result => {
      const date = new Date(result.timestamp).toLocaleDateString();
      const merchant = result.merchantName || 'Unknown';
      const merchantId = result.merchantId || 'N/A';
      const browser = result.browser || 'Unknown';
      const errors = (result.errors && result.errors.length > 0) ? 'Yes' : 'No';
      
      return [
        escapeCsv(date),
        escapeCsv(merchant),
        escapeCsv(merchantId),
        escapeCsv(browser),
        escapeCsv(errors)
      ].join(',');
    })
  ].join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const filename = `citi-extension-test-results-${new Date().toISOString().split('T')[0]}.csv`;
  
  await chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: true
  });
}

// Handle search
function handleSearch(e) {
  searchFilter = e.target.value;
  renderResults();
}

// Manually flag/pass result
async function manuallyFlagMerchant(flag) {
  // Get the result from the modal (stored in modalBody data attribute)
  const resultId = modalBody.dataset.resultId;
  if (!resultId) return;
  
  const existingResult = testResults.find(r => r.id === resultId);
  if (!existingResult) return;
  
  const result = {
    ...existingResult,
    errors: flag ? ['Manually flagged'] : [],
    flags: flag ? ['Manually flagged by user'] : [],
    manual: true
  };
  
  // Update existing result
  const index = testResults.findIndex(r => r.id === result.id);
  if (index > -1) {
    testResults[index] = result;
  }
  
  await chrome.runtime.sendMessage({ action: 'saveTestResult', result });
  await loadTestResults();
  updateUI();
  closeModal();
}


// Save test result
async function saveTestResult(result) {
  const response = await chrome.runtime.sendMessage({ action: 'saveTestResult', result });
  if (response.success) {
    // Reload results from storage to ensure we have the latest (in case storage was cleared)
    await loadTestResults();
  }
}

// Update UI
function updateUI() {
  const totalTested = testResults.length;
  const totalSuccess = testResults.filter(r => !r.errors || r.errors.length === 0).length;
  const totalFlagged = testResults.filter(r => r.errors && r.errors.length > 0).length;
  
  totalTestedEl.textContent = totalTested;
  totalSuccessEl.textContent = totalSuccess;
  totalFlaggedEl.textContent = totalFlagged;
  
  renderResults();
}

// Save testing state to storage
async function saveTestingState() {
  try {
    await chrome.storage.local.set({ testingState });
  } catch (error) {
    console.error('Error saving testing state:', error);
  }
}

// Load testing state from storage
async function loadTestingState() {
  try {
    const result = await chrome.storage.local.get(['testingState']);
    if (result.testingState) {
      testingState = { ...testingState, ...result.testingState };
    }
  } catch (error) {
    console.error('Error loading testing state:', error);
  }
}

// Update testing buttons
function updateTestingButtons() {
  startTestingBtn.disabled = testingState.isRunning;
  pauseTestingBtn.disabled = !testingState.isRunning;
  restartTestingBtn.disabled = !testingState.isRunning;
}

// Utility functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeCsv(text) {
  if (text == null) return '';
  const str = String(text);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

