// js/teams.js - Team management functionality

let userTeams = [];
let currentTeam = null;

// Load user's teams
async function loadUserTeams() {
    try {
        const response = await apiCall('teams/get-user-teams');
        userTeams = response.teams || [];
        const pendingInvitations = response.pendingInvitations || [];

        updateTeamDisplay();
        updatePendingInvitations(pendingInvitations);

        // Set current team if user has teams
        if (userTeams.length > 0 && !currentTeam) {
            currentTeam = userTeams[0];
        }

        return response;
    } catch (error) {
        console.error('Error loading teams:', error);
        userTeams = [];
        return { teams: [], pendingInvitations: [] };
    }
}

// Update team display
function updateTeamDisplay() {
    const teamsList = document.getElementById('teams-list');
    const teamDetails = document.getElementById('team-details');

    if (!teamsList) return;

    if (userTeams.length === 0) {
        teamsList.innerHTML = `
            <div class="empty-state">
                <p>You haven't joined any teams yet.</p>
                <p style="font-size: 14px; color: #666; margin-top: 10px;">
                    Create a team (requires Premier subscription) or wait for an invitation from a team owner.
                </p>
            </div>
        `;
        if (teamDetails) teamDetails.style.display = 'none';
    } else {
        teamsList.innerHTML = userTeams.map(team => `
            <div class="team-card ${currentTeam && currentTeam.id === team.id ? 'active' : ''}"
                 onclick="selectTeam('${team.id}')" style="cursor: pointer; border: 1px solid #ddd; padding: 15px; margin-bottom: 10px; border-radius: 5px; background: ${currentTeam && currentTeam.id === team.id ? '#f0f8ff' : '#fff'};">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-weight: bold; font-size: 16px;">${team.name}</div>
                        <div style="color: #666; font-size: 14px;">Your role: ${team.role}</div>
                        <div style="color: #666; font-size: 12px;">${team.member_count} member${team.member_count !== 1 ? 's' : ''}</div>
                    </div>
                    ${team.role === 'owner' ? '<div style="background: #28a745; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px;">OWNER</div>' : ''}
                </div>
                ${team.description ? `<div style="margin-top: 8px; font-size: 14px; color: #555;">${team.description}</div>` : ''}
            </div>
        `).join('');

        if (teamDetails && currentTeam) {
            updateTeamDetails(currentTeam);
            teamDetails.style.display = 'block';
        }
    }
}

// Select a team
function selectTeam(teamId) {
    currentTeam = userTeams.find(t => t.id === teamId);
    updateTeamDisplay();
    loadTeamMotorcycles();
}

// Update team details panel
function updateTeamDetails(team) {
    const teamDetailsName = document.getElementById('team-details-name');
    const teamDetailsDescription = document.getElementById('team-details-description');
    const teamDetailsActions = document.getElementById('team-details-actions');

    if (!teamDetailsName) return;

    const canManage = team.role === 'owner' || team.role === 'admin';

    teamDetailsName.textContent = team.name;
    teamDetailsDescription.textContent = team.description || 'No description provided';

    if (canManage) {
        teamDetailsActions.innerHTML = `
            <button onclick="showInviteMemberModal()" class="btn btn-primary btn-small">Invite Member</button>
            <button onclick="showTeamMembersModal()" class="btn btn-secondary btn-small">Manage Members</button>
        `;
    } else {
        teamDetailsActions.innerHTML = `
            <p style="color: #666; font-size: 14px; margin: 0;">You are a ${team.role} of this team.</p>
        `;
    }
}

// Show create team modal
function showCreateTeamModal() {
    const modal = document.getElementById('create-team-modal');
    if (modal) {
        modal.style.display = 'block';
    }
}

// Close create team modal
function closeCreateTeamModal() {
    const modal = document.getElementById('create-team-modal');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('team-name').value = '';
        document.getElementById('team-description').value = '';
    }
}

// Create new team
async function createTeam() {
    const name = document.getElementById('team-name').value.trim();
    const description = document.getElementById('team-description').value.trim();

    if (!name) {
        alert('Team name is required');
        return;
    }

    try {
        const response = await apiCall('teams/create-team', {
            method: 'POST',
            body: JSON.stringify({ name, description })
        });

        if (response.success) {
            await loadUserTeams();
            closeCreateTeamModal();
            alert('Team created successfully!');
        }
    } catch (error) {
        console.error('Error creating team:', error);

        // Parse error details for better user messaging
        let errorMessage = 'Error creating team';

        if (error.message.includes('API call failed: 403')) {
            // Try to parse the error details from the API response
            try {
                // Extract the JSON error from the error message
                const match = error.message.match(/\{.*\}/);
                if (match) {
                    const errorData = JSON.parse(match[0]);

                    if (errorData.error.includes('Premier subscription') || errorData.error.includes('Admin access')) {
                        errorMessage = `Team creation requires either:\n• Premier subscription (current: ${errorData.currentPlan || 'unknown'})\n• Admin access (current: ${errorData.isAdmin ? 'Yes' : 'No'})\n\nPlease upgrade your subscription or contact an administrator.`;
                    } else if (errorData.error.includes('expired')) {
                        errorMessage = 'Your subscription has expired. Please renew to create teams.';
                    } else {
                        errorMessage = errorData.error;
                    }
                }
            } catch (parseError) {
                // Fallback to generic message
                errorMessage = 'You need either a Premier subscription or Admin access to create teams.';
            }
        } else {
            errorMessage = 'Error creating team: ' + error.message;
        }

        alert(errorMessage);
    }
}

// Show invite member modal
function showInviteMemberModal() {
    const modal = document.getElementById('invite-member-modal');
    if (modal) {
        modal.style.display = 'block';
    }
}

// Close invite member modal
function closeInviteMemberModal() {
    const modal = document.getElementById('invite-member-modal');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('invite-email').value = '';
        document.getElementById('invite-role').value = 'member';
    }
}

// Resend invitation
async function resendInvitation(email, role) {
    if (!currentTeam) return;

    try {
        const response = await apiCall('teams/invite-member', {
            method: 'POST',
            body: JSON.stringify({
                teamId: currentTeam.id,
                email: email,
                role: role,
                resend: true
            })
        });

        if (response.success) {
            closeInviteMemberModal();
            const emailStatus = response.emailSent ? 'and email sent' : '(email delivery failed)';
            alert(`Invitation resent to ${email} ${emailStatus}`);
        }
    } catch (error) {
        console.error('Error resending invitation:', error);
        alert('Error resending invitation: ' + error.message);
    }
}

// Invite team member
async function inviteTeamMember() {
    if (!currentTeam) return;

    const email = document.getElementById('invite-email').value.trim();
    const role = document.getElementById('invite-role').value;

    if (!email) {
        alert('Email is required');
        return;
    }

    try {
        const response = await apiCall('teams/invite-member', {
            method: 'POST',
            body: JSON.stringify({
                teamId: currentTeam.id,
                email: email,
                role: role
            })
        });

        if (response.success) {
            closeInviteMemberModal();
            const emailStatus = response.emailSent ? 'and email sent' : '(email delivery failed)';
            alert(`Invitation sent to ${email} ${emailStatus}`);
        }
    } catch (error) {
        console.error('Error inviting member:', error);

        // Check if this is a "already invited" error that can be resent
        if (error.message.includes('API call failed: 409')) {
            try {
                const match = error.message.match(/\{.*\}/);
                if (match) {
                    const errorData = JSON.parse(match[0]);
                    if (errorData.canResend) {
                        const resend = confirm(
                            `A pending invitation already exists for ${email}.\n\n` +
                            `Expires: ${new Date(errorData.expiresAt).toLocaleDateString()}\n\n` +
                            `Would you like to resend the invitation email?`
                        );

                        if (resend) {
                            await resendInvitation(email, role);
                            return;
                        }
                    }
                }
            } catch (parseError) {
                // Fall through to generic error
            }
        }

        alert('Error sending invitation: ' + error.message);
    }
}

// Update pending invitations display
function updatePendingInvitations(invitations) {
    const container = document.getElementById('pending-invitations');
    if (!container) return;

    if (invitations.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    container.innerHTML = `
        <h4>Pending Team Invitations</h4>
        <div class="invitations-list">
            ${invitations.map(invite => `
                <div class="invitation-card">
                    <div class="invitation-info">
                        <strong>${invite.team_name}</strong>
                        <p>Invited by ${invite.invited_by_name}</p>
                        <small>Expires: ${new Date(invite.expires_at).toLocaleDateString()}</small>
                    </div>
                    <div class="invitation-actions">
                        <button onclick="acceptInvitation('${invite.token}')" class="btn btn-primary btn-sm">Accept</button>
                        <button onclick="declineInvitation('${invite.id}')" class="btn btn-secondary btn-sm">Decline</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Accept team invitation
async function acceptInvitation(token) {
    try {
        const response = await apiCall('teams/accept-invitation', {
            method: 'POST',
            body: JSON.stringify({ invitationToken: token })
        });

        if (response.success) {
            await loadUserTeams();
            alert(`Successfully joined team: ${response.membership.teamName}`);
        }
    } catch (error) {
        console.error('Error accepting invitation:', error);
        alert('Error accepting invitation: ' + error.message);
    }
}

// Load team motorcycles
async function loadTeamMotorcycles() {
    if (!currentTeam) return;

    try {
        // This will use the updated get-motorcycles API that filters by team membership
        await loadMotorcycles();
    } catch (error) {
        console.error('Error loading team motorcycles:', error);
    }
}

// Check if user can create teams (has premier subscription)
async function checkCanCreateTeams() {
    try {
        // This would typically check the user's subscription status
        // For now, we'll assume the API will handle the validation
        return true;
    } catch (error) {
        return false;
    }
}

// Show team members modal
function showTeamMembersModal() {
    if (!currentTeam) {
        alert('Please select a team first');
        return;
    }

    const modal = document.getElementById('team-members-modal');
    if (modal) {
        loadTeamMembers();
        modal.style.display = 'block';
    }
}

// Close team members modal
function closeTeamMembersModal() {
    const modal = document.getElementById('team-members-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Load team members
async function loadTeamMembers() {
    if (!currentTeam) return;

    const membersList = document.getElementById('team-members-list');
    const modalTitle = document.getElementById('team-members-modal-title');

    if (modalTitle) {
        modalTitle.textContent = `Manage Members - ${currentTeam.name}`;
    }

    if (!membersList) return;

    membersList.innerHTML = '<p>Loading team members...</p>';

    try {
        const response = await apiCall(`teams/get-team-members?teamId=${currentTeam.id}`);

        if (response.success && response.members) {
            displayTeamMembers(response.members);
        } else {
            membersList.innerHTML = '<p>No members found</p>';
        }
    } catch (error) {
        console.error('Error loading team members:', error);
        membersList.innerHTML = '<p>Error loading team members</p>';
    }
}

// Display team members
function displayTeamMembers(members) {
    const membersList = document.getElementById('team-members-list');
    const canManage = currentTeam && (currentTeam.role === 'owner' || currentTeam.role === 'admin');

    if (!membersList) return;

    if (members.length === 0) {
        membersList.innerHTML = '<p>No team members found</p>';
        return;
    }

    membersList.innerHTML = members.map(member => {
        const isPending = member.type === 'invitation';
        const borderColor = isPending ? '#ffc107' : '#ddd';
        const backgroundColor = isPending ? '#fff3cd' : '#fff';

        return `
            <div class="team-member-card" style="border: 1px solid ${borderColor}; background: ${backgroundColor}; padding: 15px; margin-bottom: 10px; border-radius: 5px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-weight: bold; font-size: 16px;">
                        ${member.name}
                        ${isPending ? '<span style="color: #856404; font-size: 12px; font-weight: normal;"> (Pending Invitation)</span>' : ''}
                    </div>
                    <div style="color: #666; font-size: 14px;">${member.email}</div>
                    <div style="color: #888; font-size: 12px;">
                        Role: ${member.role} •
                        ${isPending ?
                            `Invited: ${new Date(member.invited_at).toLocaleDateString()} • Expires: ${new Date(member.expires_at).toLocaleDateString()}` :
                            `Joined: ${member.joined_at ? new Date(member.joined_at).toLocaleDateString() : 'Pending'}`
                        }
                        ${member.status !== 'active' && !isPending ? ` • Status: ${member.status}` : ''}
                    </div>
                </div>
                <div>
                    ${member.role === 'owner' ?
                        '<span style="background: #28a745; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px;">OWNER</span>' :
                        isPending && canManage ?
                            `<button onclick="resendPendingInvitation('${member.email}')" class="btn btn-secondary btn-small" style="background: #ffc107; color: #212529; margin-right: 5px;">Resend</button>` +
                            `<button onclick="cancelInvitation('${member.email}')" class="btn btn-secondary btn-small" style="background: #dc3545; color: white;">Cancel</button>` :
                        canManage && member.role !== 'owner' && !isPending ?
                            `<button onclick="removeTeamMember('${member.user_id}')" class="btn btn-secondary btn-small" style="background: #dc3545; color: white;">Remove</button>` :
                            ''
                    }
                </div>
            </div>
        `;
    }).join('');
}

// Remove team member
async function removeTeamMember(userId) {
    if (!currentTeam || !userId) return;

    if (!confirm('Are you sure you want to remove this member from the team?')) {
        return;
    }

    try {
        const response = await apiCall('teams/remove-member', {
            method: 'POST',
            body: JSON.stringify({
                teamId: currentTeam.id,
                userId: userId
            })
        });

        if (response.success) {
            alert('Member removed successfully');
            loadTeamMembers(); // Refresh the list
            loadUserTeams(); // Refresh team info
        }
    } catch (error) {
        console.error('Error removing team member:', error);
        alert('Error removing team member: ' + error.message);
    }
}

// Resend pending invitation
async function resendPendingInvitation(email) {
    if (!currentTeam) return;

    try {
        const response = await apiCall('teams/invite-member', {
            method: 'POST',
            body: JSON.stringify({
                teamId: currentTeam.id,
                email: email,
                role: 'member', // Default role for resend
                resend: true
            })
        });

        if (response.success) {
            const emailStatus = response.emailSent ? 'and email sent' : '(email delivery failed)';
            alert(`Invitation resent to ${email} ${emailStatus}`);
            loadTeamMembers(); // Refresh the list
        }
    } catch (error) {
        console.error('Error resending invitation:', error);
        alert('Error resending invitation: ' + error.message);
    }
}

// Cancel pending invitation
async function cancelInvitation(email) {
    if (!currentTeam) return;

    if (!confirm(`Are you sure you want to cancel the invitation for ${email}?`)) {
        return;
    }

    try {
        const response = await apiCall('teams/cancel-invitation', {
            method: 'POST',
            body: JSON.stringify({
                teamId: currentTeam.id,
                email: email
            })
        });

        if (response.success) {
            alert('Invitation cancelled successfully');
            loadTeamMembers(); // Refresh the list
        }
    } catch (error) {
        console.error('Error cancelling invitation:', error);
        alert('Error cancelling invitation: ' + error.message);
    }
}

// Initialize teams functionality
async function initializeTeams() {
    try {
        await loadUserTeams();
    } catch (error) {
        console.error('Error initializing teams:', error);
    }
}