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
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this-in-production');

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    const { plan = 'basic' } = req.body;

    console.log('Testing subscription update for user:', decoded.userId);

    // Calculate subscription dates
    const now = new Date();
    const subscriptionEndDate = new Date(now);
    subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1);

    // Get plan details from database
    const planQuery = 'SELECT usage_limit FROM subscription_plans WHERE plan_key = $1';
    const planResult = await pool.query(planQuery, [plan]);
    const usageLimit = planResult.rows.length > 0 ? planResult.rows[0].usage_limit : 500;

    console.log('Plan details found:', { plan, usageLimit });

    // Update user subscription status
    const updateQuery = `
      UPDATE users SET
        subscription_status = 'active',
        subscription_plan = $1,
        subscription_start_date = NOW(),
        subscription_end_date = $2,
        stripe_customer_id = 'test_customer',
        stripe_subscription_id = 'test_subscription',
        usage_limit = $3,
        updated_at = NOW()
      WHERE id = $4
    `;

    const updateResult = await pool.query(updateQuery, [plan, subscriptionEndDate, usageLimit, decoded.userId]);

    console.log('Update result:', {
      rowCount: updateResult.rowCount,
      command: updateResult.command
    });

    await pool.end();

    if (updateResult.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      message: `Test subscription activated for user ${decoded.userId}`,
      plan: plan,
      usageLimit: usageLimit,
      endDate: subscriptionEndDate
    });

  } catch (error) {
    console.error('Test update error:', error);
    res.status(500).json({
      error: 'Test update failed',
      details: error.message
    });
  }
};