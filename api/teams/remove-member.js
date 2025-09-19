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

    const { teamId, userId } = req.body;

    if (!teamId || !userId) {
      await pool.end();
      return res.status(400).json({ error: 'Team ID and User ID are required' });
    }

    // Check if requesting user has permission (must be owner or admin)
    const requesterMembershipQuery = `
      SELECT role FROM team_memberships
      WHERE team_id = $1 AND user_id = $2 AND status = 'active'
    `;

    const requesterResult = await pool.query(requesterMembershipQuery, [teamId, decoded.userId]);

    if (requesterResult.rows.length === 0) {
      await pool.end();
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    const requesterRole = requesterResult.rows[0].role;

    if (requesterRole !== 'owner' && requesterRole !== 'admin') {
      await pool.end();
      return res.status(403).json({ error: 'Only team owners and admins can remove members' });
    }

    // Check the role of the user being removed
    const targetMembershipQuery = `
      SELECT role, user_id FROM team_memberships
      WHERE team_id = $1 AND user_id = $2
    `;

    const targetResult = await pool.query(targetMembershipQuery, [teamId, userId]);

    if (targetResult.rows.length === 0) {
      await pool.end();
      return res.status(404).json({ error: 'User is not a member of this team' });
    }

    const targetRole = targetResult.rows[0].role;

    // Prevent removing the team owner
    if (targetRole === 'owner') {
      await pool.end();
      return res.status(403).json({ error: 'Cannot remove the team owner' });
    }

    // Prevent admins from removing other admins (only owner can do that)
    if (requesterRole === 'admin' && targetRole === 'admin') {
      await pool.end();
      return res.status(403).json({ error: 'Only the team owner can remove other admins' });
    }

    // Prevent users from removing themselves (they should use a "leave team" function instead)
    if (decoded.userId === userId) {
      await pool.end();
      return res.status(400).json({ error: 'Use the leave team function to remove yourself' });
    }

    // Begin transaction
    await pool.query('BEGIN');

    try {
      // Remove user from team
      const removeQuery = `
        DELETE FROM team_memberships
        WHERE team_id = $1 AND user_id = $2
      `;

      const removeResult = await pool.query(removeQuery, [teamId, userId]);

      if (removeResult.rowCount === 0) {
        await pool.query('ROLLBACK');
        await pool.end();
        return res.status(404).json({ error: 'Membership not found' });
      }

      // Optional: You could also remove user's access to team-owned motorcycles here
      // For now, we'll leave the motorcycles as they are

      // Commit transaction
      await pool.query('COMMIT');

      await pool.end();

      res.json({
        success: true,
        message: 'Member removed successfully'
      });

    } catch (transactionError) {
      await pool.query('ROLLBACK');
      throw transactionError;
    }

  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({
      error: 'Failed to remove member',
      details: error.message
    });
  }
};