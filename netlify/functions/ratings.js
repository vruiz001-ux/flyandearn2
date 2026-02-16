import prisma from './lib/prisma.js';
import { getSessionToken, verifyToken, jsonResponse } from './lib/auth.js';

export async function handler(event) {
  const { httpMethod } = event;

  switch (httpMethod) {
    case 'GET':
      return handleGet(event);
    case 'POST':
      return handlePost(event);
    default:
      return jsonResponse(405, { error: 'Method not allowed' });
  }
}

// GET /ratings - Get ratings for a user
async function handleGet(event) {
  try {
    const params = event.queryStringParameters || {};
    const { userId } = params;

    if (!userId) {
      return jsonResponse(400, { error: 'userId is required' });
    }

    // Get all ratings received by user
    const ratings = await prisma.rating.findMany({
      where: { toUserId: userId },
      include: {
        fromUser: {
          select: { id: true, name: true },
        },
        conversation: {
          select: {
            id: true,
            trip: {
              select: { fromCity: true, toCity: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate averages
    const totalRatings = ratings.length;
    if (totalRatings === 0) {
      return jsonResponse(200, {
        success: true,
        ratings: [],
        averages: null,
        totalRatings: 0,
      });
    }

    const averages = {
      response: ratings.reduce((sum, r) => sum + r.responseScore, 0) / totalRatings,
      punctuality: ratings.reduce((sum, r) => sum + r.punctualityScore, 0) / totalRatings,
      conformity: ratings.reduce((sum, r) => sum + r.conformityScore, 0) / totalRatings,
      delivery: ratings.reduce((sum, r) => sum + r.deliveryScore, 0) / totalRatings,
      overall: ratings.reduce((sum, r) => sum + r.overallScore, 0) / totalRatings,
    };

    return jsonResponse(200, {
      success: true,
      ratings,
      averages,
      totalRatings,
    });
  } catch (error) {
    console.error('Error fetching ratings:', error);
    return jsonResponse(500, { error: 'Failed to fetch ratings' });
  }
}

// POST /ratings - Submit a rating
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

    if (!event.body) {
      return jsonResponse(400, { error: 'Request body is empty' });
    }

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return jsonResponse(400, { error: 'Invalid request body' });
    }
    const {
      conversationId,
      responseScore,
      punctualityScore,
      conformityScore,
      deliveryScore,
      feedback,
    } = body;

    // Validate required fields
    if (!conversationId) {
      return jsonResponse(400, { error: 'conversationId is required' });
    }

    // Validate scores (1-5)
    const scores = [responseScore, punctualityScore, conformityScore, deliveryScore];
    for (const score of scores) {
      if (!Number.isInteger(score) || score < 1 || score > 5) {
        return jsonResponse(400, { error: 'All scores must be integers between 1 and 5' });
      }
    }

    // Get conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return jsonResponse(404, { error: 'Conversation not found' });
    }

    // Verify user is participant
    if (conversation.buyerId !== userId && conversation.travellerId !== userId) {
      return jsonResponse(403, { error: 'Not authorized to rate this conversation' });
    }

    // Verify conversation is completed
    if (conversation.status !== 'COMPLETED') {
      return jsonResponse(400, { error: 'Transaction must be completed before rating' });
    }

    // Check if user already rated this conversation
    const existingRating = await prisma.rating.findUnique({
      where: {
        conversationId_fromUserId: {
          conversationId,
          fromUserId: userId,
        },
      },
    });

    if (existingRating) {
      return jsonResponse(400, { error: 'You have already rated this transaction' });
    }

    // Determine who is being rated
    const toUserId = conversation.buyerId === userId
      ? conversation.travellerId
      : conversation.buyerId;

    // Calculate overall score
    const overallScore = (responseScore + punctualityScore + conformityScore + deliveryScore) / 4;

    // Sanitize feedback
    const sanitizedFeedback = feedback
      ? feedback.replace(/<[^>]*>/g, '').trim().slice(0, 1000)
      : null;

    // Create rating
    const rating = await prisma.rating.create({
      data: {
        conversationId,
        fromUserId: userId,
        toUserId,
        responseScore,
        punctualityScore,
        conformityScore,
        deliveryScore,
        overallScore,
        feedback: sanitizedFeedback,
      },
      include: {
        toUser: {
          select: { id: true, name: true },
        },
      },
    });

    return jsonResponse(201, {
      success: true,
      rating,
    });
  } catch (error) {
    console.error('Error submitting rating:', error);
    return jsonResponse(500, { error: 'Failed to submit rating' });
  }
}
