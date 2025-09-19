// js/invitations.js - Handle team invitation links

// Check for invitation token in URL on page load
function checkForInvitation() {
    const urlParams = new URLSearchParams(window.location.search);
    const invitationToken = urlParams.get('invitation');

    if (invitationToken) {
        // Remove the invitation parameter from URL to clean it up
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);

        // Handle the invitation
        handleInvitationToken(invitationToken);
    }
}

// Handle invitation token
async function handleInvitationToken(token) {
    console.log('Processing invitation token:', token);

    // Check if user is logged in
    const currentUserToken = localStorage.getItem('token');

    if (!currentUserToken) {
        // User not logged in - show login modal with invitation context
        showInvitationLoginPrompt(token);
        return;
    }

    // User is logged in - try to accept invitation
    try {
        await acceptInvitationDirectly(token);
    } catch (error) {
        console.error('Error accepting invitation:', error);
        showInvitationError(error.message);
    }
}

// Show login prompt for invitation
function showInvitationLoginPrompt(token) {
    // Store invitation token temporarily
    sessionStorage.setItem('pendingInvitation', token);

    alert('You have been invited to join a team! Please log in or create an account to accept the invitation.');

    // Show login modal
    showAuthModal('login');
}

// Accept invitation directly (user is logged in)
async function acceptInvitationDirectly(token) {
    try {
        const response = await apiCall('teams/accept-invitation', {
            method: 'POST',
            body: JSON.stringify({ invitationToken: token })
        });

        if (response.success) {
            // Show success message
            alert(`Successfully joined team: ${response.membership.teamName}! You can now access team motorcycles and data.`);

            // Refresh the app data
            if (typeof loadUserTeams === 'function') {
                await loadUserTeams();
            }
            if (typeof loadMotorcycles === 'function') {
                await loadMotorcycles();
            }

            // Show teams tab to see the new team
            if (typeof showSettingsModal === 'function' && typeof showSettingsTab === 'function') {
                showSettingsModal();
                showSettingsTab('teams');
            }
        }
    } catch (error) {
        console.error('Error accepting invitation:', error);

        // Parse error for better user messaging
        let errorMessage = 'Failed to accept invitation';

        if (error.message.includes('404')) {
            errorMessage = 'This invitation link is invalid or has expired.';
        } else if (error.message.includes('403')) {
            errorMessage = 'This invitation is for a different email address.';
        } else if (error.message.includes('409')) {
            errorMessage = 'You are already a member of this team.';
        } else if (error.message.includes('410')) {
            errorMessage = 'This invitation has expired.';
        }

        alert(errorMessage);
        throw error;
    }
}

// Show invitation error
function showInvitationError(message) {
    alert('Invitation Error: ' + message);
}

// Check for pending invitation after login
function checkPendingInvitation() {
    const pendingToken = sessionStorage.getItem('pendingInvitation');

    if (pendingToken) {
        sessionStorage.removeItem('pendingInvitation');

        // Small delay to ensure user is fully logged in
        setTimeout(async () => {
            try {
                await acceptInvitationDirectly(pendingToken);
            } catch (error) {
                // Error already handled in acceptInvitationDirectly
            }
        }, 1000);
    }
}

// Initialize invitation handling
function initializeInvitations() {
    // Check for invitation token in URL
    checkForInvitation();
}