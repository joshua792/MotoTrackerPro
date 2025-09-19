// js/subscription.js - Subscription management functions

let subscriptionData = null;

// Show subscription modal
async function showSubscriptionModal() {
    await loadSubscriptionStatus();
    document.getElementById('subscription-modal').style.display = 'block';
}

// Close subscription modal
function closeSubscriptionModal() {
    document.getElementById('subscription-modal').style.display = 'none';
}

// Load subscription status from API
async function loadSubscriptionStatus() {
    try {
        const response = await apiCall('subscription/status');

        if (response.success) {
            subscriptionData = response.subscription;
            updateSubscriptionDisplay();
        } else {
            console.error('Failed to load subscription status:', response.error);
        }
    } catch (error) {
        console.error('Error loading subscription status:', error);
    }
}

// Update subscription display in modal and header
function updateSubscriptionDisplay() {
    if (!subscriptionData) return;

    // Update header status badge
    updateHeaderSubscriptionStatus();

    // Update modal content
    updateModalSubscriptionInfo();
}

// Update header subscription status badge
function updateHeaderSubscriptionStatus() {
    const statusElement = document.getElementById('subscription-status');
    if (!statusElement || !subscriptionData) return;

    let statusText = '';
    let statusColor = '#666';

    if (subscriptionData.status === 'admin') {
        statusText = 'Admin Access';
        statusColor = '#6f42c1'; // Purple for admin
    } else if (subscriptionData.status === 'trial') {
        statusText = `Trial: ${subscriptionData.daysRemaining} days left`;
        statusColor = subscriptionData.daysRemaining <= 3 ? '#d63384' : '#ffc107';
    } else if (subscriptionData.status === 'active') {
        statusText = `${subscriptionData.plan.charAt(0).toUpperCase() + subscriptionData.plan.slice(1)} Plan`;
        statusColor = '#28a745';
    } else if (subscriptionData.status === 'expired') {
        statusText = 'Expired';
        statusColor = '#d63384';
    }

    statusElement.textContent = statusText;
    statusElement.style.backgroundColor = statusColor;

    // Show usage percentage for non-unlimited plans
    if (subscriptionData.usageLimit) {
        const usagePercent = Math.round(subscriptionData.usagePercentage);
        if (usagePercent > 80) {
            statusElement.textContent += ` (${usagePercent}% used)`;
        }
    }
}

// Update modal subscription info
function updateModalSubscriptionInfo() {
    const infoElement = document.getElementById('subscription-info');
    if (!infoElement || !subscriptionData) return;

    let html = '';

    if (subscriptionData.status === 'admin') {
        html = `
            <div style="background: #f3e5ff; border: 1px solid #d1a7ff; border-radius: 6px; padding: 15px; margin-bottom: 15px;">
                <h4 style="color: #6f42c1; margin-bottom: 10px;">👨‍💼 Administrator Access</h4>
                <p style="margin-bottom: 8px;"><strong>Status:</strong> Unlimited Access</p>
                <p style="margin-bottom: 8px;"><strong>Features:</strong> All features unlocked</p>
                <p style="margin-bottom: 8px;"><strong>Usage:</strong> No limits</p>
                <p style="color: #6f42c1; font-weight: bold; margin-top: 10px;">✨ You have full administrative access to all features without restrictions.</p>
            </div>
        `;

        // Hide upgrade options for admin users
        document.getElementById('subscription-plans').style.display = 'none';
    } else if (subscriptionData.status === 'trial') {
        html = `
            <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; padding: 15px; margin-bottom: 15px;">
                <h4 style="color: #2c5aa0; margin-bottom: 10px;">🎯 Trial Period</h4>
                <p style="margin-bottom: 8px;"><strong>Days Remaining:</strong> ${subscriptionData.daysRemaining}</p>
                <p style="margin-bottom: 8px;"><strong>Usage:</strong> ${subscriptionData.usageCount} / ${subscriptionData.usageLimit} sessions</p>
                <div style="background: #e9ecef; border-radius: 4px; height: 8px; margin: 8px 0;">
                    <div style="background: ${subscriptionData.usagePercentage > 80 ? '#d63384' : '#2c5aa0'}; height: 100%; border-radius: 4px; width: ${subscriptionData.usagePercentage}%;"></div>
                </div>
                ${subscriptionData.daysRemaining <= 3 ? '<p style="color: #d63384; font-weight: bold; margin-top: 10px;">⚠️ Your trial is expiring soon! Upgrade to continue using all features.</p>' : ''}
            </div>
        `;

        // Show upgrade options
        document.getElementById('subscription-plans').style.display = 'block';
    } else if (subscriptionData.status === 'active') {
        html = `
            <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 6px; padding: 15px; margin-bottom: 15px;">
                <h4 style="color: #155724; margin-bottom: 10px;">✅ Active Subscription</h4>
                <p style="margin-bottom: 8px;"><strong>Plan:</strong> ${subscriptionData.planDetails.name}</p>
                <p style="margin-bottom: 8px;"><strong>Renewal Date:</strong> ${new Date(subscriptionData.subscriptionEndDate).toLocaleDateString()}</p>
                ${subscriptionData.usageLimit ? `
                    <p style="margin-bottom: 8px;"><strong>Usage:</strong> ${subscriptionData.usageCount} / ${subscriptionData.usageLimit} sessions</p>
                    <div style="background: #e9ecef; border-radius: 4px; height: 8px; margin: 8px 0;">
                        <div style="background: ${subscriptionData.usagePercentage > 80 ? '#d63384' : '#28a745'}; height: 100%; border-radius: 4px; width: ${subscriptionData.usagePercentage}%;"></div>
                    </div>
                ` : '<p style="margin-bottom: 8px;"><strong>Usage:</strong> Unlimited</p>'}
                <div style="margin-top: 15px;">
                    <button class="btn btn-secondary btn-small" onclick="manageSubscription()">Manage Subscription</button>
                </div>
            </div>
        `;

        // Hide upgrade options for active subscriptions
        document.getElementById('subscription-plans').style.display = 'none';
    } else if (subscriptionData.status === 'expired') {
        html = `
            <div style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 6px; padding: 15px; margin-bottom: 15px;">
                <h4 style="color: #721c24; margin-bottom: 10px;">❌ Subscription Expired</h4>
                <p style="margin-bottom: 8px;">Your subscription has expired. Please upgrade to continue using the service.</p>
                <p style="margin-bottom: 8px;"><strong>Usage:</strong> ${subscriptionData.usageCount} / ${subscriptionData.usageLimit} sessions</p>
            </div>
        `;

        // Show upgrade options
        document.getElementById('subscription-plans').style.display = 'block';
    }

    infoElement.innerHTML = html;
}

// Select a subscription plan
async function selectPlan(planType) {
    if (!subscriptionData) {
        alert('Unable to load subscription data. Please try again.');
        return;
    }

    // Don't allow admins to purchase subscriptions
    if (subscriptionData.status === 'admin') {
        alert('Admin users have unlimited access and do not need subscriptions.');
        return;
    }

    // Don't allow active subscribers to purchase again (they can upgrade later)
    if (subscriptionData.status === 'active') {
        alert('You already have an active subscription. Subscription management features coming soon!');
        return;
    }

    const planButton = document.getElementById(`${planType}-plan-btn`);
    const originalText = planButton.textContent;

    try {
        planButton.textContent = 'Loading...';
        planButton.disabled = true;

        // Create Stripe checkout session
        const response = await apiCall('subscription/create-checkout-session', {
            method: 'POST',
            body: JSON.stringify({ plan: planType })
        });

        if (response.success) {
            // Redirect to Stripe checkout
            window.location.href = response.checkout_url;
        } else {
            alert('Error creating checkout session: ' + response.error);
        }
    } catch (error) {
        console.error('Checkout error:', error);
        alert('Error starting checkout: ' + error.message);
    } finally {
        planButton.textContent = originalText;
        planButton.disabled = false;
    }
}

// Update auth UI to include subscription status
function updateAuthUIWithSubscription() {
    if (currentUser) {
        // Handle admin users
        if (currentUser.is_admin) {
            subscriptionData = {
                status: 'admin',
                plan: 'unlimited',
                daysRemaining: 999,
                usageCount: currentUser.usage_count || 0,
                usageLimit: null,
                usagePercentage: 0
            };
        } else if (currentUser.subscription_status) {
            // Regular users
            subscriptionData = {
                status: currentUser.subscription_status,
                plan: currentUser.subscription_plan,
                daysRemaining: calculateDaysRemaining(currentUser),
                usageCount: currentUser.usage_count || 0,
                usageLimit: currentUser.usage_limit || 1000,
                usagePercentage: currentUser.usage_limit ? (currentUser.usage_count / currentUser.usage_limit) * 100 : 0
            };
        }

        updateHeaderSubscriptionStatus();
    }
}

// Calculate days remaining from user data
function calculateDaysRemaining(user) {
    const now = new Date();
    let endDate;

    if (user.subscription_status === 'trial') {
        endDate = new Date(user.trial_end_date);
    } else if (user.subscription_status === 'active') {
        endDate = new Date(user.subscription_end_date);
    } else {
        return 0;
    }

    const diffTime = endDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
}

// Manage subscription (opens Stripe customer portal)
async function manageSubscription() {
    try {
        const response = await apiCall('subscription/manage', {
            method: 'POST',
            body: JSON.stringify({ action: 'get_portal_url' })
        });

        if (response.success) {
            // Open Stripe customer portal in new tab
            window.open(response.portal_url, '_blank');
        } else {
            alert('Error opening subscription management: ' + response.error);
        }
    } catch (error) {
        console.error('Manage subscription error:', error);
        alert('Error opening subscription management: ' + error.message);
    }
}

// Handle successful payment return from Stripe
function handlePaymentSuccess() {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    const success = urlParams.get('success');
    const canceled = urlParams.get('canceled');

    if (success === 'true' && sessionId) {
        // Payment was successful
        alert('🎉 Payment successful! Your subscription is now active. Welcome to MotoSetup Pro!');

        // Reload subscription data and refresh the page
        setTimeout(() => {
            window.location.href = window.location.origin + window.location.pathname;
        }, 2000);
    } else if (canceled === 'true') {
        // Payment was canceled
        alert('Payment was canceled. You can try again anytime from the Subscription section.');

        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// Initialize subscription handling on page load
window.addEventListener('DOMContentLoaded', () => {
    handlePaymentSuccess();
});