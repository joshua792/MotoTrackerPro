const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
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

    // Add user_id column to events table if it doesn't exist
    try {
      const checkUserIdColumn = `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'events' AND column_name = 'user_id'
      `;
      const columnExists = await pool.query(checkUserIdColumn);

      if (columnExists.rows.length === 0) {
        console.log('Adding user_id column to events table...');
        await pool.query('ALTER TABLE events ADD COLUMN user_id UUID REFERENCES users(id)');
      }
    } catch (alterError) {
      console.error('Error checking/adding user_id column:', alterError);
    }

    // Get events for this user only
    const result = await pool.query(
      'SELECT * FROM events WHERE user_id = $1 ORDER BY date DESC',
      [decoded.userId]
    );

    await pool.end();

    return res.status(200).json({ events: result.rows });
  } catch (error) {
    console.error('Database error:', error);

    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    return res.status(500).json({ error: 'Database error', details: error.message });
  }
};
