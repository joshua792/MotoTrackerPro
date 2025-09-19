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

    // Create teams table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subscription_plan VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        is_active BOOLEAN DEFAULT TRUE
      )
    `);

    // Create team_memberships table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS team_memberships (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(20) DEFAULT 'member',
        invited_by UUID REFERENCES users(id),
        invited_at TIMESTAMP DEFAULT NOW(),
        joined_at TIMESTAMP,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(team_id, user_id)
      )
    `);

    // Create team_invitations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS team_invitations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        invited_by UUID NOT NULL REFERENCES users(id),
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(team_id, email)
      )
    `);

    // Add team_id to motorcycles table
    await pool.query(`
      ALTER TABLE motorcycles
      ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id)
    `);

    // Add user_id to motorcycles table for individual ownership
    await pool.query(`
      ALTER TABLE motorcycles
      ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id)
    `);

    // Add indexes for better performance
    await pool.query('CREATE INDEX IF NOT EXISTS idx_teams_owner ON teams(owner_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_team_memberships_team ON team_memberships(team_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_team_memberships_user ON team_memberships(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_motorcycles_team ON motorcycles(team_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_motorcycles_user ON motorcycles(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON team_invitations(token)');

    await pool.end();

    res.json({
      success: true,
      message: 'Team schema created successfully',
      tables: ['teams', 'team_memberships', 'team_invitations'],
      modifications: ['motorcycles.team_id', 'motorcycles.user_id']
    });

  } catch (error) {
    console.error('Schema creation error:', error);
    res.status(500).json({
      error: 'Schema creation failed',
      details: error.message
    });
  }
};