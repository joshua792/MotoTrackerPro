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
          last_login TIMESTAMP
        )
      `;
      await pool.query(createUsersTable);

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

    // Insert new user
    const insertUserQuery = `
      INSERT INTO users (name, email, password_hash, team, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING id, name, email, team, created_at
    `;

    const result = await pool.query(insertUserQuery, [
      name,
      email.toLowerCase(),
      passwordHash,
      team || null
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
        created_at: newUser.created_at
      },
      message: 'Registration successful'
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      details: error.message
    });
  }
};