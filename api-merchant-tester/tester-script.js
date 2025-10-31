// Global state
let merchantsData = null;
let allMerchants = [];
let filteredMerchants = [];
let priorityQueue = []; // Priority queue for merchants to test first
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

// Cache keys for localStorage
const CACHE_KEYS = {
    MERCHANTS_DATA: 'api_tester_merchants_data',
    FILTERED_MERCHANTS: 'api_tester_filtered_merchants',
    LAST_FILTERS: 'api_tester_last_filters',
    LAST_LOAD_TIME: 'api_tester_last_load_time'
};

// Cache management functions
function saveMerchantsToCache() {
    try {
        if (merchantsData && merchantsData.Merchants && merchantsData.Merchants.length > 0) {
            // Check size before caching
            const dataString = JSON.stringify(merchantsData);
            const sizeInMB = new Blob([dataString]).size / (1024 * 1024);
            
            console.log('💾 Checking cache size:', {
                totalMerchants: merchantsData.Merchants.length,
                sizeInMB: sizeInMB.toFixed(2),
                filteredCount: filteredMerchants.length
            });
            
            // Only cache if data is smaller than 4MB to avoid quota errors
            if (sizeInMB > 4) {
                console.warn(`⚠️ Skipping cache - data too large (${sizeInMB.toFixed(2)}MB). Using database instead.`);
                
                // Just save the filters
                const currentFilters = {
                    appId: elements.appIdFilter ? elements.appIdFilter.value : '',
                    category: elements.categoryFilter ? elements.categoryFilter.value : '',
                    status: elements.statusFilter ? elements.statusFilter.value : '',
                    limit: elements.limitFilter ? elements.limitFilter.value : '',
                    search: elements.searchFilter ? elements.searchFilter.value : ''
                };
                localStorage.setItem(CACHE_KEYS.LAST_FILTERS, JSON.stringify(currentFilters));
                localStorage.setItem(CACHE_KEYS.LAST_LOAD_TIME, Date.now().toString());
                return;
            }
            
            localStorage.setItem(CACHE_KEYS.MERCHANTS_DATA, dataString);
            localStorage.setItem(CACHE_KEYS.FILTERED_MERCHANTS, JSON.stringify(filteredMerchants));
            localStorage.setItem(CACHE_KEYS.LAST_LOAD_TIME, Date.now().toString());
            
            // Save current filter values
            const currentFilters = {
                appId: elements.appIdFilter ? elements.appIdFilter.value : '',
                category: elements.categoryFilter ? elements.categoryFilter.value : '',
                status: elements.statusFilter ? elements.statusFilter.value : '',
                limit: elements.limitFilter ? elements.limitFilter.value : '',
                search: elements.searchFilter ? elements.searchFilter.value : ''
            };
            localStorage.setItem(CACHE_KEYS.LAST_FILTERS, JSON.stringify(currentFilters));
            
            console.log(`✅ ${merchantsData.Merchants.length} merchants cached (${sizeInMB.toFixed(2)}MB)`);
        } else {
            console.warn('⚠️ Cannot cache - invalid merchant data');
        }
    } catch (error) {
        if (error.name === 'QuotaExceededError') {
            console.warn('⚠️ LocalStorage quota exceeded - skipping cache. Data is still available from database.');
            // Clear old cache to free up space
            try {
                localStorage.removeItem(CACHE_KEYS.MERCHANTS_DATA);
                localStorage.removeItem(CACHE_KEYS.FILTERED_MERCHANTS);
            } catch (e) {
                // Ignore cleanup errors
            }
        } else {
            console.error('❌ Failed to cache merchants:', error);
        }
    }
}

function loadMerchantsFromCache() {
    try {
        console.log('🔍 Checking for cached merchants...');
        const cachedData = localStorage.getItem(CACHE_KEYS.MERCHANTS_DATA);
        const cachedFiltered = localStorage.getItem(CACHE_KEYS.FILTERED_MERCHANTS);
        const cachedFilters = localStorage.getItem(CACHE_KEYS.LAST_FILTERS);
        
        console.log('Cache check:', {
            hasData: !!cachedData,
            hasFiltered: !!cachedFiltered,
            hasFilters: !!cachedFilters
        });
        
        if (cachedData && cachedFiltered) {
            merchantsData = JSON.parse(cachedData);
            filteredMerchants = JSON.parse(cachedFiltered);
            
            console.log('📦 Loaded from cache:', {
                totalMerchants: merchantsData.Merchants.length,
                filteredCount: filteredMerchants.length
            });
            
            // Restore filter values (with safety checks)
            if (cachedFilters) {
                try {
                    const filters = JSON.parse(cachedFilters);
                    if (elements.appIdFilter && filters.appId !== undefined) elements.appIdFilter.value = filters.appId;
                    if (elements.categoryFilter && filters.category !== undefined) elements.categoryFilter.value = filters.category;
                    if (elements.statusFilter && filters.status !== undefined) elements.statusFilter.value = filters.status;
                    if (elements.limitFilter && filters.limit !== undefined) elements.limitFilter.value = filters.limit;
                    if (elements.searchFilter && filters.search !== undefined) elements.searchFilter.value = filters.search;
                    if (elements.merchantSearch && filters.search !== undefined) elements.merchantSearch.value = filters.search;
                } catch (filterError) {
                    console.warn('Failed to restore filters:', filterError);
                }
            }
            
            // Update UI
            try {
                // Ensure merchant preview is updated
                if (elements.merchantPreview && filteredMerchants.length > 0) {
                    displayMerchantList(filteredMerchants);
                }
                
                populateAppIdDropdown();
                populateCategories();
                
                // Enable buttons since we have merchants
                if (elements.startTestBtn) elements.startTestBtn.disabled = false;
                if (elements.saveToDbBtn) elements.saveToDbBtn.disabled = false;
                
                // Update merchant count display
                if (elements.merchantCountDisplay) {
                    elements.merchantCountDisplay.textContent = `${filteredMerchants.length} merchants`;
                }
                
                addLogEntry(`📦 Restored ${merchantsData.Merchants.length} permanently cached merchants`, 'success');
                showInfo(`Restored ${merchantsData.Merchants.length} merchants from permanent cache`);
                
                return true;
            } catch (uiError) {
                console.error('Failed to update UI with cached data:', uiError);
                clearMerchantsCache();
            }
        } else {
            console.log('🔍 No cached merchants found');
        }
    } catch (error) {
        console.warn('Failed to load cached merchants:', error);
        clearMerchantsCache();
    }
    
    return false;
}

function clearMerchantsCache() {
    try {
        localStorage.removeItem(CACHE_KEYS.MERCHANTS_DATA);
        localStorage.removeItem(CACHE_KEYS.FILTERED_MERCHANTS);
        localStorage.removeItem(CACHE_KEYS.LAST_FILTERS);
        localStorage.removeItem(CACHE_KEYS.LAST_LOAD_TIME);
        console.log('🗑️ Merchants cache cleared');
    } catch (error) {
        console.warn('Failed to clear merchants cache:', error);
    }
}

// Clear all merchants from UI and cache
function clearAllMerchants() {
    const confirmClear = confirm('Clear all loaded merchants?\n\nThis will remove all merchants from the interface. You can reload them from the database or paste new API data.');
    
    if (!confirmClear) {
        return;
    }
    
    try {
        // Clear all merchant data
        merchantsData = null;
        allMerchants = [];
        filteredMerchants = [];
        merchantStatuses.clear();
        
        // Clear UI
        elements.apiData.value = '';
        elements.merchantPreview.innerHTML = `
            <div class="preview-placeholder">
                <i class="fas fa-upload"></i>
                <p>Paste API data above to preview merchants</p>
            </div>
        `;
        elements.merchantCountDisplay.textContent = '0 merchants';
        
        // Reset filters
        if (elements.appIdFilter) elements.appIdFilter.value = '';
        if (elements.categoryFilter) elements.categoryFilter.value = '';
        if (elements.statusFilter) elements.statusFilter.value = '';
        if (elements.limitFilter) elements.limitFilter.value = '';
        if (elements.searchFilter) elements.searchFilter.value = '';
        if (elements.merchantSearch) elements.merchantSearch.value = '';
        
        // Disable buttons
        elements.startTestBtn.disabled = true;
        elements.saveToDbBtn.disabled = true;
        
        // Clear cache
        clearMerchantsCache();
        
        addLogEntry('🗑️ All merchants cleared from interface', 'info');
        showInfo('All merchants cleared. You can now load new merchants.');
        
    } catch (error) {
        console.error('Error clearing merchants:', error);
        addLogEntry(`Error clearing merchants: ${error.message}`, 'error');
        showError('Failed to clear merchants');
    }
}

// DOM elements
const elements = {
    apiData: document.getElementById('api-data'),
    apiUrl: document.getElementById('api-url'),
    fetchAllBtn: document.getElementById('fetch-all-btn'),
    testApiBtn: document.getElementById('test-api-btn'),
    fetchProgress: document.getElementById('fetch-progress'),
    fetchProgressFill: document.getElementById('fetch-progress-fill'),
    fetchStatus: document.getElementById('fetch-status'),
    appIdFilter: document.getElementById('app-id-filter'),
    categoryFilter: document.getElementById('category-filter'),
    merchantLimit: document.getElementById('merchant-limit'),
    testName: document.getElementById('test-name'),
    shuffleMerchants: document.getElementById('shuffle-merchants'),
    merchantPreview: document.getElementById('merchant-preview'),
    merchantSearch: document.getElementById('merchant-search'),
    statusFilter: document.getElementById('status-filter'),
    merchantCountDisplay: document.getElementById('merchant-count-display'),
    saveToDbBtn: document.getElementById('save-to-database-btn'),
    startTestBtn: document.getElementById('start-test-btn'),
    resetDatabaseBtn: document.getElementById('reset-database-btn'),
    loadStoredBtn: document.getElementById('load-stored-btn'),
    clearMerchantsBtn: document.getElementById('clear-merchants-btn'),
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
    clearTestBtn: document.getElementById('clear-test-btn'),
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
    startNewTestBtn: document.getElementById('start-new-test-btn'),
    
    // Queue elements
    queueSection: document.getElementById('queue-section'),
    queueList: document.getElementById('queue-list'),
    queueCount: document.getElementById('queue-count'),
    clearQueueBtn: document.getElementById('clear-queue-btn')
};

// Check for active test session on page load
async function checkForActiveTestSession() {
    try {
        const activeSessionId = localStorage.getItem('active_test_session');
        if (!activeSessionId) {
            return;
        }
        
        console.log('🔍 Found active test session:', activeSessionId);
        
        // Check if the session is still running
        const response = await fetch(`/api/sessions/${activeSessionId}`);
        if (response.ok) {
            const session = await response.json();
            
            // If the session is still running, resume monitoring
            if (session.status === 'running') {
                console.log('▶️ Resuming active test session...');
                
                // Set up the test session
                testSession = { session_id: session.session_id };
                
                // Show results section
                elements.resultsSection.style.display = 'block';
                
                // Load test results
                const resultsResponse = await fetch(`/api/merchant-results?session_id=${activeSessionId}&limit=10000`);
                if (resultsResponse.ok) {
                    const data = await resultsResponse.json();
                    const results = data.data || data;
                    
                    // Update UI with existing results
                    updateStatsFromResults(results);
                    updateResultsFromDatabase(results);
                    
                    // Show current merchant being tested
                    if (session.current_merchant) {
                        elements.currentMerchant.textContent = `Testing: ${session.current_merchant}`;
                        elements.currentUrl.textContent = session.current_url || 'Loading...';
                    } else {
                        elements.currentMerchant.textContent = 'Test in progress...';
                    }
                    
                    addLogEntry('🔄 Resumed monitoring active test session', 'success');
                    addLogEntry(`📊 Currently: ${results.length} merchants tested`, 'info');
                    
                    // Start polling for new results
                    pollForResults();
                }
            } else {
                // Session is completed or stopped
                console.log('✅ Session already completed:', session.status);
                localStorage.removeItem('active_test_session');
            }
        } else {
            // Session not found
            console.log('⚠️ Active session not found in database');
            localStorage.removeItem('active_test_session');
        }
    } catch (error) {
        console.error('❌ Error checking for active session:', error);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM Content Loaded - Initializing tester...');
    
    initializeEventListeners();
    generateDefaultTestName();
    
    // Clear any default values that might limit merchants
    elements.merchantLimit.value = '';
    
    // Check for active test session on page load
    checkForActiveTestSession();
    
    // Add a small delay to ensure all DOM elements are ready
    setTimeout(() => {
        console.log('⏰ Attempting to load cached merchants...');
        
        // Try to load merchants from cache first
        const cacheLoaded = loadMerchantsFromCache();
        
        // Populate dropdowns
        populateAppIdDropdown();
        
        // Only auto-load from database if cache wasn't loaded
        if (!cacheLoaded) {
            console.log('📥 No cache found, attempting to auto-load from database...');
            loadStoredMerchants(true).then(() => {
                console.log('✅ Auto-loaded merchants from database');
            }).catch(error => {
                console.log('ℹ️ No stored merchants available in database');
            });
        } else {
            console.log('✅ Cache loaded successfully');
        }
    }, 100); // Small delay to ensure DOM is fully ready
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
    elements.clearMerchantsBtn.addEventListener('click', clearAllMerchants);
    elements.resetDatabaseBtn.addEventListener('click', handleDatabaseReset);
    elements.fetchAllBtn.addEventListener('click', fetchAllPages);
    elements.testApiBtn.addEventListener('click', testApiEndpoint);
    elements.pauseTestBtn.addEventListener('click', pauseTest);
    elements.resumeTestBtn.addEventListener('click', resumeTest);
    elements.clearLogBtn.addEventListener('click', clearLog);
    elements.autoScrollBtn.addEventListener('click', toggleAutoScroll);
    
    // Queue events
    elements.clearQueueBtn.addEventListener('click', clearQueue);
    
    // Test control events
    elements.pauseTestBtn.addEventListener('click', pauseTest);
    elements.stopTestBtn.addEventListener('click', stopTest);
    elements.clearTestBtn.addEventListener('click', clearTest);
    elements.passCurrentBtn.addEventListener('click', passCurrentMerchant);
    
    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl+C to stop testing
        if (e.ctrlKey && e.key === 'c' && isTestRunning) {
            e.preventDefault();
            addLogEntry('⚠️ Ctrl+C detected - Stopping test...', 'warning');
            stopTest();
        }
        // Ctrl+Shift+C to clear log
        if (e.ctrlKey && e.shiftKey && e.key === 'C') {
            e.preventDefault();
            clearLog();
        }
    });
    
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

// Shuffle array using Fisher-Yates algorithm
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
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
        let pages;
        if (apiText.includes('---')) {
            pages = apiText.split(/---+/).map(page => page.trim()).filter(page => page.length > 0);
            addLogEntry(`🔍 Detected multi-page format with ${pages.length} pages`, 'info');
        } else {
            pages = [apiText];
            addLogEntry(`🔍 Detected single-page format`, 'info');
        }
        
        // Debug: Show first few characters of each page
        pages.forEach((page, index) => {
            const preview = page.substring(0, 100).replace(/\s+/g, ' ');
            addLogEntry(`📄 Page ${index + 1} preview: ${preview}...`, 'info');
        });
        
        addLogEntry(`📄 Processing ${pages.length} page(s) of data...`, 'info');
        
        // Check for large datasets
        if (pages.length > 10) {
            addLogEntry(`⚠️ Large dataset detected (${pages.length} pages) - this may take a moment...`, 'warning');
        }
        
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
                
                addLogEntry(`✅ Page ${i + 1}: ${pageData.Merchants.length} merchants processed (total so far: ${allMerchants.length})`, 'success');
                
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
        
        // Debug logging
        console.log(`Multi-page processing complete:`, {
            totalPages: pages.length,
            totalMerchants: allMerchants.length,
            merchantsDataLength: merchantsData.Merchants.length
        });
        
        addLogEntry(`🔍 DEBUG: Processed ${pages.length} pages, found ${allMerchants.length} total merchants`, 'info');
        
        // Auto-detect and set AppID if available
        autoDetectAppId(allMerchants);
        
        populateCategories();
        
        // Debug logging
        console.log('About to call applyFiltersAndPreview with merchantsData:', merchantsData);
        console.log('merchantsData.Merchants length:', merchantsData.Merchants.length);
        
        applyFiltersAndPreview();
        elements.startTestBtn.disabled = false;
        elements.saveToDbBtn.disabled = false;
        
        // Additional debug
        console.log('After applyFiltersAndPreview, filteredMerchants length:', filteredMerchants.length);
        
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
        
        // Save to cache for persistence across navigation
        saveMerchantsToCache();
        
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
    console.log('applyFiltersAndPreview called, merchantsData:', merchantsData);
    
    if (!merchantsData) {
        console.log('No merchantsData available');
        return;
    }
    
    console.log('merchantsData.Merchants length:', merchantsData.Merchants.length);
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
    
    // Debug logging
    console.log(`Merchant limit debug:`, {
        limitValue: limitValue,
        limit: limit,
        merchantsBeforeLimit: merchants.length,
        totalMerchants: merchantsData.Merchants.length
    });
    
    addLogEntry(`🔍 FILTER DEBUG: ${merchants.length} merchants after filters (from ${merchantsData.Merchants.length} total)`, 'info');
    
    if (limit && limit > 0) {
        console.log(`Applying merchant limit: ${limit} (from ${merchants.length} merchants)`);
        merchants = merchants.slice(0, limit);
        addLogEntry(`📊 Applied limit: showing ${limit} of ${merchantsData.Merchants.length} total merchants`, 'info');
    } else {
        console.log(`No limit applied, showing all ${merchants.length} merchants`);
        addLogEntry(`📊 Showing all ${merchants.length} merchants (no limit applied)`, 'info');
    }
    
    filteredMerchants = merchants;
    allMerchants = merchants; // Update allMerchants for filtering
    
    console.log('🔄 applyFiltersAndPreview updating UI:', {
        merchantCount: merchants.length,
        filteredMerchantsLength: filteredMerchants.length,
        allMerchantsLength: allMerchants.length
    });
    
    displayMerchantList(merchants);
    elements.merchantCountDisplay.textContent = `${merchants.length} merchants`;
    
    // Save to cache when filters are applied (only if we have merchant data)
    if (merchantsData && merchantsData.Merchants && merchantsData.Merchants.length > 0) {
        console.log('💾 Saving to cache from applyFiltersAndPreview');
        saveMerchantsToCache();
    }
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
    
    // Prepare merchants list - priority queue first, then others
    let merchantsToTest = [];
    
    if (priorityQueue.length > 0) {
        addLogEntry(`🎯 Priority Queue: Testing ${priorityQueue.length} queued merchants first`, 'success');
        merchantsToTest = [...priorityQueue];
        
        // Add remaining merchants not in queue
        const queueIds = new Set(priorityQueue.map(m => m.MerchantID || m.MerchantName));
        const remainingMerchants = filteredMerchants.filter(m => 
            !queueIds.has(m.MerchantID || m.MerchantName)
        );
        
        // Shuffle remaining if option is enabled
        if (elements.shuffleMerchants.checked && remainingMerchants.length > 0) {
            addLogEntry('🔀 Remaining merchants shuffled', 'info');
            merchantsToTest = [...merchantsToTest, ...shuffleArray(remainingMerchants)];
        } else {
            merchantsToTest = [...merchantsToTest, ...remainingMerchants];
        }
    } else {
        // No queue - use normal flow
        merchantsToTest = [...filteredMerchants];
        if (elements.shuffleMerchants.checked) {
            merchantsToTest = shuffleArray(merchantsToTest);
            addLogEntry('🔀 Merchants shuffled for random testing order', 'info');
        } else {
            addLogEntry('📋 Testing merchants in original order', 'info');
        }
    }
    
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
    isTestRunning = true;
    runTest(merchantsToTest);
}

// Run the test
async function runTest(merchantsToTest = filteredMerchants) {
    testStartTime = Date.now();
    updateStats();
    clearResultsLists();
    clearLog();
    
    addLogEntry(`Starting test with ${merchantsToTest.length} merchants`, 'info');
    
    try {
        // Trigger the actual Playwright test
        addLogEntry('Sending test request to server...', 'info');
        
        const response = await fetch('/api/start-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                merchants: merchantsToTest,
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
    const pollInterval = 1000; // Poll every second for faster updates
    let lastResultCount = 0;
    let lastCurrentMerchant = '';
    let logPosition = 0; // Track log file position
    
    // Save active session to localStorage for persistence
    localStorage.setItem('active_test_session', testSession.session_id);
    
    const poll = async () => {
        try {
            // Poll for logs first (faster/more responsive)
            try {
                const logResponse = await fetch(`/api/sessions/${testSession.session_id}/logs?since=${logPosition}`);
                if (logResponse.ok) {
                    const logData = await logResponse.json();
                    if (logData.logs && logData.logs.length > 0) {
                        // Parse and display logs
                        const logLines = logData.logs.split('\n').filter(line => line.trim());
                        logLines.forEach(line => {
                            // Determine log type from content
                            let type = 'info';
                            if (line.includes('✅') || line.includes('SUCCESS')) type = 'success';
                            else if (line.includes('❌') || line.includes('ERROR') || line.includes('🚨') || line.includes('FLAGGED')) type = 'error';
                            else if (line.includes('⚠️') || line.includes('WARNING')) type = 'warning';
                            
                            addLogEntry(line.trim(), type);
                        });
                        logPosition = logData.position;
                    }
                }
            } catch (logError) {
                // Log errors are non-fatal, continue polling
            }
            
            // Get current test session status
            const sessionResponse = await fetch(`/api/sessions/${testSession.session_id}`);
            if (sessionResponse.ok) {
                const currentSession = await sessionResponse.json();
                
                // Update current merchant being tested
                if (currentSession.current_merchant && currentSession.current_merchant !== lastCurrentMerchant) {
                    lastCurrentMerchant = currentSession.current_merchant;
                    elements.currentMerchant.textContent = `Testing: ${currentSession.current_merchant}`;
                    elements.currentUrl.textContent = currentSession.current_url || 'Loading...';
                }
                
                // Check if test was marked as completed or stopped
                if (currentSession.status === 'completed' || currentSession.status === 'stopped') {
                    addLogEntry(`Test ${currentSession.status}`, 'info');
                    completeTest();
                    localStorage.removeItem('active_test_session');
                    return;
                }
            }
            
            // Get test results
            const response = await fetch(`/api/merchant-results?session_id=${testSession.session_id}&limit=10000`);
            if (response.ok) {
                const data = await response.json();
                const results = data.data || data;
                
                // Update stats and display if we have new results
                if (results.length > lastResultCount) {
                    updateStatsFromResults(results);
                    updateResultsFromDatabase(results);
                    lastResultCount = results.length;
                    
                    // Enhanced progress logging with percentage
                    const totalMerchants = filteredMerchants.length || results.length;
                    const progress = Math.round((results.length / totalMerchants) * 100);
                    addLogEntry(`📊 Progress: ${results.length}/${totalMerchants} merchants tested (${progress}%)`, 'info');
                    
                    // Show milestone messages
                    if (results.length % 10 === 0 && results.length > 0) {
                        const successful = results.filter(r => r.test_status === 'success' || r.is_user_passed).length;
                        const successRate = Math.round((successful / results.length) * 100);
                        addLogEntry(`🎯 Milestone: ${results.length} merchants completed! Success rate: ${successRate}%`, 'success');
                    }
                }
                
                // Check if test is complete
                const expectedTotal = filteredMerchants.length || 1;
                if (results.length >= expectedTotal && expectedTotal > 0) {
                    const successful = results.filter(r => r.test_status === 'success' || r.is_user_passed).length;
                    const successRate = Math.round((successful / results.length) * 100);
                    addLogEntry(`🎉 Test completed successfully! Final results: ${successful}/${results.length} successful (${successRate}%)`, 'success');
                    localStorage.removeItem('active_test_session');
                    completeTest();
                    return;
                }
                
                // Continue polling
                setTimeout(poll, pollInterval);
            }
        } catch (error) {
            console.error('Error polling results:', error);
            addLogEntry(`⚠️ Polling error: ${error.message}`, 'warning');
            // Keep polling even on error
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
            MerchantDomains: [result.merchant_url?.replace('https://', '') || ''],
            MerchantID: result.merchant_id
        };
        
        const testResult = {
            status: result.is_user_passed ? 'success' : result.test_status,
            reason: result.test_result || 'No reason provided',
            screenshot_path: result.screenshot_path,
            video_path: result.video_path
        };
        
        // Update merchant status in Map
        if (result.merchant_id) {
            merchantStatuses.set(result.merchant_id, testResult.status);
        }
        
        addResultToList(merchant, testResult);
    });
    
    // Refresh merchant display to show updated statuses
    if (typeof displayMerchantList === 'function' && filteredMerchants.length > 0) {
        displayMerchantList(filteredMerchants);
    }
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
    // Create media icons if available
    let mediaIcons = '';
    if (result.screenshot_path) {
        mediaIcons += `<i class="fas fa-camera media-icon screenshot-icon" title="View Screenshot" onclick="showMedia('${result.screenshot_path}', 'image')"></i>`;
    }
    if (result.video_path) {
        mediaIcons += `<i class="fas fa-video media-icon video-icon" title="View Video" onclick="showMedia('${result.video_path}', 'video')"></i>`;
    }
    
    const resultHtml = `
        <div class="result-item ${result.status}">
            <div class="result-header">
                <div class="result-name">${escapeHtml(merchant.MerchantName)}</div>
                <div class="result-actions">
                    ${mediaIcons}
                    <div class="result-status ${result.status}">${result.status}</div>
                </div>
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

// Show media file in modal
function showMedia(mediaPath, mediaType) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('media-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'media-modal';
        modal.className = 'media-modal';
        modal.innerHTML = `
            <div class="media-modal-content">
                <span class="media-modal-close">&times;</span>
                <div class="media-container" id="media-container"></div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Add close functionality
        modal.querySelector('.media-modal-close').onclick = () => {
            modal.style.display = 'none';
        };
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        };
    }
    
    // Set media content
    const container = modal.querySelector('#media-container');
    if (mediaType === 'image') {
        container.innerHTML = `<img src="/${mediaPath}" alt="Screenshot" style="max-width: 100%; max-height: 80vh;">`;
    } else if (mediaType === 'video') {
        container.innerHTML = `<video controls style="max-width: 100%; max-height: 80vh;"><source src="/${mediaPath}" type="video/webm"></video>`;
    }
    
    // Show modal
    modal.style.display = 'block';
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
    elements.finalTotal.textContent = testResults.current; // Use actual tested count
    elements.finalSuccessful.textContent = testResults.successful;
    elements.finalFlagged.textContent = testResults.flagged;
    
    // Show completion section
    elements.completionSection.style.display = 'block';
    elements.completionSection.scrollIntoView({ behavior: 'smooth' });
    
    showSuccess('Test completed successfully!');
}

// Control functions
function stopTest() {
    // In real implementation, this would stop the Playwright test
    completeTest();
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
    // Remove any existing notifications of the same type to prevent overlap
    const existingNotifications = document.querySelectorAll(`.notification.${type}`);
    existingNotifications.forEach(notification => {
        notification.style.animation = 'slideOut 0.2s ease-in forwards';
        setTimeout(() => notification.remove(), 200);
    });
    
    // Calculate position based on existing notifications
    const allNotifications = document.querySelectorAll('.notification');
    const topPosition = 20 + (allNotifications.length * 80); // Stack notifications 80px apart
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: ${topPosition}px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 12px;
        color: white;
        font-weight: 600;
        z-index: ${10000 + allNotifications.length};
        max-width: 450px;
        box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        animation: slideIn 0.4s ease-out;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255,255,255,0.2);
        font-size: 0.95rem;
        line-height: 1.4;
    `;
    
    if (type === 'success') {
        notification.style.background = 'linear-gradient(135deg, #10b981, #059669)';
    } else if (type === 'error') {
        notification.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
    } else if (type === 'warning') {
        notification.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
    } else {
        notification.style.background = 'linear-gradient(135deg, #3b82f6, #2563eb)';
    }
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fas ${getNotificationIcon(type)}" style="font-size: 1.1em;"></i>
            <span style="flex: 1;">${message}</span>
            <button onclick="this.closest('.notification').remove()" style="
                background: none; 
                border: none; 
                color: white; 
                cursor: pointer; 
                padding: 0; 
                margin-left: 10px;
                opacity: 0.7;
                transition: opacity 0.2s;
            " onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOut 0.3s ease-in forwards';
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 300);
        }
    }, 4000);
}

function getNotificationIcon(type) {
    switch (type) {
        case 'success': return 'fa-check-circle';
        case 'error': return 'fa-exclamation-circle';
        case 'warning': return 'fa-exclamation-triangle';
        case 'info': return 'fa-info-circle';
        default: return 'fa-info-circle';
    }
}

// Add CSS for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { 
            transform: translateX(100%) scale(0.9); 
            opacity: 0; 
        }
        to { 
            transform: translateX(0) scale(1); 
            opacity: 1; 
        }
    }
    @keyframes slideOut {
        from { 
            transform: translateX(0) scale(1); 
            opacity: 1; 
        }
        to { 
            transform: translateX(100%) scale(0.9); 
            opacity: 0; 
        }
    }
    
    .notification {
        transition: all 0.3s ease;
    }
    
    .notification:hover {
        transform: scale(1.02);
        box-shadow: 0 12px 35px rgba(0,0,0,0.2) !important;
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
// Function removed - now using full loadStoredMerchants() for auto-loading

async function loadStoredMerchants(isAutoLoad = false) {
    try {
        if (!isAutoLoad) {
            addLogEntry('Loading stored merchants from database...', 'info');
        }
        
        const response = await fetch('/api/stored-merchants');
        if (!response.ok) {
            throw new Error('Failed to load stored merchants');
        }
        
        const data = await response.json();
        
        if (data.merchants && data.merchants.length > 0) {
            // Directly set merchantsData instead of going through JSON string conversion
            merchantsData = {
                Merchants: data.merchants,
                PageCount: 1,
                PageSize: data.merchants.length,
                TotalCount: data.merchants.length
            };
            
            console.log('Loaded merchantsData:', merchantsData);
            
            // Auto-detect and set AppID
            autoDetectAppId(data.merchants);
            
            // Populate categories
            populateCategories();
            
            // Apply filters and display merchants
            applyFiltersAndPreview();
            
            // Force update the merchant preview display
            if (elements.merchantPreview && filteredMerchants.length > 0) {
                displayMerchantList(filteredMerchants);
            }
            
            // Enable buttons
            elements.startTestBtn.disabled = false;
            elements.saveToDbBtn.disabled = false;
            
            if (!isAutoLoad) {
                addLogEntry(`Loaded ${data.merchants.length} stored merchants`, 'success');
                showSuccess(`Loaded ${data.merchants.length} stored merchants from database`);
            } else {
                console.log(`✅ Auto-loaded ${data.merchants.length} stored merchants from database`);
            }
            
            // Save to cache for persistence across navigation
            saveMerchantsToCache();
        } else {
            if (!isAutoLoad) {
                addLogEntry('No stored merchants found in database', 'warning');
                showInfo('No stored merchants found. Please paste API data first.');
            }
        }
    } catch (error) {
        console.error('Error loading stored merchants:', error);
        if (!isAutoLoad) {
            addLogEntry(`Error loading stored merchants: ${error.message}`, 'error');
            showError('Failed to load stored merchants');
        }
        throw error; // Re-throw for the calling code to handle
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
    if (!elements.merchantPreview) {
        console.error('merchantPreview element not found');
        return;
    }
    
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
        merchantItem.className = 'merchant-item merchant-card';
        merchantItem.dataset.merchantId = merchant.MerchantID || '';
        merchantItem.dataset.merchantName = merchant.MerchantName;
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
    
    console.log('About to update merchantPreview with', merchants.length, 'merchants');
    elements.merchantPreview.innerHTML = '';
    elements.merchantPreview.appendChild(merchantList);
    console.log('merchantPreview updated, innerHTML length:', elements.merchantPreview.innerHTML.length);
    
    // Update queue buttons after rendering
    if (typeof updateMerchantCards === 'function') {
        updateMerchantCards();
    }
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
            
            // Clear cached merchants
            clearMerchantsCache();
            
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

// Bulk API Fetching Functions
// Smart URL correction function
function suggestUrlCorrection(url) {
    const suggestions = [];
    
    // Check for common page parameter patterns
    const pagePatterns = [
        { pattern: /pageNumber=\d+/i, replacement: 'pageNumber={page}', description: 'Replace pageNumber=1 with pageNumber={page}' },
        { pattern: /page=\d+/i, replacement: 'page={page}', description: 'Replace page=1 with page={page}' },
        { pattern: /pageNum=\d+/i, replacement: 'pageNum={page}', description: 'Replace pageNum=1 with pageNum={page}' },
        { pattern: /p=\d+/i, replacement: 'p={page}', description: 'Replace p=1 with p={page}' },
        { pattern: /offset=\d+/i, replacement: 'offset={offset}', description: 'Replace offset=0 with offset={offset} (calculated automatically)' }
    ];
    
    for (const { pattern, replacement, description } of pagePatterns) {
        if (pattern.test(url)) {
            const correctedUrl = url.replace(pattern, replacement);
            suggestions.push({
                original: url.match(pattern)[0],
                corrected: replacement,
                fullUrl: correctedUrl,
                description: description
            });
        }
    }
    
    // Check for missing protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        suggestions.push({
            original: url,
            corrected: `https://${url}`,
            fullUrl: `https://${url}`,
            description: 'Add HTTPS protocol'
        });
    }
    
    return suggestions;
}

// Extract App ID from API URL
function extractAppIdFromUrl(url) {
    // Look for patterns like /merchant/451/ or /merchant/451?
    const match = url.match(/\/merchant\/(\d+)[\/\?]/);
    return match ? match[1] : null;
}

async function testApiEndpoint() {
    const apiUrl = elements.apiUrl.value.trim();
    
    if (!apiUrl) {
        showError('Please enter an API URL first');
        return;
    }
    
    // Auto-detect App ID from URL
    const detectedAppId = extractAppIdFromUrl(apiUrl);
    if (detectedAppId) {
        elements.appIdFilter.value = detectedAppId;
        addLogEntry(`🔍 Auto-detected App ID: ${detectedAppId}`, 'info');
    }
    
    // Smart URL correction suggestions
    if (!apiUrl.includes('{page}') && !apiUrl.includes('{offset}')) {
        const suggestions = suggestUrlCorrection(apiUrl);
        
        if (suggestions.length > 0) {
            const suggestion = suggestions[0]; // Use the first suggestion
            const userConfirm = window.confirm(
                `🔧 URL Correction Suggested:\n\n` +
                `Current: ${suggestion.original}\n` +
                `Suggested: ${suggestion.corrected}\n\n` +
                `${suggestion.description}\n\n` +
                `Apply this correction automatically?`
            );
            
            if (userConfirm) {
                elements.apiUrl.value = suggestion.fullUrl;
                addLogEntry(`🔧 Auto-corrected URL: ${suggestion.description}`, 'success');
                showSuccess(`URL corrected! ${suggestion.description}`);
            } else {
                showError('API URL must include {page} placeholder for bulk fetching');
                return;
            }
        } else {
            showError('API URL must include {page} placeholder (e.g., pageNumber={page})');
            return;
        }
    }
    
    elements.testApiBtn.disabled = true;
    elements.testApiBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';
    
    try {
        addLogEntry('🧪 Testing API endpoint (page 1)...', 'info');
        
        const testUrl = apiUrl.replace('{page}', '1');
        const response = await fetch(testUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Validate response structure
        if (!data.Merchants || !Array.isArray(data.Merchants)) {
            throw new Error('Invalid response: Missing "Merchants" array');
        }
        
        const totalCount = data.TotalCount || data.Merchants.length;
        const pageSize = data.PageSize || data.Merchants.length;
        const estimatedPages = Math.ceil(totalCount / pageSize);
        
        addLogEntry(`✅ API test successful!`, 'success');
        addLogEntry(`📊 Found ${data.Merchants.length} merchants on page 1`, 'info');
        addLogEntry(`📈 Estimated ${estimatedPages} total pages (${totalCount} merchants)`, 'info');
        
        showSuccess(`API test successful! Found ${totalCount} total merchants across ~${estimatedPages} pages`);
        
        // Show sample merchant
        if (data.Merchants.length > 0) {
            const sample = data.Merchants[0];
            addLogEntry(`📋 Sample merchant: ${sample.MerchantName} (${sample.MerchantDomains?.[0] || 'No domain'})`, 'info');
        }
        
    } catch (error) {
        console.error('API test failed:', error);
        addLogEntry(`❌ API test failed: ${error.message}`, 'error');
        showError(`API test failed: ${error.message}`);
    } finally {
        elements.testApiBtn.disabled = false;
        elements.testApiBtn.innerHTML = '<i class="fas fa-flask"></i> Test API (Page 1)';
    }
}

async function fetchAllPages() {
    const apiUrl = elements.apiUrl.value.trim();
    
    if (!apiUrl) {
        showError('Please enter an API URL first');
        return;
    }
    
    // Auto-detect App ID from URL
    const detectedAppId = extractAppIdFromUrl(apiUrl);
    if (detectedAppId) {
        elements.appIdFilter.value = detectedAppId;
        addLogEntry(`🔍 Auto-detected App ID from URL: ${detectedAppId}`, 'info');
    }
    
    if (!apiUrl.includes('{page}')) {
        showError('API URL must include {page} placeholder');
        return;
    }
    
    // Disable buttons during fetch
    elements.fetchAllBtn.disabled = true;
    elements.testApiBtn.disabled = true;
    elements.fetchAllBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Fetching...';
    
    // Show progress
    elements.fetchProgress.style.display = 'block';
    elements.fetchProgressFill.style.width = '0%';
    elements.fetchStatus.textContent = 'Starting bulk fetch...';
    
    try {
        addLogEntry('🚀 Starting bulk API fetch...', 'info');
        
        // First, get page 1 to determine total pages
        const firstPageUrl = apiUrl.replace('{page}', '1');
        const firstResponse = await fetch(firstPageUrl);
        
        if (!firstResponse.ok) {
            throw new Error(`HTTP ${firstResponse.status}: ${firstResponse.statusText}`);
        }
        
        const firstPageData = await firstResponse.json();
        
        if (!firstPageData.Merchants || !Array.isArray(firstPageData.Merchants)) {
            throw new Error('Invalid response: Missing "Merchants" array');
        }
        
        const totalCount = firstPageData.TotalCount || firstPageData.Merchants.length;
        const pageSize = firstPageData.PageSize || firstPageData.Merchants.length;
        const totalPages = Math.ceil(totalCount / pageSize);
        
        addLogEntry(`📊 Detected ${totalPages} pages with ${totalCount} total merchants`, 'info');
        
        if (totalPages > 500) {
            const confirm = window.confirm(`This will fetch ${totalPages} pages (${totalCount} merchants). This may take several minutes. Continue?`);
            if (!confirm) {
                throw new Error('Fetch cancelled by user');
            }
        }
        
        // Collect all pages
        const allPages = [JSON.stringify(firstPageData)];
        let fetchedCount = firstPageData.Merchants.length;
        
        // Update progress
        elements.fetchProgressFill.style.width = `${(1 / totalPages) * 100}%`;
        elements.fetchStatus.textContent = `Fetched page 1 of ${totalPages} (${fetchedCount} merchants)`;
        
        // Fetch remaining pages in batches to avoid overwhelming the server
        const batchSize = 5; // Fetch 5 pages at a time
        
        for (let startPage = 2; startPage <= totalPages; startPage += batchSize) {
            const endPage = Math.min(startPage + batchSize - 1, totalPages);
            const batchPromises = [];
            
            // Create batch of requests
            for (let page = startPage; page <= endPage; page++) {
                const pageUrl = apiUrl.replace('{page}', page.toString());
                batchPromises.push(
                    fetch(pageUrl)
                        .then(response => {
                            if (!response.ok) {
                                throw new Error(`Page ${page}: HTTP ${response.status}`);
                            }
                            return response.text(); // Get as text first
                        })
                        .then(text => {
                            try {
                                const data = JSON.parse(text);
                                return { page, data, success: true };
                            } catch (jsonError) {
                                console.error(`Page ${page} JSON parse error:`, jsonError);
                                addLogEntry(`⚠️ Page ${page}: JSON parse error - skipped`, 'warning');
                                return { page, data: null, success: false, error: jsonError.message };
                            }
                        })
                        .catch(error => {
                            console.error(`Page ${page} fetch error:`, error);
                            addLogEntry(`❌ Page ${page}: Fetch failed - skipped`, 'error');
                            return { page, data: null, success: false, error: error.message };
                        })
                );
            }
            
            // Wait for batch to complete
            const batchResults = await Promise.all(batchPromises);
            
            // Process batch results
            for (const result of batchResults) {
                const { page, data, success } = result;
                
                if (!success || !data) {
                    // Skip failed pages
                    continue;
                }
                
                if (!data.Merchants || !Array.isArray(data.Merchants)) {
                    addLogEntry(`⚠️ Page ${page}: Invalid response format - skipped`, 'warning');
                    continue;
                }
                
                allPages.push(JSON.stringify(data));
                fetchedCount += data.Merchants.length;
                
                // Update progress
                const progress = (page / totalPages) * 100;
                elements.fetchProgressFill.style.width = `${progress}%`;
                elements.fetchStatus.textContent = `Fetched page ${page} of ${totalPages} (${fetchedCount} merchants)`;
                
                addLogEntry(`✅ Page ${page}: ${data.Merchants.length} merchants fetched (total: ${fetchedCount})`, 'success');
            }
            
            // Small delay between batches to be nice to the server
            if (endPage < totalPages) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        // Combine all pages with --- separator
        const combinedData = allPages.join('\n---\n');
        
        // Don't put the raw data in the textarea - process it directly
        addLogEntry('🔄 Processing fetched data...', 'info');
        
        // Process the combined data directly without using the textarea
        try {
            // Parse all pages and combine merchants
            const allMerchants = [];
            let totalCount = 0;
            let pageSize = 50;
            
            for (const pageJson of allPages) {
                const pageData = JSON.parse(pageJson);
                if (pageData.Merchants && Array.isArray(pageData.Merchants)) {
                    allMerchants.push(...pageData.Merchants);
                    if (totalCount === 0) {
                        totalCount = pageData.TotalCount || pageData.Merchants.length;
                        pageSize = pageData.PageSize || 50;
                    }
                }
            }
            
            // Create merchantsData directly
            merchantsData = {
                Merchants: allMerchants,
                PageCount: 1,
                PageSize: allMerchants.length,
                TotalCount: allMerchants.length
            };
            
            console.log('Direct processing - merchantsData:', merchantsData);
            
            // Auto-detect and set AppID
            autoDetectAppId(allMerchants);
            
            // Populate categories
            populateCategories();
            
            // Apply filters and display merchants
            applyFiltersAndPreview();
            
            // Enable buttons
            elements.startTestBtn.disabled = false;
            elements.saveToDbBtn.disabled = false;
            elements.saveToDbBtn.style.display = 'inline-flex';
            
            // Save to cache for persistence across navigation
            saveMerchantsToCache();
            
            // Highlight the save button temporarily
            elements.saveToDbBtn.style.animation = 'pulse 2s infinite';
            setTimeout(() => {
                elements.saveToDbBtn.style.animation = '';
            }, 6000);
            
            addLogEntry(`✅ Successfully processed ${allMerchants.length} merchants for testing`, 'success');
            showSuccess(`🎉 ${allMerchants.length} merchants loaded and ready! Click "Save to Database" to store them.`);
            addLogEntry(`💾 Click "Save to Database" button to store these ${allMerchants.length} merchants`, 'info');
            
        } catch (processingError) {
            console.error('Error processing fetched data:', processingError);
            addLogEntry(`❌ Error processing fetched data: ${processingError.message}`, 'error');
            showError(`Failed to process fetched data: ${processingError.message}`);
        }
        
        elements.fetchStatus.textContent = `✅ Completed! Fetched ${fetchedCount} merchants from ${totalPages} pages`;
        addLogEntry(`🎉 Bulk fetch completed! ${fetchedCount} merchants from ${totalPages} pages`, 'success');
        showSuccess(`Successfully fetched ${fetchedCount} merchants from ${totalPages} pages!`);
        
    } catch (error) {
        console.error('Bulk fetch failed:', error);
        addLogEntry(`❌ Bulk fetch failed: ${error.message}`, 'error');
        showError(`Bulk fetch failed: ${error.message}`);
        elements.fetchStatus.textContent = `❌ Failed: ${error.message}`;
    } finally {
        // Re-enable buttons
        elements.fetchAllBtn.disabled = false;
        elements.testApiBtn.disabled = false;
        elements.fetchAllBtn.innerHTML = '<i class="fas fa-download"></i> Fetch All Pages';
        
        // Hide progress after a delay
        setTimeout(() => {
            elements.fetchProgress.style.display = 'none';
        }, 3000);
    }
}

// Test control functions
let testProcess = null;
let isTestRunning = false;

async function stopTest() {
    if (!isTestRunning) {
        showError('No test is currently running');
        return;
    }
    
    try {
        addLogEntry('🛑 Stopping test...', 'warning');
        showWarning('Stopping test - this may take a moment...');
        
        // Try to stop the Playwright process
        const response = await fetch('/api/stop-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: testSession?.session_id })
        });
        
        if (response.ok) {
            addLogEntry('✅ Test stopped successfully', 'success');
            showSuccess('Test stopped successfully');
        } else {
            addLogEntry('⚠️ Test stop request sent, but server response was not OK', 'warning');
        }
        
        isTestRunning = false;
        completeTest();
        
    } catch (error) {
        console.error('Error stopping test:', error);
        addLogEntry(`❌ Error stopping test: ${error.message}`, 'error');
        showError('Error stopping test: ' + error.message);
    }
}

// Clear test and reset everything
function clearTest() {
    if (isTestRunning) {
        if (!confirm('Test is currently running. Stop and clear?')) {
            return;
        }
        stopTest();
    }
    
    // Reset all state
    testResults = {
        total: 0,
        successful: 0,
        flagged: 0,
        current: 0
    };
    testSession = null;
    isTestRunning = false;
    
    // Clear UI
    elements.currentMerchant.textContent = 'No test running';
    elements.currentUrl.textContent = '';
    elements.progressFill.style.width = '0%';
    
    // Reset stats
    elements.totalTested.textContent = '0';
    elements.successfulCount.textContent = '0';
    elements.flaggedCount.textContent = '0';
    
    // Clear result lists
    clearResultsLists();
    
    // Clear log
    clearLog();
    
    // Hide results section
    elements.resultsSection.style.display = 'none';
    
    // Clear localStorage
    localStorage.removeItem('active_test_session');
    
    addLogEntry('🔄 Test cleared - ready to start new test', 'success');
    showSuccess('Test cleared successfully');
}
