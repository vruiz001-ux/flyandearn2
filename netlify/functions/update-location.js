// Netlify Function: Update user location (geocode address or set from browser)
import prisma from './lib/prisma.js';
import { getSessionToken, verifyToken, jsonResponse } from './lib/auth.js';

// Geocode address using Nominatim
async function geocodeAddress(address) {
  const encodedAddress = encodeURIComponent(address);
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'FlyAndEarn/1.0 (https://flyandearn.eu)',
    },
  });

  if (!response.ok) {
    throw new Error('Geocoding service unavailable');
  }

  const results = await response.json();

  if (!results || results.length === 0) {
    return null;
  }

  return {
    latitude: parseFloat(results[0].lat),
    longitude: parseFloat(results[0].lon),
  };
}

export async function handler(event) {
  // Only allow POST/PUT
  if (!['POST', 'PUT'].includes(event.httpMethod)) {
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

    const body = JSON.parse(event.body || '{}');
    const { latitude, longitude, fromBrowser, geocodeAddress: shouldGeocode } = body;

    let coords = null;

    // Option 1: Direct coordinates from browser geolocation
    if (fromBrowser && latitude && longitude) {
      coords = {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
      };
    }
    // Option 2: Geocode from address
    else if (shouldGeocode) {
      // Get user's address
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { street: true, city: true, postalCode: true, country: true },
      });

      if (!user) {
        return jsonResponse(404, { error: 'User not found' });
      }

      const addressParts = [user.street, user.postalCode, user.city, user.country].filter(Boolean);

      if (addressParts.length === 0) {
        return jsonResponse(400, {
          error: 'No address to geocode',
          details: 'Please add your address in profile settings first',
        });
      }

      const address = addressParts.join(', ');
      coords = await geocodeAddress(address);

      if (!coords) {
        return jsonResponse(404, {
          error: 'Could not geocode address',
          details: 'Please check your address is correct',
          address,
        });
      }
    }
    // Option 3: Manual coordinates
    else if (latitude && longitude) {
      coords = {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
      };
    }

    if (!coords) {
      return jsonResponse(400, {
        error: 'No location data provided',
        details: 'Provide latitude/longitude or set geocodeAddress: true',
      });
    }

    // Update user location
    const updatedUser = await prisma.user.update({
      where: { id: payload.userId },
      data: {
        latitude: coords.latitude,
        longitude: coords.longitude,
      },
      select: {
        id: true,
        name: true,
        city: true,
        country: true,
        latitude: true,
        longitude: true,
        isTraveler: true,
        isBuyer: true,
      },
    });

    return jsonResponse(200, {
      success: true,
      user: updatedUser,
      source: fromBrowser ? 'browser' : (shouldGeocode ? 'geocoded' : 'manual'),
    });
  } catch (error) {
    console.error('Update location error:', error);
    return jsonResponse(500, {
      error: 'Internal server error',
      details: error.message,
    });
  }
}
