const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    const { email, password } = req.body;

    if (!email || !password) {
      await pool.end();
      return res.status(400).json({ error: 'Email and password are required' });
    }

    console.log('Login attempt for:', email);

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

    // Find user by email
    const userQuery = 'SELECT * FROM users WHERE email = $1';
    const userResult = await pool.query(userQuery, [email.toLowerCase()]);

    if (userResult.rows.length === 0) {
      await pool.end();
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = userResult.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      await pool.end();
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email
      },
      process.env.JWT_SECRET || 'your-secret-key-change-this-in-production',
      { expiresIn: '7d' }
    );

    // Update last login
    await pool.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    await pool.end();

    // Return user data (without password hash)
    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      team: user.team,
      is_admin: user.is_admin || false,
      created_at: user.created_at,
      subscription_status: user.subscription_status || 'trial',
      subscription_plan: user.subscription_plan || 'basic',
      trial_start_date: user.trial_start_date,
      trial_end_date: user.trial_end_date,
      subscription_start_date: user.subscription_start_date,
      subscription_end_date: user.subscription_end_date,
      usage_count: user.usage_count || 0,
      usage_limit: user.usage_limit || 1000
    };

    console.log('Login successful for:', email);

    res.json({
      success: true,
      token,
      user: userData,
      message: 'Login successful'
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      details: error.message
    });
  }
};