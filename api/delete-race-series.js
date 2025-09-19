const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

module.exports = async function handler(req, res) {
  if (req.method !== 'DELETE') {
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
      return res.status(400).json({ error: 'Race series ID is required' });
    }

    // Check if race series is being used by any events
    const eventsQuery = 'SELECT COUNT(*) FROM events WHERE series = (SELECT name FROM race_series WHERE id = $1)';
    const eventsResult = await pool.query(eventsQuery, [id]);

    if (parseInt(eventsResult.rows[0].count) > 0) {
      // Don't delete, just deactivate
      const deactivateQuery = 'UPDATE race_series SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING *';
      const result = await pool.query(deactivateQuery, [id]);

      if (result.rows.length === 0) {
        await pool.end();
        return res.status(404).json({ error: 'Race series not found' });
      }

      await pool.end();
      return res.json({
        success: true,
        message: 'Race series deactivated (it is being used by existing events)',
        raceSeries: result.rows[0]
      });
    } else {
      // Safe to delete since no events are using it
      const deleteQuery = 'DELETE FROM race_series WHERE id = $1 RETURNING *';
      const result = await pool.query(deleteQuery, [id]);

      if (result.rows.length === 0) {
        await pool.end();
        return res.status(404).json({ error: 'Race series not found' });
      }

      await pool.end();
      return res.json({
        success: true,
        message: 'Race series deleted successfully',
        raceSeries: result.rows[0]
      });
    }

  } catch (error) {
    console.error('Error deleting race series:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }

    res.status(500).json({
      error: 'Failed to delete race series',
      details: error.message
    });
  }
};