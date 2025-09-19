// js/subscription-plans.js - Subscription plans management functions

let subscriptionPlansData = [];
let editingPlanId = null;

// Load subscription plans from API
async function loadSubscriptionPlans() {
    try {
        const response = await apiCall('subscription/get-plans');
        if (response.success) {
            subscriptionPlansData = response.plans;
            updateSubscriptionModal();
            return subscriptionPlansData;
        } else {
            console.error('Failed to load subscription plans:', response.error);
            return [];
        }
    } catch (error) {
        console.error('Error loading subscription plans:', error);
        return [];
    }
}

// Update subscription modal with dynamic plans
function updateSubscriptionModal() {
    if (!subscriptionPlansData || subscriptionPlansData.length === 0) return;

    const plansContainer = document.getElementById('subscription-plans');
    if (!plansContainer) return;

    // Filter active plans and exclude trial
    const activeNonTrialPlans = subscriptionPlansData.filter(plan =>
        plan.is_active && plan.plan_key !== 'trial'
    );

    if (activeNonTrialPlans.length === 0) {
        plansContainer.innerHTML = '<p>No subscription plans available.</p>';
        return;
    }

    let plansHTML = '<h3 style="margin-bottom: 15px;">Available Plans</h3>';
    plansHTML += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 20px;">';

    activeNonTrialPlans.forEach(plan => {
        const isPopular = plan.plan_key === 'premium';
        const borderColor = isPopular ? '#2c5aa0' : '#ddd';

        plansHTML += `
            <div class="plan-card" style="border: 2px solid ${borderColor}; border-radius: 8px; padding: 20px; text-align: center; position: relative;">
                ${isPopular ? '<div style="position: absolute; top: -10px; left: 50%; transform: translateX(-50%); background: #2c5aa0; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px;">POPULAR</div>' : ''}
                <h4 style="color: #2c5aa0; margin-bottom: 10px;">${plan.name}</h4>
                <div style="font-size: 24px; font-weight: bold; margin-bottom: 10px;">$${plan.price_monthly}/month</div>
                ${plan.description ? `<div style="color: #666; font-size: 14px; margin-bottom: 15px;">${plan.description}</div>` : ''}
                <ul style="text-align: left; margin-bottom: 15px; padding-left: 20px;">
                    ${plan.features.map(feature => `<li>${feature}</li>`).join('')}
                </ul>
                <button class="btn btn-primary" onclick="selectPlan('${plan.plan_key}')" id="${plan.plan_key}-plan-btn">Select ${plan.name}</button>
            </div>
        `;
    });

    plansHTML += '</div>';
    plansContainer.innerHTML = plansHTML;
}

// Show subscription plan modal for adding/editing
function showAddSubscriptionPlanModal(planId = null) {
    editingPlanId = planId;

    const modal = document.getElementById('subscription-plan-modal');
    const title = document.getElementById('subscription-plan-modal-title');
    const saveBtn = document.getElementById('save-subscription-plan-btn');

    if (planId) {
        // Editing existing plan
        const plan = subscriptionPlansData.find(p => p.id === planId);
        if (plan) {
            title.textContent = 'Edit Subscription Plan';
            saveBtn.textContent = 'Update Plan';

            document.getElementById('plan-key').value = plan.plan_key;
            document.getElementById('plan-name').value = plan.name;
            document.getElementById('plan-description').value = plan.description || '';
            document.getElementById('plan-price-monthly').value = plan.price_monthly;
            document.getElementById('plan-price-yearly').value = plan.price_yearly || '';
            document.getElementById('plan-usage-limit').value = plan.usage_limit || '';
            document.getElementById('plan-features').value = plan.features ? plan.features.join('\n') : '';
            document.getElementById('plan-sort-order').value = plan.sort_order || 0;
            document.getElementById('plan-active').checked = plan.is_active;
        }
    } else {
        // Adding new plan
        title.textContent = 'Add New Subscription Plan';
        saveBtn.textContent = 'Add Plan';
        clearSubscriptionPlanForm();
    }

    modal.style.display = 'block';
}

// Close subscription plan modal
function closeSubscriptionPlanModal() {
    document.getElementById('subscription-plan-modal').style.display = 'none';
    clearSubscriptionPlanForm();
    editingPlanId = null;
}

// Clear subscription plan form
function clearSubscriptionPlanForm() {
    document.getElementById('plan-key').value = '';
    document.getElementById('plan-name').value = '';
    document.getElementById('plan-description').value = '';
    document.getElementById('plan-price-monthly').value = '';
    document.getElementById('plan-price-yearly').value = '';
    document.getElementById('plan-usage-limit').value = '';
    document.getElementById('plan-features').value = '';
    document.getElementById('plan-sort-order').value = '0';
    document.getElementById('plan-active').checked = true;
}

// Save subscription plan
async function saveSubscriptionPlan() {
    const planKey = document.getElementById('plan-key').value.trim();
    const name = document.getElementById('plan-name').value.trim();
    const description = document.getElementById('plan-description').value.trim();
    const priceMonthly = parseFloat(document.getElementById('plan-price-monthly').value);
    const priceYearly = document.getElementById('plan-price-yearly').value;
    const usageLimit = document.getElementById('plan-usage-limit').value;
    const featuresText = document.getElementById('plan-features').value.trim();
    const sortOrder = parseInt(document.getElementById('plan-sort-order').value) || 0;
    const isActive = document.getElementById('plan-active').checked;

    if (!planKey || !name || isNaN(priceMonthly)) {
        alert('Plan key, name, and monthly price are required');
        return;
    }

    const features = featuresText ? featuresText.split('\n').filter(f => f.trim()) : [];

    const saveBtn = document.getElementById('save-subscription-plan-btn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;

    try {
        const planData = {
            plan_key: planKey,
            name,
            description: description || null,
            price_monthly: priceMonthly,
            price_yearly: priceYearly ? parseFloat(priceYearly) : null,
            usage_limit: usageLimit ? parseInt(usageLimit) : null,
            features,
            is_active: isActive,
            sort_order: sortOrder
        };

        if (editingPlanId) {
            planData.id = editingPlanId;
        }

        const response = await apiCall('subscription/save-plan', {
            method: 'POST',
            body: JSON.stringify(planData)
        });

        if (response.success) {
            closeSubscriptionPlanModal();
            await loadSubscriptionPlans(); // Reload the list
            loadSubscriptionPlansList(); // Update admin list if visible
            alert(response.message);
        } else {
            alert('Error: ' + response.error);
        }
    } catch (error) {
        console.error('Error saving subscription plan:', error);
        alert('Error saving subscription plan: ' + error.message);
    } finally {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
    }
}

// Load subscription plans list for admin panel
async function loadSubscriptionPlansList() {
    const listContainer = document.getElementById('subscription-plans-list');
    if (!listContainer) return;

    listContainer.innerHTML = '<p>Loading subscription plans...</p>';

    try {
        const response = await apiCall('subscription/get-plans');

        if (response.success) {
            const plans = response.plans;

            if (plans.length === 0) {
                listContainer.innerHTML = '<p>No subscription plans found.</p>';
                return;
            }

            let html = '<div style="display: grid; gap: 15px;">';

            plans.forEach(plan => {
                const statusClass = plan.is_active ? 'text-success' : 'text-muted';
                const statusText = plan.is_active ? 'Active' : 'Inactive';
                const usageText = plan.usage_limit ? `${plan.usage_limit} sessions/month` : 'Unlimited';

                html += `
                    <div style="border: 1px solid #ddd; border-radius: 4px; padding: 15px; background: ${plan.is_active ? '#fff' : '#f8f9fa'};">
                        <div style="display: flex; justify-content: space-between; align-items: start;">
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; margin-bottom: 8px;">
                                    <span style="font-weight: bold; font-size: 16px; margin-right: 10px;">${plan.name}</span>
                                    <span style="background: #e9ecef; padding: 2px 8px; border-radius: 12px; font-size: 11px; color: #666;">${plan.plan_key}</span>
                                    <span style="font-size: 12px; color: ${plan.is_active ? '#28a745' : '#6c757d'}; margin-left: 8px;">
                                        ${statusText}
                                    </span>
                                </div>

                                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 10px;">
                                    <div>
                                        <div style="font-size: 12px; color: #666;">Monthly Price</div>
                                        <div style="font-weight: bold;">$${plan.price_monthly}</div>
                                    </div>
                                    <div>
                                        <div style="font-size: 12px; color: #666;">Yearly Price</div>
                                        <div style="font-weight: bold;">${plan.price_yearly ? '$' + plan.price_yearly : 'N/A'}</div>
                                    </div>
                                    <div>
                                        <div style="font-size: 12px; color: #666;">Usage Limit</div>
                                        <div style="font-weight: bold;">${usageText}</div>
                                    </div>
                                </div>

                                ${plan.description ? `<div style="font-size: 13px; color: #666; margin-bottom: 8px;">${plan.description}</div>` : ''}

                                ${plan.features && plan.features.length > 0 ? `
                                    <div style="font-size: 12px; color: #666;">
                                        <strong>Features:</strong> ${plan.features.join(', ')}
                                    </div>
                                ` : ''}

                                <div style="font-size: 11px; color: #999; margin-top: 8px;">
                                    Sort Order: ${plan.sort_order} | Created: ${new Date(plan.created_at).toLocaleDateString()}
                                </div>
                            </div>
                            <div style="display: flex; gap: 5px; margin-left: 15px;">
                                <button class="btn btn-small btn-secondary" onclick="showAddSubscriptionPlanModal(${plan.id})" title="Edit">
                                    ✏️
                                </button>
                                <button class="btn btn-small btn-danger" onclick="deleteSubscriptionPlan(${plan.id}, '${plan.name.replace(/'/g, '\\\'')}')" title="Delete">
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
            listContainer.innerHTML = '<p style="color: #d63384;">Error loading subscription plans: ' + response.error + '</p>';
        }
    } catch (error) {
        console.error('Error loading subscription plans list:', error);
        listContainer.innerHTML = '<p style="color: #d63384;">Error loading subscription plans</p>';
    }
}

// Delete subscription plan
async function deleteSubscriptionPlan(planId, planName) {
    if (!confirm(`Are you sure you want to delete "${planName}"?\n\nNote: If this plan is used by existing users, it will be deactivated instead of deleted.`)) {
        return;
    }

    try {
        const response = await apiCall(`subscription/delete-plan?id=${planId}`, {
            method: 'DELETE'
        });

        if (response.success) {
            alert(response.message);
            await loadSubscriptionPlans(); // Reload for the subscription modal
            loadSubscriptionPlansList(); // Update admin list
        } else {
            alert('Error: ' + response.error);
        }
    } catch (error) {
        console.error('Error deleting subscription plan:', error);
        alert('Error deleting subscription plan: ' + error.message);
    }
}

// Initialize subscription plans on page load
window.addEventListener('DOMContentLoaded', () => {
    loadSubscriptionPlans();
});