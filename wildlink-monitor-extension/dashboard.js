// Dashboard script for Wildlink Traffic Monitor Extension

let allLogs = [];
let filteredLogs = [];

// Load logs from storage
async function loadLogs() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getLogs' });
    if (response && response.success) {
      allLogs = response.logs || [];
      // Preserve current filter if search is active
      const searchInput = document.getElementById('searchInput');
      const currentSearch = searchInput ? searchInput.value : '';
      if (currentSearch) {
        // Reapply filter with new data
        filterLogs();
      } else {
        // No filter, show all logs
        filteredLogs = [...allLogs];
      }
      return allLogs;
    }
  } catch (error) {
    console.error('Error loading logs:', error);
  }
  return [];
}

// Update stats
function updateStats() {
  const total = allLogs.length;
  const wildlinkCount = allLogs.filter(log => log.hostname.includes('wild.link')).length;
  const wildlinkMeCount = allLogs.filter(log => log.hostname.includes('wildlink.me')).length;
  
  document.getElementById('totalRequests').textContent = total;
  document.getElementById('wildlinkCount').textContent = wildlinkCount;
  document.getElementById('wildlinkMeCount').textContent = wildlinkMeCount;
}

// Display logs in table
function displayLogs(logs) {
  const tbody = document.getElementById('logsTableBody');
  
  if (!logs || logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No logs found</td></tr>';
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
    
    return `
      <tr data-log-index="${index}" title="Click to view details">
        <td>${time}</td>
        <td><span class="method">${log.method}</span></td>
        <td><span class="status ${statusClass}">${statusText}</span></td>
        <td class="url"><a href="${log.url}" target="_blank" title="${log.url}" onclick="event.stopPropagation()">${log.url}</a></td>
        <td title="${params}">${params.substring(0, 50)}${params.length > 50 ? '...' : ''}</td>
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

// Show log details in modal
function showLogDetails(log) {
  const modal = document.getElementById('detailModal');
  const modalBody = document.getElementById('modalBody');
  
  const formatValue = (value) => {
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value || 'N/A');
  };
  
  modalBody.innerHTML = `
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
      <div class="detail-label">Completed</div>
      <div class="detail-value">${log.completed ? 'Yes' : 'No'}</div>
    </div>
  `;
  
  modal.style.display = 'block';
}

// Close modal
function closeModal() {
  const modal = document.getElementById('detailModal');
  modal.style.display = 'none';
}

// Filter logs
function filterLogs() {
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  
  if (!searchTerm) {
    filteredLogs = [...allLogs];
  } else {
    filteredLogs = allLogs.filter(log => {
      return log.url.toLowerCase().includes(searchTerm) ||
             JSON.stringify(log.queryParams || {}).toLowerCase().includes(searchTerm) ||
             JSON.stringify(log.importantParams || {}).toLowerCase().includes(searchTerm) ||
             (log.pageUrl && log.pageUrl.toLowerCase().includes(searchTerm)) ||
             log.hostname.toLowerCase().includes(searchTerm);
    });
  }
  
  displayLogs(filteredLogs);
}

// Clear filter
function clearFilter() {
  document.getElementById('searchInput').value = '';
  filteredLogs = [...allLogs];
  displayLogs(filteredLogs);
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
  // Keep current filter when refreshing - don't clear search
  const currentSearch = document.getElementById('searchInput').value;
  if (currentSearch) {
    // Reapply filter if there's a search term
    filterLogs();
  } else {
    // No filter, show all logs
    filteredLogs = [...allLogs];
    displayLogs(filteredLogs);
  }
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
}

// Make functions global for onclick handlers
window.filterLogs = filterLogs;
window.clearFilter = clearFilter;
window.clearAllLogs = clearAllLogs;
window.refreshLogs = refreshLogs;
window.closeModal = closeModal;

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

