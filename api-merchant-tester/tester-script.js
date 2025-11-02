// Global state
let merchantsData = null;
let allMerchants = [];
let filteredMerchants = [];
let priorityQueue = []; // Priority queue for merchants to test first
let merchantStatuses = new Map(); // Track merchant test statuses
let merchantScreenshots = new Map(); // Track merchant screenshot paths
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
let selectedResultIndex = -1; // For arrow navigation in test results
let selectedMerchantIndex = -1; // For arrow navigation in merchant preview

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
        // elements.apiData.value = ''; // Removed - element no longer exists
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
    // apiData: document.getElementById('api-data'), // Removed - no longer needed
    apiUrl: document.getElementById('api-url'),
    fetchAllBtn: document.getElementById('fetch-all-btn'),
    fetchCloudStorageBtn: document.getElementById('fetch-cloud-storage-btn'),
    // testApiBtn: document.getElementById('test-api-btn'), // REMOVED - button no longer in HTML
    fetchProgress: document.getElementById('fetch-progress'),
    fetchProgressFill: document.getElementById('fetch-progress-fill'),
    fetchStatus: document.getElementById('fetch-status'),
    appIdFilter: document.getElementById('app-id-filter'),
    categoryFilter: document.getElementById('category-filter'),
    merchantLimit: document.getElementById('merchant-limit'),
    testerName: document.getElementById('tester-name'),
    // testName: document.getElementById('test-name'), // REMOVED - element no longer in HTML
    shuffleMerchants: document.getElementById('shuffle-merchants'),
    merchantPreview: document.getElementById('merchant-preview'),
    merchantSearch: document.getElementById('merchant-search'),
    statusFilter: document.getElementById('status-filter'),
    merchantCountDisplay: document.getElementById('merchant-count-display'),
    saveToDbBtn: document.getElementById('save-to-database-btn'),
    startTestBtn: document.getElementById('start-test-btn'),
    resetDatabaseBtn: document.getElementById('reset-database-btn'),
    loadStoredBtn: document.getElementById('load-stored-btn'),
    // clearMerchantsBtn: document.getElementById('clear-merchants-btn'), // Removed - button no longer exists
    pauseTestBtn: document.getElementById('pause-test-btn'),
    resumeTestBtn: document.getElementById('resume-test-btn'),
    logContainer: document.getElementById('log-container'),
    clearLogBtn: document.getElementById('clear-log-btn'),
    autoScrollBtn: document.getElementById('auto-scroll-btn'),
    setupSection: document.getElementById('setup-section'),
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
    restartTestBtn: document.getElementById('restart-test-btn'),
    // passCurrentBtn: document.getElementById('pass-current-btn'), // REMOVED - button no longer in HTML
    
    // Results tabs and lists
    successfulList: document.getElementById('successful-list'),
    flaggedList: document.getElementById('flagged-list'),
    allList: document.getElementById('all-list'),
    successfulTabCount: document.getElementById('successful-tab-count'),
    flaggedTabCount: document.getElementById('flagged-tab-count'),
    allTabCount: document.getElementById('all-tab-count'),
    resultsSearchInput: document.getElementById('results-search-input'),
    resultsSearchCount: document.getElementById('results-search-count'),
    
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
        console.log('🔍 [Session Check] Starting session restoration check...');
        
        const activeSessionData = localStorage.getItem('active_test_session');
        if (!activeSessionData) {
            console.log('ℹ️ [Session Check] No active test session found in localStorage');
            return false;
        }
        
        console.log('🔍 [Session Check] Found session data in localStorage:', activeSessionData);
        
        // Parse the session data
        let sessionId;
        try {
            const parsed = JSON.parse(activeSessionData);
            sessionId = parsed.sessionId || parsed;
            console.log('✓ [Session Check] Parsed session ID:', sessionId);
        } catch (e) {
            // Old format - just a string session ID
            sessionId = activeSessionData;
            console.log('✓ [Session Check] Using plain string session ID:', sessionId);
        }
        
        console.log('🔍 [Session Check] Fetching session from database:', sessionId);
        
        // Check if the session is still running
        const response = await fetch(`/api/sessions/${sessionId}`);
        if (!response.ok) {
            console.log('⚠️ [Session Check] Active session not found in database (HTTP', response.status, ')');
            localStorage.removeItem('active_test_session');
            return false;
        }
        
        const session = await response.json();
        console.log('📋 [Session Check] Session found! Status:', session.status);
        console.log('📋 [Session Check] Full session data:', session);
        
        // If the session is still running or paused, resume monitoring
        if (session.status === 'running' || session.status === 'paused') {
            console.log(`▶️ [Session Check] Resuming ${session.status} test session...`);
            
            // Set up the test session and mark as running FIRST
            testSession = { session_id: session.session_id };
            isTestRunning = true;
            
            console.log('✓ [Session Check] Set isTestRunning =', isTestRunning);
            console.log('✓ [Session Check] Set testSession =', testSession);
            
            // Hide setup section and show results section for active tests
            elements.setupSection.style.display = 'none';
            elements.resultsSection.style.display = 'block';
            
            console.log('✓ UI sections updated (setup hidden, results shown for active test)');
            
            // Load test results using the parsed sessionId
            const resultsResponse = await fetch(`/api/merchant-results?session_id=${sessionId}&limit=10000`);
            if (resultsResponse.ok) {
                const data = await resultsResponse.json();
                const results = data.data || data;
                
                console.log(`✓ Loaded ${results.length} existing test results`);
                
                // Initialize testResults with proper counts
                const successful = results.filter(r => r.test_status === 'success' || r.is_user_passed).length;
                const flagged = results.filter(r => r.test_status === 'flagged').length;
                
                // Try to get total from session or cache
                let totalMerchants = session.total_merchants || results.length;
                if (loadMerchantsFromCache()) {
                    totalMerchants = filteredMerchants.length || totalMerchants;
                }
                
                testResults = {
                    total: totalMerchants,
                    successful: successful,
                    flagged: flagged,
                    current: results.length
                };
                
                console.log('✓ Initialized testResults:', testResults);
                
                // Update UI with existing results
                updateStatsFromResults(results);
                updateResultsFromDatabase(results);
                
                // Load and display merchants if available
                try {
                    const merchantsLoaded = loadMerchantsFromCache();
                    if (merchantsLoaded && filteredMerchants.length > 0) {
                        console.log('✓ Loaded merchants from cache for preview');
                        displayMerchantList(filteredMerchants);
                    } else {
                        // Try loading from database
                        console.log('📥 Loading merchants from database...');
                        await loadStoredMerchants(true);
                        if (filteredMerchants.length > 0) {
                            console.log('✓ Loaded merchants from database for preview');
                            displayMerchantList(filteredMerchants);
                        }
                    }
                } catch (error) {
                    console.log('⚠️ Could not load merchants for preview:', error.message);
                }
                
                // Show current merchant being tested
                if (session.current_merchant) {
                    elements.currentMerchant.textContent = `Testing: ${session.current_merchant}`;
                    elements.currentUrl.textContent = session.current_url || 'Loading...';
                    console.log('✓ Current merchant:', session.current_merchant);
                } else {
                    elements.currentMerchant.textContent = 'Test in progress...';
                }
                
                addLogEntry('🔄 Resumed monitoring active test session', 'success');
                addLogEntry(`📊 Currently: ${results.length} merchants tested`, 'info');
                
                // Start polling for new results
                console.log('✓ Starting polling for new results...');
                pollForResults();
                
                console.log('✅ Active test session fully restored!');
                return true;
            } else {
                console.error('❌ Failed to load test results:', resultsResponse.status);
                return false;
            }
        } else {
            // Session is completed or stopped - show results BUT keep setup visible
            console.log('📋 [Session Check] Session status:', session.status);
            console.log('✓ [Session Check] Keeping completed session for result viewing');
            
            // Set up the test session but mark as NOT running
            testSession = { session_id: session.session_id };
            isTestRunning = false; // Not actively running
            
            console.log('✓ [Session Check] Set isTestRunning =', isTestRunning);
            console.log('✓ [Session Check] Set testSession =', testSession);
            
            // Show BOTH setup and results sections for completed tests
            elements.setupSection.style.display = 'block';
            elements.resultsSection.style.display = 'block';
            
            console.log('✓ [Session Check] UI sections updated (both setup and results shown)');
            
            // Load test results using the parsed sessionId
            const resultsResponse = await fetch(`/api/merchant-results?session_id=${sessionId}&limit=10000`);
            if (resultsResponse.ok) {
                const data = await resultsResponse.json();
                const results = data.data || data;
                
                console.log(`✓ [Session Check] Loaded ${results.length} completed test results`);
                
                // Initialize testResults with proper counts
                const successful = results.filter(r => r.test_status === 'success' || r.is_user_passed).length;
                const flagged = results.filter(r => r.test_status === 'flagged').length;
                
                // Try to get total from session or cache
                let totalMerchants = session.total_merchants || results.length;
                if (loadMerchantsFromCache()) {
                    totalMerchants = filteredMerchants.length || totalMerchants;
                }
                
                testResults = {
                    total: totalMerchants,
                    successful: successful,
                    flagged: flagged,
                    current: results.length
                };
                
                console.log('✓ [Session Check] Initialized testResults:', testResults);
                
                // Update UI with existing results
                updateStatsFromResults(results);
                updateResultsFromDatabase(results);
                
                // Load and display merchants if available
                try {
                    const merchantsLoaded = loadMerchantsFromCache();
                    if (merchantsLoaded && filteredMerchants.length > 0) {
                        console.log('✓ [Session Check] Loaded merchants from cache for preview');
                        displayMerchantList(filteredMerchants);
                    } else {
                        // Try loading from database
                        console.log('📥 [Session Check] Loading merchants from database...');
                        await loadStoredMerchants(true);
                        if (filteredMerchants.length > 0) {
                            console.log('✓ [Session Check] Loaded merchants from database for preview');
                            displayMerchantList(filteredMerchants);
                        }
                    }
                } catch (error) {
                    console.log('⚠️ [Session Check] Could not load merchants for preview:', error.message);
                }
                
                // Show completion status
                elements.currentMerchant.textContent = session.status === 'completed' ? '✅ Test Completed' : '🛑 Test Stopped';
                elements.currentUrl.textContent = `Total: ${results.length} merchants tested`;
                
                addLogEntry(`📊 Loaded completed test: ${results.length} merchants tested`, 'success');
                addLogEntry(`✅ ${successful} successful, 🚨 ${flagged} flagged`, 'info');
                
                // Show restart button instead of pause/stop
                elements.pauseTestBtn.style.display = 'none';
                elements.resumeTestBtn.style.display = 'none';
                elements.stopTestBtn.style.display = 'none';
                elements.restartTestBtn.style.display = 'inline-block';
                
                console.log('✅ [Session Check] Completed test session restored for viewing!');
                return true;
            } else {
                console.error('❌ [Session Check] Failed to load test results:', resultsResponse.status);
                return false;
            }
        }
    } catch (error) {
        console.error('❌ Error checking for active session:', error);
        console.error('Error details:', error.message, error.stack);
        return false;
    }
}

// Show toast notification
function showToast(message, type = 'info', duration = 3000) {
    // Remove any existing toast
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) {
        existingToast.remove();
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas ${getToastIcon(type)}"></i>
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    // Add styles if not already present
    if (!document.querySelector('#toast-styles')) {
        const styles = document.createElement('style');
        styles.id = 'toast-styles';
        styles.textContent = `
            .toast-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                min-width: 300px;
                max-width: 500px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                animation: slideInRight 0.3s ease-out;
            }
            .toast-info { background: #3498db; color: white; }
            .toast-success { background: #27ae60; color: white; }
            .toast-warning { background: #f39c12; color: white; }
            .toast-error { background: #e74c3c; color: white; }
            .toast-content {
                display: flex;
                align-items: center;
                padding: 12px 16px;
                gap: 10px;
            }
            .toast-message { flex: 1; font-weight: 500; }
            .toast-close {
                background: none;
                border: none;
                color: inherit;
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
                opacity: 0.8;
            }
            .toast-close:hover { opacity: 1; background: rgba(255,255,255,0.1); }
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(styles);
    }
    
    // Add to page
    document.body.appendChild(toast);
    
    // Auto-hide if duration is set
    if (duration > 0) {
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, duration);
    }
}

function getToastIcon(type) {
    switch (type) {
        case 'success': return 'fa-check-circle';
        case 'warning': return 'fa-exclamation-triangle';
        case 'error': return 'fa-times-circle';
        default: return 'fa-info-circle';
    }
}

// Load quick stats for immediate feedback (lightweight)
async function loadQuickStats() {
    try {
        console.log('📊 Loading quick stats...');
        const response = await fetch('/api/stats');
        if (response.ok) {
            const stats = await response.json();
            console.log('📊 Quick stats loaded:', stats);
            
            // Update stats display immediately
            if (elements.totalTested) {
                elements.totalTested.textContent = stats.total || '0';
            }
            if (elements.successfulCount) {
                elements.successfulCount.textContent = stats.successful || '0';
            }
            if (elements.flaggedCount) {
                elements.flaggedCount.textContent = stats.flagged || '0';
            }
            
            console.log('✅ Quick stats displayed');
        }
    } catch (error) {
        console.warn('⚠️ Failed to load quick stats:', error.message);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 DOM Content Loaded - Initializing tester...');
    
    initializeEventListeners();
    // generateDefaultTestName(); // REMOVED - no longer needed, session name is auto-generated from tester name
    
    // Clear any default values that might limit merchants
    elements.merchantLimit.value = '';
    
    // Check for active test session on page load
    await checkForActiveTestSession();
    
    // Load stats immediately for quick feedback (lightweight)
    await loadQuickStats();
    
    // Only load basic data if there's no active test running
    if (!isTestRunning) {
        // Add a small delay to ensure all DOM elements are ready
        setTimeout(async () => {
            console.log('⏰ Initializing tester page...');
            
            // Try to load merchants from cache first (fast)
            const cacheLoaded = loadMerchantsFromCache();
            
            // Always populate App ID dropdown (lightweight)
            populateAppIdDropdown();
            
            // If cache loaded successfully, display merchants
            if (cacheLoaded) {
                console.log('✅ Cache loaded successfully, displaying merchants');
                if (filteredMerchants.length > 0) {
                    displayMerchantList(filteredMerchants);
                    elements.startTestBtn.disabled = false;
                }
            } else {
                // No cache found, load from database with toast notification
                console.log('📥 No cache found, loading from database...');
                
                // Show toast notification
                showToast('Loading merchants from database...', 'info', 0); // 0 = don't auto-hide
                
                try {
                    await loadStoredMerchants(true);
                    console.log('✅ Auto-loaded merchants from database');
                    showToast('Merchants loaded successfully!', 'success', 3000);
                } catch (error) {
                    console.log('ℹ️ No stored merchants available:', error.message);
                    console.log('💡 Please load merchants using API data or "Load from Database" button');
                    showToast('No stored merchants found. Use "Fetch All Pages" or "Load from Database" to get started.', 'warning', 5000);
                    
                    // Show a helpful message to the user
                    if (elements.merchantPreview) {
                        elements.merchantPreview.innerHTML = `
                            <div style="text-align: center; padding: 40px; color: #666;">
                                <i class="fas fa-database" style="font-size: 48px; margin-bottom: 20px; opacity: 0.5;"></i>
                                <h3>No Merchants Found</h3>
                                <p>To get started, use one of these options:</p>
                                <ul style="text-align: left; display: inline-block; margin-top: 20px;">
                                    <li><strong>Load from Database:</strong> Click "Load from Database" to load stored merchants</li>
                                    <li><strong>Fetch from API:</strong> Use "Fetch All Pages" to get fresh merchant data</li>
                                    <li><strong>Cloud Storage:</strong> Use "Fetch from Cloud Storage" for specific datasets</li>
                                </ul>
                            </div>
                        `;
                    }
                }
            }
        }, 100); // Small delay to ensure DOM is fully ready
    } else {
        console.log('🔄 Test is running - skipping merchant load to preserve test state');
    }
});

// Add page show listener to restore state when returning to page (works with browser navigation)
window.addEventListener('pageshow', async function(event) {
    console.log('👁️ [PageShow] Page shown, persisted:', event.persisted);
    
    // Always check for active session when page loads/shows
    const activeSession = localStorage.getItem('active_test_session');
    console.log('👁️ [PageShow] Active session in localStorage:', activeSession ? 'YES' : 'NO');
    
    if (activeSession) {
        // Parse session ID
        let sessionId;
        try {
            const sessionData = JSON.parse(activeSession);
            sessionId = sessionData.sessionId || sessionData;
            console.log('👁️ [PageShow] Session ID:', sessionId);
        } catch (e) {
            sessionId = activeSession;
        }
        
        // Check actual UI state
        const resultsVisible = elements.resultsSection && elements.resultsSection.style.display !== 'none';
        const setupVisible = elements.setupSection && elements.setupSection.style.display !== 'none';
        
        console.log(`👁️ [PageShow] Current UI state: results=${resultsVisible}, setup=${setupVisible}, isTestRunning=${isTestRunning}`);
        console.log(`👁️ [PageShow] testSession:`, testSession);
        console.log(`👁️ [PageShow] testResults:`, testResults);
        
        // Check if we need to restore (always restore if coming from navigation)
        const needsRestore = !resultsVisible || (resultsVisible && !testSession) || event.persisted;
        
        if (needsRestore) {
            // Always restore when coming back to ensure full state
            console.log('🔄 [PageShow] Restoring full session state...');
            
            // Small delay to ensure DOM is ready
            setTimeout(async () => {
                await checkForActiveTestSession();
            }, 100);
        } else {
            // Results are visible, but verify polling is active for running tests
            console.log('🔄 [PageShow] Results visible - verifying session status...');
            try {
                const response = await fetch(`/api/sessions/${sessionId}`);
                if (response.ok) {
                    const session = await response.json();
                    console.log(`👁️ [PageShow] Server session status: ${session.status}`);
                    
                    if (session.status === 'running' && !isTestRunning) {
                        console.log('⚠️ [PageShow] Session running but polling stopped - restarting...');
                        testSession = { session_id: sessionId };
                        isTestRunning = true;
                        pollForResults();
                    } else if (session.status === 'running' && isTestRunning) {
                        console.log('✓ [PageShow] Test running and polling active - good state');
                    } else if (session.status === 'completed' || session.status === 'stopped') {
                        console.log('✓ [PageShow] Test completed/stopped - displaying results');
                        // Make sure results are loaded
                        const resultsResponse = await fetch(`/api/merchant-results?session_id=${sessionId}&limit=10000`);
                        if (resultsResponse.ok) {
                            const data = await resultsResponse.json();
                            const results = data.data || data;
                            console.log(`✓ [PageShow] Loaded ${results.length} results`);
                            if (results.length > 0) {
                                updateStatsFromResults(results);
                                updateResultsFromDatabase(results);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('❌ [PageShow] Error checking session status:', error);
                // Force restore on error
                console.log('🔄 [PageShow] Error occurred - forcing full restore...');
                setTimeout(async () => {
                    await checkForActiveTestSession();
                }, 100);
            }
        }
    } else {
        console.log('ℹ️ [PageShow] No active session to restore');
    }
});

// Event listeners
function initializeEventListeners() {
    // Setup events - auto-validate on input
    // elements.apiData.addEventListener('input', debounce(validateAndPreview, 500)); // Removed - element no longer exists
    elements.appIdFilter.addEventListener('input', debounce(applyFiltersAndPreview, 300));
    elements.categoryFilter.addEventListener('change', applyFiltersAndPreview);
    elements.merchantLimit.addEventListener('input', debounce(applyFiltersAndPreview, 300));
    elements.merchantSearch.addEventListener('input', filterMerchants);
    elements.statusFilter.addEventListener('change', filterMerchants);
    
    // Tester name auto-generates test name
    if (elements.testerName) {
        elements.testerName.addEventListener('input', updateTestName);
        // Load saved tester name from localStorage
        const savedTesterName = localStorage.getItem('tester_name');
        if (savedTesterName) {
            elements.testerName.value = savedTesterName;
            updateTestName();
        } else {
            // Set default test name
            updateTestName();
        }
    }
    
    // Button events
    elements.saveToDbBtn.addEventListener('click', saveToDatabase);
    elements.startTestBtn.addEventListener('click', startTest);
    elements.loadStoredBtn.addEventListener('click', loadStoredMerchants);
    // elements.clearMerchantsBtn.addEventListener('click', clearAllMerchants); // Removed - button no longer exists
    elements.resetDatabaseBtn.addEventListener('click', handleDatabaseReset);
    elements.fetchAllBtn.addEventListener('click', fetchAllPages);
    elements.fetchCloudStorageBtn.addEventListener('click', fetchFromCloudStorage);
    // elements.testApiBtn.addEventListener('click', testApiEndpoint); // REMOVED - button no longer exists
    elements.pauseTestBtn.addEventListener('click', pauseTest);
    elements.resumeTestBtn.addEventListener('click', resumeTest);
    elements.restartTestBtn.addEventListener('click', restartTest);
    elements.clearLogBtn.addEventListener('click', clearLog);
    elements.autoScrollBtn.addEventListener('click', toggleAutoScroll);
    
    // Queue events
    elements.clearQueueBtn.addEventListener('click', clearQueue);
    
    // Test control events
    elements.pauseTestBtn.addEventListener('click', pauseTest);
    elements.stopTestBtn.addEventListener('click', stopTest);
    elements.clearTestBtn.addEventListener('click', clearTest);
    // elements.passCurrentBtn was removed from HTML
    
    // Results search
    if (elements.resultsSearchInput) {
        elements.resultsSearchInput.addEventListener('input', debounce(searchTestResults, 300));
    }
    
    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Escape key to close modals
        if (e.key === 'Escape') {
            // Close media modal
            const mediaModal = document.getElementById('media-modal');
            if (mediaModal && mediaModal.style.display === 'block') {
                mediaModal.style.display = 'none';
                e.preventDefault();
                return;
            }
            
            // Close result details modal
            const detailsModal = document.getElementById('result-details-modal');
            if (detailsModal && detailsModal.style.display === 'block') {
                detailsModal.style.display = 'none';
                e.preventDefault();
                return;
            }
        }
        
        // Command+P (Mac) or Ctrl+P (Windows) to pause/resume testing
        if ((e.metaKey || e.ctrlKey) && e.key === 'p' && testSession) {
            e.preventDefault();
            if (testPaused) {
                resumeTest();
            } else {
                pauseTest();
            }
        }
        
        // Arrow navigation in test results
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
            
            // Check if we're focused on the test results area
            const resultsArea = document.getElementById('results-section');
            if (resultsArea && (document.activeElement === document.body || resultsArea.contains(document.activeElement))) {
                e.preventDefault();
                navigateResults(e.key === 'ArrowDown' ? 1 : -1);
            }
            
            // Check if we're focused on the merchant preview area
            const merchantPreviewArea = document.getElementById('merchant-preview');
            if (merchantPreviewArea && (document.activeElement === document.body || merchantPreviewArea.contains(document.activeElement))) {
                e.preventDefault();
                navigateMerchantPreview(e.key === 'ArrowDown' ? 1 : -1);
            }
        }
        
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
        btn.addEventListener('click', function(e) {
            console.log('Tab clicked:', this.dataset.tab);
            e.stopPropagation(); // Prevent any parent handlers from interfering
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

// Generate default test name - NO LONGER NEEDED (test name is auto-generated from tester name)
// function generateDefaultTestName() {
//     const now = new Date();
//     const dateStr = now.toLocaleDateString('en-US', { 
//         year: 'numeric', 
//         month: 'short', 
//         day: 'numeric' 
//     });
//     elements.testName.value = `Merchant Test - ${dateStr}`;
// }

// Update test name based on tester name
function updateTestName() {
    // Only save tester name to localStorage for persistence
    const testerName = elements.testerName.value.trim();
    if (testerName) {
        localStorage.setItem('tester_name', testerName);
    }
}

// Navigate through test results with arrow keys
function navigateResults(direction) {
    const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
    let resultsList;
    
    if (activeTab === 'successful') {
        resultsList = elements.successfulList.querySelectorAll('.result-item');
    } else if (activeTab === 'flagged') {
        resultsList = elements.flaggedList.querySelectorAll('.result-item');
    } else {
        resultsList = elements.allResultsList.querySelectorAll('.result-item');
    }
    
    if (resultsList.length === 0) return;
    
    // Remove previous selection
    resultsList.forEach(item => item.classList.remove('selected'));
    
    // Update index with wraparound
    if (selectedResultIndex === -1) {
        selectedResultIndex = direction > 0 ? 0 : resultsList.length - 1;
    } else {
        selectedResultIndex += direction;
        
        // Wraparound logic
        if (selectedResultIndex >= resultsList.length) {
            selectedResultIndex = 0; // Go back to top
        } else if (selectedResultIndex < 0) {
            selectedResultIndex = resultsList.length - 1; // Go to bottom
        }
    }
    
    // Select and scroll to the new item
    const selectedItem = resultsList[selectedResultIndex];
    if (selectedItem) {
        selectedItem.classList.add('selected');
        selectedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        // Trigger click to show details
        selectedItem.click();
    }
}

// Navigate through merchant preview with arrow keys
function navigateMerchantPreview(direction) {
    const merchantItems = elements.merchantPreview.querySelectorAll('.merchant-item');
    
    if (merchantItems.length === 0) return;
    
    // Remove previous selection
    merchantItems.forEach(item => item.classList.remove('selected'));
    
    // Update index with wraparound
    if (selectedMerchantIndex === -1) {
        selectedMerchantIndex = direction > 0 ? 0 : merchantItems.length - 1;
    } else {
        selectedMerchantIndex += direction;
        
        // Wraparound logic
        if (selectedMerchantIndex >= merchantItems.length) {
            selectedMerchantIndex = 0; // Go back to top
        } else if (selectedMerchantIndex < 0) {
            selectedMerchantIndex = merchantItems.length - 1; // Go to bottom
        }
    }
    
    // Select and scroll to the new item
    const selectedItem = merchantItems[selectedMerchantIndex];
    if (selectedItem) {
        selectedItem.classList.add('selected');
        selectedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
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
    
    // const apiText = elements.apiData.value.trim(); // Removed - element no longer exists
    const apiText = ''; // API data input removed, merchants loaded from database
    
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
    )].sort();
    
    // Always populate the dropdown with available AppIDs
    elements.appIdFilter.innerHTML = '<option value="">All App IDs</option>';
    appIds.forEach(appId => {
        const option = document.createElement('option');
        option.value = appId;
        option.textContent = appId;
        elements.appIdFilter.appendChild(option);
    });
    
    console.log(`Populated ${appIds.length} App ID(s) in filter dropdown`);
    
    if (appIds.length === 1) {
        // If all merchants have the same AppID, auto-select it
        const appId = appIds[0];
        elements.appIdFilter.value = appId;
        
        // Log the detection (no toast message)
        addLogEntry(`🎯 Auto-detected AppID: ${appId} - ${merchants.length} merchants loaded`, 'info');
        
    } else if (appIds.length > 1) {
        // Multiple AppIDs found - just log it, don't show warning toast
        addLogEntry(`ℹ️ Multiple AppIDs detected: ${appIds.join(', ')} - ${merchants.length} merchants loaded`, 'info');
    } else {
        // No AppIDs found - just log it, don't show warning toast
        addLogEntry(`ℹ️ No AppIDs found - ${merchants.length} merchants loaded`, 'info');
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
    
    // Clear dashboard cleared flag when starting a new test
    localStorage.removeItem('dashboard_cleared');
    
    // Deduplicate merchants by MerchantID before testing
    const seenMerchantIds = new Set();
    const uniqueMerchants = filteredMerchants.filter(merchant => {
        if (seenMerchantIds.has(merchant.MerchantID)) {
            return false; // Skip duplicate
        }
        seenMerchantIds.add(merchant.MerchantID);
        return true;
    });
    
    console.log(`📊 Filtered: ${filteredMerchants.length} total, ${uniqueMerchants.length} unique merchants to test`);
    addLogEntry(`📊 Testing ${uniqueMerchants.length} unique merchants (${filteredMerchants.length - uniqueMerchants.length} duplicates removed)`, 'info');
    
    // Prepare merchants list - priority queue first, then others
    let merchantsToTest = [];
    
    if (priorityQueue.length > 0) {
        addLogEntry(`🎯 Priority Queue: Testing ${priorityQueue.length} queued merchants first`, 'success');
        merchantsToTest = [...priorityQueue];
        
        // Add remaining merchants not in queue
        const queueIds = new Set(priorityQueue.map(m => m.MerchantID || m.MerchantName));
        const remainingMerchants = uniqueMerchants.filter(m => 
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
        // No queue - use normal flow with unique merchants
        merchantsToTest = [...uniqueMerchants];
        if (elements.shuffleMerchants.checked) {
            merchantsToTest = shuffleArray(merchantsToTest);
            addLogEntry('🔀 Merchants shuffled for random testing order', 'info');
        } else {
            addLogEntry('📋 Testing merchants in original order', 'info');
        }
    }
    
    // Create or reuse test session
    // Get tester name from input or localStorage
    const testerNameInput = elements.testerName?.value.trim();
    if (testerNameInput) {
        // Save to localStorage for persistence
        localStorage.setItem('tester_name', testerNameInput);
    }
    
    const testerName = testerNameInput || localStorage.getItem('tester_name') || 'Tester';
    
    // Generate session name with proper formatting
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    const sessionName = `${testerName} - ${dateStr} ${timeStr}`;
    
    console.log('📝 [Start Test] Generated session name:', sessionName);
    // ✨ IMPORTANT: Always create a NEW session to preserve historical data
    // Even if there's an existing session, create a new one so old results stay in database
    try {
        const response = await fetch('/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: `api-ui-${Date.now()}`,
                session_name: sessionName,
                notes: `${filteredMerchants.length} merchants`
            })
        });
        
        if (!response.ok) throw new Error('Failed to create session');
        testSession = await response.json();
        console.log('✨ Created new session:', testSession.session_id);
        console.log('📝 Session name:', sessionName);
        addLogEntry(`✨ Created new test session: ${sessionName}`, 'success');
    } catch (error) {
        console.error('Failed to create session:', error);
        showError('Failed to create test session');
        return;
    }
    
    // ✨ IMPORTANT: Save session to localStorage IMMEDIATELY after creation
    // This ensures session persists even if user navigates away before test starts
    console.log('💾 Saving session to localStorage:', testSession.session_id);
    localStorage.setItem('active_test_session', JSON.stringify({
        sessionId: testSession.session_id,
        startedAt: new Date().toISOString()
    }));
    console.log('✅ Session saved to localStorage');
    
    // Clear test log and hide completion section when starting/restarting test
    clearLog();
    elements.completionSection.style.display = 'none';
    
    // ✨ Initialize test results to zero for this new session
    testResults = {
        total: uniqueMerchants.length,
        successful: 0,
        flagged: 0,
        current: 0
    };
    updateStats();
    clearResultsLists(); // Clear the results UI
    
    console.log('🔄 [Start Test] Initialized test results for new session:', testResults);
    addLogEntry('🔄 Starting fresh test session...', 'info');
    
    // Show pause/stop buttons, hide restart button
    elements.pauseTestBtn.style.display = 'inline-block';
    elements.stopTestBtn.style.display = 'inline-block';
    elements.restartTestBtn.style.display = 'none';
    elements.resumeTestBtn.style.display = 'none';
    
    // Hide setup section and show results section during active testing
    elements.setupSection.style.display = 'none';
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
    // Note: clearResultsLists() and clearLog() are now called in startTest/restartTest
    
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
                testName: testSession.session_name || 'API Merchant Test'
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to start Playwright test');
        }
        
        const result = await response.json();
        
        // ✨ IMPORTANT: Clear log again after backend starts (ensures fresh log after server truncation)
        clearLog();
        
        addLogEntry(`Playwright test started successfully (Session: ${result.sessionId})`, 'success');
        
        // Show message that real test is running
        elements.currentMerchant.textContent = 'Real Playwright test is now running...';
        elements.currentUrl.textContent = 'Check the browser window that opened';
        elements.currentDetails.textContent = 'The actual website testing is happening in the Playwright browser';
        
        addLogEntry('Browser automation started - check the opened browser window', 'info');
        addLogEntry('Polling for results every 2 seconds...', 'info');
        
        // ✨ NEW: Wait a moment for backend to fully clear log file before starting polling
        await new Promise(resolve => setTimeout(resolve, 500));
        
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
    
    // Save active session to localStorage for persistence (as object for dashboard compatibility)
    localStorage.setItem('active_test_session', JSON.stringify({
        sessionId: testSession.session_id,
        startedAt: new Date().toISOString()
    }));
    
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
                    // DON'T remove session - keep it for viewing results
                    console.log('✓ Test completed - keeping session in localStorage for result viewing');
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
                    // DON'T remove session - keep it for viewing results
                    console.log('✓ Test completed - keeping session in localStorage for result viewing');
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
    console.log('📊 [updateStatsFromResults] Received results:', results.length);
    
    // First deduplicate by merchant_id to get accurate counts
    const seenMerchants = new Set();
    const uniqueResults = results.filter(result => {
        if (seenMerchants.has(result.merchant_id)) {
            return false; // Skip duplicate
        }
        seenMerchants.add(result.merchant_id);
        return true;
    });
    
    console.log(`📊 [Tester] Updating stats: ${uniqueResults.length} unique results (${results.length - uniqueResults.length} duplicates removed)`);
    
    const successful = uniqueResults.filter(r => r.test_status === 'success' || r.is_user_passed).length;
    const flagged = uniqueResults.filter(r => r.test_status === 'flagged').length;
    
    console.log(`📊 [Tester] Calculated - Total: ${uniqueResults.length}, Successful: ${successful}, Flagged: ${flagged}`);
    
    testResults.current = uniqueResults.length;  // Use deduplicated count
    testResults.successful = successful;
    testResults.flagged = flagged;
    
    console.log(`📊 [Tester] Updated testResults:`, testResults);
    
    updateStats();
}

// Update results display from database
function updateResultsFromDatabase(results) {
    // Clear existing results
    clearResultsLists();
    
    // Filter out duplicates by merchant_id (keep only the first/most recent for each merchant)
    // This prevents showing duplicate entries for merchants that exist in multiple App IDs
    const seenMerchants = new Set();
    const uniqueResults = results.filter(result => {
        if (seenMerchants.has(result.merchant_id)) {
            return false; // Skip duplicate
        }
        seenMerchants.add(result.merchant_id);
        return true;
    });
    
    uniqueResults.forEach(result => {
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
        
        // Update merchant status and screenshot in Maps
        if (result.merchant_id) {
            merchantStatuses.set(result.merchant_id, testResult.status);
            if (result.screenshot_path) {
                merchantScreenshots.set(result.merchant_id, result.screenshot_path);
            }
        }
        
        addResultToList(merchant, testResult);
    });
    
    // Refresh merchant display to show updated statuses
    if (typeof displayMerchantList === 'function' && filteredMerchants.length > 0) {
        displayMerchantList(filteredMerchants);
    }
    
    // Update the filter to reflect the new statuses
    if (typeof filterMerchants === 'function') {
        filterMerchants();
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
    console.log('📊 [updateStats] Updating with:', testResults);
    
    // Force update DOM elements with current values
    if (elements.totalTested) {
        elements.totalTested.textContent = testResults.current;
        // Force repaint
        void elements.totalTested.offsetHeight;
    }
    if (elements.successfulCount) {
        elements.successfulCount.textContent = testResults.successful;
        void elements.successfulCount.offsetHeight;
    }
    if (elements.flaggedCount) {
        elements.flaggedCount.textContent = testResults.flagged;
        void elements.flaggedCount.offsetHeight;
    }
    
    const progress = testResults.total > 0 ? (testResults.current / testResults.total) * 100 : 0;
    // Progress percent element was removed from UI
    // elements.progressPercent.textContent = `${Math.round(progress)}%`;
    if (elements.progressFill) {
        elements.progressFill.style.width = `${progress}%`;
    }
    
    // Update tab counts
    if (elements.successfulTabCount) {
        elements.successfulTabCount.textContent = testResults.successful;
    }
    if (elements.flaggedTabCount) {
        elements.flaggedTabCount.textContent = testResults.flagged;
    }
    if (elements.allTabCount) {
        elements.allTabCount.textContent = testResults.current;
    }
    
    console.log('✅ [updateStats] DOM updated successfully');
}

// Add result to appropriate list
function addResultToList(merchant, result) {
    const merchantId = merchant.MerchantID;
    
    // Check if this merchant already exists in the lists to prevent duplicates
    const existingInAll = elements.allList.querySelector(`[data-merchant-id="${merchantId}"]`);
    if (existingInAll) {
        // Merchant already exists, skip adding duplicate
        return;
    }
    
    // Create media icons if available
    let mediaIcons = '';
    if (result.screenshot_path) {
        mediaIcons += `<i class="fas fa-camera media-icon screenshot-icon" title="View Screenshot" onclick="showMedia('${result.screenshot_path}', 'image')"></i>`;
    }
    if (result.video_path) {
        mediaIcons += `<i class="fas fa-video media-icon video-icon" title="View Video" onclick="showMedia('${result.video_path}', 'video')"></i>`;
    }
    
    // Create status change buttons
    const currentStatus = result.status;
    const statusButtons = currentStatus === 'success' 
        ? `<button class="status-change-btn btn-flag" onclick="changeResultStatus('${merchantId}', 'flagged')" title="Mark as Flagged"><i class="fas fa-flag"></i></button>`
        : `<button class="status-change-btn btn-success" onclick="changeResultStatus('${merchantId}', 'success')" title="Mark as Success"><i class="fas fa-check"></i></button>`;
    
    // Create screenshot preview if available
    let screenshotPreview = '';
    if (result.screenshot_path) {
        screenshotPreview = `
            <div class="result-screenshot-preview" onclick="event.stopPropagation(); showMedia('${result.screenshot_path}', 'image')" title="Click to view full size">
                <img src="/${result.screenshot_path}" alt="Website Preview" onerror="this.parentElement.style.display='none'">
            </div>
        `;
    }
    
    const resultHtml = `
        <div class="result-item ${result.status}" data-merchant-id="${merchantId}" onclick="showResultDetails('${merchantId}', '${escapeHtml(merchant.MerchantName).replace(/'/g, "\\'")}', '${merchant.MerchantDomains[0] || ''}', '${escapeHtml(result.reason).replace(/'/g, "\\'")}', '${result.status}', '${result.screenshot_path || ''}', '${result.video_path || ''}')" style="cursor: pointer;">
            <div class="result-content">
                <div class="result-info">
                    <div class="result-header">
                        <div class="result-name">${escapeHtml(merchant.MerchantName)}</div>
                        <div class="result-actions" onclick="event.stopPropagation()">
                            ${statusButtons}
                            ${mediaIcons}
                            <div class="result-status ${result.status}">${result.status}</div>
                        </div>
                    </div>
                    <div class="result-url">${merchant.MerchantDomains[0] ? `https://${merchant.MerchantDomains[0]}` : 'No domain'}</div>
                    <div class="result-reason">${escapeHtml(result.reason)}</div>
                </div>
                ${screenshotPreview}
            </div>
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

// Change result status (success <-> flagged)
async function changeResultStatus(merchantId, newStatus) {
    if (!testSession || !testSession.session_id) {
        showError('No active test session');
        return;
    }
    
    try {
        console.log(`Changing status for merchant ${merchantId} to ${newStatus} in session ${testSession.session_id}`);
        
        const response = await fetch(`/api/merchant-results/${merchantId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                status: newStatus,
                session_id: testSession.session_id 
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }
        
        // Update merchant status map
        merchantStatuses.set(merchantId, newStatus);
        
        // Reload results from database to reflect changes
        const resultsResponse = await fetch(`/api/merchant-results?session_id=${testSession.session_id}&limit=10000`);
        if (resultsResponse.ok) {
            const data = await resultsResponse.json();
            const results = data.data || data;
            updateResultsFromDatabase(results);
            updateStatsFromResults(results);
        }
        
        showSuccess(`Merchant marked as ${newStatus}`);
    } catch (error) {
        console.error('Error changing status:', error);
        showError(`Failed to update merchant status: ${error.message}`);
    }
}

// Show detailed result card modal
function showResultDetails(merchantId, merchantName, domain, reason, status, screenshotPath, videoPath) {
    // Create or get modal
    let modal = document.getElementById('result-details-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'result-details-modal';
        modal.className = 'media-modal';
        document.body.appendChild(modal);
    }
    
    // Unescape HTML entities in the displayed text
    const decodedName = merchantName.replace(/\\'/g, "'");
    const decodedReason = reason.replace(/\\'/g, "'");
    
    // Build media section
    let mediaSection = '';
    if (screenshotPath) {
        mediaSection += `
            <div class="detail-media-item">
                <h4><i class="fas fa-camera"></i> Screenshot</h4>
                <div class="detail-screenshot-preview" onclick="event.stopPropagation(); showMedia('${screenshotPath}', 'image')">
                    <img src="/${screenshotPath}" alt="Website Screenshot" onerror="this.parentElement.innerHTML='<p>Screenshot not available</p>'">
                    <div class="detail-screenshot-overlay">
                        <i class="fas fa-search-plus"></i> Click to view full size
                    </div>
                </div>
            </div>
        `;
    }
    
    if (videoPath) {
        mediaSection += `
            <div class="detail-media-item">
                <h4><i class="fas fa-video"></i> Recording</h4>
                <button class="btn btn-secondary" onclick="showMedia('${videoPath}', 'video')">
                    <i class="fas fa-play"></i> Watch Recording
                </button>
            </div>
        `;
    }
    
    if (!screenshotPath && !videoPath) {
        mediaSection = '<p class="no-media"><i class="fas fa-info-circle"></i> No media available for this result</p>';
    }
    
    // Create status change buttons
    const statusButtons = status === 'success'
        ? `<button class="status-change-btn btn-flag" onclick="changeResultStatus('${merchantId}', 'flagged'); document.getElementById('result-details-modal').style.display='none';" title="Mark as Flagged">
            <i class="fas fa-flag"></i> Mark as Flagged
           </button>`
        : `<button class="status-change-btn btn-success" onclick="changeResultStatus('${merchantId}', 'success'); document.getElementById('result-details-modal').style.display='none';" title="Mark as Success">
            <i class="fas fa-check"></i> Mark as Success
           </button>`;
    
    const statusClass = status === 'success' ? 'success' : 'flagged';
    const statusIcon = status === 'success' ? 'check-circle' : 'exclamation-triangle';
    
    modal.innerHTML = `
        <div class="media-modal-content result-detail-card">
            <div class="media-modal-header">
                <h3><i class="fas fa-info-circle"></i> Test Result Details</h3>
                <span class="media-modal-close" onclick="document.getElementById('result-details-modal').style.display='none'">&times;</span>
            </div>
            <div class="result-detail-body">
                <div class="detail-section">
                    <div class="detail-header">
                        <h2>${decodedName}</h2>
                        <span class="detail-status ${statusClass}">
                            <i class="fas fa-${statusIcon}"></i> ${status.toUpperCase()}
                        </span>
                    </div>
                    
                    <div class="detail-info-grid">
                        <div class="detail-info-item">
                            <span class="detail-label"><i class="fas fa-globe"></i> Domain</span>
                            <span class="detail-value">${domain || 'No domain'}</span>
                        </div>
                        <div class="detail-info-item">
                            <span class="detail-label"><i class="fas fa-link"></i> URL</span>
                            <span class="detail-value"><a href="https://${domain}" target="_blank" rel="noopener noreferrer">https://${domain}</a></span>
                        </div>
                        <div class="detail-info-item">
                            <span class="detail-label"><i class="fas fa-hashtag"></i> Merchant ID</span>
                            <span class="detail-value">${merchantId}</span>
                        </div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4><i class="fas fa-clipboard-list"></i> Test Result</h4>
                    <div class="detail-reason-box ${statusClass}">
                        ${decodedReason}
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4><i class="fas fa-images"></i> Media</h4>
                    ${mediaSection}
                </div>
                
                <div class="detail-actions">
                    ${statusButtons}
                    <button class="btn btn-outline" onclick="document.getElementById('result-details-modal').style.display='none'">
                        <i class="fas fa-times"></i> Close
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Close modal when clicking outside
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
    
    // Show modal
    modal.style.display = 'block';
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
                <div class="media-modal-header">
                    <div class="media-modal-controls">
                        <button class="media-btn" id="zoom-in-btn" title="Zoom In (Ctrl+)"><i class="fas fa-search-plus"></i></button>
                        <button class="media-btn" id="zoom-out-btn" title="Zoom Out (Ctrl-)"><i class="fas fa-search-minus"></i></button>
                        <button class="media-btn" id="reset-zoom-btn" title="Reset Zoom"><i class="fas fa-expand"></i></button>
                        <div class="zoom-slider-container" id="zoom-slider-container">
                            <span class="zoom-label">50%</span>
                            <input type="range" id="zoom-slider" class="zoom-slider" min="50" max="300" value="100" step="5">
                            <span class="zoom-label">300%</span>
                        </div>
                        <button class="media-btn" id="download-media-btn" title="Download"><i class="fas fa-download"></i></button>
                    </div>
                    <span class="media-modal-close">&times;</span>
                </div>
                <div class="media-container" id="media-container"></div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Add close functionality
        modal.querySelector('.media-modal-close').onclick = () => {
            modal.style.display = 'none';
            // Remove keyboard listener when modal closes
            document.removeEventListener('keydown', keyboardZoomHandler);
        };
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                document.removeEventListener('keydown', keyboardZoomHandler);
            }
        };
    }
    
    // Set media content
    const container = modal.querySelector('#media-container');
    const zoomSliderContainer = document.getElementById('zoom-slider-container');
    const zoomSlider = document.getElementById('zoom-slider');
    let zoomLevel = 1;
    let translateX = 0;
    let translateY = 0;
    
    // Keyboard zoom handler
    const keyboardZoomHandler = (e) => {
        if ((e.ctrlKey || e.metaKey) && mediaType === 'image') {
            if (e.key === '=' || e.key === '+') {
                e.preventDefault();
                zoomLevel = Math.min(zoomLevel + 0.1, 3);
                updateZoom();
            } else if (e.key === '-' || e.key === '_') {
                e.preventDefault();
                zoomLevel = Math.max(zoomLevel - 0.1, 0.5);
                updateZoom();
            }
        }
    };
    
    if (mediaType === 'image') {
        // Display image at natural size (100%) with scrolling, no max constraints
        container.innerHTML = `<img id="modal-image" src="/${mediaPath}" alt="Screenshot" style="width: 100%; height: auto; display: block; transform: scale(1); transition: transform 0.2s; cursor: default;">`;
        
        const img = container.querySelector('#modal-image');
        
        // Show zoom controls
        zoomSliderContainer.style.display = 'flex';
        document.getElementById('zoom-in-btn').style.display = 'inline-flex';
        document.getElementById('zoom-out-btn').style.display = 'inline-flex';
        document.getElementById('reset-zoom-btn').style.display = 'inline-flex';
        
        // Update transform and slider
        const updateZoom = () => {
            img.style.transform = `scale(${zoomLevel})`;
            zoomSlider.value = zoomLevel * 100;
            
            if (zoomLevel > 1) {
                img.style.cursor = 'grab';
            } else {
                img.style.cursor = 'default';
            }
        };
        
        // Zoom in button
        document.getElementById('zoom-in-btn').onclick = () => {
            zoomLevel = Math.min(zoomLevel + 0.25, 3);
            updateZoom();
        };
        
        // Zoom out button
        document.getElementById('zoom-out-btn').onclick = () => {
            zoomLevel = Math.max(zoomLevel - 0.25, 0.5);
            updateZoom();
        };
        
        // Reset zoom button
        document.getElementById('reset-zoom-btn').onclick = () => {
            zoomLevel = 1;
            img.style.cursor = 'default';
            updateZoom();
        };
        
        // Zoom slider
        zoomSlider.addEventListener('input', (e) => {
            zoomLevel = parseInt(e.target.value) / 100;
            img.style.transform = `scale(${zoomLevel})`;
            
            if (zoomLevel > 1) {
                img.style.cursor = 'grab';
            } else {
                img.style.cursor = 'default';
            }
        });
        
        // Click and drag to pan around the image at any zoom level
        let isPanning = false;
        let startX = 0;
        let startY = 0;
        let scrollLeft = 0;
        let scrollTop = 0;
        
        container.addEventListener('mousedown', (e) => {
            isPanning = true;
            container.style.cursor = 'grabbing';
            startX = e.pageX - container.offsetLeft;
            startY = e.pageY - container.offsetTop;
            scrollLeft = container.scrollLeft;
            scrollTop = container.scrollTop;
            e.preventDefault();
        });
        
        container.addEventListener('mouseleave', () => {
            isPanning = false;
            container.style.cursor = 'grab';
        });
        
        container.addEventListener('mouseup', () => {
            isPanning = false;
            container.style.cursor = 'grab';
        });
        
        container.addEventListener('mousemove', (e) => {
            if (!isPanning) return;
            e.preventDefault();
            const x = e.pageX - container.offsetLeft;
            const y = e.pageY - container.offsetTop;
            const walkX = (x - startX) * 2; // Multiply for faster scrolling
            const walkY = (y - startY) * 2;
            container.scrollLeft = scrollLeft - walkX;
            container.scrollTop = scrollTop - walkY;
        });
        
        // Set container cursor
        container.style.cursor = 'grab';
        
        // Keyboard shortcuts (Ctrl+ and Ctrl-)
        document.addEventListener('keydown', keyboardZoomHandler);
        
        // Download button
        document.getElementById('download-media-btn').onclick = () => {
            const link = document.createElement('a');
            link.href = `/${mediaPath}`;
            link.download = mediaPath.split('/').pop();
            link.click();
        };
    } else if (mediaType === 'video') {
        container.innerHTML = `<video id="modal-video" controls style="max-width: 100%; max-height: 80vh;"><source src="/${mediaPath}" type="video/webm"></video>`;
        
        // Hide zoom controls for video
        zoomSliderContainer.style.display = 'none';
        document.getElementById('zoom-in-btn').style.display = 'none';
        document.getElementById('zoom-out-btn').style.display = 'none';
        document.getElementById('reset-zoom-btn').style.display = 'none';
        
        // Download button
        document.getElementById('download-media-btn').onclick = () => {
            const link = document.createElement('a');
            link.href = `/${mediaPath}`;
            link.download = mediaPath.split('/').pop();
            link.click();
        };
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
    
    // Show restart button and hide stop/pause buttons
    elements.restartTestBtn.style.display = 'inline-block';
    elements.stopTestBtn.style.display = 'none';
    elements.pauseTestBtn.style.display = 'none';
    elements.resumeTestBtn.style.display = 'none';
    
    // Show setup section again when test completes
    elements.setupSection.style.display = 'block';
    
    // Show completion section
    elements.completionSection.style.display = 'block';
    elements.completionSection.scrollIntoView({ behavior: 'smooth' });
    
    showSuccess('Test completed successfully!');
}

// Control functions
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

// Restart testing with current configuration
async function restartTest() {
    if (!filteredMerchants || filteredMerchants.length === 0) {
        showError('No merchants available to test. Please load merchants first.');
        return;
    }
    
    // ✨ IMPORTANT: Always create a NEW session when restarting to preserve old results
    // Don't reuse the old session - let startTest() create a fresh one
    console.log('🔄 [Restart Test] Creating new session to preserve old results');
    addLogEntry('🔄 Starting new test session (old results preserved)...', 'info');
    
    // Clear the testSession so startTest creates a new one
    testSession = null;
    
    // Call startTest which will create a new session
    await startTest();
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
            // Deduplicate merchants by MerchantID (keep first occurrence)
            const seenMerchantIds = new Set();
            const uniqueMerchants = data.merchants.filter(merchant => {
                if (seenMerchantIds.has(merchant.MerchantID)) {
                    return false; // Skip duplicate
                }
                seenMerchantIds.add(merchant.MerchantID);
                return true;
            });
            
            // Directly set merchantsData instead of going through JSON string conversion
            merchantsData = {
                Merchants: uniqueMerchants,
                PageCount: 1,
                PageSize: uniqueMerchants.length,
                TotalCount: uniqueMerchants.length
            };
            
            console.log(`Loaded ${data.merchants.length} total merchants, ${uniqueMerchants.length} unique merchants`);
            
            // Auto-detect and set AppID
            autoDetectAppId(uniqueMerchants);
            
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
                addLogEntry(`Loaded ${uniqueMerchants.length} unique merchants (${data.merchants.length} total in database)`, 'success');
                showSuccess(`Loaded ${uniqueMerchants.length} unique merchants from database`);
            } else {
                console.log(`✅ Auto-loaded ${uniqueMerchants.length} unique merchants from database`);
            }
            
            // Save to cache for persistence across navigation
            saveMerchantsToCache();
            
            // Load and sync recent test results from database
            await syncMerchantResultsFromDatabase();
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

// Sync merchant results from database to update status badges
async function syncMerchantResultsFromDatabase() {
    try {
        console.log('🔄 Syncing merchant results from database...');
        
        // ✨ ALWAYS fetch ALL historical test results to maintain history
        console.log('📊 Fetching ALL historical test results for merchant preview');
        const response = await fetch(`/api/merchant-results?limit=10000`);
        if (!response.ok) {
            console.log('⚠️ Could not fetch test results');
            return;
        }
        
        const data = await response.json();
        const results = data.data || data;
        
        if (results.length > 0) {
            console.log(`✓ Found ${results.length} total test results across all sessions`);
            
            // Update merchantStatuses and merchantScreenshots Maps with results from database
            // Keep the most recent test result for each merchant
            const merchantResultMap = new Map();
            results.forEach(result => {
                if (result.merchant_id) {
                    const existing = merchantResultMap.get(result.merchant_id);
                    // Keep the most recent test result
                    if (!existing || new Date(result.tested_at) > new Date(existing.tested_at)) {
                        merchantResultMap.set(result.merchant_id, result);
                    }
                }
            });
            
            // Apply the most recent results to our maps
            merchantResultMap.forEach((result, merchantId) => {
                const status = result.is_user_passed ? 'success' : result.test_status;
                merchantStatuses.set(merchantId, status);
                if (result.screenshot_path) {
                    merchantScreenshots.set(merchantId, result.screenshot_path);
                }
            });
            
            // Refresh the merchant display to show updated statuses
            if (filteredMerchants.length > 0) {
                displayMerchantList(filteredMerchants);
                filterMerchants(); // Apply current filters with new statuses
            }
            
            console.log(`✅ Synced ${merchantStatuses.size} merchant statuses from all sessions`);
        } else {
            console.log('ℹ️ No test results found in database');
        }
    } catch (error) {
        console.error('❌ Error syncing merchant results:', error);
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
            // elements.apiData.value = ''; // Removed - element no longer exists
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
async function pauseTest() {
    if (!testSession) {
        showError('No active test session');
        return;
    }
    
    console.log(`⏸️ [Pause] Pausing test session: ${testSession.session_id}`);
    testPaused = true;
    elements.pauseTestBtn.style.display = 'none';
    elements.resumeTestBtn.style.display = 'inline-block';
    
    // Update session status in database
    try {
        console.log(`⏸️ [Pause] Sending PUT request to /api/sessions/${testSession.session_id}`);
        const response = await fetch(`/api/sessions/${testSession.session_id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'paused' })
        });
        
        if (response.ok) {
            console.log('✅ [Pause] Session status updated to "paused" in database');
            addLogEntry('⏸️ Test paused by user - will pause after current merchant', 'warning');
            showInfo('Test will pause after current merchant completes.');
            
            // Verify the update by reading back the status
            const verifyResponse = await fetch(`/api/sessions/${testSession.session_id}/status`);
            if (verifyResponse.ok) {
                const statusData = await verifyResponse.json();
                console.log(`✅ [Pause] Verified session status in DB: ${statusData.status}`);
            }
        } else {
            const errorText = await response.text();
            console.error(`❌ [Pause] Failed to update session status: ${response.status} - ${errorText}`);
            throw new Error('Failed to update session status');
        }
    } catch (error) {
        console.error('❌ [Pause] Error pausing test:', error);
        addLogEntry('⚠️ Failed to pause test', 'error');
        showError('Failed to pause test');
    }
}

async function resumeTest() {
    if (!testSession) {
        showError('No active test session');
        return;
    }
    
    testPaused = false;
    elements.pauseTestBtn.style.display = 'inline-block';
    elements.resumeTestBtn.style.display = 'none';
    
    // Update session status in database
    try {
        const response = await fetch(`/api/sessions/${testSession.session_id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'running' })
        });
        
        if (response.ok) {
            addLogEntry('▶️ Test resumed by user', 'info');
            showInfo('Test resumed.');
        } else {
            throw new Error('Failed to update session status');
        }
    } catch (error) {
        console.error('Error resuming test:', error);
        addLogEntry('⚠️ Failed to resume test', 'error');
        showError('Failed to resume test');
    }
}

function passCurrentMerchant() {
    addLogEntry('👤 Pass current merchant requested', 'info');
    showInfo('Current merchant will be marked as passed');
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
        let matchesStatus = false;
        
        if (!statusFilter) {
            // Show all merchants
            matchesStatus = true;
        } else if (statusFilter === 'tested') {
            // Show any tested merchant (success or flagged)
            matchesStatus = merchantStatus === 'success' || merchantStatus === 'flagged';
        } else {
            // Match specific status
            matchesStatus = merchantStatus === statusFilter;
        }
        
        return matchesSearch && matchesStatus;
    });
    
    // Update filteredMerchants global
    filteredMerchants = filtered;
    
    displayMerchantList(filtered);
    elements.merchantCountDisplay.textContent = `${filtered.length} merchants`;
}

// Search test results
function searchTestResults() {
    const searchTerm = elements.resultsSearchInput.value.toLowerCase().trim();
    
    // Get all result cards across all tabs
    const allCards = document.querySelectorAll('.result-card');
    let visibleCount = 0;
    
    allCards.forEach(card => {
        const merchantName = card.querySelector('h4')?.textContent.toLowerCase() || '';
        const url = card.querySelector('.result-url')?.textContent.toLowerCase() || '';
        const details = card.querySelector('.result-details')?.textContent.toLowerCase() || '';
        
        const matches = !searchTerm || 
            merchantName.includes(searchTerm) || 
            url.includes(searchTerm) ||
            details.includes(searchTerm);
        
        if (matches) {
            card.style.display = '';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });
    
    // Update search count
    if (elements.resultsSearchCount) {
        if (searchTerm) {
            elements.resultsSearchCount.textContent = `${visibleCount} result${visibleCount !== 1 ? 's' : ''}`;
        } else {
            elements.resultsSearchCount.textContent = '';
        }
    }
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
        
        // Check if merchant has a screenshot from test results
        let cameraIcon = '';
        const screenshotPath = merchantScreenshots.get(merchant.MerchantID);
        if (screenshotPath) {
            cameraIcon = `<i class="fas fa-camera media-icon-preview" title="View Screenshot" onclick="showMedia('${screenshotPath}', 'image')" style="cursor: pointer; color: #3b82f6; margin-left: 8px; font-size: 1.1rem;"></i>`;
        }
        
        merchantItem.innerHTML = `
            <div class="merchant-info-item">
                <div class="merchant-name-item">${escapeHtml(merchant.MerchantName)}</div>
                <div class="merchant-url-item">${escapeHtml(domain)}</div>
                <div class="merchant-category-item">${escapeHtml(merchant.PrimaryCategory || 'No category')}</div>
            </div>
            <div class="merchant-actions-item">
                ${cameraIcon}
                <div class="merchant-status ${status}">${status}</div>
            </div>
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
            // elements.apiData.value = ''; // Removed - element no longer exists
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

// Fetch merchants from Google Cloud Storage JSON URL
async function fetchFromCloudStorage() {
    const cloudUrl = elements.apiUrl.value.trim();
    
    if (!cloudUrl) {
        showError('Please enter a Cloud Storage URL first');
        return;
    }
    
    // Validate it's a cloud storage URL
    if (!cloudUrl.includes('storage.googleapis.com')) {
        showError('Please enter a valid Google Cloud Storage URL');
        return;
    }
    
    // Disable buttons during fetch
    elements.fetchCloudStorageBtn.disabled = true;
    elements.fetchCloudStorageBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Fetching...';
    
    // Show progress
    elements.fetchProgress.style.display = 'block';
    elements.fetchProgressFill.style.width = '10%';
    elements.fetchStatus.textContent = 'Fetching from Cloud Storage...';
    
    try {
        addLogEntry('🌐 Fetching merchants from Cloud Storage...', 'info');
        
        const response = await fetch(cloudUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        elements.fetchProgressFill.style.width = '30%';
        elements.fetchStatus.textContent = 'Parsing JSON data...';
        
        const data = await response.json();
        
        if (!Array.isArray(data)) {
            throw new Error('Invalid response: Expected an array of merchants');
        }
        
        addLogEntry(`✓ Found ${data.length} merchants in Cloud Storage`, 'success');
        elements.fetchProgressFill.style.width = '50%';
        elements.fetchStatus.textContent = 'Converting merchant data...';
        
        // Convert cloud storage format to internal format
        const convertedMerchants = data.map(item => {
            // Extract App ID from URL if available (it's in the path structure)
            const urlMatch = cloudUrl.match(/cloud-db\/(\d+)\/(\d+)\//);
            const appId = urlMatch ? parseInt(urlMatch[2]) : 206; // Default to 206 if not found
            
            return {
                AppID: appId,
                MerchantID: item.Merchant?.ID || item.ID,
                MerchantName: item.Merchant?.Name || 'Unknown',
                MerchantDomains: item.Domain ? [item.Domain] : [],
                MerchantScore: 0,
                IsFeaturedMerchant: false,
                PrimaryCategory: '',
                PrimaryCategoryID: null,
                ParentCategory: '',
                ParentCategoryID: null,
                MaxRate: item.Merchant?.MaxRate?.Amount || '0',
                MaxRateKind: item.Merchant?.MaxRate?.Kind || 'PERCENTAGE',
                MaxRateCurrency: item.Merchant?.MaxRate?.Currency || '',
                MaxRateLedgerID: null,
                Boosted: false,
                MaxOfferScore: 0,
                DetailedRates: [],
                Coupons: [],
                BrandColor: '',
                TextColor: '',
                FeaturedImageURL: '',
                LogoImageExists: false,
                Images: [],
                CreatedDate: new Date().toISOString(),
                ModifiedDate: new Date().toISOString()
            };
        });
        
        elements.fetchProgressFill.style.width = '70%';
        elements.fetchStatus.textContent = 'Checking for duplicates in database...';
        
        // Check which merchants are already in the database
        addLogEntry('🔍 Checking for existing merchants in database...', 'info');
        const existingResponse = await fetch('/api/stored-merchants');
        const existingData = await existingResponse.json();
        const existingMerchants = existingData.merchants || [];
        
        // Create a Set of existing merchant combinations (MerchantID + AppID) for fast lookup
        // This ensures the same merchant can exist in multiple App IDs
        const existingCombinations = new Set(
            existingMerchants.map(m => `${m.MerchantID}-${m.AppID}`)
        );
        
        // Filter out merchants that already exist with the same MerchantID AND AppID combination
        const newMerchants = convertedMerchants.filter(m => 
            !existingCombinations.has(`${m.MerchantID}-${m.AppID}`)
        );
        
        elements.fetchProgressFill.style.width = '85%';
        
        if (newMerchants.length === 0) {
            addLogEntry('ℹ️ All merchants from Cloud Storage already exist in database for this App ID', 'info');
            showInfo('No new merchants to add - all merchants already exist in database for this App ID');
            elements.fetchProgressFill.style.width = '100%';
            elements.fetchStatus.textContent = 'No new merchants found';
        } else {
            const duplicateCount = convertedMerchants.length - newMerchants.length;
            addLogEntry(`✓ Found ${newMerchants.length} new merchant entries (${duplicateCount} already exist with same App ID)`, 'success');
            
            // Count how many are truly new merchants vs. existing merchants in different App IDs
            const existingMerchantIds = new Set(existingMerchants.map(m => m.MerchantID));
            const newMerchantCount = newMerchants.filter(m => !existingMerchantIds.has(m.MerchantID)).length;
            const crossAppCount = newMerchants.length - newMerchantCount;
            
            if (crossAppCount > 0) {
                addLogEntry(`📊 ${crossAppCount} merchants already exist in other App IDs (will be added to App ID ${newMerchants[0].AppID})`, 'info');
            }
            
            elements.fetchStatus.textContent = `Storing ${newMerchants.length} new merchant entries...`;
            
            // Store only new merchants in the database
            const storeResponse = await fetch('/api/store-merchants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ merchants: newMerchants })
            });
            
            if (!storeResponse.ok) {
                throw new Error('Failed to store merchants in database');
            }
            
            const storeResult = await storeResponse.json();
            
            elements.fetchProgressFill.style.width = '100%';
            elements.fetchStatus.textContent = `Successfully added ${newMerchants.length} new merchant entries!`;
            
            addLogEntry(`✅ Successfully stored ${newMerchants.length} new merchant entries in database`, 'success');
            if (duplicateCount > 0) {
                addLogEntry(`📊 Skipped ${duplicateCount} merchants that already exist with this App ID`, 'info');
            }
            
            let successMessage = `Added ${newMerchants.length} new merchant entries to database`;
            if (duplicateCount > 0) {
                successMessage += ` (${duplicateCount} already existed with same App ID)`;
            }
            showSuccess(successMessage);
            
            // Reload merchants to show the new data
            await loadStoredMerchants();
        }
        
    } catch (error) {
        console.error('Cloud Storage fetch error:', error);
        addLogEntry(`❌ Error: ${error.message}`, 'error');
        showError(`Failed to fetch from Cloud Storage: ${error.message}`);
        elements.fetchProgressFill.style.width = '0%';
        elements.fetchStatus.textContent = 'Fetch failed';
    } finally {
        // Re-enable buttons
        elements.fetchCloudStorageBtn.disabled = false;
        elements.fetchCloudStorageBtn.innerHTML = '<i class="fas fa-cloud-download-alt"></i> Fetch from Cloud Storage';
        
        // Hide progress after a delay
        setTimeout(() => {
            elements.fetchProgress.style.display = 'none';
        }, 3000);
    }
}

// Fetch all pages from paginated API
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
async function clearTest() {
    if (isTestRunning) {
        if (!confirm('Test is currently running. Stop and clear?')) {
            return;
        }
        await stopTest();
    }
    
    // Get current session ID before clearing
    const sessionIdToClear = testSession?.session_id;
    
    // Reset all state
    testResults = {
        total: 0,
        successful: 0,
        flagged: 0,
        current: 0
    };
    testSession = null;
    isTestRunning = false;
    
    // Clear merchant statuses and screenshots maps
    merchantStatuses.clear();
    merchantScreenshots.clear();
    
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
    
    // Hide results section and show setup section
    elements.resultsSection.style.display = 'none';
    elements.setupSection.style.display = 'block';
    
    // Clear localStorage
    localStorage.removeItem('active_test_session');
    
    // Delete session from database
    if (sessionIdToClear) {
        try {
            const response = await fetch(`/api/sessions/${sessionIdToClear}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                addLogEntry('🗑️ Test results cleared from database', 'success');
            } else {
                addLogEntry('⚠️ Failed to clear test results from database', 'warning');
            }
        } catch (error) {
            console.error('Error clearing test from database:', error);
            addLogEntry(`⚠️ Error clearing database: ${error.message}`, 'warning');
        }
    }
    
    // Refresh merchant list to remove status badges
    if (filteredMerchants.length > 0) {
        displayMerchantList(filteredMerchants);
    }
    
    addLogEntry('🔄 Test cleared - ready to start new test', 'success');
    showSuccess('Test cleared successfully');
}

// ==================== TESTER STATS FUNCTIONALITY ====================

let statsChart = null;
let currentStatsRange = '1m';

// Open stats modal
async function openTesterStats() {
    const testerName = localStorage.getItem('tester_name') || 'Tester';
    document.getElementById('stats-tester-name').textContent = `${testerName}'s Testing Stats`;
    document.getElementById('tester-stats-modal').style.display = 'block';
    
    await loadTesterStats(currentStatsRange);
}

// Close stats modal
function closeTesterStats() {
    document.getElementById('tester-stats-modal').style.display = 'none';
}

// Load tester stats
async function loadTesterStats(range = '1m', customFrom = null, customTo = null) {
    const testerName = localStorage.getItem('tester_name');
    
    if (!testerName) {
        showInfo('Please set your tester name in the configuration section first');
        closeTesterStats();
        return;
    }
    
    try {
        // Calculate date range
        let fromDate, toDate;
        toDate = new Date();
        
        if (range === 'custom' && customFrom && customTo) {
            fromDate = new Date(customFrom);
            toDate = new Date(customTo);
        } else {
            fromDate = new Date();
            const months = range === '1m' ? 1 : (range === '3m' ? 3 : 6);
            fromDate.setMonth(fromDate.getMonth() - months);
        }
        
        // Fetch test sessions for this tester
        const response = await fetch('/api/test-sessions');
        if (!response.ok) throw new Error('Failed to fetch test sessions');
        
        const sessions = await response.json();
        
        // Filter sessions by tester name (case-insensitive partial match)
        const testerSessions = sessions.filter(s => 
            s.session_name && s.session_name.toLowerCase().includes(testerName.toLowerCase())
        );
        
        // Filter by date range
        const filteredSessions = testerSessions.filter(s => {
            const sessionDate = new Date(s.created_at);
            return sessionDate >= fromDate && sessionDate <= toDate;
        });
        
        // Fetch all merchant results for these sessions
        const allResults = [];
        for (const session of filteredSessions) {
            const resultsResponse = await fetch(`/api/merchant-results?sessionId=${session.session_id}&limit=10000`);
            if (resultsResponse.ok) {
                const data = await resultsResponse.json();
                const results = data.data || data;
                allResults.push(...results);
            }
        }
        
        // Deduplicate by merchant_id (keep most recent test per merchant)
        const merchantMap = new Map();
        allResults.forEach(item => {
            const existingItem = merchantMap.get(item.merchant_id);
            if (!existingItem || new Date(item.tested_at) > new Date(existingItem.tested_at)) {
                merchantMap.set(item.merchant_id, item);
            }
        });
        const uniqueResults = Array.from(merchantMap.values());
        
        console.log(`📦 [loadTesterStats] Total raw results: ${allResults.length}, Unique merchants: ${uniqueResults.length}`);
        
        // Calculate stats from deduplicated results
        const totalTests = filteredSessions.length;
        const totalMerchants = uniqueResults.length;
        const successfulMerchants = uniqueResults.filter(r => r.test_status === 'success').length;
        const flaggedMerchants = uniqueResults.filter(r => r.test_status === 'flagged').length;
        
        // Update summary cards
        document.getElementById('total-tests-stat').textContent = totalTests;
        document.getElementById('total-merchants-stat').textContent = totalMerchants;
        document.getElementById('successful-merchants-stat').textContent = successfulMerchants;
        document.getElementById('flagged-merchants-stat').textContent = flaggedMerchants;
        
        // Prepare chart data (use deduplicated results)
        const chartData = prepareChartData(uniqueResults, fromDate, toDate);
        renderStatsChart(chartData);
        
        // Display recent sessions
        displayRecentSessions(filteredSessions.slice(0, 10));
        
    } catch (error) {
        console.error('Error loading tester stats:', error);
        showError('Failed to load testing statistics');
    }
}

// Prepare chart data
function prepareChartData(results, fromDate, toDate) {
    // Group results by date
    const dailyStats = {};
    
    results.forEach(result => {
        const date = new Date(result.tested_at).toISOString().split('T')[0];
        if (!dailyStats[date]) {
            dailyStats[date] = { total: 0, successful: 0, flagged: 0 };
        }
        dailyStats[date].total++;
        if (result.test_status === 'success') dailyStats[date].successful++;
        if (result.test_status === 'flagged') dailyStats[date].flagged++;
    });
    
    // Generate labels for all dates in range
    const labels = [];
    const totalData = [];
    const successData = [];
    const flaggedData = [];
    
    const currentDate = new Date(fromDate);
    while (currentDate <= toDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        labels.push(dateStr);
        
        const stats = dailyStats[dateStr] || { total: 0, successful: 0, flagged: 0 };
        totalData.push(stats.total);
        successData.push(stats.successful);
        flaggedData.push(stats.flagged);
        
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return { labels, totalData, successData, flaggedData };
}

// Render stats chart
function renderStatsChart(data) {
    const ctx = document.getElementById('stats-chart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (statsChart) {
        statsChart.destroy();
    }
    
    statsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
            datasets: [
                {
                    label: 'Total Merchants',
                    data: data.totalData,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Successful',
                    data: data.successData,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Flagged',
                    data: data.flaggedData,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// Display recent sessions
function displayRecentSessions(sessions) {
    const container = document.getElementById('recent-sessions-list');
    
    if (sessions.length === 0) {
        container.innerHTML = '<p class="no-data">No test sessions found in this period</p>';
        return;
    }
    
    container.innerHTML = sessions.map(session => {
        const date = new Date(session.created_at).toLocaleString();
        return `
            <div class="session-item">
                <div class="session-header">
                    <div class="session-name">${session.session_name || 'Unnamed Test'}</div>
                    <div class="session-date">${date}</div>
                </div>
                <div class="session-stats">
                    <div class="session-stat">
                        <i class="fas fa-vial"></i>
                        <span>Status: ${session.status}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Initialize stats modal event listeners
function initStatsModalListeners() {
    // Stats button click
    const statsBtn = document.getElementById('tester-stats-btn');
    if (statsBtn) {
        statsBtn.addEventListener('click', openTesterStats);
    }
    
    // Close button
    const closeBtn = document.getElementById('close-stats-modal');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeTesterStats);
    }
    
    // Click outside modal to close
    const modal = document.getElementById('tester-stats-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeTesterStats();
            }
        });
    }
    
    // Range buttons
    document.querySelectorAll('.chart-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const range = this.dataset.range;
            
            // Update active state
            document.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            if (range === 'custom') {
                document.getElementById('custom-date-range').style.display = 'block';
            } else {
                document.getElementById('custom-date-range').style.display = 'none';
                currentStatsRange = range;
                await loadTesterStats(range);
            }
        });
    });
    
    // Apply custom range
    const applyBtn = document.getElementById('apply-custom-range');
    if (applyBtn) {
        applyBtn.addEventListener('click', async () => {
            const fromDate = document.getElementById('stats-date-from').value;
            const toDate = document.getElementById('stats-date-to').value;
            
            if (!fromDate || !toDate) {
                showError('Please select both start and end dates');
                return;
            }
            
            if (new Date(fromDate) > new Date(toDate)) {
                showError('Start date must be before end date');
                return;
            }
            
            currentStatsRange = 'custom';
            await loadTesterStats('custom', fromDate, toDate);
        });
    }
    
    // Set default date values
    const today = new Date().toISOString().split('T')[0];
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const oneMonthAgoStr = oneMonthAgo.toISOString().split('T')[0];
    
    document.getElementById('stats-date-from').value = oneMonthAgoStr;
    document.getElementById('stats-date-to').value = today;
}

// Initialize stats listeners on page load
initStatsModalListeners();
