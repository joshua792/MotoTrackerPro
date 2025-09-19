require('dotenv').config();
const { Pool } = require('pg');
const crypto = require('crypto');
const { sendVerificationEmail } = require('../email/send-verification');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    const { email } = req.body;

    if (!email) {
      await pool.end();
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user by email
    const userQuery = `
      SELECT id, name, email, email_verified, email_verification_sent_at
      FROM users
      WHERE email = $1
    `;

    const userResult = await pool.query(userQuery, [email.toLowerCase()]);

    if (userResult.rows.length === 0) {
      await pool.end();
      return res.status(404).json({
        error: 'User not found',
        message: 'No account found with this email address.'
      });
    }

    const user = userResult.rows[0];

    // Check if already verified
    if (user.email_verified) {
      await pool.end();
      return res.status(200).json({
        success: true,
        message: 'Email is already verified',
        alreadyVerified: true
      });
    }

    // Rate limiting: Don't allow resending within 1 minute
    if (user.email_verification_sent_at) {
      const lastSent = new Date(user.email_verification_sent_at);
      const now = new Date();
      const timeDiff = (now - lastSent) / 1000; // seconds

      if (timeDiff < 60) {
        await pool.end();
        return res.status(429).json({
          error: 'Rate limited',
          message: `Please wait ${Math.ceil(60 - timeDiff)} seconds before requesting another verification email.`,
          waitSeconds: Math.ceil(60 - timeDiff)
        });
      }
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date();
    verificationExpires.setHours(verificationExpires.getHours() + 24); // 24 hour expiration

    // Update user with new token
    const updateQuery = `
      UPDATE users
      SET email_verification_token = $1,
          email_verification_expires = $2,
          email_verification_sent_at = NOW(),
          updated_at = NOW()
      WHERE id = $3
      RETURNING name, email
    `;

    const updateResult = await pool.query(updateQuery, [
      verificationToken,
      verificationExpires,
      user.id
    ]);

    await pool.end();

    const updatedUser = updateResult.rows[0];

    // Send verification email
    let emailSent = false;
    try {
      const emailResult = await sendVerificationEmail({
        toEmail: updatedUser.email,
        userName: updatedUser.name,
        verificationToken: verificationToken
      });
      emailSent = emailResult.success;

      if (!emailSent) {
        console.warn('Failed to resend verification email:', emailResult.error);
      }
    } catch (emailError) {
      console.error('Error resending verification email:', emailError);
    }

    console.log('Verification email resent for:', email, emailSent ? '(success)' : '(failed)');

    res.json({
      success: true,
      message: emailSent
        ? 'Verification email sent! Please check your inbox and spam folder.'
        : 'Verification email queued. Please check your inbox in a few minutes.',
      emailSent: emailSent
    });

  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      error: 'Failed to resend verification email',
      details: error.message
    });
  }
};