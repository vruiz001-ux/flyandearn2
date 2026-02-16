import prisma from './lib/prisma.js';
import { jsonResponse } from './lib/auth.js';

export const config = { path: ['/api/browse', '/.netlify/functions/browse'] };

export async function handler(event) {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const [trips, requests, categoryCounts] = await Promise.all([
      // Recent trips (last 10, upcoming only)
      prisma.trip.findMany({
        where: {
          status: 'upcoming',
          departureDate: { gte: new Date() },
        },
        select: {
          id: true,
          fromAirport: true,
          fromCity: true,
          toAirport: true,
          toCity: true,
          departureDate: true,
          returnDate: true,
          availableKg: true,
          categories: true,
          outsideDutyFreeOptIn: true,
          createdAt: true,
          traveller: {
            select: {
              id: true,
              name: true,
              city: true,
              country: true,
            },
          },
        },
        orderBy: { departureDate: 'asc' },
        take: 10,
      }),

      // Recent requests (last 10, open only)
      prisma.request.findMany({
        where: { status: 'OPEN' },
        select: {
          id: true,
          requestType: true,
          fromAirport: true,
          fromCity: true,
          toAirport: true,
          toCity: true,
          currency: true,
          totalBudget: true,
          totalItems: true,
          neededBy: true,
          createdAt: true,
          buyer: {
            select: {
              id: true,
              name: true,
              city: true,
            },
          },
          items: {
            select: {
              itemName: true,
              quantity: true,
              budgetPrice: true,
              category: true,
              itemSource: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),

      // Category counts from request items
      prisma.requestItem.groupBy({
        by: ['category'],
        _count: { id: true },
        where: {
          request: { status: 'OPEN' },
          category: { not: null },
        },
      }),
    ]);

    const categories = {};
    for (const c of categoryCounts) {
      if (c.category) {
        categories[c.category] = c._count.id;
      }
    }

    return jsonResponse(200, {
      success: true,
      trips,
      requests,
      categories,
    });
  } catch (error) {
    console.error('Error fetching browse data:', error);
    return jsonResponse(500, { error: 'Failed to fetch browse data' });
  }
}
