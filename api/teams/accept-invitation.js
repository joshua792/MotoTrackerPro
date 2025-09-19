require('dotenv').config();
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

module.exports = async function handler(req, res) {
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

    const { invitationToken } = req.body;

    if (!invitationToken) {
      await pool.end();
      return res.status(400).json({ error: 'Invitation token is required' });
    }

    // Get user's email
    const userQuery = 'SELECT email FROM users WHERE id = $1';
    const userResult = await pool.query(userQuery, [decoded.userId]);

    if (userResult.rows.length === 0) {
      await pool.end();
      return res.status(404).json({ error: 'User not found' });
    }

    const userEmail = userResult.rows[0].email;

    // Find the invitation
    const inviteQuery = `
      SELECT
        ti.id,
        ti.team_id,
        ti.email,
        ti.expires_at,
        t.name as team_name,
        t.owner_id,
        t.is_active as team_active
      FROM team_invitations ti
      JOIN teams t ON ti.team_id = t.id
      WHERE ti.token = $1 AND ti.status = 'pending'
    `;

    const inviteResult = await pool.query(inviteQuery, [invitationToken]);

    if (inviteResult.rows.length === 0) {
      await pool.end();
      return res.status(404).json({ error: 'Invalid or expired invitation token' });
    }

    const invitation = inviteResult.rows[0];

    // Check if invitation is for this user's email
    if (invitation.email !== userEmail.toLowerCase()) {
      await pool.end();
      return res.status(403).json({
        error: 'This invitation is for a different email address',
        invitedEmail: invitation.email,
        userEmail: userEmail
      });
    }

    // Check if invitation has expired
    if (new Date(invitation.expires_at) < new Date()) {
      await pool.end();
      return res.status(410).json({ error: 'Invitation has expired' });
    }

    // Check if team is still active
    if (!invitation.team_active) {
      await pool.end();
      return res.status(410).json({ error: 'Team is no longer active' });
    }

    // Check if user is already a member of this team
    const existingMemberQuery = `
      SELECT status FROM team_memberships
      WHERE team_id = $1 AND user_id = $2
    `;

    const existingMember = await pool.query(existingMemberQuery, [invitation.team_id, decoded.userId]);

    if (existingMember.rows.length > 0) {
      const status = existingMember.rows[0].status;
      await pool.end();
      return res.status(409).json({
        error: status === 'active' ? 'You are already a member of this team' : 'You already have a membership record for this team'
      });
    }

    // Begin transaction
    await pool.query('BEGIN');

    try {
      // Add user to team
      const addMemberQuery = `
        INSERT INTO team_memberships (team_id, user_id, role, invited_by, status, joined_at)
        SELECT $1, $2, 'member', invited_by, 'active', NOW()
        FROM team_invitations
        WHERE token = $3
        RETURNING id, role
      `;

      const memberResult = await pool.query(addMemberQuery, [invitation.team_id, decoded.userId, invitationToken]);

      // Mark invitation as accepted
      await pool.query(
        'UPDATE team_invitations SET status = $1 WHERE token = $2',
        ['accepted', invitationToken]
      );

      // Commit transaction
      await pool.query('COMMIT');

      await pool.end();

      res.json({
        success: true,
        membership: {
          id: memberResult.rows[0].id,
          teamId: invitation.team_id,
          teamName: invitation.team_name,
          role: memberResult.rows[0].role,
          joinedAt: new Date()
        },
        message: `Successfully joined team: ${invitation.team_name}`
      });

    } catch (transactionError) {
      await pool.query('ROLLBACK');
      throw transactionError;
    }

  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({
      error: 'Failed to accept invitation',
      details: error.message
    });
  }
};