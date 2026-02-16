import { clearSessionCookie, jsonResponseWithCookie } from './lib/auth.js';

export async function handler(event) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Clear the session cookie
  return jsonResponseWithCookie(
    200,
    {
      success: true,
      message: 'Logged out successfully',
    },
    clearSessionCookie()
  );
}
