// Popup script for Wildlink Traffic Monitor Extension

let logs = [];
let statsInterval = null;

// Load logs from storage
async function loadLogs() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getLogs' });
    if (response && response.success) {
      logs = response.logs || [];
      return logs;
    }
  } catch (error) {
    console.error('Error loading logs:', error);
  }
  return [];
}

// Load stats
async function loadStats() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getStats' });
    if (response && response.success) {
      return response.stats;
    }
  } catch (error) {
    console.error('Error loading stats:', error);
  }
  return { total: 0, byDomain: {}, recent: [] };
}

// Update UI with stats
async function updateStats() {
  const stats = await loadStats();
  
  document.getElementById('totalRequests').textContent = stats.total || 0;
  
  updateRecentLogs(stats.recent || []);
}

// Update recent logs display
function updateRecentLogs(recentLogs) {
  const logsList = document.getElementById('recentLogs');
  
  if (!recentLogs || recentLogs.length === 0) {
    logsList.innerHTML = '<div class="empty-state">No Wildlink traffic captured yet. Browse normally and traffic will be captured automatically.</div>';
    return;
  }
  
  // Reverse to show most recent first
  const reversed = [...recentLogs].reverse();
  
  logsList.innerHTML = reversed.map((log, index) => {
    const time = new Date(log.timestamp).toLocaleTimeString();
    const statusClass = log.statusCode >= 200 && log.statusCode < 300 ? 'success' : 'error';
    const shortUrl = log.url.length > 60 ? log.url.substring(0, 60) + '...' : log.url;
    
    return `
      <div class="log-item" data-log-index="${index}" title="Click to view details">
        <div class="log-item-header">
          <span class="log-method">${log.method}</span>
          ${log.statusCode ? `<span class="log-status ${statusClass}">${log.statusCode}</span>` : ''}
        </div>
        <div class="log-url">${shortUrl}</div>
        <div class="log-time">${time}</div>
      </div>
    `;
  }).join('');
  
  // Add click handlers
  logsList.querySelectorAll('.log-item').forEach(item => {
    item.addEventListener('click', () => {
      const index = parseInt(item.getAttribute('data-log-index'));
      showLogDetails(reversed[index]);
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

// Clear logs
async function clearLogs() {
  if (confirm('Are you sure you want to clear all captured logs?')) {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'clearLogs' });
      if (response && response.success) {
        await updateStats();
        console.log('Logs cleared');
      } else {
        console.error('Failed to clear logs');
      }
    } catch (error) {
      console.error('Error clearing logs:', error);
      alert('Error clearing logs. Please try again.');
    }
  }
}

// Open dashboard in new tab
function openDashboard() {
  chrome.tabs.create({
    url: chrome.runtime.getURL('dashboard.html')
  });
}

// Initialize popup
async function init() {
  await updateStats();
  
  // Update stats every 2 seconds
  statsInterval = setInterval(updateStats, 2000);
  
  // Listen for new logs from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'newLog') {
      updateStats();
    }
  });
}

// Event listeners
document.getElementById('viewDashboard').addEventListener('click', openDashboard);
document.getElementById('clearLogs').addEventListener('click', clearLogs);

// Modal close handlers
document.getElementById('closeModal').addEventListener('click', closeModal);
window.addEventListener('click', (event) => {
  const modal = document.getElementById('detailModal');
  if (event.target === modal) {
    closeModal();
  }
});

// Initialize on load
document.addEventListener('DOMContentLoaded', init);

// Cleanup on unload
window.addEventListener('beforeunload', () => {
  if (statsInterval) {
    clearInterval(statsInterval);
  }
});

