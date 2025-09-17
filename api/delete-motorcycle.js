import { Client } from 'pg';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
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
    
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'Motorcycle ID required' });
    }

    // Delete associated sessions first
    await client.query('DELETE FROM sessions WHERE motorcycle_id = $1', [id]);
    
    // Delete motorcycle
    const result = await client.query('DELETE FROM motorcycles WHERE id = $1 RETURNING *', [id]);
    await client.end();

    return res.status(200).json({ success: true, deleted: result.rows[0] });

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
