// js/motorcycles.js - Motorcycle management functions

// Load motorcycles from database
async function loadMotorcycles() {
    try {
        const response = await apiCall('get-motorcycles');
        motorcycles = response.motorcycles || [];
        updateMotorcycleDisplay();
    } catch (error) {
        console.error('Error loading motorcycles:', error);
        motorcycles = [];
        updateMotorcycleDisplay();
    }
}

// Update motorcycle display with improved layout
function updateMotorcycleDisplay() {
    const container = document.getElementById('motorcycle-list');

    if (motorcycles.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No motorcycle selected</h3>
                <p>Go to Settings → Motorcycles to add and select a motorcycle</p>
            </div>
        `;
    } else if (currentMotorcycle) {
        container.innerHTML = `
            <div class="motorcycle-card active">
                <div class="motorcycle-number">#${currentMotorcycle.number}${currentMotorcycle.variant}</div>
                <div class="motorcycle-info">
                    <div class="motorcycle-make-model">${currentMotorcycle.make} ${currentMotorcycle.model}</div>
                    <div class="motorcycle-class">${currentMotorcycle.class}</div>
                </div>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No motorcycle selected</h3>
                <p>Go to Settings → Motorcycles to select a motorcycle</p>
            </div>
        `;
    }

    // Also update the settings list if it's visible
    const settingsContainer = document.getElementById('motorcycles-settings-list');
    if (settingsContainer && typeof displayMotorcyclesList === 'function') {
        displayMotorcyclesList();
    }
}

// Show add motorcycle modal
function showAddMotorcycleModal() {
    document.getElementById('motorcycle-modal').style.display = 'block';
}

// Close add motorcycle modal
function closeAddMotorcycleModal() {
    document.getElementById('motorcycle-modal').style.display = 'none';
    document.getElementById('motorcycle-modal').removeAttribute('data-editing-id');
    
    // Reset modal to add mode
    document.querySelector('#motorcycle-modal .modal-header').textContent = 'Add New Motorcycle';
    document.querySelector('#motorcycle-modal .btn-primary').textContent = 'Add Motorcycle';
    document.querySelector('#motorcycle-modal .btn-primary').setAttribute('onclick', 'addMotorcycle()');
    
    clearMotorcycleModalFields();
}

// Clear modal fields
function clearMotorcycleModalFields() {
    document.getElementById('new-make').value = '';
    document.getElementById('new-model').value = '';
    document.getElementById('new-class').value = '';
    document.getElementById('new-number').value = '';
    document.getElementById('new-variant').value = 'A';
}

// Add motorcycle
async function addMotorcycle() {
    const make = document.getElementById('new-make').value;
    const model = document.getElementById('new-model').value;
    const bikeClass = document.getElementById('new-class').value;
    const number = document.getElementById('new-number').value;
    const variant = document.getElementById('new-variant').value;

    if (!make || !model || !bikeClass || !number) {
        alert('Please fill in all required fields');
        return;
    }

    const motorcycle = {
        id: Date.now().toString(),
        make: make,
        model: model,
        class: bikeClass,
        number: number,
        variant: variant
    };

    try {
        await apiCall('save-motorcycle', {
            method: 'POST',
            body: JSON.stringify(motorcycle)
        });

        motorcycles.push(motorcycle);
        updateMotorcycleDisplay();
        closeAddMotorcycleModal();
    } catch (error) {
        console.error('Error saving motorcycle:', error);
        alert('Error saving motorcycle. Please try again.');
    }
}

// Select motorcycle (for internal use)
function selectMotorcycleInternal(motorcycleId) {
    currentMotorcycle = motorcycles.find(m => m.id === motorcycleId);
    updateMotorcycleDisplay();
    
    // Save state whenever motorcycle changes
    saveAppState();
    
    checkShowMainContent();
}

// Public function to select a motorcycle (used from settings)
function selectMotorcycle(motorcycleId) {
    selectMotorcycleInternal(motorcycleId);
}

// Handle motorcycle card clicks
function handleMotorcycleClick(motorcycleId) {
    // If this motorcycle is already selected, open for editing
    if (currentMotorcycle && currentMotorcycle.id === motorcycleId) {
        editMotorcycle(motorcycleId);
    } else {
        // If no motorcycle selected or different motorcycle, select this one
        selectMotorcycleInternal(motorcycleId);
    }
}

// Handle motorcycle double-click (always edit)
function handleMotorcycleDoubleClick(motorcycleId) {
    editMotorcycle(motorcycleId);
}

// Edit motorcycle (opens modal)
function editMotorcycle(motorcycleId) {
    const motorcycle = motorcycles.find(m => m.id === motorcycleId);
    if (!motorcycle) return;

    // Populate modal with existing data
    document.getElementById('new-make').value = motorcycle.make;
    document.getElementById('new-model').value = motorcycle.model;
    document.getElementById('new-class').value = motorcycle.class;
    document.getElementById('new-number').value = motorcycle.number;
    document.getElementById('new-variant').value = motorcycle.variant;

    // Store the ID for updating
    document.getElementById('motorcycle-modal').setAttribute('data-editing-id', motorcycleId);
    
    // Change modal title and button text
    document.querySelector('#motorcycle-modal .modal-header').textContent = 'Edit Motorcycle';
    document.querySelector('#motorcycle-modal .btn-primary').textContent = 'Update Motorcycle';
    document.querySelector('#motorcycle-modal .btn-primary').setAttribute('onclick', 'updateMotorcycle()');

    document.getElementById('motorcycle-modal').style.display = 'block';
}

// Update motorcycle
async function updateMotorcycle() {
    const motorcycleId = document.getElementById('motorcycle-modal').getAttribute('data-editing-id');
    const make = document.getElementById('new-make').value;
    const model = document.getElementById('new-model').value;
    const bikeClass = document.getElementById('new-class').value;
    const number = document.getElementById('new-number').value;
    const variant = document.getElementById('new-variant').value;

    if (!make || !model || !bikeClass || !number) {
        alert('Please fill in all required fields');
        return;
    }

    const updatedMotorcycle = {
        id: motorcycleId,
        make: make,
        model: model,
        class: bikeClass,
        number: number,
        variant: variant
    };

    try {
        await apiCall('save-motorcycle', {
            method: 'POST',
            body: JSON.stringify(updatedMotorcycle)
        });

        const motorcycleIndex = motorcycles.findIndex(m => m.id === motorcycleId);
        if (motorcycleIndex !== -1) {
            motorcycles[motorcycleIndex] = updatedMotorcycle;

            // Update current motorcycle if it's the one being edited
            if (currentMotorcycle && currentMotorcycle.id === motorcycleId) {
                currentMotorcycle = updatedMotorcycle;
            }

            updateMotorcycleDisplay();
            closeAddMotorcycleModal();
        }
    } catch (error) {
        console.error('Error updating motorcycle:', error);
        alert('Error updating motorcycle. Please try again.');
    }
}

// Delete motorcycle
async function deleteMotorcycle(motorcycleId) {
    if (confirm('Are you sure you want to delete this motorcycle? This will also delete all associated session data.')) {
        try {
            await apiCall(`delete-motorcycle?id=${motorcycleId}`, {
                method: 'DELETE'
            });

            motorcycles = motorcycles.filter(m => m.id !== motorcycleId);
            
            // Clear state if deleted motorcycle was selected
            if (currentMotorcycle && currentMotorcycle.id === motorcycleId) {
                currentMotorcycle = null;
                document.getElementById('main-content').style.display = 'none';
                saveAppState();
            }
            
            updateMotorcycleDisplay();
        } catch (error) {
            console.error('Error deleting motorcycle:', error);
            alert('Error deleting motorcycle. Please try again.');
        }
    }
}