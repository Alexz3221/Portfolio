// UI.js - Handles user interface interactions

// Initialize UI elements
function initUI() {
    setupNavButtons();
    setupInfoPanels();
    setupMobileControls();
}

// Setup navigation buttons
function setupNavButtons() {
    const navButtons = document.querySelectorAll('.nav-button');
    
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const target = button.getAttribute('data-target');
            showPanel(target);
        });
    });
}

// Setup info panels
function setupInfoPanels() {
    const panels = document.querySelectorAll('.info-panel');
    const closeButtons = document.querySelectorAll('.close-button');
    
    // Add close functionality to all panels
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const panel = button.closest('.info-panel');
            panel.classList.remove('active');
        });
    });
    
    // Close panels when clicking outside
    document.addEventListener('click', (event) => {
        if (event.target.closest('.info-panel') || 
            event.target.closest('.nav-button') ||
            event.target.closest('#joystick-area') ||
            event.target.closest('#action-buttons')) {
            return;
        }
        
        panels.forEach(panel => {
            panel.classList.remove('active');
        });
    });
}

// Setup mobile controls
function setupMobileControls() {
    const mobileControls = document.getElementById('mobile-controls');
    
    // Show mobile controls on small screens
    if (window.innerWidth < 768) {
        mobileControls.style.display = 'flex';
    }
    
    // Update on resize
    window.addEventListener('resize', () => {
        if (window.innerWidth < 768) {
            mobileControls.style.display = 'flex';
        } else {
            mobileControls.style.display = 'none';
        }
    });
}

// Show specific panel
function showPanel(panelId) {
    // Hide all panels first
    const panels = document.querySelectorAll('.info-panel');
    panels.forEach(panel => {
        panel.classList.remove('active');
    });
    
    // Show requested panel
    const panel = document.getElementById(`${panelId}-panel`);
    if (panel) {
        panel.classList.add('active');
    }
}

// Update UI elements
function updateUI() {
    // Update any dynamic UI elements here
    // This would be called from the main animation loop
}

// Handle window resize for UI
function onUIResize() {
    // Update UI elements on resize
    const mobileControls = document.getElementById('mobile-controls');
    
    if (window.innerWidth < 768) {
        mobileControls.style.display = 'flex';
    } else {
        mobileControls.style.display = 'none';
    }
}

// Add window resize listener
window.addEventListener('resize', onUIResize);
