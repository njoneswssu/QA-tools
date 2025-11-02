// Profile Manager - Handles tester name persistence and session info display

// Get tester name from localStorage
function getTesterName() {
    return localStorage.getItem('tester_name') || null;
}

// Set tester name to localStorage
function setTesterName(name) {
    localStorage.setItem('tester_name', name);
    console.log('💾 [Profile] Saved tester name:', name);
    updateProfileDisplay();
    updateSessionInfo();
}

// Update profile button display
function updateProfileDisplay() {
    const testerName = getTesterName();
    const profileNameDisplay = document.getElementById('profile-name-display');
    
    if (profileNameDisplay) {
        profileNameDisplay.textContent = testerName || 'Set Name';
    }
}

// Update session info display
function updateSessionInfo() {
    const testerName = getTesterName();
    const sessionTesterName = document.getElementById('session-tester-name');
    const sessionDatetime = document.getElementById('session-datetime');
    
    if (sessionTesterName) {
        sessionTesterName.textContent = testerName || 'Not Set';
    }
    
    if (sessionDatetime) {
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        const timeStr = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        sessionDatetime.textContent = `${dateStr} at ${timeStr}`;
    }
}

// Generate session name for database
function generateSessionName() {
    const testerName = getTesterName();
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    
    return testerName ? `${testerName} - ${dateStr} ${timeStr}` : `Test Session - ${dateStr} ${timeStr}`;
}

// Extract tester name from session name
function extractTesterNameFromSession(sessionName) {
    if (!sessionName) return 'Tester';
    
    // Match pattern: "Name - Date Time" or just "Name"
    const match = sessionName.match(/^([^-]+?)(?:\s*-\s*)/);
    if (match) {
        return match[1].trim();
    }
    
    return sessionName.trim();
}

// Open profile modal
function openProfileModal() {
    const modal = document.getElementById('profile-name-modal');
    const input = document.getElementById('profile-name-input');
    
    if (modal && input) {
        const currentName = getTesterName();
        input.value = currentName || '';
        modal.style.display = 'flex';
        
        // Focus input after a short delay to ensure modal is visible
        setTimeout(() => input.focus(), 100);
    }
}

// Close profile modal
function closeProfileModal() {
    const modal = document.getElementById('profile-name-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Save profile name
function saveProfileName() {
    const input = document.getElementById('profile-name-input');
    const name = input.value.trim();
    
    if (!name) {
        alert('Please enter a name');
        return;
    }
    
    setTesterName(name);
    closeProfileModal();
    
    console.log('✅ [Profile] Tester name saved:', name);
}

// Check if tester name is set, prompt if not
function checkTesterNameSet() {
    const testerName = getTesterName();
    
    if (!testerName) {
        console.log('⚠️ [Profile] No tester name set, prompting user...');
        openProfileModal();
        return false;
    }
    
    return true;
}

// Initialize profile manager on page load
function initProfileManager() {
    console.log('🚀 [Profile] Initializing profile manager...');
    
    // Update displays
    updateProfileDisplay();
    updateSessionInfo();
    
    // Set up event listeners
    const profileMenuBtn = document.getElementById('profile-menu-btn');
    const saveProfileNameBtn = document.getElementById('save-profile-name-btn');
    const closeProfileModal = document.getElementById('close-profile-modal');
    const profileNameInput = document.getElementById('profile-name-input');
    
    if (profileMenuBtn) {
        profileMenuBtn.addEventListener('click', openProfileModal);
    }
    
    if (saveProfileNameBtn) {
        saveProfileNameBtn.addEventListener('click', saveProfileName);
    }
    
    if (closeProfileModal) {
        closeProfileModal.addEventListener('click', () => {
            document.getElementById('profile-name-modal').style.display = 'none';
        });
    }
    
    if (profileNameInput) {
        profileNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveProfileName();
            }
        });
    }
    
    // Close modal when clicking outside
    const modal = document.getElementById('profile-name-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeProfileModal();
            }
        });
    }
    
    // Check if name is set
    const testerName = getTesterName();
    if (!testerName) {
        console.log('⚠️ [Profile] No tester name found');
    } else {
        console.log('✅ [Profile] Tester name loaded:', testerName);
    }
}

// Export functions for use in main script
window.profileManager = {
    getTesterName,
    setTesterName,
    generateSessionName,
    extractTesterNameFromSession,
    updateSessionInfo,
    checkTesterNameSet,
    initProfileManager
};

