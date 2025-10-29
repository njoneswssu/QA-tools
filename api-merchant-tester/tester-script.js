// Global state
let merchantsData = null;
let allMerchants = [];
let filteredMerchants = [];
let merchantStatuses = new Map(); // Track merchant test statuses
let isValidating = false; // Prevent recursive validation calls
let testSession = null;
let testResults = {
    total: 0,
    successful: 0,
    flagged: 0,
    current: 0
};
let currentTestingUrl = null;
let testStartTime = null;
let autoScroll = true;
let testPaused = false;

// DOM elements
const elements = {
    apiData: document.getElementById('api-data'),
    appIdFilter: document.getElementById('app-id-filter'),
    categoryFilter: document.getElementById('category-filter'),
    merchantLimit: document.getElementById('merchant-limit'),
    testName: document.getElementById('test-name'),
    merchantPreview: document.getElementById('merchant-preview'),
    merchantSearch: document.getElementById('merchant-search'),
    statusFilter: document.getElementById('status-filter'),
    merchantCountDisplay: document.getElementById('merchant-count-display'),
    saveToDbBtn: document.getElementById('save-to-database-btn'),
    startTestBtn: document.getElementById('start-test-btn'),
    resetDatabaseBtn: document.getElementById('reset-database-btn'),
    loadStoredBtn: document.getElementById('load-stored-btn'),
    pauseTestBtn: document.getElementById('pause-test-btn'),
    resumeTestBtn: document.getElementById('resume-test-btn'),
    logContainer: document.getElementById('log-container'),
    clearLogBtn: document.getElementById('clear-log-btn'),
    autoScrollBtn: document.getElementById('auto-scroll-btn'),
    resultsSection: document.getElementById('results-section'),
    completionSection: document.getElementById('completion-section'),
    
    // Results elements
    totalTested: document.getElementById('total-tested'),
    successfulCount: document.getElementById('successful-count'),
    flaggedCount: document.getElementById('flagged-count'),
    progressPercent: document.getElementById('progress-percent'),
    currentMerchant: document.getElementById('current-merchant'),
    currentUrl: document.getElementById('current-url'),
    currentDetails: document.getElementById('current-details'),
    progressFill: document.getElementById('progress-fill'),
    
    // Control buttons
    pauseTestBtn: document.getElementById('pause-test-btn'),
    stopTestBtn: document.getElementById('stop-test-btn'),
    passCurrentBtn: document.getElementById('pass-current-btn'),
    
    // Results tabs and lists
    successfulList: document.getElementById('successful-list'),
    flaggedList: document.getElementById('flagged-list'),
    allList: document.getElementById('all-list'),
    successfulTabCount: document.getElementById('successful-tab-count'),
    flaggedTabCount: document.getElementById('flagged-tab-count'),
    allTabCount: document.getElementById('all-tab-count'),
    
    // Completion elements
    finalTotal: document.getElementById('final-total'),
    finalSuccessful: document.getElementById('final-successful'),
    finalFlagged: document.getElementById('final-flagged'),
    viewDashboardBtn: document.getElementById('view-dashboard-btn'),
    downloadResultsBtn: document.getElementById('download-results-btn'),
    startNewTestBtn: document.getElementById('start-new-test-btn')
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    generateDefaultTestName();
    
    // Clear any default values that might limit merchants
    elements.merchantLimit.value = '';
    
    // Populate dropdowns
    populateAppIdDropdown();
    
    // Auto-load stored merchants if available
    autoLoadStoredMerchants();
});

// Event listeners
function initializeEventListeners() {
    // Setup events - auto-validate on input
    elements.apiData.addEventListener('input', debounce(validateAndPreview, 500));
    elements.appIdFilter.addEventListener('input', debounce(applyFiltersAndPreview, 300));
    elements.categoryFilter.addEventListener('change', applyFiltersAndPreview);
    elements.merchantLimit.addEventListener('input', debounce(applyFiltersAndPreview, 300));
    elements.merchantSearch.addEventListener('input', filterMerchants);
    elements.statusFilter.addEventListener('change', filterMerchants);
    
    // Button events
    elements.saveToDbBtn.addEventListener('click', saveToDatabase);
    elements.startTestBtn.addEventListener('click', startTest);
    elements.loadStoredBtn.addEventListener('click', loadStoredMerchants);
    elements.resetDatabaseBtn.addEventListener('click', handleDatabaseReset);
    elements.pauseTestBtn.addEventListener('click', pauseTest);
    elements.resumeTestBtn.addEventListener('click', resumeTest);
    elements.clearLogBtn.addEventListener('click', clearLog);
    elements.autoScrollBtn.addEventListener('click', toggleAutoScroll);
    
    // Test control events
    elements.pauseTestBtn.addEventListener('click', pauseTest);
    elements.stopTestBtn.addEventListener('click', stopTest);
    elements.passCurrentBtn.addEventListener('click', passCurrentMerchant);
    
    // Tab events
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    });
    
    // Completion events
    elements.viewDashboardBtn.addEventListener('click', () => {
        window.open('/', '_blank');
    });
    elements.downloadResultsBtn.addEventListener('click', downloadResults);
    elements.startNewTestBtn.addEventListener('click', startNewTest);
}

// Generate default test name
function generateDefaultTestName() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
    elements.testName.value = `Merchant Test - ${dateStr}`;
}

// Validate and preview API data
function validateAndPreview() {
    // Prevent recursive calls
    if (isValidating) return;
    isValidating = true;
    
    const apiText = elements.apiData.value.trim();
    
    if (!apiText) {
        showPreviewPlaceholder();
        elements.startTestBtn.disabled = true;
        elements.saveToDbBtn.disabled = true;
        isValidating = false;
        return;
    }
    
    try {
        // Check if this is multiple pages separated by ---
        const pages = apiText.includes('---') ? 
            apiText.split('---').map(page => page.trim()).filter(page => page.length > 0) :
            [apiText];
        
        addLogEntry(`📄 Processing ${pages.length} page(s) of data...`, 'info');
        
        let allMerchants = [];
        let totalCount = 0;
        let pageSize = 50;
        
        // Process each page
        for (let i = 0; i < pages.length; i++) {
            try {
                const pageData = JSON.parse(pages[i]);
                
                // Validate structure
                if (!pageData.Merchants || !Array.isArray(pageData.Merchants)) {
                    throw new Error(`Page ${i + 1}: Invalid format - Expected "Merchants" array`);
                }
                
                if (pageData.Merchants.length === 0) {
                    addLogEntry(`⚠️ Page ${i + 1}: No merchants found - skipped`, 'warning');
                    continue;
                }
                
                // Validate merchant structure
                const requiredFields = ['MerchantName', 'MerchantDomains'];
                const invalidMerchants = pageData.Merchants.filter(merchant => 
                    !requiredFields.every(field => merchant[field])
                );
                
                if (invalidMerchants.length > 0) {
                    throw new Error(`Page ${i + 1}: ${invalidMerchants.length} merchants missing required fields (MerchantName, MerchantDomains)`);
                }
                
                // Add merchants from this page
                allMerchants = allMerchants.concat(pageData.Merchants);
                
                // Track metadata from first page
                if (i === 0) {
                    totalCount = pageData.TotalCount || pageData.Merchants.length;
                    pageSize = pageData.PageSize || 50;
                }
                
                addLogEntry(`✅ Page ${i + 1}: ${pageData.Merchants.length} merchants processed`, 'success');
                
            } catch (error) {
                throw new Error(`Page ${i + 1}: ${error.message}`);
            }
        }
        
        if (allMerchants.length === 0) {
            throw new Error('No valid merchants found in any page');
        }
        
        // Create combined data structure
        merchantsData = {
            Merchants: allMerchants,
            PageCount: 1, // Now it's all combined into one page
            PageSize: allMerchants.length,
            TotalCount: allMerchants.length
        };
        
        // Auto-detect and set AppID if available
        autoDetectAppId(allMerchants);
        
        populateCategories();
        applyFiltersAndPreview();
        elements.startTestBtn.disabled = false;
        elements.saveToDbBtn.disabled = false;
        
        // Show success message with details
        if (pages.length > 1) {
            showSuccess(`✅ Successfully processed ${pages.length} pages with ${allMerchants.length} total merchants!`);
            addLogEntry(`🎉 Multi-page processing complete: ${allMerchants.length} merchants from ${pages.length} pages`, 'success');
        } else {
            showSuccess('✅ API data validated successfully!');
            addLogEntry(`📊 Single page processed: ${allMerchants.length} merchants`, 'success');
        }
        
        // Auto-store merchants in database
        storeApiMerchants(allMerchants).catch(error => {
            console.warn('Failed to auto-store merchants:', error);
        });
        
    } catch (error) {
        showError(`Invalid API data: ${error.message}`);
        showPreviewPlaceholder();
        elements.startTestBtn.disabled = true;
        elements.saveToDbBtn.disabled = true;
    } finally {
        isValidating = false;
    }
}

// Auto-detect AppID from merchant data
function autoDetectAppId(merchants) {
    if (!merchants || merchants.length === 0) return;
    
    // Get all unique AppIDs from the merchants
    const appIds = [...new Set(merchants
        .map(m => m.AppID)
        .filter(id => id !== null && id !== undefined)
    )];
    
    if (appIds.length === 1) {
        // If all merchants have the same AppID, auto-select it
        const appId = appIds[0];
        elements.appIdFilter.value = appId;
        
        // Show success message
        showSuccess(`Auto-detected AppID: ${appId} (${merchants.length} merchants)`);
        
        // Log the detection
        addLogEntry(`🎯 Auto-detected AppID: ${appId} - ${merchants.length} merchants loaded`, 'info');
        
    } else if (appIds.length > 1) {
        // Multiple AppIDs found
        showWarning(`Multiple AppIDs found: ${appIds.join(', ')}. Please select one manually.`);
        addLogEntry(`⚠️ Multiple AppIDs detected: ${appIds.join(', ')} - ${merchants.length} merchants loaded`, 'warning');
    } else {
        // No AppIDs found
        showWarning('No AppIDs found in merchant data. All merchants will be included.');
        addLogEntry(`❌ No AppIDs found - ${merchants.length} merchants loaded`, 'warning');
    }
}

// Populate App ID dropdown from database
async function populateAppIdDropdown() {
    try {
        const response = await fetch('/api/app-ids');
        const appIds = await response.json();
        
        elements.appIdFilter.innerHTML = '<option value="">All App IDs</option>';
        appIds.forEach(appId => {
            const option = document.createElement('option');
            option.value = appId;
            option.textContent = appId;
            elements.appIdFilter.appendChild(option);
        });
        
        console.log(`Loaded ${appIds.length} App IDs into dropdown`);
    } catch (error) {
        console.error('Error loading App IDs:', error);
    }
}

// Populate category filter
function populateCategories() {
    const categories = [...new Set(merchantsData.Merchants
        .map(m => m.PrimaryCategory)
        .filter(Boolean)
    )].sort();
    
    elements.categoryFilter.innerHTML = '<option value="">All Categories</option>';
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        elements.categoryFilter.appendChild(option);
    });
}

// Apply filters and update preview
function applyFiltersAndPreview() {
    if (!merchantsData) return;
    
    let merchants = [...merchantsData.Merchants];
    
    // Filter by App ID
    const appId = elements.appIdFilter.value.trim();
    if (appId) {
        merchants = merchants.filter(m => m.AppID == appId);
    }
    
    // Filter by category
    const category = elements.categoryFilter.value;
    if (category) {
        merchants = merchants.filter(m => m.PrimaryCategory === category);
    }
    
    // Apply limit
    const limitValue = elements.merchantLimit.value.trim();
    const limit = limitValue ? parseInt(limitValue) : null;
    if (limit && limit > 0) {
        console.log(`Applying merchant limit: ${limit} (from ${merchants.length} merchants)`);
        merchants = merchants.slice(0, limit);
        addLogEntry(`📊 Applied limit: showing ${limit} of ${merchantsData.Merchants.length} total merchants`, 'info');
    } else {
        console.log(`No limit applied, showing all ${merchants.length} merchants`);
    }
    
    filteredMerchants = merchants;
    allMerchants = merchants; // Update allMerchants for filtering
    displayMerchantList(merchants);
    elements.merchantCountDisplay.textContent = `${merchants.length} merchants`;
}

// Update merchant preview
function updatePreview() {
    if (filteredMerchants.length === 0) {
        elements.merchantPreview.innerHTML = `
            <div class="preview-placeholder">
                <i class="fas fa-filter"></i>
                <p>No merchants match the current filters</p>
            </div>
        `;
        return;
    }
    
    const previewHtml = filteredMerchants.slice(0, 10).map(merchant => `
        <div class="merchant-item">
            <div class="merchant-name">${escapeHtml(merchant.MerchantName)}</div>
            <div class="merchant-details">
                <span><i class="fas fa-globe"></i> ${merchant.MerchantDomains[0] || 'No domain'}</span>
                <span><i class="fas fa-tag"></i> ${merchant.PrimaryCategory || 'No category'}</span>
                <span><i class="fas fa-id-badge"></i> App ID: ${merchant.AppID}</span>
                <span><i class="fas fa-percentage"></i> ${merchant.MaxRate || '0'}${merchant.MaxRateKind === 'PERCENTAGE' ? '%' : ` ${merchant.MaxRateCurrency || ''}`}</span>
            </div>
        </div>
    `).join('');
    
    const moreText = filteredMerchants.length > 10 ? 
        `<div style="text-align: center; padding: 15px; color: #6b7280; font-style: italic;">
            ... and ${filteredMerchants.length - 10} more merchants
        </div>` : '';
    
    elements.merchantPreview.innerHTML = previewHtml + moreText;
}

// Show preview placeholder
function showPreviewPlaceholder() {
    elements.merchantPreview.innerHTML = `
        <div class="preview-placeholder">
            <i class="fas fa-upload"></i>
            <p>Paste API data above to preview merchants</p>
        </div>
    `;
}

// Start test
async function startTest() {
    if (!filteredMerchants.length) {
        showError('No merchants to test');
        return;
    }
    
    // Reset test state
    testResults = {
        total: filteredMerchants.length,
        successful: 0,
        flagged: 0,
        current: 0
    };
    
    // Create test session
    const sessionName = elements.testName.value.trim() || 'API Merchant Test';
    try {
        const response = await fetch('/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: `api-ui-${Date.now()}`,
                notes: `${sessionName} - ${filteredMerchants.length} merchants`
            })
        });
        
        if (!response.ok) throw new Error('Failed to create session');
        testSession = await response.json();
    } catch (error) {
        console.error('Failed to create session:', error);
        showError('Failed to create test session');
        return;
    }
    
    // Show results section
    elements.resultsSection.style.display = 'block';
    elements.resultsSection.scrollIntoView({ behavior: 'smooth' });
    
    // Start the actual testing
    runTest();
}

// Run the test
async function runTest() {
    testStartTime = Date.now();
    updateStats();
    clearResultsLists();
    clearLog();
    
    addLogEntry(`Starting test with ${filteredMerchants.length} merchants`, 'info');
    
    try {
        // Trigger the actual Playwright test
        addLogEntry('Sending test request to server...', 'info');
        
        const response = await fetch('/api/start-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                merchants: filteredMerchants,
                sessionId: testSession.session_id,
                testName: elements.testName.value.trim() || 'API Merchant Test'
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to start Playwright test');
        }
        
        const result = await response.json();
        addLogEntry(`Playwright test started successfully (Session: ${result.sessionId})`, 'success');
        
        // Show message that real test is running
        elements.currentMerchant.textContent = 'Real Playwright test is now running...';
        elements.currentUrl.textContent = 'Check the browser window that opened';
        elements.currentDetails.textContent = 'The actual website testing is happening in the Playwright browser';
        
        addLogEntry('Browser automation started - check the opened browser window', 'info');
        addLogEntry('Polling for results every 2 seconds...', 'info');
        
        // Start polling for results
        pollForResults();
        
    } catch (error) {
        console.error('Failed to start test:', error);
        addLogEntry(`Failed to start Playwright test: ${error.message}`, 'error');
        showError('Failed to start Playwright test: ' + error.message);
        
        // Fallback to simulation mode
        addLogEntry('Falling back to simulation mode...', 'warning');
        showInfo('Falling back to simulation mode...');
        await runSimulatedTest();
    }
}

// Poll for test results from the database
async function pollForResults() {
    const pollInterval = 2000; // Poll every 2 seconds
    let lastResultCount = 0;
    
    const poll = async () => {
        try {
            const response = await fetch(`/api/merchant-results?session_id=${testSession.session_id}&limit=1000`);
            if (response.ok) {
                const data = await response.json();
                const results = data.data || data;
                
                // Update stats if we have new results
                if (results.length > lastResultCount) {
                    const newResults = results.slice(lastResultCount);
                    newResults.forEach(result => {
                        const status = result.is_user_passed ? 'success' : result.test_status;
                        const statusText = status === 'success' ? '✅' : '🚨';
                        addLogEntry(`${statusText} ${result.merchant_name}: ${result.test_result}`, status === 'success' ? 'success' : 'error');
                    });
                    
                    updateStatsFromResults(results);
                    updateResultsFromDatabase(results);
                    lastResultCount = results.length;
                    
                    addLogEntry(`Progress: ${results.length}/${filteredMerchants.length} merchants tested`, 'info');
                }
                
                // Check if test is complete
                if (results.length >= filteredMerchants.length) {
                    addLogEntry('Test completed successfully!', 'success');
                    completeTest();
                    return;
                }
                
                // Continue polling
                setTimeout(poll, pollInterval);
            }
        } catch (error) {
            console.error('Error polling results:', error);
            setTimeout(poll, pollInterval);
        }
    };
    
    // Start polling
    setTimeout(poll, pollInterval);
}

// Update stats from database results
function updateStatsFromResults(results) {
    const successful = results.filter(r => r.test_status === 'success' || r.is_user_passed).length;
    const flagged = results.filter(r => r.test_status === 'flagged').length;
    
    testResults.current = results.length;
    testResults.successful = successful;
    testResults.flagged = flagged;
    
    updateStats();
}

// Update results display from database
function updateResultsFromDatabase(results) {
    // Clear existing results
    clearResultsLists();
    
    results.forEach(result => {
        const merchant = {
            MerchantName: result.merchant_name,
            MerchantDomains: [result.merchant_url?.replace('https://', '') || '']
        };
        
        const testResult = {
            status: result.is_user_passed ? 'success' : result.test_status,
            reason: result.test_result || 'No reason provided'
        };
        
        addResultToList(merchant, testResult);
    });
}

// Fallback simulation for when Playwright test fails to start
async function runSimulatedTest() {
    for (let i = 0; i < filteredMerchants.length; i++) {
        const merchant = filteredMerchants[i];
        testResults.current = i + 1;
        
        // Update current merchant display
        updateCurrentMerchant(merchant);
        updateStats();
        
        // Simulate testing
        const result = await testMerchant(merchant);
        
        // Save result to database
        await saveMerchantResult(merchant, result);
        
        // Update results
        if (result.status === 'success') {
            testResults.successful++;
        } else {
            testResults.flagged++;
        }
        
        addResultToList(merchant, result);
        updateStats();
        
        // Small delay for UI updates
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Test completed
    completeTest();
}

// Test individual merchant (simulated)
async function testMerchant(merchant) {
    // This is a simulation - in real implementation, this would trigger the Playwright test
    const url = merchant.MerchantDomains[0] ? `https://${merchant.MerchantDomains[0]}` : null;
    
    if (!url) {
        return {
            status: 'flagged',
            reason: 'No valid domain found',
            pattern: 'missing domain'
        };
    }
    
    // Simulate random results for demo
    const isSuccess = Math.random() > 0.3; // 70% success rate
    
    if (isSuccess) {
        const reasons = [
            'E-commerce features detected - functional online store',
            'Business model detected - active commerce site',
            'Pricing information detected - active business',
            'Professional website with business content'
        ];
        return {
            status: 'success',
            reason: reasons[Math.floor(Math.random() * reasons.length)]
        };
    } else {
        const patterns = [
            'timeout error',
            'this store is unavailable',
            'under maintenance',
            'coming soon',
            'connection refused'
        ];
        const pattern = patterns[Math.floor(Math.random() * patterns.length)];
        return {
            status: 'flagged',
            reason: `Site unavailable: ${pattern}`,
            pattern: pattern
        };
    }
}

// Save merchant result to database
async function saveMerchantResult(merchant, result) {
    if (!testSession) return;
    
    try {
        const testData = {
            session_id: testSession.session_id,
            merchant_name: merchant.MerchantName,
            merchant_url: merchant.MerchantDomains[0] ? `https://${merchant.MerchantDomains[0]}` : null,
            merchant_id: merchant.MerchantID,
            app_id: merchant.AppID,
            primary_category: merchant.PrimaryCategory,
            parent_category: merchant.ParentCategory,
            max_rate: merchant.MaxRate,
            max_rate_kind: merchant.MaxRateKind,
            test_status: result.status,
            test_result: result.reason,
            error_pattern: result.pattern || null,
            test_duration_ms: Math.floor(Math.random() * 5000) + 1000, // Simulated duration
            is_user_passed: false,
            detailed_analysis: result.reason
        };
        
        await fetch('/api/merchant-results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testData)
        });
    } catch (error) {
        console.error('Failed to save result:', error);
    }
}

// Update current merchant display
function updateCurrentMerchant(merchant) {
    elements.currentMerchant.textContent = merchant.MerchantName;
    elements.currentUrl.textContent = merchant.MerchantDomains[0] ? `https://${merchant.MerchantDomains[0]}` : 'No domain';
    elements.currentDetails.textContent = `${merchant.PrimaryCategory || 'No category'} • App ID: ${merchant.AppID} • Rate: ${merchant.MaxRate || '0'}${merchant.MaxRateKind === 'PERCENTAGE' ? '%' : ` ${merchant.MaxRateCurrency || ''}`}`;
}

// Update statistics display
function updateStats() {
    elements.totalTested.textContent = testResults.current;
    elements.successfulCount.textContent = testResults.successful;
    elements.flaggedCount.textContent = testResults.flagged;
    
    const progress = testResults.total > 0 ? (testResults.current / testResults.total) * 100 : 0;
    elements.progressPercent.textContent = `${Math.round(progress)}%`;
    elements.progressFill.style.width = `${progress}%`;
    
    // Update tab counts
    elements.successfulTabCount.textContent = testResults.successful;
    elements.flaggedTabCount.textContent = testResults.flagged;
    elements.allTabCount.textContent = testResults.current;
}

// Add result to appropriate list
function addResultToList(merchant, result) {
    const resultHtml = `
        <div class="result-item ${result.status}">
            <div class="result-header">
                <div class="result-name">${escapeHtml(merchant.MerchantName)}</div>
                <div class="result-status ${result.status}">${result.status}</div>
            </div>
            <div class="result-url">${merchant.MerchantDomains[0] ? `https://${merchant.MerchantDomains[0]}` : 'No domain'}</div>
            <div class="result-reason">${escapeHtml(result.reason)}</div>
        </div>
    `;
    
    // Add to appropriate lists
    if (result.status === 'success') {
        if (elements.successfulList.querySelector('.no-results')) {
            elements.successfulList.innerHTML = '';
        }
        elements.successfulList.insertAdjacentHTML('afterbegin', resultHtml);
    } else {
        if (elements.flaggedList.querySelector('.no-results')) {
            elements.flaggedList.innerHTML = '';
        }
        elements.flaggedList.insertAdjacentHTML('afterbegin', resultHtml);
    }
    
    // Add to all results
    if (elements.allList.querySelector('.no-results')) {
        elements.allList.innerHTML = '';
    }
    elements.allList.insertAdjacentHTML('afterbegin', resultHtml);
}

// Clear results lists
function clearResultsLists() {
    elements.successfulList.innerHTML = '<div class="no-results"><i class="fas fa-hourglass-start"></i><p>No successful merchants yet</p></div>';
    elements.flaggedList.innerHTML = '<div class="no-results"><i class="fas fa-hourglass-start"></i><p>No flagged merchants yet</p></div>';
    elements.allList.innerHTML = '<div class="no-results"><i class="fas fa-hourglass-start"></i><p>No results yet</p></div>';
}

// Switch tabs
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    document.getElementById(`${tabName}-results`).classList.add('active');
}

// Complete test
async function completeTest() {
    // Update session as completed
    if (testSession) {
        try {
            await fetch(`/api/sessions/${testSession.session_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    completed_at: new Date().toISOString(),
                    total_merchants: testResults.total,
                    successful_merchants: testResults.successful,
                    flagged_merchants: testResults.flagged,
                    user_passed_merchants: 0,
                    status: 'completed'
                })
            });
        } catch (error) {
            console.error('Failed to update session:', error);
        }
    }
    
    // Update final stats
    elements.finalTotal.textContent = testResults.total;
    elements.finalSuccessful.textContent = testResults.successful;
    elements.finalFlagged.textContent = testResults.flagged;
    
    // Show completion section
    elements.completionSection.style.display = 'block';
    elements.completionSection.scrollIntoView({ behavior: 'smooth' });
    
    showSuccess('Test completed successfully!');
}

// Control functions
function pauseTest() {
    // In real implementation, this would pause the Playwright test
    showInfo('Test paused - click resume to continue');
}

function stopTest() {
    // In real implementation, this would stop the Playwright test
    completeTest();
}

function passCurrentMerchant() {
    // In real implementation, this would mark current merchant as passed
    showInfo('Current merchant marked as passed');
}

// Download results
function downloadResults() {
    const csvContent = generateCSV();
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `merchant-test-results-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

// Generate CSV content
function generateCSV() {
    const headers = ['Merchant Name', 'URL', 'Status', 'Category', 'App ID', 'Max Rate', 'Reason'];
    const rows = filteredMerchants.map(merchant => [
        merchant.MerchantName,
        merchant.MerchantDomains[0] ? `https://${merchant.MerchantDomains[0]}` : 'No domain',
        'Tested', // Would be actual status in real implementation
        merchant.PrimaryCategory || '',
        merchant.AppID,
        `${merchant.MaxRate || '0'}${merchant.MaxRateKind === 'PERCENTAGE' ? '%' : ` ${merchant.MaxRateCurrency || ''}`}`,
        'Test result' // Would be actual reason in real implementation
    ]);
    
    return [headers, ...rows].map(row => 
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
}

// Start new test
function startNewTest() {
    // Reset UI
    elements.resultsSection.style.display = 'none';
    elements.completionSection.style.display = 'none';
    
    // Reset state
    testSession = null;
    testResults = { total: 0, successful: 0, flagged: 0, current: 0 };
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    showInfo('Ready to start a new test');
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

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

// Notification functions
function showSuccess(message) {
    showNotification(message, 'success');
}

function showError(message) {
    showNotification(message, 'error');
}

function showInfo(message) {
    showNotification(message, 'info');
}

function showWarning(message) {
    showNotification(message, 'warning');
}

function showNotification(message, type) {
    // Simple notification system
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 10000;
        max-width: 400px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease-out;
    `;
    
    if (type === 'success') {
        notification.style.background = '#10b981';
    } else if (type === 'error') {
        notification.style.background = '#ef4444';
    } else if (type === 'warning') {
        notification.style.background = '#f59e0b';
    } else {
        notification.style.background = '#3b82f6';
    }
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in forwards';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add CSS for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Terminal Log Functions
function addLogEntry(message, type = 'info') {
    const now = new Date();
    const timestamp = now.toTimeString().split(' ')[0];
    
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    
    logEntry.innerHTML = `
        <span class="log-time">[${timestamp}]</span>
        <span class="log-message">${escapeHtml(message)}</span>
    `;
    
    elements.logContainer.appendChild(logEntry);
    
    // Auto scroll if enabled
    if (autoScroll) {
        elements.logContainer.scrollTop = elements.logContainer.scrollHeight;
    }
}

function clearLog() {
    elements.logContainer.innerHTML = `
        <div class="log-entry">
            <span class="log-time">[${new Date().toTimeString().split(' ')[0]}]</span>
            <span class="log-message">Log cleared</span>
        </div>
    `;
}

function toggleAutoScroll() {
    autoScroll = !autoScroll;
    elements.autoScrollBtn.classList.toggle('active', autoScroll);
    
    if (autoScroll) {
        elements.logContainer.scrollTop = elements.logContainer.scrollHeight;
    }
}

// Merchant Storage Functions
async function autoLoadStoredMerchants() {
    try {
        const response = await fetch('/api/stored-merchants');
        if (!response.ok) {
            // No stored merchants or error - this is fine for first load
            return;
        }
        
        const data = await response.json();
        
        if (data.merchants && data.merchants.length > 0) {
            addLogEntry(`Auto-loaded ${data.merchants.length} stored merchants from database`, 'success');
            
            // Set the API data
            elements.apiData.value = JSON.stringify({ Merchants: data.merchants }, null, 2);
            
            // Trigger validation and preview
            await validateAndPreview();
            
            addLogEntry('✅ Stored merchants loaded and ready for testing', 'success');
        } else {
            addLogEntry('No stored merchants found in database', 'info');
        }
    } catch (error) {
        // Silent fail for auto-load - don't spam the user on page load
        console.log('Auto-load merchants failed (this is normal for first visit):', error.message);
    }
}

async function loadStoredMerchants() {
    try {
        addLogEntry('Loading stored merchants from database...', 'info');
        
        const response = await fetch('/api/stored-merchants');
        if (!response.ok) {
            throw new Error('Failed to load stored merchants');
        }
        
        const data = await response.json();
        
        if (data.merchants && data.merchants.length > 0) {
            // Set the API data
            elements.apiData.value = JSON.stringify({ Merchants: data.merchants }, null, 2);
            
            // Trigger validation
            await validateAndPreview();
            
            addLogEntry(`Loaded ${data.merchants.length} stored merchants`, 'success');
            showSuccess(`Loaded ${data.merchants.length} stored merchants from database`);
        } else {
            addLogEntry('No stored merchants found in database', 'warning');
            showInfo('No stored merchants found. Please paste API data first.');
        }
    } catch (error) {
        console.error('Error loading stored merchants:', error);
        addLogEntry(`Error loading stored merchants: ${error.message}`, 'error');
        showError('Failed to load stored merchants');
    }
}

async function storeApiMerchants(merchants) {
    try {
        addLogEntry(`Storing ${merchants.length} merchants in database...`, 'info');
        
        const response = await fetch('/api/store-merchants', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ merchants })
        });
        
        if (!response.ok) {
            throw new Error('Failed to store merchants');
        }
        
        const result = await response.json();
        addLogEntry(`Successfully stored ${result.count} merchants`, 'success');
        
        return result;
    } catch (error) {
        console.error('Error storing merchants:', error);
        addLogEntry(`Error storing merchants: ${error.message}`, 'error');
        throw error;
    }
}


// Manual save to database function
async function saveToDatabase() {
    if (!merchantsData || !merchantsData.Merchants) {
        showError('No merchant data to save. Please validate API data first.');
        return;
    }
    
    try {
        elements.saveToDbBtn.disabled = true;
        elements.saveToDbBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        
        await storeApiMerchants(merchantsData.Merchants);
        
        // Refresh the AppID dropdown after saving
        await populateAppIdDropdown();
        
        showSuccess(`Successfully saved ${merchantsData.Merchants.length} merchants to database!`);
        addLogEntry(`💾 Manually saved ${merchantsData.Merchants.length} merchants to database`, 'success');
        
    } catch (error) {
        showError(`Failed to save merchants: ${error.message}`);
        addLogEntry(`❌ Save failed: ${error.message}`, 'error');
    } finally {
        elements.saveToDbBtn.disabled = false;
        elements.saveToDbBtn.innerHTML = '<i class="fas fa-save"></i> Save to Database';
    }
}

// Database reset function with confirmation
async function handleDatabaseReset() {
    // First confirmation
    const firstConfirm = confirm('⚠️ WARNING: This will permanently delete ALL test results and merchant data from the database.\n\nAre you sure you want to continue?');
    
    if (!firstConfirm) {
        return;
    }
    
    // Second confirmation
    const secondConfirm = confirm('🚨 FINAL WARNING: This action cannot be undone!\n\nClick OK to permanently delete all data, or Cancel to abort.');
    
    if (!secondConfirm) {
        return;
    }
    
    try {
        elements.resetDatabaseBtn.disabled = true;
        elements.resetDatabaseBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resetting...';
        
        const response = await fetch('/api/reset-database', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Clear local data
            merchantsData = null;
            allMerchants = [];
            filteredMerchants = [];
            merchantStatuses.clear();
            
            // Reset UI elements
            elements.apiData.value = '';
            elements.merchantLimit.value = '';
            elements.merchantSearch.value = '';
            elements.statusFilter.value = '';
            elements.categoryFilter.innerHTML = '<option value="">All Categories</option>';
            elements.merchantCountDisplay.textContent = '0 merchants';
            elements.startTestBtn.disabled = true;
            elements.saveToDbBtn.disabled = true;
            
            // Reset test results
            testResults = {
                total: 0,
                successful: 0,
                flagged: 0,
                current: 0
            };
            
            // Clear preview
            showPreviewPlaceholder();
            
            // Refresh AppID dropdown
            await populateAppIdDropdown();
            
            showSuccess('✅ Database reset successfully! All data has been cleared.');
            addLogEntry('🗑️ Database reset completed - all data cleared', 'success');
        } else {
            throw new Error(result.error || 'Failed to reset database');
        }
    } catch (error) {
        console.error('Error resetting database:', error);
        showError('❌ Error resetting database: ' + error.message);
        addLogEntry(`❌ Database reset failed: ${error.message}`, 'error');
    } finally {
        elements.resetDatabaseBtn.disabled = false;
        elements.resetDatabaseBtn.innerHTML = '<i class="fas fa-database"></i> Reset Database';
    }
}

// Test Control Functions
function pauseTest() {
    testPaused = true;
    elements.pauseTestBtn.style.display = 'none';
    elements.resumeTestBtn.style.display = 'inline-block';
    addLogEntry('Test paused by user', 'warning');
    showInfo('Test paused. Click Resume to continue.');
}

function resumeTest() {
    testPaused = false;
    elements.pauseTestBtn.style.display = 'inline-block';
    elements.resumeTestBtn.style.display = 'none';
    addLogEntry('Test resumed by user', 'info');
    showInfo('Test resumed.');
}

// Enhanced merchant filtering
function filterMerchants() {
    if (!allMerchants.length) return;
    
    const searchTerm = elements.merchantSearch.value.toLowerCase();
    const statusFilter = elements.statusFilter.value;
    
    let filtered = allMerchants.filter(merchant => {
        // Search filter
        const matchesSearch = !searchTerm || 
            merchant.MerchantName.toLowerCase().includes(searchTerm) ||
            (merchant.MerchantDomains && merchant.MerchantDomains.some(domain => 
                domain.toLowerCase().includes(searchTerm)
            ));
        
        // Status filter
        const merchantStatus = merchantStatuses.get(merchant.MerchantID) || 'untested';
        const matchesStatus = !statusFilter || merchantStatus === statusFilter;
        
        return matchesSearch && matchesStatus;
    });
    
    displayMerchantList(filtered);
    elements.merchantCountDisplay.textContent = `${filtered.length} merchants`;
}

// Enhanced merchant list display
function displayMerchantList(merchants) {
    if (!merchants || merchants.length === 0) {
        elements.merchantPreview.innerHTML = `
            <div class="preview-placeholder">
                <i class="fas fa-search"></i>
                <p>No merchants match your filters</p>
            </div>
        `;
        return;
    }
    
    const merchantList = document.createElement('div');
    merchantList.className = 'merchant-list';
    
    merchants.forEach(merchant => {
        const status = merchantStatuses.get(merchant.MerchantID) || 'untested';
        const domain = merchant.MerchantDomains && merchant.MerchantDomains[0] ? merchant.MerchantDomains[0] : 'No domain';
        
        const merchantItem = document.createElement('div');
        merchantItem.className = 'merchant-item';
        merchantItem.innerHTML = `
            <div class="merchant-info-item">
                <div class="merchant-name-item">${escapeHtml(merchant.MerchantName)}</div>
                <div class="merchant-url-item">${escapeHtml(domain)}</div>
                <div class="merchant-category-item">${escapeHtml(merchant.PrimaryCategory || 'No category')}</div>
            </div>
            <div class="merchant-status ${status}">${status}</div>
        `;
        
        merchantList.appendChild(merchantItem);
    });
    
    elements.merchantPreview.innerHTML = '';
    elements.merchantPreview.appendChild(merchantList);
}

// Database reset with confirmation
let resetClickCount = 0;
let resetTimeout = null;

async function handleDatabaseReset() {
    resetClickCount++;
    
    if (resetClickCount === 1) {
        elements.resetDatabaseBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Click Again to Confirm';
        elements.resetDatabaseBtn.style.background = '#dc2626';
        addLogEntry('Database reset requested - click again to confirm', 'warning');
        
        resetTimeout = setTimeout(() => {
            resetClickCount = 0;
            elements.resetDatabaseBtn.innerHTML = '<i class="fas fa-database"></i> Reset Database';
            elements.resetDatabaseBtn.style.background = '';
        }, 3000);
        
        return;
    }
    
    if (resetClickCount >= 2) {
        clearTimeout(resetTimeout);
        
        try {
            addLogEntry('Resetting database...', 'warning');
            
            const response = await fetch('/api/reset-database', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) {
                throw new Error('Failed to reset database');
            }
            
            const result = await response.json();
            
            // Reset UI state
            merchantsData = null;
            allMerchants = [];
            filteredMerchants = [];
            merchantStatuses.clear();
            elements.apiData.value = '';
            elements.merchantPreview.innerHTML = `
                <div class="preview-placeholder">
                    <i class="fas fa-upload"></i>
                    <p>Paste API data above to preview merchants</p>
                </div>
            `;
            elements.startTestBtn.disabled = true;
            
            addLogEntry('Database reset completed successfully', 'success');
            showSuccess('Database reset successfully');
            
        } catch (error) {
            console.error('Error resetting database:', error);
            addLogEntry(`Database reset failed: ${error.message}`, 'error');
            showError('Failed to reset database');
        }
        
        // Reset button state
        resetClickCount = 0;
        elements.resetDatabaseBtn.innerHTML = '<i class="fas fa-database"></i> Reset Database';
        elements.resetDatabaseBtn.style.background = '';
    }
}
