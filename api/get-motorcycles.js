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

    // Ensure motorcycles table has team and user columns
    await pool.query(`
      CREATE TABLE IF NOT EXISTS motorcycles (
        id VARCHAR(255) PRIMARY KEY,
        make VARCHAR(100) NOT NULL,
        model VARCHAR(100) NOT NULL,
        class VARCHAR(100) NOT NULL,
        number VARCHAR(10) NOT NULL,
        variant VARCHAR(10) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add team_id and user_id columns if they don't exist
    await pool.query('ALTER TABLE motorcycles ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id)');
    await pool.query('ALTER TABLE motorcycles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id)');

    // Get motorcycles that user has access to:
    // 1. Motorcycles owned by user individually (user_id = userId)
    // 2. Motorcycles owned by teams where user is a member
    // 3. Legacy motorcycles (no ownership) - for backward compatibility
    const motorcyclesQuery = `
      SELECT DISTINCT
        m.*,
        CASE
          WHEN m.team_id IS NOT NULL THEN 'team'
          WHEN m.user_id IS NOT NULL THEN 'individual'
          ELSE 'legacy'
        END as ownership_type,
        t.name as team_name,
        u.name as owner_name
      FROM motorcycles m
      LEFT JOIN teams t ON m.team_id = t.id
      LEFT JOIN users u ON m.user_id = u.id
      LEFT JOIN team_memberships tm ON m.team_id = tm.team_id AND tm.user_id = $1 AND tm.status = 'active'
      WHERE
        m.user_id = $1  -- User's individual motorcycles
        OR tm.team_id IS NOT NULL  -- Team motorcycles where user is member
        OR (m.team_id IS NULL AND m.user_id IS NULL)  -- Legacy motorcycles (no ownership)
      ORDER BY m.created_at DESC
    `;

    const result = await pool.query(motorcyclesQuery, [decoded.userId]);
    await pool.end();

    return res.status(200).json({ motorcycles: result.rows });

  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error', details: error.message });
  }
};
