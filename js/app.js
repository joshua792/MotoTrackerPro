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

        // Load account info from current user if available
        if (currentUser) {
            document.getElementById('user-name').value = currentUser.name || '';
            document.getElementById('user-email').value = currentUser.email || '';
            document.getElementById('user-team').value = currentUser.team || '';

            // Show admin tab if user is admin
            if (currentUser.is_admin) {
                document.getElementById('admin-tab').style.display = 'block';
            }

            // Show admin switched notice if applicable
            if (authToken) {
                try {
                    const tokenPayload = JSON.parse(atob(authToken.split('.')[1]));
                    if (tokenPayload.adminSwitched) {
                        document.getElementById('admin-switched-notice').style.display = 'block';
                    }
                } catch (e) {
                    // Token parsing failed, ignore
                }
            }
        } else {
            // Fallback to saved settings for offline state
            document.getElementById('user-name').value = settings.userName;
            document.getElementById('user-email').value = settings.userEmail;
            document.getElementById('user-team').value = settings.userTeam;
        }

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

async function saveAccountSettings() {
    const userName = document.getElementById('user-name').value;
    const userTeam = document.getElementById('user-team').value;

    // Get selected race series
    const seriesSelect = document.getElementById('user-race-series');
    const selectedSeries = Array.from(seriesSelect.selectedOptions).map(option => option.value);

    try {
        const response = await apiCall('auth/update-profile', {
            method: 'POST',
            body: JSON.stringify({
                name: userName,
                team: userTeam
            })
        });

        if (response.success) {
            // Update local user object
            currentUser.name = userName;
            currentUser.team = userTeam;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));

            // Update local settings for race series
            settings.userRaceSeries = selectedSeries;
            localStorage.setItem('raceTrackerSettings', JSON.stringify(settings));

            // Update event series dropdown and main event dropdown
            updateEventSeriesDropdown();
            updateEventDropdown(); // Refresh home page event dropdown with new filtering

            alert('Account information saved!');
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        alert('Error saving account information: ' + error.message);
    }
}

async function changePassword() {
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-new-password').value;

    if (!currentPassword || !newPassword || !confirmPassword) {
        alert('Please fill in all password fields');
        return;
    }

    if (newPassword !== confirmPassword) {
        alert('New passwords do not match');
        return;
    }

    if (newPassword.length < 8) {
        alert('New password must be at least 8 characters long');
        return;
    }

    try {
        const response = await apiCall('auth/change-password', {
            method: 'POST',
            body: JSON.stringify({
                currentPassword,
                newPassword
            })
        });

        if (response.success) {
            // Clear password fields
            document.getElementById('current-password').value = '';
            document.getElementById('new-password').value = '';
            document.getElementById('confirm-new-password').value = '';

            alert('Password changed successfully!');
        }
    } catch (error) {
        console.error('Error changing password:', error);
        alert('Error changing password: ' + error.message);
    }
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
    loadTrackMap(currentEvent?.id);
    
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

        // Remove sensitive fields from export data
        const cleanData = (items, sensitiveFields = ['user_id']) => {
            return items.map(item => {
                const cleaned = { ...item };
                sensitiveFields.forEach(field => delete cleaned[field]);
                return cleaned;
            });
        };

        const allData = {
            motorcycles: cleanData(motorcyclesResponse.motorcycles || []),
            sessions: cleanData(sessionsResponse.sessions || []),
            events: cleanData(eventsResponse.events || []),
            tires: cleanData(tiresResponse.tires || []),
            exportedAt: new Date().toISOString(),
            note: "This export contains your personal racing data only"
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

    // Authentication check is handled by auth.js initAuth()
    // Data loading will happen after successful authentication

    // Set up event handlers regardless of auth state
    document.getElementById('event-select').addEventListener('change', checkShowMainContent);
}

// Load app data after authentication (called from auth.js)
async function loadAppData() {
    try {
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

        // Initial track map load
        loadTrackMap(currentEvent?.id);
    } catch (error) {
        console.error('Error loading app data:', error);
        // If data loading fails due to auth issues, auth.js will handle logout
    }
}

// Admin functionality
async function loadUsersList() {
    try {
        const response = await apiCall('auth/admin-list-users');

        if (response.success) {
            const usersList = document.getElementById('users-list');

            if (response.users.length === 0) {
                usersList.innerHTML = '<p>No users found.</p>';
                return;
            }

            let html = '<div style="margin-bottom: 15px;"><strong>Total Users: ' + response.users.length + '</strong></div>';

            response.users.forEach(user => {
                html += `
                    <div style="border: 1px solid #ddd; padding: 10px; margin-bottom: 10px; border-radius: 4px; background: ${user.is_admin ? '#fff3cd' : '#ffffff'};">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${user.name}</strong> ${user.is_admin ? '<span style="color: #d63384;">[ADMIN]</span>' : ''}
                                <br><span style="color: #666; font-size: 12px;">${user.email}</span>
                                ${user.team ? `<br><span style="color: #666; font-size: 12px;">Team: ${user.team}</span>` : ''}
                                <br><span style="color: #666; font-size: 12px;">Created: ${new Date(user.created_at).toLocaleDateString()}</span>
                                ${user.last_login ? `<br><span style="color: #666; font-size: 12px;">Last Login: ${new Date(user.last_login).toLocaleDateString()}</span>` : ''}
                            </div>
                            <div>
                                <button class="btn btn-small btn-secondary" onclick="switchToUser('${user.id}', '${user.name}')">
                                    Switch to User
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });

            usersList.innerHTML = html;
        }
    } catch (error) {
        console.error('Error loading users list:', error);
        document.getElementById('users-list').innerHTML = '<p style="color: #d63384;">Error loading users: ' + error.message + '</p>';
    }
}

async function switchToUser(userId, userName) {
    if (!confirm(`Switch to user: ${userName}?`)) {
        return;
    }

    try {
        const response = await apiCall('auth/admin-switch-user', {
            method: 'POST',
            body: JSON.stringify({ targetUserId: userId })
        });

        if (response.success) {
            // Update auth token and user
            authToken = response.token;
            currentUser = response.user;

            // Update localStorage
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));

            // Refresh the page to load the new user's data
            alert(`Switched to user: ${response.user.name}`);
            window.location.reload();
        }
    } catch (error) {
        console.error('Error switching user:', error);
        alert('Error switching user: ' + error.message);
    }
}

function switchBackToAdmin() {
    try {
        const tokenPayload = JSON.parse(atob(authToken.split('.')[1]));
        if (tokenPayload.originalAdminId) {
            switchToUser(tokenPayload.originalAdminId, 'Admin Account');
        }
    } catch (error) {
        console.error('Error switching back to admin:', error);
        alert('Error switching back to admin account');
    }
}

// Admin section management
function showAdminSection(section) {
    // Hide all admin sections
    document.getElementById('admin-users-section').style.display = 'none';
    document.getElementById('admin-tracks-section').style.display = 'none';

    // Remove active class from all admin tab buttons
    document.getElementById('admin-users-tab').classList.remove('btn-primary');
    document.getElementById('admin-users-tab').classList.add('btn-secondary');
    document.getElementById('admin-tracks-tab').classList.remove('btn-primary');
    document.getElementById('admin-tracks-tab').classList.add('btn-secondary');

    // Show selected section
    document.getElementById('admin-' + section + '-section').style.display = 'block';
    document.getElementById('admin-' + section + '-tab').classList.remove('btn-secondary');
    document.getElementById('admin-' + section + '-tab').classList.add('btn-primary');

    if (section === 'tracks') {
        loadTracksList();
    }
}

// Track management functions
let tracks = [];
let currentEditingTrackId = null;
let trackMapData = null;

async function loadTracksList() {
    try {
        const response = await apiCall('get-tracks');

        if (response.success) {
            tracks = response.tracks;
            const tracksList = document.getElementById('tracks-list');

            if (tracks.length === 0) {
                tracksList.innerHTML = '<p>No tracks found. Click "Add Track" to create the first track.</p>';
                return;
            }

            let html = '<div style="margin-bottom: 15px;"><strong>Total Tracks: ' + tracks.length + '</strong></div>';

            tracks.forEach(track => {
                html += `
                    <div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 10px; border-radius: 4px; background: #ffffff;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <div style="flex: 1;">
                                <div style="font-weight: bold; font-size: 16px; color: #2c5aa0; margin-bottom: 5px;">
                                    ${track.name}
                                </div>
                                <div style="color: #666; font-size: 14px; margin-bottom: 3px;">
                                    📍 ${track.location}${track.country ? ', ' + track.country : ''}
                                </div>
                                ${track.description ? `<div style="color: #666; font-size: 12px; margin-bottom: 5px;">${track.description}</div>` : ''}
                                <div style="color: #666; font-size: 12px;">
                                    ${track.length_miles ? `Length: ${track.length_miles} mi` : ''}
                                    ${track.length_km ? ` (${track.length_km} km)` : ''}
                                    ${track.turns ? ` • ${track.turns} turns` : ''}
                                    ${track.direction ? ` • ${track.direction}` : ''}
                                </div>
                                ${track.track_map_filename ? '<div style="color: #28a745; font-size: 12px; margin-top: 5px;">📄 Track map available</div>' : ''}
                            </div>
                            <div style="display: flex; gap: 10px; margin-left: 15px;">
                                <button onclick="editTrack('${track.id}')" class="btn btn-secondary btn-small">Edit</button>
                                <button onclick="deleteTrack('${track.id}')" class="btn btn-small" style="background: #dc3545; color: white;">Delete</button>
                            </div>
                        </div>
                    </div>
                `;
            });

            tracksList.innerHTML = html;
        }
    } catch (error) {
        console.error('Error loading tracks list:', error);
        document.getElementById('tracks-list').innerHTML = '<p style="color: #d63384;">Error loading tracks: ' + error.message + '</p>';
    }
}

function showAddTrackModal() {
    currentEditingTrackId = null;
    trackMapData = null;
    document.getElementById('track-modal-title').textContent = 'Add New Track';
    document.getElementById('save-track-btn').textContent = 'Add Track';
    clearTrackForm();
    document.getElementById('track-modal').style.display = 'block';
}

function closeTrackModal() {
    document.getElementById('track-modal').style.display = 'none';
    currentEditingTrackId = null;
    trackMapData = null;
    clearTrackForm();
}

function clearTrackForm() {
    document.getElementById('track-name').value = '';
    document.getElementById('track-location').value = '';
    document.getElementById('track-country').value = '';
    document.getElementById('track-description').value = '';
    document.getElementById('track-length-miles').value = '';
    document.getElementById('track-length-km').value = '';
    document.getElementById('track-turns').value = '';
    document.getElementById('track-direction').value = 'clockwise';
    document.getElementById('track-map-upload').value = '';
    document.getElementById('track-map-preview').style.display = 'none';
}

function handleTrackMapUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            trackMapData = e.target.result.split(',')[1]; // Remove data:image/jpeg;base64, prefix

            // Show preview
            const preview = document.getElementById('track-map-preview');
            const img = document.getElementById('track-map-preview-img');
            img.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

async function saveTrack() {
    const name = document.getElementById('track-name').value;
    const location = document.getElementById('track-location').value;
    const country = document.getElementById('track-country').value;
    const description = document.getElementById('track-description').value;
    const lengthMiles = document.getElementById('track-length-miles').value;
    const lengthKm = document.getElementById('track-length-km').value;
    const turns = document.getElementById('track-turns').value;
    const direction = document.getElementById('track-direction').value;

    if (!name || !location) {
        alert('Track name and location are required');
        return;
    }

    try {
        const trackData = {
            id: currentEditingTrackId,
            name,
            location,
            country: country || null,
            description: description || null,
            length_miles: lengthMiles ? parseFloat(lengthMiles) : null,
            length_km: lengthKm ? parseFloat(lengthKm) : null,
            turns: turns ? parseInt(turns) : null,
            direction,
            track_map_data: trackMapData,
            track_map_filename: trackMapData ? document.getElementById('track-map-upload').files[0]?.name : null
        };

        const response = await apiCall('save-track', {
            method: 'POST',
            body: JSON.stringify(trackData)
        });

        if (response.success) {
            alert(response.message);
            closeTrackModal();
            loadTracksList();
        }
    } catch (error) {
        console.error('Error saving track:', error);
        alert('Error saving track: ' + error.message);
    }
}

function editTrack(trackId) {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;

    currentEditingTrackId = trackId;
    document.getElementById('track-modal-title').textContent = 'Edit Track';
    document.getElementById('save-track-btn').textContent = 'Update Track';

    document.getElementById('track-name').value = track.name || '';
    document.getElementById('track-location').value = track.location || '';
    document.getElementById('track-country').value = track.country || '';
    document.getElementById('track-description').value = track.description || '';
    document.getElementById('track-length-miles').value = track.length_miles || '';
    document.getElementById('track-length-km').value = track.length_km || '';
    document.getElementById('track-turns').value = track.turns || '';
    document.getElementById('track-direction').value = track.direction || 'clockwise';

    // Handle existing track map
    if (track.track_map_filename) {
        const preview = document.getElementById('track-map-preview');
        const img = document.getElementById('track-map-preview-img');
        img.src = `/api/get-track-map?trackId=${track.id}`;
        preview.style.display = 'block';
    }

    document.getElementById('track-modal').style.display = 'block';
}

async function deleteTrack(trackId) {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;

    if (!confirm(`Are you sure you want to delete "${track.name}"? This action cannot be undone.`)) {
        return;
    }

    try {
        const response = await apiCall('delete-track', {
            method: 'POST',
            body: JSON.stringify({ id: trackId })
        });

        if (response.success) {
            alert('Track deleted successfully');
            loadTracksList();
        }
    } catch (error) {
        console.error('Error deleting track:', error);
        alert('Error deleting track: ' + error.message);
    }
}

// Initialize app when page loads
window.addEventListener('DOMContentLoaded', initApp);

// Close modals when clicking outside of them
window.addEventListener('click', function(event) {
    const motorcycleModal = document.getElementById('motorcycle-modal');
    const tireModal = document.getElementById('tire-modal');
    const settingsModal = document.getElementById('settings-modal');
    const addEventModal = document.getElementById('add-event-modal');
    const trackModal = document.getElementById('track-modal');

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
    if (event.target === trackModal) {
        closeTrackModal();
    }
});