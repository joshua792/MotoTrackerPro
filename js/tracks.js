// Track-related functionality

// Load track map based on selected event
async function loadTrackMap(eventId) {
    const container = document.getElementById('track-map-container');

    if (!eventId) {
        container.innerHTML = '<div class="track-map-placeholder"><p>Select an event to view track map</p></div>';
        return;
    }

    try {
        // Use the global events array instead of making another API call
        const event = events.find(e => e.id === eventId);

        if (!event) {
            container.innerHTML = '<div class="track-map-placeholder"><p>Event not found</p></div>';
            return;
        }

        if (!event.track_id) {
            // If there's no track_id but there is a track name, show appropriate message
            if (event.track) {
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
                container.innerHTML = '<div class="track-map-placeholder"><p>No track assigned to this event</p></div>';
            }
            return;
        }

        // Show loading state
        container.innerHTML = '<div class="track-map-placeholder"><p>Loading track map...</p></div>';

        // Get track details - use global tracks array if available, otherwise API call
        let tracks;
        if (window.tracks && window.tracks.length > 0) {
            tracks = window.tracks;
        } else {
            const tracksResponse = await apiCall('get-tracks');
            if (!tracksResponse.success) {
                throw new Error('Failed to load tracks');
            }
            tracks = tracksResponse.tracks;
        }

        const track = tracks.find(t => t.id === event.track_id);

        if (!track) {
            container.innerHTML = '<div class="track-map-placeholder"><p>Track not found for ID: ' + event.track_id + '</p></div>';
            return;
        }

        // Build track layout with image first, then info below
        let trackContentHtml = '';

        // Check if track has a map
        if (track.track_map_filename) {
            // Show image loading placeholder first
            container.innerHTML = `
                <div style="display: flex; flex-direction: column; height: 100%;">
                    <div id="track-map-loading" style="flex: 1; display: flex; align-items: center; justify-content: center;">
                        <p>Loading track map...</p>
                    </div>
                </div>
            `;

            // Fetch the image with authentication
            try {
                const response = await fetch(`/api/get-track-map?trackId=${track.id}`, {
                    method: 'GET',
                    headers: getAuthHeaders()
                });

                if (response.ok) {
                    const blob = await response.blob();
                    const imageUrl = URL.createObjectURL(blob);

                    // Build the complete layout with image on top and info below
                    container.innerHTML = `
                        <div style="display: flex; flex-direction: column; height: 100%;">
                            <div style="flex: 1; display: flex; align-items: center; justify-content: center; margin-bottom: 10px; max-height: calc(100% - 80px);">
                                <div style="text-align: center; cursor: pointer; max-height: 100%;" onclick="openTrackMapModal('${imageUrl}', '${track.name.replace(/'/g, '\\\'')}')" title="Click to view full-size track map">
                                    <img src="${imageUrl}"
                                         alt="Track map for ${track.name}"
                                         style="max-width: 100%; max-height: 250px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">
                                    <div style="color: #666; font-size: 10px; margin-top: 2px;">
                                        🔍 Click to view full-size
                                    </div>
                                </div>
                            </div>
                            <div style="border-top: 1px solid #eee; padding-top: 8px; flex-shrink: 0; min-height: 70px;">
                                <div style="font-weight: bold; font-size: 13px; color: #2c5aa0; margin-bottom: 2px;">
                                    ${track.name}
                                </div>
                                <div style="color: #666; font-size: 11px; margin-bottom: 2px;">
                                    📍 ${track.location}${track.country ? ', ' + track.country : ''}
                                </div>
                                ${track.description ? `<div style="color: #666; font-size: 10px; margin-bottom: 2px; line-height: 1.2;">${track.description}</div>` : ''}
                                <div style="color: #666; font-size: 10px; line-height: 1.2;">
                                    ${track.length_miles ? `${track.length_miles} mi` : ''}
                                    ${track.length_km ? ` (${track.length_km} km)` : ''}
                                    ${track.turns ? ` • ${track.turns} turns` : ''}
                                    ${track.direction ? ` • ${track.direction}` : ''}
                                </div>
                            </div>
                        </div>
                    `;
                } else {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            } catch (imageError) {
                console.error('Error loading track map image:', imageError);
                container.innerHTML = `
                    <div class="track-map-placeholder">
                        <p style="color: #d63384;">Error loading track map</p>
                        <small>${imageError.message}</small>
                    </div>
                `;
            }
            return; // Early return since we've already set the HTML
        } else {
            // No track map available - show track info only
            container.innerHTML = `
                <div style="display: flex; flex-direction: column; height: 100%; justify-content: center;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <div style="font-weight: bold; font-size: 16px; color: #2c5aa0; margin-bottom: 8px;">
                            ${track.name}
                        </div>
                        <div style="color: #666; font-size: 14px; margin-bottom: 8px;">
                            📍 ${track.location}${track.country ? ', ' + track.country : ''}
                        </div>
                        ${track.description ? `<div style="color: #666; font-size: 12px; margin-bottom: 8px;">${track.description}</div>` : ''}
                        <div style="color: #666; font-size: 12px;">
                            ${track.length_miles ? `Length: ${track.length_miles} mi` : ''}
                            ${track.length_km ? ` (${track.length_km} km)` : ''}
                            ${track.turns ? ` • ${track.turns} turns` : ''}
                            ${track.direction ? ` • ${track.direction}` : ''}
                        </div>
                    </div>
                    <div class="track-map-placeholder" style="flex: 1;">
                        <p>No track map available</p>
                    </div>
                </div>
            `;
        }

    } catch (error) {
        console.error('Error loading track map:', error);
        container.innerHTML = '<div class="track-map-placeholder"><p style="color: #d63384;">Error loading track information</p></div>';
    }
}

// Open track map in full-size modal
function openTrackMapModal(imageUrl, trackName) {

    // Create modal if it doesn't exist
    let modal = document.getElementById('track-map-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'track-map-modal';
        modal.style.cssText = `
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.8);
            cursor: pointer;
        `;

        modal.innerHTML = `
            <div style="position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
                <div style="position: absolute; top: 20px; right: 30px; color: white; font-size: 28px; font-weight: bold; cursor: pointer; z-index: 1001;" onclick="closeTrackMapModal()">
                    ×
                </div>
                <div style="position: absolute; top: 20px; left: 30px; color: white; font-size: 18px; font-weight: bold; z-index: 1001;" id="modal-track-name">
                </div>
                <img id="modal-track-image" style="max-width: 95%; max-height: 95%; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);" onclick="event.stopPropagation()">
                <div style="position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); color: white; font-size: 14px; text-align: center;">
                    Click outside image or X to close
                </div>
            </div>
        `;

        // Close modal when clicking outside the image
        modal.onclick = closeTrackMapModal;

        document.body.appendChild(modal);
    }

    // Update modal content
    document.getElementById('modal-track-name').textContent = trackName;
    document.getElementById('modal-track-image').src = imageUrl;
    document.getElementById('modal-track-image').alt = `Full-size track map for ${trackName}`;

    // Show modal
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

// Close track map modal
function closeTrackMapModal() {
    const modal = document.getElementById('track-map-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = ''; // Restore scrolling
    }
}

// Update event dropdown to show track information
function updateEventDropdown() {
    // This function is called from app.js when events are loaded
    // We can enhance it to show track information in the dropdown
}