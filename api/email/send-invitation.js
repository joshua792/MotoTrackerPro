// Email service for sending team invitations
// Using Resend API for email delivery

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@yourdomain.com';
const BASE_URL = process.env.BASE_URL || 'https://your-app.vercel.app';

async function sendTeamInvitationEmail({
  toEmail,
  teamName,
  inviterName,
  invitationToken,
  expiresAt
}) {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured - email not sent');
    return { success: false, error: 'Email service not configured' };
  }

  const invitationUrl = `${BASE_URL}/?invitation=${invitationToken}`;
  const expiresDate = new Date(expiresAt).toLocaleDateString();

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Team Invitation - MotoSetup Pro</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2c5aa0; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button {
                display: inline-block;
                background: #28a745;
                color: white;
                padding: 12px 25px;
                text-decoration: none;
                border-radius: 5px;
                margin: 20px 0;
                font-weight: bold;
            }
            .warning { color: #856404; background: #fff3cd; padding: 10px; border-radius: 5px; margin: 15px 0; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🏍️ MotoSetup Pro</h1>
                <h2>Team Invitation</h2>
            </div>

            <div class="content">
                <h3>You've been invited to join a team!</h3>

                <p><strong>${inviterName}</strong> has invited you to join the <strong>"${teamName}"</strong> team on MotoSetup Pro.</p>

                <p>As a team member, you'll be able to:</p>
                <ul>
                    <li>Share motorcycle setups with team members</li>
                    <li>Access team-owned motorcycle data</li>
                    <li>Collaborate on race weekend setups</li>
                    <li>Track performance across the team</li>
                </ul>

                <div style="text-align: center;">
                    <a href="${invitationUrl}" class="button">Accept Invitation</a>
                </div>

                <div class="warning">
                    <strong>⏰ Important:</strong> This invitation expires on <strong>${expiresDate}</strong>.
                    You must have a MotoSetup Pro account to accept this invitation.
                </div>

                <p><strong>Don't have an account yet?</strong></p>
                <p>Create a free account at <a href="${BASE_URL}">MotoSetup Pro</a>, then click the invitation link above.</p>

                <hr style="margin: 30px 0; border: 1px solid #ddd;">

                <p style="font-size: 14px; color: #666;">
                    If you weren't expecting this invitation, you can safely ignore this email.
                    The invitation will expire automatically.
                </p>

                <p style="font-size: 12px; color: #888;">
                    <strong>Direct link (if button doesn't work):</strong><br>
                    <a href="${invitationUrl}">${invitationUrl}</a>
                </p>
            </div>

            <div class="footer">
                <p>MotoSetup Pro - Professional Motorcycle Setup Tracking</p>
                <p>This email was sent because you were invited to join a team.</p>
            </div>
        </div>
    </body>
    </html>
  `;

  const textContent = `
MotoSetup Pro - Team Invitation

You've been invited to join a team!

${inviterName} has invited you to join the "${teamName}" team on MotoSetup Pro.

As a team member, you'll be able to:
- Share motorcycle setups with team members
- Access team-owned motorcycle data
- Collaborate on race weekend setups
- Track performance across the team

Accept your invitation: ${invitationUrl}

IMPORTANT: This invitation expires on ${expiresDate}. You must have a MotoSetup Pro account to accept this invitation.

Don't have an account yet?
Create a free account at ${BASE_URL}, then use the invitation link above.

If you weren't expecting this invitation, you can safely ignore this email.

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
        subject: `Team Invitation: Join "${teamName}" on MotoSetup Pro`,
        html: htmlContent,
        text: textContent,
      }),
    });

    const result = await response.json();

    if (response.ok) {
      console.log('Team invitation email sent successfully:', result.id);
      return { success: true, emailId: result.id };
    } else {
      console.error('Failed to send team invitation email:', result);
      return { success: false, error: result.message || 'Failed to send email' };
    }

  } catch (error) {
    console.error('Error sending team invitation email:', error);
    return { success: false, error: error.message };
  }
}

module.exports = { sendTeamInvitationEmail };