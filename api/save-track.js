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
      return res.status(403).json({ error: 'Admin access required to manage tracks' });
    }

    const {
      id, name, location, country, description,
      length_miles, length_km, turns, direction,
      track_map_data, track_map_filename
    } = req.body;

    if (!name || !location) {
      await pool.end();
      return res.status(400).json({ error: 'Track name and location are required' });
    }

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

    let result;
    if (id) {
      // Update existing track
      const updateQuery = `
        UPDATE tracks SET
          name = $1, location = $2, country = $3, description = $4,
          length_miles = $5, length_km = $6, turns = $7, direction = $8,
          track_map_data = $9, track_map_filename = $10, updated_at = NOW()
        WHERE id = $11
        RETURNING *
      `;

      result = await pool.query(updateQuery, [
        name, location, country, description,
        length_miles, length_km, turns, direction,
        track_map_data ? Buffer.from(track_map_data, 'base64') : null,
        track_map_filename, id
      ]);
    } else {
      // Create new track
      const insertQuery = `
        INSERT INTO tracks (
          name, location, country, description,
          length_miles, length_km, turns, direction,
          track_map_data, track_map_filename, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;

      result = await pool.query(insertQuery, [
        name, location, country, description,
        length_miles, length_km, turns, direction,
        track_map_data ? Buffer.from(track_map_data, 'base64') : null,
        track_map_filename, decoded.userId
      ]);
    }

    await pool.end();

    res.json({
      success: true,
      track: result.rows[0],
      message: id ? 'Track updated successfully' : 'Track created successfully'
    });

  } catch (error) {
    console.error('Error saving track:', error);
    res.status(500).json({
      error: 'Failed to save track',
      details: error.message
    });
  }
};