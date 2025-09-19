// Track-related functionality

// Load track map based on selected event
async function loadTrackMap(eventId) {
    const container = document.getElementById('track-map-container');

    if (!eventId) {
        container.innerHTML = '<div class="track-map-placeholder"><p>Select an event to view track map</p></div>';
        return;
    }

    try {
        // Get the event details to find the track_id
        const eventsResponse = await apiCall('get-events');
        if (!eventsResponse.success) {
            throw new Error('Failed to load events');
        }

        const event = eventsResponse.events.find(e => e.id === eventId);
        if (!event || !event.track_id) {
            container.innerHTML = '<div class="track-map-placeholder"><p>No track map available for this event</p></div>';
            return;
        }

        // Show loading state
        container.innerHTML = '<div class="track-map-placeholder"><p>Loading track map...</p></div>';

        // Get track details
        const tracksResponse = await apiCall('get-tracks');
        if (!tracksResponse.success) {
            throw new Error('Failed to load tracks');
        }

        const track = tracksResponse.tracks.find(t => t.id === event.track_id);
        if (!track) {
            container.innerHTML = '<div class="track-map-placeholder"><p>Track not found</p></div>';
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
            const mapUrl = `/api/get-track-map?trackId=${track.id}`;
            trackInfoHtml += `
                <div style="text-align: center;">
                    <img src="${mapUrl}"
                         alt="Track map for ${track.name}"
                         style="max-width: 100%; max-height: 400px; border: 1px solid #ddd; border-radius: 4px;"
                         onerror="this.parentElement.innerHTML='<p style=\\"color: #d63384;\\">Error loading track map</p>';">
                </div>
            `;
        } else {
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