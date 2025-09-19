require('dotenv').config();
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

    const { token } = req.body;

    if (!token) {
      await pool.end();
      return res.status(400).json({ error: 'Invitation token is required' });
    }

    // Find invitation with team and inviter information
    const invitationQuery = `
      SELECT
        ti.id,
        ti.email,
        ti.expires_at,
        ti.status,
        t.name as team_name,
        u.name as inviter_name,
        t.id as team_id
      FROM team_invitations ti
      JOIN teams t ON ti.team_id = t.id
      JOIN users u ON ti.invited_by = u.id
      WHERE ti.token = $1
    `;

    const invitationResult = await pool.query(invitationQuery, [token]);

    if (invitationResult.rows.length === 0) {
      await pool.end();
      return res.status(404).json({
        error: 'Invalid invitation token',
        message: 'The invitation link is invalid or has already been used.'
      });
    }

    const invitation = invitationResult.rows[0];

    // Check if invitation has expired
    const now = new Date();
    const expiresAt = new Date(invitation.expires_at);

    if (now > expiresAt) {
      await pool.end();
      return res.status(400).json({
        error: 'Invitation expired',
        message: 'This invitation has expired. Please ask the team administrator to send a new invitation.',
        expired: true
      });
    }

    // Check if invitation is still pending
    if (invitation.status !== 'pending') {
      await pool.end();
      return res.status(400).json({
        error: 'Invitation already processed',
        message: 'This invitation has already been accepted or declined.',
        status: invitation.status
      });
    }

    await pool.end();

    res.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        teamName: invitation.team_name,
        inviterName: invitation.inviter_name,
        teamId: invitation.team_id,
        expiresAt: invitation.expires_at
      },
      message: 'Invitation is valid'
    });

  } catch (error) {
    console.error('Validate invitation error:', error);
    res.status(500).json({
      error: 'Failed to validate invitation',
      details: error.message
    });
  }
};