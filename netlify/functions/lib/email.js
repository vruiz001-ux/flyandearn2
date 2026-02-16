import sgMail from '@sendgrid/mail';

const FROM_EMAIL = 'noreply@flyandearn.eu';
const FROM_NAME = 'FlyAndEarn';
const BRAND_BG = '#0a0a0b';
const BRAND_GOLD = '#d4a853';
const BRAND_GOLD_HOVER = '#e6c278';
const TEXT_COLOR = '#e0e0e0';
const TEXT_MUTED = '#999999';

function initSendGrid() {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) {
    console.warn('SENDGRID_API_KEY not set — emails will be logged only');
    return false;
  }
  sgMail.setApiKey(key);
  return true;
}

export async function sendEmail({ to, subject, html, text }) {
  const initialized = initSendGrid();

  if (!initialized) {
    console.log(`[EMAIL STUB] To: ${to}, Subject: ${subject}`);
    return { success: true, stub: true };
  }

  try {
    await sgMail.send({
      to,
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject,
      html,
      text: text || subject,
    });
    return { success: true };
  } catch (error) {
    console.error('SendGrid error:', error.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

// ─── Base layout wrapper ───

function emailLayout(content) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:${BRAND_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND_BG};">
<tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#141416;border-radius:12px;overflow:hidden;border:1px solid #2a2a2d;">
<!-- Header -->
<tr><td style="padding:32px 40px 24px;text-align:center;border-bottom:1px solid #2a2a2d;">
  <span style="font-size:28px;font-weight:700;color:${BRAND_GOLD};letter-spacing:1px;">Fly<span style="color:${TEXT_COLOR};">&amp;</span>Earn</span>
</td></tr>
<!-- Content -->
<tr><td style="padding:40px;">
  ${content}
</td></tr>
<!-- Footer -->
<tr><td style="padding:24px 40px;border-top:1px solid #2a2a2d;text-align:center;">
  <p style="margin:0 0 8px;font-size:12px;color:${TEXT_MUTED};">© ${new Date().getFullYear()} FlyAndEarn. All rights reserved.</p>
  <p style="margin:0;font-size:12px;color:${TEXT_MUTED};">
    <a href="https://flyandearn.eu/unsubscribe" style="color:${TEXT_MUTED};text-decoration:underline;">Unsubscribe</a>
    &nbsp;·&nbsp;
    <a href="https://flyandearn.eu/privacy" style="color:${TEXT_MUTED};text-decoration:underline;">Privacy Policy</a>
  </p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function buttonHtml(text, url) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:32px auto;">
<tr><td align="center" style="background-color:${BRAND_GOLD};border-radius:8px;">
  <a href="${url}" target="_blank" style="display:inline-block;padding:14px 36px;font-size:16px;font-weight:600;color:${BRAND_BG};text-decoration:none;border-radius:8px;">${text}</a>
</td></tr>
</table>`;
}

// ─── Email templates ───

export function verificationEmail(name, token, baseUrl) {
  const link = `${baseUrl}/verify-email?token=${token}`;
  const html = emailLayout(`
    <h1 style="margin:0 0 16px;font-size:24px;color:${TEXT_COLOR};">Verify Your Account</h1>
    <p style="margin:0 0 8px;font-size:16px;color:${TEXT_COLOR};line-height:1.6;">Hi ${name || 'there'},</p>
    <p style="margin:0 0 24px;font-size:16px;color:${TEXT_MUTED};line-height:1.6;">Thanks for signing up! Please verify your email address to get started.</p>
    ${buttonHtml('Verify My Email', link)}
    <p style="margin:0;font-size:13px;color:${TEXT_MUTED};line-height:1.6;">This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
    <p style="margin:16px 0 0;font-size:12px;color:${TEXT_MUTED};word-break:break-all;">Or copy this link: ${link}</p>
  `);
  return {
    subject: 'Verify your FlyAndEarn account',
    html,
    text: `Hi ${name || 'there'}, verify your account: ${link}`,
  };
}

export function passwordResetEmail(name, token, baseUrl, expiryHours = 1) {
  const link = `${baseUrl}/reset-password?token=${token}`;
  const html = emailLayout(`
    <h1 style="margin:0 0 16px;font-size:24px;color:${TEXT_COLOR};">Reset Your Password</h1>
    <p style="margin:0 0 8px;font-size:16px;color:${TEXT_COLOR};line-height:1.6;">Hi ${name || 'there'},</p>
    <p style="margin:0 0 24px;font-size:16px;color:${TEXT_MUTED};line-height:1.6;">We received a request to reset your password. Click below to choose a new one.</p>
    ${buttonHtml('Reset Password', link)}
    <p style="margin:0 0 8px;font-size:13px;color:${TEXT_MUTED};line-height:1.6;">⏱ This link expires in <strong style="color:${BRAND_GOLD};">${expiryHours} hour${expiryHours > 1 ? 's' : ''}</strong>.</p>
    <p style="margin:0;font-size:13px;color:${TEXT_MUTED};line-height:1.6;">If you didn't request this, no action is needed — your password remains unchanged.</p>
    <p style="margin:16px 0 0;font-size:12px;color:${TEXT_MUTED};word-break:break-all;">Or copy this link: ${link}</p>
  `);
  return {
    subject: 'Reset your FlyAndEarn password',
    html,
    text: `Hi ${name || 'there'}, reset your password: ${link} (expires in ${expiryHours}h)`,
  };
}

export function welcomeEmail(name) {
  const html = emailLayout(`
    <h1 style="margin:0 0 16px;font-size:24px;color:${TEXT_COLOR};">Welcome to FlyAndEarn! 🎉</h1>
    <p style="margin:0 0 8px;font-size:16px;color:${TEXT_COLOR};line-height:1.6;">Hi ${name || 'there'},</p>
    <p style="margin:0 0 24px;font-size:16px;color:${TEXT_MUTED};line-height:1.6;">Your email has been verified and your account is ready to go.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr><td style="padding:16px;background-color:#1a1a1d;border-radius:8px;border-left:3px solid ${BRAND_GOLD};">
        <p style="margin:0 0 8px;font-size:14px;color:${BRAND_GOLD};font-weight:600;">Here's what you can do:</p>
        <p style="margin:0 0 4px;font-size:14px;color:${TEXT_MUTED};">✈️ <strong style="color:${TEXT_COLOR};">Travelers</strong> — List your upcoming flights and earn by carrying items</p>
        <p style="margin:0;font-size:14px;color:${TEXT_MUTED};">📦 <strong style="color:${TEXT_COLOR};">Requestors</strong> — Post delivery requests and find travelers on your route</p>
      </td></tr>
    </table>
    ${buttonHtml('Go to Dashboard', 'https://flyandearn.eu/dashboard')}
    <p style="margin:0;font-size:13px;color:${TEXT_MUTED};line-height:1.6;">Need help? Reply to this email or visit our <a href="https://flyandearn.eu/contact" style="color:${BRAND_GOLD};">contact page</a>.</p>
  `);
  return {
    subject: 'Welcome to FlyAndEarn — you\'re all set!',
    html,
    text: `Welcome ${name || 'there'}! Your FlyAndEarn account is verified and ready. Visit https://flyandearn.eu/dashboard to get started.`,
  };
}

export function matchNotificationEmail(name, matchType, details) {
  // matchType: 'traveler_matched' | 'request_on_route'
  const isTraveler = matchType === 'request_on_route';
  const heading = isTraveler ? 'New Request on Your Route!' : 'A Traveler Matched Your Request!';
  const description = isTraveler
    ? 'Someone needs an item delivered on a route you\'re traveling.'
    : 'A traveler is heading to your destination and can carry your item.';

  const detailRows = Object.entries(details || {})
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;font-size:14px;color:${TEXT_MUTED};">${k}</td><td style="padding:4px 0;font-size:14px;color:${TEXT_COLOR};">${v}</td></tr>`)
    .join('');

  const html = emailLayout(`
    <h1 style="margin:0 0 16px;font-size:24px;color:${TEXT_COLOR};">🔔 ${heading}</h1>
    <p style="margin:0 0 8px;font-size:16px;color:${TEXT_COLOR};line-height:1.6;">Hi ${name || 'there'},</p>
    <p style="margin:0 0 24px;font-size:16px;color:${TEXT_MUTED};line-height:1.6;">${description}</p>
    ${detailRows ? `<table role="presentation" style="margin:0 0 24px;width:100%;background-color:#1a1a1d;border-radius:8px;padding:16px;" cellpadding="8" cellspacing="0">${detailRows}</table>` : ''}
    ${buttonHtml('View Details', 'https://flyandearn.eu/dashboard')}
    <p style="margin:0;font-size:13px;color:${TEXT_MUTED};line-height:1.6;">Act fast — matches are first-come, first-served!</p>
  `);
  return {
    subject: heading,
    html,
    text: `Hi ${name || 'there'}, ${description} Check your dashboard: https://flyandearn.eu/dashboard`,
  };
}

export function contactConfirmationEmail(name, subject) {
  const html = emailLayout(`
    <h1 style="margin:0 0 16px;font-size:24px;color:${TEXT_COLOR};">We Received Your Message</h1>
    <p style="margin:0 0 8px;font-size:16px;color:${TEXT_COLOR};line-height:1.6;">Hi ${name || 'there'},</p>
    <p style="margin:0 0 24px;font-size:16px;color:${TEXT_MUTED};line-height:1.6;">Thanks for reaching out! We've received your message regarding <strong style="color:${TEXT_COLOR};">"${subject}"</strong> and will get back to you within 24 hours.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr><td style="padding:16px;background-color:#1a1a1d;border-radius:8px;border-left:3px solid ${BRAND_GOLD};">
        <p style="margin:0;font-size:14px;color:${TEXT_MUTED};">In the meantime, you might find answers in our <a href="https://flyandearn.eu/faq" style="color:${BRAND_GOLD};">FAQ section</a>.</p>
      </td></tr>
    </table>
    <p style="margin:0;font-size:13px;color:${TEXT_MUTED};line-height:1.6;">Please don't reply to this email — it's sent from an unmonitored address.</p>
  `);
  return {
    subject: 'We received your message — FlyAndEarn',
    html,
    text: `Hi ${name || 'there'}, we received your message about "${subject}" and will respond within 24 hours.`,
  };
}
