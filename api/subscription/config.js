// Subscription plans configuration
const SUBSCRIPTION_PLANS = {
  trial: {
    name: 'Trial',
    duration_days: 14,
    usage_limit: 1000,
    price: 0,
    stripe_price_id: null,
    features: [
      'Full access to all features',
      '14-day trial period',
      'Up to 1000 session saves',
      'Track map access',
      'Weather integration'
    ]
  },
  basic: {
    name: 'Basic Plan',
    duration_days: 30,
    usage_limit: 5000,
    price: 9.99,
    stripe_price_id: 'price_basic_monthly', // Will be set to actual Stripe price ID
    features: [
      'Unlimited session saves',
      'Track map access',
      'Weather integration',
      'Previous track data',
      'Export capabilities'
    ]
  },
  premium: {
    name: 'Premium Plan',
    duration_days: 30,
    usage_limit: null, // unlimited
    price: 19.99,
    stripe_price_id: 'price_premium_monthly', // Will be set to actual Stripe price ID
    features: [
      'Everything in Basic',
      'Unlimited usage',
      'Priority support',
      'Advanced analytics',
      'Team collaboration'
    ]
  }
};

// Subscription status types
const SUBSCRIPTION_STATUS = {
  TRIAL: 'trial',
  ACTIVE: 'active',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  PAYMENT_FAILED: 'payment_failed'
};

// Usage limits for different plans
const USAGE_LIMITS = {
  trial: 1000,
  basic: 5000,
  premium: null // unlimited
};

// Check if user's subscription is active
function isSubscriptionActive(user) {
  const now = new Date();

  if (user.subscription_status === SUBSCRIPTION_STATUS.TRIAL) {
    return user.trial_end_date && new Date(user.trial_end_date) > now;
  }

  if (user.subscription_status === SUBSCRIPTION_STATUS.ACTIVE) {
    return user.subscription_end_date && new Date(user.subscription_end_date) > now;
  }

  return false;
}

// Check if user has reached usage limit
function hasReachedUsageLimit(user) {
  if (!user.usage_limit) return false; // unlimited
  return user.usage_count >= user.usage_limit;
}

// Get days remaining in subscription
function getDaysRemaining(user) {
  const now = new Date();
  let endDate;

  if (user.subscription_status === SUBSCRIPTION_STATUS.TRIAL) {
    endDate = new Date(user.trial_end_date);
  } else if (user.subscription_status === SUBSCRIPTION_STATUS.ACTIVE) {
    endDate = new Date(user.subscription_end_date);
  } else {
    return 0;
  }

  const diffTime = endDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

// Get usage percentage
function getUsagePercentage(user) {
  if (!user.usage_limit) return 0; // unlimited
  return Math.min(100, (user.usage_count / user.usage_limit) * 100);
}

module.exports = {
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_STATUS,
  USAGE_LIMITS,
  isSubscriptionActive,
  hasReachedUsageLimit,
  getDaysRemaining,
  getUsagePercentage
};