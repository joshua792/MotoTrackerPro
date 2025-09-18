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
    
    // Add the missing columns one by one
    const columns = [
      'front_ride_height VARCHAR(50)',
      'rear_ride_height VARCHAR(50)',
      'front_sag VARCHAR(50)',
      'rear_sag VARCHAR(50)',
      'swingarm_angle VARCHAR(50)'
    ];

    for (const column of columns) {
      try {
        await client.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ${column}`);
        console.log(`Added column: ${column}`);
      } catch (error) {
        console.log(`Column might already exist: ${column}`, error.message);
      }
    }

    await client.end();
    return res.status(200).json({ success: true, message: 'Geometry columns added successfully' });

  } catch (error) {
    console.error('Database error:', error);
    try { await client.end(); } catch {}
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}
