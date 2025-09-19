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
      return res.status(400).json({ error: 'Verification token is required' });
    }

    // Find user with valid verification token
    const userQuery = `
      SELECT id, name, email, email_verified, email_verification_expires
      FROM users
      WHERE email_verification_token = $1
    `;

    const userResult = await pool.query(userQuery, [token]);

    if (userResult.rows.length === 0) {
      await pool.end();
      return res.status(404).json({
        error: 'Invalid verification token',
        message: 'The verification link is invalid or has already been used.'
      });
    }

    const user = userResult.rows[0];

    // Check if already verified
    if (user.email_verified) {
      await pool.end();
      return res.status(200).json({
        success: true,
        message: 'Email already verified',
        alreadyVerified: true
      });
    }

    // Check if token has expired
    const now = new Date();
    const expiresAt = new Date(user.email_verification_expires);

    if (now > expiresAt) {
      await pool.end();
      return res.status(400).json({
        error: 'Verification token expired',
        message: 'The verification link has expired. Please request a new verification email.',
        expired: true,
        userId: user.id
      });
    }

    // Verify the email
    const updateQuery = `
      UPDATE users
      SET email_verified = TRUE,
          email_verification_token = NULL,
          email_verification_expires = NULL,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, name, email, email_verified, created_at
    `;

    const updateResult = await pool.query(updateQuery, [user.id]);
    const verifiedUser = updateResult.rows[0];

    await pool.end();

    console.log('Email verified successfully for:', user.email);

    res.json({
      success: true,
      message: 'Email verified successfully! You now have full access to all features.',
      user: {
        id: verifiedUser.id,
        name: verifiedUser.name,
        email: verifiedUser.email,
        email_verified: verifiedUser.email_verified,
        created_at: verifiedUser.created_at
      }
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      error: 'Email verification failed',
      details: error.message
    });
  }
};