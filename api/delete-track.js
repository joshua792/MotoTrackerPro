const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied. Please login.' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key-change-this-in-production'
    );

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    // Check if user is admin
    const adminQuery = 'SELECT is_admin FROM users WHERE id = $1';
    const adminResult = await pool.query(adminQuery, [decoded.userId]);

    if (adminResult.rows.length === 0 || !adminResult.rows[0].is_admin) {
      await pool.end();
      return res.status(403).json({ error: 'Admin access required to delete tracks' });
    }

    const { id } = req.body;

    if (!id) {
      await pool.end();
      return res.status(400).json({ error: 'Track ID is required' });
    }

    // Check if track exists
    const trackQuery = 'SELECT name FROM tracks WHERE id = $1';
    const trackResult = await pool.query(trackQuery, [id]);

    if (trackResult.rows.length === 0) {
      await pool.end();
      return res.status(404).json({ error: 'Track not found' });
    }

    // Check if track is being used in any events
    const eventsQuery = 'SELECT COUNT(*) as count FROM events WHERE track_id = $1';
    const eventsResult = await pool.query(eventsQuery, [id]);

    if (eventsResult.rows[0].count > 0) {
      await pool.end();
      return res.status(400).json({
        error: `Cannot delete track "${trackResult.rows[0].name}" because it is being used in ${eventsResult.rows[0].count} event(s). Please update or delete those events first.`
      });
    }

    // Delete the track
    await pool.query('DELETE FROM tracks WHERE id = $1', [id]);

    await pool.end();

    res.json({
      success: true,
      message: `Track "${trackResult.rows[0].name}" deleted successfully`
    });

  } catch (error) {
    console.error('Error deleting track:', error);
    res.status(500).json({
      error: 'Failed to delete track',
      details: error.message
    });
  }
};