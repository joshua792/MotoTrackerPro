require('dotenv').config();
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify JWT token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this-in-production');

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    const { motorcycleId, currentEventId } = req.query;

    if (!motorcycleId) {
      await pool.end();
      return res.status(400).json({ error: 'Motorcycle ID is required' });
    }

    // Get the most recent session for this motorcycle from any event (excluding current event)
    const query = `
      SELECT s.*, e.name as event_name, e.track, e.date as event_date
      FROM sessions s
      JOIN events e ON s.event_id = e.id
      WHERE s.motorcycle_id = $1
        AND e.user_id = $2
        ${currentEventId ? 'AND e.id != $3' : ''}
      ORDER BY e.date DESC, s.updated_at DESC
      LIMIT 1
    `;

    const params = [motorcycleId, decoded.userId];
    if (currentEventId) {
      params.push(currentEventId);
    }

    const result = await pool.query(query, params);

    await pool.end();

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        session: null,
        message: 'No previous sessions found for this motorcycle'
      });
    }

    const session = result.rows[0];

    res.json({
      success: true,
      session: {
        // Setup data
        frontSpring: session.front_spring,
        frontPreload: session.front_preload,
        frontCompression: session.front_compression,
        frontRebound: session.front_rebound,
        rearSpring: session.rear_spring,
        rearPreload: session.rear_preload,
        rearCompression: session.rear_compression,
        rearRebound: session.rear_rebound,

        // Geometry data
        frontRideHeight: session.front_ride_height,
        rearRideHeight: session.rear_ride_height,
        frontSag: session.front_sag,
        rearSag: session.rear_sag,
        swingarmAngle: session.swingarm_angle,

        // Drivetrain & misc
        frontSprocket: session.front_sprocket,
        rearSprocket: session.rear_sprocket,
        swingarmLength: session.swingarm_length,
        frontTire: session.front_tire,
        rearTire: session.rear_tire,
        frontPressure: session.front_pressure,
        rearPressure: session.rear_pressure,
        rake: session.rake,
        trail: session.trail,

        // Metadata
        eventName: session.event_name,
        track: session.track,
        eventDate: session.event_date,
        sessionType: session.session_type
      },
      message: `Found most recent session from ${session.event_name} (${new Date(session.event_date).toLocaleDateString()})`
    });

  } catch (error) {
    console.error('Get most recent session error:', error);
    res.status(500).json({
      error: 'Failed to get most recent session',
      details: error.message
    });
  }
};