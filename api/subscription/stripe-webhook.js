require('dotenv').config();
const { Pool } = require('pg');

// Disable body parsing for Stripe webhook signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper function to read raw body as Buffer for Stripe signature verification
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  console.log('Stripe webhook received:', new Date().toISOString());

  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get raw body for signature verification
    const rawBody = await getRawBody(req);
    if (!process.env.STRIPE_SECRET_KEY) {
      console.log('ERROR: Stripe configuration missing');
      return res.status(500).json({ error: 'Stripe configuration missing' });
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    // Verify webhook signature
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    // Check if this is from Stripe CLI (for testing) or if we should skip verification
    const userAgent = req.headers['user-agent'] || '';
    const isStripeCLI = userAgent.includes('Stripe-CLI') || userAgent.includes('stripe-cli');
    const forceSkipVerification = !endpointSecret; // Skip if no webhook secret configured

    if (endpointSecret && sig && !isStripeCLI && !forceSkipVerification) {
      try {
        event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
        console.log('Webhook signature verified');
      } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }
    } else {
      // For testing without webhook signature verification (CLI or no secret configured)
      if (isStripeCLI) {
        console.log('Stripe CLI detected - skipping signature verification');
      } else if (forceSkipVerification) {
        console.log('WARNING: No webhook secret configured - skipping signature verification');
      }
      try {
        const bodyString = rawBody.toString('utf8');
        event = JSON.parse(bodyString);
      } catch (parseError) {
        console.error('Failed to parse webhook body:', parseError.message);
        return res.status(400).json({ error: 'Invalid JSON body' });
      }
    }

    console.log('Event received:', {
      id: event.id,
      type: event.type,
      created: event.created
    });

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
    console.error('Webhook processing error:', error.message);
    res.status(500).json({
      error: 'Webhook processing failed',
      details: error.message
    });
  }
};

// Handle successful checkout
async function handleCheckoutCompleted(pool, session) {
  console.log('Processing checkout completion for session:', session.id);

  const userId = session.metadata?.user_id;
  const plan = session.metadata?.plan;
  const stripeCustomerId = session.customer;
  const subscriptionId = session.subscription;

  if (!userId || !plan) {
    console.error('Missing metadata in checkout session:', {
      userId: !!userId,
      plan: !!plan,
      metadata: session.metadata
    });
    return;
  }

  try {
    // Calculate subscription dates
    const now = new Date();
    const subscriptionEndDate = new Date(now);
    subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1);

    // Get plan details from database
    const planQuery = 'SELECT usage_limit FROM subscription_plans WHERE plan_key = $1';
    const planResult = await pool.query(planQuery, [plan]);
    const usageLimit = planResult.rows.length > 0 ? planResult.rows[0].usage_limit : 500;

    // Update user subscription status
    const updateQuery = `
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
    `;

    const updateResult = await pool.query(updateQuery, [plan, subscriptionEndDate, stripeCustomerId, subscriptionId, usageLimit, userId]);

    if (updateResult.rowCount === 0) {
      console.error('WARNING: No rows updated - user might not exist:', userId);
    } else {
      console.log(`User ${userId} subscription activated: ${plan}`);
    }
  } catch (error) {
    console.error('Error in handleCheckoutCompleted:', error);
    throw error;
  }
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