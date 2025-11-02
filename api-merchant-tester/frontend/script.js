// Global state
let currentData = [];
let filteredData = [];
let currentPage = 1;
let itemsPerPage = 50;
let sortField = 'tested_at';
let sortDirection = 'desc';
let pollInterval = null; // For auto-refresh during active tests
// Check localStorage for cleared flag
let dataClearedManually = localStorage.getItem('dashboard_cleared') === 'true';

// DOM elements
const elements = {
    loading: document.getElementById('loading'),
    sessionFilter: document.getElementById('session-filter'),
    statusFilter: document.getElementById('status-filter'),
    categoryFilter: document.getElementById('category-filter'),
    searchFilter: document.getElementById('search-filter'),
    dateFrom: document.getElementById('date-from'),
    dateTo: document.getElementById('date-to'),
    refreshBtn: document.getElementById('refresh-btn'),
    exportBtn: document.getElementById('export-btn'),
    clearFiltersBtn: document.getElementById('clear-filters-btn'),
    resetResultsBtn: document.getElementById('reset-results-btn'),
    tableViewBtn: document.getElementById('table-view-btn'),
    cardViewBtn: document.getElementById('card-view-btn'),
    tableView: document.getElementById('table-view'),
    cardView: document.getElementById('card-view'),
    resultsTbody: document.getElementById('results-tbody'),
    resultsCount: document.getElementById('results-count'),
    prevPageBtn: document.getElementById('prev-page'),
    nextPageBtn: document.getElementById('next-page'),
    pageInfo: document.getElementById('page-info'),
    totalTested: document.getElementById('total-tested'),
    totalSuccessful: document.getElementById('total-successful'),
    totalFlagged: document.getElementById('total-flagged'),
    totalUserPassed: document.getElementById('total-user-passed'),
    modal: document.getElementById('detail-modal'),
    modalTitle: document.getElementById('modal-title'),
    modalBody: document.getElementById('modal-body')
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎬 [Dashboard] Initializing...');
    
    // Check for active session first before loading data
    const activeSession = localStorage.getItem('active_test_session');
    if (activeSession) {
        try {
            const sessionData = JSON.parse(activeSession);
            console.log(`🔍 [Dashboard] Found active session on load: ${sessionData.sessionId}`);
        } catch (e) {
            console.warn('⚠️ [Dashboard] Invalid session data in localStorage, clearing...');
            localStorage.removeItem('active_test_session');
        }
    } else {
        console.log('ℹ️ [Dashboard] No active session found on load');
    }
    
    initializeEventListeners();
    loadData(); // This will now respect the active session
    startPolling(); // Start polling for live updates
});

// Add page show listener to restore dashboard state (works with browser navigation)
window.addEventListener('pageshow', async function(event) {
    console.log('👁️ [Dashboard PageShow] Page shown, persisted:', event.persisted);
    
    const activeSession = localStorage.getItem('active_test_session');
    console.log('👁️ [Dashboard PageShow] Active session:', activeSession ? 'YES' : 'NO');
    console.log('👁️ [Dashboard PageShow] Current data count:', currentData.length);
    console.log('👁️ [Dashboard PageShow] dataClearedManually:', dataClearedManually);
    
    // If coming from back/forward cache or have active session with no data
    if ((event.persisted || activeSession) && currentData.length === 0 && !dataClearedManually) {
        // Have session but no data displayed - reload
        console.log('🔄 [Dashboard PageShow] Have session but no data - reloading...');
        setTimeout(async () => {
            await loadData();
        }, 100);
    } else if (activeSession && currentData.length > 0) {
        // Have session and data - verify it's current
        console.log('🔄 [Dashboard PageShow] Verifying data is current...');
        try {
            const sessionData = JSON.parse(activeSession);
            const sessionId = sessionData.sessionId || sessionData;
            
            const response = await fetch(`/api/merchant-results?session_id=${sessionId}&limit=10000`);
            if (response.ok) {
                const data = await response.json();
                const serverResults = Array.isArray(data) ? data : (data.data || []);
                
                console.log(`👁️ [Dashboard PageShow] Server has ${serverResults.length} results, we have ${currentData.length}`);
                
                if (serverResults.length !== currentData.length) {
                    console.log('⚠️ [Dashboard PageShow] Result count mismatch - reloading...');
                    setTimeout(async () => {
                        await loadData();
                    }, 100);
                } else {
                    console.log('✓ [Dashboard PageShow] Data is current');
                }
            }
        } catch (error) {
            console.error('❌ [Dashboard PageShow] Error verifying data:', error);
        }
    } else if (dataClearedManually) {
        console.log('ℹ️ [Dashboard PageShow] Data was manually cleared - staying empty');
    } else {
        console.log('ℹ️ [Dashboard PageShow] No session - showing empty state');
    }
});

// Event listeners
function initializeEventListeners() {
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Escape key to close modals
        if (e.key === 'Escape') {
            const mediaModal = document.querySelector('.media-modal');
            if (mediaModal && mediaModal.style.display === 'block') {
                document.body.removeChild(mediaModal);
                e.preventDefault();
                return;
            }
            
            const detailsModal = document.getElementById('result-details-modal');
            if (detailsModal && detailsModal.style.display === 'block') {
                detailsModal.style.display = 'none';
                e.preventDefault();
                return;
            }
            
            if (elements.modal.style.display === 'block') {
                closeModal();
                e.preventDefault();
                return;
            }
        }
    });
    
    // Filter events
    elements.sessionFilter.addEventListener('change', applyFilters);
    elements.statusFilter.addEventListener('change', applyFilters);
    elements.categoryFilter.addEventListener('change', applyFilters);
    elements.searchFilter.addEventListener('input', debounce(applyFilters, 300));
    elements.dateFrom.addEventListener('change', applyFilters);
    elements.dateTo.addEventListener('change', applyFilters);

    // Button events
    elements.refreshBtn.addEventListener('click', async () => {
        console.log('🔄 [Dashboard] Manual refresh requested');
        dataClearedManually = false; // Reset flag to allow loading
        localStorage.removeItem('dashboard_cleared'); // Remove from localStorage
        
        // Check if there's an active session
        const activeSession = localStorage.getItem('active_test_session');
        
        if (!activeSession) {
            // No active session - explicitly load ALL historical data
            console.log('📊 [Dashboard] Loading ALL historical data on manual refresh');
            showLoading(true);
            try {
                const response = await fetch('/api/merchant-results?limit=10000');
                if (response.ok) {
                    const data = await response.json();
                    let rawData = Array.isArray(data) ? data : (data.data || []);
                    
                    console.log(`📦 [Dashboard] Received ${rawData.length} raw historical results`);
                    
                    // Deduplicate
                    const seenIds = new Set();
                    currentData = rawData.filter(item => {
                        if (seenIds.has(item.merchant_id)) return false;
                        seenIds.add(item.merchant_id);
                        return true;
                    });
                    
                    console.log(`✅ [Dashboard] Loaded ${currentData.length} unique historical results`);
                    
                    await populateFilters();
                    updateStats();
                    applyFilters();
                } else {
                    currentData = [];
                    await populateFilters();
                    updateStats();
                    applyFilters();
                }
            } catch (error) {
                console.error('❌ [Dashboard] Error loading historical data:', error);
            } finally {
                showLoading(false);
            }
        } else {
            // Has active session - use normal loadData
            loadData();
        }
    });
    elements.exportBtn.addEventListener('click', exportToCSV);
    elements.clearFiltersBtn.addEventListener('click', clearFilters);
    elements.resetResultsBtn.addEventListener('click', resetResults);
    elements.tableViewBtn.addEventListener('click', () => switchView('table'));
    elements.cardViewBtn.addEventListener('click', () => switchView('card'));

    // Pagination events
    elements.prevPageBtn.addEventListener('click', () => changePage(currentPage - 1));
    elements.nextPageBtn.addEventListener('click', () => changePage(currentPage + 1));

    // Modal events
    elements.modal.addEventListener('click', function(e) {
        if (e.target === elements.modal || e.target.classList.contains('modal-close')) {
            closeModal();
        }
    });

    // Table sorting
    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', function() {
            const field = this.dataset.sort;
            if (sortField === field) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                sortField = field;
                sortDirection = 'asc';
            }
            updateSortIcons();
            applyFilters();
        });
    });
}

// Load data from the API/database
async function loadData() {
    // Don't reload if data was manually cleared
    if (dataClearedManually) {
        console.log('ℹ️ [Dashboard] Data was manually cleared - skipping auto-load');
        showLoading(false); // Make sure to hide loading spinner
        return;
    }
    
    showLoading(true);
    try {
        // ✨ ALWAYS load ALL historical data to maintain history across sessions
        console.log('📊 [Dashboard] Loading ALL historical results from database');
        
        const response = await fetch('/api/merchant-results?limit=10000');
        if (response.ok) {
            const data = await response.json();
            let rawData = Array.isArray(data) ? data : (data.data || []);
            
            console.log(`📦 [Dashboard] Received ${rawData.length} raw historical results`);
            
            // Deduplicate by merchant_id (keep most recent test per merchant)
            const merchantMap = new Map();
            rawData.forEach(item => {
                const existingItem = merchantMap.get(item.merchant_id);
                if (!existingItem || new Date(item.tested_at) > new Date(existingItem.tested_at)) {
                    // Keep the most recent test result for this merchant
                    merchantMap.set(item.merchant_id, item);
                }
            });
            
            currentData = Array.from(merchantMap.values());
            
            console.log(`✅ [Dashboard] Loaded ${currentData.length} unique merchants (${rawData.length - currentData.length} duplicates merged)`);
        } else {
            console.error(`❌ [Dashboard] Failed to fetch results: ${response.status}`);
            currentData = [];
        }
        
        await populateFilters();
        updateStats();
        applyFilters();
    } catch (error) {
        console.error('❌ [Dashboard] Error loading data:', error);
        // Show empty state instead of sample data
        currentData = [];
        await populateFilters();
        updateStats();
        applyFilters();
    } finally {
        showLoading(false);
    }
}

// Generate sample data for demonstration
function generateSampleData() {
    const sampleMerchants = [
        { name: 'Body Kitchen', url: 'https://www.bodykitchen.com', category: 'Health & Beauty' },
        { name: 'CMY Cubes', url: 'https://cmycubes.com/pages/faq', category: 'Toys & Games' },
        { name: '525 America', url: 'https://525america.com', category: 'Clothing & Apparel' },
        { name: 'QALO', url: 'https://qalo.com', category: 'Jewelry' },
        { name: 'Natural Vitality', url: 'https://naturalvitality.com', category: 'Vitamins & Supplements' }
    ];

    const statuses = ['success', 'flagged', 'user_passed'];
    const reasons = [
        'Business model detected - functional e-commerce site',
        'Major brand protection - established merchant',
        'Site timeout - failed to load within 30 seconds',
        'User manually reviewed and marked as functional',
        'Nuclear protection - whitelisted merchant'
    ];

    return sampleMerchants.map((merchant, index) => ({
        id: index + 1,
        session_id: 'session-2025-10-29-001',
        merchant_name: merchant.name,
        merchant_url: merchant.url,
        merchant_id: 6745 + index,
        app_id: 451,
        primary_category: merchant.category,
        parent_category: merchant.category,
        max_rate: '3.75',
        max_rate_kind: 'PERCENTAGE',
        test_status: statuses[index % 3],
        test_result: reasons[index % 5],
        error_pattern: index % 3 === 1 ? 'timeout error' : null,
        tested_at: new Date(Date.now() - (index * 3600000)).toISOString(),
        test_duration_ms: 2000 + (index * 500),
        is_user_passed: index % 3 === 2,
        detailed_analysis: `Detailed analysis for ${merchant.name}: ${reasons[index % 5]}`
    }));
}

// Populate filter dropdowns
async function populateFilters() {
    // Populate sessions with session names
    try {
        const response = await fetch('/api/test-sessions');
        if (response.ok) {
            const sessions = await response.json();
            // Create options with session names, but use session_id as value
            const sessionOptions = sessions.map(session => ({
                value: session.session_id,
                text: session.session_name || session.session_id
            }));
            populateSelectWithOptions(elements.sessionFilter, sessionOptions);
        } else {
            // Fallback to session IDs if API fails
            const sessions = [...new Set(currentData.map(item => item.session_id))];
            populateSelect(elements.sessionFilter, sessions);
        }
    } catch (error) {
        console.error('Error loading sessions:', error);
        // Fallback to session IDs if API fails
        const sessions = [...new Set(currentData.map(item => item.session_id))];
        populateSelect(elements.sessionFilter, sessions);
    }

    // Populate categories
    const categories = [...new Set(currentData.map(item => item.primary_category).filter(Boolean))];
    populateSelect(elements.categoryFilter, categories);
}

function populateSelect(selectElement, options) {
    // Keep the first option (All)
    const firstOption = selectElement.children[0];
    selectElement.innerHTML = '';
    selectElement.appendChild(firstOption);

    options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option;
        selectElement.appendChild(optionElement);
    });
}

function populateSelectWithOptions(selectElement, optionsArray) {
    // Keep the first option (All)
    const firstOption = selectElement.children[0];
    selectElement.innerHTML = '';
    selectElement.appendChild(firstOption);

    optionsArray.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = option.text;
        selectElement.appendChild(optionElement);
    });
}

// Update statistics
function updateStats() {
    const total = currentData.length;
    const successful = currentData.filter(item => item.test_status === 'success').length;
    const flagged = currentData.filter(item => item.test_status === 'flagged').length;
    const userPassed = currentData.filter(item => item.is_user_passed).length;

    elements.totalTested.textContent = total;
    elements.totalSuccessful.textContent = successful;
    elements.totalFlagged.textContent = flagged;
    elements.totalUserPassed.textContent = userPassed;
}

// Apply filters and sorting
function applyFilters() {
    // First, deduplicate currentData by merchant_id (safety layer)
    const seenMerchantIds = new Set();
    const deduplicatedData = currentData.filter(item => {
        if (seenMerchantIds.has(item.merchant_id)) {
            console.warn(`⚠️ Duplicate merchant_id ${item.merchant_id} found in frontend, filtering out`);
            return false;
        }
        seenMerchantIds.add(item.merchant_id);
        return true;
    });
    
    // Apply filters to deduplicated data
    filteredData = deduplicatedData.filter(item => {
        // Session filter
        if (elements.sessionFilter.value && item.session_id !== elements.sessionFilter.value) {
            return false;
        }

        // Status filter
        if (elements.statusFilter.value) {
            if (elements.statusFilter.value === 'user_passed' && !item.is_user_passed) {
                return false;
            } else if (elements.statusFilter.value !== 'user_passed' && item.test_status !== elements.statusFilter.value) {
                return false;
            }
        }

        // Category filter
        if (elements.categoryFilter.value && item.primary_category !== elements.categoryFilter.value) {
            return false;
        }

        // Search filter
        if (elements.searchFilter.value) {
            const searchTerm = elements.searchFilter.value.toLowerCase();
            if (!item.merchant_name.toLowerCase().includes(searchTerm) && 
                !item.merchant_url.toLowerCase().includes(searchTerm)) {
                return false;
            }
        }

        // Date filters
        if (elements.dateFrom.value) {
            const fromDate = new Date(elements.dateFrom.value);
            const itemDate = new Date(item.tested_at);
            if (itemDate < fromDate) {
                return false;
            }
        }

        if (elements.dateTo.value) {
            const toDate = new Date(elements.dateTo.value);
            toDate.setHours(23, 59, 59, 999); // End of day
            const itemDate = new Date(item.tested_at);
            if (itemDate > toDate) {
                return false;
            }
        }

        return true;
    });

    // Sort data
    filteredData.sort((a, b) => {
        let aVal = a[sortField];
        let bVal = b[sortField];

        // Handle different data types
        if (sortField === 'tested_at') {
            aVal = new Date(aVal);
            bVal = new Date(bVal);
        } else if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
        }

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    currentPage = 1;
    renderResults();
    updatePagination();
}

// Render results based on current view
function renderResults() {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredData.slice(startIndex, endIndex);

    elements.resultsCount.textContent = `${filteredData.length} result${filteredData.length !== 1 ? 's' : ''}`;

    if (elements.tableView.style.display !== 'none') {
        renderTableView(pageData);
    } else {
        renderCardView(pageData);
    }
}

// Generate media icons for screenshots and videos
function getMediaIcons(item) {
    let mediaIcons = '';
    
    if (item.screenshot_path) {
        mediaIcons += `
            <button class="media-icon screenshot-icon" onclick="showMedia('${item.screenshot_path}', 'screenshot')" title="View Screenshot">
                <i class="fas fa-camera"></i>
            </button>
        `;
    }
    
    if (item.video_path) {
        mediaIcons += `
            <button class="media-icon video-icon" onclick="showMedia('${item.video_path}', 'video')" title="View Video">
                <i class="fas fa-video"></i>
            </button>
        `;
    }
    
    return mediaIcons;
}

// Generate status change buttons
function getStatusChangeButtons(item) {
    const currentStatus = item.is_user_passed ? 'success' : item.test_status;
    
    if (currentStatus === 'success') {
        return `
            <button class="status-change-btn btn-flag" onclick="changeResultStatus(${item.merchant_id}, '${item.session_id}', 'flagged')" title="Mark as Flagged">
                <i class="fas fa-flag"></i>
            </button>
        `;
    } else {
        return `
            <button class="status-change-btn btn-success" onclick="changeResultStatus(${item.merchant_id}, '${item.session_id}', 'success')" title="Mark as Success">
                <i class="fas fa-check"></i>
            </button>
        `;
    }
}

// Show detailed result card modal for dashboard
function showResultDetailsModal(item) {
    // Create or get modal
    let modal = document.getElementById('result-details-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'result-details-modal';
        modal.className = 'media-modal';
        document.body.appendChild(modal);
    }
    
    // Build media section
    let mediaSection = '';
    if (item.screenshot_path) {
        mediaSection += `
            <div class="detail-media-item">
                <h4><i class="fas fa-camera"></i> Screenshot</h4>
                <div class="detail-screenshot-preview" onclick="event.stopPropagation(); showMedia('${item.screenshot_path}', 'screenshot')">
                    <img src="/${item.screenshot_path.startsWith('media/') ? item.screenshot_path : 'media/' + item.screenshot_path}" alt="Website Screenshot" onerror="this.parentElement.innerHTML='<p>Screenshot not available</p>'">
                    <div class="detail-screenshot-overlay">
                        <i class="fas fa-search-plus"></i> Click to view full size
                    </div>
                </div>
            </div>
        `;
    }
    
    if (item.video_path) {
        mediaSection += `
            <div class="detail-media-item">
                <h4><i class="fas fa-video"></i> Recording</h4>
                <button class="btn btn-secondary" onclick="showMedia('${item.video_path}', 'video')">
                    <i class="fas fa-play"></i> Watch Recording
                </button>
            </div>
        `;
    }
    
    if (!item.screenshot_path && !item.video_path) {
        mediaSection = '<p class="no-media"><i class="fas fa-info-circle"></i> No media available for this result</p>';
    }
    
    // Create status change buttons
    const statusButtons = (item.is_user_passed ||item.test_status === 'success')
        ? `<button class="status-change-btn btn-flag" onclick="changeResultStatus(${item.merchant_id}, '${item.session_id}', 'flagged'); document.getElementById('result-details-modal').style.display='none';" title="Mark as Flagged">
            <i class="fas fa-flag"></i> Mark as Flagged
           </button>`
        : `<button class="status-change-btn btn-success" onclick="changeResultStatus(${item.merchant_id}, '${item.session_id}', 'success'); document.getElementById('result-details-modal').style.display='none';" title="Mark as Success">
            <i class="fas fa-check"></i> Mark as Success
           </button>`;
    
    const statusClass = (item.is_user_passed || item.test_status === 'success') ? 'success' : 'flagged';
    const statusIcon = (item.is_user_passed || item.test_status === 'success') ? 'check-circle' : 'exclamation-triangle';
    const status = (item.is_user_passed || item.test_status === 'success') ? 'SUCCESS' : 'FLAGGED';
    
    modal.innerHTML = `
        <div class="media-modal-content result-detail-card">
            <div class="media-modal-header">
                <h3><i class="fas fa-info-circle"></i> Test Result Details</h3>
                <span class="media-modal-close" onclick="document.getElementById('result-details-modal').style.display='none'">&times;</span>
            </div>
            <div class="result-detail-body">
                <div class="detail-section">
                    <div class="detail-header">
                        <h2>${escapeHtml(item.merchant_name)}</h2>
                        <span class="detail-status ${statusClass}">
                            <i class="fas fa-${statusIcon}"></i> ${status}
                        </span>
                    </div>
                    
                    <div class="detail-info-grid">
                        <div class="detail-info-item">
                            <span class="detail-label"><i class="fas fa-globe"></i> Domain</span>
                            <span class="detail-value">${item.merchant_url ? new URL(item.merchant_url).hostname : 'No domain'}</span>
                        </div>
                        <div class="detail-info-item">
                            <span class="detail-label"><i class="fas fa-link"></i> URL</span>
                            <span class="detail-value"><a href="${item.merchant_url}" target="_blank" rel="noopener noreferrer">${item.merchant_url || 'N/A'}</a></span>
                        </div>
                        <div class="detail-info-item">
                            <span class="detail-label"><i class="fas fa-hashtag"></i> Merchant ID</span>
                            <span class="detail-value">${item.merchant_id || 'N/A'}</span>
                        </div>
                        <div class="detail-info-item">
                            <span class="detail-label"><i class="fas fa-tags"></i> Category</span>
                            <span class="detail-value">${escapeHtml(item.primary_category || 'N/A')}</span>
                        </div>
                        <div class="detail-info-item">
                            <span class="detail-label"><i class="fas fa-clock"></i> Tested At</span>
                            <span class="detail-value">${formatDate(item.tested_at)}</span>
                        </div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4><i class="fas fa-clipboard-list"></i> Test Result</h4>
                    <div class="detail-reason-box ${statusClass}">
                        ${escapeHtml(item.test_result || 'No result provided')}
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
    const modal = document.createElement('div');
    modal.className = 'media-modal';
    modal.id = 'dashboard-media-modal';
    
    // Clean up path - remove leading slash or 'media/' if already present
    const cleanPath = mediaPath.startsWith('/') ? mediaPath.substring(1) : mediaPath;
    const finalPath = cleanPath.startsWith('media/') ? `/${cleanPath}` : `/media/${cleanPath}`;
    
    modal.innerHTML = `
        <div class="media-modal-content">
            <div class="media-modal-header">
                <div class="media-modal-controls" id="dashboard-media-controls">
                    <button class="media-btn" id="dashboard-zoom-in-btn" title="Zoom In (Ctrl+)"><i class="fas fa-search-plus"></i></button>
                    <button class="media-btn" id="dashboard-zoom-out-btn" title="Zoom Out (Ctrl-)"><i class="fas fa-search-minus"></i></button>
                    <button class="media-btn" id="dashboard-reset-zoom-btn" title="Reset Zoom"><i class="fas fa-expand"></i></button>
                    <div class="zoom-slider-container" id="dashboard-zoom-slider-container">
                        <span class="zoom-label">50%</span>
                        <input type="range" id="dashboard-zoom-slider" class="zoom-slider" min="50" max="300" value="100" step="5">
                        <span class="zoom-label">300%</span>
                    </div>
                    <button class="media-btn" id="dashboard-download-btn" title="Download"><i class="fas fa-download"></i></button>
                </div>
                <button class="media-modal-close" id="dashboard-close-btn">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="media-container" id="dashboard-media-container"></div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const container = document.getElementById('dashboard-media-container');
    const zoomSliderContainer = document.getElementById('dashboard-zoom-slider-container');
    const zoomSlider = document.getElementById('dashboard-zoom-slider');
    let zoomLevel = 1;
    let translateX = 0;
    let translateY = 0;
    
    // Keyboard zoom handler
    const keyboardZoomHandler = (e) => {
        if ((e.ctrlKey || e.metaKey) && mediaType === 'screenshot') {
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
    
    // Close handlers
    const closeModal = () => {
        document.removeEventListener('keydown', keyboardZoomHandler);
        document.body.removeChild(modal);
    };
    
    document.getElementById('dashboard-close-btn').onclick = closeModal;
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeModal();
        }
    };
    
    if (mediaType === 'screenshot') {
        // Display image at natural size (100%) with scrolling, no max constraints
        container.innerHTML = `<img id="dashboard-media-img" src="${finalPath}" alt="Screenshot" style="width: 100%; height: auto; display: block; transform: scale(1); transition: transform 0.2s; cursor: default;">`;
        
        const img = document.getElementById('dashboard-media-img');
        
        // Show zoom controls
        zoomSliderContainer.style.display = 'flex';
        document.getElementById('dashboard-zoom-in-btn').style.display = 'inline-flex';
        document.getElementById('dashboard-zoom-out-btn').style.display = 'inline-flex';
        document.getElementById('dashboard-reset-zoom-btn').style.display = 'inline-flex';
        
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
        document.getElementById('dashboard-zoom-in-btn').onclick = () => {
            zoomLevel = Math.min(zoomLevel + 0.25, 3);
            updateZoom();
        };
        
        // Zoom out button
        document.getElementById('dashboard-zoom-out-btn').onclick = () => {
            zoomLevel = Math.max(zoomLevel - 0.25, 0.5);
            updateZoom();
        };
        
        // Reset zoom button
        document.getElementById('dashboard-reset-zoom-btn').onclick = () => {
            zoomLevel = 1;
            translateX = 0;
            translateY = 0;
            img.style.cursor = 'default';
            updateZoom();
        };
        
        // Zoom slider
        zoomSlider.addEventListener('input', (e) => {
            zoomLevel = parseInt(e.target.value) / 100;
            img.style.transform = `scale(${zoomLevel}) translate(${translateX}px, ${translateY}px)`;
            
            if (zoomLevel > 1) {
                img.style.cursor = 'grab';
            } else {
                img.style.cursor = 'default';
                translateX = 0;
                translateY = 0;
                img.style.transform = `scale(${zoomLevel}) translate(0px, 0px)`;
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
        document.getElementById('dashboard-download-btn').onclick = () => {
            const link = document.createElement('a');
            link.href = finalPath;
            link.download = mediaPath.split('/').pop();
            link.click();
        };
    } else if (mediaType === 'video') {
        container.innerHTML = `
            <video controls style="max-width: 100%; max-height: 80vh;">
                <source src="${finalPath}" type="video/webm">
                Your browser does not support the video tag.
            </video>
        `;
        
        // Hide zoom controls for video
        zoomSliderContainer.style.display = 'none';
        document.getElementById('dashboard-zoom-in-btn').style.display = 'none';
        document.getElementById('dashboard-zoom-out-btn').style.display = 'none';
        document.getElementById('dashboard-reset-zoom-btn').style.display = 'none';
        
        // Download button
        document.getElementById('dashboard-download-btn').onclick = () => {
            const link = document.createElement('a');
            link.href = finalPath;
            link.download = mediaPath.split('/').pop();
            link.click();
        };
    }
}

// Render table view
function renderTableView(data) {
    elements.resultsTbody.innerHTML = '';

    data.forEach(item => {
        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.onclick = () => showResultDetailsModal(item);
        row.innerHTML = `
            <td>
                <div class="font-bold">${escapeHtml(item.merchant_name)}</div>
                ${item.merchant_id ? `<div class="text-muted">ID: ${item.merchant_id}</div>` : ''}
            </td>
            <td>
                <span class="status-badge status-${getStatusClass(item)}">
                    ${getStatusDisplay(item)}
                </span>
            </td>
            <td>${escapeHtml(item.primary_category || 'N/A')}</td>
            <td>${formatDate(item.tested_at)}</td>
            <td>
                <a href="${item.merchant_url}" target="_blank" class="url-link" onclick="event.stopPropagation()">
                    ${truncateUrl(item.merchant_url)}
                </a>
            </td>
            <td onclick="event.stopPropagation()">
                <div class="action-buttons">
                    ${getStatusChangeButtons(item)}
                    ${getMediaIcons(item)}
                    <button class="details-btn" onclick="showDetails(${item.id})">
                        <i class="fas fa-eye"></i> View
                    </button>
                </div>
            </td>
        `;
        elements.resultsTbody.appendChild(row);
    });
}

// Render card view
function renderCardView(data) {
    elements.cardView.innerHTML = '';

    data.forEach(item => {
        const card = document.createElement('div');
        card.className = 'merchant-card';
        card.onclick = (e) => {
            // Don't show details if clicking on media icons
            if (!e.target.closest('.media-icon')) {
                showDetails(item.id);
            }
        };
        
        card.innerHTML = `
            <div class="card-header">
                <div>
                    <div class="card-title">${escapeHtml(item.merchant_name)}</div>
                    <div class="card-url">${truncateUrl(item.merchant_url)}</div>
                </div>
                <span class="status-badge status-${getStatusClass(item)}">
                    ${getStatusDisplay(item)}
                </span>
            </div>
            <div class="card-body">
                <div class="card-category">${escapeHtml(item.primary_category || 'N/A')}</div>
                <div class="card-result">${escapeHtml(truncateText(item.test_result, 100))}</div>
            </div>
            <div class="card-footer">
                <div class="card-footer-left">
                    <span>${formatDate(item.tested_at)}</span>
                    <span>${item.test_duration_ms ? `${item.test_duration_ms}ms` : ''}</span>
                </div>
                <div class="card-footer-right">
                    ${getStatusChangeButtons(item)}
                    ${getMediaIcons(item)}
                </div>
            </div>
        `;
        
        elements.cardView.appendChild(card);
    });
}

// Show detailed modal
function showDetails(itemId) {
    const item = currentData.find(i => i.id === itemId);
    if (!item) return;

    elements.modalTitle.textContent = item.merchant_name;
    elements.modalBody.innerHTML = `
        <div class="detail-grid">
            <div class="detail-item">
                <div class="detail-label">Status</div>
                <div class="detail-value">
                    <span class="status-badge status-${getStatusClass(item)}">
                        ${getStatusDisplay(item)}
                    </span>
                </div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Category</div>
                <div class="detail-value">${escapeHtml(item.primary_category || 'N/A')}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Tested At</div>
                <div class="detail-value">${formatDate(item.tested_at)}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Duration</div>
                <div class="detail-value">${item.test_duration_ms ? `${item.test_duration_ms}ms` : 'N/A'}</div>
            </div>
        </div>

        <div class="detail-section">
            <h4>URL</h4>
            <p><a href="${item.merchant_url}" target="_blank" class="url-link">${item.merchant_url}</a></p>
        </div>

        <div class="detail-section">
            <h4>Test Result</h4>
            <p>${escapeHtml(item.test_result)}</p>
        </div>

        ${item.detailed_analysis ? `
            <div class="detail-section">
                <h4>Detailed Analysis</h4>
                <p>${escapeHtml(item.detailed_analysis)}</p>
            </div>
        ` : ''}

        ${item.error_pattern ? `
            <div class="detail-section">
                <h4>Error Pattern</h4>
                <p>${escapeHtml(item.error_pattern)}</p>
            </div>
        ` : ''}

        ${item.max_rate ? `
            <div class="detail-section">
                <h4>Merchant Info</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">Max Rate</div>
                        <div class="detail-value">${item.max_rate}${item.max_rate_kind === 'PERCENTAGE' ? '%' : ''}</div>
                    </div>
                    ${item.merchant_id ? `
                        <div class="detail-item">
                            <div class="detail-label">Merchant ID</div>
                            <div class="detail-value">${item.merchant_id}</div>
                        </div>
                    ` : ''}
                </div>
            </div>
        ` : ''}
    `;

    elements.modal.style.display = 'block';
}

// Close modal
function closeModal() {
    elements.modal.style.display = 'none';
}

// Switch between table and card view
function switchView(view) {
    if (view === 'table') {
        elements.tableView.style.display = 'block';
        elements.cardView.style.display = 'none';
        elements.tableViewBtn.classList.add('active');
        elements.cardViewBtn.classList.remove('active');
    } else {
        elements.tableView.style.display = 'none';
        elements.cardView.style.display = 'grid';
        elements.tableViewBtn.classList.remove('active');
        elements.cardViewBtn.classList.add('active');
    }
    renderResults();
}

// Pagination
function changePage(page) {
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    renderResults();
    updatePagination();
}

function updatePagination() {
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    
    elements.prevPageBtn.disabled = currentPage <= 1;
    elements.nextPageBtn.disabled = currentPage >= totalPages;
    elements.pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
}

// Clear all filters
function clearFilters() {
    elements.sessionFilter.value = '';
    elements.statusFilter.value = '';
    elements.categoryFilter.value = '';
    elements.searchFilter.value = '';
    elements.dateFrom.value = '';
    elements.dateTo.value = '';
    applyFilters();
}

// Export to CSV
function exportToCSV() {
    const headers = [
        'Merchant Name', 'URL', 'Status', 'Category', 'Test Result', 
        'Tested At', 'Duration (ms)', 'User Passed', 'Session ID'
    ];
    
    const csvContent = [
        headers.join(','),
        ...filteredData.map(item => [
            `"${item.merchant_name.replace(/"/g, '""')}"`,
            `"${item.merchant_url}"`,
            `"${getStatusDisplay(item)}"`,
            `"${item.primary_category || ''}"`,
            `"${item.test_result.replace(/"/g, '""')}"`,
            `"${formatDate(item.tested_at)}"`,
            item.test_duration_ms || '',
            item.is_user_passed ? 'Yes' : 'No',
            `"${item.session_id}"`
        ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `merchant-test-results-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

// Utility functions
function showLoading(show) {
    elements.loading.style.display = show ? 'block' : 'none';
}

// Change result status (success <-> flagged)
async function changeResultStatus(merchantId, sessionId, newStatus) {
    try {
        console.log(`Changing status for merchant ${merchantId} to ${newStatus} in session ${sessionId}`);
        
        const response = await fetch(`/api/merchant-results/${merchantId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                status: newStatus,
                session_id: sessionId 
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }
        
        // Reload data to reflect changes
        await loadData();
        
        // Show success message
        const message = document.createElement('div');
        message.className = 'toast-message success';
        message.textContent = `Merchant marked as ${newStatus}`;
        document.body.appendChild(message);
        
        setTimeout(() => message.remove(), 3000);
    } catch (error) {
        console.error('Error changing status:', error);
        
        // Show error message
        const message = document.createElement('div');
        message.className = 'toast-message error';
        message.textContent = `Failed: ${error.message}`;
        document.body.appendChild(message);
        
        setTimeout(() => message.remove(), 3000);
    }
}

function getStatusClass(item) {
    if (item.is_user_passed) return 'user-passed';
    return item.test_status === 'success' ? 'success' : 'flagged';
}

function getStatusDisplay(item) {
    if (item.is_user_passed) return 'User Passed';
    return item.test_status === 'success' ? 'Success' : 'Flagged';
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleString();
}

function truncateUrl(url) {
    return url.length > 50 ? url.substring(0, 47) + '...' : url;
}

function truncateText(text, maxLength) {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateSortIcons() {
    document.querySelectorAll('.sortable i').forEach(icon => {
        icon.className = 'fas fa-sort';
    });
    
    const activeHeader = document.querySelector(`[data-sort="${sortField}"] i`);
    if (activeHeader) {
        activeHeader.className = `fas fa-sort-${sortDirection === 'asc' ? 'up' : 'down'}`;
    }
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

// Reset results and filters function (clears all data from UI AND database)
async function resetResults() {
    // Confirm deletion - always delete ALL results from all sessions
    const message = `Delete ALL test results from the database?\n\nThis will:\n• Delete all ${currentData.length} displayed results\n• Delete all test results from ALL sessions\n• Keep merchant master data (merchants remain in system)\n• Clear the UI\n• Cannot be undone\n\nDelete permanently?`;
    
    const confirmReset = confirm(message);
    
    if (!confirmReset) {
        return;
    }
    
    try {
        elements.resetResultsBtn.disabled = true;
        elements.resetResultsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
        
        // Delete ALL test results and sessions from database
        console.log(`🗑️ [Dashboard] Deleting ALL test results from database`);
        
        const response = await fetch('/api/clear-all-results', {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to clear results: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('✅ [Dashboard] All test results deleted from database');
        console.log(`🗑️ [Dashboard] Deleted ${result.deletedScreenshots || 0} screenshots and ${result.deletedVideos || 0} videos`);
        
        // Clear localStorage
        localStorage.removeItem('active_test_session');
        localStorage.setItem('dashboard_cleared', 'true');
        dataClearedManually = true;
        
        console.log('🧹 [Dashboard] Clearing all data from UI');
        
        // Clear all data arrays
        currentData = [];
        filteredData = [];
        
        // Clear all filters
        if (elements.sessionFilter) {
            elements.sessionFilter.innerHTML = '<option value="">All Sessions</option>';
            elements.sessionFilter.value = '';
        }
        if (elements.statusFilter) elements.statusFilter.value = '';
        if (elements.categoryFilter) {
            elements.categoryFilter.innerHTML = '<option value="">All Categories</option>';
            elements.categoryFilter.value = '';
        }
        if (elements.searchFilter) elements.searchFilter.value = '';
        if (elements.dateFrom) elements.dateFrom.value = '';
        if (elements.dateTo) elements.dateTo.value = '';
        
        // Reset pagination
        currentPage = 1;
        
        // Reset all statistics to zero
        elements.totalTested.textContent = '0';
        elements.totalSuccessful.textContent = '0';
        elements.totalFlagged.textContent = '0';
        elements.totalUserPassed.textContent = '0';
        
        // Clear results table
        elements.resultsTbody.innerHTML = '<tr><td colspan="8" class="no-results">No test results found</td></tr>';
        elements.resultsCount.textContent = '0 results';
        
        // Reset pagination display
        elements.pageInfo.textContent = 'Page 0 of 0';
        elements.prevPageBtn.disabled = true;
        elements.nextPageBtn.disabled = true;
        
        // Show success message
        alert('✅ Results permanently deleted from database and UI cleared!');
        
    } catch (error) {
        console.error('Error deleting results:', error);
        alert('❌ Error deleting results: ' + error.message);
    } finally {
        elements.resetResultsBtn.disabled = false;
        elements.resetResultsBtn.innerHTML = '<i class="fas fa-broom"></i> Clear Results';
    }
}

// Auto-refresh functionality for live test updates
function startPolling() {
    // Check if there's an active test session
    checkForActiveTest();
    
    // Poll every 3 seconds
    pollInterval = setInterval(checkForActiveTest, 3000);
}

async function checkForActiveTest() {
    try {
        const activeSession = localStorage.getItem('active_test_session');
        
        if (activeSession) {
            // There's an active test - check its status
            const sessionData = JSON.parse(activeSession);
            const response = await fetch(`/api/sessions/${sessionData.sessionId}/status`);
            
            if (response.ok) {
                const data = await response.json();
                
                // If test is running or paused, refresh data in real-time
                if (data.status === 'running' || data.status === 'paused') {
                    console.log(`🔄 Active test running - session ${sessionData.sessionId} - refreshing dashboard...`);
                    // Clear the manually cleared flag since we have an active test
                    dataClearedManually = false;
                    localStorage.removeItem('dashboard_cleared');
                    
                    // Force reload from THIS session only
                    await loadData();
                    
                    // Make sure to show the loading spinner briefly
                    showLoading(false);
                    
                } else if (data.status === 'completed' || data.status === 'stopped') {
                    console.log(`✅ Test ${data.status} - session ${sessionData.sessionId} - final refresh`);
                    // Clear the manually cleared flag for final refresh
                    dataClearedManually = false;
                    localStorage.removeItem('dashboard_cleared');
                    
                    // Load final results from this session
                    await loadData();
                    
                    // Stop polling after test is done
                    stopPolling();
                }
            } else {
                // ✅ DON'T clear localStorage - session might just be new/not written yet
                console.log('⚠️ Session not found in database yet - will check again next poll');
                // Keep polling - the session might appear soon
            }
        } else {
            console.log('ℹ️ No active test session - stopping polling');
            stopPolling();
        }
    } catch (error) {
        console.error('Error checking for active test:', error);
    }
}

function stopPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

// Stop polling when page is hidden (save resources)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopPolling();
    } else {
        startPolling();
    }
});
