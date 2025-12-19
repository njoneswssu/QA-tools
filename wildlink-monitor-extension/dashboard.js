// Dashboard script for Wildlink Traffic Monitor Extension

let allLogs = [];
let filteredLogs = [];
let activeFilters = {
  search: '',
  method: '',
  status: '',
  params: '',
  domain: ''
};

// Load logs from storage
async function loadLogs() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getLogs' });
    if (response && response.success) {
      allLogs = response.logs || [];
      return allLogs;
    }
  } catch (error) {
    console.error('Error loading logs:', error);
  }
  return [];
}

// Update stats and populate filter dropdowns
function updateStats() {
  const total = allLogs.length;
  const wildlinkCount = allLogs.filter(log => log.hostname.includes('wild.link')).length;
  const wildlinkMeCount = allLogs.filter(log => log.hostname.includes('wildlink.me')).length;
  
  document.getElementById('totalRequests').textContent = total;
  document.getElementById('wildlinkCount').textContent = wildlinkCount;
  document.getElementById('wildlinkMeCount').textContent = wildlinkMeCount;
  
  // Populate method filter
  const methodFilter = document.getElementById('methodFilter');
  const methods = [...new Set(allLogs.map(log => log.method).filter(Boolean))].sort();
  const currentMethod = methodFilter.value;
  methodFilter.innerHTML = '<option value="">All Methods</option>';
  methods.forEach(method => {
    const option = document.createElement('option');
    option.value = method;
    option.textContent = method;
    methodFilter.appendChild(option);
  });
  if (currentMethod) {
    methodFilter.value = currentMethod;
  }
  
  // Populate status filter
  const statusFilter = document.getElementById('statusFilter');
  const statuses = [...new Set(allLogs.map(log => {
    return log.statusCode ? String(log.statusCode) : 'Pending';
  }))].sort((a, b) => {
    if (a === 'Pending') return 1;
    if (b === 'Pending') return -1;
    const aNum = parseInt(a);
    const bNum = parseInt(b);
    if (isNaN(aNum)) return 1;
    if (isNaN(bNum)) return -1;
    return aNum - bNum;
  });
  const currentStatus = statusFilter ? statusFilter.value : '';
  if (statusFilter) {
    statusFilter.innerHTML = '<option value="">All Status Codes</option>';
    statuses.forEach(status => {
      const option = document.createElement('option');
      option.value = status;
      option.textContent = status;
      statusFilter.appendChild(option);
    });
    if (currentStatus) {
      statusFilter.value = currentStatus;
    }
  }
}

// Display logs in table
function displayLogs(logs) {
  const tbody = document.getElementById('logsTableBody');
  
  if (!logs || logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No logs found</td></tr>';
    return;
  }
  
  // Sort by timestamp (newest first)
  const sorted = [...logs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  tbody.innerHTML = sorted.map((log, index) => {
    const time = new Date(log.timestamp).toLocaleString();
    const statusClass = log.statusCode >= 200 && log.statusCode < 300 ? 'success' : 'error';
    const statusText = log.statusCode || 'Pending';
    const params = Object.keys(log.importantParams || {}).length > 0 
      ? Object.entries(log.importantParams).map(([k, v]) => `${k}=${v.substring(0, 20)}`).join(', ')
      : 'None';
    const pageUrl = log.pageUrl || log.tabUrl || 'N/A';
    const shortPageUrl = pageUrl.length > 40 ? pageUrl.substring(0, 40) + '...' : pageUrl;
    
    // Extension info
    const extensionDisplay = log.extensionName 
      ? `${log.extensionName}`
      : (log.extensionId ? `Extension (${log.extensionId.substring(0, 8)}...)` : 'Browser');
    
    return `
      <tr data-log-index="${index}" title="Click to view details">
        <td>${time}</td>
        <td><span class="method">${log.method}</span></td>
        <td><span class="status ${statusClass}">${statusText}</span></td>
        <td class="url"><a href="${log.url}" target="_blank" title="${log.url}" onclick="event.stopPropagation()">${log.url}</a></td>
        <td title="${params}">${params.substring(0, 50)}${params.length > 50 ? '...' : ''}</td>
        <td title="${log.extensionId || 'N/A'}">${extensionDisplay}</td>
        <td title="${pageUrl}">${shortPageUrl}</td>
      </tr>
    `;
  }).join('');
  
  // Add click handlers
  tbody.querySelectorAll('tr[data-log-index]').forEach(row => {
    row.addEventListener('click', () => {
      const index = parseInt(row.getAttribute('data-log-index'));
      showLogDetails(sorted[index]);
    });
  });
}

// Store current log for download
let currentModalLog = null;

// Show log details in modal
function showLogDetails(log) {
  const modal = document.getElementById('detailModal');
  const modalBody = document.getElementById('modalBody');
  
  // Store log for download
  currentModalLog = log;
  
  const formatValue = (value) => {
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value || 'N/A');
  };
  
  modalBody.innerHTML = `
    <div class="modal-actions">
      <button class="download-btn-modal" id="downloadModalBtn" title="Download this log entry">⬇ Download This Log</button>
    </div>
    <div class="detail-item">
      <div class="detail-label">Timestamp</div>
      <div class="detail-value">${new Date(log.timestamp).toLocaleString()}</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">Method</div>
      <div class="detail-value">${log.method}</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">Status Code</div>
      <div class="detail-value">${log.statusCode || 'Pending'}</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">URL</div>
      <div class="detail-value"><a href="${log.url}" target="_blank">${log.url}</a></div>
    </div>
    <div class="detail-item">
      <div class="detail-label">Hostname</div>
      <div class="detail-value">${log.hostname}</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">Path</div>
      <div class="detail-value">${log.path}</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">Query Parameters</div>
      <div class="detail-value"><pre>${formatValue(log.queryParams)}</pre></div>
    </div>
    <div class="detail-item">
      <div class="detail-label">Important Parameters</div>
      <div class="detail-value"><pre>${formatValue(log.importantParams)}</pre></div>
    </div>
    <div class="detail-item">
      <div class="detail-label">Request Headers</div>
      <div class="detail-value"><pre>${formatValue(log.headers)}</pre></div>
    </div>
    <div class="detail-item">
      <div class="detail-label">Response Headers</div>
      <div class="detail-value"><pre>${formatValue(log.responseHeaders)}</pre></div>
    </div>
    <div class="detail-item">
      <div class="detail-label">Request Body</div>
      <div class="detail-value"><pre>${log.requestBody || 'N/A'}</pre></div>
    </div>
    <div class="detail-item">
      <div class="detail-label">Response Body</div>
      <div class="detail-value"><pre>${log.responseBody || 'N/A'}</pre></div>
    </div>
    <div class="detail-item">
      <div class="detail-label">Source Page URL</div>
      <div class="detail-value">${log.pageUrl || log.tabUrl || 'N/A'}</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">Source Page Title</div>
      <div class="detail-value">${log.pageTitle || 'N/A'}</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">Initiator</div>
      <div class="detail-value">${log.initiator || 'N/A'}</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">Extension ID</div>
      <div class="detail-value">${log.extensionId || 'N/A (Browser-initiated)'}</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">Extension Name</div>
      <div class="detail-value">${log.extensionName || 'N/A (Browser-initiated)'}</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">Completed</div>
      <div class="detail-value">${log.completed ? 'Yes' : 'No'}</div>
    </div>
  `;
  
  // Add event listener for modal download button
  const downloadModalBtn = document.getElementById('downloadModalBtn');
  if (downloadModalBtn) {
    downloadModalBtn.addEventListener('click', () => {
      downloadSingleLog(log);
    });
  }
  
  modal.style.display = 'block';
}

// Close modal
function closeModal() {
  const modal = document.getElementById('detailModal');
  modal.style.display = 'none';
}

// Handle ESC key to close modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('detailModal');
    if (modal && modal.style.display === 'block') {
      closeModal();
    }
  }
});

// Filter logs
function filterLogs() {
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  const methodFilter = document.getElementById('methodFilter').value;
  const statusFilter = document.getElementById('statusFilter').value;
  const paramsFilter = document.getElementById('paramsFilter').value;
  
  activeFilters.search = searchTerm;
  activeFilters.method = methodFilter;
  activeFilters.status = statusFilter;
  activeFilters.params = paramsFilter;
  
  filteredLogs = allLogs.filter(log => {
    // Domain filter (from stat card clicks) - apply first
    if (activeFilters.domain) {
      if (activeFilters.domain === 'wildlink') {
        // Filter for wild.link domain
        if (!log.hostname || !log.hostname.includes('wild.link')) {
          return false;
        }
      } else if (activeFilters.domain === 'wildlinkme') {
        // Filter for wildlink.me domain
        if (!log.hostname || !log.hostname.includes('wildlink.me')) {
          return false;
        }
      } else if (activeFilters.domain === 'total') {
        // Show all - no domain filter
      }
    }
    
    // Search filter
    if (searchTerm) {
      const matchesSearch = log.url.toLowerCase().includes(searchTerm) ||
             JSON.stringify(log.queryParams || {}).toLowerCase().includes(searchTerm) ||
             JSON.stringify(log.importantParams || {}).toLowerCase().includes(searchTerm) ||
             (log.pageUrl && log.pageUrl.toLowerCase().includes(searchTerm)) ||
             (log.hostname && log.hostname.toLowerCase().includes(searchTerm));
      if (!matchesSearch) return false;
    }
    
    // Method filter
    if (methodFilter && log.method !== methodFilter) {
      return false;
    }
    
    // Status filter
    if (statusFilter) {
      // Handle both numeric status codes and "Pending"
      const logStatus = log.statusCode ? String(log.statusCode) : 'Pending';
      // Compare as strings
      if (String(logStatus) !== String(statusFilter)) {
        return false;
      }
    }
    
    // Parameters filter
    if (paramsFilter === 'with-params') {
      const hasParams = (log.queryParams && Object.keys(log.queryParams).length > 0) ||
                       (log.importantParams && Object.keys(log.importantParams).length > 0);
      if (!hasParams) return false;
    } else if (paramsFilter === 'no-params') {
      const hasParams = (log.queryParams && Object.keys(log.queryParams).length > 0) ||
                       (log.importantParams && Object.keys(log.importantParams).length > 0);
      if (hasParams) return false;
    }
    
    return true;
  });
  
  displayLogs(filteredLogs);
  updateFilterDisplay();
}

// Update visual display of active filters
function updateFilterDisplay() {
  // Update stat card active states
  const totalCard = document.getElementById('totalRequestsCard');
  const wildlinkCard = document.getElementById('wildlinkCountCard');
  const wildlinkMeCard = document.getElementById('wildlinkMeCountCard');
  
  // Remove active class from all cards
  [totalCard, wildlinkCard, wildlinkMeCard].forEach(card => {
    if (card) card.classList.remove('active');
  });
  
  // Add active class to current filter card
  if (activeFilters.domain === 'total' && totalCard) {
    totalCard.classList.add('active');
  } else if (activeFilters.domain === 'wildlink' && wildlinkCard) {
    wildlinkCard.classList.add('active');
  } else if (activeFilters.domain === 'wildlinkme' && wildlinkMeCard) {
    wildlinkMeCard.classList.add('active');
  }
}

// Clear filter
function clearFilter() {
  document.getElementById('searchInput').value = '';
  document.getElementById('methodFilter').value = '';
  document.getElementById('statusFilter').value = '';
  document.getElementById('paramsFilter').value = '';
  activeFilters = {
    search: '',
    method: '',
    status: '',
    params: '',
    domain: ''
  };
  
  filteredLogs = [...allLogs];
  displayLogs(filteredLogs);
  updateFilterDisplay();
}

// Toggle filter by clicking stat card
function toggleFilter(domain) {
  // If already active, clear it
  if (activeFilters.domain === domain) {
    activeFilters.domain = '';
  } else {
    // Set new active domain filter
    activeFilters.domain = domain;
  }
  
  // Apply all filters
  filterLogs();
}

// Download a single log entry
function downloadSingleLog(log) {
  if (!log) {
    alert('No log to download');
    return;
  }
  
  const dataStr = JSON.stringify(log, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  const timestamp = new Date(log.timestamp).toISOString().replace(/[:.]/g, '-');
  link.download = `wildlink-log-${timestamp}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Download stats
function downloadStats(type) {
  let logsToDownload = [];
  
  switch(type) {
    case 'total':
      logsToDownload = allLogs;
      break;
    case 'wildlink':
      logsToDownload = allLogs.filter(log => log.hostname && log.hostname.includes('wild.link'));
      break;
    case 'wildlinkme':
      logsToDownload = allLogs.filter(log => log.hostname && log.hostname.includes('wildlink.me'));
      break;
    default:
      logsToDownload = allLogs;
  }
  
  if (logsToDownload.length === 0) {
    alert('No logs to download');
    return;
  }
  
  const dataStr = JSON.stringify(logsToDownload, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `wildlink-logs-${type}-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Clear all logs
async function clearAllLogs() {
  if (confirm('Are you sure you want to clear all captured logs? This cannot be undone.')) {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'clearLogs' });
      if (response && response.success) {
        await refreshLogs();
        console.log('All logs cleared');
      } else {
        console.error('Failed to clear logs');
        alert('Error clearing logs. Please try again.');
      }
    } catch (error) {
      console.error('Error clearing logs:', error);
      alert('Error clearing logs. Please try again.');
    }
  }
}

// Refresh logs
async function refreshLogs() {
  await loadLogs();
  // Reapply all active filters
  filterLogs();
  updateStats();
}

// Initialize dashboard
async function init() {
  await refreshLogs();
  
  // Auto-refresh every 5 seconds
  setInterval(refreshLogs, 5000);
  
  // Listen for new logs
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'newLog') {
      refreshLogs();
    }
  });
  
  // Real-time search as you type
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    // Filter as you type (with debounce for performance)
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        filterLogs();
      }, 300); // Wait 300ms after user stops typing
    });
    
    // Also allow Enter key for immediate filter
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(searchTimeout);
        filterLogs();
      }
    });
  }
  
  // Filter dropdowns
  const methodFilter = document.getElementById('methodFilter');
  const statusFilter = document.getElementById('statusFilter');
  const paramsFilter = document.getElementById('paramsFilter');
  
  if (methodFilter) {
    methodFilter.addEventListener('change', filterLogs);
  }
  
  if (statusFilter) {
    statusFilter.addEventListener('change', filterLogs);
  }
  
  if (paramsFilter) {
    paramsFilter.addEventListener('change', filterLogs);
  }
}

// Make functions global for onclick handlers
window.filterLogs = filterLogs;
window.clearFilter = clearFilter;
window.clearAllLogs = clearAllLogs;
window.refreshLogs = refreshLogs;
window.closeModal = closeModal;
window.toggleFilter = toggleFilter;
window.downloadStats = downloadStats;

// Modal close handlers and button event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Button event listeners
  const filterBtn = document.getElementById('filterBtn');
  const clearFilterBtn = document.getElementById('clearFilterBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  
  if (filterBtn) {
    filterBtn.addEventListener('click', filterLogs);
  }
  
  if (clearFilterBtn) {
    clearFilterBtn.addEventListener('click', clearFilter);
  }
  
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', clearAllLogs);
  }
  
  if (refreshBtn) {
    refreshBtn.addEventListener('click', refreshLogs);
  }
  
  // Stat card click handlers for filtering
  const statCards = document.querySelectorAll('.stat-card');
  statCards.forEach(card => {
    card.addEventListener('click', (e) => {
      // Don't trigger filter if clicking the download button
      if (e.target.classList.contains('download-btn')) {
        return;
      }
      const filterType = card.getAttribute('data-filter-type');
      if (filterType) {
        toggleFilter(filterType);
      }
    });
  });
  
  // Download button event listeners for stat cards
  // Use event delegation since buttons are in the DOM
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('download-btn') && !e.target.classList.contains('download-btn-modal')) {
      e.stopPropagation(); // Prevent triggering stat card click
      const type = e.target.getAttribute('data-download-type');
      if (type) {
        downloadStats(type);
      }
    }
  });
  
  // Modal close handlers
  const closeBtn = document.getElementById('closeModal');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }
  
  window.addEventListener('click', (event) => {
    const modal = document.getElementById('detailModal');
    if (event.target === modal) {
      closeModal();
    }
  });
});

// Initialize on load
document.addEventListener('DOMContentLoaded', init);

