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

    select.innerHTML = '<option value="">Select Series...</option>';

    // Use centralized race series data if available, otherwise fall back to existing data
    let availableSeries = [];
    if (window.raceSeriesData && window.raceSeriesData.length > 0) {
        // Use centralized race series (only active ones)
        availableSeries = window.raceSeriesData
            .filter(series => series.is_active)
            .map(series => series.name);
    } else {
        // Fallback to predefined series for backwards compatibility
        availableSeries = [
            'MotoAmerica', 'WERA', 'CMRA', 'AFM', 'American Flat Track', 'CRA', 'NESBA',
            'LRRS', 'CCS', 'WMRRA', 'Other'
        ];
    }

    const allSeries = [...new Set([...raceSeries, ...availableSeries])].sort();

    allSeries.forEach(series => {
        const option = document.createElement('option');
        option.value = series;
        option.textContent = series;
        select.appendChild(option);
    });

    // Restore previous selection if it exists
    if (currentSeries && allSeries.includes(currentSeries)) {
        select.value = currentSeries;
        // Show existing events for the restored selection
        showExistingEventsInSeries(currentSeries);
    } else {
        // Clear existing events display when no series is selected
        hideExistingEventsDisplay();
    }

    // Add event listener for series filtering (remove existing first)
    select.removeEventListener('change', filterEventsBySeries);
    select.addEventListener('change', filterEventsBySeries);
}

// Filter events by selected series and show existing events
async function filterEventsBySeries() {
    const selectedSeries = document.getElementById('series-select').value;

    if (selectedSeries) {
        // Show existing events in this series
        await showExistingEventsInSeries(selectedSeries);
    } else {
        // Clear existing events display
        hideExistingEventsDisplay();
    }

    updateEventDropdown(selectedSeries);
}

// Show existing events in selected series
async function showExistingEventsInSeries(series) {
    try {
        const response = await apiCall(`get-events-by-series?series=${encodeURIComponent(series)}`);

        if (response.success && response.events.length > 0) {
            displayExistingEvents(response.events, series);
        } else {
            hideExistingEventsDisplay();
        }
    } catch (error) {
        console.error('Error fetching events for series:', error);
        hideExistingEventsDisplay();
    }
}

// Display existing events for the selected series
function displayExistingEvents(seriesEvents, seriesName) {
    // Create or get the existing events container
    let container = document.getElementById('existing-events-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'existing-events-container';
        container.style.cssText = `
            background: #f8f9fa;
            border: 2px solid #e9ecef;
            border-radius: 8px;
            padding: 15px;
            margin: 10px 0;
            max-height: 300px;
            overflow-y: auto;
        `;

        // Insert after the series select
        const seriesSelect = document.getElementById('series-select').parentElement;
        seriesSelect.parentElement.insertBefore(container, seriesSelect.nextSibling);
    }

    container.innerHTML = `
        <div style="margin-bottom: 10px;">
            <h4 style="margin: 0 0 5px 0; color: #2c5aa0;">Existing ${seriesName} Events</h4>
            <p style="margin: 0; font-size: 14px; color: #666;">Join an existing event or create a new one</p>
        </div>
        <div style="display: grid; gap: 8px;">
            ${seriesEvents.map(event => {
                const eventDate = new Date(event.date);
                const isUpcoming = eventDate >= new Date();
                const hasUserSessions = event.user_has_sessions;

                return `
                    <div class="existing-event-card ${hasUserSessions ? 'event-status-joined' : (isUpcoming ? 'event-status-upcoming' : 'event-status-past')}"
                         onclick="selectExistingEvent('${event.id}')">`
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; color: #333; margin-bottom: 3px;">
                                    ${event.name}
                                </div>
                                <div style="font-size: 13px; color: #666; margin-bottom: 2px;">
                                    📍 ${event.track_name || event.track} - ${event.track_location || event.location}
                                </div>
                                <div style="font-size: 13px; color: #666;">
                                    📅 ${eventDate.toLocaleDateString('en-US', {
                                        weekday: 'short',
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric'
                                    })}
                                </div>
                            </div>
                            <div style="text-align: right;">
                                ${hasUserSessions ?
                                    `<span style="background: #28a745; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px;">
                                        JOINED (${event.session_count} sessions)
                                    </span>` :
                                    (isUpcoming ?
                                        `<span style="background: #2196f3; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px;">
                                            UPCOMING
                                        </span>` :
                                        `<span style="background: #6c757d; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px;">
                                            PAST
                                        </span>`
                                    )
                                }
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e9ecef; text-align: center;">
            <button onclick="hideExistingEventsDisplay(); showCreateNewEventOption('${seriesName}')"
                    style="background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;">
                + Create New ${seriesName} Event
            </button>
        </div>
    `;

    container.style.display = 'block';
}

// Hide existing events display
function hideExistingEventsDisplay() {
    const container = document.getElementById('existing-events-container');
    if (container) {
        container.style.display = 'none';
    }
}

// Select an existing event
function selectExistingEvent(eventId) {
    const eventSelect = document.getElementById('event-select');
    eventSelect.value = eventId;

    // Trigger the event selection
    if (typeof checkShowMainContent === 'function') {
        checkShowMainContent();
    }

    // Hide the existing events display since user made a selection
    hideExistingEventsDisplay();
}

// Show option to create new event for selected series
function showCreateNewEventOption(seriesName) {
    // Pre-fill the series in the add event modal
    if (typeof showAddEventModal === 'function') {
        showAddEventModal();
        // Pre-select the series
        setTimeout(() => {
            const seriesSelect = document.getElementById('event-series');
            if (seriesSelect) {
                seriesSelect.value = seriesName;
            }
        }, 100);
    }
}

// Update event dropdown with filtering by user's race series
function updateEventDropdown(filterSeries = null) {
    const select = document.getElementById('event-select');
    const currentEvent = select.value; // Preserve selection

    select.innerHTML = '<option value="">Select an event...</option>';

    // Get user's selected race series from settings
    const userSeries = settings.userRaceSeries || [];

    // Filter events by user's series (unless specific filterSeries is provided)
    let filteredEvents = events;
    if (filterSeries) {
        // Use specific series filter (for backwards compatibility)
        filteredEvents = events.filter(e => e.series === filterSeries);
    } else if (userSeries.length > 0) {
        // Filter by user's selected series
        filteredEvents = events.filter(e => userSeries.includes(e.series));
    }

    // Sort events by date (most recent first)
    filteredEvents.sort((a, b) => new Date(b.date) - new Date(a.date));

    filteredEvents.forEach(event => {
        const option = document.createElement('option');
        option.value = event.id;

        // Format: Series - Event Name - MM/DD/YYYY - Location
        const eventDate = new Date(event.date);
        const dateStr = eventDate.toLocaleDateString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric'
        });

        // Use track location if available, otherwise fall back to event location
        const track = event.track_id ? tracks.find(t => t.id === event.track_id) : null;
        const location = track ? track.location : event.location;
        option.textContent = `${event.series || 'Unknown'} - ${event.name} - ${dateStr} - ${location}`;
        select.appendChild(option);
    });

    // Show message if no events match user's series
    if (filteredEvents.length === 0 && userSeries.length > 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No events found for your selected race series';
        option.disabled = true;
        select.appendChild(option);
    } else if (filteredEvents.length === 0 && userSeries.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Configure race series in Account Settings to see filtered events';
        option.disabled = true;
        select.appendChild(option);
    }

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
    const trackId = document.getElementById('event-track').value;
    const date = document.getElementById('event-date').value;
    const location = document.getElementById('event-location').value;

    console.log('Saving event data:', { series, name, trackId, date, location }); // Debug logging

    if (!series || !name || !trackId || !date || !location) {
        alert('Please fill in all fields');
        return;
    }

    // Get track name for display purposes
    const trackSelect = document.getElementById('event-track');
    const trackName = trackSelect.options[trackSelect.selectedIndex].text;

    const event = {
        id: currentEditingEventId || 'event-' + Date.now(),
        series,
        name,
        track: trackName.split(' - ')[0], // Extract just the track name
        track_id: trackId,
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
                <span style="color: #666;">${event.track} - ${(() => {
                    const track = event.track_id ? tracks.find(t => t.id === event.track_id) : null;
                    return track ? track.location : event.location;
                })()}</span><br>
                <span style="font-size: 12px; color: #888;">${new Date(event.date).toLocaleDateString()}</span>
            </div>
            <button onclick="deleteEvent('${event.id}')" 
                    style="background: #dc3545; color: white; border: none; border-radius: 3px; padding: 5px 10px; cursor: pointer;">
                Delete
            </button>
        </div>
    `).join('');
}



// Settings modal functions
async function showSettingsModal() {
    await loadSettings();
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
        // Pre-load tracks for when user opens add event modal
        loadTracksIntoEventForm();
    } else if (tabName === 'motorcycles') {
        displayMotorcyclesList();
    } else if (tabName === 'teams') {
        // Initialize teams functionality when tab is shown
        if (typeof initializeTeams === 'function') {
            initializeTeams();
        }
    } else if (tabName === 'account') {
        // Load race series options when account tab is shown
        loadUserRaceSeriesOptions();
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
                <span style="color: #666;">${event.track} - ${(() => {
                    const track = event.track_id ? tracks.find(t => t.id === event.track_id) : null;
                    return track ? track.location : event.location;
                })()}</span><br>
                <span style="font-size: 12px; color: #888;">${new Date(event.date).toLocaleDateString()}</span>
            </div>
            <button onclick="deleteEvent('${event.id}')"
                    style="background: #dc3545; color: white; border: none; border-radius: 3px; padding: 5px 10px; cursor: pointer;">
                Delete
            </button>
        </div>
    `).join('');
}

// Display motorcycles list in settings
function displayMotorcyclesList() {
    const container = document.getElementById('motorcycles-settings-list');
    if (motorcycles.length === 0) {
        container.innerHTML = '<p>No motorcycles available. Click "Add Motorcycle" to get started.</p>';
        return;
    }

    container.innerHTML = motorcycles.map(motorcycle => `
        <div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 10px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <div style="font-weight: bold; font-size: 16px; color: #2c5aa0; margin-bottom: 5px;">
                    ${motorcycle.make} ${motorcycle.model}
                </div>
                <div style="color: #666; font-size: 14px; margin-bottom: 3px;">
                    <strong>Class:</strong> ${motorcycle.class}
                </div>
                <div style="color: #666; font-size: 14px; margin-bottom: 3px;">
                    <strong>Number:</strong> ${motorcycle.number}
                </div>
                <div style="color: #666; font-size: 14px;">
                    <strong>Variant:</strong> ${motorcycle.variant}
                </div>
            </div>
            <div style="display: flex; gap: 10px;">
                ${currentMotorcycle && currentMotorcycle.id === motorcycle.id
                    ? '<span class="btn btn-small" style="background: #28a745; color: white;">Selected</span>'
                    : `<button onclick="selectMotorcycle('${motorcycle.id}')" class="btn btn-primary btn-small">Select</button>`
                }
                <button onclick="editMotorcycle('${motorcycle.id}')"
                        class="btn btn-secondary btn-small">
                    Edit
                </button>
                <button onclick="deleteMotorcycle('${motorcycle.id}')"
                        class="btn btn-small"
                        style="background: #dc3545; color: white;">
                    Delete
                </button>
            </div>
        </div>
    `).join('');
}

// Show add event modal
async function showAddEventModal() {
    currentEditingEventId = null;
    document.getElementById('event-modal-title').textContent = 'Add New Event';
    document.getElementById('save-event-btn').textContent = 'Add Event';
    clearEventForm();

    // Always load tracks when opening the modal
    await loadTracksIntoEventForm();

    document.getElementById('add-event-modal').style.display = 'block';
}

// Close add event modal
function closeAddEventModal() {
    document.getElementById('add-event-modal').style.display = 'none';
    currentEditingEventId = null;
    clearEventForm();
}

// Load tracks into event form
async function loadTracksIntoEventForm() {
    try {
        console.log('Loading tracks into event form...'); // Debug log
        const response = await apiCall('get-tracks');
        console.log('Tracks response:', response); // Debug log

        const trackSelect = document.getElementById('event-track');
        if (!trackSelect) {
            console.error('Track select element not found');
            return;
        }

        // Clear existing options except the first one
        trackSelect.innerHTML = '<option value="">Select Track...</option>';

        if (response.success && response.tracks && response.tracks.length > 0) {
            console.log(`Loading ${response.tracks.length} tracks`); // Debug log
            response.tracks.forEach(track => {
                const option = document.createElement('option');
                option.value = track.id;
                option.textContent = `${track.name} - ${track.location}`;
                trackSelect.appendChild(option);
            });
        } else {
            console.log('No tracks found in response'); // Debug log
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No tracks available - Contact admin';
            option.disabled = true;
            trackSelect.appendChild(option);
        }
    } catch (error) {
        console.error('Error loading tracks for event form:', error);
        const trackSelect = document.getElementById('event-track');
        if (trackSelect) {
            trackSelect.innerHTML = '<option value="">Error loading tracks</option>';
        }
    }
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
    const trackId = document.getElementById('event-track').value;
    const date = document.getElementById('event-date').value;
    const location = document.getElementById('event-location').value;

    if (!series || !name || !trackId || !date || !location) {
        alert('Please fill in all fields');
        return;
    }

    // Get track name for display purposes
    const trackSelect = document.getElementById('event-track');
    const trackName = trackSelect.options[trackSelect.selectedIndex].text;

    const event = {
        id: currentEditingEventId || 'custom-' + Date.now(),
        series,
        name,
        track: trackName.split(' - ')[0], // Extract just the track name
        track_id: trackId,
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