import bcrypt from 'bcryptjs';
import prisma from './lib/prisma.js';
import {
  createToken,
  createSessionCookie,
  isValidEmail,
  validatePassword,
  jsonResponse,
  jsonResponseWithCookie,
} from './lib/auth.js';
import { rateLimit, getRateLimitHeaders, getClientIp } from './lib/rate-limit.js';

// Sanitize input to prevent XSS
function sanitize(str) {
  if (!str) return str;
  return str.replace(/<[^>]*>/g, '').trim();
}

export async function handler(event) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  // Rate limit: 3 attempts per minute per IP
  const ip = getClientIp(event);
  const rlimit = rateLimit(ip, { maxRequests: 3, windowMs: 60000 });
  if (!rlimit.allowed) {
    return {
      statusCode: 429,
      headers: { 'Content-Type': 'application/json', ...getRateLimitHeaders(rlimit) },
      body: JSON.stringify({ error: 'Too many registration attempts. Please try again later.' }),
    };
  }

  try {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return jsonResponse(400, { error: 'Invalid request body' });
    }
    const { email, password, name, role, isTraveler, isBuyer, phone, latitude, longitude, city, country, street, postalCode } = body;

    // Validate required fields
    if (!email || !password || !name) {
      return jsonResponse(400, {
        error: 'Missing required fields',
        details: 'Email, password, and name are required',
      });
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return jsonResponse(400, {
        error: 'Invalid email format',
      });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return jsonResponse(400, {
        error: 'Password does not meet requirements',
        details: passwordValidation.errors,
      });
    }

    // Handle role selection - support both new (isTraveler/isBuyer) and legacy (role) formats
    let userIsTraveler = isTraveler === true;
    let userIsBuyer = isBuyer === true;

    // Legacy support: if role is provided but isTraveler/isBuyer are not
    if (role && isTraveler === undefined && isBuyer === undefined) {
      const normalizedRole = role.toUpperCase();
      userIsTraveler = normalizedRole === 'TRAVELLER';
      userIsBuyer = normalizedRole === 'BUYER';
    }

    // At least one role must be selected
    if (!userIsTraveler && !userIsBuyer) {
      return jsonResponse(400, {
        error: 'Invalid role selection',
        details: 'You must select at least one role: Traveler or Requestor (Buyer)',
      });
    }

    // Determine legacy role field (primary role for backward compatibility)
    const legacyRole = userIsTraveler ? 'TRAVELLER' : 'BUYER';

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return jsonResponse(409, {
        error: 'Email already registered',
        details: 'An account with this email already exists. Please log in instead.',
      });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user with sanitized inputs
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name: sanitize(name),
        role: legacyRole,
        isTraveler: userIsTraveler,
        isBuyer: userIsBuyer,
        phone: sanitize(phone) || null,
        street: sanitize(street) || null,
        postalCode: sanitize(postalCode) || null,
        city: sanitize(city) || null,
        country: sanitize(country) || null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isTraveler: true,
        isBuyer: true,
        emailVerified: true,
        phone: true,
        city: true,
        country: true,
        createdAt: true,
      },
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
      201,
      {
        success: true,
        user,
      },
      createSessionCookie(token)
    );
  } catch (error) {
    console.error('Registration error:', error);
    return jsonResponse(500, {
      error: 'Internal server error',
      details: 'An unexpected error occurred during registration',
    });
  }
}
