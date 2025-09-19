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

    const authToken = authHeader.substring(7);
    const decoded = jwt.verify(authToken, process.env.JWT_SECRET || 'your-secret-key-change-this-in-production');

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    const { invitationToken } = req.body;

    if (!invitationToken) {
      await pool.end();
      return res.status(400).json({ error: 'Invitation token is required' });
    }

    // Get user email for validation
    const userQuery = 'SELECT email FROM users WHERE id = $1';
    const userResult = await pool.query(userQuery, [decoded.userId]);

    if (userResult.rows.length === 0) {
      await pool.end();
      return res.status(404).json({ error: 'User not found' });
    }

    const userEmail = userResult.rows[0].email;

    // Find and validate invitation
    const invitationQuery = `
      SELECT
        ti.id,
        ti.email,
        ti.team_id,
        ti.expires_at,
        ti.status,
        t.name as team_name
      FROM team_invitations ti
      JOIN teams t ON ti.team_id = t.id
      WHERE ti.token = $1
    `;

    const invitationResult = await pool.query(invitationQuery, [invitationToken]);

    if (invitationResult.rows.length === 0) {
      await pool.end();
      return res.status(404).json({
        error: 'Invalid invitation token'
      });
    }

    const invitation = invitationResult.rows[0];

    // Check if invitation email matches user email
    if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
      await pool.end();
      return res.status(403).json({
        error: 'Email mismatch',
        message: 'This invitation was sent to a different email address.'
      });
    }

    // Check if invitation has expired
    const now = new Date();
    const expiresAt = new Date(invitation.expires_at);

    if (now > expiresAt) {
      await pool.end();
      return res.status(400).json({
        error: 'Invitation expired',
        message: 'This invitation has expired.'
      });
    }

    // Check if invitation is still pending
    if (invitation.status !== 'pending') {
      await pool.end();
      return res.status(400).json({
        error: 'Invitation already processed',
        message: 'This invitation has already been processed.'
      });
    }

    // Check if user is already a team member
    const existingMemberQuery = `
      SELECT status FROM team_memberships
      WHERE team_id = $1 AND user_id = $2
    `;

    const existingMember = await pool.query(existingMemberQuery, [invitation.team_id, decoded.userId]);

    if (existingMember.rows.length > 0) {
      await pool.end();
      return res.status(409).json({
        error: 'Already a member',
        message: 'You are already a member of this team.'
      });
    }

    // Start transaction
    await pool.query('BEGIN');

    try {
      // Add user to team
      const addMemberQuery = `
        INSERT INTO team_memberships (team_id, user_id, role, status, joined_at)
        VALUES ($1, $2, 'member', 'active', NOW())
      `;

      await pool.query(addMemberQuery, [invitation.team_id, decoded.userId]);

      // Mark invitation as accepted
      const updateInvitationQuery = `
        UPDATE team_invitations
        SET status = 'accepted', updated_at = NOW()
        WHERE id = $1
      `;

      await pool.query(updateInvitationQuery, [invitation.id]);

      // Commit transaction
      await pool.query('COMMIT');

      await pool.end();

      res.json({
        success: true,
        message: `Successfully joined team "${invitation.team_name}"`,
        team: {
          id: invitation.team_id,
          name: invitation.team_name
        }
      });

    } catch (transactionError) {
      // Rollback transaction
      await pool.query('ROLLBACK');
      await pool.end();
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