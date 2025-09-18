// js/events.js - Event management functions

let currentEditingEventId = null;
let raceSeries = [];

// Load events from database and populate series dropdown
async function loadEvents() {
    try {
        const response = await apiCall('get-events');
        events = response.events || [];
        
        // Extract unique race series from events
        raceSeries = [...new Set(events.map(e => e.series).filter(Boolean))];
        updateSeriesDropdown();
        updateEventDropdown();
    } catch (error) {
        console.error('Error loading events:', error);
        events = [];
        raceSeries = [];
    }
}

// Update series dropdown
function updateSeriesDropdown() {
    const select = document.getElementById('series-select');
    const currentSeries = select.value; // Preserve selection
    
    select.innerHTML = '<option value="">All Series</option>';
    
    // Add predefined series options
    const predefinedSeries = [
        'MotoAmerica', 'WERA', 'CMRA', 'AFM', 'CRA', 'NESBA', 
        'LRRS', 'CCS', 'WMRRA', 'Other'
    ];
    
    const allSeries = [...new Set([...raceSeries, ...predefinedSeries])].sort();
    
    allSeries.forEach(series => {
        const option = document.createElement('option');
        option.value = series;
        option.textContent = series;
        select.appendChild(option);
    });
    
    // Restore previous selection if it exists
    if (currentSeries && allSeries.includes(currentSeries)) {
        select.value = currentSeries;
    }
    
    // Add event listener for series filtering
    select.addEventListener('change', filterEventsBySeries);
}

// Filter events by selected series
function filterEventsBySeries() {
    const selectedSeries = document.getElementById('series-select').value;
    updateEventDropdown(selectedSeries);
}

// Update event dropdown with optional series filtering
function updateEventDropdown(filterSeries = null) {
    const select = document.getElementById('event-select');
    const currentEvent = select.value; // Preserve selection
    
    select.innerHTML = '<option value="">Select an event...</option>';
    
    // Filter events by series if specified
    let filteredEvents = events;
    if (filterSeries) {
        filteredEvents = events.filter(e => e.series === filterSeries);
    }
    
    // Sort events by date (most recent first)
    filteredEvents.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    filteredEvents.forEach(event => {
        const option = document.createElement('option');
        option.value = event.id;
        
        // Better event display with series
        const dateStr = new Date(event.date).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });
        option.textContent = `${event.series || 'Unknown'} - ${dateStr} - ${event.track}`;
        select.appendChild(option);
    });
    
    // Restore previous selection if it still exists after filtering
    if (currentEvent) {
        const eventStillExists = filteredEvents.some(e => e.id === currentEvent);
        if (eventStillExists) {
            select.value = currentEvent;
        }
    }
}

// Clear event form
function clearEventForm() {
    document.getElementById('event-series').value = '';
    document.getElementById('event-name').value = '';
    document.getElementById('event-track').value = '';
    document.getElementById('event-date').value = '';
    document.getElementById('event-date-display').value = '';
    document.getElementById('event-location').value = '';
}

// Edit event
function editEvent(eventId) {
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    currentEditingEventId = eventId;
    
    console.log('Editing event:', event); // Debug logging
    
    // Populate modal with existing data
    document.getElementById('event-series').value = event.series || '';
    document.getElementById('event-name').value = event.name || '';
    document.getElementById('event-track').value = event.track || '';

    // Convert ISO date to YYYY-MM-DD format for date input
    if (event.date) {
        const dateObj = new Date(event.date);
        const formattedDate = dateObj.toISOString().split('T')[0];
        document.getElementById('event-date').value = formattedDate;
    } else {
        document.getElementById('event-date').value = '';
    }

    document.getElementById('event-location').value = event.location || '';
    
    // Update date display
    updateEventDateRange();
    
    // Change modal title and button
    document.getElementById('event-modal-title').textContent = 'Edit Event';
    document.getElementById('save-event-btn').textContent = 'Update Event';
    
    document.getElementById('add-event-modal').style.display = 'block';
}

// Save event data with improved error handling
async function saveEventData() {
    const series = document.getElementById('event-series').value;
    const name = document.getElementById('event-name').value;
    const track = document.getElementById('event-track').value;
    const date = document.getElementById('event-date').value;
    const location = document.getElementById('event-location').value;

    console.log('Saving event data:', { series, name, track, date, location }); // Debug logging

    if (!series || !name || !track || !date || !location) {
        alert('Please fill in all fields');
        return;
    }

    const event = {
        id: currentEditingEventId || 'event-' + Date.now(),
        series,
        name,
        track,
        date,
        location,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    try {
        console.log('Calling save-event API with:', event); // Debug logging
        
        const response = await apiCall('save-event', {
            method: 'POST',
            body: JSON.stringify(event)
        });

        console.log('API Response:', response); // Debug logging

        if (currentEditingEventId) {
            // Update existing event in array
            const eventIndex = events.findIndex(e => e.id === currentEditingEventId);
            if (eventIndex !== -1) {
                events[eventIndex] = event;
                console.log('Updated event in local array'); // Debug logging
            }
            alert('Event updated successfully!');
        } else {
            // Add new event to array
            events.push(event);
            console.log('Added new event to local array'); // Debug logging
            alert('Event added successfully!');
        }

        // Refresh UI
        updateSeriesDropdown();
        updateEventDropdown();
        displayEventsList();
        closeAddEventModal();
        
        // Force reload events from database to verify persistence
        setTimeout(async () => {
            console.log('Reloading events from database...'); // Debug logging
            await loadEvents();
        }, 1000);

    } catch (error) {
        console.error('Error saving event:', error);
        alert('Error saving event: ' + error.message);
    }
}

// Display events list in settings with series
function displayEventsList() {
    const container = document.getElementById('events-list');
    
    if (events.length === 0) {
        container.innerHTML = '<p>No events found. Add some events to get started.</p>';
        return;
    }
    
    // Sort by series, then by date
    const sortedEvents = [...events].sort((a, b) => {
        if (a.series !== b.series) {
            return (a.series || 'ZZZ').localeCompare(b.series || 'ZZZ');
        }
        return new Date(b.date) - new Date(a.date);
    });
    
    container.innerHTML = sortedEvents.map(event => `
        <div style="padding: 15px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
            <div onclick="editEvent('${event.id}')" style="flex: 1; cursor: pointer;">
                <strong>${event.name}</strong><br>
                <span style="color: #2c5aa0; font-weight: 600;">${event.series || 'No Series'}</span><br>
                <span style="color: #666;">${event.track} - ${event.location}</span><br>
                <span style="font-size: 12px; color: #888;">${new Date(event.date).toLocaleDateString()}</span>
            </div>
            <button onclick="deleteEvent('${event.id}')" 
                    style="background: #dc3545; color: white; border: none; border-radius: 3px; padding: 5px 10px; cursor: pointer;">
                Delete
            </button>
        </div>
    `).join('');
}

// Load track map with expanded track database for regional tracks
function loadTrackMap(eventId) {
    const event = events.find(e => e.id === eventId);
    const container = document.getElementById('track-map-container');
    
    if (!event) {
        container.innerHTML = `
            <div class="track-map-placeholder">
                <p>Select an event to view track map</p>
            </div>
        `;
        return;
    }

    // Expanded track map database including regional tracks
    const trackMaps = {
        // Major tracks
        'road america': 'https://upload.wikimedia.org/wikipedia/commons/b/b8/Road_America_track_map.svg',
        'roadamerica': 'https://upload.wikimedia.org/wikipedia/commons/b/b8/Road_America_track_map.svg',
        'laguna seca': 'https://upload.wikimedia.org/wikipedia/commons/4/47/Laguna_Seca_Raceway_track_map.svg',
        'weathertech raceway laguna seca': 'https://upload.wikimedia.org/wikipedia/commons/4/47/Laguna_Seca_Raceway_track_map.svg',
        'cota': 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Circuit_of_the_Americas_track_map.svg',
        'circuit of the americas': 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Circuit_of_the_Americas_track_map.svg',
        'barber motorsports park': 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Barber_Motorsports_Park_track_map.svg',
        'barber': 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Barber_Motorsports_Park_track_map.svg',
        'virginia international raceway': 'https://upload.wikimedia.org/wikipedia/commons/3/36/VIRtrack.svg',
        'vir': 'https://upload.wikimedia.org/wikipedia/commons/3/36/VIRtrack.svg',
        'watkins glen': 'https://upload.wikimedia.org/wikipedia/commons/6/60/Watkins_Glen_International_track_map.svg',
        'daytona': 'https://upload.wikimedia.org/wikipedia/commons/8/8a/Daytona_International_Speedway_road_course_map.svg',
        
        // Regional WERA/CMRA tracks
        'putnam park': 'https://putnampark.com/wp-content/uploads/2019/03/track-map-new.png',
        'little talladega': 'https://upload.wikimedia.org/wikipedia/commons/5/52/Little_Talladega_track_map.svg',
        'hallett motor racing circuit': 'https://upload.wikimedia.org/wikipedia/commons/e/e4/Hallett_Motor_Racing_Circuit_track_map.svg',
        'hallett': 'https://upload.wikimedia.org/wikipedia/commons/e/e4/Hallett_Motor_Racing_Circuit_track_map.svg',
        'motorsport ranch': 'https://upload.wikimedia.org/wikipedia/commons/4/46/MotorSport_Ranch_track_map.svg',
        'cresson': 'https://upload.wikimedia.org/wikipedia/commons/4/46/MotorSport_Ranch_track_map.svg',
        'eagles canyon raceway': 'https://upload.wikimedia.org/wikipedia/commons/7/70/Eagles_Canyon_Raceway_track_map.svg',
        'thunderhill': 'https://upload.wikimedia.org/wikipedia/commons/9/9a/Thunderhill_Raceway_East_track_map.svg',
        'buttonwillow': 'https://upload.wikimedia.org/wikipedia/commons/2/2c/Buttonwillow_Raceway_Park_track_map.svg',
        'chuckwalla': 'https://upload.wikimedia.org/wikipedia/commons/c/c6/Chuckwalla_Valley_Raceway_track_map.svg',
        'new jersey motorsports park': 'https://upload.wikimedia.org/wikipedia/commons/f/f1/New_Jersey_Motorsports_Park_Thunderbolt_Raceway_track_map.svg',
        'njmp': 'https://upload.wikimedia.org/wikipedia/commons/f/f1/New_Jersey_Motorsports_Park_Thunderbolt_Raceway_track_map.svg',
        'carolina motorsports park': 'https://upload.wikimedia.org/wikipedia/commons/8/80/Carolina_Motorsports_Park_track_map.svg'
    };

    const trackKey = event.track.toLowerCase().trim();
    let mapUrl = trackMaps[trackKey];
    
    // Try partial matching
    if (!mapUrl) {
        const trackKeys = Object.keys(trackMaps);
        const partialMatch = trackKeys.find(key => 
            trackKey.includes(key) || key.includes(trackKey)
        );
        if (partialMatch) {
            mapUrl = trackMaps[partialMatch];
        }
    }

    console.log('Looking for track map:', trackKey, 'Found:', !!mapUrl);

    if (mapUrl) {
        container.innerHTML = `
            <div>
                <h4 style="margin-bottom: 10px; color: #2c5aa0;">${event.track}</h4>
                <div style="position: relative;">
                    <img src="${mapUrl}" alt="${event.track} Track Map" class="track-map" 
                         style="width: 100%; max-height: 300px; object-fit: contain; border-radius: 8px; border: 1px solid #ddd;"
                         onload="console.log('Track map loaded successfully')"
                         onerror="handleTrackMapError(this, '${event.track}')">
                </div>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="track-map-placeholder">
                <h4 style="margin-bottom: 10px; color: #2c5aa0;">${event.track}</h4>
                <p>Track map not available</p>
                <small style="color: #666; display: block; margin-top: 10px;">
                    Track: "${trackKey}"<br>
                    To add: Update trackMaps object in events.js
                </small>
            </div>
        `;
    }
}

// Handle track map loading errors
function handleTrackMapError(imgElement, trackName) {
    console.error('Failed to load track map for:', trackName);
    imgElement.parentElement.parentElement.innerHTML = `
        <div class="track-map-placeholder">
            <h4 style="margin-bottom: 10px; color: #2c5aa0;">${trackName}</h4>
            <p>Track map failed to load</p>
            <small style="color: #666;">
                Image may be blocked by CORS policy.
            </small>
        </div>
    `;
}

// Update event dropdown and load track map
function updateEventDropdown() {
    const select = document.getElementById('event-select');
    select.innerHTML = '<option value="">Select an event...</option>';
    
    events.forEach(event => {
        const option = document.createElement('option');
        option.value = event.id;
        option.textContent = `${event.date.split('-')[1]}/${event.date.split('-')[2]} - ${event.location}`;
        select.appendChild(option);
    });
}

// Load track map based on selected event
function loadTrackMap(eventId) {
    const event = events.find(e => e.id === eventId);
    const container = document.getElementById('track-map-container');
    
    if (!event) {
        container.innerHTML = `
            <div class="track-map-placeholder">
                <p>Select an event to view track map</p>
            </div>
        `;
        return;
    }

    // More comprehensive track map matching
    const trackMaps = {
        // Road America variations
        'road america': 'https://www.roadamerica.com/sites/default/files/Track-Map-2019.png',
        'roadamerica': 'https://www.roadamerica.com/sites/default/files/Track-Map-2019.png',
        
        // Laguna Seca variations  
        'laguna seca': 'https://upload.wikimedia.org/wikipedia/commons/4/47/Laguna_Seca_Raceway_track_map.svg',
        'weathertech raceway laguna seca': 'https://upload.wikimedia.org/wikipedia/commons/4/47/Laguna_Seca_Raceway_track_map.svg',
        'mazda raceway laguna seca': 'https://upload.wikimedia.org/wikipedia/commons/4/47/Laguna_Seca_Raceway_track_map.svg',
        
        // COTA variations
        'cota': 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Circuit_of_the_Americas_track_map.svg',
        'circuit of the americas': 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Circuit_of_the_Americas_track_map.svg',
        
        // Barber variations
        'barber motorsports park': 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Barber_Motorsports_Park_track_map.svg',
        'barber': 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Barber_Motorsports_Park_track_map.svg',
        
        // VIR variations
        'virginia international raceway': 'https://upload.wikimedia.org/wikipedia/commons/3/36/VIRtrack.svg',
        'vir': 'https://upload.wikimedia.org/wikipedia/commons/3/36/VIRtrack.svg',
        
        // NJMP variations
        'new jersey motorsports park': 'https://upload.wikimedia.org/wikipedia/commons/f/f1/New_Jersey_Motorsports_Park_Thunderbolt_Raceway_track_map.svg',
        'njmp': 'https://upload.wikimedia.org/wikipedia/commons/f/f1/New_Jersey_Motorsports_Park_Thunderbolt_Raceway_track_map.svg',
        
        // Add more common tracks
        'daytona': 'https://upload.wikimedia.org/wikipedia/commons/8/8a/Daytona_International_Speedway_road_course_map.svg',
        'watkins glen': 'https://upload.wikimedia.org/wikipedia/commons/6/60/Watkins_Glen_International_track_map.svg',
        'atlanta motorsports park': 'https://upload.wikimedia.org/wikipedia/commons/5/50/Atlanta_Motorsports_Park_track_map.svg'
    };

    // Try multiple matching strategies
    const trackKey = event.track.toLowerCase().trim();
    let mapUrl = trackMaps[trackKey];
    
    // If no exact match, try partial matching
    if (!mapUrl) {
        const trackKeys = Object.keys(trackMaps);
        const partialMatch = trackKeys.find(key => 
            trackKey.includes(key) || key.includes(trackKey)
        );
        if (partialMatch) {
            mapUrl = trackMaps[partialMatch];
        }
    }

    console.log('Looking for track map:', trackKey, 'Found:', !!mapUrl);

    if (mapUrl) {
        container.innerHTML = `
            <div>
                <h4 style="margin-bottom: 10px; color: #2c5aa0;">${event.track}</h4>
                <div style="position: relative;">
                    <img src="${mapUrl}" alt="${event.track} Track Map" class="track-map" 
                         style="width: 100%; max-height: 300px; object-fit: contain; border-radius: 8px; border: 1px solid #ddd;"
                         onload="console.log('Track map loaded successfully')"
                         onerror="handleTrackMapError(this, '${event.track}')">
                    <div id="map-loading" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(255,255,255,0.9); padding: 10px; border-radius: 4px; display: none;">
                        Loading map...
                    </div>
                </div>
            </div>
        `;
        
        // Show loading indicator briefly
        const loading = container.querySelector('#map-loading');
        if (loading) {
            loading.style.display = 'block';
            setTimeout(() => loading.style.display = 'none', 2000);
        }
    } else {
        container.innerHTML = `
            <div class="track-map-placeholder">
                <h4 style="margin-bottom: 10px; color: #2c5aa0;">${event.track}</h4>
                <p>Track map not available</p>
                <small style="color: #666; display: block; margin-top: 10px;">
                    To add this track map:<br>
                    1. Find a track map image URL<br>
                    2. Add it to the trackMaps object in events.js<br>
                    3. Key: "${trackKey}"
                </small>
            </div>
        `;
    }
}

// Handle track map loading errors
function handleTrackMapError(imgElement, trackName) {
    console.error('Failed to load track map for:', trackName);
    imgElement.parentElement.parentElement.innerHTML = `
        <div class="track-map-placeholder">
            <h4 style="margin-bottom: 10px; color: #2c5aa0;">${trackName}</h4>
            <p>Track map failed to load</p>
            <small style="color: #666;">
                The image may be blocked by CORS policy or the URL may be invalid.
            </small>
        </div>
    `;
}

// Settings modal functions
function showSettingsModal() {
    loadSettings();
    document.getElementById('settings-modal').style.display = 'block';
    showSettingsTab('units');
}

function closeSettingsModal() {
    document.getElementById('settings-modal').style.display = 'none';
}

function showSettingsTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.style.display = 'none';
    });
    
    // Remove active class from all tab buttons
    document.querySelectorAll('#settings-modal .btn').forEach(btn => {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
    });
    
    // Show selected tab
    document.getElementById(tabName + '-settings').style.display = 'block';
    document.getElementById(tabName + '-tab').classList.remove('btn-secondary');
    document.getElementById(tabName + '-tab').classList.add('btn-primary');
    
    if (tabName === 'events') {
        displayEventsList();
    }
}

// Display events list in settings
function displayEventsList() {
    const container = document.getElementById('events-list');
    
    if (events.length === 0) {
        container.innerHTML = '<p>No events found. Add some events to get started.</p>';
        return;
    }
    
    container.innerHTML = events.map(event => `
        <div style="padding: 15px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
            <div onclick="editEvent('${event.id}')" style="flex: 1; cursor: pointer;">
                <strong>${event.name}</strong><br>
                <span style="color: #666; font-weight: 500;">${event.series || 'No Series'}</span><br>
                <span style="color: #666;">${event.track} - ${event.location}</span><br>
                <span style="font-size: 12px; color: #888;">${new Date(event.date).toLocaleDateString()}</span>
            </div>
            <button onclick="deleteEvent('${event.id}')"
                    style="background: #dc3545; color: white; border: none; border-radius: 3px; padding: 5px 10px; cursor: pointer;">
                Delete
            </button>
        </div>
    `).join('');
}


// Show add event modal
function showAddEventModal() {
    currentEditingEventId = null;
    document.getElementById('event-modal-title').textContent = 'Add New Event';
    document.getElementById('save-event-btn').textContent = 'Add Event';
    clearEventForm();
    document.getElementById('add-event-modal').style.display = 'block';
}

// Close add event modal
function closeAddEventModal() {
    document.getElementById('add-event-modal').style.display = 'none';
    currentEditingEventId = null;
    clearEventForm();
}

// Clear event form
function clearEventForm() {
    document.getElementById('event-name').value = '';
    document.getElementById('event-track').value = '';
    document.getElementById('event-date').value = '';
    document.getElementById('event-date-display').value = '';
    document.getElementById('event-location').value = '';
}

// Update event date range display
function updateEventDateRange() {
    const startDate = document.getElementById('event-date').value;
    if (!startDate) {
        document.getElementById('event-date-display').value = '';
        return;
    }

    const start = new Date(startDate);
    // Add 2 days to get to Sunday (Friday -> Sunday)
    const end = new Date(start);
    end.setDate(start.getDate() + 2);
    
    const startFormatted = start.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
    const endFormatted = end.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
    
    document.getElementById('event-date-display').value = `${startFormatted} - ${endFormatted}`;
}

// Save event data
async function saveEventData() {
    const series = document.getElementById('event-series').value;
    const name = document.getElementById('event-name').value;
    const track = document.getElementById('event-track').value;
    const date = document.getElementById('event-date').value;
    const location = document.getElementById('event-location').value;

    if (!series || !name || !track || !date || !location) {
        alert('Please fill in all fields');
        return;
    }

    const event = {
        id: currentEditingEventId || 'custom-' + Date.now(),
        series,
        name,
        track,
        date,
        location
    };

    try {
        const response = await apiCall('save-event', {
            method: 'POST',
            body: JSON.stringify(event)
        });

        // Use the event data returned from the API to ensure proper formatting
        const savedEvent = response.event;

        if (currentEditingEventId) {
            // Update existing event in array
            const eventIndex = events.findIndex(e => e.id === currentEditingEventId);
            if (eventIndex !== -1) {
                events[eventIndex] = savedEvent;
            }
            alert('Event updated successfully!');
        } else {
            // Add new event to array
            events.push(savedEvent);
            alert('Event added successfully!');
        }

        updateEventDropdown();
        displayEventsList();
        closeAddEventModal();
    } catch (error) {
        console.error('Error saving event:', error);
        alert('Error saving event. Please try again.');
    }
}

// Delete event
async function deleteEvent(eventId) {
    if (confirm('Are you sure you want to delete this event?')) {
        try {
            await apiCall(`delete-event?id=${eventId}`, {
                method: 'DELETE'
            });

            events = events.filter(e => e.id !== eventId);
            
            // Clear state if deleted event was selected
            if (currentEvent === eventId) {
                currentEvent = null;
                document.getElementById('event-select').value = '';
                document.getElementById('main-content').style.display = 'none';
                saveAppState();
            }
            
            updateEventDropdown();
            displayEventsList();
            alert('Event deleted successfully!');
        } catch (error) {
            console.error('Error deleting event:', error);
            alert('Error deleting event. Please try again.');
        }
    }
}

// Tire management functions
function showTireModal() {
    document.getElementById('tire-modal').style.display = 'block';
    displayTireList();
}

function closeTireModal() {
    document.getElementById('tire-modal').style.display = 'none';
}

// Load tires from database
async function loadTires() {
    try {
        const response = await apiCall('get-tires');
        tires = response.tires || [];
        updateTireDropdowns();
    } catch (error) {
        console.error('Error loading tires:', error);
        tires = [];
    }
}

// Update tire dropdowns
function updateTireDropdowns() {
    const frontSelect = document.getElementById('front-tire');
    const rearSelect = document.getElementById('rear-tire');
    
    frontSelect.innerHTML = '<option value="">Select tire...</option>';
    rearSelect.innerHTML = '<option value="">Select tire...</option>';
    
    tires.forEach(tire => {
        const optionText = `${tire.brand} ${tire.type} ${tire.size}`;
        
        const frontOption = document.createElement('option');
        frontOption.value = tire.id;
        frontOption.textContent = optionText;
        frontSelect.appendChild(frontOption);
        
        const rearOption = document.createElement('option');
        rearOption.value = tire.id;
        rearOption.textContent = optionText;
        rearSelect.appendChild(rearOption);
    });
}

// Add new tire
async function addTire() {
    const brand = document.getElementById('tire-brand').value;
    const type = document.getElementById('tire-type').value;
    const size = document.getElementById('tire-size').value;
    const compound = document.getElementById('tire-compound').value;

    if (!brand || !type || !size) {
        alert('Please fill in brand, type, and size');
        return;
    }

    const tire = {
        id: `${brand.toLowerCase()}-${type.toLowerCase()}-${Date.now()}`,
        brand,
        type,
        size,
        compound: compound || ''
    };

    try {
        await apiCall('save-tire', {
            method: 'POST',
            body: JSON.stringify(tire)
        });

        // Clear form
        document.getElementById('tire-size').value = '';
        document.getElementById('tire-compound').value = '';

        // Reload tires
        await loadTires();
        displayTireList();
        
        alert('Tire added successfully!');
    } catch (error) {
        console.error('Error adding tire:', error);
        alert('Error adding tire. Please try again.');
    }
}

// Display tire list in modal
function displayTireList() {
    const container = document.getElementById('tire-display');
    if (tires.length === 0) {
        container.innerHTML = '<p>No tires available</p>';
        return;
    }

    container.innerHTML = tires.map(tire => `
        <div style="padding: 5px; border-bottom: 1px solid #eee;">
            <strong>${tire.brand} ${tire.type}</strong><br>
            Size: ${tire.size}<br>
            ${tire.compound ? `Compound: ${tire.compound}` : ''}
        </div>
    `).join('');
}