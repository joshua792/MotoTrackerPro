const { Client } = require('pg');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  // ... rest of code
  return res.status(200).json({ motorcycles: result.rows });
}

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    
    // Create table if it doesn't exist
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
    
    const result = await client.query('SELECT * FROM motorcycles ORDER BY created_at DESC');
    await client.end();

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      },
      body: JSON.stringify({ motorcycles: result.rows })
    };

  } catch (error) {
    console.error('Database error:', error);
    
    try {
      await client.end();
    } catch (closeError) {
      console.error('Error closing client:', closeError);
    }
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Database error', details: error.message })
    };
  }
};
