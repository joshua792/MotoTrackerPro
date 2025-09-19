const { Pool } = require('pg');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    // Create subscription_plans table if it doesn't exist
    try {
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS subscription_plans (
          id SERIAL PRIMARY KEY,
          plan_key VARCHAR(50) NOT NULL UNIQUE,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          price_monthly DECIMAL(10,2) NOT NULL,
          price_yearly DECIMAL(10,2),
          usage_limit INTEGER,
          features TEXT[],
          is_active BOOLEAN DEFAULT TRUE,
          sort_order INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `;
      await pool.query(createTableQuery);

      // Create indexes
      await pool.query('CREATE INDEX IF NOT EXISTS idx_subscription_plans_key ON subscription_plans(plan_key)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(is_active)');

      // Insert default plans if table is empty
      const countQuery = 'SELECT COUNT(*) FROM subscription_plans';
      const countResult = await pool.query(countQuery);

      if (parseInt(countResult.rows[0].count) === 0) {
        const defaultPlans = [
          {
            plan_key: 'trial',
            name: 'Trial',
            description: 'Free trial period',
            price_monthly: 0,
            price_yearly: 0,
            usage_limit: 25,
            features: ['25 session saves', '14-day trial', 'Track map access', 'Weather integration'],
            sort_order: 1
          },
          {
            plan_key: 'basic',
            name: 'Basic Plan',
            description: 'Perfect for weekend warriors',
            price_monthly: 9.99,
            price_yearly: 99.99,
            usage_limit: 500,
            features: ['500 session saves per month', 'Track map access', 'Weather integration', 'Previous track data', 'Export capabilities'],
            sort_order: 2
          },
          {
            plan_key: 'premium',
            name: 'Premium Plan',
            description: 'For serious racers and teams',
            price_monthly: 19.99,
            price_yearly: 199.99,
            usage_limit: null,
            features: ['Unlimited session saves', 'Everything in Basic', 'Priority support', 'Advanced analytics', 'Team collaboration'],
            sort_order: 3
          }
        ];

        for (const plan of defaultPlans) {
          await pool.query(`
            INSERT INTO subscription_plans
            (plan_key, name, description, price_monthly, price_yearly, usage_limit, features, sort_order, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            plan.plan_key,
            plan.name,
            plan.description,
            plan.price_monthly,
            plan.price_yearly,
            plan.usage_limit,
            plan.features,
            plan.sort_order,
            true
          ]);
        }
      }
    } catch (tableError) {
      console.error('Error creating subscription_plans table:', tableError);
    }

    // Get all plans
    const query = 'SELECT * FROM subscription_plans ORDER BY sort_order, plan_key';
    const result = await pool.query(query);

    await pool.end();

    res.json({
      success: true,
      plans: result.rows
    });

  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    res.status(500).json({
      error: 'Failed to fetch subscription plans',
      details: error.message
    });
  }
};