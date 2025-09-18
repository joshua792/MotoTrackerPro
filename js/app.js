// js/app.js - Main application logic and state management

// Global variables
let currentSession = 'practice1';
let sessionData = {};
let motorcycles = [];
let currentMotorcycle = null;
let currentEvent = null;
let events = [];
let tires = [];
let settings = {
    pressureUnit: 'psi',
    temperatureUnit: 'fahrenheit',
    userName: '',
    userEmail: '',
    userTeam: ''
};
let currentWeatherData = null;
let uploadedFiles = [];

// Session names for display
const sessionNames = {
    'practice1': 'Practice 1',
    'qualifying1': 'Qualifying 1',
    'qualifying2': 'Qualifying 2',
    'race1': 'Race 1',
    'warmup': 'Warmup',
    'race2': 'Race 2'
};

// State persistence functions
function saveAppState() {
    const appState = {
        currentEvent: currentEvent,
        currentMotorcycleId: currentMotorcycle ? currentMotorcycle.id : null,
        currentSession: currentSession,
        timestamp: new Date().toISOString()
    };
    localStorage.setItem('raceTrackerAppState', JSON.stringify(appState));
}

function loadAppState() {
    try {
        const savedState = localStorage.getItem('raceTrackerAppState');
        if (!savedState) return false;

        const appState = JSON.parse(savedState);
        
        // Restore event selection
        if (appState.currentEvent && events.find(e => e.id === appState.currentEvent)) {
            document.getElementById('event-select').value = appState.currentEvent;
            currentEvent = appState.currentEvent;
        }
        
        // Restore motorcycle selection
        if (appState.currentMotorcycleId && motorcycles.find(m => m.id === appState.currentMotorcycleId)) {
            currentMotorcycle = motorcycles.find(m => m.id === appState.currentMotorcycleId);
            updateMotorcycleDisplay();
        }
        
        // Restore session tab
        if (appState.currentSession) {
            currentSession = appState.currentSession;
            // Update tab appearance
            document.querySelectorAll('.session-tab').forEach(tab => {
                tab.classList.remove('active');
                if (tab.getAttribute('onclick').includes(currentSession)) {
                    tab.classList.add('active');
                }
            });
        }
        
        return true;
    } catch (error) {
        console.error('Error loading app state:', error);
        return false;
    }
}

// Settings management
function loadSettings() {
    const savedSettings = JSON.parse(localStorage.getItem('raceTrackerSettings') || '{}');
    settings = { ...settings, ...savedSettings };
    
    if (document.getElementById('pressure-unit')) {
        document.getElementById('pressure-unit').value = settings.pressureUnit;
        document.getElementById('temperature-unit').value = settings.temperatureUnit;
        document.getElementById('user-name').value = settings.userName;
        document.getElementById('user-email').value = settings.userEmail;
        document.getElementById('user-team').value = settings.userTeam;

        // Load user race series
        const seriesSelect = document.getElementById('user-race-series');
        const userSeries = settings.userRaceSeries || [];
        Array.from(seriesSelect.options).forEach(option => {
            option.selected = userSeries.includes(option.value);
        });

        // Update event series dropdown
        updateEventSeriesDropdown();
    }
}

function saveUnitSettings() {
    const oldTempUnit = settings.temperatureUnit;
    
    settings.pressureUnit = document.getElementById('pressure-unit').value;
    settings.temperatureUnit = document.getElementById('temperature-unit').value;
    
    localStorage.setItem('raceTrackerSettings', JSON.stringify(settings));
    
    // Update UI labels based on unit selection
    updateUnitLabels();
    
    // If temperature unit changed and we have weather data, refresh the display
    if (oldTempUnit !== settings.temperatureUnit && currentWeatherData) {
        displayWeatherData();
    }
    
    alert('Unit preferences saved!');
}

function saveAccountSettings() {
    settings.userName = document.getElementById('user-name').value;
    settings.userEmail = document.getElementById('user-email').value;
    settings.userTeam = document.getElementById('user-team').value;

    // Get selected race series
    const seriesSelect = document.getElementById('user-race-series');
    const selectedSeries = Array.from(seriesSelect.selectedOptions).map(option => option.value);
    settings.userRaceSeries = selectedSeries;

    localStorage.setItem('raceTrackerSettings', JSON.stringify(settings));

    // Update event series dropdown
    updateEventSeriesDropdown();

    alert('Account information saved!');
}

// Update event series dropdown based on user settings
function updateEventSeriesDropdown() {
    const eventSeriesSelect = document.getElementById('event-series');
    const userSeries = settings.userRaceSeries || [];

    // Clear existing options except the first one
    eventSeriesSelect.innerHTML = '<option value="">Select Series...</option>';

    // Add user's selected series
    userSeries.forEach(series => {
        const option = document.createElement('option');
        option.value = series;
        option.textContent = series;
        eventSeriesSelect.appendChild(option);
    });

    // If no series selected, show a message
    if (userSeries.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Configure race series in Account Settings';
        option.disabled = true;
        eventSeriesSelect.appendChild(option);
    }
}

function updateUnitLabels() {
    const pressureLabel = settings.pressureUnit === 'psi' ? 'PSI' : 'Bar';
    document.querySelectorAll('label').forEach(label => {
        if (label.textContent.includes('PSI:')) {
            label.textContent = label.textContent.replace('PSI:', pressureLabel + ':');
        }
    });
}

// Check if main content should be shown and load track map
async function checkShowMainContent() {
    currentEvent = document.getElementById('event-select').value;
    
    // Save state whenever event changes
    saveAppState();
    
    // Load track map when event is selected
    loadTrackMap(currentEvent);
    
    if (currentMotorcycle && currentEvent) {
        document.getElementById('main-content').style.display = 'block';
        await loadSessionData();
        // Load previous track data for Practice 1 if available
        if (currentSession === 'practice1') {
            await loadPreviousTrackData();
        }
    } else {
        document.getElementById('main-content').style.display = 'none';
    }
}

// Switch between sessions
async function switchSession(session) {
    saveCurrentSession();
    currentSession = session;
    
    // Save state whenever session changes
    saveAppState();
    
    // Update tab appearance
    document.querySelectorAll('.session-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    loadCurrentSessionFromData();
    updateDisplay();
}

// Update display
function updateDisplay() {
    // This would update any dynamic content based on current state
}

// Export data
async function exportData() {
    try {
        const [motorcyclesResponse, sessionsResponse, eventsResponse, tiresResponse] = await Promise.all([
            apiCall('get-motorcycles'),
            apiCall('get-sessions'),
            apiCall('get-events'),
            apiCall('get-tires')
        ]);

        const allData = {
            motorcycles: motorcyclesResponse.motorcycles || [],
            sessions: sessionsResponse.sessions || [],
            events: eventsResponse.events || [],
            tires: tiresResponse.tires || [],
            exportedAt: new Date().toISOString()
        };

        const dataStr = JSON.stringify(allData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `race_data_${currentMotorcycle ? currentMotorcycle.make + '_' + currentMotorcycle.model : 'all'}_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
    } catch (error) {
        console.error('Error exporting data:', error);
        alert('Error exporting data. Please try again.');
    }
}

// Initialize app when page loads
async function initApp() {
    loadSettings();
    await Promise.all([
        loadEvents(),
        loadTires(),
        loadMotorcycles()
    ]);
    
    // Restore app state after loading data
    const stateRestored = loadAppState();
    
    await loadSessionData();
    updateDisplay();
    updateUnitLabels();
    
    // If state was restored, check if main content should be shown
    if (stateRestored) {
        await checkShowMainContent();
    }
    
    // Event change handler
    document.getElementById('event-select').addEventListener('change', checkShowMainContent);
    
    // Initial track map load
    loadTrackMap(currentEvent);
}

// Initialize app when page loads
window.addEventListener('DOMContentLoaded', initApp);

// Close modals when clicking outside of them
window.addEventListener('click', function(event) {
    const motorcycleModal = document.getElementById('motorcycle-modal');
    const tireModal = document.getElementById('tire-modal');
    const settingsModal = document.getElementById('settings-modal');
    const addEventModal = document.getElementById('add-event-modal');
    
    if (event.target === motorcycleModal) {
        closeAddMotorcycleModal();
    }
    if (event.target === tireModal) {
        closeTireModal();
    }
    if (event.target === settingsModal) {
        closeSettingsModal();
    }
    if (event.target === addEventModal) {
        closeAddEventModal();
    }
});