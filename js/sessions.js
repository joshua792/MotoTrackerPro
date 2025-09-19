// js/sessions.js - Session data management

// Save current session data
function saveCurrentSession() {
    if (!currentMotorcycle || !currentEvent) return;

    const eventId = currentEvent?.id || currentEvent;
    const sessionKey = `${eventId}_${currentMotorcycle.id}_${currentSession}`;
    
    sessionData[sessionKey] = {
        // Suspension data
        frontSpring: document.getElementById('front-spring').value || '',
        frontPreload: document.getElementById('front-preload').value || '',
        frontCompression: document.getElementById('front-compression').value || '',
        frontRebound: document.getElementById('front-rebound').value || '',
        rearSpring: document.getElementById('rear-spring').value || '',
        rearPreload: document.getElementById('rear-preload').value || '',
        rearCompression: document.getElementById('rear-compression').value || '',
        rearRebound: document.getElementById('rear-rebound').value || '',
        
        // Geometry data
        frontRideHeight: document.getElementById('front-ride-height').value || '',
        rearRideHeight: document.getElementById('rear-ride-height').value || '',
        frontSag: document.getElementById('front-sag').value || '',
        rearSag: document.getElementById('rear-sag').value || '',
        swingarmAngle: document.getElementById('swingarm-angle').value || '',
        
        // Gearing data
        frontSprocket: document.getElementById('front-sprocket').value || '',
        rearSprocket: document.getElementById('rear-sprocket').value || '',
        swingarmLength: document.getElementById('swingarm-length').value || '',
        
        // Tire and geometry data
        frontTire: document.getElementById('front-tire').value || '',
        rearTire: document.getElementById('rear-tire').value || '',
        frontPressure: document.getElementById('front-pressure').value || '',
        rearPressure: document.getElementById('rear-pressure').value || '',
        rake: document.getElementById('rake').value || '',
        trail: document.getElementById('trail').value || '',
        
        // Weather data
        weatherTemperature: currentWeatherData ? currentWeatherData.temperature.toString() : '',
        weatherCondition: currentWeatherData ? currentWeatherData.conditions : '',
        weatherDescription: currentWeatherData ? currentWeatherData.description : '',
        weatherHumidity: currentWeatherData ? currentWeatherData.humidity.toString() : '',
        weatherWindSpeed: currentWeatherData ? currentWeatherData.windSpeed.toString() : '',
        weatherCapturedAt: currentWeatherData ? currentWeatherData.timestamp : '',
        
        // Notes and feedback
        notes: document.getElementById('notes').value || '',
        feedback: document.getElementById('feedback').value || '',
        
        // Metadata
        timestamp: new Date().toISOString(),
        session: currentSession,
        event: currentEvent,
        motorcycle: currentMotorcycle
    };
}

// Load session data from database
async function loadSessionData() {
    if (!currentMotorcycle || !currentEvent) return;

    try {
        const eventId = currentEvent.id || currentEvent; // Handle both object and string
        const response = await apiCall(`get-sessions?event_id=${eventId}&motorcycle_id=${currentMotorcycle.id}`);
        const sessions = response.sessions || [];

        // Convert database format back to our sessionData format
        sessionData = {};
        sessions.forEach(session => {
            const sessionKey = `${session.event_id}_${session.motorcycle_id}_${session.session_type}`;
            sessionData[sessionKey] = {
                frontSpring: session.front_spring,
                frontPreload: session.front_preload,
                frontCompression: session.front_compression,
                frontRebound: session.front_rebound,
                rearSpring: session.rear_spring,
                rearPreload: session.rear_preload,
                rearCompression: session.rear_compression,
                rearRebound: session.rear_rebound,
                frontRideHeight: session.front_ride_height,
                rearRideHeight: session.rear_ride_height,
                frontSag: session.front_sag,
                rearSag: session.rear_sag,
                swingarmAngle: session.swingarm_angle,
                frontSprocket: session.front_sprocket,
                rearSprocket: session.rear_sprocket,
                swingarmLength: session.swingarm_length,
                frontTire: session.front_tire,
                rearTire: session.rear_tire,
                frontPressure: session.front_pressure,
                rearPressure: session.rear_pressure,
                rake: session.rake,
                trail: session.trail,
                notes: session.notes,
                feedback: session.feedback,
                timestamp: session.updated_at,
                session: session.session_type,
                event: session.event_id,
                motorcycle: currentMotorcycle
            };
        });

        loadCurrentSessionFromData();
    } catch (error) {
        console.error('Error loading session data:', error);
        clearAllFields();
    }
}

// Load current session from sessionData
function loadCurrentSessionFromData() {
    const eventId = currentEvent?.id || currentEvent;
    const sessionKey = `${eventId}_${currentMotorcycle.id}_${currentSession}`;
    const data = sessionData[sessionKey];

    if (data) {
        // Load suspension data
        document.getElementById('front-spring').value = data.frontSpring || '';
        document.getElementById('front-preload').value = data.frontPreload || '';
        document.getElementById('front-compression').value = data.frontCompression || '';
        document.getElementById('front-rebound').value = data.frontRebound || '';
        document.getElementById('rear-spring').value = data.rearSpring || '';
        document.getElementById('rear-preload').value = data.rearPreload || '';
        document.getElementById('rear-compression').value = data.rearCompression || '';
        document.getElementById('rear-rebound').value = data.rearRebound || '';
        
        // Load geometry data
        document.getElementById('front-ride-height').value = data.frontRideHeight || '';
        document.getElementById('rear-ride-height').value = data.rearRideHeight || '';
        document.getElementById('front-sag').value = data.frontSag || '';
        document.getElementById('rear-sag').value = data.rearSag || '';
        document.getElementById('swingarm-angle').value = data.swingarmAngle || '';
        
        // Load gearing data
        document.getElementById('front-sprocket').value = data.frontSprocket || '';
        document.getElementById('rear-sprocket').value = data.rearSprocket || '';
        document.getElementById('swingarm-length').value = data.swingarmLength || '';
        
        // Load tire and geometry data
        document.getElementById('front-tire').value = data.frontTire || '';
        document.getElementById('rear-tire').value = data.rearTire || '';
        document.getElementById('front-pressure').value = data.frontPressure || '';
        document.getElementById('rear-pressure').value = data.rearPressure || '';
        document.getElementById('rake').value = data.rake || '';
        document.getElementById('trail').value = data.trail || '';
        
        // Load notes and feedback
        document.getElementById('notes').value = data.notes || '';
        document.getElementById('feedback').value = data.feedback || '';
    } else {
        clearAllFields();
    }
}

// Save session to database
async function saveSession() {
    saveCurrentSession();
    
    if (!currentMotorcycle || !currentEvent) {
        alert('Please select both an event and motorcycle before saving.');
        return;
    }

    const eventId = currentEvent?.id || currentEvent;
    const sessionKey = `${eventId}_${currentMotorcycle.id}_${currentSession}`;
    const sessionDataToSave = sessionData[sessionKey];

    if (!sessionDataToSave) {
        alert('No session data to save.');
        return;
    }

    try {
        await apiCall('save-session', {
            method: 'POST',
            body: JSON.stringify(sessionDataToSave)
        });

        showSaveConfirmation();
    } catch (error) {
        console.error('Error saving session:', error);
        alert('Error saving session. Please try again.');
    }
}

// Copy from previous session
function copyFromPrevious() {
    const sessions = ['practice1', 'qualifying1', 'qualifying2', 'race1', 'warmup', 'race2'];
    const currentIndex = sessions.indexOf(currentSession);
    
    if (currentIndex > 0) {
        const previousSession = sessions[currentIndex - 1];
        const previousKey = `${currentEvent}_${currentMotorcycle.id}_${previousSession}`;
        const previousData = sessionData[previousKey];
        
        if (previousData) {
            // Copy all setup data but not notes/feedback
            document.getElementById('front-spring').value = previousData.frontSpring || '';
            document.getElementById('front-preload').value = previousData.frontPreload || '';
            document.getElementById('front-compression').value = previousData.frontCompression || '';
            document.getElementById('front-rebound').value = previousData.frontRebound || '';
            document.getElementById('rear-spring').value = previousData.rearSpring || '';
            document.getElementById('rear-preload').value = previousData.rearPreload || '';
            document.getElementById('rear-compression').value = previousData.rearCompression || '';
            document.getElementById('rear-rebound').value = previousData.rearRebound || '';
            
            // Copy geometry data
            document.getElementById('front-ride-height').value = previousData.frontRideHeight || '';
            document.getElementById('rear-ride-height').value = previousData.rearRideHeight || '';
            document.getElementById('front-sag').value = previousData.frontSag || '';
            document.getElementById('rear-sag').value = previousData.rearSag || '';
            document.getElementById('swingarm-angle').value = previousData.swingarmAngle || '';
            
            document.getElementById('front-sprocket').value = previousData.frontSprocket || '';
            document.getElementById('rear-sprocket').value = previousData.rearSprocket || '';
            document.getElementById('swingarm-length').value = previousData.swingarmLength || '';
            document.getElementById('front-tire').value = previousData.frontTire || '';
            document.getElementById('rear-tire').value = previousData.rearTire || '';
            document.getElementById('front-pressure').value = previousData.frontPressure || '';
            document.getElementById('rear-pressure').value = previousData.rearPressure || '';
            document.getElementById('rake').value = previousData.rake || '';
            document.getElementById('trail').value = previousData.trail || '';
            
            alert(`Settings copied from ${sessionNames[previousSession]}!`);
        } else {
            alert(`No data found for ${sessionNames[previousSession]}`);
        }
    } else {
        alert('No previous session to copy from!');
    }
}

// Clear session
function clearSession() {
    if (confirm('Are you sure you want to clear all data for this session?')) {
        clearAllFields();
    }
}
