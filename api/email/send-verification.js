// Email verification service
// Sends verification emails to new users

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@motosetuppro.com';
const BASE_URL = process.env.BASE_URL || 'https://motosetuppro.com';

async function sendVerificationEmail({
  toEmail,
  userName,
  verificationToken
}) {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured - verification email not sent');
    return { success: false, error: 'Email service not configured' };
  }

  const verificationUrl = `${BASE_URL}/?verify=${verificationToken}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Email Verification - MotoSetup Pro</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2c5aa0; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button {
                display: inline-block;
                background: #28a745;
                color: white;
                padding: 15px 30px;
                text-decoration: none;
                border-radius: 5px;
                margin: 20px 0;
                font-weight: bold;
                font-size: 16px;
            }
            .warning { color: #856404; background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>MotoSetup Pro</h1>
                <h2>Email Verification Required</h2>
            </div>

            <div class="content">
                <h3>Welcome to MotoSetup Pro, ${userName}!</h3>

                <p>Thank you for creating your account. To complete your registration and access all features, please verify your email address.</p>

                <div style="text-align: center;">
                    <a href="${verificationUrl}" class="button">Verify My Email Address</a>
                </div>

                <div class="warning">
                    <strong>Important:</strong> This verification link expires in <strong>24 hours</strong>.
                    Some features like team management will be limited until you verify your email.
                </div>

                <p><strong>What happens after verification?</strong></p>
                <ul>
                    <li>Full access to all MotoSetup Pro features</li>
                    <li>Ability to create and join teams</li>
                    <li>Receive team invitations</li>
                    <li>Access to premium features during your trial</li>
                </ul>

                <hr style="margin: 30px 0; border: 1px solid #ddd;">

                <p style="font-size: 14px; color: #666;">
                    If you didn't create this account, you can safely ignore this email.
                    The account will be automatically removed if not verified within 7 days.
                </p>

                <p style="font-size: 12px; color: #888;">
                    <strong>Direct link (if button doesn't work):</strong><br>
                    <a href="${verificationUrl}">${verificationUrl}</a>
                </p>
            </div>

            <div class="footer">
                <p>MotoSetup Pro - Professional Motorcycle Setup Tracking</p>
                <p>This email was sent because you created an account with this email address.</p>
            </div>
        </div>
    </body>
    </html>
  `;

  const textContent = `
MotoSetup Pro - Email Verification Required

Welcome to MotoSetup Pro, ${userName}!

Thank you for creating your account. To complete your registration and access all features, please verify your email address.

Verify your email: ${verificationUrl}

IMPORTANT: This verification link expires in 24 hours. Some features like team management will be limited until you verify your email.

What happens after verification?
- Full access to all MotoSetup Pro features
- Ability to create and join teams
- Receive team invitations
- Access to premium features during your trial

If you didn't create this account, you can safely ignore this email.

---
MotoSetup Pro - Professional Motorcycle Setup Tracking
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: toEmail,
        subject: `Welcome to MotoSetup Pro - Please verify your email`,
        html: htmlContent,
        text: textContent,
      }),
    });

    const result = await response.json();

    if (response.ok) {
      console.log('Verification email sent successfully:', result.id);
      return { success: true, emailId: result.id };
    } else {
      console.error('Failed to send verification email:', result);
      return { success: false, error: result.message || 'Failed to send email' };
    }

  } catch (error) {
    console.error('Error sending verification email:', error);
    return { success: false, error: error.message };
  }
}

module.exports = { sendVerificationEmail };