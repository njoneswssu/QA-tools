// Global state
let products = [];
let selectedProducts = new Set();
let testResults = [];

// DOM elements
const productDropdownBtn = document.getElementById('productDropdownBtn');
const productDropdown = document.getElementById('productDropdown');
const productList = document.getElementById('productList');
const productSearch = document.getElementById('productSearch');
const checkAllProducts = document.getElementById('checkAllProducts');
const startTestBtn = document.getElementById('startTestBtn');
const testAllBtn = document.getElementById('testAllBtn');
const stopTestBtn = document.getElementById('stopTestBtn');
const refreshResultsBtn = document.getElementById('refreshResultsBtn');
const clearResultsBtn = document.getElementById('clearResultsBtn');
const loading = document.getElementById('loading');
const resultsGrid = document.getElementById('resultsGrid');
const selectedCount = document.getElementById('selectedCount');
const dateFilter = document.getElementById('dateFilter');
const clearDateFilter = document.getElementById('clearDateFilter');
const collapseProductsBtn = document.getElementById('collapseProductsBtn');
const collapseProductsIcon = document.getElementById('collapseProductsIcon');
const productsToTestContent = document.getElementById('productsToTestContent');
const resultsSearch = document.getElementById('resultsSearch');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const stats = {
    totalTests: document.getElementById('totalTests'),
    totalProducts: document.getElementById('totalProducts'),
    avgPromo: document.getElementById('avgPromo')
};

// Modal elements
const screenshotModal = document.getElementById('screenshotModal');
const closeModal = document.getElementById('closeModal');
const modalImage = document.getElementById('modalImage');
const modalTitle = document.getElementById('modalTitle');

// Test results data
let allTestResults = []; // Store all results for filtering

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    loadTestResults();
    loadStats();
    setupEventListeners();
});

// Event listeners
function setupEventListeners() {
    // Dropdown toggle
    productDropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        productDropdown.classList.toggle('show');
        productDropdownBtn.classList.toggle('active');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!productDropdown.contains(e.target) && !productDropdownBtn.contains(e.target)) {
            productDropdown.classList.remove('show');
            productDropdownBtn.classList.remove('active');
        }
    });

    // Product search
    productSearch.addEventListener('input', filterProducts);

    // Check all
    checkAllProducts.addEventListener('change', (e) => {
        const checkboxes = productList.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = e.target.checked;
            if (e.target.checked) {
                selectedProducts.add(cb.value);
            } else {
                selectedProducts.delete(cb.value);
            }
        });
        updateSelectedCount();
        updateStartButton();
        updateTestAllButton();
    });

    // Start test
    startTestBtn.addEventListener('click', startTesting);
    
    // Test all button
    testAllBtn.addEventListener('click', testAllProducts);

    // Stop test
    stopTestBtn.addEventListener('click', stopTesting);

    // Refresh results
    refreshResultsBtn.addEventListener('click', () => {
        loadTestResults();
        loadStats();
    });
    
    // Date filter
    dateFilter.addEventListener('change', (e) => {
        if (e.target.value) {
            clearDateFilter.style.display = 'inline-block';
            loadTestResults();
        } else {
            clearDateFilter.style.display = 'none';
            loadTestResults();
        }
    });
    
    clearDateFilter.addEventListener('click', () => {
        dateFilter.value = '';
        clearDateFilter.style.display = 'none';
        loadTestResults();
    });
    
    // Collapse products section
    if (collapseProductsBtn && productsToTestContent) {
        let isCollapsed = false;
        collapseProductsBtn.addEventListener('click', () => {
            isCollapsed = !isCollapsed;
            productsToTestContent.style.display = isCollapsed ? 'none' : 'block';
            collapseProductsIcon.textContent = isCollapsed ? '▶' : '▼';
            collapseProductsBtn.title = isCollapsed ? 'Expand' : 'Collapse';
        });
    }
    
    // Search results
    if (resultsSearch) {
        resultsSearch.addEventListener('input', (e) => {
            if (e.target.value.trim()) {
                if (clearSearchBtn) clearSearchBtn.style.display = 'inline-block';
                filterResults();
            } else {
                if (clearSearchBtn) clearSearchBtn.style.display = 'none';
                filterResults();
            }
        });
        
        resultsSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                filterResults();
            }
        });
    }
    
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            if (resultsSearch) resultsSearch.value = '';
            clearSearchBtn.style.display = 'none';
            filterResults();
        });
    }

    // Close modal
    closeModal.addEventListener('click', () => {
        screenshotModal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === screenshotModal) {
            screenshotModal.style.display = 'none';
        }
    });
}

// Load products
async function loadProducts() {
    try {
        const response = await fetch('/api/products');
        products = await response.json();
        renderProductList();
    } catch (error) {
        console.error('Error loading products:', error);
        showError('Failed to load products');
    }
}

// Render product list
function renderProductList() {
    productList.innerHTML = '';
    
    if (products.length === 0) {
        productList.innerHTML = '<div class="product-item" style="padding: 20px; text-align: center; color: #666;">No products found. Add products to get started.</div>';
        return;
    }

    products.forEach(product => {
        const item = document.createElement('div');
        item.className = 'product-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = product.id;
        checkbox.id = `product-${product.id}`;
        checkbox.checked = selectedProducts.has(product.id);
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                selectedProducts.add(product.id);
            } else {
                selectedProducts.delete(product.id);
                checkAllProducts.checked = false;
            }
            updateSelectedCount();
            updateStartButton();
            updateTestAllButton();
        });

        // Format product name: add " shutters" to French door products
        let displayProductName = product.name || product.model || 'Unknown Product';
        if (displayProductName && displayProductName.toLowerCase().includes('french door') && !displayProductName.toLowerCase().includes('shutters')) {
            displayProductName = displayProductName + ' Shutters';
        }
        
        const label = document.createElement('label');
        label.htmlFor = `product-${product.id}`;
        label.innerHTML = `
            ${displayProductName}
            ${product.model ? `<span class="product-model">(${product.model})</span>` : ''}
        `;

        item.appendChild(checkbox);
        item.appendChild(label);
        productList.appendChild(item);
    });

    updateSelectedCount();
    updateStartButton();
    updateTestAllButton();
}

// Filter products
function filterProducts() {
    const searchTerm = productSearch.value.toLowerCase();
    const items = productList.querySelectorAll('.product-item');
    
    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(searchTerm) ? 'flex' : 'none';
    });
}

// Update selected count
function updateSelectedCount() {
    const count = selectedProducts.size;
    selectedCount.textContent = `${count} product${count !== 1 ? 's' : ''} selected`;
    
    // Update check all state
    const checkboxes = productList.querySelectorAll('input[type="checkbox"]:not(#checkAllProducts)');
    const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    checkAllProducts.checked = checkedCount > 0 && checkedCount === checkboxes.length;
    checkAllProducts.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
}

// Update start button
function updateStartButton() {
    startTestBtn.disabled = selectedProducts.size === 0;
}

function updateTestAllButton() {
    testAllBtn.disabled = selectedProducts.size === 0;
}

// Global variable to track polling
let statusPollInterval = null;

// Start testing - shows product links instead of auto-testing
async function startTesting() {
    if (selectedProducts.size === 0) {
        alert('Please select at least one product to test');
        return;
    }

    loading.style.display = 'block';
    startTestBtn.disabled = true;
    resultsGrid.innerHTML = '';

    try {
        const response = await fetch('/api/test/prepare', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                productIds: Array.from(selectedProducts)
            })
        });

        const data = await response.json();
        
        if (response.ok) {
            loading.style.display = 'none';
            // Format product names for display (add shutters to French doors)
            const formattedProducts = data.products.map(product => {
                let displayName = product.name || product.model || 'Unknown Product';
                if (displayName && displayName.toLowerCase().includes('french door') && !displayName.toLowerCase().includes('shutters')) {
                    displayName = displayName + ' Shutters';
                }
                return {
                    ...product,
                    displayName: displayName
                };
            });
            displayProductLinks(formattedProducts);
            
            // Start polling for results (with error handling)
            const pollInterval = setInterval(() => {
                loadTestResults().catch(e => console.error('Poll error:', e));
                loadStats().catch(e => console.error('Stats error:', e));
            }, 5000); // Poll every 5 seconds instead of 3
            
            statusPollInterval = pollInterval;
        } else {
            throw new Error(data.error || 'Failed to prepare products');
        }
    } catch (error) {
        console.error('Error preparing products:', error);
        alert('Failed to prepare products: ' + error.message);
        loading.style.display = 'none';
        startTestBtn.disabled = false;
        testAllBtn.disabled = false;
    }
}

// Display product links for testing
function displayProductLinks(products) {
    const productsToTest = document.getElementById('productsToTest');
    const productLinksList = document.getElementById('productLinksList');
    
    productsToTest.style.display = 'block';
    productLinksList.innerHTML = '';
    
    products.forEach(product => {
        const linkItem = document.createElement('div');
        linkItem.className = 'product-link-item';
        // Use displayName if available (from formatted products), otherwise format it
        let displayName = product.displayName || product.name || product.model || 'Unknown Product';
        if (!product.displayName && displayName && displayName.toLowerCase().includes('french door') && !displayName.toLowerCase().includes('shutters')) {
            displayName = displayName + ' Shutters';
        }
        
        linkItem.innerHTML = `
            <div class="product-link-info">
                <h3>${displayName}</h3>
                <p class="product-model">${product.model || 'N/A'}</p>
            </div>
            <div class="product-link-actions">
                <a href="${product.url}" target="_blank" class="open-link-btn">
                    🔗 Open Product Page
                </a>
                <button onclick="startProductTest('${product.id}', event)" class="test-link-btn" data-product-id="${product.id}">
                    🤖 Start Automation
                </button>
            </div>
        `;
        productLinksList.appendChild(linkItem);
    });
}

// Start automation for a single product
async function startProductTest(productId, event = null) {
    try {
        // Find the button element - use event.target if available, otherwise find by data attribute
        let btn = null;
        if (event && event.target) {
            btn = event.target;
        } else {
            // Fallback: find button by data attribute
            btn = document.querySelector(`button[data-product-id="${productId}"]`);
        }
        
        if (!btn) {
            console.error('Could not find button element');
        }
        
        const originalText = btn ? btn.innerHTML : '🤖 Start Automation';
        if (btn) {
            btn.innerHTML = '⏳ Testing...';
            btn.disabled = true;
        }
        
        const response = await fetch(`/api/test/product/${productId}/run`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Poll for completion
            const checkComplete = setInterval(async () => {
                try {
                    await loadTestResults();
                    await loadStats();
                    
                    // Check if test completed (look for new result)
                    // This is a simple check - in production you'd want a better status endpoint
                    clearInterval(checkComplete);
                    if (btn) {
                        btn.innerHTML = '✅ Complete';
                        setTimeout(() => {
                            btn.innerHTML = originalText;
                            btn.disabled = false;
                        }, 3000);
                    }
                } catch (e) {
                    console.error('Error checking status:', e);
                }
            }, 3000);
        } else {
            throw new Error(data.error || 'Failed to start test');
        }
    } catch (error) {
        console.error('Error starting product test:', error);
        alert('Failed to start automation: ' + error.message);
        
        // Re-enable button on error
        const btn = document.querySelector(`button[data-product-id="${productId}"]`);
        if (btn) {
            btn.innerHTML = '🤖 Start Automation';
            btn.disabled = false;
        }
    }
}

// Stop testing
async function stopTesting() {
    if (!confirm('Are you sure you want to stop testing? Current product will complete first.')) {
        return;
    }

    try {
        const response = await fetch('/api/test/stop', {
            method: 'POST'
        });

        const data = await response.json();
        
        if (response.ok) {
            alert('Stop request sent. Testing will stop after current product completes.');
        } else {
            throw new Error(data.error || 'Failed to stop testing');
        }
    } catch (error) {
        console.error('Error stopping test:', error);
        alert('Failed to stop testing: ' + error.message);
    }
}

// Poll testing status
async function pollTestingStatus() {
    const checkStatus = async () => {
        try {
            const response = await fetch('/api/test/status');
            const status = await response.json();
            
            if (!status.isRunning) {
                // Testing has completed
                if (statusPollInterval) {
                    clearInterval(statusPollInterval);
                    statusPollInterval = null;
                }
                
                loading.style.display = 'none';
                startTestBtn.disabled = false;
                startTestBtn.style.display = 'inline-block';
                testAllBtn.disabled = false;
                stopTestBtn.style.display = 'none';
                
                // Final refresh
                loadTestResults();
                loadStats();
            }
        } catch (error) {
            console.error('Error checking status:', error);
        }
    };
    
    // Check status every 2 seconds
    const statusInterval = setInterval(checkStatus, 2000);
    
    // Also check immediately
    checkStatus();
    
    // Clear status polling when testing stops
    setTimeout(() => {
        if (statusInterval) {
            clearInterval(statusInterval);
        }
    }, 600000); // 10 minutes max
}

// Load test results
async function loadTestResults() {
    try {
        // Build URL with optional date filter
        let url = '/api/test-results';
        if (dateFilter && dateFilter.value) {
            url += `?date=${dateFilter.value}`;
        }
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const fetchedResults = await response.json();
        testResults = fetchedResults;
        allTestResults = [...fetchedResults]; // Keep a copy of all results for filtering
        filterResults(); // Apply search filter if active
    } catch (error) {
        console.error('Error loading test results:', error);
        // Only show error if we don't have any results yet (to avoid spam)
        if (testResults.length === 0) {
            showError('Failed to load test results');
        }
    }
}

// Filter and render test results
function filterResults() {
    if (!allTestResults || allTestResults.length === 0) {
        renderTestResults([]);
        return;
    }
    
    let filtered = [...allTestResults];
    
    // Apply search filter
    if (resultsSearch && resultsSearch.value.trim()) {
        const searchTerm = resultsSearch.value.toLowerCase().trim();
        filtered = filtered.filter(result => {
            const productName = (result.product_name || '').toLowerCase();
            const model = (result.model || '').toLowerCase();
            const color = (result.color || '').toLowerCase();
            const testDate = formatDate(result.test_date).toLowerCase();
            
            return productName.includes(searchTerm) ||
                   model.includes(searchTerm) ||
                   color.includes(searchTerm) ||
                   testDate.includes(searchTerm);
        });
    }
    
    testResults = filtered;
    renderTestResults(testResults);
}

// Render test results
function renderTestResults(resultsToRender = null) {
    const results = resultsToRender !== null ? resultsToRender : testResults;
    if (results.length === 0) {
        // Check if a date filter is active
        const hasDateFilter = dateFilter && dateFilter.value;
        let message = 'No test results yet';
        let subMessage = 'Select products and click "Start Testing" to begin';
        
        const hasSearchFilter = resultsSearch && resultsSearch.value.trim();
        
        if (hasDateFilter) {
            // Format the date for display
            const filterDate = new Date(dateFilter.value + 'T00:00:00');
            const formattedDate = filterDate.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
            });
            message = 'No test results found';
            subMessage = `No test results found for ${formattedDate}. Try selecting a different date or clear the filter.`;
        } else if (hasSearchFilter) {
            message = 'No test results found';
            subMessage = `No results match "${resultsSearch.value}". Try a different search term.`;
        }
        
        resultsGrid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <h3>${message}</h3>
                <p>${subMessage}</p>
                ${hasDateFilter ? `<button class="btn btn-secondary" onclick="clearDateFilter.click()" style="margin-top: 15px; margin-right: 10px;">Clear Date Filter</button>` : ''}
                ${hasSearchFilter ? `<button class="btn btn-secondary" onclick="clearSearchBtn.click()" style="margin-top: 15px;">Clear Search</button>` : ''}
            </div>
        `;
        return;
    }

    resultsGrid.innerHTML = '';

    testResults.forEach(result => {
        const card = document.createElement('div');
        card.className = 'result-card';
        card.setAttribute('data-result-id', result.id);

        const promoPercentage = result.promo_percentage 
            ? parseFloat(result.promo_percentage).toFixed(1) 
            : '0';

        // Format product name: remove "Unknown Product", add " shutters" to French door products
        let displayName = result.product_name || result.model || 'N/A';
        if (displayName === 'Unknown Product' || !displayName || displayName.trim() === '') {
            displayName = result.model || 'N/A';
        }
        // Add " shutters" to French door products (case insensitive)
        if (displayName && displayName.toLowerCase().includes('french door') && !displayName.toLowerCase().includes('shutters')) {
            displayName = displayName + ' Shutters';
        }

        card.innerHTML = `
            <div class="result-header">
                <div class="result-title">
                    <h3>${displayName}</h3>
                    <span class="model">${result.model || 'N/A'}</span>
                </div>
                <div class="result-header-right">
                    <div class="promo-badge">${promoPercentage}% OFF</div>
                    <button class="delete-result-btn" onclick="deleteTestResult(${result.id})" title="Delete this result">
                        🗑️
                    </button>
                </div>
            </div>
            <div class="result-details">
                <div class="detail-row">
                    <span class="detail-label">Test Date:</span>
                    <span class="detail-value">${formatDate(result.test_date)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Dimensions:</span>
                    <span class="detail-value">${result.width || 'N/A'}" × ${result.height || 'N/A'}"</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Color:</span>
                    <span class="detail-value">${result.color || 'N/A'}</span>
                </div>
            </div>
            <div class="price-section">
                <div class="price-item">
                    <div class="price-label">Original Price</div>
                    <div class="price-value original">$${formatPrice(result.original_price)}</div>
                </div>
                <div class="price-item">
                    <div class="price-label">Promotional Price</div>
                    <div class="price-value promo">$${formatPrice(result.promotional_price)}</div>
                </div>
            </div>
            ${result.screenshot_url ? `
                <img src="${result.screenshot_url}" 
                     alt="Screenshot" 
                     class="result-screenshot"
                     onclick="showScreenshot('${result.screenshot_url}', '${displayName}')">
            ` : '<div style="padding: 20px; text-align: center; color: #999;">No screenshot available</div>'}
            <div class="result-footer">
                <span>Tested: ${formatDateTime(result.created_at)}</span>
            </div>
        `;

        resultsGrid.appendChild(card);
    });
}

// Screenshot zoom state
let currentZoom = 0.25; // Start at 25% zoom
const minZoom = 0.25;
const maxZoom = 5;
const zoomStep = 0.25;

// Show screenshot in modal
function showScreenshot(url, title) {
    modalImage.src = url;
    modalTitle.textContent = title;
    screenshotModal.style.display = 'block';
    
    // Reset image styles
    modalImage.style.width = 'auto';
    modalImage.style.height = 'auto';
    modalImage.style.maxWidth = 'none';
    modalImage.style.maxHeight = 'none';
    
    // Wait for image to load, then calculate fit-to-window zoom
    modalImage.onload = function() {
        // Small delay to ensure container is rendered
        setTimeout(() => {
            calculateFitZoom();
            updateZoom();
        }, 100);
    };
    
    // If image already loaded
    if (modalImage.complete) {
        setTimeout(() => {
            calculateFitZoom();
            updateZoom();
        }, 100);
    }
}

// Calculate zoom to fit screenshot in container (aim for 25% but ensure it fits)
function calculateFitZoom() {
    const container = document.querySelector('.screenshot-container');
    if (!container || !modalImage.naturalWidth || !modalImage.naturalHeight) return;
    
    const containerWidth = container.clientWidth - 40; // Account for padding
    const containerHeight = container.clientHeight - 40;
    
    const imageWidth = modalImage.naturalWidth;
    const imageHeight = modalImage.naturalHeight;
    
    // Calculate scale to fit container (with some margin)
    const scaleX = (containerWidth * 0.95) / imageWidth; // 95% to leave small margin
    const scaleY = (containerHeight * 0.95) / imageHeight;
    const fitScale = Math.min(scaleX, scaleY);
    
    // Use 25% if it fits, otherwise use the fit scale (but not less than minZoom)
    if (fitScale >= 0.25) {
        currentZoom = 0.25; // Use 25% if it fits
    } else {
        currentZoom = Math.max(fitScale * 0.95, minZoom); // Use slightly smaller to ensure fit
    }
}

// Zoom functions
function updateZoom() {
    const container = document.querySelector('.screenshot-container');
    
    // Calculate scaled dimensions
    const scaledWidth = modalImage.naturalWidth * currentZoom;
    const scaledHeight = modalImage.naturalHeight * currentZoom;
    const containerWidth = container ? container.clientWidth - 40 : window.innerWidth;
    const containerHeight = container ? container.clientHeight - 40 : window.innerHeight;
    
    // Apply transform
    modalImage.style.transform = `scale(${currentZoom})`;
    modalImage.style.transformOrigin = 'center top';
    document.getElementById('zoomLevel').textContent = `${Math.round(currentZoom * 100)}%`;
    
    // Set container overflow based on whether image fits
    if (container) {
        if (scaledWidth <= containerWidth && scaledHeight <= containerHeight) {
            container.style.overflow = 'hidden'; // No scrolling needed
        } else {
            container.style.overflow = 'auto'; // Allow scrolling if zoomed in
        }
    }
}

document.getElementById('zoomIn').addEventListener('click', () => {
    if (currentZoom < maxZoom) {
        currentZoom = Math.min(currentZoom + zoomStep, maxZoom);
        updateZoom();
    }
});

document.getElementById('zoomOut').addEventListener('click', () => {
    if (currentZoom > minZoom) {
        currentZoom = Math.max(currentZoom - zoomStep, minZoom);
        updateZoom();
    }
});

document.getElementById('zoomReset').addEventListener('click', () => {
    calculateFitZoom(); // Recalculate fit-to-window zoom
    updateZoom();
});

// Clear results
clearResultsBtn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to clear all test results? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch('/api/test-results/clear', {
            method: 'DELETE'
        });
        
        if (response.ok) {
            testResults = [];
            renderTestResults();
            loadStats();
            alert('All test results have been cleared.');
        } else {
            const data = await response.json();
            throw new Error(data.error || 'Failed to clear results');
        }
    } catch (error) {
        console.error('Error clearing results:', error);
        alert('Failed to clear results: ' + error.message);
    }
});

// Make showScreenshot available globally
window.showScreenshot = showScreenshot;

// Load stats
async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        
        stats.totalTests.textContent = data.totalTests || 0;
        stats.totalProducts.textContent = data.totalProducts || 0;
        stats.avgPromo.textContent = data.avgPromoPercentage || '0';
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Utility functions
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatPrice(price) {
    if (!price) return 'N/A';
    return parseFloat(price).toFixed(2);
}

function showError(message) {
    alert(message);
}

// Test all selected products sequentially
async function testAllProducts() {
    if (selectedProducts.size === 0) {
        alert('Please select at least one product to test');
        return;
    }

    if (!confirm(`Test all ${selectedProducts.size} selected product(s) sequentially?`)) {
        return;
    }

    loading.style.display = 'block';
    testAllBtn.disabled = true;
    startTestBtn.disabled = true;
    startTestBtn.style.display = 'none';
    stopTestBtn.style.display = 'inline-block';

    try {
        const response = await fetch('/api/test/all', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                productIds: Array.from(selectedProducts)
            })
        });

        const data = await response.json();
        
        if (response.ok) {
            // Start polling for results
            const pollInterval = setInterval(async () => {
                try {
                    await loadTestResults();
                    await loadStats();
                    
                    // Check if testing is complete
                    const statusResponse = await fetch('/api/test/status');
                    const status = await statusResponse.json();
                    
                    if (!status.isRunning) {
                        clearInterval(pollInterval);
                        statusPollInterval = null;
                        loading.style.display = 'none';
                        startTestBtn.disabled = false;
                        startTestBtn.style.display = 'inline-block';
                        testAllBtn.disabled = false;
                        stopTestBtn.style.display = 'none';
                    }
                } catch (e) {
                    console.error('Poll error:', e);
                }
            }, 3000);
            
            statusPollInterval = pollInterval;
        } else {
            throw new Error(data.error || 'Failed to start testing');
        }
    } catch (error) {
        console.error('Error starting test all:', error);
        alert('Failed to start testing: ' + error.message);
        loading.style.display = 'none';
        testAllBtn.disabled = false;
        startTestBtn.disabled = false;
        startTestBtn.style.display = 'inline-block';
        stopTestBtn.style.display = 'none';
    }
}

// Delete a single test result
async function deleteTestResult(resultId) {
    if (!confirm('Are you sure you want to delete this test result?')) {
        return;
    }

    try {
        const response = await fetch(`/api/test-results/${resultId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            // Remove the card from UI immediately
            const card = document.querySelector(`[data-result-id="${resultId}"]`);
            if (card) {
                card.style.transition = 'opacity 0.3s';
                card.style.opacity = '0';
                setTimeout(() => {
                    card.remove();
                    loadTestResults();
                    loadStats();
                }, 300);
            } else {
                // Fallback: reload results
                loadTestResults();
                loadStats();
            }
        } else {
            const data = await response.json();
            throw new Error(data.error || 'Failed to delete result');
        }
    } catch (error) {
        console.error('Error deleting test result:', error);
        alert('Failed to delete result: ' + error.message);
    }
}

// Make deleteTestResult available globally
window.deleteTestResult = deleteTestResult;
