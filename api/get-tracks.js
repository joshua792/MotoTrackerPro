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

    // Create tracks table if it doesn't exist
    const createTracksTable = `
      CREATE TABLE IF NOT EXISTS tracks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255) NOT NULL,
        country VARCHAR(100),
        description TEXT,
        length_miles DECIMAL(4,2),
        length_km DECIMAL(4,2),
        turns INTEGER,
        direction VARCHAR(20) DEFAULT 'clockwise',
        track_map_url TEXT,
        track_map_data BYTEA,
        track_map_filename VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by UUID REFERENCES users(id)
      )
    `;

    await pool.query(createTracksTable);

    // Get all tracks
    const result = await pool.query(`
      SELECT id, name, location, country, description, length_miles, length_km,
             turns, direction, track_map_url, track_map_filename, created_at
      FROM tracks
      ORDER BY name ASC
    `);

    await pool.end();

    res.json({
      success: true,
      tracks: result.rows
    });

  } catch (error) {
    console.error('Error fetching tracks:', error);
    res.status(500).json({
      error: 'Failed to fetch tracks',
      details: error.message
    });
  }
};