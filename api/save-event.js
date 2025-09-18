const { Pool } = require('pg');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    const { id, series, name, track, date, location } = req.body;

    if (!series || !name || !track || !date || !location) {
      await pool.end();
      return res.status(400).json({ error: 'Missing required fields: series, name, track, date, location' });
    }

    console.log('Saving event:', { id, series, name, track, date, location }); // Debug logging

    // Check if this is an update or insert by looking for existing record
    const existingEvent = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
    console.log('Existing event found:', existingEvent.rows.length > 0 ? existingEvent.rows[0] : 'none');

    // Check if events table has required columns, if not add them
    try {
      const checkColumns = `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'events' AND column_name IN ('series', 'created_at', 'updated_at')
      `;

      const existingColumns = await pool.query(checkColumns);
      const columnNames = existingColumns.rows.map(row => row.column_name);

      if (!columnNames.includes('series')) {
        console.log('Adding series column to events table...');
        await pool.query('ALTER TABLE events ADD COLUMN series VARCHAR(100)');
      }

      if (!columnNames.includes('created_at')) {
        console.log('Adding created_at column to events table...');
        await pool.query('ALTER TABLE events ADD COLUMN created_at TIMESTAMP DEFAULT NOW()');
      }

      if (!columnNames.includes('updated_at')) {
        console.log('Adding updated_at column to events table...');
        await pool.query('ALTER TABLE events ADD COLUMN updated_at TIMESTAMP DEFAULT NOW()');

        // Update existing records to have the current timestamp
        await pool.query('UPDATE events SET updated_at = NOW() WHERE updated_at IS NULL');
      }
    } catch (alterError) {
      console.error('Error checking/adding columns:', alterError);
      // Continue anyway - columns might already exist
    }

    // Use UPSERT (INSERT ... ON CONFLICT ... DO UPDATE)
    const upsertQuery = `
      INSERT INTO events (id, series, name, track, date, location, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        series = EXCLUDED.series,
        name = EXCLUDED.name,
        track = EXCLUDED.track,
        date = EXCLUDED.date,
        location = EXCLUDED.location,
        updated_at = NOW()
      RETURNING *
    `;

    const result = await pool.query(upsertQuery, [id, series, name, track, date, location]);
    
    await pool.end();

    console.log('Event saved successfully:', result.rows[0]); // Debug logging

    res.json({
      success: true,
      event: result.rows[0],
      message: 'Event saved successfully'
    });

  } catch (error) {
    console.error('Error saving event:', error);
    res.status(500).json({ 
      error: 'Failed to save event',
      details: error.message 
    });
  }
};