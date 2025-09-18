import { Client } from 'pg';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    const { motorcycle_id, track } = req.query;
    
    if (!motorcycle_id || !track) {
      return res.status(400).json({ error: 'Motorcycle ID and track required' });
    }

    // Get the most recent session for this motorcycle at this track
    const result = await client.query(`
      SELECT s.* FROM sessions s
      JOIN events e ON s.event_id = e.id
      WHERE s.motorcycle_id = $1 AND e.track = $2
      ORDER BY s.updated_at DESC
      LIMIT 1
    `, [motorcycle_id, track]);

    await client.end();

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No previous data found for this track' });
    }

    return res.status(200).json({ previousSession: result.rows[0] });
  } catch (error) {
    console.error('Database error:', error);
    try { await client.end(); } catch {}
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}
