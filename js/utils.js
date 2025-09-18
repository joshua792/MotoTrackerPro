// js/utils.js - Utility functions and helpers

// API helper functions
async function apiCall(endpoint, options = {}) {
    const response = await fetch(`/api/${endpoint}`, {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API call failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    return response.json();
}

// Change value with increment/decrement buttons
function changeValue(inputId, change, min, max, step) {
    const input = document.getElementById(inputId);
    let currentValue = parseFloat(input.value) || min;
    
    // Apply the change
    currentValue += change;
    
    // Round to proper decimal places based on step
    if (step < 1) {
        currentValue = Math.round(currentValue * 10) / 10;
    } else {
        currentValue = Math.round(currentValue);
    }
    
    // Enforce min/max bounds
    currentValue = Math.max(min, Math.min(max, currentValue));
    
    // Update input value
    input.value = currentValue;
}

// Toggle collapsible sections with improved icon handling
function toggleCollapsible(element) {
    element.classList.toggle('active');
    const content = element.nextElementSibling;
    const icon = element.querySelector('.collapsible-icon');
    
    if (content.style.display === 'block') {
        content.style.display = 'none';
        if (icon) icon.textContent = '+';
    } else {
        content.style.display = 'block';
        if (icon) icon.textContent = '−';
    }
}

// Show save confirmation
function showSaveConfirmation() {
    const element = document.getElementById('saved-data');
    element.style.display = 'block';
    setTimeout(() => {
        element.style.display = 'none';
    }, 3000);
}

// Convert temperature between units
function convertTemperature(temp, fromUnit, toUnit) {
    if (fromUnit === toUnit) return temp;
    
    if (fromUnit === 'celsius' && toUnit === 'fahrenheit') {
        return Math.round((temp * 9/5) + 32);
    } else if (fromUnit === 'fahrenheit' && toUnit === 'celsius') {
        return Math.round((temp - 32) * 5/9);
    }
    
    return temp;
}

// Clear all form fields
function clearAllFields() {
    document.querySelectorAll('input[type="text"], input[type="number"], textarea, select').forEach(field => {
        if (!['new-make', 'new-model', 'new-class', 'new-number', 'event-select', 'tire-brand', 'tire-type', 'tire-size', 'tire-compound'].includes(field.id)) {
            field.value = '';
        }
    });
}

// File upload management
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
        alert('Please select a CSV file');
        event.target.value = '';
        return;
    }

    const fileInfo = {
        name: file.name,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        sessionKey: `${currentEvent}_${currentMotorcycle.id}_${currentSession}`,
        file: file
    };

    uploadedFiles.push(fileInfo);
    displayUploadedFiles();
    document.getElementById('file-status').innerHTML = `<span style="color: green;">✓ File ready: ${file.name}</span>`;
}

function displayUploadedFiles() {
    const container = document.getElementById('uploaded-files');
    const sessionFiles = uploadedFiles.filter(f => 
        f.sessionKey === `${currentEvent}_${currentMotorcycle.id}_${currentSession}`
    );

    if (sessionFiles.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <div style="background: #f8f9fa; padding: 10px; border-radius: 5px; margin-top: 10px;">
            <strong>Uploaded Files:</strong><br>
            ${sessionFiles.map(file => `
                <div style="display: flex; justify-content: space-between; align-items: center; margin: 5px 0;">
                    <span>${file.name} (${Math.round(file.size / 1024)}KB)</span>
                    <button onclick="removeFile('${file.name}')" 
                            style="background: #dc3545; color: white; border: none; border-radius: 3px; padding: 2px 6px; font-size: 10px; cursor: pointer;">
                        Remove
                    </button>
                </div>
            `).join('')}
        </div>
    `;
}

function removeFile(fileName) {
    uploadedFiles = uploadedFiles.filter(f => f.name !== fileName);
    displayUploadedFiles();
    
    // Clear the file input if this was the current file
    const fileInput = document.getElementById('rs3-file');
    if (fileInput.files[0] && fileInput.files[0].name === fileName) {
        fileInput.value = '';
        document.getElementById('file-status').innerHTML = '';
    }
}

// Function to send data to AI (placeholder for future implementation)
async function sendToAI() {
    if (!currentMotorcycle || !currentEvent) {
        alert('Please select an event and motorcycle first');
        return;
    }

    const sessionKey = `${currentEvent}_${currentMotorcycle.id}_${currentSession}`;
    const sessionData = getCurrentSessionData();
    const sessionFiles = uploadedFiles.filter(f => f.sessionKey === sessionKey);

    if (sessionFiles.length === 0) {
        alert('Please upload a RaceStudio3 file first');
        return;
    }

    // This is where you'd integrate with your existing GPT
    // For now, just show what would be sent
    console.log('Data to send to AI:', {
        sessionData,
        files: sessionFiles.map(f => ({ name: f.name, size: f.size }))
    });

    alert('AI integration ready! This will send your session data and RaceStudio3 files to your GPT for analysis.');
}

function getCurrentSessionData() {
    return {
        motorcycle: currentMotorcycle,
        event: events.find(e => e.id === currentEvent),
        session: currentSession,
        setupData: sessionData[`${currentEvent}_${currentMotorcycle.id}_${currentSession}`] || {},
        weatherData: currentWeatherData
    };
}