import prisma from './lib/prisma.js';
import { getSessionToken, verifyToken, jsonResponse } from './lib/auth.js';

export async function handler(event) {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    // Get session token from cookies
    const token = getSessionToken(event);

    if (!token) {
      return jsonResponse(401, {
        error: 'Not authenticated',
        details: 'No session found',
      });
    }

    // Verify the token
    const payload = await verifyToken(token);

    if (!payload || !payload.userId) {
      return jsonResponse(401, {
        error: 'Invalid session',
        details: 'Session has expired or is invalid',
      });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isTraveler: true,
        isBuyer: true,
        emailVerified: true,
        isBanned: true,
        phone: true,
        street: true,
        postalCode: true,
        city: true,
        country: true,
        latitude: true,
        longitude: true,
        // Locale preferences
        preferredLocale: true,
        preferredLanguage: true,
        preferredCountry: true,
        timezone: true,
        createdAt: true,
      },
    });

    if (!user) {
      return jsonResponse(401, {
        error: 'User not found',
        details: 'The user associated with this session no longer exists',
      });
    }

    // Check if user is banned
    if (user.isBanned) {
      return jsonResponse(403, {
        error: 'Account suspended',
        details: 'Your account has been suspended. Please contact support.',
      });
    }

    return jsonResponse(200, {
      success: true,
      user,
    });
  } catch (error) {
    console.error('Session check error:', error);
    return jsonResponse(500, {
      error: 'Internal server error',
      details: 'An unexpected error occurred while checking session',
    });
  }
}
