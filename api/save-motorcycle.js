import { Client } from 'pg';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
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
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS motorcycles (
        id VARCHAR(255) PRIMARY KEY,
        make VARCHAR(100) NOT NULL,
        model VARCHAR(100) NOT NULL,
        class VARCHAR(100) NOT NULL,
        number VARCHAR(10) NOT NULL,
        variant VARCHAR(10) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const { id, make, model, class: bikeClass, number, variant } = req.body;

    const result = await client.query(
      `INSERT INTO motorcycles (id, make, model, class, number, variant, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         make = $2, model = $3, class = $4, number = $5, variant = $6, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [id, make, model, bikeClass, number, variant]
    );

    await client.end();

    return res.status(200).json({ success: true, motorcycle: result.rows[0] });

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
