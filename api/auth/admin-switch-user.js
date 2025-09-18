const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authenticate current user
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied. Please login.' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key-change-this-in-production'
    );

    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ error: 'Target user ID is required' });
    }

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    // Add admin column if it doesn't exist
    try {
      const checkAdminColumn = `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'is_admin'
      `;
      const columnExists = await pool.query(checkAdminColumn);

      if (columnExists.rows.length === 0) {
        console.log('Adding is_admin column to users table...');
        await pool.query('ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE');
      }
    } catch (alterError) {
      console.error('Error checking/adding is_admin column:', alterError);
    }

    // Verify current user is admin
    const adminQuery = 'SELECT is_admin FROM users WHERE id = $1';
    const adminResult = await pool.query(adminQuery, [decoded.userId]);

    if (adminResult.rows.length === 0 || !adminResult.rows[0].is_admin) {
      await pool.end();
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get target user info
    const targetUserQuery = 'SELECT id, name, email, team FROM users WHERE id = $1';
    const targetUserResult = await pool.query(targetUserQuery, [targetUserId]);

    if (targetUserResult.rows.length === 0) {
      await pool.end();
      return res.status(404).json({ error: 'Target user not found' });
    }

    const targetUser = targetUserResult.rows[0];

    // Generate new token for target user
    const switchToken = jwt.sign({
      userId: targetUser.id,
      email: targetUser.email,
      adminSwitched: true,
      originalAdminId: decoded.userId
    }, process.env.JWT_SECRET || 'your-secret-key-change-this-in-production',
    { expiresIn: '7d' });

    await pool.end();

    res.json({
      success: true,
      token: switchToken,
      user: targetUser,
      message: `Switched to user: ${targetUser.name} (${targetUser.email})`
    });

  } catch (error) {
    console.error('Error switching user:', error);
    res.status(500).json({
      error: 'Failed to switch user',
      details: error.message
    });
  }
};