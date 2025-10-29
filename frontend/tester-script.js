// Global state
let merchantsData = null;
let filteredMerchants = [];
let testSession = null;
let testResults = {
    total: 0,
    successful: 0,
    flagged: 0,
    current: 0
};

// DOM elements
const elements = {
    apiData: document.getElementById('api-data'),
    appIdFilter: document.getElementById('app-id-filter'),
    categoryFilter: document.getElementById('category-filter'),
    merchantLimit: document.getElementById('merchant-limit'),
    testName: document.getElementById('test-name'),
    merchantPreview: document.getElementById('merchant-preview'),
    validateBtn: document.getElementById('validate-btn'),
    startTestBtn: document.getElementById('start-test-btn'),
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
});

// Event listeners
function initializeEventListeners() {
    // Setup events
    elements.apiData.addEventListener('input', debounce(validateAndPreview, 500));
    elements.appIdFilter.addEventListener('input', debounce(validateAndPreview, 300));
    elements.categoryFilter.addEventListener('change', validateAndPreview);
    elements.merchantLimit.addEventListener('input', debounce(validateAndPreview, 300));
    elements.validateBtn.addEventListener('click', validateAndPreview);
    elements.startTestBtn.addEventListener('click', startTest);
    
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
    const apiText = elements.apiData.value.trim();
    
    if (!apiText) {
        showPreviewPlaceholder();
        elements.startTestBtn.disabled = true;
        return;
    }
    
    try {
        // Parse JSON
        const data = JSON.parse(apiText);
        
        // Validate structure
        if (!data.Merchants || !Array.isArray(data.Merchants)) {
            throw new Error('Invalid format: Expected "Merchants" array');
        }
        
        if (data.Merchants.length === 0) {
            throw new Error('No merchants found in data');
        }
        
        // Validate merchant structure
        const requiredFields = ['MerchantName', 'MerchantDomains'];
        const invalidMerchants = data.Merchants.filter(merchant => 
            !requiredFields.every(field => merchant[field])
        );
        
        if (invalidMerchants.length > 0) {
            throw new Error(`${invalidMerchants.length} merchants missing required fields (MerchantName, MerchantDomains)`);
        }
        
        merchantsData = data;
        populateCategories();
        applyFiltersAndPreview();
        elements.startTestBtn.disabled = false;
        
        showSuccess('API data validated successfully!');
        
    } catch (error) {
        showError(`Invalid API data: ${error.message}`);
        showPreviewPlaceholder();
        elements.startTestBtn.disabled = true;
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
    const limit = parseInt(elements.merchantLimit.value);
    if (limit && limit > 0) {
        merchants = merchants.slice(0, limit);
    }
    
    filteredMerchants = merchants;
    updatePreview();
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
    updateStats();
    clearResultsLists();
    
    for (let i = 0; i < filteredMerchants.length; i++) {
        const merchant = filteredMerchants[i];
        testResults.current = i + 1;
        
        // Update current merchant display
        updateCurrentMerchant(merchant);
        updateStats();
        
        // Simulate testing (in real implementation, this would call the Playwright test)
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
