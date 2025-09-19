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

    // Check user permissions and subscription
    const userQuery = `
      SELECT subscription_plan, subscription_status, subscription_end_date, is_admin
      FROM users WHERE id = $1
    `;
    const userResult = await pool.query(userQuery, [decoded.userId]);

    if (userResult.rows.length === 0) {
      await pool.end();
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Check if user has permission to create teams (Admin OR Premier subscriber)
    const isAdmin = user.is_admin === true;
    const hasPremierSubscription = user.subscription_plan === 'premier' && user.subscription_status === 'active';
    const hasValidSubscription = !user.subscription_end_date || new Date(user.subscription_end_date) >= new Date();

    if (!isAdmin && (!hasPremierSubscription || !hasValidSubscription)) {
      await pool.end();

      let errorMessage = 'Premier subscription or Admin access required to create teams';
      let errorDetails = {
        currentPlan: user.subscription_plan,
        status: user.subscription_status,
        isAdmin: isAdmin
      };

      if (user.subscription_plan === 'premier' && !hasValidSubscription) {
        errorMessage = 'Subscription expired. Please renew to create teams.';
      }

      return res.status(403).json({
        error: errorMessage,
        ...errorDetails
      });
    }

    const { name, description } = req.body;

    if (!name || name.trim().length < 2) {
      await pool.end();
      return res.status(400).json({ error: 'Team name must be at least 2 characters long' });
    }

    // Check if user already owns a team (limit one team per premier subscriber)
    const existingTeamQuery = 'SELECT id FROM teams WHERE owner_id = $1 AND is_active = TRUE';
    const existingTeam = await pool.query(existingTeamQuery, [decoded.userId]);

    if (existingTeam.rows.length > 0) {
      await pool.end();
      return res.status(409).json({
        error: 'You already own a team. Each premier subscriber can own one team.',
        existingTeamId: existingTeam.rows[0].id
      });
    }

    // Create the team
    const createTeamQuery = `
      INSERT INTO teams (name, description, owner_id, subscription_plan)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, description, owner_id, subscription_plan, created_at, is_active
    `;

    // Set team subscription plan - admins get premier-level access
    const teamSubscriptionPlan = isAdmin ? 'premier' : user.subscription_plan;

    const teamResult = await pool.query(createTeamQuery, [
      name.trim(),
      description?.trim() || null,
      decoded.userId,
      teamSubscriptionPlan
    ]);

    const newTeam = teamResult.rows[0];

    // Automatically add the owner as a team member with 'owner' role
    const addOwnerQuery = `
      INSERT INTO team_memberships (team_id, user_id, role, status, joined_at)
      VALUES ($1, $2, 'owner', 'active', NOW())
    `;

    await pool.query(addOwnerQuery, [newTeam.id, decoded.userId]);

    await pool.end();

    res.json({
      success: true,
      team: newTeam,
      message: 'Team created successfully'
    });

  } catch (error) {
    console.error('Team creation error:', error);
    res.status(500).json({
      error: 'Team creation failed',
      details: error.message
    });
  }
};