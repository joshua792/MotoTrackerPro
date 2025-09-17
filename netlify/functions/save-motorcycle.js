const { Client } = require('pg');

exports.handler = async (event, context) => {
  // Handle preflight CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('Database connected successfully');
    
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
    console.log('Table created/verified');

    const requestBody = JSON.parse(event.body);
    console.log('Request body:', requestBody);

    const { id, make, model, class: bikeClass, number, variant } = requestBody;

    console.log('Parsed data:', { id, make, model, bikeClass, number, variant });

    // Insert or update motorcycle
    const result = await client.query(
      `INSERT INTO motorcycles (id, make, model, class, number, variant, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         make = $2, model = $3, class = $4, number = $5, variant = $6, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [id, make, model, bikeClass, number, variant]
    );

    console.log('Query result:', result.rows[0]);
    await client.end();

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({ success: true, motorcycle: result.rows[0] })
    };

  } catch (error) {
    console.error('Detailed error:', error);
    
    try {
      await client.end();
    } catch (cl
