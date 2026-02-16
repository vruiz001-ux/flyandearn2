import prisma from './lib/prisma.js';
import { getSessionToken, verifyToken, jsonResponse } from './lib/auth.js';

export async function handler(event) {
  const { httpMethod } = event;

  // GET - List trips (public) or user's trips
  if (httpMethod === 'GET') {
    return handleGet(event);
  }

  // All other methods require authentication
  const token = getSessionToken(event);
  if (!token) {
    return jsonResponse(401, { error: 'Authentication required' });
  }

  const payload = await verifyToken(token);
  if (!payload || !payload.userId) {
    return jsonResponse(401, { error: 'Invalid session' });
  }

  switch (httpMethod) {
    case 'POST':
      return handleCreate(event, payload.userId);
    case 'PUT':
      return handleUpdate(event, payload.userId);
    case 'DELETE':
      return handleDelete(event, payload.userId);
    default:
      return jsonResponse(405, { error: 'Method not allowed' });
  }
}

// GET /trips - List all upcoming trips or filter by user
// Supports filtering by outsideDutyFree=1 to find travelers willing to shop outside duty-free
async function handleGet(event) {
  try {
    const params = event.queryStringParameters || {};
    const { userId, featured, toCity, outsideDutyFree, limit = '20' } = params;

    const where = {
      status: 'upcoming',
      departureDate: { gte: new Date() },
    };

    if (userId) {
      where.travellerId = userId;
    }

    if (toCity) {
      where.toCity = { contains: toCity, mode: 'insensitive' };
    }

    // Filter by outside duty-free opt-in
    // "Have a shopper at the end of the world for your purchases"
    if (outsideDutyFree === '1' || outsideDutyFree === 'true') {
      where.outsideDutyFreeOptIn = true;
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
          },
        },
      },
      orderBy: { departureDate: 'asc' },
      take: parseInt(limit, 10),
    });

    // Transform trips to include outside duty-free badge info
    const tripsWithBadges = trips.map(trip => ({
      ...trip,
      // Badge: "Outside duty-free shopper" if opted in
      outsideDutyFreeBadge: trip.outsideDutyFreeOptIn ? {
        label: 'Outside duty-free shopper',
        timeBudget: trip.outsideDutyFreeTimeBudget,
        maxStops: trip.outsideDutyFreeMaxStops,
        categories: trip.outsideDutyFreeCategories,
      } : null,
    }));

    return jsonResponse(200, { success: true, trips: tripsWithBadges });
  } catch (error) {
    console.error('Error fetching trips:', error);
    return jsonResponse(500, { error: 'Failed to fetch trips', details: error.message });
  }
}

// Valid categories for outside duty-free shopping
const VALID_OUTSIDE_CATEGORIES = ['fashion', 'electronics', 'cosmetics', 'pharmacy', 'groceries', 'baby', 'gifts', 'other'];

// Validate outside duty-free preferences
function validateOutsideDutyFreePrefs(optIn, timeBudget, maxStops, categories) {
  const errors = [];

  if (optIn) {
    // If opted in, time budget and max stops are required
    if (timeBudget === undefined || timeBudget === null) {
      errors.push('Time budget is required when opting in for outside duty-free shopping');
    } else if (timeBudget < 1 || timeBudget > 240) {
      errors.push('Time budget must be between 1 and 240 minutes');
    }

    if (maxStops === undefined || maxStops === null) {
      errors.push('Max stops is required when opting in for outside duty-free shopping');
    } else if (maxStops < 1 || maxStops > 5) {
      errors.push('Max stops must be between 1 and 5');
    }

    // Validate categories if provided
    if (categories && categories.length > 0) {
      const invalidCategories = categories.filter(c => !VALID_OUTSIDE_CATEGORIES.includes(c));
      if (invalidCategories.length > 0) {
        errors.push(`Invalid categories: ${invalidCategories.join(', ')}. Valid categories are: ${VALID_OUTSIDE_CATEGORIES.join(', ')}`);
      }
    }
  }

  return errors;
}

// POST /trips - Create a new trip
async function handleCreate(event, userId) {
  try {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return jsonResponse(400, { error: 'Invalid request body' });
    }
    const {
      fromAirport,
      fromCity,
      toAirport,
      toCity,
      departureDate,
      returnDate,
      availableKg,
      categories,
      note,
      // Outside duty-free preferences
      // "Have a shopper at the end of the world for your purchases"
      outsideDutyFreeOptIn,
      outsideDutyFreeTimeBudget,
      outsideDutyFreeMaxStops,
      outsideDutyFreeCategories,
      outsideDutyFreeConstraints,
    } = body;

    // Validate required fields
    if (!fromAirport || !fromCity || !toAirport || !toCity || !departureDate) {
      return jsonResponse(400, {
        error: 'Missing required fields',
        details: 'fromAirport, fromCity, toAirport, toCity, and departureDate are required',
      });
    }

    // Validate outside duty-free preferences if opting in
    if (outsideDutyFreeOptIn) {
      const prefErrors = validateOutsideDutyFreePrefs(
        outsideDutyFreeOptIn,
        outsideDutyFreeTimeBudget,
        outsideDutyFreeMaxStops,
        outsideDutyFreeCategories
      );
      if (prefErrors.length > 0) {
        return jsonResponse(400, {
          error: 'Invalid outside duty-free preferences',
          details: prefErrors,
        });
      }
    }

    // Validate user is a traveller
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || (!user.isTraveler && user.role !== 'TRAVELLER')) {
      return jsonResponse(403, {
        error: 'Only travelers can create trips',
      });
    }

    const trip = await prisma.trip.create({
      data: {
        travellerId: userId,
        fromAirport: fromAirport.toUpperCase(),
        fromCity,
        toAirport: toAirport.toUpperCase(),
        toCity,
        departureDate: new Date(departureDate),
        returnDate: returnDate ? new Date(returnDate) : null,
        availableKg: availableKg ? parseFloat(availableKg) : null,
        categories: categories || [],
        note: note || null,
        status: 'upcoming',
        // Outside duty-free preferences
        outsideDutyFreeOptIn: outsideDutyFreeOptIn || false,
        outsideDutyFreeTimeBudget: outsideDutyFreeOptIn ? parseInt(outsideDutyFreeTimeBudget, 10) : null,
        outsideDutyFreeMaxStops: outsideDutyFreeOptIn ? parseInt(outsideDutyFreeMaxStops, 10) : null,
        outsideDutyFreeCategories: outsideDutyFreeOptIn ? (outsideDutyFreeCategories || []) : [],
        outsideDutyFreeConstraints: outsideDutyFreeOptIn ? (outsideDutyFreeConstraints || null) : null,
      },
      include: {
        traveller: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return jsonResponse(201, { success: true, trip });
  } catch (error) {
    console.error('Error creating trip:', error);
    return jsonResponse(500, { error: 'Failed to create trip' });
  }
}

// PUT /trips - Update a trip
async function handleUpdate(event, userId) {
  try {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return jsonResponse(400, { error: 'Invalid request body' });
    }
    const { id, ...updates } = body;

    if (!id) {
      return jsonResponse(400, { error: 'Trip ID is required' });
    }

    // Verify ownership
    const existingTrip = await prisma.trip.findUnique({ where: { id } });
    if (!existingTrip) {
      return jsonResponse(404, { error: 'Trip not found' });
    }
    if (existingTrip.travellerId !== userId) {
      return jsonResponse(403, { error: 'Not authorized to update this trip' });
    }

    // Validate outside duty-free preferences if opting in
    const optIn = updates.outsideDutyFreeOptIn !== undefined ? updates.outsideDutyFreeOptIn : existingTrip.outsideDutyFreeOptIn;
    if (optIn) {
      const timeBudget = updates.outsideDutyFreeTimeBudget !== undefined ? updates.outsideDutyFreeTimeBudget : existingTrip.outsideDutyFreeTimeBudget;
      const maxStops = updates.outsideDutyFreeMaxStops !== undefined ? updates.outsideDutyFreeMaxStops : existingTrip.outsideDutyFreeMaxStops;
      const categories = updates.outsideDutyFreeCategories !== undefined ? updates.outsideDutyFreeCategories : existingTrip.outsideDutyFreeCategories;

      const prefErrors = validateOutsideDutyFreePrefs(optIn, timeBudget, maxStops, categories);
      if (prefErrors.length > 0) {
        return jsonResponse(400, {
          error: 'Invalid outside duty-free preferences',
          details: prefErrors,
        });
      }
    }

    // Prepare update data
    const updateData = {};
    if (updates.fromAirport) updateData.fromAirport = updates.fromAirport.toUpperCase();
    if (updates.fromCity) updateData.fromCity = updates.fromCity;
    if (updates.toAirport) updateData.toAirport = updates.toAirport.toUpperCase();
    if (updates.toCity) updateData.toCity = updates.toCity;
    if (updates.departureDate) updateData.departureDate = new Date(updates.departureDate);
    if (updates.returnDate !== undefined) {
      updateData.returnDate = updates.returnDate ? new Date(updates.returnDate) : null;
    }
    if (updates.availableKg !== undefined) {
      updateData.availableKg = updates.availableKg ? parseFloat(updates.availableKg) : null;
    }
    if (updates.categories) updateData.categories = updates.categories;
    if (updates.note !== undefined) updateData.note = updates.note || null;
    if (updates.status) updateData.status = updates.status;

    // Outside duty-free preferences
    if (updates.outsideDutyFreeOptIn !== undefined) {
      updateData.outsideDutyFreeOptIn = updates.outsideDutyFreeOptIn;
      // If opting out, clear the preferences
      if (!updates.outsideDutyFreeOptIn) {
        updateData.outsideDutyFreeTimeBudget = null;
        updateData.outsideDutyFreeMaxStops = null;
        updateData.outsideDutyFreeCategories = [];
        updateData.outsideDutyFreeConstraints = null;
      }
    }
    if (updates.outsideDutyFreeOptIn && updates.outsideDutyFreeTimeBudget !== undefined) {
      updateData.outsideDutyFreeTimeBudget = parseInt(updates.outsideDutyFreeTimeBudget, 10);
    }
    if (updates.outsideDutyFreeOptIn && updates.outsideDutyFreeMaxStops !== undefined) {
      updateData.outsideDutyFreeMaxStops = parseInt(updates.outsideDutyFreeMaxStops, 10);
    }
    if (updates.outsideDutyFreeOptIn && updates.outsideDutyFreeCategories !== undefined) {
      updateData.outsideDutyFreeCategories = updates.outsideDutyFreeCategories;
    }
    if (updates.outsideDutyFreeOptIn && updates.outsideDutyFreeConstraints !== undefined) {
      updateData.outsideDutyFreeConstraints = updates.outsideDutyFreeConstraints || null;
    }

    const trip = await prisma.trip.update({
      where: { id },
      data: updateData,
      include: {
        traveller: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return jsonResponse(200, { success: true, trip });
  } catch (error) {
    console.error('Error updating trip:', error);
    return jsonResponse(500, { error: 'Failed to update trip' });
  }
}

// DELETE /trips - Delete a trip
async function handleDelete(event, userId) {
  try {
    const params = event.queryStringParameters || {};
    const { id } = params;

    if (!id) {
      return jsonResponse(400, { error: 'Trip ID is required' });
    }

    // Verify ownership
    const existingTrip = await prisma.trip.findUnique({ where: { id } });
    if (!existingTrip) {
      return jsonResponse(404, { error: 'Trip not found' });
    }
    if (existingTrip.travellerId !== userId) {
      return jsonResponse(403, { error: 'Not authorized to delete this trip' });
    }

    await prisma.trip.delete({ where: { id } });

    return jsonResponse(200, { success: true, message: 'Trip deleted' });
  } catch (error) {
    console.error('Error deleting trip:', error);
    return jsonResponse(500, { error: 'Failed to delete trip' });
  }
}
