require('dotenv').config();
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendTeamInvitationEmail } = require('../email/send-invitation');

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

    const { teamId, email, role = 'member' } = req.body;

    if (!teamId || !email) {
      await pool.end();
      return res.status(400).json({ error: 'Team ID and email are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      await pool.end();
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate role
    const validRoles = ['member', 'admin'];
    if (!validRoles.includes(role)) {
      await pool.end();
      return res.status(400).json({ error: 'Invalid role. Must be member or admin' });
    }

    // Check if user has permission to invite (must be owner or admin) and get inviter info
    const membershipQuery = `
      SELECT tm.role, t.name as team_name, t.owner_id, u.name as inviter_name
      FROM team_memberships tm
      JOIN teams t ON tm.team_id = t.id
      JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = $1 AND tm.user_id = $2 AND tm.status = 'active'
    `;

    const membershipResult = await pool.query(membershipQuery, [teamId, decoded.userId]);

    if (membershipResult.rows.length === 0) {
      await pool.end();
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    const userRole = membershipResult.rows[0].role;
    const teamName = membershipResult.rows[0].team_name;
    const inviterName = membershipResult.rows[0].inviter_name;

    if (userRole !== 'owner' && userRole !== 'admin') {
      await pool.end();
      return res.status(403).json({ error: 'Only team owners and admins can invite members' });
    }

    // Check if user is already a member
    const existingMemberQuery = `
      SELECT tm.status
      FROM team_memberships tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = $1 AND u.email = $2
    `;

    const existingMember = await pool.query(existingMemberQuery, [teamId, email.toLowerCase()]);

    if (existingMember.rows.length > 0) {
      const status = existingMember.rows[0].status;
      await pool.end();
      return res.status(409).json({
        error: status === 'active' ? 'User is already a team member' : 'User already has a pending invitation'
      });
    }

    // Check if there's already a pending invitation
    const existingInviteQuery = `
      SELECT id, expires_at
      FROM team_invitations
      WHERE team_id = $1 AND email = $2 AND status = 'pending'
    `;

    const existingInvite = await pool.query(existingInviteQuery, [teamId, email.toLowerCase()]);

    if (existingInvite.rows.length > 0) {
      const expiresAt = new Date(existingInvite.rows[0].expires_at);
      if (expiresAt > new Date()) {
        await pool.end();
        return res.status(409).json({
          error: 'A pending invitation already exists for this email',
          expiresAt: expiresAt
        });
      } else {
        // Delete expired invitation
        await pool.query('DELETE FROM team_invitations WHERE id = $1', [existingInvite.rows[0].id]);
      }
    }

    // Generate invitation token
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

    // Create invitation
    const createInviteQuery = `
      INSERT INTO team_invitations (team_id, email, invited_by, token, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, token, expires_at
    `;

    const inviteResult = await pool.query(createInviteQuery, [
      teamId,
      email.toLowerCase(),
      decoded.userId,
      inviteToken,
      expiresAt
    ]);

    await pool.end();

    // Send invitation email
    const emailResult = await sendTeamInvitationEmail({
      toEmail: email.toLowerCase(),
      teamName: teamName,
      inviterName: inviterName,
      invitationToken: inviteToken,
      expiresAt: expiresAt
    });

    // Return success even if email fails (invitation is still valid)
    const response = {
      success: true,
      invitation: {
        id: inviteResult.rows[0].id,
        token: inviteResult.rows[0].token,
        email: email.toLowerCase(),
        teamName: teamName,
        role: role,
        expiresAt: inviteResult.rows[0].expires_at
      },
      message: 'Invitation created successfully',
      emailSent: emailResult.success
    };

    if (!emailResult.success) {
      response.emailError = emailResult.error;
      response.message += ' (Email delivery failed - please share the invitation link manually)';
      console.warn('Failed to send invitation email:', emailResult.error);
    } else {
      response.message += ' and email sent';
    }

    res.json(response);

  } catch (error) {
    console.error('Invite member error:', error);
    res.status(500).json({
      error: 'Failed to invite member',
      details: error.message
    });
  }
};