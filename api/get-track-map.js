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

    const { trackId } = req.query;

    if (!trackId) {
      return res.status(400).json({ error: 'Track ID is required' });
    }

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    // Get track map data
    const result = await pool.query(
      'SELECT track_map_data, track_map_filename FROM tracks WHERE id = $1',
      [trackId]
    );

    await pool.end();

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Track not found' });
    }

    const track = result.rows[0];

    if (!track.track_map_data) {
      return res.status(404).json({ error: 'No track map available' });
    }

    // Determine content type based on filename
    let contentType = 'image/jpeg';
    if (track.track_map_filename) {
      const ext = track.track_map_filename.toLowerCase().split('.').pop();
      switch (ext) {
        case 'png':
          contentType = 'image/png';
          break;
        case 'gif':
          contentType = 'image/gif';
          break;
        case 'webp':
          contentType = 'image/webp';
          break;
        default:
          contentType = 'image/jpeg';
      }
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${track.track_map_filename || 'track-map.jpg'}"`);
    res.send(track.track_map_data);

  } catch (error) {
    console.error('Error fetching track map:', error);
    res.status(500).json({
      error: 'Failed to fetch track map',
      details: error.message
    });
  }
};