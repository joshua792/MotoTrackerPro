const { Pool } = require('pg');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { track, motorcycle } = req.query;

  if (!track) {
    return res.status(400).json({ error: 'Track parameter is required' });
  }

  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    // Query sessions by track using the events table join
    let query = `
      SELECT 
        s.id, s.session_type, s.notes, s.feedback, s.created_at,
        s.front_spring, s.front_preload, s.front_compression, s.front_rebound,
        s.rear_spring, s.rear_preload, s.rear_compression, s.rear_rebound,
        s.front_sprocket, s.rear_sprocket, s.swingarm_length,
        s.front_tire, s.rear_tire, s.front_pressure, s.rear_pressure,
        s.rake, s.trail, s.front_ride_height, s.rear_ride_height,
        s.front_sag, s.rear_sag, s.swingarm_angle,
        s.temperature, s.humidity, s.pressure as atmospheric_pressure,
        s.wind_speed, s.wind_direction, s.conditions, s.cloud_cover,
        e.name as event_name, e.track, e.date as event_date, e.location,
        m.make, m.model, m.class as motorcycle_class, m.number
      FROM sessions s
      JOIN events e ON s.event_id = e.id
      JOIN motorcycles m ON s.motorcycle_id = m.id
      WHERE LOWER(e.track) = LOWER($1)
    `;

    const params = [track];

    // Add motorcycle filter if specified
    if (motorcycle) {
      query += ` AND s.motorcycle_id = $2`;
      params.push(motorcycle);
    }

    // Order by most recent first
    query += ` ORDER BY e.date DESC, s.created_at DESC LIMIT 10`;

    console.log('Executing query:', query);
    console.log('With params:', params);

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      await pool.end();
      return res.json({
        success: true,
        sessions: [],
        message: `No previous sessions found for track: ${track}`,
        track: track
      });
    }

    // Calculate suggested setup values from recent sessions (last 3)
    const recentSessions = result.rows.slice(0, 3);
    let suggestions = null;

    if (recentSessions.length > 0) {
      const totals = recentSessions.reduce((acc, session) => {
        const addIfNumeric = (field, value) => {
          const num = parseFloat(value);
          if (!isNaN(num) && value !== '') {
            acc[field].sum += num;
            acc[field].count++;
          }
        };

        addIfNumeric('frontCompression', session.front_compression);
        addIfNumeric('frontRebound', session.front_rebound);
        addIfNumeric('frontPreload', session.front_preload);
        addIfNumeric('rearCompression', session.rear_compression);
        addIfNumeric('rearRebound', session.rear_rebound);
        addIfNumeric('rearPreload', session.rear_preload);
        addIfNumeric('frontPressure', session.front_pressure);
        addIfNumeric('rearPressure', session.rear_pressure);
        addIfNumeric('frontRideHeight', session.front_ride_height);
        addIfNumeric('rearRideHeight', session.rear_ride_height);

        return acc;
      }, {
        frontCompression: { sum: 0, count: 0 },
        frontRebound: { sum: 0, count: 0 },
        frontPreload: { sum: 0, count: 0 },
        rearCompression: { sum: 0, count: 0 },
        rearRebound: { sum: 0, count: 0 },
        rearPreload: { sum: 0, count: 0 },
        frontPressure: { sum: 0, count: 0 },
        rearPressure: { sum: 0, count: 0 },
        frontRideHeight: { sum: 0, count: 0 },
        rearRideHeight: { sum: 0, count: 0 }
      });

      // Calculate averages where we have data
      suggestions = {};
      Object.keys(totals).forEach(key => {
        if (totals[key].count > 0) {
          suggestions[key] = Math.round(totals[key].sum / totals[key].count * 10) / 10;
        }
      });

      suggestions.basedOnSessions = recentSessions.length;
    }

    await pool.end();

    res.json({
      success: true,
      sessions: result.rows,
      count: result.rows.length,
      track: track,
      mostRecent: {
        date: result.rows[0].event_date,
        eventName: result.rows[0].event_name,
        motorcycle: `${result.rows[0].make} ${result.rows[0].model}`,
        notes: result.rows[0].notes
      },
      suggestions: suggestions
    });

  } catch (error) {
    console.error('Previous track data error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch previous track data',
      details: error.message,
      track: track
    });
  }
};
