// js/weather.js - Weather management functions

// Weather capture function that respects user preferences
async function captureWeather() {
    if (!currentEvent) {
        alert('Please select an event first');
        return;
    }

    const btn = document.getElementById('capture-weather-btn');
    btn.textContent = 'Capturing...';
    btn.disabled = true;

    try {
        // Get location from current event
        const event = events.find(e => e.id === currentEvent);
        if (!event) {
            throw new Error('Event not found');
        }

        // Get user's temperature preference
        const temperatureUnit = settings.temperatureUnit || 'fahrenheit';
        
        // Use track location if available, otherwise fall back to event location
        const track = event.track_id ? tracks.find(t => t.id === event.track_id) : null;
        const location = track ? track.location : event.location;
        const response = await apiCall(`get-weather?location=${encodeURIComponent(location)}&units=${temperatureUnit}`);
        
        if (response.success) {
            currentWeatherData = response.weather;
            currentWeatherData.timestamp = new Date().toISOString();
            
            displayWeatherData();
            btn.textContent = 'Refresh Weather';
            
            console.log('Weather captured successfully:', currentWeatherData);
        } else {
            throw new Error(response.error || 'Unknown error');
        }
        
    } catch (error) {
        console.error('Error capturing weather:', error);
        alert('Could not capture weather data: ' + error.message);
        btn.textContent = 'Capture Weather';
    } finally {
        btn.disabled = false;
    }
}

// Display weather data with proper unit handling
function displayWeatherData() {
    if (!currentWeatherData) return;

    const tempUnit = settings.temperatureUnit === 'celsius' ? '°C' : '°F';
    let displayTemperature = currentWeatherData.temperature;
    
    // The API now returns the temperature in the requested unit, so no conversion needed
    // But we should use the specific temperature values if available
    if (settings.temperatureUnit === 'celsius' && currentWeatherData.temperatureCelsius) {
        displayTemperature = currentWeatherData.temperatureCelsius;
    } else if (settings.temperatureUnit === 'fahrenheit' && currentWeatherData.temperatureFahrenheit) {
        displayTemperature = currentWeatherData.temperatureFahrenheit;
    }

    document.getElementById('weather-temp').textContent = `${displayTemperature}${tempUnit}`;
    document.getElementById('weather-condition').textContent = currentWeatherData.conditions || 'Unknown';
    document.getElementById('weather-humidity').textContent = `${currentWeatherData.humidity}%`;
    document.getElementById('weather-wind').textContent = `${currentWeatherData.windSpeed} km/h`;
    document.getElementById('weather-time').textContent = new Date(currentWeatherData.timestamp).toLocaleTimeString();
    
    document.getElementById('weather-display').style.display = 'block';

    // Check for weather changes from previous session
    checkWeatherChanges();
}

// Check for weather changes between sessions
function checkWeatherChanges() {
    const sessions = ['practice1', 'qualifying1', 'qualifying2', 'race1', 'warmup', 'race2'];
    const currentIndex = sessions.indexOf(currentSession);
    
    if (currentIndex > 0) {
        const previousSession = sessions[currentIndex - 1];
        const previousKey = `${currentEvent}_${currentMotorcycle.id}_${previousSession}`;
        const previousData = sessionData[previousKey];
        
        if (previousData && previousData.weatherCondition && currentWeatherData) {
            const prevCondition = previousData.weatherCondition.toLowerCase();
            const currentCondition = currentWeatherData.conditions.toLowerCase();
            
            if ((prevCondition.includes('rain') || prevCondition.includes('drizzle')) && 
                (!currentCondition.includes('rain') && !currentCondition.includes('drizzle'))) {
                alert('Weather Alert: Previous session was wet, current conditions are dry. Consider setup changes.');
            } else if ((!prevCondition.includes('rain') && !prevCondition.includes('drizzle')) && 
                       (currentCondition.includes('rain') || currentCondition.includes('drizzle'))) {
                alert('Weather Alert: Conditions have changed to wet. Consider tire and setup changes.');
            }
        }
    }
}

// Load previous track data for setup suggestions
async function loadPreviousTrackData() {
    if (!currentMotorcycle || !currentEvent) return;

    try {
        const event = events.find(e => e.id === currentEvent);
        if (!event) return;

        const response = await apiCall(`get-previous-track-data?motorcycle_id=${currentMotorcycle.id}&track=${encodeURIComponent(event.track)}`);
        
        if (response.sessions && response.sessions.length > 0) {
            const confirmPopulate = confirm(`Found previous data from this track. Pre-populate Practice 1 with your last setup from ${event.track}?`);
            
            if (confirmPopulate && currentSession === 'practice1') {
                populateFromPreviousTrackData(response.sessions[0]);
            }
        }
    } catch (error) {
        if (error.message.includes('404')) {
            console.log('No previous data found for this track - that\'s normal for first visits');
        } else {
            console.error('Error loading previous track data:', error);
        }
    }
}

// Populate form with previous track data
function populateFromPreviousTrackData(previousSession) {
    // Populate setup fields
    document.getElementById('front-spring').value = previousSession.front_spring || '';
    document.getElementById('front-preload').value = previousSession.front_preload || '';
    document.getElementById('front-compression').value = previousSession.front_compression || '';
    document.getElementById('front-rebound').value = previousSession.front_rebound || '';
    document.getElementById('rear-spring').value = previousSession.rear_spring || '';
    document.getElementById('rear-preload').value = previousSession.rear_preload || '';
    document.getElementById('rear-compression').value = previousSession.rear_compression || '';
    document.getElementById('rear-rebound').value = previousSession.rear_rebound || '';
    
    // Populate geometry
    document.getElementById('front-ride-height').value = previousSession.front_ride_height || '';
    document.getElementById('rear-ride-height').value = previousSession.rear_ride_height || '';
    document.getElementById('front-sag').value = previousSession.front_sag || '';
    document.getElementById('rear-sag').value = previousSession.rear_sag || '';
    document.getElementById('swingarm-angle').value = previousSession.swingarm_angle || '';
    
    // Populate drivetrain
    document.getElementById('front-sprocket').value = previousSession.front_sprocket || '';
    document.getElementById('rear-sprocket').value = previousSession.rear_sprocket || '';
    document.getElementById('swingarm-length').value = previousSession.swingarm_length || '';
    
    // Populate tires and pressures
    document.getElementById('front-tire').value = previousSession.front_tire || '';
    document.getElementById('rear-tire').value = previousSession.rear_tire || '';
    document.getElementById('front-pressure').value = previousSession.front_pressure || '';
    document.getElementById('rear-pressure').value = previousSession.rear_pressure || '';
    document.getElementById('rake').value = previousSession.rake || '';
    document.getElementById('trail').value = previousSession.trail || '';
    
    alert('Previous track data loaded! You can now adjust from your last known good setup.');
}
