const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

module.exports = async function handler(req, res) {
  if (req.method !== 'DELETE') {
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

    const { id } = req.query;

    if (!id) {
      await pool.end();
      return res.status(400).json({ error: 'Plan ID is required' });
    }

    // Check if plan is being used by any users
    const usersQuery = 'SELECT COUNT(*) FROM users WHERE subscription_plan = (SELECT plan_key FROM subscription_plans WHERE id = $1)';
    const usersResult = await pool.query(usersQuery, [id]);

    if (parseInt(usersResult.rows[0].count) > 0) {
      // Don't delete, just deactivate
      const deactivateQuery = 'UPDATE subscription_plans SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING *';
      const result = await pool.query(deactivateQuery, [id]);

      if (result.rows.length === 0) {
        await pool.end();
        return res.status(404).json({ error: 'Subscription plan not found' });
      }

      await pool.end();
      return res.json({
        success: true,
        message: 'Subscription plan deactivated (it is being used by existing users)',
        plan: result.rows[0]
      });
    } else {
      // Safe to delete since no users are using it
      const deleteQuery = 'DELETE FROM subscription_plans WHERE id = $1 RETURNING *';
      const result = await pool.query(deleteQuery, [id]);

      if (result.rows.length === 0) {
        await pool.end();
        return res.status(404).json({ error: 'Subscription plan not found' });
      }

      await pool.end();
      return res.json({
        success: true,
        message: 'Subscription plan deleted successfully',
        plan: result.rows[0]
      });
    }

  } catch (error) {
    console.error('Error deleting subscription plan:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }

    res.status(500).json({
      error: 'Failed to delete subscription plan',
      details: error.message
    });
  }
};