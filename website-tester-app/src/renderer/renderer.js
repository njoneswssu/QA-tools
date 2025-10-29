// DOM Elements
const merchantInput = document.getElementById('merchantInput');
const merchantCount = document.getElementById('merchantCount');
const skipInfo = document.getElementById('skipInfo');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resumeBtn = document.getElementById('resumeBtn');
const stopBtn = document.getElementById('stopBtn');
const clearBtn = document.getElementById('clearBtn');
const importBtn = document.getElementById('importBtn');
const exportBtn = document.getElementById('exportBtn');
const madminBtn = document.getElementById('madminBtn');

// Wildlink elements
const loadWildlinkBtn = document.getElementById('loadWildlinkBtn');
const wildlinkPanel = document.getElementById('wildlinkPanel');
const scraperBrowserSelect = document.getElementById('scraperBrowserSelect');
const applicationSelect = document.getElementById('applicationSelect');
const refreshAppsBtn = document.getElementById('refreshAppsBtn');
const loadMerchantsBtn = document.getElementById('loadMerchantsBtn');
const tryAgainBtn = document.getElementById('resetBtn'); // Changed from tryAgainBtn to resetBtn
const cancelWildlinkBtn = document.getElementById('cancelWildlinkBtn');
const wildlinkProgress = document.getElementById('wildlinkProgress');
const wildlinkStatus = document.getElementById('wildlinkStatus');

// Other elements
const testStatus = document.getElementById('testStatus');
const currentWebsite = document.getElementById('currentWebsite');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const totalTested = document.getElementById('totalTested');
const availableCount = document.getElementById('availableCount');
const unavailableCount = document.getElementById('unavailableCount');
const skippedCount = document.getElementById('skippedCount');
const resultsContent = document.getElementById('resultsContent');
const statusMessage = document.getElementById('statusMessage');
const lastUpdate = document.getElementById('lastUpdate');
const loadingOverlay = document.getElementById('loadingOverlay');
const tabBtns = document.querySelectorAll('.tab-btn');

// Search elements
const resultsSearch = document.getElementById('resultsSearch');
const searchDropdown = document.getElementById('searchDropdown');

// Copy All elements
const copyAllBtn = document.getElementById('copyAllBtn');
const copyAllLabel = document.getElementById('copyAllLabel');

// Browser selection elements (removed redundant test browser selector)

// State
let isTestingActive = false;
let isPaused = false;
let testingMode = 'regular'; // 'regular' or 'madmin'
let testResults = [];
let currentTab = 'all';
let statusInterval;

// Utility function to shuffle array using Fisher-Yates algorithm
function shuffleArray(array) {
    const shuffled = [...array]; // Create a copy
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; // Swap elements
    }
    return shuffled;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadMerchantHistory();
    updateMerchantCount();
    
    // Don't pre-load applications - only load when user presses "Load from Wildlink"
});

function setupEventListeners() {
    console.log('🔧 Setting up event listeners...');
    
    // Input events
    if (merchantInput) {
        merchantInput.addEventListener('input', updateMerchantCount);
    } else {
        console.error('❌ merchantInput not found!');
    }
    
    // Control buttons with null checks
    console.log('🎛️ Setting up control button listeners...');
    
    if (startBtn) {
        startBtn.addEventListener('click', startTesting);
    } else {
        console.error('❌ startBtn not found!');
    }
    
    if (pauseBtn) {
        pauseBtn.addEventListener('click', pauseTesting);
    } else {
        console.error('❌ pauseBtn not found!');
    }
    
    if (resumeBtn) {
        resumeBtn.addEventListener('click', resumeTesting);
    } else {
        console.error('❌ resumeBtn not found!');
    }
    
    if (stopBtn) {
        stopBtn.addEventListener('click', stopTesting);
    } else {
        console.error('❌ stopBtn not found!');
    }
    
    // Clear button with extra debugging
    if (clearBtn) {
        console.log('🗑️ Setting up clear button listener...');
        clearBtn.addEventListener('click', clearTesting);
        console.log('✅ Clear button listener added successfully');
        
        // Add a simple test to verify the button works
        clearBtn.addEventListener('click', function() {
            console.log('🗑️ Clear button was definitely clicked!');
        });
    } else {
        console.error('❌ Clear button not found in DOM!');
    }
    
    // File operations
    if (importBtn) {
        importBtn.addEventListener('click', importMerchants);
    } else {
        console.error('❌ importBtn not found!');
    }
    
    if (exportBtn) {
        exportBtn.addEventListener('click', exportResults);
    } else {
        console.error('❌ exportBtn not found!');
    }
    
    if (madminBtn) {
        madminBtn.addEventListener('click', showMAdminPanel);
    } else {
        console.error('❌ madminBtn not found!');
    }
    
    // Wildlink operations
    if (loadWildlinkBtn) {
        loadWildlinkBtn.addEventListener('click', showWildlinkPanel);
    } else {
        console.error('❌ loadWildlinkBtn not found!');
    }
    
    // Sync merchants button
    const syncMerchantsBtn = document.getElementById('syncMerchantsBtn');
    if (syncMerchantsBtn) {
        syncMerchantsBtn.addEventListener('click', syncMerchantsFromAdmin);
    } else {
        console.error('❌ syncMerchantsBtn not found!');
    }
    
    if (loadMerchantsBtn) {
        loadMerchantsBtn.addEventListener('click', loadWildlinkMerchants);
    } else {
        console.error('❌ loadMerchantsBtn not found!');
    }
    
    if (tryAgainBtn) {
        tryAgainBtn.addEventListener('click', tryAgainMerchants);
    } else {
        console.error('❌ tryAgainBtn (resetBtn) not found!');
    }
    
    if (cancelWildlinkBtn) {
        cancelWildlinkBtn.addEventListener('click', hideWildlinkPanel);
    } else {
        console.error('❌ cancelWildlinkBtn not found!');
    }
    
    // Close loading dialog button
    const closeLoadingBtn = document.getElementById('closeLoadingBtn');
    if (closeLoadingBtn) {
        closeLoadingBtn.addEventListener('click', () => {
            showLoading(false);
        });
    }
    
    // Tab switching
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            switchTab(e.target.dataset.tab);
        });
    });

    // Keyboard navigation for tabs
    const tabOrder = ['all', 'available', 'unavailable', 'no-test-link']; // Define tab order for keyboard navigation
    
    document.addEventListener('keydown', (event) => {
        // Only handle arrow keys when there are test results to show
        const hasResults = testResults && testResults.length > 0;
        
        if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && hasResults) {
            event.preventDefault();
            
            const currentIndex = tabOrder.indexOf(currentTab);
            let newIndex;
            
            if (event.key === 'ArrowLeft') {
                // Move to previous tab (wrap around to end if at beginning)
                newIndex = currentIndex > 0 ? currentIndex - 1 : tabOrder.length - 1;
            } else {
                // Move to next tab (wrap around to beginning if at end)
                newIndex = currentIndex < tabOrder.length - 1 ? currentIndex + 1 : 0;
            }
            
            const newTab = tabOrder[newIndex];
            switchTab(newTab);
            
            // Focus the new tab button for accessibility
            const newTabBtn = document.querySelector(`[data-tab="${newTab}"]`);
            if (newTabBtn) {
                newTabBtn.focus();
            }
            
            console.log(`🎯 Navigated to ${newTab} tab using ${event.key} key`);
        }
    });
    
    // Search functionality
    if (resultsSearch && searchDropdown) {
        console.log('🔍 Setting up search functionality...');
        
        resultsSearch.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            if (query.length === 0) {
                searchDropdown.style.display = 'none';
                renderResults(); // Show all results
                return;
            }
            
            // Filter results based on search query
            const filteredResults = testResults.filter(result => 
                (result.url || '').toLowerCase().includes(query) ||
                (result.name || '').toLowerCase().includes(query)
            );
            
            // Show dropdown suggestions
            showSearchSuggestions(query, filteredResults);
            
            // Update results display
            renderFilteredResults(filteredResults);
        });
        
        resultsSearch.addEventListener('blur', () => {
            // Hide dropdown after a short delay to allow clicking
            setTimeout(() => {
                searchDropdown.style.display = 'none';
            }, 200);
        });
        
        resultsSearch.addEventListener('focus', (e) => {
            if (e.target.value.trim().length > 0) {
                const query = e.target.value.toLowerCase().trim();
                const filteredResults = testResults.filter(result => 
                    (result.url || '').toLowerCase().includes(query) ||
                    (result.name || '').toLowerCase().includes(query)
                );
                showSearchSuggestions(query, filteredResults);
            }
        });
    }
    
    // IPC event listeners
    window.electronAPI.onTestingProgress((data) => {
        updateProgress(data);
    });
    
    window.electronAPI.onTestingComplete((results) => {
        onTestingComplete(results);
    });
    
    window.electronAPI.onTestingError((error) => {
        onTestingError(error);
    });
    
    // Wildlink event listeners
    window.electronAPI.onWildlinkProgress((data) => {
        updateWildlinkProgress(data);
    });
    
    window.electronAPI.onWildlinkError((error) => {
        showWildlinkError(error);
    });
    
    // MAdmin event listeners
    window.electronAPI.onMAdminProgress((data) => {
        updateMAdminProgress(data);
    });
}

function updateMAdminProgress(data) {
    console.log('📊 MAdmin progress update:', data);
    
    if (data.message) {
        updateStatusMessage(data.message);
    }
    
    // Update counters and progress bar in real-time
    if (data.tested !== undefined || data.result) {
        // Calculate from actual testResults array for consistency
        const actualTested = testResults.length;
        const actualUnavailable = testResults.filter(r => r.isUnavailable).length;
        const actualNoTestLink = testResults.filter(r => r.hasNoTestLink).length;
        const actualAvailable = actualTested - actualUnavailable - actualNoTestLink;
        
        console.log(`📊 Real-time update: MAdmin says tested=${data.tested}, inactive=${data.inactive}, noTestLink=${data.noTestLink}`);
        console.log(`📊 Actual counts: tested=${actualTested}, available=${actualAvailable}, unavailable=${actualUnavailable}, noTestLink=${actualNoTestLink}`);
        
        // Use actual counts for both stats AND progress bar
        updateStats(actualTested, actualAvailable, actualUnavailable, actualNoTestLink);
        
        // Update progress bar using actual tested count for consistency
        if (data.total !== undefined && data.total > 0) {
            const percentage = (actualTested / data.total) * 100;
            progressFill.style.width = `${percentage}%`;
            progressText.textContent = `${actualTested} / ${data.total}`;
        }
    }
    
    // Update current website being tested
    if (data.currentMerchant) {
        currentWebsite.textContent = data.currentMerchant;
    }
    
    // Add individual results to testResults array in real-time
    if (data.result) {
        console.log('📝 Adding result:', data.result);
        
        // Check for duplicates before adding
        const merchantName = data.result.merchant || data.currentMerchant;
        const existingResult = testResults.find(r => r.url === merchantName);
        if (existingResult) {
            console.log('⚠️ Duplicate result detected, skipping:', merchantName);
            return; // Don't add duplicate
        }
        
        let resultEntry;
        if (data.result.hasNoTestLink) {
            // Merchant has no ShareASale/Awin test links
            resultEntry = {
                url: merchantName,
                merchantId: data.result.merchantId, // Store merchant ID for proper linking
                status: 'no-test-link',
                isUnavailable: false,
                hasNoTestLink: true,
                message: 'No affiliate test links found',
                timestamp: new Date().toISOString()
            };
        } else {
            // Regular test result (available/unavailable)
            const isUnavailable = !data.result.isActive;
            resultEntry = {
                url: merchantName,
                merchantId: data.result.merchantId, // Store merchant ID for proper linking
                status: data.result.isActive ? 'available' : 'unavailable',
                isUnavailable: isUnavailable,
                hasNoTestLink: false,
                message: data.result.isActive ? 'Active affiliate link' : 'Inactive affiliate link',
                timestamp: new Date().toISOString()
            };
        }
        
        testResults.push(resultEntry);
        console.log(`📊 Added result for ${resultEntry.url}, total results: ${testResults.length}`);
        
        // Enable export button after first result
        if (exportBtn && testResults.length > 0) {
            exportBtn.disabled = false;
        }
        
        console.log(`📊 Current testResults count: ${testResults.length}`);
        console.log(`📊 Available: ${testResults.filter(r => !r.isUnavailable && !r.hasNoTestLink).length}, Unavailable: ${testResults.filter(r => r.isUnavailable).length}, No Test Link: ${testResults.filter(r => r.hasNoTestLink).length}`);
        console.log(`📊 testResults sample:`, testResults.slice(-3)); // Show last 3 results
        
        // Re-render results to show new entry
        renderResults();
    }
}

function updateMerchantCount() {
    const text = merchantInput.value.trim();
    const lines = text.split('\n').filter(line => line.trim());
    const count = lines.length;
    
    merchantCount.textContent = `${count} merchant${count !== 1 ? 's' : ''}`;
    
    // Update start button state
    startBtn.disabled = count === 0 || isTestingActive;
}

async function loadMerchantHistory() {
    try {
        const history = await window.electronAPI.loadMerchantHistory();
        if (history.merchants && history.merchants.length > 0) {
            const recentCount = history.merchants.filter(m => {
                const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
                return m.timestamp > oneDayAgo;
            }).length;
            
            if (recentCount > 0) {
                skipInfo.textContent = `${recentCount} merchants tested in last 24h will be skipped`;
                skipInfo.style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Error loading merchant history:', error);
    }
}

async function startTesting() {
    const merchantsText = merchantInput.value.trim();
    if (!merchantsText) {
        alert('Please enter merchants to test');
        return;
    }
    
    // Ask user to choose testing mode
    const testingMode = await showTestingModeDialog();
    if (!testingMode) {
        return; // User cancelled
    }

    if (testingMode === 'madmin') {
        // Use MAdmin testing
        await showMAdminPanel();
        return;
    }
    
    // Regular Wildlink testing
    try {
        showLoading(true);
        setTestingState(true, false);
        
        // Clear previous results
        testResults = [];
        renderResults();
        
        // Use Chrome browser and reuse Wildlink browser if available
        const options = {
            browserType: 'chrome',
            reuseWildlinkBrowser: true
        };
        
        const result = await window.electronAPI.startTesting(merchantsText, options);
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        // Start status polling
        statusInterval = setInterval(updateStatus, 1000);
        
    } catch (error) {
        console.error('Error starting test:', error);
        alert(`Error starting test: ${error.message}`);
        setTestingState(false, false);
    } finally {
        showLoading(false);
    }
}

async function pauseTesting() {
    try {
        if (testingMode === 'madmin') {
            await window.electronAPI.madminPause();
        } else {
            await window.electronAPI.pauseTesting();
        }
        setTestingState(true, true);
    } catch (error) {
        console.error('Error pausing test:', error);
    }
}

async function resumeTesting() {
    try {
        if (testingMode === 'madmin') {
            await window.electronAPI.madminResume();
        } else {
            await window.electronAPI.resumeTesting();
        }
        setTestingState(true, false);
    } catch (error) {
        console.error('Error resuming test:', error);
    }
}

async function stopTesting() {
    try {
        showLoading(true);
        
        if (testingMode === 'madmin') {
            await window.electronAPI.madminStop();
        } else {
            await window.electronAPI.stopTesting();
        }
        
        setTestingState(false, false);
        testingMode = 'regular'; // Reset to regular
        
        if (statusInterval) {
            clearInterval(statusInterval);
            statusInterval = null;
        }
    } catch (error) {
        console.error('Error stopping test:', error);
    } finally {
        showLoading(false);
    }
}

async function clearTesting() {
    console.log('🗑️ Clear button clicked - completely wiping everything for clean slate...');
    
    try {
        // Stop any active testing first
        if (isTestingActive) {
            console.log('⏹️ Stopping active testing...');
            await stopTesting();
        }
        
        // Clear ALL data and reset to initial state
        console.log('🧹 Wiping all data for clean slate...');
        
        // Clear merchant input field
        if (merchantInput) {
            merchantInput.value = '';
            console.log('✅ Cleared merchant input field');
        }
        
        // Clear test results
        testResults = [];
        console.log('✅ Cleared test results array');
        
        // Reset all counters to zero
        updateStats(0, 0, 0, 0);
        console.log('✅ Reset all counters to zero');
        
        // Reset progress bar
        if (progressFill) {
            progressFill.style.width = '0%';
        }
        if (progressText) {
            progressText.textContent = '0 / 0';
        }
        console.log('✅ Reset progress bar');
        
        // Reset current website display
        if (currentWebsite) {
            currentWebsite.textContent = '-';
        }
        console.log('✅ Reset current website display');
        
        // Reset status message
        updateStatusMessage('Ready');
        console.log('✅ Reset status message');
        
        // Clear any intervals
        if (statusInterval) {
            clearInterval(statusInterval);
            statusInterval = null;
            console.log('✅ Cleared status interval');
        }
        
        // Reset testing state and mode
        testingMode = 'regular';
        setTestingState(false, false);
        console.log('✅ Reset testing state and mode');
        
        // Update merchant count display
        updateMerchantCount();
        console.log('✅ Updated merchant count display');
        
        // Re-render results (will show empty state)
        renderResults();
        console.log('✅ Re-rendered results display');
        
        // Reset tab to 'all'
        currentTab = 'all';
        // Update tab buttons visual state
        tabBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === 'all') {
                btn.classList.add('active');
            }
        });
        console.log('✅ Reset to "All" tab');
        
        console.log('✨ Complete clean slate achieved - everything wiped and reset!');
        updateStatusMessage('Clean slate - Ready to start fresh');
        
    } catch (error) {
        console.error('❌ Error during complete clear:', error);
        updateStatusMessage('Error during clear - Ready to start');
    }
}

// Make clearTesting available globally for onclick
window.clearTesting = clearTesting;

// Global function to switch tabs (for onclick handlers)
function switchToTab(tab) {
    // Only switch if we have results to show
    if (!testResults || testResults.length === 0) {
        console.log(`🎯 Cannot switch to ${tab} tab - no test results available`);
        return;
    }
    
    console.log(`🎯 Switching to ${tab} tab from progress stats click`);
    
    // Update current tab
    currentTab = tab;
    
    // Update tab buttons visual state
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    // Focus the corresponding tab button for accessibility
    const targetTabBtn = document.querySelector(`[data-tab="${tab}"]`);
    if (targetTabBtn) {
        targetTabBtn.focus();
    }
    
    // Re-render results
    renderResults();
    
    // Scroll to results section
    const resultsSection = document.querySelector('.results-section');
    if (resultsSection) {
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Global function to copy all merchants from current tab
function copyAllCurrentTab() {
    try {
        // Get filtered results for current tab
        let filteredResults = testResults;
        let tabName = 'All';
        
        if (currentTab === 'available') {
            filteredResults = testResults.filter(r => !r.isUnavailable && !r.hasNoTestLink);
            tabName = 'Available';
        } else if (currentTab === 'unavailable') {
            filteredResults = testResults.filter(r => r.isUnavailable);
            tabName = 'Unavailable';
        } else if (currentTab === 'no-test-link') {
            filteredResults = testResults.filter(r => r.hasNoTestLink);
            tabName = 'No Test Link';
        }
        
        if (filteredResults.length === 0) {
            alert(`No ${tabName.toLowerCase()} merchants to copy.`);
            return;
        }
        
        // Extract merchant names/URLs from results
        const merchantList = filteredResults.map(result => {
            return result.url || result.merchant || 'Unknown';
        }).join('\n');
        
        console.log(`📋 Copying ${filteredResults.length} ${tabName.toLowerCase()} merchants to clipboard...`);
        
        // Copy to clipboard
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(merchantList).then(() => {
                console.log(`✅ Successfully copied ${filteredResults.length} ${tabName.toLowerCase()} merchants`);
                updateStatusMessage(`📋 Copied ${filteredResults.length} ${tabName.toLowerCase()} merchants to clipboard`);
                
                // Temporarily update button text to show success
                const originalText = copyAllBtn.innerHTML;
                copyAllBtn.innerHTML = '✅ Copied!';
                copyAllBtn.disabled = true;
                
                setTimeout(() => {
                    copyAllBtn.innerHTML = originalText;
                    copyAllBtn.disabled = false;
                }, 2000);
                
            }).catch(err => {
                console.error('❌ Failed to copy to clipboard:', err);
                showCopyFallback(merchantList, `${tabName} Merchants`);
            });
        } else {
            // Fallback for older browsers
            showCopyFallback(merchantList, `${tabName} Merchants`);
        }
        
    } catch (error) {
        console.error('❌ Error copying merchants:', error);
        alert(`Error copying merchants: ${error.message}`);
    }
}

// Helper function for copy fallback
function showCopyFallback(text, title) {
    const fallbackText = `Please copy the following ${title} manually:\n\n${text}`;
    
    // Try document.execCommand as fallback
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
            console.log(`✅ Successfully copied using fallback method`);
            updateStatusMessage(`📋 Copied ${title} to clipboard (fallback method)`);
        } else {
            throw new Error('execCommand failed');
        }
    } catch (err) {
        document.body.removeChild(textArea);
        console.error('❌ All copy methods failed:', err);
        
        // Final fallback - show prompt
        prompt(fallbackText, text);
    }
}

// Make copyAllCurrentTab available globally for onclick
window.copyAllCurrentTab = copyAllCurrentTab;

async function importMerchants() {
    try {
        const result = await window.electronAPI.showOpenDialog();
        if (!result.canceled && result.filePaths.length > 0) {
            // File reading will be handled by the main process
            // For now, just show a message that import is selected
            alert('Import functionality will be implemented via main process');
        }
    } catch (error) {
        console.error('Error importing merchants:', error);
        alert('Error importing file');
    }
}

async function exportResults() {
    try {
        if (testResults.length === 0) {
            alert('No results to export');
            return;
        }

        // Prepare data for Excel export
        const exportData = testResults.map(result => {
            let reason = '';
            
            // Determine reason based on result properties
            if (result.isUnavailable) {
                reason = 'Unavailable';
            } else if (result.hasNoTestLink) {
                reason = 'No Test Link';
            } else {
                reason = 'Available';
            }
            
            // Extract merchant ID and create MAdmin link
            let madminLink = '';
            if (result.merchantId) {
                madminLink = `https://admin.wildlink.me/merchant-admin/merchant/${result.merchantId}`;
            } else if (result.url && result.url.includes('merchant-admin/merchant/')) {
                // Extract from existing admin URL
                const match = result.url.match(/merchant-admin\/merchant\/(\d+)/);
                if (match) {
                    madminLink = `https://admin.wildlink.me/merchant-admin/merchant/${match[1]}`;
                }
            } else {
                madminLink = 'N/A';
            }
            
            return {
                Name: result.url || result.merchant || 'Unknown',
                'MAdmin Link': madminLink,
                Reason: reason
            };
        });

        // Create Excel-compatible data structure
        const excelData = {
            exportDate: new Date().toISOString(),
            data: exportData,
            summary: {
                totalTested: testResults.length,
                available: testResults.filter(r => !r.isUnavailable && !r.hasNoTestLink).length,
                unavailable: testResults.filter(r => r.isUnavailable).length,
                noTestLink: testResults.filter(r => r.hasNoTestLink).length
            }
        };

        // Call main process to handle Excel export
        const result = await window.electronAPI.exportToExcel(excelData);
        
        if (result.success) {
            updateStatusMessage(`Results exported to ${result.filePath}`);
            alert(`Results exported successfully to:\n${result.filePath}`);
        } else {
            throw new Error(result.error || 'Export failed');
        }
        
    } catch (error) {
        console.error('Error exporting results:', error);
        alert(`Error exporting results: ${error.message}`);
        updateStatusMessage('Export failed');
    }
}

async function showMAdminPanel() {
    try {
        // First, ask user to choose MAdmin testing mode
        const madminTestingMode = await showMAdminModeDialog();
        if (!madminTestingMode) {
            return; // User cancelled
        }
        
        updateStatusMessage(`🔧 Opening MAdmin - Starting ${madminTestingMode === 'url' ? 'URL availability' : 'Awin link'} testing...`);
        
        // Get merchants from current input
        const merchantText = merchantInput.value.trim();
        if (!merchantText) {
            alert('Please load some merchants first using "Load from Wildlink" or add them manually');
            return;
        }
        
        // Parse merchants from input
        const merchants = merchantText.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => {
                // Extract domain from URL if it's a URL, otherwise use as is
                if (line.startsWith('https://')) {
                    return line.replace('https://', '').split('/')[0];
                }
                return line;
            });
        
        if (merchants.length === 0) {
            alert('No valid merchants found to test. Please load merchants first.');
            return;
        }
        
        // Shuffle the merchants array to randomize testing order
        console.log(`🎲 Shuffling ${merchants.length} merchants for random testing order...`);
        const shuffledMerchants = shuffleArray([...merchants]); // Create copy and shuffle
        console.log(`🎲 Original order: ${merchants.slice(0, 5).join(', ')}${merchants.length > 5 ? '...' : ''}`);
        console.log(`🎲 Shuffled order: ${shuffledMerchants.slice(0, 5).join(', ')}${shuffledMerchants.length > 5 ? '...' : ''}`);
        
        updateStatusMessage(`🔧 Starting MAdmin testing for ${shuffledMerchants.length} merchants in randomized order (reusing existing browser if available)...`);
        
        // Initialize progress tracking for MAdmin
        testResults = []; // Clear previous results
        updateStats(0, 0, 0, 0); // Reset counters
        progressFill.style.width = '0%';
        progressText.textContent = `0 / ${shuffledMerchants.length}`;
        renderResults(); // Clear results display
        
        // Set testing mode and enable control buttons
        testingMode = 'madmin';
        setTestingState(true, false);
        
        // Call MAdmin testing through IPC with testing mode
        const result = await window.electronAPI.madminTestMerchants(shuffledMerchants, { testingMode: madminTestingMode });
        
        if (result.success) {
            updateStatusMessage(`✅ MAdmin testing completed: ${result.tested} merchants tested, ${result.inactive} inactive links found`);
            
            // Final counters should match the actual testResults including the new category
            const actualAvailable = testResults.filter(r => !r.isUnavailable && !r.hasNoTestLink).length;
            const actualUnavailable = testResults.filter(r => r.isUnavailable).length;
            const actualNoTestLink = testResults.filter(r => r.hasNoTestLink).length;
            const actualTested = testResults.length;
            
            console.log(`📊 Final count check - Tested: ${actualTested}, Available: ${actualAvailable}, Unavailable: ${actualUnavailable}, No Test Link: ${actualNoTestLink}`);
            
            // Update the counters with actual results (not the returned counts which might be wrong)
            updateStats(actualTested, actualAvailable, actualUnavailable, actualNoTestLink);
            
            // Results are already added in real-time, so no need to add them again here
            // Just make sure the display is updated
            renderResults();
            
        } else {
            throw new Error(result.error);
        }
        
        // Reset testing state after completion
        setTestingState(false, false);
        
    } catch (error) {
        console.error('MAdmin error:', error);
        updateStatusMessage(`❌ MAdmin error: ${error.message}`);
        
        // Reset testing state on error
        setTestingState(false, false);
        
        // Provide helpful error messages
        if (error.message.includes('launchPersistentContext') || error.message.includes('Target page, context or browser has been closed')) {
            alert(`MAdmin Browser Error: ${error.message}\n\n✅ MAdmin will open its own Chromium browser with persistent login sessions.`);
        } else if (error.message.includes('browser') || error.message.includes('closed')) {
            alert(`MAdmin error: ${error.message}\n\n💡 Tip: MAdmin uses its own browser with saved login sessions.`);
        } else {
            alert(`MAdmin error: ${error.message}`);
        }
    }
}

function setTestingState(active, paused) {
    isTestingActive = active;
    isPaused = paused;
    
    startBtn.disabled = active;
    pauseBtn.disabled = !active || paused;
    resumeBtn.disabled = !active || !paused;
    stopBtn.disabled = !active;
    exportBtn.disabled = testResults.length === 0; // Enable after first result
    
    if (active) {
        testStatus.textContent = paused ? 'Paused' : 'Running';
        testStatus.style.color = paused ? '#ff9800' : '#4caf50';
    } else {
        testStatus.textContent = 'Ready';
        testStatus.style.color = '#666';
        currentWebsite.textContent = '-';
    }
}

async function updateStatus() {
    if (!isTestingActive) return;
    
    try {
        const status = await window.electronAPI.getTestingStatus();
        if (status.currentWebsite) {
            currentWebsite.textContent = status.currentWebsite.name;
        }
    } catch (error) {
        console.error('Error updating status:', error);
    }
}

function updateProgress(data) {
    console.log('Progress update:', data);
    
    if (data.status === 'starting') {
        testResults = [];
        updateStats(0, 0, 0, data.skippedMerchants || 0);
        updateStatusMessage(data.message);
        renderResults();
    } else if (data.status === 'testing') {
        const progress = data.totalCount > 0 ? (data.checkedCount / data.totalCount) * 100 : 0;
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `${data.checkedCount} / ${data.totalCount}`;
        
        updateStats(data.checkedCount, data.checkedCount - data.unavailableCount, data.unavailableCount, 0);
        updateStatusMessage(data.message);
        
        if (data.lastResult) {
            testResults.push({
                name: data.currentWebsite.name,
                url: data.currentWebsite.url,
                isUnavailable: data.lastResult.isUnavailable,
                reason: data.lastResult.reason,
                timestamp: Date.now()
            });
            renderResults();
        }
    } else if (data.status === 'paused') {
        setTestingState(true, true);
        updateStatusMessage('Testing paused by user');
    } else if (data.status === 'resumed') {
        setTestingState(true, false);
        updateStatusMessage('Testing resumed');
    } else if (data.status === 'stopped') {
        setTestingState(false, false);
        updateStatusMessage('Testing stopped by user');
        if (statusInterval) {
            clearInterval(statusInterval);
            statusInterval = null;
        }
    }
}

function updateProgress(data) {
    console.log('Progress update:', data);
    
    // Update current website being tested
    if (data.currentWebsite) {
        currentWebsite.textContent = data.currentWebsite.name || data.currentWebsite.url || 'Unknown';
    }
    
    // Update progress bar
    if (data.progress !== undefined) {
        const percentage = Math.round(data.progress * 100);
        progressFill.style.width = `${percentage}%`;
        progressText.textContent = `${data.checkedCount || 0} / ${data.totalCount || 0}`;
    }
    
    // Update stats
    if (data.checkedCount !== undefined) {
        updateStats(
            data.checkedCount || 0,
            (data.checkedCount || 0) - (data.unavailableCount || 0),
            data.unavailableCount || 0,
            data.skippedCount || 0
        );
    }
    
    // Add individual results to the list as they come in
    if (data.result) {
        testResults.push(data.result);
        renderResults(); // Update display immediately
    }
    
    // Update status message
    if (data.message) {
        updateStatusMessage(data.message);
    }
}

function onTestingComplete(results) {
    console.log('Testing complete:', results);
    
    setTestingState(false, false);
    
    if (statusInterval) {
        clearInterval(statusInterval);
        statusInterval = null;
    }
    
    // Add any final results that weren't captured during progress
    if (results.checkedWebsites) {
        results.checkedWebsites.forEach(website => {
            // Check if this result is already in testResults
            const exists = testResults.find(r => r.url === website.url);
            if (!exists) {
                testResults.push({
                    name: website.name,
                    url: website.url,
                    isUnavailable: false,
                    reason: null
                });
            }
        });
    }
    
    if (results.unavailableWebsites) {
        results.unavailableWebsites.forEach(website => {
            // Check if this result is already in testResults
            const exists = testResults.find(r => r.url === website.url);
            if (!exists) {
                testResults.push({
                    name: website.name,
                    url: website.url,
                    isUnavailable: true,
                    reason: website.reason || 'Unavailable'
                });
            }
        });
    }
    
    // Re-render results to show everything
    renderResults();
    
    const message = results.message || 
        `Testing complete! ${results.totalChecked} tested, ${results.unavailableCount} unavailable`;
    updateStatusMessage(message);
    
    // Update final stats
    updateStats(
        results.totalChecked || 0,
        (results.totalChecked || 0) - (results.unavailableCount || 0),
        results.unavailableCount || 0,
        results.skippedCount || 0
    );
    
    // Final progress
    progressFill.style.width = '100%';
    progressText.textContent = `${results.totalChecked || 0} / ${results.totalChecked || 0}`;
}

function onTestingError(error) {
    console.error('Testing error:', error);
    
    setTestingState(false, false);
    
    if (statusInterval) {
        clearInterval(statusInterval);
        statusInterval = null;
    }
    
    updateStatusMessage(`Error: ${error}`);
    alert(`Testing error: ${error}`);
}

function updateStats(total, available, unavailable, noTestLink) {
    totalTested.textContent = total;
    availableCount.textContent = available;
    unavailableCount.textContent = unavailable;
    skippedCount.textContent = noTestLink || 0; // Use skipped count for "No Test Link"
}

function switchTab(tab) {
    currentTab = tab;
    
    tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    renderResults();
}

function renderResults() {
    console.log(`🎨 Rendering results - currentTab: ${currentTab}, total results: ${testResults.length}`);
    console.log(`🎨 testResults sample:`, testResults.slice(0, 5)); // Show first 5 for debugging
    
    let filteredResults = testResults;
    
    if (currentTab === 'available') {
        filteredResults = testResults.filter(r => !r.isUnavailable && !r.hasNoTestLink);
        console.log(`🎨 Filtered to available: ${filteredResults.length} results`);
    } else if (currentTab === 'unavailable') {
        filteredResults = testResults.filter(r => r.isUnavailable);
        console.log(`🎨 Filtered to unavailable: ${filteredResults.length} results`);
        console.log(`🎨 Unavailable results:`, filteredResults);
    } else if (currentTab === 'no-test-link') {
        filteredResults = testResults.filter(r => r.hasNoTestLink);
        console.log(`🎨 Filtered to no test link: ${filteredResults.length} results`);
    }
    
    if (filteredResults.length === 0) {
        console.log(`🎨 No results to show for tab: ${currentTab}`);
        resultsContent.innerHTML = `
            <div class="empty-state">
                <p>No ${currentTab === 'all' ? '' : currentTab + ' '}results yet.</p>
            </div>
        `;
        return;
    }
    
    console.log(`🎨 Rendering ${filteredResults.length} results for tab: ${currentTab}`);
    resultsContent.innerHTML = filteredResults.map((result, index) => {
        let statusClass, statusText;
        if (result.hasNoTestLink) {
            statusClass = 'no-test-link';
            statusText = 'No Test Link';
        } else if (result.isUnavailable) {
            statusClass = 'unavailable';
            statusText = 'Unavailable';
        } else {
            statusClass = 'available';
            statusText = 'Available';
        }
        
        const merchantName = result.name || result.url;
        const merchantUrl = result.url;
        const resultNumber = index + 1; // 1-based numbering
        const totalResults = filteredResults.length;
        
        return `
            <div class="result-item ${statusClass}">
                <div class="result-info">
                    <div class="result-name">
                        ${escapeHtml(merchantName)}
                        <span style="color: #6c757d; font-size: 12px; margin-left: 8px;">(${resultNumber} of ${totalResults})</span>
                    </div>
                    <div class="result-url">
                <a href="https://admin.wildlink.me/merchant-admin/merchant/${extractMerchantId(merchantUrl, result.merchantId)}" 
                   target="_blank" style="color: #007bff; text-decoration: none; margin-right: 10px;">
                    ${escapeHtml(merchantUrl)}
                </a>
                <button onclick="copyMerchantUrl('https://admin.wildlink.me/merchant-admin/merchant/${extractMerchantId(merchantUrl, result.merchantId)}')" 
                        data-url="https://admin.wildlink.me/merchant-admin/merchant/${extractMerchantId(merchantUrl, result.merchantId)}"
                        style="padding: 2px 6px; font-size: 11px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 3px; cursor: pointer; color: #6c757d;" 
                        title="Copy merchant admin URL">
                    📋 Copy
                </button>
                    </div>
                    ${result.reason ? `<div class="result-reason">${escapeHtml(result.reason)}</div>` : ''}
                    ${result.message ? `<div class="result-message">${escapeHtml(result.message)}</div>` : ''}
                </div>
                <div class="result-status ${statusClass}">
                    ${statusText}
                </div>
            </div>
        `;
    }).join('');
    
    // Update Copy All button visibility and label
    updateCopyAllButton(filteredResults.length);
}

function updateCopyAllButton(resultCount) {
    if (!copyAllBtn || !copyAllLabel) return;
    
    if (resultCount > 0) {
        // Show the button and update label based on current tab
        copyAllBtn.style.display = 'inline-block';
        
        let tabLabel = 'All';
        if (currentTab === 'available') {
            tabLabel = 'Available';
        } else if (currentTab === 'unavailable') {
            tabLabel = 'Unavailable';
        } else if (currentTab === 'no-test-link') {
            tabLabel = 'No Test Link';
        }
        
        copyAllLabel.textContent = `${tabLabel} (${resultCount})`;
        copyAllBtn.title = `Copy all ${resultCount} ${tabLabel.toLowerCase()} merchants to clipboard`;
        
        console.log(`📋 Copy All button updated: ${tabLabel} (${resultCount})`);
    } else {
        // Hide the button if no results
        copyAllBtn.style.display = 'none';
    }
}

function updateStatusMessage(message) {
    statusMessage.textContent = message;
    lastUpdate.textContent = new Date().toLocaleTimeString();
}

function showLoading(show) {
    loadingOverlay.classList.toggle('hidden', !show);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showSearchSuggestions(query, filteredResults) {
    if (filteredResults.length === 0) {
        searchDropdown.innerHTML = '<div style="padding: 10px; color: #666;">No merchants found</div>';
        searchDropdown.style.display = 'block';
        return;
    }
    
    const suggestions = filteredResults.slice(0, 10).map(result => {
        const merchantName = result.name || result.url || 'Unknown';
        const statusClass = result.hasNoTestLink ? 'no-test-link' : (result.isUnavailable ? 'unavailable' : 'available');
        const statusText = result.hasNoTestLink ? 'No Test Link' : (result.isUnavailable ? 'Unavailable' : 'Available');
        
        return `
            <div class="search-suggestion" onclick="selectSearchResult('${escapeHtml(merchantName)}')" 
                 style="padding: 8px 12px; border-bottom: 1px solid #eee; cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 500;">${escapeHtml(merchantName)}</span>
                <span class="status-badge ${statusClass}" style="padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: bold;">
                    ${statusText}
                </span>
            </div>
        `;
    }).join('');
    
    searchDropdown.innerHTML = suggestions;
    searchDropdown.style.display = 'block';
}

function selectSearchResult(merchantName) {
    resultsSearch.value = merchantName;
    searchDropdown.style.display = 'none';
    
    // Filter and show only this merchant
    const filteredResults = testResults.filter(result => 
        (result.name || result.url || '').toLowerCase().includes(merchantName.toLowerCase())
    );
    renderFilteredResults(filteredResults);
}

function renderFilteredResults(filteredResults) {
    if (filteredResults.length === 0) {
        resultsContent.innerHTML = `
            <div class="empty-state">
                <p>No merchants found matching your search.</p>
            </div>
        `;
        return;
    }
    
    resultsContent.innerHTML = filteredResults.map(result => {
        let statusClass, statusText;
        if (result.hasNoTestLink) {
            statusClass = 'no-test-link';
            statusText = 'No Test Link';
        } else if (result.isUnavailable) {
            statusClass = 'unavailable';
            statusText = 'Unavailable';
        } else {
            statusClass = 'available';
            statusText = 'Available';
        }
        
        const merchantName = result.name || result.url;
        const merchantUrl = result.url;
        
        return `
            <div class="result-item ${statusClass}">
                <div class="result-info">
                    <div class="result-name">${escapeHtml(merchantName)}</div>
                    <div class="result-url">
                <a href="https://admin.wildlink.me/merchant-admin/merchant/${extractMerchantId(merchantUrl, result.merchantId)}" 
                   target="_blank" style="color: #007bff; text-decoration: none; margin-right: 10px;">
                    ${escapeHtml(merchantUrl)}
                </a>
                <button onclick="copyMerchantUrl('https://admin.wildlink.me/merchant-admin/merchant/${extractMerchantId(merchantUrl, result.merchantId)}')" 
                        data-url="https://admin.wildlink.me/merchant-admin/merchant/${extractMerchantId(merchantUrl, result.merchantId)}"
                        style="padding: 2px 6px; font-size: 11px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 3px; cursor: pointer; color: #6c757d;" 
                        title="Copy merchant admin URL">
                    📋 Copy
                </button>
                    </div>
                    ${result.reason ? `<div class="result-reason">${escapeHtml(result.reason)}</div>` : ''}
                    ${result.message ? `<div class="result-message">${escapeHtml(result.message)}</div>` : ''}
                </div>
                <div class="result-status ${statusClass}">
                    ${statusText}
                </div>
            </div>
        `;
    }).join('');
}

function extractMerchantId(merchantUrl, merchantId) {
    console.log('Extracting merchant ID from:', merchantUrl, 'stored ID:', merchantId);
    
    // If we have a stored merchant ID from the scraper, use it
    if (merchantId) {
        console.log('Using stored merchant ID:', merchantId);
        return merchantId;
    }
    
    // If it's already a full admin URL, extract the ID from it
    if (merchantUrl.includes('admin.wildlink.me/merchant-admin/merchant/')) {
        const match = merchantUrl.match(/merchant\/(\d+)/);
        const id = match ? match[1] : '';
        console.log('Extracted ID from admin URL:', id);
        return id;
    }
    
    // Try to extract from various URL patterns
    let extractedId = '';
    
    // Pattern 1: Look for merchant ID in the URL path or query params
    let match = merchantUrl.match(/merchant[\/\-_]?(\d+)/i);
    if (match) {
        extractedId = match[1];
        console.log('Found merchant ID pattern 1:', extractedId);
        return extractedId;
    }
    
    // Pattern 2: Look for ID parameter
    match = merchantUrl.match(/[?&]id=(\d+)/i);
    if (match) {
        extractedId = match[1];
        console.log('Found merchant ID pattern 2:', extractedId);
        return extractedId;
    }
    
    // Pattern 3: Look for merchant parameter
    match = merchantUrl.match(/[?&]merchant=(\d+)/i);
    if (match) {
        extractedId = match[1];
        console.log('Found merchant ID pattern 3:', extractedId);
        return extractedId;
    }
    
    // Pattern 4: Look for any numeric ID that might be a merchant ID
    match = merchantUrl.match(/\/(\d{4,})/); // At least 4 digits
    if (match) {
        extractedId = match[1];
        console.log('Found merchant ID pattern 4:', extractedId);
        return extractedId;
    }
    
    // If no ID found, we need to use the merchant name to search
    console.log('No merchant ID found in URL, will need to use merchant name');
    return '';
}

function copyMerchantUrl(url) {
    console.log('📋 Copy button clicked for URL:', url);
    
    // Try multiple clipboard methods for better compatibility
    if (navigator.clipboard && navigator.clipboard.writeText) {
        // Modern clipboard API
        navigator.clipboard.writeText(url).then(() => {
            console.log('✅ Successfully copied to clipboard using modern API');
            showCopySuccess(event.target);
        }).catch(err => {
            console.error('Modern clipboard failed:', err);
            fallbackCopyTextToClipboard(url, event.target);
        });
    } else {
        // Fallback for older browsers or when clipboard API is not available
        console.log('📋 Using fallback clipboard method');
        fallbackCopyTextToClipboard(url, event.target);
    }
}

function fallbackCopyTextToClipboard(text, button) {
    try {
        // Create a temporary textarea element
        const textArea = document.createElement("textarea");
        textArea.value = text;
        
        // Make it invisible but still functional
        textArea.style.position = "fixed";
        textArea.style.top = "-1000px";
        textArea.style.left = "-1000px";
        textArea.style.width = "1px";
        textArea.style.height = "1px";
        textArea.style.padding = "0";
        textArea.style.border = "none";
        textArea.style.outline = "none";
        textArea.style.boxShadow = "none";
        textArea.style.background = "transparent";
        
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        // Try to copy using execCommand
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
            showCopySuccess(button);
        } else {
            showCopyError(button, 'Copy command failed', text);
        }
    } catch (err) {
        console.error('Fallback copy failed:', err);
        showCopyError(button, 'All copy methods failed', text);
    }
}

function showCopySuccess(button) {
    const originalText = button.innerHTML;
    button.innerHTML = '✅ Copied!';
    button.style.background = '#d4edda';
    button.style.color = '#155724';
    button.style.borderColor = '#c3e6cb';
    
    setTimeout(() => {
        button.innerHTML = originalText;
        button.style.background = '#f8f9fa';
        button.style.color = '#6c757d';
        button.style.borderColor = '#dee2e6';
    }, 2000);
}

function showCopyError(button, errorMsg, url) {
    console.error('Copy error:', errorMsg);
    const originalText = button.innerHTML;
    button.innerHTML = '❌ Failed';
    button.style.background = '#f8d7da';
    button.style.color = '#721c24';
    button.style.borderColor = '#f5c6cb';
    
    setTimeout(() => {
        button.innerHTML = originalText;
        button.style.background = '#f8f9fa';
        button.style.color = '#6c757d';
        button.style.borderColor = '#dee2e6';
    }, 3000);
    
    // Also show the URL in a prompt as fallback
    setTimeout(() => {
        prompt('Copy this URL manually:', url || button.dataset.url || 'URL not available');
    }, 500);
}

// Make copyMerchantUrl available globally
window.copyMerchantUrl = copyMerchantUrl;

// Pre-load applications function - fetch from actual Wildlink
async function preloadApplications() {
    try {
        updateStatusMessage('Loading applications from Wildlink...');
        
        // Use Chrome browser type for initial loading
        const result = await window.electronAPI.wildlinkGetApplications('chrome');
        
        if (result.success && result.applications.length > 0) {
            populateApplicationSelect(result.applications);
            updateStatusMessage(`✅ Pre-loaded ${result.applications.length} applications from Wildlink. Ready to load merchants.`);
        } else {
            // Fallback to hardcoded apps if Wildlink fails
            const fallbackApps = [
                'Citi', 'Acorns', 'Microsoft', 'Give Freely', 'Capital One',
                'Chase', 'Bank of America', 'Wells Fargo', 'American Express', 'Discover'
            ];
            
            applicationSelect.innerHTML = '<option value="">Select Application...</option>';
            fallbackApps.forEach(app => {
                const option = document.createElement('option');
                option.value = app;
                option.textContent = app;
                applicationSelect.appendChild(option);
            });
            
            updateStatusMessage(`⚠️ Using fallback applications (${fallbackApps.length}). Wildlink may require login.`);
        }
    } catch (error) {
        console.error('Error preloading applications:', error);
        
        // Fallback to hardcoded apps on error
        const fallbackApps = [
            'Citi', 'Acorns', 'Microsoft', 'Give Freely', 'Capital One',
            'Chase', 'Bank of America', 'Wells Fargo', 'American Express', 'Discover'
        ];
        
        applicationSelect.innerHTML = '<option value="">Select Application...</option>';
        fallbackApps.forEach(app => {
            const option = document.createElement('option');
            option.value = app;
            option.textContent = app;
            applicationSelect.appendChild(option);
        });
        
        updateStatusMessage(`⚠️ Could not load from Wildlink. Using ${fallbackApps.length} fallback applications.`);
    }
}

// Wildlink Functions
function showWildlinkPanel() {
    wildlinkPanel.classList.remove('hidden');
    
    // Load applications from actual Wildlink page when button is pressed
    updateStatusMessage('Opening Wildlink browser and loading applications...');
    loadApplications();
}

function hideWildlinkPanel() {
    wildlinkPanel.classList.add('hidden');
    wildlinkProgress.classList.add('hidden');
    // Don't close the scraper to preserve login sessions
}

async function loadApplications() {
    try {
        const selectedBrowser = scraperBrowserSelect.value;
        showWildlinkProgress(`Loading applications from Wildlink using ${selectedBrowser}...`);
        
        const result = await window.electronAPI.wildlinkGetApplications(selectedBrowser);
        
        if (result.success) {
            populateApplicationSelect(result.applications);
            hideWildlinkProgress();
            updateStatusMessage(`Found ${result.applications.length} applications on Wildlink (using ${selectedBrowser})`);
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        hideWildlinkProgress();
        
        // Handle browser closure error specifically
        if (error.message.includes('closed') || error.message.includes('Target') || error.message.includes('disconnected')) {
            showWildlinkError('Browser was closed. Reinitializing... Please try again.');
        } else {
            showWildlinkError(`Failed to load applications: ${error.message}`);
        }
    }
}

function populateApplicationSelect(applications) {
    applicationSelect.innerHTML = '<option value="">Select Application...</option>';
    
    if (applications.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No applications found';
        option.disabled = true;
        applicationSelect.appendChild(option);
        return;
    }
    
    applications.forEach(app => {
        const option = document.createElement('option');
        option.value = app.name;
        option.textContent = app.name;
        applicationSelect.appendChild(option);
    });
}

async function loadWildlinkMerchants() {
    const selectedApp = applicationSelect.value;
    if (!selectedApp) {
        alert('Please select an application first');
        return;
    }
    
    // Get selected browser (single selection)
    const selectedBrowserElement = document.querySelector('input[name="browserSelect"]:checked');
    if (!selectedBrowserElement) {
        alert('Please select a browser');
        return;
    }
    
    const selectedBrowser = selectedBrowserElement.value;
    console.log('Selected browser:', selectedBrowser);
    
    try {
        showWildlinkProgress(`Loading merchants for ${selectedApp}...`);
        
        const result = await window.electronAPI.wildlinkGetMerchants(selectedApp, [selectedBrowser]);
        
        if (result.success) {
            const merchantText = result.merchants.map(merchant => 
                merchant.url || merchant.domain || merchant.name
            ).join('\n');
            
            // Add to existing text or replace
            if (merchantInput.value.trim()) {
                merchantInput.value += '\n' + merchantText;
            } else {
                merchantInput.value = merchantText;
            }
            
            updateMerchantCount();
            
            // Show Try Again button if we got very few results (likely incomplete)
            if (result.merchants.length < 50) {
                tryAgainBtn.classList.remove('hidden');
                updateStatusMessage(`⚠️ Found only ${result.merchants.length} merchants from ${selectedApp} (${selectedBrowser}). This seems low - try "Try Again" to load more.`);
            } else {
                tryAgainBtn.classList.add('hidden');
                updateStatusMessage(`✅ Loaded ${result.merchants.length} merchants from ${selectedApp} (${selectedBrowser}). Panel kept open.`);
            }
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        hideWildlinkProgress();
        
        // Handle browser closure error specifically
        if (error.message.includes('closed') || error.message.includes('Target') || error.message.includes('disconnected')) {
            showWildlinkError('Browser was closed. Please click "Load from Wildlink" again to reinitialize.');
        } else {
            showWildlinkError(`Failed to load merchants: ${error.message}`);
        }
    }
}

function showWildlinkProgress(message) {
    wildlinkStatus.textContent = message;
    wildlinkProgress.classList.remove('hidden');
    document.querySelector('.wildlink-controls').style.display = 'none';
}

function hideWildlinkProgress() {
    wildlinkProgress.classList.add('hidden');
    document.querySelector('.wildlink-controls').style.display = 'flex';
}

function updateWildlinkProgress(data) {
    if (data.message) {
        wildlinkStatus.textContent = data.message;
    }
}

function showWildlinkError(error) {
    hideWildlinkProgress();
    alert(`Wildlink Error: ${error}`);
    updateStatusMessage(`Wildlink error: ${error}`);
}

async function tryAgainMerchants() {
    const selectedApp = applicationSelect.value;
    const selectedBrowserElement = document.querySelector('input[name="browserSelect"]:checked');
    
    if (!selectedApp || !selectedBrowserElement) {
        alert('Please ensure an application and browser are selected');
        return;
    }
    
    const selectedBrowser = selectedBrowserElement.value;
    
    try {
        // Hide the Try Again button while processing
        tryAgainBtn.classList.add('hidden');
        
        showWildlinkProgress(`🔄 Trying again to load ALL merchants for ${selectedApp}...`);
        updateStatusMessage(`🔄 Re-attempting to load all merchants. This may take longer to ensure complete results.`);
        
        const result = await window.electronAPI.wildlinkGetMerchants(selectedApp, [selectedBrowser]);
        
        if (result.success) {
            const merchantText = result.merchants.map(merchant => 
                merchant.url || merchant.domain || merchant.name
            ).join('\n');
            
            // Replace existing merchants (don't append duplicates)
            merchantInput.value = merchantText;
            updateMerchantCount();
            
            if (result.merchants.length < 50) {
                tryAgainBtn.classList.remove('hidden');
                updateStatusMessage(`⚠️ Try again found ${result.merchants.length} merchants. Still seems low - you can try again or proceed with testing.`);
            } else {
                updateStatusMessage(`✅ Try again successful! Loaded ${result.merchants.length} merchants from ${selectedApp} (${selectedBrowser}).`);
            }
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        hideWildlinkProgress();
        tryAgainBtn.classList.remove('hidden'); // Show button again on error
        
        if (error.message.includes('closed') || error.message.includes('Target') || error.message.includes('disconnected')) {
            showWildlinkError('Browser was closed. Please click "Load from Wildlink" again to reinitialize the browser.');
        } else {
            showWildlinkError(`Try again failed: ${error.message}`);
        }
    } finally {
        hideWildlinkProgress();
    }
}

function showTestingModeDialog() {
    return new Promise((resolve) => {
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 10px;
            max-width: 400px;
            text-align: center;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        `;

        content.innerHTML = `
            <h3 style="margin-top: 0; color: #333;">Choose Testing Mode</h3>
            <p style="color: #666; margin-bottom: 25px;">Select how you want to test the merchants:</p>
            
            <button id="wildlinkTestBtn" style="
                display: block;
                width: 100%;
                margin: 10px 0;
                padding: 15px;
                background: #007bff;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 16px;
            ">🌐 Wildlink Testing (Regular website availability)</button>
            
            <button id="madminTestBtn" style="
                display: block;
                width: 100%;
                margin: 10px 0;
                padding: 15px;
                background: #28a745;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 16px;
            ">🔧 MAdmin Testing (Test affiliate links)</button>
            
            <button id="cancelTestBtn" style="
                display: block;
                width: 100%;
                margin: 15px 0 0 0;
                padding: 10px;
                background: #6c757d;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
            ">Cancel</button>
        `;

        dialog.appendChild(content);
        document.body.appendChild(dialog);

        // Add event listeners
        document.getElementById('wildlinkTestBtn').onclick = () => {
            document.body.removeChild(dialog);
            resolve('wildlink');
        };

        document.getElementById('madminTestBtn').onclick = () => {
            document.body.removeChild(dialog);
            resolve('madmin');
        };

        document.getElementById('cancelTestBtn').onclick = () => {
            document.body.removeChild(dialog);
            resolve(null);
        };

        // Close on background click
        dialog.onclick = (e) => {
            if (e.target === dialog) {
                document.body.removeChild(dialog);
                resolve(null);
            }
        };
    });
}

function showMAdminModeDialog() {
    return new Promise((resolve) => {
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;

        dialog.innerHTML = `
            <div style="
                background: white;
                padding: 30px;
                border-radius: 10px;
                text-align: center;
                max-width: 500px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            ">
                <h2 style="margin-top: 0; color: #333;">Choose MAdmin Testing Mode</h2>
                <p style="color: #666; margin-bottom: 25px;">
                    Select how you want to test merchant availability:
                </p>
                
                <button id="awinModeBtn" style="
                    display: block;
                    width: 100%;
                    margin: 10px 0;
                    padding: 15px;
                    background: #007bff;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 16px;
                ">🔗 Awin Link Testing (Standard - looks for awin1.com links)</button>
                
                <button id="urlModeBtn" style="
                    display: block;
                    width: 100%;
                    margin: 10px 0;
                    padding: 15px;
                    background: #28a745;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 16px;
                ">🌐 URL Availability Testing (New - checks merchant website URLs)</button>
                
                <button id="cancelModeBtn" style="
                    display: block;
                    width: 100%;
                    margin: 15px 0 0 0;
                    padding: 10px;
                    background: #6c757d;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 14px;
                ">Cancel</button>
            </div>
        `;

        // Add dialog to DOM first
        document.body.appendChild(dialog);

        // Now set up event listeners after elements are in DOM
        const awinBtn = dialog.querySelector('#awinModeBtn');
        const urlBtn = dialog.querySelector('#urlModeBtn');
        const cancelBtn = dialog.querySelector('#cancelModeBtn');

        if (awinBtn) {
            awinBtn.onclick = () => {
                document.body.removeChild(dialog);
                resolve('awin');
            };
        }

        if (urlBtn) {
            urlBtn.onclick = () => {
                document.body.removeChild(dialog);
                resolve('url');
            };
        }

        if (cancelBtn) {
            cancelBtn.onclick = () => {
                document.body.removeChild(dialog);
                resolve(null);
            };
        }

        // Close on background click
        dialog.onclick = (e) => {
            if (e.target === dialog) {
                document.body.removeChild(dialog);
                resolve(null);
            }
        };
    });
}

// Sync merchants from Wildlink Admin database
async function syncMerchantsFromAdmin() {
    try {
        console.log('🔄 Starting merchant sync from Wildlink Admin...');
        updateStatusMessage('🔄 Connecting to Wildlink Admin to sync merchants...');
        
        // Disable the sync button during operation
        const syncBtn = document.getElementById('syncMerchantsBtn');
        if (syncBtn) {
            syncBtn.disabled = true;
            syncBtn.textContent = '🔄 Syncing...';
        }
        
        // Call the IPC method to sync merchants
        const result = await window.electronAPI.madminSyncMerchants();
        
        if (result.success) {
            console.log(`✅ Successfully synced ${result.count} merchants from Wildlink Admin`);
            updateStatusMessage(`✅ Successfully synced ${result.count} merchants from Wildlink Admin database`);
            
            // Add the synced merchants to the input field
            if (result.merchants && result.merchants.length > 0) {
                const merchantUrls = result.merchants.map(merchant => merchant.url).join('\n');
                
                // If there's existing content, append to it
                const currentContent = merchantInput.value.trim();
                if (currentContent) {
                    merchantInput.value = currentContent + '\n' + merchantUrls;
                } else {
                    merchantInput.value = merchantUrls;
                }
                
                updateMerchantCount();
                
                // Show success notification
                showNotification(`Successfully synced ${result.count} merchants from Wildlink Admin database`, 'success');
            }
            
        } else {
            console.error('❌ Failed to sync merchants:', result.error);
            updateStatusMessage(`❌ Failed to sync merchants: ${result.error}`);
            showNotification(`Failed to sync merchants: ${result.error}`, 'error');
        }
        
    } catch (error) {
        console.error('❌ Error syncing merchants:', error);
        updateStatusMessage(`❌ Error syncing merchants: ${error.message}`);
        showNotification(`Error syncing merchants: ${error.message}`, 'error');
    } finally {
        // Re-enable the sync button
        const syncBtn = document.getElementById('syncMerchantsBtn');
        if (syncBtn) {
            syncBtn.disabled = false;
            syncBtn.textContent = '🔄 Sync Merchants';
        }
    }
}

// Show notification helper function
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
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
        word-wrap: break-word;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        animation: slideInRight 0.3s ease-out;
    `;
    
    // Set background color based on type
    switch (type) {
        case 'success':
            notification.style.backgroundColor = '#28a745';
            break;
        case 'error':
            notification.style.backgroundColor = '#dc3545';
            break;
        case 'warning':
            notification.style.backgroundColor = '#ffc107';
            notification.style.color = '#212529';
            break;
        default:
            notification.style.backgroundColor = '#007bff';
    }
    
    notification.textContent = message;
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}
