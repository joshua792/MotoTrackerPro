# Environment Setup Guide

This document provides comprehensive information about setting up the environment variables and security configurations for the MotoTrackerPro application.

## Required Environment Variables

Create a `.env` file in your project root with the following variables:

```bash
# Database Configuration
DATABASE_URL=your_postgresql_connection_string

# JWT Security
JWT_SECRET=your_100_character_random_jwt_secret

# Stripe Configuration
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_endpoint_secret
```

## Environment Variable Details

### Database Configuration
- **DATABASE_URL**: PostgreSQL connection string for your database
  - Format: `postgresql://username:password@host:port/database?sslmode=require`
  - For Neon: Use the connection string provided in your Neon dashboard

### JWT Security
- **JWT_SECRET**: A secure random string used to sign JSON Web Tokens
  - **CRITICAL**: Must be at least 64 characters long for security
  - Generate using: `openssl rand -hex 50` or similar secure method
  - Never share or commit this value

### Stripe Configuration
- **STRIPE_SECRET_KEY**: Your Stripe secret key (starts with `sk_`)
  - Found in your Stripe Dashboard → Developers → API keys
  - Use test key (`sk_test_`) for development
  - Use live key (`sk_live_`) for production
- **STRIPE_WEBHOOK_SECRET**: Webhook endpoint secret for signature verification
  - Found in Stripe Dashboard → Developers → Webhooks → [Your Endpoint] → Signing secret
  - Format: `whsec_...`

## Security Best Practices

### 1. Environment File Security
- **NEVER** commit `.env` files to version control
- Add `.env` to your `.gitignore` file
- Use `.env.example` for documenting required variables (without actual values)

### 2. Production Deployment
- Set environment variables directly in your hosting platform (Vercel, Heroku, etc.)
- Never use `.env` files in production environments
- Rotate secrets regularly

### 3. Access Control
- Use database users with minimal required permissions
- Enable SSL/TLS for all database connections
- Implement proper API authentication and authorization

## Stripe Webhook Setup

1. **Create Webhook Endpoint**:
   - Go to Stripe Dashboard → Developers → Webhooks
   - Click "Add endpoint"
   - URL: `https://yourdomain.com/api/subscription/stripe-webhook`

2. **Select Events**:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`

3. **Copy Signing Secret**:
   - After creating the webhook, copy the signing secret
   - Add it to your environment as `STRIPE_WEBHOOK_SECRET`

## Database User Setup (Neon)

For production security, create a dedicated database user:

1. **Create User**:
   ```sql
   CREATE USER moto_tracker_app WITH PASSWORD 'secure_random_password';
   ```

2. **Grant Permissions**:
   ```sql
   GRANT CONNECT ON DATABASE your_database TO moto_tracker_app;
   GRANT USAGE ON SCHEMA public TO moto_tracker_app;
   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO moto_tracker_app;
   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO moto_tracker_app;
   ```

3. **Update Connection String**:
   ```
   DATABASE_URL=postgresql://moto_tracker_app:secure_random_password@host:port/database?sslmode=require
   ```

## Verification Checklist

- [ ] `.env` file created with all required variables
- [ ] `.env` added to `.gitignore`
- [ ] Stripe webhook endpoint configured
- [ ] Database user has minimal required permissions
- [ ] JWT secret is at least 64 characters
- [ ] All secrets are unique and randomly generated
- [ ] Production environment variables set in hosting platform

## Troubleshooting

### Common Issues

1. **"Stripe configuration missing" error**:
   - Verify `STRIPE_SECRET_KEY` is set correctly
   - Ensure the key starts with `sk_test_` or `sk_live_`

2. **"Invalid token" error**:
   - Check that `JWT_SECRET` matches between token creation and verification
   - Ensure the secret is properly loaded from environment

3. **Database connection errors**:
   - Verify `DATABASE_URL` format and credentials
   - Check if SSL is required for your database provider

4. **Webhook signature verification failed**:
   - Ensure `STRIPE_WEBHOOK_SECRET` matches the webhook endpoint secret
   - Verify the webhook URL is correctly configured in Stripe

## Support

For additional help:
- Review Stripe documentation: https://stripe.com/docs
- Check database provider documentation (Neon, PostgreSQL)
- Verify environment variable loading with `console.log(!!process.env.VARIABLE_NAME)`