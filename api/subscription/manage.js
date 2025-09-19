require('dotenv').config();
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify JWT token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    // Get user data
    const userQuery = `
      SELECT id, email, name, stripe_customer_id, stripe_subscription_id, subscription_status
      FROM users WHERE id = $1
    `;
    const userResult = await pool.query(userQuery, [decoded.userId]);

    if (userResult.rows.length === 0) {
      await pool.end();
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const { action } = req.body;

    if (!action) {
      await pool.end();
      return res.status(400).json({ error: 'Action is required' });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      await pool.end();
      return res.status(500).json({ error: 'Stripe configuration missing' });
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    let result = {};

    switch (action) {
      case 'cancel':
        result = await cancelSubscription(pool, stripe, user);
        break;

      case 'reactivate':
        result = await reactivateSubscription(pool, stripe, user);
        break;

      case 'get_portal_url':
        result = await createPortalSession(stripe, user, req);
        break;

      default:
        await pool.end();
        return res.status(400).json({ error: 'Invalid action' });
    }

    await pool.end();
    res.json(result);

  } catch (error) {
    console.error('Subscription management error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }

    res.status(500).json({
      error: 'Subscription management failed',
      details: error.message
    });
  }
};

// Cancel subscription
async function cancelSubscription(pool, stripe, user) {
  if (!user.stripe_subscription_id) {
    return { error: 'No active subscription found' };
  }

  try {
    // Cancel subscription at period end (so user keeps access until end of billing period)
    const subscription = await stripe.subscriptions.update(user.stripe_subscription_id, {
      cancel_at_period_end: true
    });

    // Update database
    await pool.query(`
      UPDATE users SET
        subscription_status = 'cancelled',
        updated_at = NOW()
      WHERE id = $1
    `, [user.id]);

    return {
      success: true,
      message: 'Subscription will be canceled at the end of your current billing period',
      subscription: subscription
    };
  } catch (error) {
    console.error('Cancel subscription error:', error);
    return { error: 'Failed to cancel subscription: ' + error.message };
  }
}

// Reactivate subscription
async function reactivateSubscription(pool, stripe, user) {
  if (!user.stripe_subscription_id) {
    return { error: 'No subscription found' };
  }

  try {
    // Remove the cancellation
    const subscription = await stripe.subscriptions.update(user.stripe_subscription_id, {
      cancel_at_period_end: false
    });

    // Update database
    await pool.query(`
      UPDATE users SET
        subscription_status = 'active',
        updated_at = NOW()
      WHERE id = $1
    `, [user.id]);

    return {
      success: true,
      message: 'Subscription reactivated successfully',
      subscription: subscription
    };
  } catch (error) {
    console.error('Reactivate subscription error:', error);
    return { error: 'Failed to reactivate subscription: ' + error.message };
  }
}

// Create Stripe customer portal session
async function createPortalSession(stripe, user, req) {
  if (!user.stripe_customer_id) {
    return { error: 'No Stripe customer found' };
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${req.headers.origin || 'https://motosetuppro.com'}`
    });

    return {
      success: true,
      portal_url: session.url
    };
  } catch (error) {
    console.error('Create portal session error:', error);
    return { error: 'Failed to create portal session: ' + error.message };
  }
}