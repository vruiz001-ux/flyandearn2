import bcrypt from 'bcryptjs';
import prisma from './lib/prisma.js';
import {
  createToken,
  createSessionCookie,
  isValidEmail,
  jsonResponse,
  jsonResponseWithCookie,
} from './lib/auth.js';
import { rateLimit, getRateLimitHeaders, getClientIp } from './lib/rate-limit.js';

export async function handler(event) {
  // Only allow POST requests
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
      body: JSON.stringify({ error: 'Too many login attempts. Please try again later.' }),
    };
  }

  try {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return jsonResponse(400, { error: 'Invalid request body' });
    }
    const { email, password } = body;

    // Validate required fields
    if (!email || !password) {
      return jsonResponse(400, {
        error: 'Missing required fields',
        details: 'Email and password are required',
      });
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return jsonResponse(400, {
        error: 'Invalid email format',
      });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Use same error message to prevent email enumeration
      return jsonResponse(401, {
        error: 'Invalid credentials',
        details: 'Email or password is incorrect',
      });
    }

    // Check if user is banned
    if (user.isBanned) {
      return jsonResponse(403, {
        error: 'Account suspended',
        details: user.bannedReason || 'Your account has been suspended. Please contact support.',
      });
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordValid) {
      return jsonResponse(401, {
        error: 'Invalid credentials',
        details: 'Email or password is incorrect',
      });
    }

    // Update last login timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Create JWT token
    const token = await createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      isTraveler: user.isTraveler,
      isBuyer: user.isBuyer,
    });

    // Return success with session cookie
    return jsonResponseWithCookie(
      200,
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isBuyer: user.isBuyer,
          isTraveler: user.isTraveler,
          emailVerified: user.emailVerified,
          phone: user.phone,
          city: user.city,
          country: user.country,
          createdAt: user.createdAt,
        },
      },
      createSessionCookie(token)
    );
  } catch (error) {
    console.error('Login error:', error);
    return jsonResponse(500, {
      error: 'Internal server error',
      details: 'An unexpected error occurred during login',
    });
  }
}
