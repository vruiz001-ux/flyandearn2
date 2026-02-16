/**
 * Traveller Search API
 * GET /api/travellers/search - Search for travelers with trips matching criteria
 *
 * "Have a shopper at the end of the world for your purchases."
 *
 * Query parameters:
 * - destination: City or country to search (required)
 * - outsideDutyFree: Filter by outside duty-free opt-in (1 or true)
 * - category: Filter by category willing to shop
 * - departureAfter: Filter trips departing after this date
 * - departureBefore: Filter trips departing before this date
 * - limit: Max results (default 20)
 */

import prisma from './lib/prisma.js';
import { jsonResponse } from './lib/auth.js';

export async function handler(event) {
  const { httpMethod } = event;

  if (httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const params = event.queryStringParameters || {};
    const {
      destination,
      outsideDutyFree,
      category,
      departureAfter,
      departureBefore,
      limit = '20',
    } = params;

    // Build query
    const where = {
      status: 'upcoming',
      departureDate: { gte: new Date() },
    };

    // Filter by destination (city or country)
    if (destination) {
      where.OR = [
        { toCity: { contains: destination, mode: 'insensitive' } },
        { traveller: { country: { contains: destination, mode: 'insensitive' } } },
      ];
    }

    // Filter by outside duty-free opt-in
    if (outsideDutyFree === '1' || outsideDutyFree === 'true') {
      where.outsideDutyFreeOptIn = true;
    }

    // Filter by category if provided and looking for outside duty-free shoppers
    if (category && (outsideDutyFree === '1' || outsideDutyFree === 'true')) {
      where.outsideDutyFreeCategories = { has: category };
    }

    // Date filters
    if (departureAfter) {
      where.departureDate = { ...where.departureDate, gte: new Date(departureAfter) };
    }
    if (departureBefore) {
      where.departureDate = { ...where.departureDate, lte: new Date(departureBefore) };
    }

    const trips = await prisma.trip.findMany({
      where,
      include: {
        traveller: {
          select: {
            id: true,
            name: true,
            role: true,
            city: true,
            country: true,
            latitude: true,
            longitude: true,
            createdAt: true,
            // Include ratings summary
            ratingsReceived: {
              select: {
                overallScore: true,
              },
            },
          },
        },
      },
      orderBy: { departureDate: 'asc' },
      take: parseInt(limit, 10),
    });

    // Transform results with badges and rating summaries
    const results = trips.map(trip => {
      // Calculate average rating
      const ratings = trip.traveller.ratingsReceived;
      const avgRating = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r.overallScore, 0) / ratings.length
        : null;

      return {
        tripId: trip.id,
        destination: {
          city: trip.toCity,
          airport: trip.toAirport,
        },
        origin: {
          city: trip.fromCity,
          airport: trip.fromAirport,
        },
        departureDate: trip.departureDate,
        returnDate: trip.returnDate,
        availableKg: trip.availableKg,
        categories: trip.categories,
        traveller: {
          id: trip.traveller.id,
          name: trip.traveller.name,
          city: trip.traveller.city,
          country: trip.traveller.country,
          avgRating,
          totalRatings: ratings.length,
        },
        // Outside duty-free badge
        // "Have a shopper at the end of the world for your purchases"
        outsideDutyFree: trip.outsideDutyFreeOptIn ? {
          badge: 'Outside duty-free shopper',
          timeBudget: trip.outsideDutyFreeTimeBudget,
          maxStops: trip.outsideDutyFreeMaxStops,
          categories: trip.outsideDutyFreeCategories,
          constraints: trip.outsideDutyFreeConstraints,
        } : null,
      };
    });

    return jsonResponse(200, {
      success: true,
      query: {
        destination,
        outsideDutyFree: outsideDutyFree === '1' || outsideDutyFree === 'true',
        category,
      },
      count: results.length,
      travellers: results,
      // Marketing tagline
      tagline: 'Have a shopper at the end of the world for your purchases.',
    });
  } catch (error) {
    console.error('Error searching travellers:', error);
    return jsonResponse(500, { error: 'Failed to search travellers', details: error.message });
  }
}
