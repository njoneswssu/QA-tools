// Content script for Excel Color Clearer
// This script runs in the context of Excel Online pages

console.log('Excel Color Clearer extension loaded');

// Wait for Excel API to be available
async function waitForExcelAPI(maxAttempts = 40, delayMs = 500) {
    console.log('Waiting for Excel API to load...');
    
    for (let i = 0; i < maxAttempts; i++) {
        // Check if Excel and Office objects exist
        if (typeof Excel !== 'undefined' && typeof Office !== 'undefined') {
            console.log(`Excel and Office objects found (attempt ${i + 1})`);
            
            try {
                // Try to actually use the API to confirm it's ready
                await Excel.run(async (context) => {
                    const worksheets = context.workbook.worksheets;
                    await context.sync();
                    return true;
                });
                console.log('✓ Excel API is ready!');
                return { available: true };
            } catch (error) {
                console.log(`Excel API exists but not ready yet, attempt ${i + 1}:`, error.message);
            }
        } else {
            if (i % 5 === 0) {
                console.log(`Waiting for Excel/Office objects... (attempt ${i + 1}/${maxAttempts})`);
            }
        }
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    
    console.error('Excel API not ready after 20 seconds');
    return { 
        available: false, 
        error: 'Excel API not ready after 20 seconds. Try:\n1. Refresh the page (Ctrl+R)\n2. Wait 15 seconds\n3. Click extension again' 
    };
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'checkExcelAPI') {
        // Check if Excel API is available with retry
        // Give it up to 20 seconds for excel.cloud.microsoft domain
        waitForExcelAPI(40, 500).then(result => {
            sendResponse(result);
        });
        return true; // Keep channel open for async response
    }
    
    if (request.action === 'clearCells') {
        // Execute the clear operation
        clearCellsByColor(request.hexColor, request.allSheets)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ error: error.message }));
        return true; // Keep channel open for async response
    }
});

// Function to clear cells by color
async function clearCellsByColor(targetHex, processAllSheets) {
    // Ensure we have Excel API
    if (typeof Excel === 'undefined') {
        return { error: 'Excel JavaScript API not found. Please ensure you are on Excel Online.' };
    }
    
    return new Promise((resolve) => {
        Excel.run(async (context) => {
            try {
                const workbook = context.workbook;
                let sheetsToProcess;
                
                if (processAllSheets) {
                    sheetsToProcess = workbook.worksheets;
                    sheetsToProcess.load('items/name');
                    await context.sync();
                    sheetsToProcess = sheetsToProcess.items;
                } else {
                    const activeSheet = workbook.worksheets.getActiveWorksheet();
                    activeSheet.load('name');
                    await context.sync();
                    sheetsToProcess = [activeSheet];
                }
                
                let totalCleared = 0;
                const sheetDetails = [];
                
                // Normalize target hex
                const normalizedTarget = targetHex.toUpperCase().replace('#', '');
                
                for (const sheet of sheetsToProcess) {
                    let clearedInSheet = 0;
                    
                    try {
                        const usedRange = sheet.getUsedRange();
                        usedRange.load(['rowCount', 'columnCount', 'address']);
                        await context.sync();
                        
                        // Process in batches for better performance
                        const batchSize = 100;
                        const totalCells = usedRange.rowCount * usedRange.columnCount;
                        
                        for (let row = 0; row < usedRange.rowCount; row++) {
                            for (let col = 0; col < usedRange.columnCount; col++) {
                                const cell = usedRange.getCell(row, col);
                                const cellFormat = cell.format.fill;
                                cellFormat.load('color');
                            }
                            
                            // Sync every few rows
                            if (row % 10 === 0) {
                                await context.sync();
                            }
                        }
                        
                        await context.sync();
                        
                        // Now check colors and clear
                        for (let row = 0; row < usedRange.rowCount; row++) {
                            for (let col = 0; col < usedRange.columnCount; col++) {
                                const cell = usedRange.getCell(row, col);
                                const cellFormat = cell.format.fill;
                                cellFormat.load('color');
                                await context.sync();
                                
                                if (cellFormat.color) {
                                    const cellColor = cellFormat.color.toUpperCase().replace('#', '');
                                    
                                    if (cellColor === normalizedTarget) {
                                        cellFormat.color = '#FFFFFF';
                                        clearedInSheet++;
                                    }
                                }
                            }
                        }
                        
                        await context.sync();
                        
                    } catch (sheetError) {
                        console.warn(`Error processing sheet ${sheet.name}:`, sheetError);
                    }
                    
                    sheetDetails.push({
                        name: sheet.name,
                        cleared: clearedInSheet
                    });
                    
                    totalCleared += clearedInSheet;
                }
                
                resolve({
                    success: true,
                    cellsCleared: totalCleared,
                    sheetsProcessed: sheetsToProcess.length,
                    sheetDetails: sheetDetails
                });
                
            } catch (error) {
                resolve({ error: `Excel API Error: ${error.message}` });
            }
        }).catch(error => {
            resolve({ error: `Excel.run Error: ${error.message}` });
        });
    });
}

// Inject helper styles
const style = document.createElement('style');
style.textContent = `
    .excel-color-clearer-highlight {
        outline: 2px solid #667eea !important;
        outline-offset: -2px;
    }
`;
document.head.appendChild(style);

