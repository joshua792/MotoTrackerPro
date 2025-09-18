const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    // Check if user exists
    const userQuery = 'SELECT id, name FROM users WHERE email = $1';
    const userResult = await pool.query(userQuery, [email]);

    if (userResult.rows.length === 0) {
      // Don't reveal if email exists or not for security
      await pool.end();
      return res.json({
        success: true,
        message: 'If an account with that email exists, reset instructions have been sent.'
      });
    }

    const user = userResult.rows[0];

    // Generate reset token (valid for 1 hour)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour from now

    // Create password_resets table if it doesn't exist
    const createResetTable = `
      CREATE TABLE IF NOT EXISTS password_resets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        token VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await pool.query(createResetTable);

    // Store reset token
    const insertResetQuery = `
      INSERT INTO password_resets (user_id, token, expires_at)
      VALUES ($1, $2, $3)
    `;

    await pool.query(insertResetQuery, [user.id, resetToken, resetExpires]);

    await pool.end();

    // In a real app, you would send an email with the reset link
    // For now, we'll just log it for development purposes
    console.log(`Password reset token for ${email}: ${resetToken}`);
    console.log(`Reset URL: /reset-password?token=${resetToken}`);

    res.json({
      success: true,
      message: 'If an account with that email exists, reset instructions have been sent.',
      // In development, include the token for testing
      ...(process.env.NODE_ENV === 'development' && {
        devToken: resetToken,
        devMessage: 'Development mode: Use this token to reset password'
      })
    });

  } catch (error) {
    console.error('Error processing password reset:', error);
    res.status(500).json({
      error: 'Failed to process password reset',
      details: error.message
    });
  }
};