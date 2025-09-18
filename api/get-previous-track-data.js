import { Pool } from 'pg';

export default async function handler(req, res) {
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

    // Build query to find previous sessions at this track
    let query = `
      SELECT 
        s.*,
        m.name as motorcycle_name,
        m.year as motorcycle_year,
        t.compound as tire_compound,
        t.front_size as tire_front_size,
        t.rear_size as tire_rear_size,
        e.name as event_name
      FROM sessions s
      LEFT JOIN motorcycles m ON s.motorcycle_id = m.id
      LEFT JOIN tires t ON s.tire_id = t.id
      LEFT JOIN events e ON s.event_id = e.id
      WHERE LOWER(s.track) = LOWER($1)
    `;

    const params = [track];

    // If motorcycle is specified, filter by that as well
    if (motorcycle) {
      query += ` AND s.motorcycle_id = $2`;
      params.push(motorcycle);
    }

    // Order by most recent first
    query += ` ORDER BY s.date DESC, s.created_at DESC LIMIT 10`;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      await pool.end();
      return res.json({
        success: true,
        sessions: [],
        message: 'No previous sessions found for this track'
      });
    }

    // Get the most recent session for default values
    const mostRecent = result.rows[0];

    // Calculate average values from recent sessions (last 3)
    const recentSessions = result.rows.slice(0, 3);
    
    const averages = recentSessions.reduce((acc, session) => {
      // Only include sessions with setup data
      if (session.front_compression !== null) {
        acc.count++;
        acc.frontCompression += parseFloat(session.front_compression) || 0;
        acc.frontRebound += parseFloat(session.front_rebound) || 0;
        acc.frontPreload += parseFloat(session.front_preload) || 0;
        acc.rearCompression += parseFloat(session.rear_compression) || 0;
        acc.rearRebound += parseFloat(session.rear_rebound) || 0;
        acc.rearPreload += parseFloat(session.rear_preload) || 0;
        acc.frontPressure += parseFloat(session.front_tire_pressure) || 0;
        acc.rearPressure += parseFloat(session.rear_tire_pressure) || 0;
        acc.frontHeight += parseFloat(session.front_ride_height) || 0;
        acc.rearHeight += parseFloat(session.rear_ride_height) || 0;
        acc.forkHeight += parseFloat(session.fork_height) || 0;
        acc.rearRideHeight += parseFloat(session.rear_ride_height) || 0;
      }
      return acc;
    }, {
      count: 0,
      frontCompression: 0,
      frontRebound: 0,
      frontPreload: 0,
      rearCompression: 0,
      rearRebound: 0,
      rearPreload: 0,
      frontPressure: 0,
      rearPressure: 0,
      frontHeight: 0,
      rearHeight: 0,
      forkHeight: 0,
      rearRideHeight: 0
    });

    let suggestions = null;

    if (averages.count > 0) {
      suggestions = {
        frontCompression: Math.round(averages.frontCompression / averages.count),
        frontRebound: Math.round(averages.frontRebound / averages.count),
        frontPreload: Math.round(averages.frontPreload / averages.count),
        rearCompression: Math.round(averages.rearCompression / averages.count),
        rearRebound: Math.round(averages.rearRebound / averages.count),
        rearPreload: Math.round(averages.rearPreload / averages.count),
        frontTirePressure: Math.round(averages.frontPressure / averages.count * 10) / 10,
        rearTirePressure: Math.round(averages.rearPressure / averages.count * 10) / 10,
        frontRideHeight: Math.round(averages.frontHeight / averages.count * 10) / 10,
        rearRideHeight: Math.round(averages.rearHeight / averages.count * 10) / 10,
        forkHeight: Math.round(averages.forkHeight / averages.count * 10) / 10,
        basedOnSessions: averages.count
      };
    }

    await pool.end();

    res.json({
      success: true,
      sessions: result.rows,
      mostRecent: {
        date: mostRecent.date,
        motorcycleName: mostRecent.motorcycle_name,
        eventName: mostRecent.event_name,
        notes: mostRecent.notes
      },
      suggestions,
      track
    });

  } catch (error) {
    console.error('Previous track data error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch previous track data',
      details: error.message 
    });
  }
}import { Client } from 'pg';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    const { motorcycle_id, track } = req.query;
    
    if (!motorcycle_id || !track) {
      return res.status(400).json({ error: 'Motorcycle ID and track required' });
    }

    // Get the most recent session for this motorcycle at this track
    const result = await client.query(`
      SELECT s.* FROM sessions s
      JOIN events e ON s.event_id = e.id
      WHERE s.motorcycle_id = $1 AND e.track = $2
      ORDER BY s.updated_at DESC
      LIMIT 1
    `, [motorcycle_id, track]);

    await client.end();

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No previous data found for this track' });
    }

    return res.status(200).json({ previousSession: result.rows[0] });
  } catch (error) {
    console.error('Database error:', error);
    try { await client.end(); } catch {}
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}
