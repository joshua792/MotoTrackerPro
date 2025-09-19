require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
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

    const { name, email, password, team, invitationToken } = req.body;

    if (!name || !email || !password) {
      await pool.end();
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    if (password.length < 8) {
      await pool.end();
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    console.log('Registration attempt for:', email);

    // Check if users table exists, create if not
    try {
      const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          team VARCHAR(255),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          last_login TIMESTAMP,
          subscription_status VARCHAR(20) DEFAULT 'trial',
          subscription_plan VARCHAR(50) DEFAULT 'basic',
          trial_start_date TIMESTAMP DEFAULT NOW(),
          trial_end_date TIMESTAMP DEFAULT (NOW() + INTERVAL '14 days'),
          subscription_start_date TIMESTAMP,
          subscription_end_date TIMESTAMP,
          stripe_customer_id VARCHAR(255),
          stripe_subscription_id VARCHAR(255),
          usage_count INTEGER DEFAULT 0,
          usage_limit INTEGER DEFAULT 1000
        )
      `;
      await pool.query(createUsersTable);

      // Add subscription columns if they don't exist (for existing installations)
      const addColumns = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) DEFAULT 'trial'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'basic'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_start_date TIMESTAMP DEFAULT NOW()",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMP DEFAULT (NOW() + INTERVAL '14 days')",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMP",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS usage_limit INTEGER DEFAULT 1000",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_sent_at TIMESTAMP"
      ];

      for (const addColumn of addColumns) {
        try {
          await pool.query(addColumn);
        } catch (columnError) {
          // Column might already exist, which is fine
        }
      }

      // Create index on email for faster lookups
      await pool.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    } catch (tableError) {
      console.error('Error creating users table:', tableError);
    }

    // Check if user already exists
    const existingUserQuery = 'SELECT email FROM users WHERE email = $1';
    const existingUser = await pool.query(existingUserQuery, [email.toLowerCase()]);

    if (existingUser.rows.length > 0) {
      await pool.end();
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date();
    verificationExpires.setHours(verificationExpires.getHours() + 24); // 24 hour expiration

    // Calculate trial end date (14 days from now)
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 14);

    // Insert new user with trial subscription and verification token
    const insertUserQuery = `
      INSERT INTO users (name, email, password_hash, team, created_at, updated_at,
                        subscription_status, subscription_plan, trial_start_date, trial_end_date,
                        usage_count, usage_limit, email_verified, email_verification_token,
                        email_verification_expires, email_verification_sent_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW(), 'trial', 'basic', NOW(), $5, 0, 1000, FALSE, $6, $7, NOW())
      RETURNING id, name, email, team, created_at, subscription_status,
                subscription_plan, trial_start_date, trial_end_date, usage_count, usage_limit,
                email_verified, email_verification_token
    `;

    const result = await pool.query(insertUserQuery, [
      name,
      email.toLowerCase(),
      passwordHash,
      team || null,
      trialEndDate,
      verificationToken,
      verificationExpires
    ]);

    await pool.end();

    const newUser = result.rows[0];

    // Send verification email
    let emailSent = false;
    try {
      const emailResult = await sendVerificationEmail({
        toEmail: newUser.email,
        userName: newUser.name,
        verificationToken: newUser.email_verification_token
      });
      emailSent = emailResult.success;

      if (!emailSent) {
        console.warn('Failed to send verification email:', emailResult.error);
      }
    } catch (emailError) {
      console.error('Error sending verification email:', emailError);
    }

    // Handle team invitation if provided
    let teamJoined = false;
    let teamName = null;

    if (invitationToken) {
      try {
        // Validate and process team invitation
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
          WHERE ti.token = $1 AND ti.email = $2 AND ti.status = 'pending'
        `;

        const invitationResult = await pool.query(invitationQuery, [invitationToken, email.toLowerCase()]);

        if (invitationResult.rows.length > 0) {
          const invitation = invitationResult.rows[0];
          const now = new Date();
          const expiresAt = new Date(invitation.expires_at);

          if (now <= expiresAt) {
            // Create connection to handle team invitation
            const teamPool = new Pool({
              connectionString: process.env.DATABASE_URL,
              ssl: { rejectUnauthorized: false }
            });

            await teamPool.query('BEGIN');

            try {
              // Add user to team
              const addMemberQuery = `
                INSERT INTO team_memberships (team_id, user_id, role, status, joined_at)
                VALUES ($1, $2, 'member', 'active', NOW())
              `;

              await teamPool.query(addMemberQuery, [invitation.team_id, newUser.id]);

              // Mark invitation as accepted
              const updateInvitationQuery = `
                UPDATE team_invitations
                SET status = 'accepted', updated_at = NOW()
                WHERE id = $1
              `;

              await teamPool.query(updateInvitationQuery, [invitation.id]);

              await teamPool.query('COMMIT');
              await teamPool.end();

              teamJoined = true;
              teamName = invitation.team_name;

              console.log('User automatically joined team:', teamName);
            } catch (teamError) {
              await teamPool.query('ROLLBACK');
              await teamPool.end();
              console.error('Error processing team invitation during registration:', teamError);
            }
          }
        }
      } catch (inviteError) {
        console.error('Error processing team invitation:', inviteError);
      }
    }

    console.log('Registration successful for:', email, emailSent ? '(verification email sent)' : '(email failed)', teamJoined ? `(joined team: ${teamName})` : '');

    res.json({
      success: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        team: newUser.team,
        created_at: newUser.created_at,
        subscription_status: newUser.subscription_status,
        subscription_plan: newUser.subscription_plan,
        trial_start_date: newUser.trial_start_date,
        trial_end_date: newUser.trial_end_date,
        usage_count: newUser.usage_count,
        usage_limit: newUser.usage_limit,
        email_verified: newUser.email_verified
      },
      message: emailSent
        ? 'Registration successful! Please check your email to verify your account.'
        : 'Registration successful! Email verification will be sent shortly.',
      emailSent: emailSent,
      teamJoined: teamJoined,
      teamName: teamName
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      details: error.message
    });
  }
};