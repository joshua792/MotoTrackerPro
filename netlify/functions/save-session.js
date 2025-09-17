const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    await client.connect();
    
    // Create table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(255) PRIMARY KEY,
        event_id VARCHAR(100) NOT NULL,
        motorcycle_id VARCHAR(255) NOT NULL,
        session_type VARCHAR(50) NOT NULL,
        front_spring VARCHAR(50),
        front_preload VARCHAR(50),
        front_compression VARCHAR(50),
        front_rebound VARCHAR(50),
        rear_spring VARCHAR(50),
        rear_preload VARCHAR(50),
        rear_compression VARCHAR(50),
        rear_rebound VARCHAR(50),
        front_sprocket VARCHAR(50),
        rear_sprocket VARCHAR(50),
        swingarm_length VARCHAR(50),
        front_tire VARCHAR(100),
        rear_tire VARCHAR(100),
        front_pressure VARCHAR(50),
        rear_pressure VARCHAR(50),
        rake VARCHAR(50),
        trail VARCHAR(50),
        notes TEXT,
        feedback TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const sessionData = JSON.parse(event.body);
    const sessionId = `${sessionData.event}_${sessionData.motorcycle.id}_${sessionData.session}`;

    // Insert or update session
    const result = await client.query(
      `INSERT INTO sessions (
        id, event_id, motorcycle_id, session_type,
        front_spring, front_preload, front_compression, front_rebound,
        rear_spring, rear_preload, rear_compression, rear_rebound,
        front_sprocket, rear_sprocket, swingarm_length,
        front_tire, rear_tire, front_pressure, rear_pressure,
        rake, trail, notes, feedback, updated_at
       ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, CURRENT_TIMESTAMP
       ) ON CONFLICT (id) DO UPDATE SET
        front_spring = $5, front_preload = $6, front_compression = $7, front_rebound = $8,
        rear_spring = $9, rear_preload = $10, rear_compression = $11, rear_rebound = $12,
        front_sprocket = $13, rear_sprocket = $14, swingarm_length = $15,
        front_tire = $16, rear_tire = $17, front_pressure = $18, rear_pressure = $19,
        rake = $20, trail = $21, notes = $22, feedback = $23, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        sessionId, sessionData.event, sessionData.motorcycle.id, sessionData.session,
        sessionData.frontSpring, sessionData.frontPreload, sessionData.frontCompression, sessionData.frontRebound,
        sessionData.rearSpring, sessionData.rearPreload, sessionData.rearCompression, sessionData.rearRebound,
        sessionData.frontSprocket, sessionData.rearSprocket, sessionData.swingarmLength,
        sessionData.frontTire, sessionData.rearTire, sessionData.frontPressure, sessionData.rearPressure,
        sessionData.rake, sessionData.trail, sessionData.notes, sessionData.feedback
      ]
    );

    await client.end();

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({ success: true, session: result.rows[0] })
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
