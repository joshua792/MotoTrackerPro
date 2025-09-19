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
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    // Get user data
    const userQuery = 'SELECT id, email, name, is_admin FROM users WHERE id = $1';
    const userResult = await pool.query(userQuery, [decoded.userId]);

    if (userResult.rows.length === 0) {
      await pool.end();
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Admin users don't need subscriptions
    if (user.is_admin) {
      await pool.end();
      return res.status(400).json({ error: 'Admin users do not need subscriptions' });
    }

    const { plan } = req.body;

    if (!plan || !['basic', 'premium'].includes(plan)) {
      await pool.end();
      return res.status(400).json({ error: 'Valid plan (basic or premium) is required' });
    }

    // Stripe configuration
    if (!process.env.STRIPE_SECRET_KEY) {
      await pool.end();
      return res.status(500).json({ error: 'Stripe configuration missing' });
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    // Get plan configuration from database
    const planQuery = 'SELECT * FROM subscription_plans WHERE plan_key = $1 AND is_active = TRUE';
    const planResult = await pool.query(planQuery, [plan]);

    if (planResult.rows.length === 0) {
      await pool.end();
      return res.status(404).json({ error: 'Subscription plan not found or inactive' });
    }

    const selectedPlan = planResult.rows[0];
    const priceInCents = Math.round(selectedPlan.price_monthly * 100); // Convert to cents

    // Create or retrieve Stripe customer
    let stripeCustomerId = user.stripe_customer_id;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: {
          user_id: user.id
        }
      });

      stripeCustomerId = customer.id;

      // Save customer ID to database
      await pool.query(
        'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
        [stripeCustomerId, user.id]
      );
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: selectedPlan.name,
              description: selectedPlan.description,
            },
            unit_amount: priceInCents,
            recurring: {
              interval: 'month'
            }
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${req.headers.origin || 'https://motosetuppro.com'}?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${req.headers.origin || 'https://motosetuppro.com'}?canceled=true`,
      metadata: {
        user_id: user.id,
        plan: plan
      }
    });

    await pool.end();

    res.json({
      success: true,
      checkout_url: session.url,
      session_id: session.id
    });

  } catch (error) {
    console.error('Stripe checkout error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }

    res.status(500).json({
      error: 'Failed to create checkout session',
      details: error.message
    });
  }
};