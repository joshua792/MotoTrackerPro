import { Client } from 'pg';

export default async function handler(req, res) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sessions' 
      ORDER BY ordinal_position
    `);
    
    await client.end();
    return res.status(200).json({ columns: result.rows });
  } catch (error) {
    try { await client.end(); } catch {}
    return res.status(500).json({ error: error.message });
  }
}
