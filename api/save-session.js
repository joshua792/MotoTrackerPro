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
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    const sessionData = req.body;
    const sessionId = `${sessionData.event}_${sessionData.motorcycle.id}_${sessionData.session}`;

    const result = await client.query(
      `INSERT INTO sessions (
        id, event_id, motorcycle_id, session_type,
        front_spring, front_preload, front_compression, front_rebound,
        rear_spring, rear_preload, rear_compression, rear_rebound,
        front_sprocket, rear_sprocket, swingarm_length,
        front_tire, rear_tire, front_pressure, rear_pressure,
        rake, trail, notes, feedback,
        front_ride_height, rear_ride_height, front_sag, rear_sag, swingarm_angle,
        weather_temperature, weather_condition, weather_description, 
        weather_humidity, weather_wind_speed, weather_captured_at,
        updated_at
       ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28,
        $29, $30, $31, $32, $33, $34, CURRENT_TIMESTAMP
       ) ON CONFLICT (id) DO UPDATE SET
        front_spring = $5, front_preload = $6, front_compression = $7, front_rebound = $8,
        rear_spring = $9, rear_preload = $10, rear_compression = $11, rear_rebound = $12,
        front_sprocket = $13, rear_sprocket = $14, swingarm_length = $15,
        front_tire = $16, rear_tire = $17, front_pressure = $18, rear_pressure = $19,
        rake = $20, trail = $21, notes = $22, feedback = $23,
        front_ride_height = $24, rear_ride_height = $25, front_sag = $26, rear_sag = $27, 
        swingarm_angle = $28, weather_temperature = $29, weather_condition = $30, 
        weather_description = $31, weather_humidity = $32, weather_wind_speed = $33,
        weather_captured_at = $34, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        sessionId, sessionData.event, sessionData.motorcycle.id, sessionData.session,
        sessionData.frontSpring || '', sessionData.frontPreload || '', sessionData.frontCompression || '', sessionData.frontRebound || '',
        sessionData.rearSpring || '', sessionData.rearPreload || '', sessionData.rearCompression || '', sessionData.rearRebound || '',
        sessionData.frontSprocket || '', sessionData.rearSprocket || '', sessionData.swingarmLength || '',
        sessionData.frontTire || '', sessionData.rearTire || '', sessionData.frontPressure || '', sessionData.rearPressure || '',
        sessionData.rake || '', sessionData.trail || '', sessionData.notes || '', sessionData.feedback || '',
        sessionData.frontRideHeight || '', sessionData.rearRideHeight || '', sessionData.frontSag || '', sessionData.rearSag || '',
        sessionData.swingarmAngle || '', sessionData.weatherTemperature || '', sessionData.weatherCondition || '',
        sessionData.weatherDescription || '', sessionData.weatherHumidity || '', sessionData.weatherWindSpeed || '',
        sessionData.weatherCapturedAt || null
      ]
    );

    await client.end();
    return res.status(200).json({ success: true, session: result.rows[0] });

  } catch (error) {
    console.error('Database error:', error);
    try { await client.end(); } catch {}
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}
