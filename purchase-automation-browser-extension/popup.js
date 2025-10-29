// Purchase Automation Browser Extension Popup Script
class PurchaseAutomationPopup {
    constructor() {
        this.automationState = null;
        this.settings = null;
        this.currentTab = null;
        
        this.initializePopup();
    }

    async initializePopup() {
        try {
            // Get current tab
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            this.currentTab = tabs[0];
            
            // Force reload data from storage
            await this.forceReloadData();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Update UI
            this.updateUI();
            
            // Set up message listeners
            this.setupMessageListeners();
            
        } catch (error) {
            console.error('Failed to initialize popup:', error);
            this.updateStatus('Failed to initialize extension', 'error');
        }
    }

    async forceReloadData() {
        try {
            // Force reload from storage
            const result = await chrome.storage.local.get(null); // Get all data
            console.log('Popup loaded data from storage:', result);
            
            // Load automation state
            const response = await chrome.runtime.sendMessage({ action: 'getAutomationState' });
            if (response && response.success) {
                this.automationState = response.state;
            }
            
            // Load settings
            this.settings = result.settings || {
                autoInjectCrouton: true,
                showNotifications: true,
                debugMode: false,
                defaultPriceRange: { min: 0, max: 100 }
            };
            
            // Load merchants
            const merchants = result.targetMerchants || [];
            if (merchants.length > 0) {
                document.getElementById('merchant-input').value = merchants.join('\n');
            }
            
        } catch (error) {
            console.error('Failed to force reload data:', error);
        }
    }

    async loadAutomationState() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getAutomationState' });
            if (response.success) {
                this.automationState = response.state;
            }
        } catch (error) {
            console.error('Failed to load automation state:', error);
        }
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.local.get(['settings']);
            this.settings = result.settings || {
                autoInjectCrouton: true,
                showNotifications: true,
                debugMode: false,
                defaultPriceRange: { min: 0, max: 100 }
            };
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    setupEventListeners() {
        // Button listeners
        document.getElementById('save-merchants-btn').addEventListener('click', () => this.saveMerchants());
        document.getElementById('start-testing-btn').addEventListener('click', () => this.startTesting());
        document.getElementById('export-results-btn').addEventListener('click', () => this.exportResults());
        document.getElementById('clear-data-btn').addEventListener('click', () => this.clearData());
        document.getElementById('close-modal-btn').addEventListener('click', () => this.hideModal());
        document.getElementById('back-to-merchants-btn').addEventListener('click', () => this.showMerchantList());


        // Modal close on outside click
        document.getElementById('results-modal').addEventListener('click', (e) => {
            if (e.target.id === 'results-modal') {
                this.hideModal();
            }
        });
    }

    async saveMerchants() {
        try {
            const merchantInput = document.getElementById('merchant-input').value.trim();
            const merchants = merchantInput.split('\n')
                .map(line => line.trim().toLowerCase())
                .filter(line => line.length > 0)
                .map(line => line.replace(/^https?:\/\//, '').replace(/^www\./, ''));

            if (merchants.length === 0) {
                this.updateStatus('Please enter at least one merchant website', 'error');
                return;
            }

            // Save merchants to storage
            await chrome.storage.local.set({ targetMerchants: merchants });
            
            this.updateStatus(`Saved ${merchants.length} target merchant(s)`, 'success');
            
            // Update UI
            this.updateUI();
            
        } catch (error) {
            console.error('Error saving merchants:', error);
            this.updateStatus(`Error: ${error.message}`, 'error');
        }
    }

    async loadMerchants() {
        try {
            const result = await chrome.storage.local.get(['targetMerchants']);
            const merchants = result.targetMerchants || [];
            
            if (merchants.length > 0) {
                document.getElementById('merchant-input').value = merchants.join('\n');
            }
            
            return merchants;
        } catch (error) {
            console.error('Error loading merchants:', error);
            return [];
        }
    }

    isCurrentSiteTargetMerchant(merchants) {
        if (!this.currentTab || !this.currentTab.url || merchants.length === 0) {
            return false;
        }

        try {
            const currentUrl = new URL(this.currentTab.url);
            const currentHostname = currentUrl.hostname.toLowerCase().replace(/^www\./, '');
            
            return merchants.some(merchant => {
                return currentHostname.includes(merchant) || merchant.includes(currentHostname);
            });
        } catch (error) {
            return false;
        }
    }

    setupMessageListeners() {
        // Listen for messages from background script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            switch (message.action) {
                case 'purchaseCompleted':
                    this.handlePurchaseCompleted(message.results);
                    break;
                case 'purchaseError':
                    this.handlePurchaseError(message.error);
                    break;
            }
        });
    }

    async injectCrouton() {
        try {
            if (!this.currentTab) {
                this.updateStatus('No active tab found', 'error');
                return;
            }

            if (!this.currentTab.url || !this.currentTab.url.startsWith('http')) {
                this.updateStatus('Cannot inject crouton on this page', 'error');
                return;
            }

            this.updateStatus('Injecting crouton...', 'info');

            const response = await chrome.runtime.sendMessage({
                action: 'injectCrouton',
                tabId: this.currentTab.id
            });

            if (response.success) {
                this.updateStatus('Crouton injected successfully!', 'success');
                await this.loadAutomationState();
                this.updateUI();
            } else {
                this.updateStatus(`Failed to inject crouton: ${response.error}`, 'error');
            }
        } catch (error) {
            console.error('Error injecting crouton:', error);
            this.updateStatus(`Error: ${error.message}`, 'error');
        }
    }

    async toggleAutomation() {
        try {
            const newState = !this.automationState.isActive;
            
            await chrome.runtime.sendMessage({
                action: 'updateAutomationState',
                state: { isActive: newState }
            });

            await this.loadAutomationState();
            this.updateUI();
            
            this.updateStatus(
                newState ? 'Automation enabled' : 'Automation disabled',
                newState ? 'success' : 'info'
            );
        } catch (error) {
            console.error('Error toggling automation:', error);
            this.updateStatus(`Error: ${error.message}`, 'error');
        }
    }

    async exportResults() {
        try {
            this.updateStatus('Exporting results...', 'info');

            const response = await chrome.runtime.sendMessage({ action: 'exportResults' });

            if (response.success) {
                this.updateStatus('Results exported successfully!', 'success');
            } else {
                this.updateStatus(`Export failed: ${response.error}`, 'error');
            }
        } catch (error) {
            console.error('Error exporting results:', error);
            this.updateStatus(`Error: ${error.message}`, 'error');
        }
    }

    async clearData() {
        try {
            if (!confirm('Are you sure you want to clear all data? This cannot be undone.')) {
                return;
            }

            // Clear automation state
            const clearedState = {
                isActive: false,
                currentTab: null,
                sessionStats: {
                    totalAttempts: 0,
                    successfulPurchases: 0,
                    failedAttempts: 0,
                    totalSpent: 0
                },
                purchaseResults: []
            };

            await chrome.runtime.sendMessage({
                action: 'updateAutomationState',
                state: clearedState
            });

            // Clear saved merchants
            await chrome.storage.local.remove(['targetMerchants']);

            // Clear settings (reset to defaults)
            const defaultSettings = {
                autoInjectCrouton: true,
                showNotifications: true,
                debugMode: false,
                defaultPriceRange: { min: 0, max: 100 }
            };
            await chrome.storage.local.set({ settings: defaultSettings });

            // Reset form inputs
            document.getElementById('merchant-input').value = '';

            // Reload all data and update UI
            await this.loadAutomationState();
            await this.loadSettings();
            this.updateUI();
            this.updateStatus('All data cleared successfully', 'success');
        } catch (error) {
            console.error('Error clearing data:', error);
            this.updateStatus(`Error: ${error.message}`, 'error');
        }
    }

    showAllResults() {
        const modal = document.getElementById('results-modal');
        const resultsBody = document.getElementById('all-results-body');
        
        // Clear existing results
        resultsBody.innerHTML = '';

        if (!this.automationState.purchaseResults || this.automationState.purchaseResults.length === 0) {
            resultsBody.innerHTML = '<div class="no-results">No results to display</div>';
        } else {
            this.automationState.purchaseResults.forEach(result => {
                const row = document.createElement('div');
                row.className = 'table-row';
                
                const orderDetails = result.orderDetails || {};
                
                row.innerHTML = `
                    <div class="table-cell website">${result.website || 'N/A'}</div>
                    <div class="table-cell">${result.category || 'N/A'}</div>
                    <div class="table-cell price">$${orderDetails.orderPrice?.toFixed(2) || 'N/A'}</div>
                    <div class="table-cell">$${orderDetails.orderTax?.toFixed(2) || 'N/A'}</div>
                    <div class="table-cell">$${orderDetails.orderFees?.toFixed(2) || 'N/A'}</div>
                    <div class="table-cell total">$${orderDetails.orderTotal?.toFixed(2) || 'N/A'}</div>
                `;
                
                resultsBody.appendChild(row);
            });
        }

        modal.classList.add('show');
    }

    hideModal() {
        const modal = document.getElementById('results-modal');
        modal.classList.remove('show');
    }

    async updateSetting(key, value) {
        try {
            if (key.includes('.')) {
                const [parentKey, childKey] = key.split('.');
                this.settings[parentKey][childKey] = value;
            } else {
                this.settings[key] = value;
            }

            await chrome.storage.local.set({ settings: this.settings });
        } catch (error) {
            console.error('Error updating setting:', error);
        }
    }

    handlePurchaseCompleted(results) {
        this.updateStatus('Purchase automation completed!', 'success');
        this.loadAutomationState().then(() => {
            this.updateUI();
            this.addRecentResult(results);
        });
    }

    handlePurchaseError(error) {
        this.updateStatus(`Purchase failed: ${error.message}`, 'error');
        this.loadAutomationState().then(() => {
            this.updateUI();
        });
    }

    addRecentResult(results) {
        const recentResults = document.getElementById('recent-results');
        const noResults = recentResults.querySelector('.no-results');
        
        if (noResults) {
            noResults.remove();
        }

        const resultItem = document.createElement('div');
        resultItem.className = 'result-item fade-in';
        
        const orderDetails = results.orderDetails || {};
        
        resultItem.innerHTML = `
            <div class="result-header">${results.website} - ${results.category}</div>
            <div class="result-details">
                <span>Total: $${orderDetails.orderTotal?.toFixed(2) || 'N/A'}</span>
                <span>${new Date().toLocaleTimeString()}</span>
            </div>
        `;

        recentResults.insertBefore(resultItem, recentResults.firstChild);

        // Keep only last 3 results visible
        const items = recentResults.querySelectorAll('.result-item');
        if (items.length > 3) {
            items[items.length - 1].remove();
        }
    }

    async updateUI() {
        // Load merchants for checking
        const merchants = await this.loadMerchants();
        
        // Update current website
        const websiteElement = document.getElementById('current-website');
        const merchantStatus = document.getElementById('merchant-status');
        
        if (this.currentTab && this.currentTab.url) {
            try {
                const url = new URL(this.currentTab.url);
                websiteElement.textContent = `Current: ${url.hostname}`;
                
                // Check if current site is a target merchant
                const isTargetMerchant = this.isCurrentSiteTargetMerchant(merchants);
                if (merchants.length === 0) {
                    merchantStatus.textContent = 'Select merchants first, then navigate to a target website';
                    merchantStatus.className = 'merchant-status';
                } else if (isTargetMerchant) {
                    merchantStatus.textContent = `✅ Target merchant detected: ${url.hostname}`;
                    merchantStatus.className = 'merchant-status active';
                } else {
                    merchantStatus.textContent = `❌ Not a target merchant: ${url.hostname}`;
                    merchantStatus.className = 'merchant-status inactive';
                }
            } catch (error) {
                websiteElement.textContent = 'Current: Invalid URL';
                merchantStatus.textContent = 'Invalid URL';
                merchantStatus.className = 'merchant-status inactive';
            }
        } else {
            websiteElement.textContent = 'No active tab';
            merchantStatus.textContent = 'No active tab';
            merchantStatus.className = 'merchant-status inactive';
        }

        // Update buttons
        const startTestingBtn = document.getElementById('start-testing-btn');
        const exportBtn = document.getElementById('export-results-btn');

        // Enable start testing button only if merchants are saved
        startTestingBtn.disabled = merchants.length === 0;

        if (this.automationState) {
            const hasResults = this.automationState.purchaseResults && this.automationState.purchaseResults.length > 0;
            exportBtn.disabled = !hasResults;
        }


        // Update statistics
        if (this.automationState && this.automationState.sessionStats) {
            const stats = this.automationState.sessionStats;
            document.getElementById('total-attempts').textContent = stats.totalAttempts;
            document.getElementById('successful-purchases').textContent = stats.successfulPurchases;
            document.getElementById('failed-attempts').textContent = stats.failedAttempts;
            
            const avgPrice = stats.successfulPurchases > 0 
                ? stats.totalSpent / stats.successfulPurchases 
                : 0;
            document.getElementById('average-price').textContent = `$${avgPrice.toFixed(2)}`;
        }

        // Update merchant results
        this.updateMerchantResults();
        
        // Update saved merchants display
        this.updateSavedMerchantsDisplay(merchants);

        // Update connection status
        if (this.automationState && this.automationState.isActive) {
            this.updateConnectionStatus('🟢 Active');
        } else {
            this.updateConnectionStatus('⚪ Inactive');
        }
    }

    updateMerchantResults() {
        const merchantResults = document.getElementById('merchant-results');
        merchantResults.innerHTML = '';

        if (!this.automationState || !this.automationState.purchaseResults || this.automationState.purchaseResults.length === 0) {
            merchantResults.innerHTML = '<div class="no-results">No results yet</div>';
            return;
        }

        // Group results by merchant
        const merchantGroups = {};
        this.automationState.purchaseResults.forEach(result => {
            const merchantName = result.website || 'Unknown';
            if (!merchantGroups[merchantName]) {
                merchantGroups[merchantName] = [];
            }
            merchantGroups[merchantName].push(result);
        });

        // Create merchant items
        Object.keys(merchantGroups).forEach(merchantName => {
            const merchantItem = document.createElement('div');
            merchantItem.className = 'merchant-item';
            merchantItem.onclick = () => this.showMerchantDetails(merchantName, merchantGroups[merchantName]);
            
            merchantItem.innerHTML = `
                <div class="merchant-name">${merchantName}</div>
                <div class="merchant-count">${merchantGroups[merchantName].length}</div>
            `;
            
            merchantResults.appendChild(merchantItem);
        });
    }

    showMerchantDetails(merchantName, results) {
        const merchantList = document.getElementById('merchant-results');
        const detailView = document.getElementById('merchant-detail-view');
        const merchantNameElement = document.getElementById('detail-merchant-name');
        const detailContent = document.getElementById('merchant-detail-content');

        // Hide merchant list and show detail view
        merchantList.style.display = 'none';
        detailView.style.display = 'block';
        merchantNameElement.textContent = merchantName;

        // Clear and populate detail content
        detailContent.innerHTML = '';

        results.forEach((result, index) => {
            const orderItem = document.createElement('div');
            orderItem.className = 'order-detail-item';
            
            const orderDetails = result.orderDetails || {};
            const timestamp = new Date(result.timestamp).toLocaleString();
            
            orderItem.innerHTML = `
                <div class="order-summary">
                    <div class="order-date">${timestamp}</div>
                    <div class="order-total">$${orderDetails.orderTotal?.toFixed(2) || 'N/A'}</div>
                </div>
                <div class="order-details">
                    <div class="detail-row">
                        <span class="detail-label">Category:</span>
                        <span class="detail-value">${result.category || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Order Price:</span>
                        <span class="detail-value">$${orderDetails.orderPrice?.toFixed(2) || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Tax:</span>
                        <span class="detail-value">$${orderDetails.orderTax?.toFixed(2) || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Fees:</span>
                        <span class="detail-value">$${orderDetails.orderFees?.toFixed(2) || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Product URL:</span>
                        <span class="detail-value" style="font-size: 9px; word-break: break-all;">${orderDetails.productUrl || 'N/A'}</span>
                    </div>
                </div>
            `;
            
            detailContent.appendChild(orderItem);
        });
    }

    showMerchantList() {
        const merchantList = document.getElementById('merchant-results');
        const detailView = document.getElementById('merchant-detail-view');

        // Show merchant list and hide detail view
        merchantList.style.display = 'block';
        detailView.style.display = 'none';
    }

    async startTesting() {
        try {
            // Get saved merchants
            const merchants = await this.loadMerchants();
            
            if (merchants.length === 0) {
                this.updateStatus('Please save merchants first before starting testing', 'error');
                return;
            }

            this.updateStatus('Starting automated testing...', 'info');

            // Enable automation state
            await chrome.runtime.sendMessage({
                action: 'updateAutomationState',
                state: { isActive: true }
            });

            // Start testing process for each merchant
            for (const merchant of merchants) {
                try {
                    this.updateStatus(`Testing ${merchant}...`, 'info');
                    
                    // Format merchant URL properly - add .com if not present
                    let merchantUrl = merchant;
                    if (!merchantUrl.includes('.')) {
                        merchantUrl = `${merchantUrl}.com`;
                    }
                    if (!merchantUrl.startsWith('http')) {
                        merchantUrl = `https://${merchantUrl}`;
                    }
                    
                    // Create new tab for merchant
                    const tab = await chrome.tabs.create({
                        url: merchantUrl,
                        active: false
                    });

                    // Wait for tab to load
                    await this.waitForTabLoad(tab.id);

                    // Inject crouton into the tab
                    await chrome.runtime.sendMessage({
                        action: 'injectCrouton',
                        tabId: tab.id
                    });

                    // Wait a bit for crouton to initialize
                    await this.sleep(2000);

                    this.updateStatus(`✅ Crouton injected on ${merchant}`, 'success');

                } catch (error) {
                    console.error(`Error testing ${merchant}:`, error);
                    this.updateStatus(`❌ Failed to test ${merchant}: ${error.message}`, 'error');
                }

                // Wait between merchants to avoid overwhelming
                await this.sleep(1000);
            }

            this.updateStatus(`🎉 Testing setup complete! Navigate to merchant sites to use automation.`, 'success');
            
            // Update automation state
            await this.loadAutomationState();
            this.updateUI();

        } catch (error) {
            console.error('Error starting testing:', error);
            this.updateStatus(`Error starting testing: ${error.message}`, 'error');
        }
    }

    async waitForTabLoad(tabId) {
        return new Promise((resolve) => {
            const checkTab = () => {
                chrome.tabs.get(tabId, (tab) => {
                    if (tab && tab.status === 'complete') {
                        resolve();
                    } else {
                        setTimeout(checkTab, 500);
                    }
                });
            };
            checkTab();
        });
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    updateSavedMerchantsDisplay(merchants) {
        const savedMerchantsDisplay = document.getElementById('saved-merchants-display');
        const merchantsList = document.getElementById('merchants-list');

        if (!merchants || merchants.length === 0) {
            savedMerchantsDisplay.style.display = 'none';
            return;
        }

        // Show the saved merchants section
        savedMerchantsDisplay.style.display = 'block';
        
        // Clear existing merchants
        merchantsList.innerHTML = '';

        // Add each merchant as a clickable link
        merchants.forEach(merchant => {
            const merchantLink = document.createElement('a');
            merchantLink.className = 'merchant-link';
            
            // Ensure proper URL format - add .com if not present and add https://
            let merchantUrl = merchant;
            if (!merchantUrl.includes('.')) {
                merchantUrl = `${merchantUrl}.com`;
            }
            if (!merchantUrl.startsWith('http')) {
                merchantUrl = `https://${merchantUrl}`;
            }
            
            merchantLink.href = merchantUrl;
            merchantLink.target = '_blank';
            merchantLink.rel = 'noopener noreferrer';
            
            merchantLink.innerHTML = `
                <span class="merchant-icon">🏪</span>
                <span class="merchant-url">${merchant}</span>
                <span class="external-icon">↗</span>
            `;
            
            merchantsList.appendChild(merchantLink);
        });
    }

    updateStatus(message, type = 'info') {
        const statusDisplay = document.getElementById('status-display');
        statusDisplay.textContent = message;
        statusDisplay.className = `status-display ${type}`;
        
        // Add pulse animation for important messages
        if (type === 'error' || type === 'success') {
            statusDisplay.classList.add('pulse');
            setTimeout(() => statusDisplay.classList.remove('pulse'), 2000);
        }
    }

    updateConnectionStatus(status) {
        document.getElementById('connection-status').textContent = status;
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PurchaseAutomationPopup();
});
