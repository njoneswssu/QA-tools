// Global state
let currentData = [];
let filteredData = [];
let currentPage = 1;
let itemsPerPage = 50;
let sortField = 'tested_at';
let sortDirection = 'desc';

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
    initializeEventListeners();
    loadData();
});

// Event listeners
function initializeEventListeners() {
    // Filter events
    elements.sessionFilter.addEventListener('change', applyFilters);
    elements.statusFilter.addEventListener('change', applyFilters);
    elements.categoryFilter.addEventListener('change', applyFilters);
    elements.searchFilter.addEventListener('input', debounce(applyFilters, 300));
    elements.dateFrom.addEventListener('change', applyFilters);
    elements.dateTo.addEventListener('change', applyFilters);

    // Button events
    elements.refreshBtn.addEventListener('click', loadData);
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
    showLoading(true);
    try {
        const response = await fetch('/api/merchant-results');
        if (response.ok) {
            const data = await response.json();
            // Only use actual test results, not sample data
            currentData = Array.isArray(data) ? data : (data.data || []);
        } else {
            // No fallback to sample data - show empty state
            currentData = [];
        }
        
        populateFilters();
        updateStats();
        applyFilters();
    } catch (error) {
        console.error('Error loading data:', error);
        // Show empty state instead of sample data
        currentData = [];
        populateFilters();
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
function populateFilters() {
    // Populate sessions
    const sessions = [...new Set(currentData.map(item => item.session_id))];
    populateSelect(elements.sessionFilter, sessions);

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
    filteredData = currentData.filter(item => {
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

// Render table view
function renderTableView(data) {
    elements.resultsTbody.innerHTML = '';

    data.forEach(item => {
        const row = document.createElement('tr');
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
                <a href="${item.merchant_url}" target="_blank" class="url-link">
                    ${truncateUrl(item.merchant_url)}
                </a>
            </td>
            <td>
                <button class="details-btn" onclick="showDetails(${item.id})">
                    <i class="fas fa-eye"></i> View
                </button>
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
        card.onclick = () => showDetails(item.id);
        
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
                <span>${formatDate(item.tested_at)}</span>
                <span>${item.test_duration_ms ? `${item.test_duration_ms}ms` : ''}</span>
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

// Reset results and filters function (clears all data and shows zero results)
function resetResults() {
    const confirmReset = confirm('Clear all results and reset to zero?\n\nThis will clear all displayed results and reset statistics to zero. Database data will remain safe.');
    
    if (!confirmReset) {
        return;
    }
    
    try {
        elements.resetResultsBtn.disabled = true;
        elements.resetResultsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resetting...';
        
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
        alert('✅ Results cleared successfully! All data reset to zero.');
        
    } catch (error) {
        console.error('Error resetting results:', error);
        alert('❌ Error resetting results: ' + error.message);
    } finally {
        elements.resetResultsBtn.disabled = false;
        elements.resetResultsBtn.innerHTML = '<i class="fas fa-broom"></i> Clear Results';
    }
}
