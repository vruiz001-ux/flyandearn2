// Netlify Function: Get users with locations for map display
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Haversine formula for distance calculation
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

export async function handler(event) {
  // Allow GET and POST
  if (!['GET', 'POST'].includes(event.httpMethod)) {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const params = event.httpMethod === 'POST'
      ? JSON.parse(event.body || '{}')
      : event.queryStringParameters || {};

    const { userId, radiusKm = 50, showAll = false, role } = params;

    // Get all users with valid coordinates
    const users = await prisma.user.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
        isBanned: false,
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

    // If no current user specified, return all users
    if (!userId || showAll === 'true' || showAll === true) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          users: users.map(u => ({
            ...u,
            role: u.isTraveler ? 'TRAVELER' : 'BUYER',
          })),
          currentUser: null,
          nearbyUsers: [],
        }),
      };
    }

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
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

    if (!currentUser) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'User not found' }),
      };
    }

    // Add role to current user
    const currentUserWithRole = {
      ...currentUser,
      role: currentUser.isTraveler ? 'TRAVELER' : 'BUYER',
    };

    // If current user has no location, return all users
    if (!currentUser.latitude || !currentUser.longitude) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          users: users.map(u => ({
            ...u,
            role: u.isTraveler ? 'TRAVELER' : 'BUYER',
          })),
          currentUser: currentUserWithRole,
          nearbyUsers: [],
        }),
      };
    }

    // Calculate distances and filter nearby opposite-role users
    const radius = parseInt(radiusKm, 10) || 50;
    const oppositeRole = currentUser.isTraveler ? false : true; // isTraveler for opposite

    const usersWithDistance = users
      .filter(u => u.id !== currentUser.id)
      .map(u => ({
        ...u,
        role: u.isTraveler ? 'TRAVELER' : 'BUYER',
        distance: haversineDistance(
          currentUser.latitude,
          currentUser.longitude,
          u.latitude,
          u.longitude
        ),
      }));

    const nearbyUsers = usersWithDistance
      .filter(u => {
        // Filter by opposite role: if current is traveler, show buyers
        if (currentUser.isTraveler && !u.isBuyer) return false;
        if (!currentUser.isTraveler && !u.isTraveler) return false;
        return u.distance <= radius;
      })
      .sort((a, b) => a.distance - b.distance);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        users: usersWithDistance,
        currentUser: currentUserWithRole,
        nearbyUsers,
        radius,
      }),
    };
  } catch (error) {
    console.error('Map users error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  } finally {
    await prisma.$disconnect();
  }
}
