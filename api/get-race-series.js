const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    // Create race_series table if it doesn't exist
    try {
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS race_series (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL UNIQUE,
          description TEXT,
          website VARCHAR(255),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          user_id UUID REFERENCES users(id),
          is_active BOOLEAN DEFAULT TRUE
        )
      `;
      await pool.query(createTableQuery);

      // Create index for faster lookups
      await pool.query('CREATE INDEX IF NOT EXISTS idx_race_series_name ON race_series(name)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_race_series_active ON race_series(is_active)');

      // Insert default race series if table is empty
      const countQuery = 'SELECT COUNT(*) FROM race_series';
      const countResult = await pool.query(countQuery);

      if (parseInt(countResult.rows[0].count) === 0) {
        const defaultSeries = [
          'MotoAmerica',
          'WERA',
          'CMRA',
          'AFM',
          'American Flat Track',
          'CRA',
          'NESBA',
          'LRRS',
          'CCS',
          'WMRRA',
          'Other'
        ];

        for (const series of defaultSeries) {
          await pool.query(
            'INSERT INTO race_series (name, description, is_active) VALUES ($1, $2, $3)',
            [series, `${series} racing series`, true]
          );
        }
      }
    } catch (tableError) {
      console.error('Error creating race_series table:', tableError);
    }

    // Get all race series
    const query = 'SELECT * FROM race_series WHERE is_active = TRUE ORDER BY name';
    const result = await pool.query(query);

    await pool.end();

    res.json({
      success: true,
      raceSeries: result.rows
    });

  } catch (error) {
    console.error('Error fetching race series:', error);
    res.status(500).json({
      error: 'Failed to fetch race series',
      details: error.message
    });
  }
};