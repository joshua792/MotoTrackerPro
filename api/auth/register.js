require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    const { name, email, password, team } = req.body;

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
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS usage_limit INTEGER DEFAULT 1000"
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

    // Calculate trial end date (14 days from now)
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 14);

    // Insert new user with trial subscription
    const insertUserQuery = `
      INSERT INTO users (name, email, password_hash, team, created_at, updated_at,
                        subscription_status, subscription_plan, trial_start_date, trial_end_date,
                        usage_count, usage_limit)
      VALUES ($1, $2, $3, $4, NOW(), NOW(), 'trial', 'basic', NOW(), $5, 0, 1000)
      RETURNING id, name, email, team, created_at, subscription_status,
                subscription_plan, trial_start_date, trial_end_date, usage_count, usage_limit
    `;

    const result = await pool.query(insertUserQuery, [
      name,
      email.toLowerCase(),
      passwordHash,
      team || null,
      trialEndDate
    ]);

    await pool.end();

    const newUser = result.rows[0];

    console.log('Registration successful for:', email);

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
        usage_limit: newUser.usage_limit
      },
      message: 'Registration successful - 14-day trial activated'
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      details: error.message
    });
  }
};