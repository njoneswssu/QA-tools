
// ============================================
// PRIORITY QUEUE FUNCTIONALITY
// ============================================

// Add merchant to priority queue
function addToQueue(merchant) {
    // Check if already in queue
    const existingIndex = priorityQueue.findIndex(m => 
        m.MerchantID === merchant.MerchantID || m.MerchantName === merchant.MerchantName
    );
    
    if (existingIndex === -1) {
        priorityQueue.push(merchant);
        updateQueueDisplay();
        showSuccess(`Added "${merchant.MerchantName}" to priority queue`);
    } else {
        showInfo(`"${merchant.MerchantName}" is already in the queue`);
    }
}

// Remove merchant from queue
function removeFromQueue(index) {
    const removed = priorityQueue.splice(index, 1);
    updateQueueDisplay();
    if (removed.length > 0) {
        showInfo(`Removed "${removed[0].MerchantName}" from queue`);
    }
}

// Clear entire queue
function clearQueue() {
    if (priorityQueue.length === 0) {
        showInfo('Queue is already empty');
        return;
    }
    
    if (confirm(`Clear all ${priorityQueue.length} merchants from the queue?`)) {
        priorityQueue = [];
        updateQueueDisplay();
        showSuccess('Queue cleared');
    }
}

// Update queue display
function updateQueueDisplay() {
    if (!elements.queueList || !elements.queueCount || !elements.queueSection) return;
    
    elements.queueCount.textContent = priorityQueue.length;
    
    // Show/hide queue section
    if (priorityQueue.length > 0) {
        elements.queueSection.style.display = 'block';
    } else {
        elements.queueSection.style.display = 'none';
    }
    
    // Update queue list
    if (priorityQueue.length === 0) {
        elements.queueList.innerHTML = `
            <div class="queue-placeholder">
                <i class="fas fa-info-circle"></i>
                <p>Click the <i class="fas fa-play-circle"></i> button on merchants to add them to the priority queue</p>
            </div>
        `;
    } else {
        elements.queueList.innerHTML = priorityQueue.map((merchant, index) => {
            const domain = merchant.MerchantDomains && merchant.MerchantDomains[0] 
                ? merchant.MerchantDomains[0] 
                : 'No domain';
            
            return `
                <div class="queue-item">
                    <div class="queue-item-number">${index + 1}</div>
                    <div class="queue-item-info">
                        <div class="queue-item-name">${escapeHtml(merchant.MerchantName)}</div>
                        <div class="queue-item-domain">${domain}</div>
                    </div>
                    <div class="queue-item-actions">
                        <button onclick="removeFromQueue(${index})" title="Remove from queue">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // Update merchant preview to show queue status
    updateMerchantCards();
}

// Update merchant cards to show queue buttons and status
function updateMerchantCards() {
    const cards = document.querySelectorAll('.merchant-card');
    cards.forEach(card => {
        const merchantName = card.dataset.merchantName;
        const merchantId = parseInt(card.dataset.merchantId);
        
        // Check if in queue
        const inQueue = priorityQueue.some(m => 
            (m.MerchantID && m.MerchantID === merchantId) || m.MerchantName === merchantName
        );
        
        // Add or update the queue button
        let actionsDiv = card.querySelector('.merchant-card-actions');
        if (!actionsDiv) {
            actionsDiv = document.createElement('div');
            actionsDiv.className = 'merchant-card-actions';
            card.style.position = 'relative';
            card.appendChild(actionsDiv);
        }
        
        const queueIndex = priorityQueue.findIndex(m => 
            (m.MerchantID && m.MerchantID === merchantId) || m.MerchantName === merchantName
        );
        
        if (inQueue) {
            actionsDiv.innerHTML = `
                <button class="btn-priority in-queue" onclick="event.stopPropagation(); removeFromQueueByMerchant('${escapeHtml(merchantName)}')">
                    <i class="fas fa-check-circle"></i> #${queueIndex + 1}
                </button>
            `;
        } else {
            actionsDiv.innerHTML = `
                <button class="btn-priority" onclick="event.stopPropagation(); addToQueueByCard(this)">
                    <i class="fas fa-play-circle"></i> Queue
                </button>
            `;
        }
    });
}

// Add to queue from card
function addToQueueByCard(button) {
    const card = button.closest('.merchant-card');
    const merchantName = card.dataset.merchantName;
    const merchantId = parseInt(card.dataset.merchantId);
    
    // Find the merchant in filtered or all merchants
    const merchant = filteredMerchants.find(m => 
        (m.MerchantID && m.MerchantID === merchantId) || m.MerchantName === merchantName
    ) || allMerchants.find(m => 
        (m.MerchantID && m.MerchantID === merchantId) || m.MerchantName === merchantName
    );
    
    if (merchant) {
        addToQueue(merchant);
    }
}

// Remove from queue by merchant name
function removeFromQueueByMerchant(merchantName) {
    const index = priorityQueue.findIndex(m => m.MerchantName === merchantName);
    if (index !== -1) {
        removeFromQueue(index);
    }
}

// Make these functions globally accessible
window.addToQueue = addToQueue;
window.removeFromQueue = removeFromQueue;
window.clearQueue = clearQueue;
window.addToQueueByCard = addToQueueByCard;
window.removeFromQueueByMerchant = removeFromQueueByMerchant;

// ============================================
// QUEUE SEARCH WITH AUTOCOMPLETE
// ============================================

let queueSearchInput = null;
let queueAutocomplete = null;
let selectedAutocompleteIndex = -1;
let autocompleteResults = [];

// Initialize queue search functionality
function initializeQueueSearch() {
    queueSearchInput = document.getElementById('queue-search');
    queueAutocomplete = document.getElementById('queue-autocomplete');
    
    if (!queueSearchInput || !queueAutocomplete) return;
    
    // Debounced search function
    let searchTimeout = null;
    queueSearchInput.addEventListener('input', function(e) {
        const query = e.target.value.trim();
        
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            if (query.length >= 2) {
                performQueueSearch(query);
            } else {
                hideAutocomplete();
            }
        }, 300);
    });
    
    // Keyboard navigation
    queueSearchInput.addEventListener('keydown', function(e) {
        if (!queueAutocomplete.style.display || queueAutocomplete.style.display === 'none') return;
        
        const items = queueAutocomplete.querySelectorAll('.autocomplete-item');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedAutocompleteIndex = Math.min(selectedAutocompleteIndex + 1, items.length - 1);
            updateAutocompleteSelection(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedAutocompleteIndex = Math.max(selectedAutocompleteIndex - 1, 0);
            updateAutocompleteSelection(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedAutocompleteIndex >= 0 && selectedAutocompleteIndex < autocompleteResults.length) {
                const merchant = autocompleteResults[selectedAutocompleteIndex];
                addToQueue(merchant);
                queueSearchInput.value = '';
                hideAutocomplete();
            }
        } else if (e.key === 'Escape') {
            hideAutocomplete();
        }
    });
    
    // Close autocomplete when clicking outside
    document.addEventListener('click', function(e) {
        if (!queueSearchInput.contains(e.target) && !queueAutocomplete.contains(e.target)) {
            hideAutocomplete();
        }
    });
}

// Perform search and show autocomplete suggestions
function performQueueSearch(query) {
    const lowerQuery = query.toLowerCase();
    
    // Search in all merchants (both filtered and all)
    const merchantsToSearch = window.filteredMerchants && window.filteredMerchants.length > 0 
        ? window.filteredMerchants 
        : window.allMerchants || [];
    
    if (merchantsToSearch.length === 0) {
        showNoResultsAutocomplete();
        return;
    }
    
    // Filter merchants by name, domain, or category
    autocompleteResults = merchantsToSearch.filter(merchant => {
        const name = (merchant.MerchantName || '').toLowerCase();
        const domain = (merchant.MerchantDomains && merchant.MerchantDomains[0]) 
            ? merchant.MerchantDomains[0].toLowerCase() 
            : '';
        const category = (merchant.PrimaryCategory || '').toLowerCase();
        
        return name.includes(lowerQuery) || 
               domain.includes(lowerQuery) || 
               category.includes(lowerQuery);
    }).slice(0, 10); // Limit to 10 results
    
    if (autocompleteResults.length === 0) {
        showNoResultsAutocomplete();
    } else {
        showAutocompleteResults();
    }
}

// Show autocomplete results
function showAutocompleteResults() {
    selectedAutocompleteIndex = -1;
    
    const html = autocompleteResults.map((merchant, index) => {
        const domain = merchant.MerchantDomains && merchant.MerchantDomains[0] 
            ? merchant.MerchantDomains[0] 
            : 'No domain';
        const category = merchant.PrimaryCategory || 'No category';
        
        // Check if already in queue
        const inQueue = window.priorityQueue && window.priorityQueue.some(m => 
            (m.MerchantID && m.MerchantID === merchant.MerchantID) || 
            m.MerchantName === merchant.MerchantName
        );
        
        return `
            <div class="autocomplete-item" data-index="${index}">
                <div class="autocomplete-item-info">
                    <div class="autocomplete-item-name">${escapeHtml(merchant.MerchantName)}</div>
                    <div class="autocomplete-item-domain">${escapeHtml(domain)}</div>
                    <div class="autocomplete-item-category">${escapeHtml(category)}</div>
                </div>
                <div class="autocomplete-item-action">
                    ${inQueue ? '<i class="fas fa-check"></i> In Queue' : '<i class="fas fa-plus"></i> Add'}
                </div>
            </div>
        `;
    }).join('');
    
    queueAutocomplete.innerHTML = html;
    queueAutocomplete.style.display = 'block';
    
    // Add click handlers
    queueAutocomplete.querySelectorAll('.autocomplete-item').forEach((item, index) => {
        item.addEventListener('click', () => {
            const merchant = autocompleteResults[index];
            addToQueue(merchant);
            queueSearchInput.value = '';
            hideAutocomplete();
        });
    });
}

// Show no results message
function showNoResultsAutocomplete() {
    queueAutocomplete.innerHTML = `
        <div class="autocomplete-empty">
            <i class="fas fa-search"></i>
            <div>No merchants found</div>
        </div>
    `;
    queueAutocomplete.style.display = 'block';
}

// Hide autocomplete
function hideAutocomplete() {
    if (queueAutocomplete) {
        queueAutocomplete.style.display = 'none';
        selectedAutocompleteIndex = -1;
    }
}

// Update keyboard selection visual
function updateAutocompleteSelection(items) {
    items.forEach((item, index) => {
        if (index === selectedAutocompleteIndex) {
            item.classList.add('keyboard-selected');
            item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
            item.classList.remove('keyboard-selected');
        }
    });
}

// Helper function for HTML escaping
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// REAL-TIME TERMINAL LOGGING
// ============================================

// Enhanced logging with real-time updates
let logBuffer = [];
let logUpdateInterval = null;

// Initialize log search functionality
function initializeLogSearch() {
    const logSearchInput = document.getElementById('log-search-input');
    const logSearchInfo = document.getElementById('log-search-info');
    const logContainer = document.getElementById('log-container');
    
    if (!logSearchInput || !logSearchInfo || !logContainer) return;
    
    let currentMatchIndex = 0;
    let matches = [];
    
    function performSearch() {
        const searchTerm = logSearchInput.value.toLowerCase();
        const logEntries = logContainer.querySelectorAll('.log-entry');
        
        // Clear previous highlights
        logEntries.forEach(entry => {
            entry.classList.remove('highlight', 'current-match');
        });
        
        matches = [];
        
        if (!searchTerm) {
            logSearchInfo.textContent = '';
            currentMatchIndex = 0;
            return;
        }
        
        // Find and highlight all matches
        logEntries.forEach((entry, index) => {
            const text = entry.textContent.toLowerCase();
            if (text.includes(searchTerm)) {
                entry.classList.add('highlight');
                matches.push({ entry, index });
            }
        });
        
        // Update info and highlight current match
        if (matches.length > 0) {
            currentMatchIndex = 0;
            highlightCurrentMatch();
        } else {
            logSearchInfo.textContent = 'No matches';
            currentMatchIndex = 0;
        }
    }
    
    function highlightCurrentMatch() {
        if (matches.length === 0) return;
        
        // Remove previous current match highlight
        matches.forEach(m => m.entry.classList.remove('current-match'));
        
        // Highlight current match
        const current = matches[currentMatchIndex];
        current.entry.classList.add('current-match');
        current.entry.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Update info text
        logSearchInfo.textContent = `${currentMatchIndex + 1} of ${matches.length} matches`;
    }
    
    function navigateMatches(direction) {
        if (matches.length === 0) return;
        
        if (direction === 'next') {
            currentMatchIndex = (currentMatchIndex + 1) % matches.length;
        } else if (direction === 'prev') {
            currentMatchIndex = (currentMatchIndex - 1 + matches.length) % matches.length;
        }
        
        highlightCurrentMatch();
    }
    
    logSearchInput.addEventListener('input', performSearch);
    
    // Keyboard navigation
    logSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            navigateMatches('next');
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            navigateMatches('prev');
        } else if (e.key === 'Escape') {
            logSearchInput.value = '';
            performSearch();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            navigateMatches('next');
        }
    });
}

// Start real-time log streaming (polls the Playwright process output)
function startRealTimeLogging() {
    // The actual Playwright logs will come from the browser console
    // We'll enhance the existing addLogEntry to make it searchable
    
    // Make log container searchable with Ctrl+F
    const logContainer = document.getElementById('log-container');
    if (logContainer) {
        logContainer.setAttribute('tabindex', '0');
        logContainer.style.userSelect = 'text';
        logContainer.style.cursor = 'text';
    }
}

// Enhanced addLogEntry with better formatting for terminal-like appearance
const originalAddLogEntry = window.addLogEntry || addLogEntry;

function enhancedAddLogEntry(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${type}`;
    logEntry.innerHTML = `
        <span class="log-time">[${timestamp}]</span>
        <span class="log-message">${escapeHtml(message)}</span>
    `;
    
    elements.logContainer.appendChild(logEntry);
    
    // Auto-scroll if enabled
    if (autoScroll) {
        logEntry.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
    
    // Limit log entries to prevent memory issues
    const maxLogs = 1000;
    while (elements.logContainer.children.length > maxLogs) {
        elements.logContainer.removeChild(elements.logContainer.firstChild);
    }
}

// Override the global addLogEntry if it exists
if (typeof addLogEntry === 'function') {
    const _originalAddLogEntry = addLogEntry;
    addLogEntry = function(message, type) {
        _originalAddLogEntry(message, type);
        // Make sure logs are searchable
        startRealTimeLogging();
    };
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    startRealTimeLogging();
    initializeQueueSearch();
    initializeLogSearch();
});

// Also initialize when queue section is shown
if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const queueSection = document.getElementById('queue-section');
                if (queueSection && queueSection.style.display !== 'none') {
                    // Queue is now visible, ensure search is initialized
                    if (!queueSearchInput) {
                        initializeQueueSearch();
                    }
                }
            }
        });
    });
    
    // Start observing the queue section for style changes
    setTimeout(() => {
        const queueSection = document.getElementById('queue-section');
        if (queueSection) {
            observer.observe(queueSection, { attributes: true });
        }
    }, 1000);
}

