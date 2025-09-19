import { Client } from 'pg';
const jwt = require('jsonwebtoken');

// Import subscription utilities
const {
  isSubscriptionActive,
  hasReachedUsageLimit,
  getDaysRemaining
} = require('./subscription/config');

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify authentication and subscription
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this-in-production');


    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    await client.connect();

    // Get user subscription data
    const userQuery = `
      SELECT id, subscription_status, trial_end_date, subscription_end_date,
             usage_count, usage_limit, is_admin
      FROM users WHERE id = $1
    `;

    const userResult = await client.query(userQuery, [decoded.userId]);

    if (userResult.rows.length === 0) {
      await client.end();
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Admin users bypass restrictions
    if (!user.is_admin) {
      // Check subscription status
      const isActive = isSubscriptionActive(user);
      const hasReachedLimit = hasReachedUsageLimit(user);

      if (!isActive) {
        await client.end();
        return res.status(403).json({
          error: 'Subscription expired',
          message: 'Your subscription has expired. Please upgrade to continue saving sessions.'
        });
      }

      if (hasReachedLimit) {
        await client.end();
        return res.status(403).json({
          error: 'Usage limit reached',
          message: 'You have reached your usage limit. Please upgrade your plan to continue.',
          usageCount: user.usage_count,
          usageLimit: user.usage_limit
        });
      }
    }
    
    const sessionData = req.body;
    const eventId = sessionData.event?.id || sessionData.event;
    const motorcycleId = sessionData.motorcycle?.id || sessionData.motorcycle;
    const sessionId = `${eventId}_${motorcycleId}_${sessionData.session}`;

    // Helper function to truncate strings to avoid database constraint errors
    const truncateString = (str, maxLength) => {
      if (!str) return '';
      return str.toString().substring(0, maxLength);
    };


    let result;
    try {
      result = await client.query(
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
        truncateString(sessionId, 255), eventId, motorcycleId, truncateString(sessionData.session, 100),
        truncateString(sessionData.frontSpring, 100), truncateString(sessionData.frontPreload, 100), truncateString(sessionData.frontCompression, 100), truncateString(sessionData.frontRebound, 100),
        truncateString(sessionData.rearSpring, 100), truncateString(sessionData.rearPreload, 100), truncateString(sessionData.rearCompression, 100), truncateString(sessionData.rearRebound, 100),
        truncateString(sessionData.frontSprocket, 100), truncateString(sessionData.rearSprocket, 100), truncateString(sessionData.swingarmLength, 100),
        truncateString(sessionData.frontTire, 150), truncateString(sessionData.rearTire, 150), truncateString(sessionData.frontPressure, 100), truncateString(sessionData.rearPressure, 100),
        truncateString(sessionData.rake, 100), truncateString(sessionData.trail, 100), truncateString(sessionData.notes, 1000), truncateString(sessionData.feedback, 1000),
        truncateString(sessionData.frontRideHeight, 100), truncateString(sessionData.rearRideHeight, 100), truncateString(sessionData.frontSag, 100), truncateString(sessionData.rearSag, 100),
        truncateString(sessionData.swingarmAngle, 100), truncateString(sessionData.weatherTemperature, 100), truncateString(sessionData.weatherCondition, 150),
        truncateString(sessionData.weatherDescription, 1000), truncateString(sessionData.weatherHumidity, 100), truncateString(sessionData.weatherWindSpeed, 100),
        sessionData.weatherCapturedAt || null
      ]
    );

    } catch (dbError) {
      console.error('Database error saving session:', dbError.message);
      throw dbError;
    }

    // Increment usage count for non-admin users
    if (!user.is_admin) {
      try {
        await client.query(
          'UPDATE users SET usage_count = usage_count + 1 WHERE id = $1',
          [user.id]
        );
      } catch (usageError) {
        console.error('Usage increment error:', usageError);
        // Don't block the session save if usage increment fails
      }
    }

    await client.end();
    return res.status(200).json({ success: true, session: result.rows[0] });

  } catch (error) {
    console.error('Database error:', error);
    try { await client.end(); } catch {}

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }

    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}
