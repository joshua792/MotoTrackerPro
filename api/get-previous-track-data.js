import { Pool } from 'pg';

export default async function handler(req, res) {
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

    // Very simple query - just get basic session data
    const query = `
      SELECT id, date, track, session_type, notes
      FROM sessions 
      WHERE LOWER(track) = LOWER($1)
      ORDER BY date DESC, created_at DESC 
      LIMIT 5
    `;

    const result = await pool.query(query, [track]);
    await pool.end();

    res.json({
      success: true,
      sessions: result.rows,
      count: result.rows.length,
      track: track
    });

  } catch (error) {
    console.error('Simple previous track data error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch previous track data',
      details: error.message,
      track: track
    });
  }
}
