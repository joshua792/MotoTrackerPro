import { Client } from 'pg';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const { id, name, track, date, location } = req.body;

    const result = await client.query(
      `INSERT INTO events (id, name, track, date, location)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         name = $2, track = $3, date = $4, location = $5
       RETURNING *`,
      [id, name, track, date, location]
    );

    await client.end();
    return res.status(200).json({ success: true, event: result.rows[0] });
  } catch (error) {
    console.error('Database error:', error);
    try { await client.end(); } catch {}
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}
