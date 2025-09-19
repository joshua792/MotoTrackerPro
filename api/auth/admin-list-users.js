const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authenticate current user
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied. Please login.' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key-change-this-in-production'
    );

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    // Add admin column if it doesn't exist
    try {
      const checkAdminColumn = `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'is_admin'
      `;
      const columnExists = await pool.query(checkAdminColumn);

      if (columnExists.rows.length === 0) {
        console.log('Adding is_admin column to users table...');
        await pool.query('ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE');
      }
    } catch (alterError) {
      console.error('Error checking/adding is_admin column:', alterError);
    }

    // Verify current user is admin
    const adminQuery = 'SELECT is_admin FROM users WHERE id = $1';
    const adminResult = await pool.query(adminQuery, [decoded.userId]);

    if (adminResult.rows.length === 0 || !adminResult.rows[0].is_admin) {
      await pool.end();
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get all users (excluding password_hash)
    const usersQuery = `
      SELECT id, name, email, team, is_admin, created_at, last_login
      FROM users
      ORDER BY created_at DESC
    `;
    const usersResult = await pool.query(usersQuery);

    await pool.end();

    res.json({
      success: true,
      users: usersResult.rows
    });

  } catch (error) {
    console.error('Error listing users:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }

    res.status(500).json({
      error: 'Failed to list users',
      details: error.message
    });
  }
};