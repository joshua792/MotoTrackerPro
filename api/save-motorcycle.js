require('dotenv').config();
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
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

    await pool.query('ALTER TABLE motorcycles ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id)');
    await pool.query('ALTER TABLE motorcycles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id)');

    const { id, make, model, class: bikeClass, number, variant, teamId, ownershipType = 'individual' } = req.body;

    if (!id || !make || !model || !bikeClass || !number) {
      await pool.end();
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Determine ownership based on ownershipType and teamId
    let ownerUserId = null;
    let ownerTeamId = null;

    if (ownershipType === 'team' && teamId) {
      // Verify user is a member of the team
      const teamMemberQuery = `
        SELECT role FROM team_memberships
        WHERE team_id = $1 AND user_id = $2 AND status = 'active'
      `;
      const memberResult = await pool.query(teamMemberQuery, [teamId, decoded.userId]);

      if (memberResult.rows.length === 0) {
        await pool.end();
        return res.status(403).json({ error: 'You are not a member of this team' });
      }

      ownerTeamId = teamId;
    } else {
      // Individual ownership
      ownerUserId = decoded.userId;
    }

    // Check if motorcycle exists and user has permission to edit it
    const existingQuery = `
      SELECT m.*, tm.role
      FROM motorcycles m
      LEFT JOIN team_memberships tm ON m.team_id = tm.team_id AND tm.user_id = $1 AND tm.status = 'active'
      WHERE m.id = $2
    `;

    const existingResult = await pool.query(existingQuery, [decoded.userId, id]);

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];

      // Check if user has permission to edit this motorcycle
      const canEdit = existing.user_id === decoded.userId || // User owns it individually
                     existing.role !== null; // User is team member

      if (!canEdit) {
        await pool.end();
        return res.status(403).json({ error: 'You do not have permission to edit this motorcycle' });
      }
    }

    const upsertQuery = `
      INSERT INTO motorcycles (id, make, model, class, number, variant, user_id, team_id, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        make = $2, model = $3, class = $4, number = $5, variant = $6,
        user_id = $7, team_id = $8, updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await pool.query(upsertQuery, [
      id, make, model, bikeClass, number, variant, ownerUserId, ownerTeamId
    ]);

    await pool.end();

    return res.status(200).json({ success: true, motorcycle: result.rows[0] });

  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error', details: error.message });
  }
};
