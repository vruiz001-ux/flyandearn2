import { jsonResponse } from './lib/auth.js';
import { rateLimit, getRateLimitHeaders, getClientIp } from './lib/rate-limit.js';
import { sendEmail, contactConfirmationEmail } from './lib/email.js';

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  // Rate limit: 5 attempts per minute per IP
  const ip = getClientIp(event);
  const limit = rateLimit(ip, { maxRequests: 5, windowMs: 60000 });
  if (!limit.allowed) {
    return {
      statusCode: 429,
      headers: { 'Content-Type': 'application/json', ...getRateLimitHeaders(limit) },
      body: JSON.stringify({ error: 'Too many requests. Please try again later.' }),
    };
  }

  try {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return jsonResponse(400, { error: 'Invalid request body' });
    }
    const { name, email, subject, orderId, message } = body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return jsonResponse(400, { error: 'Missing required fields' });
    }

    // Validate email format
    if (!email.includes('@')) {
      return jsonResponse(400, { error: 'Invalid email format' });
    }

    // Log the contact form submission
    console.log('Contact form submission:', {
      name,
      email,
      subject,
      orderId: orderId || 'N/A',
      message: message.substring(0, 200) + (message.length > 200 ? '...' : ''),
      timestamp: new Date().toISOString(),
      ip: event.headers['x-forwarded-for'] || event.headers['client-ip'],
    });

    // Send confirmation email to user
    try {
      const emailData = contactConfirmationEmail(name, subject);
      await sendEmail({ to: email, ...emailData });
    } catch (emailErr) {
      console.error('Failed to send contact confirmation email:', emailErr);
    }

    return jsonResponse(200, {
      success: true,
      message: 'Your message has been received. We will get back to you within 24 hours.',
    });
  } catch (error) {
    console.error('Contact form error:', error);
    return jsonResponse(500, { error: 'Failed to process your request' });
  }
}
