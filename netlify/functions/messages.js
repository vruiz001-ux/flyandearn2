import prisma from './lib/prisma.js';
import { getSessionToken, verifyToken, jsonResponse } from './lib/auth.js';

export async function handler(event) {
  const { httpMethod } = event;

  // All methods require authentication
  const token = getSessionToken(event);
  if (!token) {
    return jsonResponse(401, { error: 'Authentication required' });
  }

  const payload = await verifyToken(token);
  if (!payload || !payload.userId) {
    return jsonResponse(401, { error: 'Invalid session' });
  }

  switch (httpMethod) {
    case 'GET':
      return handleGet(event, payload.userId);
    case 'POST':
      return handlePost(event, payload.userId);
    case 'PUT':
      return handlePut(event, payload.userId);
    default:
      return jsonResponse(405, { error: 'Method not allowed' });
  }
}

// GET /messages - List conversations or get messages for a conversation
async function handleGet(event, userId) {
  try {
    const params = event.queryStringParameters || {};
    const { conversationId } = params;

    // If conversationId provided, get messages for that conversation
    if (conversationId) {
      // Verify user is participant
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          trip: {
            select: {
              id: true,
              fromCity: true,
              toCity: true,
              fromAirport: true,
              toAirport: true,
              departureDate: true,
              returnDate: true,
            },
          },
          buyer: {
            select: { id: true, name: true },
          },
          traveller: {
            select: { id: true, name: true },
          },
        },
      });

      if (!conversation) {
        return jsonResponse(404, { error: 'Conversation not found' });
      }

      if (conversation.buyerId !== userId && conversation.travellerId !== userId) {
        return jsonResponse(403, { error: 'Not authorized to view this conversation' });
      }

      // Get messages
      const messages = await prisma.message.findMany({
        where: { conversationId },
        include: {
          sender: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      // Mark unread messages as read (those sent to current user)
      await prisma.message.updateMany({
        where: {
          conversationId,
          senderId: { not: userId },
          read: false,
        },
        data: { read: true },
      });

      return jsonResponse(200, {
        success: true,
        conversation,
        messages,
      });
    }

    // List all conversations for user
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [{ buyerId: userId }, { travellerId: userId }],
      },
      include: {
        trip: {
          select: {
            id: true,
            fromCity: true,
            toCity: true,
          },
        },
        buyer: {
          select: { id: true, name: true },
        },
        traveller: {
          select: { id: true, name: true },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Add unread count for each conversation
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await prisma.message.count({
          where: {
            conversationId: conv.id,
            senderId: { not: userId },
            read: false,
          },
        });
        return {
          ...conv,
          unreadCount,
          lastMessage: conv.messages[0] || null,
        };
      })
    );

    return jsonResponse(200, {
      success: true,
      conversations: conversationsWithUnread,
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return jsonResponse(500, { error: 'Failed to fetch messages' });
  }
}

// POST /messages - Send a new message
async function handlePost(event, userId) {
  try {
    if (!event.body) {
      return jsonResponse(400, { error: 'Request body is empty' });
    }

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return jsonResponse(400, { error: 'Invalid request body' });
    }
    const { tripId, text } = body;

    if (!tripId || !text || !text.trim()) {
      return jsonResponse(400, { error: 'tripId and text are required' });
    }

    // Sanitize message text (strip HTML, limit length)
    const sanitizedText = text
      .replace(/<[^>]*>/g, '')
      .trim()
      .slice(0, 2000);

    if (!sanitizedText) {
      return jsonResponse(400, { error: 'Message cannot be empty' });
    }

    // Get trip details
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        traveller: {
          select: { id: true, name: true },
        },
      },
    });

    if (!trip) {
      return jsonResponse(404, { error: 'Trip not found' });
    }

    // Determine if user is buyer or traveller
    const isTraveller = trip.travellerId === userId;
    const isBuyer = !isTraveller;

    // Get or create conversation
    let conversation;

    if (isBuyer) {
      // Buyer initiating or continuing conversation
      conversation = await prisma.conversation.findUnique({
        where: {
          tripId_buyerId: {
            tripId,
            buyerId: userId,
          },
        },
      });

      if (!conversation) {
        // Create new conversation
        conversation = await prisma.conversation.create({
          data: {
            tripId,
            buyerId: userId,
            travellerId: trip.travellerId,
          },
        });
      }
    } else {
      // Traveller can only reply to existing conversations
      // Find conversation where they are the traveller
      const existingConversation = await prisma.conversation.findFirst({
        where: {
          tripId,
          travellerId: userId,
        },
      });

      if (!existingConversation) {
        return jsonResponse(400, {
          error: 'No conversation found. Buyers must initiate contact.',
        });
      }

      conversation = existingConversation;
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: userId,
        text: sanitizedText,
      },
      include: {
        sender: {
          select: { id: true, name: true },
        },
      },
    });

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    return jsonResponse(201, {
      success: true,
      message,
      conversationId: conversation.id,
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return jsonResponse(500, { error: 'Failed to send message' });
  }
}

// PUT /messages - Mark messages as read or complete transaction
async function handlePut(event, userId) {
  try {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return jsonResponse(400, { error: 'Invalid request body' });
    }
    const { conversationId, action } = body;

    if (!conversationId) {
      return jsonResponse(400, { error: 'conversationId is required' });
    }

    // Verify user is participant
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        buyer: { select: { id: true, name: true } },
        traveller: { select: { id: true, name: true } },
      },
    });

    if (!conversation) {
      return jsonResponse(404, { error: 'Conversation not found' });
    }

    if (conversation.buyerId !== userId && conversation.travellerId !== userId) {
      return jsonResponse(403, { error: 'Not authorized' });
    }

    // Handle complete action
    if (action === 'complete') {
      if (conversation.status === 'COMPLETED') {
        return jsonResponse(400, { error: 'Transaction already completed' });
      }

      const updated = await prisma.conversation.update({
        where: { id: conversationId },
        data: { status: 'COMPLETED' },
      });

      // Determine who the other party is for rating
      const otherUser = conversation.buyerId === userId
        ? conversation.traveller
        : conversation.buyer;

      return jsonResponse(200, {
        success: true,
        message: 'Transaction marked as completed',
        conversation: updated,
        otherUser,
      });
    }

    // Default action: mark messages as read
    const updated = await prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        read: false,
      },
      data: { read: true },
    });

    return jsonResponse(200, {
      success: true,
      markedAsRead: updated.count,
    });
  } catch (error) {
    console.error('Error updating conversation:', error);
    return jsonResponse(500, { error: 'Failed to update conversation' });
  }
}
