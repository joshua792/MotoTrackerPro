const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  // ... rest of code
  return res.status(200).json({ motorcycles: result.rows });
}

  try {
    await client.connect();
    
    const { id } = event.queryStringParameters || {};

    if (!id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Motorcycle ID required' })
      };
    }

    // Delete associated sessions first
    await client.query('DELETE FROM sessions WHERE motorcycle_id = $1', [id]);
    
    // Delete motorcycle
    const result = await client.query('DELETE FROM motorcycles WHERE id = $1 RETURNING *', [id]);
    await client.end();

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'DELETE, OPTIONS'
      },
      body: JSON.stringify({ success: true, deleted: result.rows[0] })
    };

  } catch (error) {
    console.error('Database error:', error);
    await client.end();
    
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Database error', details: error.message })
    };
  }
};
