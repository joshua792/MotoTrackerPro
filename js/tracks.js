// Track-related functionality

// Load track map based on selected event
async function loadTrackMap(eventId) {
    const container = document.getElementById('track-map-container');

    if (!eventId) {
        container.innerHTML = '<div class="track-map-placeholder"><p>Select an event to view track map</p></div>';
        return;
    }

    try {
        console.log('Loading track map for event:', eventId); // Debug log

        // Get the event details to find the track_id
        const eventsResponse = await apiCall('get-events');
        if (!eventsResponse.success) {
            throw new Error('Failed to load events');
        }

        console.log('Events response:', eventsResponse); // Debug log

        const event = eventsResponse.events.find(e => e.id === eventId);
        console.log('Found event:', event); // Debug log

        if (!event) {
            container.innerHTML = '<div class="track-map-placeholder"><p>Event not found</p></div>';
            return;
        }

        if (!event.track_id) {
            container.innerHTML = '<div class="track-map-placeholder"><p>No track assigned to this event (track_id missing)</p></div>';
            return;
        }

        // Show loading state
        container.innerHTML = '<div class="track-map-placeholder"><p>Loading track map...</p></div>';

        // Get track details
        const tracksResponse = await apiCall('get-tracks');
        if (!tracksResponse.success) {
            throw new Error('Failed to load tracks');
        }

        console.log('Tracks response:', tracksResponse); // Debug log

        const track = tracksResponse.tracks.find(t => t.id === event.track_id);
        console.log('Found track:', track); // Debug log

        if (!track) {
            container.innerHTML = '<div class="track-map-placeholder"><p>Track not found for ID: ' + event.track_id + '</p></div>';
            return;
        }

        // Build track info HTML
        let trackInfoHtml = `
            <div style="border-bottom: 1px solid #ddd; padding-bottom: 10px; margin-bottom: 15px;">
                <div style="font-weight: bold; font-size: 16px; color: #2c5aa0; margin-bottom: 5px;">
                    ${track.name}
                </div>
                <div style="color: #666; font-size: 14px; margin-bottom: 5px;">
                    📍 ${track.location}${track.country ? ', ' + track.country : ''}
                </div>
                ${track.description ? `<div style="color: #666; font-size: 12px; margin-bottom: 5px;">${track.description}</div>` : ''}
                <div style="color: #666; font-size: 12px;">
                    ${track.length_miles ? `Length: ${track.length_miles} mi` : ''}
                    ${track.length_km ? ` (${track.length_km} km)` : ''}
                    ${track.turns ? ` • ${track.turns} turns` : ''}
                    ${track.direction ? ` • ${track.direction}` : ''}
                </div>
            </div>
        `;

        // Check if track has a map
        if (track.track_map_filename) {
            console.log('Track has map file:', track.track_map_filename); // Debug log

            // Show loading placeholder for the image
            trackInfoHtml += '<div id="track-map-loading" style="text-align: center; padding: 20px;"><p>Loading track map...</p></div>';

            // Set the HTML first, then load the image
            container.innerHTML = trackInfoHtml;

            // Fetch the image with authentication
            try {
                const response = await fetch(`/api/get-track-map?trackId=${track.id}`, {
                    method: 'GET',
                    headers: getAuthHeaders()
                });

                if (response.ok) {
                    const blob = await response.blob();
                    const imageUrl = URL.createObjectURL(blob);

                    // Replace the loading placeholder with the actual image
                    const loadingDiv = document.getElementById('track-map-loading');
                    if (loadingDiv) {
                        loadingDiv.innerHTML = `
                            <img src="${imageUrl}"
                                 alt="Track map for ${track.name}"
                                 style="max-width: 100%; max-height: 400px; border: 1px solid #ddd; border-radius: 4px;">
                        `;
                    }
                    console.log('Track map loaded successfully'); // Debug log
                } else {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            } catch (imageError) {
                console.error('Error loading track map image:', imageError);
                const loadingDiv = document.getElementById('track-map-loading');
                if (loadingDiv) {
                    loadingDiv.innerHTML = '<p style="color: #d63384;">Error loading track map: ' + imageError.message + '</p>';
                }
            }
            return; // Early return since we've already set the HTML
        } else {
            console.log('Track has no map file'); // Debug log
            trackInfoHtml += '<div class="track-map-placeholder"><p>No track map available</p></div>';
        }

        container.innerHTML = trackInfoHtml;

    } catch (error) {
        console.error('Error loading track map:', error);
        container.innerHTML = '<div class="track-map-placeholder"><p style="color: #d63384;">Error loading track information</p></div>';
    }
}

// Update event dropdown to show track information
function updateEventDropdown() {
    // This function is called from app.js when events are loaded
    // We can enhance it to show track information in the dropdown
}