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

    const { teamId } = req.query;

    if (!teamId) {
      await pool.end();
      return res.status(400).json({ error: 'Team ID is required' });
    }

    // Check if user is a member of the team
    const membershipQuery = `
      SELECT role FROM team_memberships
      WHERE team_id = $1 AND user_id = $2 AND status = 'active'
    `;

    const membershipResult = await pool.query(membershipQuery, [teamId, decoded.userId]);

    if (membershipResult.rows.length === 0) {
      await pool.end();
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    // Get all team members with their user information
    const membersQuery = `
      SELECT
        tm.user_id,
        tm.role,
        tm.status,
        tm.joined_at,
        tm.invited_at,
        u.name,
        u.email,
        u.created_at as user_created_at
      FROM team_memberships tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = $1
      ORDER BY
        CASE tm.role
          WHEN 'owner' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'member' THEN 3
        END,
        tm.joined_at ASC
    `;

    const membersResult = await pool.query(membersQuery, [teamId]);

    // Get team information
    const teamQuery = `
      SELECT name, description, owner_id, created_at
      FROM teams
      WHERE id = $1 AND is_active = TRUE
    `;

    const teamResult = await pool.query(teamQuery, [teamId]);

    await pool.end();

    if (teamResult.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    res.json({
      success: true,
      team: teamResult.rows[0],
      members: membersResult.rows,
      totalMembers: membersResult.rows.length,
      activeMembers: membersResult.rows.filter(m => m.status === 'active').length
    });

  } catch (error) {
    console.error('Get team members error:', error);
    res.status(500).json({
      error: 'Failed to get team members',
      details: error.message
    });
  }
};