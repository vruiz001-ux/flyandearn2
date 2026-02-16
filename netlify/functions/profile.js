import prisma from './lib/prisma.js';
import { getSessionToken, verifyToken, jsonResponse } from './lib/auth.js';

// Sanitize input to prevent XSS
function sanitize(str) {
  if (!str) return str;
  return str.replace(/<[^>]*>/g, '').trim();
}

// Currency mapping by country
function getCurrencyForCountry(country) {
  if (!country) return 'EUR';
  const polishVariants = ['poland', 'polska', 'pl', 'pol'];
  return polishVariants.includes(country.toLowerCase()) ? 'PLN' : 'EUR';
}

export async function handler(event) {
  // Only allow PUT/PATCH requests
  if (event.httpMethod !== 'PUT' && event.httpMethod !== 'PATCH') {
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

    let parsedBody;
    try {
      parsedBody = JSON.parse(event.body || '{}');
    } catch {
      return jsonResponse(400, { error: 'Invalid request body' });
    }
    const {
      name,
      phone,
      street,
      postalCode,
      city,
      country,
      isTraveler,
      isBuyer,
      // Locale preferences
      preferredLocale,
      preferredLanguage,
      preferredCountry,
      timezone,
    } = parsedBody;

    // Get current user to check if country changed
    const currentUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { country: true },
    });

    if (!currentUser) {
      return jsonResponse(404, { error: 'User not found' });
    }

    const countryChanged = country && country !== currentUser.country;
    const newCurrency = countryChanged ? getCurrencyForCountry(country) : null;

    // Update user profile with sanitized inputs
    const updatedUser = await prisma.user.update({
      where: { id: payload.userId },
      data: {
        ...(name && { name: sanitize(name) }),
        ...(phone !== undefined && { phone: sanitize(phone) || null }),
        ...(street !== undefined && { street: sanitize(street) || null }),
        ...(postalCode !== undefined && { postalCode: sanitize(postalCode) || null }),
        ...(city !== undefined && { city: sanitize(city) || null }),
        ...(country !== undefined && { country: sanitize(country) || null }),
        ...(isTraveler !== undefined && { isTraveler }),
        ...(isBuyer !== undefined && { isBuyer }),
        // Locale preferences
        ...(preferredLocale !== undefined && { preferredLocale: sanitize(preferredLocale) || null }),
        ...(preferredLanguage !== undefined && { preferredLanguage: sanitize(preferredLanguage) || null }),
        ...(preferredCountry !== undefined && { preferredCountry: sanitize(preferredCountry) || null }),
        ...(timezone !== undefined && { timezone: sanitize(timezone) || null }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isTraveler: true,
        isBuyer: true,
        phone: true,
        street: true,
        postalCode: true,
        city: true,
        country: true,
        preferredLocale: true,
        preferredLanguage: true,
        preferredCountry: true,
        timezone: true,
        createdAt: true,
      },
    });

    // If country changed, update wallet currency
    let walletUpdated = false;
    if (countryChanged && newCurrency) {
      const wallet = await prisma.wallet.findUnique({
        where: { userId: payload.userId },
      });

      if (wallet && wallet.currency !== newCurrency) {
        // Update wallet currency
        await prisma.wallet.update({
          where: { userId: payload.userId },
          data: { currency: newCurrency },
        });

        // Update all wallet accounts currency
        await prisma.walletAccount.updateMany({
          where: { walletId: wallet.id },
          data: { currency: newCurrency },
        });

        walletUpdated = true;
      }
    }

    return jsonResponse(200, {
      success: true,
      user: updatedUser,
      walletCurrencyUpdated: walletUpdated,
      newCurrency: walletUpdated ? newCurrency : null,
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return jsonResponse(500, {
      error: 'Internal server error',
      details: 'An unexpected error occurred while updating profile',
    });
  }
}
