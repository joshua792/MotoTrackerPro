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
    
    const columns = [
      'weather_temperature VARCHAR(10)',
      'weather_condition VARCHAR(50)',
      'weather_description VARCHAR(100)',
      'weather_humidity VARCHAR(10)',
      'weather_wind_speed VARCHAR(10)',
      'weather_captured_at TIMESTAMP'
    ];

    for (const column of columns) {
      try {
        await client.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ${column}`);
        console.log(`Added weather column: ${column}`);
      } catch (error) {
        console.log(`Weather column might already exist: ${column}`);
      }
    }

    await client.end();
    return res.status(200).json({ success: true, message: 'Weather columns added' });

  } catch (error) {
    console.error('Database error:', error);
    try { await client.end(); } catch {}
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}
