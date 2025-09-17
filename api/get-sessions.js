import { Client } from 'pg';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    
    const { event_id, motorcycle_id } = req.query;
    
    let query = 'SELECT * FROM sessions ORDER BY updated_at DESC';
    let params = [];

    if (event_id && motorcycle_id) {
      query = 'SELECT * FROM sessions WHERE event_id = $1 AND motorcycle_id = $2 ORDER BY updated_at DESC';
      params = [event_id, motorcycle_id];
    } else if (motorcycle_id) {
      query = 'SELECT * FROM sessions WHERE motorcycle_id = $1 ORDER BY updated_at DESC';
      params = [motorcycle_id];
    }

    const result = await client.query(query, params);
    await client.end();

    return res.status(200).json({ sessions: result.rows });

  } catch (error) {
    console.error('Database error:', error);
    try {
      await client.end();
    } catch (closeError) {
      console.error('Error closing client:', closeError);
    }
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}
