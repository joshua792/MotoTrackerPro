// js/race-series.js - Race series management functions

let raceSeriesData = [];
let editingRaceSeriesId = null;

// Load race series from API
async function loadRaceSeries() {
    try {
        const response = await apiCall('get-race-series');
        if (response.success) {
            raceSeriesData = response.raceSeries;
            updateEventSeriesDropdown();
            return raceSeriesData;
        } else {
            console.error('Failed to load race series:', response.error);
            return [];
        }
    } catch (error) {
        console.error('Error loading race series:', error);
        return [];
    }
}

// Update the event series dropdown
function updateEventSeriesDropdown() {
    const seriesSelect = document.getElementById('event-series');
    if (!seriesSelect) return;

    const currentValue = seriesSelect.value;
    seriesSelect.innerHTML = '<option value="">Select Series...</option>';

    raceSeriesData.forEach(series => {
        if (series.is_active) {
            const option = document.createElement('option');
            option.value = series.name;
            option.textContent = series.name;
            seriesSelect.appendChild(option);
        }
    });

    // Restore previous selection if it still exists
    if (currentValue && Array.from(seriesSelect.options).some(opt => opt.value === currentValue)) {
        seriesSelect.value = currentValue;
    }
}

// Show race series modal for adding/editing
function showAddRaceSeriesModal(seriesId = null) {
    editingRaceSeriesId = seriesId;

    const modal = document.getElementById('race-series-modal');
    const title = document.getElementById('race-series-modal-title');
    const saveBtn = document.getElementById('save-race-series-btn');

    if (seriesId) {
        // Editing existing series
        const series = raceSeriesData.find(s => s.id === seriesId);
        if (series) {
            title.textContent = 'Edit Race Series';
            saveBtn.textContent = 'Update Race Series';

            document.getElementById('race-series-name').value = series.name;
            document.getElementById('race-series-description').value = series.description || '';
            document.getElementById('race-series-website').value = series.website || '';
            document.getElementById('race-series-active').checked = series.is_active;
        }
    } else {
        // Adding new series
        title.textContent = 'Add New Race Series';
        saveBtn.textContent = 'Add Race Series';
        clearRaceSeriesForm();
    }

    modal.style.display = 'block';
}

// Close race series modal
function closeRaceSeriesModal() {
    document.getElementById('race-series-modal').style.display = 'none';
    clearRaceSeriesForm();
    editingRaceSeriesId = null;
}

// Clear race series form
function clearRaceSeriesForm() {
    document.getElementById('race-series-name').value = '';
    document.getElementById('race-series-description').value = '';
    document.getElementById('race-series-website').value = '';
    document.getElementById('race-series-active').checked = true;
}

// Save race series
async function saveRaceSeries() {
    const name = document.getElementById('race-series-name').value.trim();
    const description = document.getElementById('race-series-description').value.trim();
    const website = document.getElementById('race-series-website').value.trim();
    const isActive = document.getElementById('race-series-active').checked;

    if (!name) {
        alert('Race series name is required');
        return;
    }

    const saveBtn = document.getElementById('save-race-series-btn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;

    try {
        const seriesData = {
            name,
            description: description || null,
            website: website || null,
            is_active: isActive
        };

        if (editingRaceSeriesId) {
            seriesData.id = editingRaceSeriesId;
        }

        const response = await apiCall('save-race-series', {
            method: 'POST',
            body: JSON.stringify(seriesData)
        });

        if (response.success) {
            closeRaceSeriesModal();
            await loadRaceSeries(); // Reload the list
            loadRaceSeriesList(); // Update admin list if visible
            alert(response.message);
        } else {
            alert('Error: ' + response.error);
        }
    } catch (error) {
        console.error('Error saving race series:', error);
        alert('Error saving race series: ' + error.message);
    } finally {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
    }
}

// Load race series list for admin panel
async function loadRaceSeriesList() {
    const listContainer = document.getElementById('race-series-list');
    if (!listContainer) return;

    listContainer.innerHTML = '<p>Loading race series...</p>';

    try {
        const response = await apiCall('get-race-series');

        if (response.success) {
            const allSeries = response.raceSeries;

            if (allSeries.length === 0) {
                listContainer.innerHTML = '<p>No race series found.</p>';
                return;
            }

            let html = '<div style="display: grid; gap: 10px;">';

            allSeries.forEach(series => {
                const statusClass = series.is_active ? 'text-success' : 'text-muted';
                const statusText = series.is_active ? 'Active' : 'Inactive';

                html += `
                    <div style="border: 1px solid #ddd; border-radius: 4px; padding: 10px; background: ${series.is_active ? '#fff' : '#f8f9fa'};">
                        <div style="display: flex; justify-content: space-between; align-items: start;">
                            <div style="flex: 1;">
                                <div style="font-weight: bold; margin-bottom: 4px;">
                                    ${series.name}
                                    <span style="font-size: 12px; color: ${series.is_active ? '#28a745' : '#6c757d'}; margin-left: 8px;">
                                        ${statusText}
                                    </span>
                                </div>
                                ${series.description ? `<div style="font-size: 13px; color: #666; margin-bottom: 4px;">${series.description}</div>` : ''}
                                ${series.website ? `<div style="font-size: 12px;"><a href="${series.website}" target="_blank" style="color: #2c5aa0;">${series.website}</a></div>` : ''}
                                <div style="font-size: 11px; color: #999; margin-top: 4px;">
                                    Created: ${new Date(series.created_at).toLocaleDateString()}
                                </div>
                            </div>
                            <div style="display: flex; gap: 5px; margin-left: 10px;">
                                <button class="btn btn-small btn-secondary" onclick="showAddRaceSeriesModal(${series.id})" title="Edit">
                                    ✏️
                                </button>
                                <button class="btn btn-small btn-danger" onclick="deleteRaceSeries(${series.id}, '${series.name.replace(/'/g, '\\\'')}')" title="Delete">
                                    🗑️
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });

            html += '</div>';
            listContainer.innerHTML = html;
        } else {
            listContainer.innerHTML = '<p style="color: #d63384;">Error loading race series: ' + response.error + '</p>';
        }
    } catch (error) {
        console.error('Error loading race series list:', error);
        listContainer.innerHTML = '<p style="color: #d63384;">Error loading race series</p>';
    }
}

// Delete race series
async function deleteRaceSeries(seriesId, seriesName) {
    if (!confirm(`Are you sure you want to delete "${seriesName}"?\n\nNote: If this race series is used by existing events, it will be deactivated instead of deleted.`)) {
        return;
    }

    try {
        const response = await apiCall(`delete-race-series?id=${seriesId}`, {
            method: 'DELETE'
        });

        if (response.success) {
            alert(response.message);
            await loadRaceSeries(); // Reload the dropdown
            loadRaceSeriesList(); // Update admin list
        } else {
            alert('Error: ' + response.error);
        }
    } catch (error) {
        console.error('Error deleting race series:', error);
        alert('Error deleting race series: ' + error.message);
    }
}

// Show admin section for race series
function showAdminRaceSeriesSection() {
    // Hide other admin sections
    document.getElementById('admin-users-section').style.display = 'none';
    document.getElementById('admin-tracks-section').style.display = 'none';
    document.getElementById('admin-series-section').style.display = 'block';

    // Update tab styles
    document.getElementById('admin-users-tab').classList.remove('active');
    document.getElementById('admin-tracks-tab').classList.remove('active');
    document.getElementById('admin-series-tab').classList.add('active');

    // Load race series list
    loadRaceSeriesList();
}

// Initialize race series on page load
window.addEventListener('DOMContentLoaded', () => {
    loadRaceSeries();
});