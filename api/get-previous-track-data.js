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

    // Check what columns actually exist in the sessions table
    const columnsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'sessions' 
      ORDER BY ordinal_position
    `;
    
    const columnsResult = await pool.query(columnsQuery);
    const availableColumns = columnsResult.rows.map(row => row.column_name);
    
    console.log('Available columns in sessions table:', availableColumns);

    // Build a safe query using only columns that exist
    let selectColumns = ['s.id', 's.created_at'];
    let whereClause = '';
    let joinClauses = '';
    
    // Add columns that might exist for session data
    const possibleColumns = [
      'date', 'session_type', 'notes', 'motorcycle_id', 'event_id',
      'front_compression', 'front_rebound', 'front_preload',
      'rear_compression', 'rear_rebound', 'rear_preload',
      'front_tire_pressure', 'rear_tire_pressure',
      'front_ride_height', 'rear_ride_height', 'fork_height',
      'latitude', 'longitude'
    ];
    
    possibleColumns.forEach(col => {
      if (availableColumns.includes(col)) {
        selectColumns.push(`s.${col}`);
      }
    });

    // Check for track-related columns
    if (availableColumns.includes('track')) {
      whereClause = 'WHERE LOWER(s.track) = LOWER($1)';
    } else if (availableColumns.includes('track_name')) {
      whereClause = 'WHERE LOWER(s.track_name) = LOWER($1)';
    } else if (availableColumns.includes('location')) {
      whereClause = 'WHERE LOWER(s.location) = LOWER($1)';
    } else {
      // Since your table doesn't have track columns, we'll return all sessions
      // and filter client-side, or return empty for now
      await pool.end();
      return res.json({
        success: true,
        sessions: [],
        message: 'No track column found in database - cannot filter by track',
        availableColumns: availableColumns,
        suggestion: 'Consider adding a track_name or location column to the sessions table'
      });
    }

    // Add joins for related tables if foreign keys exist
    if (availableColumns.includes('motorcycle_id')) {
      joinClauses += ' LEFT JOIN motorcycles m ON s.motorcycle_id = m.id';
      selectColumns.push('m.name as motorcycle_name', 'm.year as motorcycle_year');
    }

    if (availableColumns.includes('event_id')) {
      joinClauses += ' LEFT JOIN events e ON s.event_id = e.id';
      selectColumns.push('e.name as event_name');
    }

    const query = `
      SELECT ${selectColumns.join(', ')}
      FROM sessions s${joinClauses}
      ${whereClause}
      ORDER BY s.created_at DESC 
      LIMIT 10
    `;

    console.log('Executing query:', query);
    
    const result = await pool.query(query, [track]);

    await pool.end();

    res.json({
      success: true,
      sessions: result.rows,
      count: result.rows.length,
      track: track,
      availableColumns: availableColumns,
      queryUsed: query
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
}
