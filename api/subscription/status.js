const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const {
  isSubscriptionActive,
  hasReachedUsageLimit,
  getDaysRemaining,
  getUsagePercentage,
  SUBSCRIPTION_PLANS
} = require('./config');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify JWT token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this-in-production');

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    // Get user subscription data
    const userQuery = `
      SELECT id, name, email, subscription_status, subscription_plan,
             trial_start_date, trial_end_date, subscription_start_date, subscription_end_date,
             usage_count, usage_limit, stripe_customer_id, stripe_subscription_id
      FROM users WHERE id = $1
    `;

    const userResult = await pool.query(userQuery, [decoded.userId]);

    if (userResult.rows.length === 0) {
      await pool.end();
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    await pool.end();

    // Calculate subscription status
    const isActive = isSubscriptionActive(user);
    const hasReachedLimit = hasReachedUsageLimit(user);
    const daysRemaining = getDaysRemaining(user);
    const usagePercentage = getUsagePercentage(user);
    const currentPlan = SUBSCRIPTION_PLANS[user.subscription_plan] || SUBSCRIPTION_PLANS.basic;

    res.json({
      success: true,
      subscription: {
        status: user.subscription_status,
        plan: user.subscription_plan,
        isActive,
        hasReachedLimit,
        daysRemaining,
        usagePercentage,
        usageCount: user.usage_count,
        usageLimit: user.usage_limit,
        trialEndDate: user.trial_end_date,
        subscriptionEndDate: user.subscription_end_date,
        planDetails: currentPlan,
        stripeCustomerId: user.stripe_customer_id,
        stripeSubscriptionId: user.stripe_subscription_id
      }
    });

  } catch (error) {
    console.error('Subscription status error:', error);
    res.status(500).json({
      error: 'Failed to get subscription status',
      details: error.message
    });
  }
};