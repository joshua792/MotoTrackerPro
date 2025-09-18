const { Pool } = require('pg');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    // First check if columns already exist
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'sessions' 
      AND column_name IN ('temperature', 'humidity', 'pressure', 'wind_speed', 'wind_direction', 'conditions', 'cloud_cover', 'latitude', 'longitude')
    `;
    
    const existingColumns = await pool.query(checkQuery);
    
    if (existingColumns.rows.length > 0) {
      await pool.end();
      return res.json({
        success: true,
        message: 'Weather columns already exist',
        columnsAdded: existingColumns.rows.map(row => row.column_name)
      });
    }

    // Add weather columns to sessions table
    const alterQueries = [
      'ALTER TABLE sessions ADD COLUMN IF NOT EXISTS temperature INTEGER',
      'ALTER TABLE sessions ADD COLUMN IF NOT EXISTS humidity INTEGER', 
      'ALTER TABLE sessions ADD COLUMN IF NOT EXISTS pressure INTEGER',
      'ALTER TABLE sessions ADD COLUMN IF NOT EXISTS wind_speed INTEGER',
      'ALTER TABLE sessions ADD COLUMN IF NOT EXISTS wind_direction INTEGER',
      'ALTER TABLE sessions ADD COLUMN IF NOT EXISTS conditions VARCHAR(100)',
      'ALTER TABLE sessions ADD COLUMN IF NOT EXISTS cloud_cover INTEGER',
      'ALTER TABLE sessions ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8)',
      'ALTER TABLE sessions ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8)'
    ];

    // Execute each ALTER TABLE statement
    for (const query of alterQueries) {
      await pool.query(query);
    }

    await pool.end();

    res.json({
      success: true,
      message: 'Weather columns added successfully',
      columnsAdded: [
        'temperature', 'humidity', 'pressure', 'wind_speed', 
        'wind_direction', 'conditions', 'cloud_cover', 
        'latitude', 'longitude'
      ]
    });

  } catch (error) {
    console.error('Database migration error:', error);
    res.status(500).json({ 
      error: 'Failed to add weather columns',
      details: error.message 
    });
  }
}
