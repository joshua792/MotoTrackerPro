import { Pool } from 'pg';

export default async function handler(req, res) {
  try {
    // Test database connection
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    // Test basic query
    const testQuery = await pool.query('SELECT NOW() as current_time');
    
    // Check if sessions table exists
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'sessions'
    `);

    // Check sessions table structure
    const columnsCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sessions' 
      ORDER BY ordinal_position
    `);

    // Check environment variables
    const envCheck = {
      DATABASE_URL: !!process.env.DATABASE_URL,
      OPENWEATHER_API_KEY: !!process.env.OPENWEATHER_API_KEY
    };

    await pool.end();

    res.json({
      success: true,
      timestamp: testQuery.rows[0].current_time,
      sessionsTableExists: tableCheck.rows.length > 0,
      columns: columnsCheck.rows,
      environment: envCheck,
      nodeVersion: process.version
    });

  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({
      error: error.message,
      stack: error.stack,
      environment: {
        DATABASE_URL: !!process.env.DATABASE_URL,
        OPENWEATHER_API_KEY: !!process.env.OPENWEATHER_API_KEY
      }
    });
  }
}
