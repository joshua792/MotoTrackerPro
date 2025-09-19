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

    const { teamId, email } = req.body;

    if (!teamId || !email) {
      await pool.end();
      return res.status(400).json({ error: 'Team ID and email are required' });
    }

    // Check if user has permission to cancel invitations (must be owner or admin)
    const membershipQuery = `
      SELECT role FROM team_memberships
      WHERE team_id = $1 AND user_id = $2 AND status = 'active'
    `;

    const membershipResult = await pool.query(membershipQuery, [teamId, decoded.userId]);

    if (membershipResult.rows.length === 0) {
      await pool.end();
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    const userRole = membershipResult.rows[0].role;

    if (userRole !== 'owner' && userRole !== 'admin') {
      await pool.end();
      return res.status(403).json({ error: 'Only team owners and admins can cancel invitations' });
    }

    // Find and delete the pending invitation
    const deleteInvitationQuery = `
      DELETE FROM team_invitations
      WHERE team_id = $1 AND email = $2 AND status = 'pending'
      RETURNING id, email
    `;

    const deleteResult = await pool.query(deleteInvitationQuery, [teamId, email.toLowerCase()]);

    await pool.end();

    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ error: 'No pending invitation found for this email' });
    }

    res.json({
      success: true,
      message: 'Invitation cancelled successfully',
      cancelledEmail: deleteResult.rows[0].email
    });

  } catch (error) {
    console.error('Cancel invitation error:', error);
    res.status(500).json({
      error: 'Failed to cancel invitation',
      details: error.message
    });
  }
};