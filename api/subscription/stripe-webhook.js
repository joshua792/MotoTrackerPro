require('dotenv').config();
const { Pool } = require('pg');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Stripe configuration missing' });
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    // Verify webhook signature (you'll need to set this in your environment)
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    if (endpointSecret) {
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }
    } else {
      // For testing without webhook signature verification
      event = req.body;
    }

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    // Handle the event
    console.log('Webhook received event type:', event.type);
    switch (event.type) {
      case 'checkout.session.completed':
        console.log('Processing checkout.session.completed');
        await handleCheckoutCompleted(pool, event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(pool, event.data.object);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(pool, event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionCanceled(pool, event.data.object);
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    await pool.end();
    res.json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({
      error: 'Webhook processing failed',
      details: error.message
    });
  }
};

// Handle successful checkout
async function handleCheckoutCompleted(pool, session) {
  console.log('Checkout completed:', session.id);

  const userId = session.metadata.user_id;
  const plan = session.metadata.plan;
  const stripeCustomerId = session.customer;
  const subscriptionId = session.subscription;

  if (!userId || !plan) {
    console.error('Missing metadata in checkout session');
    return;
  }

  // Calculate subscription dates
  const now = new Date();
  const subscriptionEndDate = new Date(now);
  subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1);

  // Get plan details from database
  const planQuery = 'SELECT usage_limit FROM subscription_plans WHERE plan_key = $1';
  const planResult = await pool.query(planQuery, [plan]);
  const usageLimit = planResult.rows.length > 0 ? planResult.rows[0].usage_limit : 500;

  // Update user subscription status
  await pool.query(`
    UPDATE users SET
      subscription_status = 'active',
      subscription_plan = $1,
      subscription_start_date = NOW(),
      subscription_end_date = $2,
      stripe_customer_id = $3,
      stripe_subscription_id = $4,
      usage_limit = $5,
      updated_at = NOW()
    WHERE id = $6
  `, [plan, subscriptionEndDate, stripeCustomerId, subscriptionId, usageLimit, userId]);

  console.log(`User ${userId} subscription activated: ${plan}`);
}

// Handle successful payment (monthly renewal)
async function handlePaymentSucceeded(pool, invoice) {
  console.log('Payment succeeded:', invoice.id);

  const subscriptionId = invoice.subscription;

  if (!subscriptionId) return;

  // Extend subscription by one month
  const subscriptionEndDate = new Date();
  subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1);

  await pool.query(`
    UPDATE users SET
      subscription_end_date = $1,
      subscription_status = 'active',
      updated_at = NOW()
    WHERE stripe_subscription_id = $2
  `, [subscriptionEndDate, subscriptionId]);

  console.log(`Subscription ${subscriptionId} renewed`);
}

// Handle failed payment
async function handlePaymentFailed(pool, invoice) {
  console.log('Payment failed:', invoice.id);

  const subscriptionId = invoice.subscription;

  if (!subscriptionId) return;

  // Mark subscription as payment failed
  await pool.query(`
    UPDATE users SET
      subscription_status = 'payment_failed',
      updated_at = NOW()
    WHERE stripe_subscription_id = $1
  `, [subscriptionId]);

  console.log(`Subscription ${subscriptionId} payment failed`);
}

// Handle subscription cancellation
async function handleSubscriptionCanceled(pool, subscription) {
  console.log('Subscription canceled:', subscription.id);

  // Mark subscription as cancelled but keep access until end date
  await pool.query(`
    UPDATE users SET
      subscription_status = 'cancelled',
      stripe_subscription_id = NULL,
      updated_at = NOW()
    WHERE stripe_subscription_id = $1
  `, [subscription.id]);

  console.log(`Subscription ${subscription.id} marked as cancelled`);
}