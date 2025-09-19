# Email Configuration for Team Invitations

This app now supports sending email invitations for team members using Resend (recommended) or any email service provider.

## Environment Variables Required

Add these to your Vercel environment variables:

```bash
RESEND_API_KEY=re_xxxxxxxxxx
FROM_EMAIL=noreply@yourdomain.com
BASE_URL=https://your-app.vercel.app
```

## Setup Instructions

### Option 1: Resend (Recommended)

1. **Sign up for Resend**: https://resend.com
   - Free tier: 3,000 emails/month
   - Great deliverability and simple API

2. **Get API Key**:
   - Go to Resend dashboard
   - Create new API key
   - Copy the key (starts with `re_`)

3. **Add Domain** (for production):
   - Add your domain in Resend dashboard
   - Verify DNS records
   - Use `noreply@yourdomain.com` as FROM_EMAIL

4. **For Development/Testing**:
   - You can use Resend's sandbox mode
   - FROM_EMAIL can be `onboarding@resend.dev` for testing

### Option 2: SendGrid (Alternative)

If you prefer SendGrid, update the email service in `api/email/send-invitation.js`:

```javascript
// Replace Resend API call with SendGrid
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
```

## Vercel Environment Variables

In your Vercel dashboard → Settings → Environment Variables:

```
RESEND_API_KEY = re_your_actual_api_key_here
FROM_EMAIL = noreply@yourdomain.com
BASE_URL = https://mototrackerapp.vercel.app
```

## Email Template Features

The invitation emails include:
- ✅ Professional HTML template with styling
- ✅ Team name and inviter information
- ✅ Direct invitation acceptance link
- ✅ Expiration date (7 days)
- ✅ Instructions for new users
- ✅ Plain text fallback
- ✅ Mobile-responsive design

## How It Works

1. **Team owner/admin** invites member via email
2. **System** creates invitation token and stores in database
3. **Email** is sent with invitation link: `yourapp.com/?invitation=token123`
4. **Recipient** clicks link and:
   - If not logged in: prompted to login/register
   - If logged in: automatically joins team
5. **Success**: User is added to team and can access shared motorcycles

## Fallback Behavior

If email service is not configured:
- Invitation is still created in database
- User gets message: "Email delivery failed - please share the invitation link manually"
- Team owner can manually share the invitation URL

## Testing

1. Configure environment variables in Vercel
2. Deploy the app
3. Create team invitation
4. Check email delivery
5. Test invitation acceptance flow

## Troubleshooting

**Email not sending?**
- Check Vercel environment variables are set
- Verify RESEND_API_KEY is valid
- Check FROM_EMAIL domain is verified (for production)

**Invitation link not working?**
- Verify BASE_URL matches your deployed app URL
- Check invitation hasn't expired (7 days)
- Ensure invitation token is valid

**User can't accept invitation?**
- Verify user email matches invitation email
- Check user is logged in when clicking link
- Ensure team is still active