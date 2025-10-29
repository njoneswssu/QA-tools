const { ipcRenderer } = require('electron');

// Global state
let currentValidation = null;
let testRunning = false;
let sessionStats = {
    totalMerchantsValidated: 0,
    totalTestsRun: 0,
    successfulTests: 0
};

// DOM Elements
const merchantInput = document.getElementById('merchantInput');
const validateBtn = document.getElementById('validateBtn');
const loadSampleBtn = document.getElementById('loadSampleBtn');
const clearBtn = document.getElementById('clearBtn');
const validationSection = document.getElementById('validationSection');
const runTestBtn = document.getElementById('runTestBtn');
const editBtn = document.getElementById('editBtn');
const testSection = document.getElementById('testSection');
const newTestBtn = document.getElementById('newTestBtn');
const stopTestBtn = document.getElementById('stopTestBtn');
const loadingOverlay = document.getElementById('loadingOverlay');

// Statistics elements
const totalMerchantsValidatedEl = document.getElementById('totalMerchantsValidated');
const totalTestsRunEl = document.getElementById('totalTestsRun');
const successRateEl = document.getElementById('successRate');

// Test output elements
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const testOutput = document.getElementById('testOutput');

// Sample merchants for testing
const sampleMerchants = [
    'Ulta', 'Best Buy', 'Macy\'s', 'Sephora', 'StubHub',
    'LL Bean', 'Gap', 'Total Wine', 'PetSmart', 'Dick\'s'
];

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

validateBtn.addEventListener('click', validateMerchants);
loadSampleBtn.addEventListener('click', loadSampleMerchants);
clearBtn.addEventListener('click', clearInput);
runTestBtn.addEventListener('click', runTest);
editBtn.addEventListener('click', editInput);
newTestBtn.addEventListener('click', newTest);
stopTestBtn.addEventListener('click', stopTest);

// Keyboard shortcuts
merchantInput.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
        validateMerchants();
    }
});

// IPC Event Listeners
ipcRenderer.on('test-output', (event, data) => {
    appendTestOutput(data);
});

ipcRenderer.on('test-error', (event, data) => {
    appendTestOutput(`ERROR: ${data}`, 'error');
});

// Initialize the application
function initializeApp() {
    console.log('CitiShop Desktop Extension initialized');
    updateSessionStats();
    
    // Focus on the input field
    merchantInput.focus();
    
    // Load any saved session data
    loadSessionData();
}

// Load sample merchants
function loadSampleMerchants() {
    merchantInput.value = sampleMerchants.join(', ');
    merchantInput.focus();
}

// Clear input
function clearInput() {
    merchantInput.value = '';
    validationSection.style.display = 'none';
    testSection.style.display = 'none';
    merchantInput.focus();
}

// Validate merchants against CitiList
async function validateMerchants() {
    const input = merchantInput.value.trim();
    
    if (!input) {
        showError('Please enter at least one merchant name.');
        return;
    }
    
    showLoading('Validating merchants...');
    
    try {
        const result = await ipcRenderer.invoke('validate-merchants', input);
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        currentValidation = result;
        displayValidationResults(result);
        
        // Update session stats
        sessionStats.totalMerchantsValidated += result.inputCount;
        updateSessionStats();
        
        hideLoading();
        
    } catch (error) {
        hideLoading();
        showError(`Validation failed: ${error.message}`);
    }
}

// Display validation results
function displayValidationResults(result) {
    const { foundMerchants, notFoundMerchants, inputCount, foundCount } = result;
    
    // Update found merchants
    const foundList = document.getElementById('foundList');
    const foundCountEl = document.getElementById('foundCount');
    foundList.innerHTML = '';
    foundCountEl.textContent = foundCount;
    
    foundMerchants.forEach(merchant => {
        const li = document.createElement('li');
        li.innerHTML = `
            <strong>${merchant.name}</strong>
            <small style="display: block; color: #666; margin-top: 3px;">
                ${merchant.url}
            </small>
        `;
        foundList.appendChild(li);
    });
    
    // Update not found merchants
    const notFoundList = document.getElementById('notFoundList');
    const notFoundCountEl = document.getElementById('notFoundCount');
    notFoundList.innerHTML = '';
    notFoundCountEl.textContent = notFoundMerchants.length;
    
    notFoundMerchants.forEach(merchant => {
        const li = document.createElement('li');
        li.textContent = merchant;
        notFoundList.appendChild(li);
    });
    
    // Enable/disable run test button
    runTestBtn.disabled = foundCount === 0;
    
    // Show validation section
    validationSection.style.display = 'block';
    testSection.style.display = 'none';
    
    // Scroll to results
    validationSection.scrollIntoView({ behavior: 'smooth' });
}

// Run test with validated merchants
async function runTest() {
    if (!currentValidation || currentValidation.foundMerchants.length === 0) {
        showError('No valid merchants to test.');
        return;
    }
    
    testRunning = true;
    updateTestStatus('🚀', 'Starting test execution...');
    
    // Show test section
    testSection.style.display = 'block';
    testSection.scrollIntoView({ behavior: 'smooth' });
    
    // Clear previous output
    testOutput.textContent = '';
    
    // Update progress
    updateProgress(0, currentValidation.foundMerchants.length);
    
    // Disable buttons
    runTestBtn.disabled = true;
    stopTestBtn.disabled = false;
    
    try {
        const result = await ipcRenderer.invoke('run-test', currentValidation.foundMerchants);
        
        if (result.success) {
            updateTestStatus('✅', 'Test completed successfully!');
            sessionStats.successfulTests++;
        } else {
            updateTestStatus('❌', `Test failed (Exit code: ${result.exitCode})`);
        }
        
        // Update session stats
        sessionStats.totalTestsRun++;
        updateSessionStats();
        
        // Update progress to complete
        updateProgress(currentValidation.foundMerchants.length, currentValidation.foundMerchants.length);
        
    } catch (error) {
        updateTestStatus('❌', `Test execution failed: ${error.message}`);
        appendTestOutput(`\nERROR: ${error.message}`, 'error');
    } finally {
        testRunning = false;
        stopTestBtn.disabled = true;
        newTestBtn.disabled = false;
    }
}

// Stop running test
function stopTest() {
    if (testRunning) {
        // Note: In a full implementation, you'd need to kill the test process
        updateTestStatus('⏹️', 'Test stopped by user');
        testRunning = false;
        stopTestBtn.disabled = true;
        newTestBtn.disabled = false;
    }
}

// Start new test
function newTest() {
    clearInput();
    currentValidation = null;
    testRunning = false;
}

// Edit input (go back to input mode)
function editInput() {
    validationSection.style.display = 'none';
    testSection.style.display = 'none';
    merchantInput.focus();
}

// Update test status
function updateTestStatus(indicator, text) {
    statusIndicator.textContent = indicator;
    statusText.textContent = text;
}

// Update progress bar
function updateProgress(current, total) {
    const percentage = total > 0 ? (current / total) * 100 : 0;
    progressFill.style.width = `${percentage}%`;
    progressText.textContent = `${current} / ${total} merchants tested`;
}

// Append test output
function appendTestOutput(text, type = 'normal') {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'error' ? '[ERROR]' : '[INFO]';
    const line = `[${timestamp}] ${prefix} ${text}\n`;
    
    testOutput.textContent += line;
    testOutput.scrollTop = testOutput.scrollHeight;
}

// Update session statistics
function updateSessionStats() {
    totalMerchantsValidatedEl.textContent = sessionStats.totalMerchantsValidated;
    totalTestsRunEl.textContent = sessionStats.totalTestsRun;
    
    const successRate = sessionStats.totalTestsRun > 0 
        ? Math.round((sessionStats.successfulTests / sessionStats.totalTestsRun) * 100)
        : 0;
    successRateEl.textContent = `${successRate}%`;
}

// Show loading overlay
function showLoading(message = 'Loading...') {
    document.getElementById('loadingText').textContent = message;
    loadingOverlay.style.display = 'flex';
}

// Hide loading overlay
function hideLoading() {
    loadingOverlay.style.display = 'none';
}

// Show error message
function showError(message) {
    // Simple alert for now - could be enhanced with a custom modal
    alert(`Error: ${message}`);
}

// Save session data to localStorage
function saveSessionData() {
    localStorage.setItem('citishop-session-stats', JSON.stringify(sessionStats));
}

// Load session data from localStorage
function loadSessionData() {
    const saved = localStorage.getItem('citishop-session-stats');
    if (saved) {
        try {
            sessionStats = { ...sessionStats, ...JSON.parse(saved) };
            updateSessionStats();
        } catch (error) {
            console.warn('Failed to load session data:', error);
        }
    }
}

// Save session data on page unload
window.addEventListener('beforeunload', saveSessionData);

// About and Help links
document.getElementById('aboutLink').addEventListener('click', (e) => {
    e.preventDefault();
    alert(`CitiShop Desktop Extension v1.0.0
    
Created for dynamic merchant testing with Playwright automation.

Features:
• Dynamic merchant input and validation
• Real-time test execution
• Session statistics tracking
• Beautiful, modern interface

Built with Electron and love! 💙`);
});

document.getElementById('helpLink').addEventListener('click', (e) => {
    e.preventDefault();
    alert(`Help - How to Use CitiShop Desktop Extension

1. Enter merchant names in the text box (comma-separated)
2. Click "Validate Merchants" to check against CitiList
3. Review found/not found merchants
4. Click "Run Test" to start Playwright automation
5. Monitor progress and results in real-time

Tips:
• Use Ctrl+Enter to quickly validate
• Click "Load Sample" for example merchants
• Check session statistics to track your progress

Need more help? Check the documentation or contact support.`);
});

console.log('CitiShop Desktop Extension renderer loaded successfully!');
