// Normalize hex color to standard format
function normalizeHex(hex) {
    // Remove # if present
    hex = hex.replace('#', '').toUpperCase();
    
    // Validate hex format
    if (!/^[0-9A-F]{6}$/.test(hex)) {
        return null;
    }
    
    return '#' + hex;
}

// Convert hex to RGB
function hexToRgb(hex) {
    const normalized = normalizeHex(hex);
    if (!normalized) return null;
    
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(normalized);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

// Update color preview
function updateColorPreview() {
    const hexInput = document.getElementById('hexInput');
    const colorPreview = document.getElementById('colorPreview');
    const normalized = normalizeHex(hexInput.value);
    
    if (normalized) {
        colorPreview.style.background = normalized;
        colorPreview.style.borderColor = '#10b981';
    } else {
        colorPreview.style.background = 'white';
        colorPreview.style.borderColor = '#e0e0e0';
    }
}

// Show status message
function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
}

// Show results
function showResults(data) {
    const resultsDiv = document.getElementById('results');
    
    if (data.cellsCleared === 0) {
        resultsDiv.innerHTML = '<p>No cells found with the specified color.</p>';
        return;
    }
    
    let html = `<p><strong>Results:</strong></p>`;
    html += `<p>✓ Cleared ${data.cellsCleared} cell(s) across ${data.sheetsProcessed} sheet(s)</p>`;
    
    if (data.sheetDetails && data.sheetDetails.length > 0) {
        html += '<ul class="results-list">';
        data.sheetDetails.forEach(sheet => {
            if (sheet.cleared > 0) {
                html += `<li>${sheet.name}: ${sheet.cleared} cell(s)</li>`;
            }
        });
        html += '</ul>';
    }
    
    resultsDiv.innerHTML = html;
}

// Check if we're on Excel Online and API is available
async function checkExcelPage() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab || !tab.url) {
            return { isExcel: false, apiReady: false };
        }
        
        const url = tab.url.toLowerCase();
        const isExcel = url.includes('excel') && 
                       (url.includes('office.com') || 
                        url.includes('live.com') || 
                        url.includes('sharepoint.com') ||
                        url.includes('hunterdouglasna.sharepoint.com') ||
                        url.includes('excel.cloud.microsoft'));
        
        if (!isExcel) {
            return { isExcel: false, apiReady: false };
        }
        
        // Check if Excel API is actually available
        try {
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'checkExcelAPI' });
            return { 
                isExcel: true, 
                apiReady: response.available,
                error: response.error 
            };
        } catch (error) {
            // Content script may not be injected yet
            return { 
                isExcel: true, 
                apiReady: false,
                error: 'Excel page detected but not ready. Please refresh the page and try again.'
            };
        }
    } catch (error) {
        console.error('Error checking page:', error);
        return { isExcel: false, apiReady: false };
    }
}

// Main clear function
async function clearCells() {
    const hexInput = document.getElementById('hexInput').value.trim();
    const allSheets = document.getElementById('allSheets').checked;
    const confirmBefore = document.getElementById('confirmBefore').checked;
    const clearButton = document.getElementById('clearButton');
    
    // Validate hex input
    const normalized = normalizeHex(hexInput);
    if (!normalized) {
        showStatus('Please enter a valid hex color code', 'error');
        return;
    }
    
    // Check if on Excel page and API is ready
    const pageCheck = await checkExcelPage();
    if (!pageCheck.isExcel) {
        showStatus('Please open an Excel Online document first', 'error');
        return;
    }
    if (!pageCheck.apiReady) {
        showStatus(pageCheck.error || 'Excel is not ready yet. Please wait a moment and try again.', 'error');
        return;
    }
    
    // Confirm if needed
    if (confirmBefore) {
        const confirmed = confirm(`Clear all cells with background color ${normalized} and reset to white?`);
        if (!confirmed) {
            showStatus('Operation cancelled', 'info');
            return;
        }
    }
    
    // Disable button and show loading
    clearButton.disabled = true;
    showStatus('🔄 Processing...', 'info');
    document.getElementById('results').innerHTML = '';
    
    try {
        // Get active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Execute content script
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: clearCellsByColor,
            args: [normalized, allSheets]
        });
        
        if (results && results[0] && results[0].result) {
            const data = results[0].result;
            
            if (data.error) {
                showStatus(data.error, 'error');
            } else {
                showStatus('✓ Successfully completed!', 'success');
                showResults(data);
            }
        } else {
            showStatus('No response from Excel. Please try again.', 'error');
        }
        
    } catch (error) {
        console.error('Error:', error);
        showStatus(`Error: ${error.message}`, 'error');
    } finally {
        clearButton.disabled = false;
    }
}

// This function will be injected into the Excel page
function clearCellsByColor(targetHex, processAllSheets) {
    try {
        // This is a placeholder - Excel Online uses Office.js APIs
        // We need to use the Excel JavaScript API
        
        return new Promise((resolve) => {
            if (typeof Excel === 'undefined') {
                resolve({ error: 'Excel API not available. Make sure you are on Excel Online.' });
                return;
            }
            
            Excel.run(async (context) => {
                try {
                    const workbook = context.workbook;
                    const sheets = processAllSheets ? workbook.worksheets : [context.workbook.worksheets.getActiveWorksheet()];
                    
                    if (processAllSheets) {
                        sheets.load('items/name');
                    } else {
                        sheets[0].load('name');
                    }
                    
                    await context.sync();
                    
                    let totalCleared = 0;
                    const sheetDetails = [];
                    const sheetsToProcess = processAllSheets ? sheets.items : [sheets[0]];
                    
                    for (const sheet of sheetsToProcess) {
                        const usedRange = sheet.getUsedRange();
                        usedRange.load(['address', 'values', 'format/fill/color', 'rowCount', 'columnCount']);
                        await context.sync();
                        
                        let clearedInSheet = 0;
                        
                        // Iterate through cells
                        for (let row = 0; row < usedRange.rowCount; row++) {
                            for (let col = 0; col < usedRange.columnCount; col++) {
                                const cell = usedRange.getCell(row, col);
                                cell.load('format/fill/color');
                                await context.sync();
                                
                                const cellColor = cell.format.fill.color;
                                
                                // Compare colors (normalize both)
                                if (cellColor && cellColor.toUpperCase() === targetHex.toUpperCase()) {
                                    cell.format.fill.color = '#FFFFFF';
                                    clearedInSheet++;
                                }
                            }
                        }
                        
                        await context.sync();
                        
                        sheetDetails.push({
                            name: sheet.name,
                            cleared: clearedInSheet
                        });
                        
                        totalCleared += clearedInSheet;
                    }
                    
                    resolve({
                        cellsCleared: totalCleared,
                        sheetsProcessed: sheetsToProcess.length,
                        sheetDetails: sheetDetails
                    });
                    
                } catch (error) {
                    resolve({ error: `Excel API Error: ${error.message}` });
                }
            });
        });
        
    } catch (error) {
        return { error: `Script Error: ${error.message}` };
    }
}

// Save hex code to storage
function saveHexCode(hex) {
    chrome.storage.local.set({ lastHexCode: hex });
}

// Load hex code from storage
async function loadHexCode() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['lastHexCode'], (result) => {
            resolve(result.lastHexCode || '');
        });
    });
}

// Save options to storage
function saveOptions() {
    const allSheets = document.getElementById('allSheets').checked;
    const confirmBefore = document.getElementById('confirmBefore').checked;
    
    chrome.storage.local.set({
        allSheets: allSheets,
        confirmBefore: confirmBefore
    });
}

// Load options from storage
async function loadOptions() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['allSheets', 'confirmBefore'], (result) => {
            resolve({
                allSheets: result.allSheets !== undefined ? result.allSheets : true,
                confirmBefore: result.confirmBefore !== undefined ? result.confirmBefore : false
            });
        });
    });
}

// Event listeners
document.addEventListener('DOMContentLoaded', async () => {
    const hexInput = document.getElementById('hexInput');
    const clearButton = document.getElementById('clearButton');
    const allSheetsCheckbox = document.getElementById('allSheets');
    const confirmBeforeCheckbox = document.getElementById('confirmBefore');
    
    // Load saved hex code
    const savedHex = await loadHexCode();
    if (savedHex) {
        hexInput.value = savedHex;
        updateColorPreview();
    }
    
    // Load saved options
    const savedOptions = await loadOptions();
    allSheetsCheckbox.checked = savedOptions.allSheets;
    confirmBeforeCheckbox.checked = savedOptions.confirmBefore;
    
    // Check if on Excel page and API is ready
    const pageCheck = await checkExcelPage();
    if (!pageCheck.isExcel) {
        showStatus('⚠️ Please open an Excel Online document', 'error');
    } else if (!pageCheck.apiReady) {
        if (pageCheck.error) {
            showStatus(`⚠️ ${pageCheck.error}`, 'error');
        } else {
            showStatus('⚠️ Excel is loading... Please wait and try again', 'error');
        }
    } else {
        showStatus('✓ Excel Online detected', 'success');
    }
    
    // Update preview and save on input
    hexInput.addEventListener('input', () => {
        updateColorPreview();
        saveHexCode(hexInput.value);
    });
    
    // Save options when changed
    allSheetsCheckbox.addEventListener('change', saveOptions);
    confirmBeforeCheckbox.addEventListener('change', saveOptions);
    
    // Handle enter key
    hexInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            clearCells();
        }
    });
    
    // Clear button click
    clearButton.addEventListener('click', clearCells);
});

