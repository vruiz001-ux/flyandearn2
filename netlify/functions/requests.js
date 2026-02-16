import prisma from './lib/prisma.js';
import { getSessionToken, verifyToken, jsonResponse } from './lib/auth.js';
import {
  ORDER_TYPES,
  TRAVELLER_SERVICE_FEE_PERCENT,
  OTHER_SERVICE_FEE_PERCENT,
} from './lib/subscription.js';
import { transferDepositToTraveller } from './deposit.js';

// Request types
const REQUEST_TYPES = {
  DUTY_FREE: 'DUTY_FREE',
  OUTSIDE_DUTY_FREE: 'OUTSIDE_DUTY_FREE',
  BOTH: 'BOTH',
};

// Item sources
const ITEM_SOURCES = {
  DUTY_FREE: 'DUTY_FREE',
  OUTSIDE_DUTY_FREE: 'OUTSIDE_DUTY_FREE',
};

export async function handler(event) {
  const { httpMethod } = event;

  switch (httpMethod) {
    case 'GET':
      return handleGet(event);
    case 'POST':
      return handlePost(event);
    case 'PUT':
      return handlePut(event);
    case 'DELETE':
      return handleDelete(event);
    default:
      return jsonResponse(405, { error: 'Method not allowed' });
  }
}

// Valid store types for outside duty-free requests
const VALID_STORE_TYPES = ['any', 'brand_store', 'mall', 'supermarket', 'pharmacy', 'electronics', 'other'];
const VALID_ITEM_FLEXIBILITY = ['exact_item', 'acceptable_alternatives'];

// GET /requests - List requests (public or filtered)
// "Have a shopper at the end of the world for your purchases"
async function handleGet(event) {
  try {
    const params = event.queryStringParameters || {};
    const { status, toCity, buyerId, requestType, allowOutsideDutyFree, limit = '20' } = params;

    const where = {};

    if (status) {
      where.status = status.toUpperCase();
    }

    if (toCity) {
      where.toCity = { contains: toCity, mode: 'insensitive' };
    }

    if (buyerId) {
      where.buyerId = buyerId;
    }

    if (requestType) {
      where.requestType = requestType.toUpperCase();
    }

    // Filter by allow outside duty-free
    if (allowOutsideDutyFree === '1' || allowOutsideDutyFree === 'true') {
      where.allowOutsideDutyFree = true;
    } else if (allowOutsideDutyFree === '0' || allowOutsideDutyFree === 'false') {
      where.allowOutsideDutyFree = false;
    }

    const requests = await prisma.request.findMany({
      where,
      include: {
        buyer: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
        items: {
          orderBy: { createdAt: 'asc' },
        },
        offers: {
          select: {
            id: true,
            travelerId: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit, 10),
    });

    // Transform for frontend compatibility
    const transformedRequests = requests.map(req => ({
      ...req,
      // Legacy compatibility: if no items, use legacy fields
      items: req.items.length > 0 ? req.items : (req.product ? [{
        id: 'legacy',
        itemName: req.product,
        quantity: 1,
        budgetPrice: req.dutyFreePrice,
        category: req.category,
        notes: req.description,
        itemSource: req.orderType === 'OTHER' ? 'OUTSIDE_DUTY_FREE' : 'DUTY_FREE',
      }] : []),
      offers: req.offers.map(o => o.travelerId), // Array of traveler IDs for compatibility
      offerCount: req.offers.length,
      // Outside duty-free info for display
      outsideDutyFreeInfo: req.allowOutsideDutyFree ? {
        allowed: true,
        storeTypePreference: req.storeTypePreference,
        itemFlexibility: req.itemFlexibility,
      } : { allowed: false },
    }));

    return jsonResponse(200, { success: true, requests: transformedRequests });
  } catch (error) {
    console.error('Error fetching requests:', error);
    return jsonResponse(500, { error: 'Failed to fetch requests' });
  }
}

// POST /requests - Create a new request
async function handlePost(event) {
  try {
    // Verify authentication
    const token = getSessionToken(event);
    if (!token) {
      return jsonResponse(401, { error: 'Authentication required' });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.userId) {
      return jsonResponse(401, { error: 'Invalid session' });
    }

    const userId = payload.userId;

    // Verify user can create requests (buyer role)
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || (!user.isBuyer && user.role !== 'BUYER')) {
      return jsonResponse(403, { error: 'Only buyers can create requests' });
    }

    if (!event.body) {
      return jsonResponse(400, { error: 'Request body is empty' });
    }

    let body;
    try {
      body = JSON.parse(event.body);
    } catch {
      return jsonResponse(400, { error: 'Invalid request body' });
    }

    // Check if this is a new format request (with items array) or legacy format
    if (body.items && Array.isArray(body.items) && body.items.length > 0) {
      return createNewFormatRequest(userId, body);
    } else {
      return createLegacyRequest(userId, body);
    }
  } catch (error) {
    console.error('Error creating request:', error);
    return jsonResponse(500, { error: 'Failed to create request' });
  }
}

// Create request with new multi-item format
// "Have a shopper at the end of the world for your purchases"
async function createNewFormatRequest(userId, body) {
  const {
    requestType,
    items,
    fromAirport,
    fromCity,
    toAirport,
    toCity,
    neededBy,
    currency = 'EUR',
    generalNotes,
    maxPrice,
    // Outside duty-free preferences
    // Allows requestors to specify if they want shopping outside duty-free
    allowOutsideDutyFree,
    storeTypePreference,
    itemFlexibility,
  } = body;

  // Validate request type
  if (!requestType || !Object.values(REQUEST_TYPES).includes(requestType)) {
    return jsonResponse(400, {
      error: 'Invalid request type',
      details: 'requestType must be DUTY_FREE, OUTSIDE_DUTY_FREE, or BOTH',
    });
  }

  // Validate required fields
  if (!fromAirport || !fromCity || !toAirport || !toCity) {
    return jsonResponse(400, {
      error: 'Missing required fields',
      details: 'fromAirport, fromCity, toAirport, toCity are required',
    });
  }

  // Validate items
  if (!items || !Array.isArray(items) || items.length === 0) {
    return jsonResponse(400, {
      error: 'At least one item is required',
    });
  }

  // Validate each item
  const validationErrors = [];
  const sanitize = (str) => str ? str.replace(/<[^>]*>/g, '').trim() : null;

  const processedItems = items.map((item, index) => {
    // Item name is required
    if (!item.itemName || !item.itemName.trim()) {
      validationErrors.push(`Item ${index + 1}: itemName is required`);
    }

    // Quantity must be >= 1
    const parsedQuantity = parseInt(item.quantity);
    const quantity = isNaN(parsedQuantity) ? 1 : parsedQuantity;
    if (quantity < 1) {
      validationErrors.push(`Item ${index + 1}: quantity must be at least 1`);
    }

    // Budget must be non-negative if provided
    const budgetPrice = item.budgetPrice ? parseFloat(item.budgetPrice) : null;
    if (budgetPrice !== null && (isNaN(budgetPrice) || budgetPrice < 0)) {
      validationErrors.push(`Item ${index + 1}: budgetPrice must be a non-negative number`);
    }

    // Determine item source based on request type or explicit value
    let itemSource = item.itemSource;
    if (!itemSource) {
      if (requestType === REQUEST_TYPES.DUTY_FREE) {
        itemSource = ITEM_SOURCES.DUTY_FREE;
      } else if (requestType === REQUEST_TYPES.OUTSIDE_DUTY_FREE) {
        itemSource = ITEM_SOURCES.OUTSIDE_DUTY_FREE;
      } else {
        // BOTH - default to DUTY_FREE unless specified
        itemSource = ITEM_SOURCES.DUTY_FREE;
      }
    }

    // For OUTSIDE_DUTY_FREE items, warn if no store info provided
    if (itemSource === ITEM_SOURCES.OUTSIDE_DUTY_FREE) {
      if (!item.storeUrl && !item.storeName && !item.preferredBrand) {
        // Warning only - don't block
        console.log(`Warning: Item ${index + 1} is OUTSIDE_DUTY_FREE but has no store/brand info`);
      }
    }

    return {
      itemName: sanitize(item.itemName),
      quantity,
      budgetPrice,
      currency: item.currency || currency,
      category: sanitize(item.category) || null,
      itemSource,
      notes: sanitize(item.notes) || null,
      preferredBrand: sanitize(item.preferredBrand) || null,
      storeUrl: sanitize(item.storeUrl) || null,
      storeName: sanitize(item.storeName) || null,
      buyRegion: sanitize(item.buyRegion) || null,
      acceptAlternatives: item.acceptAlternatives === true,
      alternativeNotes: sanitize(item.alternativeNotes) || null,
      dutyFreeStore: sanitize(item.dutyFreeStore) || null,
      terminal: sanitize(item.terminal) || null,
    };
  });

  if (validationErrors.length > 0) {
    return jsonResponse(400, {
      error: 'Validation failed',
      details: validationErrors,
    });
  }

  // Calculate totals
  const totalBudget = processedItems.reduce((sum, item) => {
    return sum + (item.budgetPrice || 0) * item.quantity;
  }, 0);

  const totalItems = processedItems.reduce((sum, item) => sum + item.quantity, 0);

  // Validate maxPrice if provided
  const parsedMaxPrice = maxPrice ? parseFloat(maxPrice) : null;
  if (parsedMaxPrice !== null && (isNaN(parsedMaxPrice) || parsedMaxPrice < 0)) {
    return jsonResponse(400, {
      error: 'Invalid max price',
      details: 'maxPrice must be a non-negative number',
    });
  }

  // Validate outside duty-free preferences
  // Default: allow outside duty-free if request type includes it
  // UX Decision: Default OFF for better user control - users must explicitly opt-in
  const shouldAllowOutsideDutyFree = allowOutsideDutyFree === true ||
    (allowOutsideDutyFree === undefined && (requestType === REQUEST_TYPES.OUTSIDE_DUTY_FREE || requestType === REQUEST_TYPES.BOTH));

  // Validate store type preference if provided
  let validStoreType = null;
  if (shouldAllowOutsideDutyFree && storeTypePreference) {
    if (!VALID_STORE_TYPES.includes(storeTypePreference)) {
      return jsonResponse(400, {
        error: 'Invalid store type preference',
        details: `storeTypePreference must be one of: ${VALID_STORE_TYPES.join(', ')}`,
      });
    }
    validStoreType = storeTypePreference;
  }

  // Validate item flexibility if provided
  let validItemFlexibility = null;
  if (shouldAllowOutsideDutyFree && itemFlexibility) {
    if (!VALID_ITEM_FLEXIBILITY.includes(itemFlexibility)) {
      return jsonResponse(400, {
        error: 'Invalid item flexibility',
        details: `itemFlexibility must be one of: ${VALID_ITEM_FLEXIBILITY.join(', ')}`,
      });
    }
    validItemFlexibility = itemFlexibility;
  }

  // Create request with items
  const request = await prisma.request.create({
    data: {
      buyerId: userId,
      requestType,
      currency,
      fromAirport: fromAirport.toUpperCase(),
      fromCity: sanitize(fromCity),
      toAirport: toAirport.toUpperCase(),
      toCity: sanitize(toCity),
      neededBy: neededBy ? new Date(neededBy) : null,
      generalNotes: sanitize(generalNotes) || null,
      totalBudget: totalBudget > 0 ? totalBudget : null,
      totalItems,
      maxPrice: parsedMaxPrice,
      status: 'OPEN',
      // Outside duty-free preferences
      // "Have a shopper at the end of the world for your purchases"
      allowOutsideDutyFree: shouldAllowOutsideDutyFree,
      storeTypePreference: shouldAllowOutsideDutyFree ? validStoreType : null,
      itemFlexibility: shouldAllowOutsideDutyFree ? validItemFlexibility : null,
      items: {
        create: processedItems,
      },
    },
    include: {
      buyer: {
        select: { id: true, name: true },
      },
      items: true,
    },
  });

  return jsonResponse(201, { success: true, request });
}

// Create request with legacy single-item format (backward compatibility)
async function createLegacyRequest(userId, body) {
  const {
    product,
    category,
    description,
    dutyFreePrice,
    currency,
    serviceFee,
    fromAirport,
    fromCity,
    toAirport,
    toCity,
    neededBy,
    orderType,
  } = body;

  // Validate required fields
  if (!product || !category || !dutyFreePrice || !serviceFee ||
      !fromAirport || !fromCity || !toAirport || !toCity) {
    return jsonResponse(400, {
      error: 'Missing required fields',
      details: 'product, category, dutyFreePrice, serviceFee, fromAirport, fromCity, toAirport, toCity are required',
    });
  }

  // Validate amounts
  const price = parseFloat(dutyFreePrice);
  const fee = parseFloat(serviceFee);
  if (isNaN(price) || price <= 0 || isNaN(fee) || fee < 0) {
    return jsonResponse(400, { error: 'Invalid price or fee amount' });
  }

  // Validate orderType
  const validOrderType = orderType && Object.values(ORDER_TYPES).includes(orderType)
    ? orderType
    : ORDER_TYPES.DUTY_FREE;

  // Validate service fee based on order type
  const maxFeePercent = validOrderType === ORDER_TYPES.OTHER
    ? OTHER_SERVICE_FEE_PERCENT
    : TRAVELLER_SERVICE_FEE_PERCENT;
  const maxFee = price * maxFeePercent;
  const maxFeePercentDisplay = Math.round(maxFeePercent * 100);

  if (fee > maxFee) {
    return jsonResponse(400, {
      error: `Service fee cannot exceed ${maxFeePercentDisplay}% of product price (max ${maxFee.toFixed(2)})`,
    });
  }

  const sanitize = (str) => str ? str.replace(/<[^>]*>/g, '').trim() : null;

  // Map orderType to requestType
  const requestType = validOrderType === ORDER_TYPES.OTHER
    ? REQUEST_TYPES.OUTSIDE_DUTY_FREE
    : REQUEST_TYPES.DUTY_FREE;

  // Create request with legacy fields AND new item
  const request = await prisma.request.create({
    data: {
      buyerId: userId,
      requestType,
      // Legacy fields
      product: sanitize(product),
      category: sanitize(category),
      description: sanitize(description) || null,
      dutyFreePrice: price,
      serviceFee: fee,
      orderType: validOrderType,
      // Common fields
      currency: currency || 'EUR',
      fromAirport: fromAirport.toUpperCase(),
      fromCity: sanitize(fromCity),
      toAirport: toAirport.toUpperCase(),
      toCity: sanitize(toCity),
      neededBy: neededBy ? new Date(neededBy) : null,
      totalBudget: price,
      totalItems: 1,
      status: 'OPEN',
      // Create corresponding item for new format compatibility
      items: {
        create: {
          itemName: sanitize(product),
          quantity: 1,
          budgetPrice: price,
          currency: currency || 'EUR',
          category: sanitize(category),
          itemSource: validOrderType === ORDER_TYPES.OTHER ? ITEM_SOURCES.OUTSIDE_DUTY_FREE : ITEM_SOURCES.DUTY_FREE,
          notes: sanitize(description) || null,
        },
      },
    },
    include: {
      buyer: {
        select: { id: true, name: true },
      },
      items: true,
    },
  });

  return jsonResponse(201, { success: true, request });
}

// PUT /requests - Update a request or make an offer
async function handlePut(event) {
  try {
    const token = getSessionToken(event);
    if (!token) {
      return jsonResponse(401, { error: 'Authentication required' });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.userId) {
      return jsonResponse(401, { error: 'Invalid session' });
    }

    const userId = payload.userId;
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return jsonResponse(400, { error: 'Invalid request body' });
    }
    const { id, action, ...updates } = body;

    if (!id) {
      return jsonResponse(400, { error: 'Request ID is required' });
    }

    const request = await prisma.request.findUnique({
      where: { id },
      include: { offers: true, items: true },
    });

    if (!request) {
      return jsonResponse(404, { error: 'Request not found' });
    }

    // Action: make offer (for travelers)
    if (action === 'offer') {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || (!user.isTraveler && user.role !== 'TRAVELLER')) {
        return jsonResponse(403, { error: 'Only travelers can make offers' });
      }

      // Check if already offered
      const existingOffer = await prisma.offer.findUnique({
        where: {
          requestId_travelerId: { requestId: id, travelerId: userId },
        },
      });

      if (existingOffer) {
        return jsonResponse(400, { error: 'You have already made an offer on this request' });
      }

      const offer = await prisma.offer.create({
        data: {
          requestId: id,
          travelerId: userId,
          message: updates.message || null,
        },
      });

      return jsonResponse(201, { success: true, offer });
    }

    // Action: accept offer (for buyers)
    if (action === 'accept') {
      if (request.buyerId !== userId) {
        return jsonResponse(403, { error: 'Only the request owner can accept offers' });
      }

      const { offerId } = updates;
      if (!offerId) {
        return jsonResponse(400, { error: 'offerId is required to accept' });
      }

      // Get the offer to find the traveller
      const offer = await prisma.offer.findUnique({
        where: { id: offerId },
        include: {
          traveler: {
            select: {
              id: true,
              stripeConnectAccountId: true,
              connectPayoutsEnabled: true,
            },
          },
        },
      });

      if (!offer) {
        return jsonResponse(404, { error: 'Offer not found' });
      }

      // Check deposit status - must be CAPTURED to proceed
      if (request.depositStatus !== 'CAPTURED') {
        return jsonResponse(400, {
          error: 'Deposit payment required before accepting offer',
          depositStatus: request.depositStatus,
          requiresDeposit: true,
        });
      }

      // Check traveller has Connect account set up
      if (!offer.traveler.stripeConnectAccountId) {
        return jsonResponse(400, {
          error: 'Traveller has not set up their payout account yet',
          travellerConnectRequired: true,
        });
      }

      if (!offer.traveler.connectPayoutsEnabled) {
        return jsonResponse(400, {
          error: 'Traveller\'s payout account is not fully verified',
          travellerConnectPending: true,
        });
      }

      // Transfer deposit to Traveller
      const transferResult = await transferDepositToTraveller(id, offer.travelerId);

      if (!transferResult.success) {
        console.error('Deposit transfer failed:', transferResult.error);
        return jsonResponse(500, {
          error: 'Failed to transfer deposit to traveller',
          details: transferResult.error,
        });
      }

      // Update offer status
      await prisma.offer.update({
        where: { id: offerId },
        data: { status: 'accepted' },
      });

      // Reject other offers
      await prisma.offer.updateMany({
        where: {
          requestId: id,
          id: { not: offerId },
          status: 'pending',
        },
        data: { status: 'rejected' },
      });

      // Update request status
      const updated = await prisma.request.update({
        where: { id },
        data: { status: 'MATCHED' },
        include: { items: true },
      });

      return jsonResponse(200, {
        success: true,
        request: updated,
        depositTransfer: {
          transferId: transferResult.transferId,
          amount: transferResult.amount,
          currency: transferResult.currency,
        },
      });
    }

    // Default: update request (owner only)
    if (request.buyerId !== userId) {
      return jsonResponse(403, { error: 'Not authorized to update this request' });
    }

    const updateData = {};
    if (updates.product) updateData.product = updates.product;
    if (updates.description !== undefined) updateData.description = updates.description || null;
    if (updates.status) updateData.status = updates.status.toUpperCase();
    if (updates.neededBy !== undefined) {
      updateData.neededBy = updates.neededBy ? new Date(updates.neededBy) : null;
    }
    if (updates.generalNotes !== undefined) {
      updateData.generalNotes = updates.generalNotes || null;
    }

    const updated = await prisma.request.update({
      where: { id },
      data: updateData,
      include: { items: true },
    });

    return jsonResponse(200, { success: true, request: updated });
  } catch (error) {
    console.error('Error updating request:', error);
    return jsonResponse(500, { error: 'Failed to update request' });
  }
}

// DELETE /requests - Delete a request
async function handleDelete(event) {
  try {
    const token = getSessionToken(event);
    if (!token) {
      return jsonResponse(401, { error: 'Authentication required' });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.userId) {
      return jsonResponse(401, { error: 'Invalid session' });
    }

    const params = event.queryStringParameters || {};
    const { id } = params;

    if (!id) {
      return jsonResponse(400, { error: 'Request ID is required' });
    }

    const request = await prisma.request.findUnique({ where: { id } });
    if (!request) {
      return jsonResponse(404, { error: 'Request not found' });
    }

    if (request.buyerId !== payload.userId) {
      return jsonResponse(403, { error: 'Not authorized to delete this request' });
    }

    await prisma.request.delete({ where: { id } });

    return jsonResponse(200, { success: true, message: 'Request deleted' });
  } catch (error) {
    console.error('Error deleting request:', error);
    return jsonResponse(500, { error: 'Failed to delete request' });
  }
}
