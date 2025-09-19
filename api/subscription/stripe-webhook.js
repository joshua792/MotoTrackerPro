require('dotenv').config();
const { Pool } = require('pg');

// Disable body parsing for Stripe webhook signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper function to read raw body
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      resolve(data);
    });
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  console.log('=== STRIPE WEBHOOK CALLED ===');
  console.log('Method:', req.method);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));

  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get raw body for signature verification
    const rawBody = await getRawBody(req);
    console.log('Raw body length:', rawBody.length);
    if (!process.env.STRIPE_SECRET_KEY) {
      console.log('ERROR: Stripe configuration missing');
      return res.status(500).json({ error: 'Stripe configuration missing' });
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    console.log('Stripe initialized successfully');

    // Verify webhook signature (you'll need to set this in your environment)
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    console.log('Webhook signature present:', !!sig);
    console.log('Endpoint secret configured:', !!endpointSecret);

    let event;

    if (endpointSecret && sig) {
      try {
        event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
        console.log('Webhook signature verified successfully');
      } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }
    } else {
      // For testing without webhook signature verification
      console.log('WARNING: No webhook secret or signature - parsing JSON body');
      try {
        event = JSON.parse(rawBody);
        console.log('Event parsed from raw body successfully');
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

    console.log('Closing database connection...');
    await pool.end();
    console.log('Webhook processing completed successfully');
    res.json({ received: true });

  } catch (error) {
    console.error('=== WEBHOOK ERROR ===');
    console.error('Error details:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      error: 'Webhook processing failed',
      details: error.message
    });
  }
};

// Handle successful checkout
async function handleCheckoutCompleted(pool, session) {
  console.log('=== HANDLING CHECKOUT COMPLETED ===');
  console.log('Session ID:', session.id);
  console.log('Session data:', JSON.stringify(session, null, 2));

  const userId = session.metadata?.user_id;
  const plan = session.metadata?.plan;
  const stripeCustomerId = session.customer;
  const subscriptionId = session.subscription;

  console.log('Extracted data:', {
    userId,
    plan,
    stripeCustomerId,
    subscriptionId
  });

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
    console.log('Calculated dates:', { now, subscriptionEndDate });

    // Get plan details from database
    console.log('Looking up plan in database:', plan);
    const planQuery = 'SELECT usage_limit FROM subscription_plans WHERE plan_key = $1';
    const planResult = await pool.query(planQuery, [plan]);
    console.log('Plan query result:', planResult.rows);
    const usageLimit = planResult.rows.length > 0 ? planResult.rows[0].usage_limit : 500;
    console.log('Usage limit determined:', usageLimit);

    // Update user subscription status
    console.log('Updating user subscription in database...');
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

    console.log('Update query params:', [plan, subscriptionEndDate, stripeCustomerId, subscriptionId, usageLimit, userId]);

    const updateResult = await pool.query(updateQuery, [plan, subscriptionEndDate, stripeCustomerId, subscriptionId, usageLimit, userId]);

    console.log('Database update result:', {
      rowCount: updateResult.rowCount,
      command: updateResult.command
    });

    if (updateResult.rowCount === 0) {
      console.error('WARNING: No rows were updated - user might not exist:', userId);
    } else {
      console.log(`SUCCESS: User ${userId} subscription activated: ${plan}`);
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