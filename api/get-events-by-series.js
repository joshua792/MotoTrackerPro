const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

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

    const { series } = req.query;

    if (!series) {
      await pool.end();
      return res.status(400).json({ error: 'Series parameter is required' });
    }

    // Get all events for the specified series (not just user's events)
    const query = `
      SELECT e.*, t.name as track_name, t.location as track_location,
             COUNT(CASE WHEN s.user_id = $1 THEN 1 END) as user_sessions
      FROM events e
      LEFT JOIN tracks t ON e.track_id = t.id
      LEFT JOIN sessions s ON e.id = s.event_id
      WHERE e.series = $2
      GROUP BY e.id, t.name, t.location
      ORDER BY e.date DESC
    `;

    const result = await pool.query(query, [decoded.userId, series]);

    await pool.end();

    // Add metadata to help user understand their relationship to each event
    const eventsWithMetadata = result.rows.map(event => ({
      ...event,
      user_has_sessions: event.user_sessions > 0,
      session_count: parseInt(event.user_sessions)
    }));

    res.json({
      success: true,
      events: eventsWithMetadata,
      series: series
    });

  } catch (error) {
    console.error('Get events by series error:', error);
    res.status(500).json({
      error: 'Failed to get events by series',
      details: error.message
    });
  }
};