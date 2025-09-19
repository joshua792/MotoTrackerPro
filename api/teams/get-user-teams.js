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

    // Get teams where user is a member
    const teamsQuery = `
      SELECT
        t.id,
        t.name,
        t.description,
        t.owner_id,
        t.subscription_plan,
        t.created_at,
        tm.role,
        tm.status as membership_status,
        tm.joined_at,
        u.name as owner_name,
        u.email as owner_email,
        (SELECT COUNT(*) FROM team_memberships WHERE team_id = t.id AND status = 'active') as member_count
      FROM teams t
      JOIN team_memberships tm ON t.id = tm.team_id
      JOIN users u ON t.owner_id = u.id
      WHERE tm.user_id = $1 AND t.is_active = TRUE AND tm.status = 'active'
      ORDER BY tm.role DESC, t.created_at DESC
    `;

    const teamsResult = await pool.query(teamsQuery, [decoded.userId]);

    // Get pending invitations for this user
    const invitationsQuery = `
      SELECT
        ti.id,
        ti.team_id,
        ti.email,
        ti.token,
        ti.expires_at,
        ti.created_at,
        t.name as team_name,
        t.description as team_description,
        u.name as invited_by_name
      FROM team_invitations ti
      JOIN teams t ON ti.team_id = t.id
      JOIN users u ON ti.invited_by = u.id
      WHERE ti.email = $1 AND ti.status = 'pending' AND ti.expires_at > NOW()
      ORDER BY ti.created_at DESC
    `;

    // Get user's email for invitation lookup
    const userQuery = 'SELECT email FROM users WHERE id = $1';
    const userResult = await pool.query(userQuery, [decoded.userId]);
    const userEmail = userResult.rows[0]?.email;

    let pendingInvitations = [];
    if (userEmail) {
      const invitationsResult = await pool.query(invitationsQuery, [userEmail]);
      pendingInvitations = invitationsResult.rows;
    }

    await pool.end();

    res.json({
      success: true,
      teams: teamsResult.rows,
      pendingInvitations: pendingInvitations,
      userRole: teamsResult.rows.length > 0 ? teamsResult.rows[0].role : null
    });

  } catch (error) {
    console.error('Get user teams error:', error);
    res.status(500).json({
      error: 'Failed to get user teams',
      details: error.message
    });
  }
};