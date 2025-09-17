const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    await client.connect();
    
    const { event_id, motorcycle_id } = event.queryStringParameters || {};
    
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

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      },
      body: JSON.stringify({ sessions: result.rows })
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
