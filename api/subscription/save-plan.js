const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify JWT token and admin status
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

    // Check if user is admin
    const userQuery = 'SELECT is_admin FROM users WHERE id = $1';
    const userResult = await pool.query(userQuery, [decoded.userId]);

    if (userResult.rows.length === 0) {
      await pool.end();
      return res.status(404).json({ error: 'User not found' });
    }

    if (!userResult.rows[0].is_admin) {
      await pool.end();
      return res.status(403).json({ error: 'Admin access required' });
    }

    const {
      id,
      plan_key,
      name,
      description,
      price_monthly,
      price_yearly,
      usage_limit,
      features,
      is_active,
      sort_order
    } = req.body;

    // Validate required fields
    if (!plan_key || !name || price_monthly === undefined) {
      await pool.end();
      return res.status(400).json({ error: 'Plan key, name, and monthly price are required' });
    }

    // Convert features array to PostgreSQL array format
    const featuresArray = Array.isArray(features) ? features : [];

    let result;

    if (id) {
      // Update existing plan
      const updateQuery = `
        UPDATE subscription_plans SET
          plan_key = $1,
          name = $2,
          description = $3,
          price_monthly = $4,
          price_yearly = $5,
          usage_limit = $6,
          features = $7,
          is_active = $8,
          sort_order = $9,
          updated_at = NOW()
        WHERE id = $10
        RETURNING *
      `;

      result = await pool.query(updateQuery, [
        plan_key,
        name,
        description || null,
        parseFloat(price_monthly),
        price_yearly ? parseFloat(price_yearly) : null,
        usage_limit || null,
        featuresArray,
        is_active !== false,
        parseInt(sort_order) || 0,
        id
      ]);

      if (result.rows.length === 0) {
        await pool.end();
        return res.status(404).json({ error: 'Subscription plan not found' });
      }
    } else {
      // Create new plan
      const insertQuery = `
        INSERT INTO subscription_plans
        (plan_key, name, description, price_monthly, price_yearly, usage_limit, features, is_active, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;

      result = await pool.query(insertQuery, [
        plan_key,
        name,
        description || null,
        parseFloat(price_monthly),
        price_yearly ? parseFloat(price_yearly) : null,
        usage_limit || null,
        featuresArray,
        is_active !== false,
        parseInt(sort_order) || 0
      ]);
    }

    await pool.end();

    res.json({
      success: true,
      plan: result.rows[0],
      message: id ? 'Subscription plan updated successfully' : 'Subscription plan created successfully'
    });

  } catch (error) {
    console.error('Error saving subscription plan:', error);

    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({
        error: 'Plan key already exists',
        details: 'A subscription plan with this key already exists'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }

    res.status(500).json({
      error: 'Failed to save subscription plan',
      details: error.message
    });
  }
};