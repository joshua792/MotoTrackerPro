// js/auth.js - Authentication functionality

// Global authentication state
let currentUser = null;
let authToken = null;

// Initialize authentication on page load
window.addEventListener('DOMContentLoaded', initAuth);

async function initAuth() {
    // Check for existing session
    const token = localStorage.getItem('authToken');
    const user = localStorage.getItem('currentUser');

    if (token && user) {
        authToken = token;
        currentUser = JSON.parse(user);
        updateAuthUI();

        // Verify token is still valid and load data if valid
        await verifyTokenAndLoadData();
    } else {
        showLoginRequired();
    }
}

// Show/hide authentication modal
function showAuthModal(mode = 'login') {
    document.getElementById('auth-modal').style.display = 'block';

    if (mode === 'login') {
        document.getElementById('login-form').style.display = 'block';
        document.getElementById('register-form').style.display = 'none';
    } else {
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('register-form').style.display = 'block';
    }
}

function closeAuthModal() {
    document.getElementById('auth-modal').style.display = 'none';
    clearAuthForms();
}

function clearAuthForms() {
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('register-name').value = '';
    document.getElementById('register-email').value = '';
    document.getElementById('register-password').value = '';
    document.getElementById('register-confirm-password').value = '';
    document.getElementById('register-team').value = '';
}

// Login functionality
async function login() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        alert('Please fill in all fields');
        return;
    }

    try {
        const response = await apiCall('auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });

        if (response.success) {
            authToken = response.token;
            currentUser = response.user;

            // Store in localStorage
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));

            // Update UI
            updateAuthUI();
            closeAuthModal();

            // Small delay to ensure token is set
            setTimeout(async () => {
                try {
                    await loadAppData();
                    alert('Login successful!');
                } catch (error) {
                    console.error('Error loading app data:', error);
                    alert('Login successful, but there was an issue loading data. Please refresh the page.');
                }
            }, 100);
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed: ' + error.message);
    }
}

// Register functionality
async function register() {
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    const team = document.getElementById('register-team').value;

    if (!name || !email || !password || !confirmPassword) {
        alert('Please fill in all required fields');
        return;
    }

    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }

    if (password.length < 8) {
        alert('Password must be at least 8 characters long');
        return;
    }

    try {
        const response = await apiCall('auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password, team })
        });

        if (response.success) {
            alert('Registration successful! Please login with your new account.');
            showAuthModal('login');
        }
    } catch (error) {
        console.error('Registration error:', error);
        alert('Registration failed: ' + error.message);
    }
}

// Logout functionality
function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');

    updateAuthUI();
    showLoginRequired();

    // Clear any cached data
    events = [];
    motorcycles = [];

    alert('Logged out successfully');
}

// Update UI based on authentication state
function updateAuthUI() {
    if (currentUser) {
        document.getElementById('login-header').style.display = 'none';
        document.getElementById('auth-header').style.display = 'block';
        document.getElementById('user-welcome').textContent = `Welcome, ${currentUser.name}`;
        document.getElementById('main-content').style.display = 'block';
    } else {
        document.getElementById('login-header').style.display = 'block';
        document.getElementById('auth-header').style.display = 'none';
        document.getElementById('main-content').style.display = 'none';
    }
}

// Show login required message
function showLoginRequired() {
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
        mainContent.style.display = 'none';
    }

    // Show login prompt
    updateAuthUI();
}

// Verify token is still valid
async function verifyToken() {
    try {
        const response = await apiCall('auth/verify', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (!response.success) {
            // Token is invalid, logout
            logout();
        }
    } catch (error) {
        console.error('Token verification failed:', error);
        logout();
    }
}

// Verify token and load data if valid
async function verifyTokenAndLoadData() {
    try {
        const response = await apiCall('auth/verify', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.success) {
            // Token is valid, load app data
            await loadAppData();
        } else {
            // Token is invalid, logout
            logout();
        }
    } catch (error) {
        console.error('Token verification failed:', error);
        logout();
    }
}

// This function is now moved to app.js as loadAppData()

// Utility function to get auth headers
function getAuthHeaders() {
    if (authToken) {
        return {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        };
    }
    return { 'Content-Type': 'application/json' };
}

// Modify apiCall to include authentication
function wrapApiCall() {
    if (typeof window.apiCall !== 'function') {
        console.error('apiCall function not found');
        return;
    }

    const originalApiCall = window.apiCall;
    window.apiCall = async function(endpoint, options = {}) {
        // Add auth headers if user is logged in
        if (authToken && !endpoint.startsWith('auth/')) {
            options.headers = {
                ...getAuthHeaders(),
                ...options.headers
            };
        }

        try {
            return await originalApiCall(endpoint, options);
        } catch (error) {
            // If we get a 401 (Unauthorized), the token might be expired
            if (error.message.includes('401')) {
                logout();
                throw new Error('Session expired. Please login again.');
            }
            throw error;
        }
    };
}

// Wrap apiCall when available
setTimeout(wrapApiCall, 0);