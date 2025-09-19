const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const {
  isSubscriptionActive,
  hasReachedUsageLimit,
  getDaysRemaining
} = require('./config');

// Middleware to verify user authentication and subscription status
async function verifySubscription(req, res, next) {
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
             usage_count, usage_limit, is_admin
      FROM users WHERE id = $1
    `;

    const userResult = await pool.query(userQuery, [decoded.userId]);

    if (userResult.rows.length === 0) {
      await pool.end();
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Check if subscription is active
    const isActive = isSubscriptionActive(user);
    const hasReachedLimit = hasReachedUsageLimit(user);
    const daysRemaining = getDaysRemaining(user);

    // Admin users bypass all restrictions
    if (user.is_admin) {
      req.user = user;
      req.subscription = {
        isActive: true,
        hasReachedLimit: false,
        daysRemaining: 999,
        status: 'admin'
      };
      await pool.end();
      return next();
    }

    // Check subscription status
    if (!isActive) {
      await pool.end();
      return res.status(403).json({
        error: 'Subscription expired',
        message: 'Your subscription has expired. Please upgrade to continue using the service.',
        subscriptionStatus: {
          isActive: false,
          daysRemaining: 0,
          status: user.subscription_status
        }
      });
    }

    // Check usage limits
    if (hasReachedLimit) {
      await pool.end();
      return res.status(403).json({
        error: 'Usage limit reached',
        message: 'You have reached your usage limit. Please upgrade your plan to continue.',
        subscriptionStatus: {
          isActive: true,
          hasReachedLimit: true,
          usageCount: user.usage_count,
          usageLimit: user.usage_limit,
          daysRemaining
        }
      });
    }

    // Attach user and subscription info to request
    req.user = user;
    req.subscription = {
      isActive,
      hasReachedLimit,
      daysRemaining,
      status: user.subscription_status,
      plan: user.subscription_plan,
      usageCount: user.usage_count,
      usageLimit: user.usage_limit
    };

    await pool.end();
    next();

  } catch (error) {
    console.error('Subscription verification error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }

    res.status(500).json({
      error: 'Subscription verification failed',
      details: error.message
    });
  }
}

// Middleware to increment usage count for actions that consume API usage
async function incrementUsage(req, res, next) {
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    // Skip incrementing for admin users
    if (req.user.is_admin) {
      await pool.end();
      return next();
    }

    // Increment usage count
    await pool.query(
      'UPDATE users SET usage_count = usage_count + 1 WHERE id = $1',
      [req.user.id]
    );

    await pool.end();
    next();

  } catch (error) {
    console.error('Usage increment error:', error);
    // Don't block the request if usage increment fails
    next();
  }
}

module.exports = {
  verifySubscription,
  incrementUsage
};