// Track-related functionality

// Load track map based on selected event
async function loadTrackMap(eventId) {
    console.log('🏁 START: loadTrackMap called with eventId:', eventId);
    const container = document.getElementById('track-map-container');

    if (!eventId) {
        console.log('❌ No eventId provided, showing placeholder');
        container.innerHTML = '<div class="track-map-placeholder"><p>Select an event to view track map</p></div>';
        return;
    }

    try {
        console.log('✅ STEP 1: Starting track map loading process for event:', eventId);

        // Use the global events array instead of making another API call
        console.log('🔍 STEP 2: Searching for event in global events array, events.length:', events?.length);
        const event = events.find(e => e.id === eventId);
        console.log('📝 STEP 2 RESULT: Found event:', event ? `${event.name} (track: ${event.track}, track_id: ${event.track_id})` : 'null');

        if (!event) {
            console.log('❌ STEP 2 FAILED: Event not found in events array');
            container.innerHTML = '<div class="track-map-placeholder"><p>Event not found</p></div>';
            return;
        }

        console.log('🔍 STEP 3: Checking event.track_id:', event.track_id);
        if (!event.track_id) {
            console.log('⚠️ STEP 3: No track_id found for event, checking for track name:', event.track);
            // If there's no track_id but there is a track name, show appropriate message
            if (event.track) {
                console.log('📝 STEP 3: Event has track name but no track_id, showing migration message');
                container.innerHTML = `
                    <div class="track-map-placeholder">
                        <h4 style="margin-bottom: 10px; color: #2c5aa0;">${event.track}</h4>
                        <p>This event needs to be updated to use the new track system</p>
                        <small style="color: #666; display: block; margin-top: 10px;">
                            Edit this event and select a track from the dropdown to enable track maps.
                        </small>
                    </div>
                `;
            } else {
                console.log('❌ STEP 3: No track or track_id found');
                container.innerHTML = '<div class="track-map-placeholder"><p>No track assigned to this event</p></div>';
            }
            return;
        }

        console.log('✅ STEP 3 PASSED: Event has track_id:', event.track_id);

        // Show loading state
        console.log('🔄 STEP 4: Showing loading state');
        container.innerHTML = '<div class="track-map-placeholder"><p>Loading track map...</p></div>';

        // Get track details - use global tracks array if available, otherwise API call
        console.log('🔍 STEP 5: Checking for global tracks array');
        let tracks;
        if (window.tracks && window.tracks.length > 0) {
            tracks = window.tracks;
            console.log('✅ STEP 5: Using global tracks array, tracks.length:', tracks.length);
        } else {
            console.log('⚠️ STEP 5: Global tracks not available, making API call');
            const tracksResponse = await apiCall('get-tracks');
            if (!tracksResponse.success) {
                console.log('❌ STEP 5 FAILED: API call to get-tracks failed');
                throw new Error('Failed to load tracks');
            }
            tracks = tracksResponse.tracks;
            console.log('✅ STEP 5: API call successful, tracks.length:', tracks.length);
        }

        console.log('🔍 STEP 6: Searching for track with ID:', event.track_id);
        const track = tracks.find(t => t.id === event.track_id);
        console.log('📝 STEP 6 RESULT: Found track:', track ? `${track.name} (has map: ${!!track.track_map_filename})` : 'null');

        if (!track) {
            console.log('❌ STEP 6 FAILED: Track not found for ID:', event.track_id);
            container.innerHTML = '<div class="track-map-placeholder"><p>Track not found for ID: ' + event.track_id + '</p></div>';
            return;
        }

        console.log('✅ STEP 6 PASSED: Track found, building track info HTML');

        // Build track info HTML
        console.log('🔧 STEP 7: Building track info HTML');
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

        console.log('🔍 STEP 8: Checking if track has map file, track_map_filename:', track.track_map_filename);
        // Check if track has a map
        if (track.track_map_filename) {
            console.log('✅ STEP 8: Track has map file:', track.track_map_filename);

            // Show loading placeholder for the image
            console.log('🔧 STEP 9: Adding loading placeholder to HTML');
            trackInfoHtml += '<div id="track-map-loading" style="text-align: center; padding: 20px;"><p>Loading track map...</p></div>';

            // Set the HTML first, then load the image
            console.log('🔧 STEP 10: Setting HTML content with loading placeholder');
            container.innerHTML = trackInfoHtml;

            // Fetch the image with authentication
            console.log('🌐 STEP 11: Starting fetch for track map image, URL: /api/get-track-map?trackId=' + track.id);
            try {
                const response = await fetch(`/api/get-track-map?trackId=${track.id}`, {
                    method: 'GET',
                    headers: getAuthHeaders()
                });

                console.log('🌐 STEP 11 RESULT: Fetch response status:', response.status, response.statusText);

                if (response.ok) {
                    console.log('✅ STEP 11 PASSED: Fetch successful, converting to blob');
                    const blob = await response.blob();
                    console.log('✅ STEP 12: Blob created, size:', blob.size, 'bytes, type:', blob.type);
                    const imageUrl = URL.createObjectURL(blob);
                    console.log('✅ STEP 13: Object URL created:', imageUrl);

                    // Replace the loading placeholder with the actual image
                    const loadingDiv = document.getElementById('track-map-loading');
                    console.log('🔍 STEP 14: Looking for loading div, found:', !!loadingDiv);
                    if (loadingDiv) {
                        loadingDiv.innerHTML = `
                            <img src="${imageUrl}"
                                 alt="Track map for ${track.name}"
                                 style="max-width: 100%; max-height: 400px; border: 1px solid #ddd; border-radius: 4px;">
                        `;
                        console.log('✅ STEP 14 PASSED: Image HTML set in loading div');
                    }
                    console.log('🎉 SUCCESS: Track map loaded successfully for', track.name);
                } else {
                    console.log('❌ STEP 11 FAILED: Fetch response not ok:', response.status, response.statusText);
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            } catch (imageError) {
                console.error('❌ STEP 11+ FAILED: Error loading track map image:', imageError);
                const loadingDiv = document.getElementById('track-map-loading');
                if (loadingDiv) {
                    console.log('🔧 Setting error message in loading div');
                    loadingDiv.innerHTML = '<p style="color: #d63384;">Error loading track map: ' + imageError.message + '</p>';
                }
            }
            console.log('✅ EARLY RETURN: Track with map processing complete');
            return; // Early return since we've already set the HTML
        } else {
            console.log('⚠️ STEP 8: Track has no map file, showing no map message');
            trackInfoHtml += '<div class="track-map-placeholder"><p>No track map available</p></div>';
        }

        console.log('🔧 FINAL STEP: Setting container HTML for track without map');
        container.innerHTML = trackInfoHtml;
        console.log('🎉 SUCCESS: Track info displayed (no map) for', track.name);

    } catch (error) {
        console.error('💥 FATAL ERROR: Error loading track map:', error);
        container.innerHTML = '<div class="track-map-placeholder"><p style="color: #d63384;">Error loading track information</p></div>';
    }
}

// Update event dropdown to show track information
function updateEventDropdown() {
    // This function is called from app.js when events are loaded
    // We can enhance it to show track information in the dropdown
}