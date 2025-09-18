const { Pool } = require('pg');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { track, motorcycle } = req.query;

  if (!track) {
    return res.status(400).json({ error: 'Track parameter is required' });
  }

  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    // Check what columns actually exist in the sessions table
    const columnsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'sessions' 
      ORDER BY ordinal_position
    `;
    
    const columnsResult = await pool.query(columnsQuery);
    const availableColumns = columnsResult.rows.map(row => row.column_name);
    
    console.log('Available columns in sessions table:', availableColumns);

    // Since your database doesn't have track columns yet, return this info
    await pool.end();
    
    return res.json({
      success: true,
      sessions: [],
      message: 'Database schema detected - no track identification column found',
      availableColumns: availableColumns,
      recommendation: 'Add a track_name or location column to the sessions table to enable track filtering',
      track: track
    });

  } catch (error) {
    console.error('Previous track data error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch previous track data',
      details: error.message,
      track: track
    });
  }
};
