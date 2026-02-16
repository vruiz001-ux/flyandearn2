import prisma from './lib/prisma.js';
import { getSessionToken, verifyToken, jsonResponse } from './lib/auth.js';
import { sendEmail, verificationEmail, welcomeEmail } from './lib/email.js';
import crypto from 'crypto';

// Token expiry: 24 hours
const TOKEN_EXPIRY_HOURS = 24;

export async function handler(event) {
  const { httpMethod, path } = event;
  const pathParts = path.split('/').filter(Boolean);
  const action = pathParts[pathParts.length - 1];

  switch (httpMethod) {
    case 'POST':
      if (action === 'send') return sendVerification(event);
      if (action === 'verify') return verifyEmail(event);
      if (action === 'status') return getStatus(event);
      return jsonResponse(400, { error: 'Unknown action' });

    default:
      return jsonResponse(405, { error: 'Method not allowed' });
  }
}

// POST /email-verification/send - Send verification email
async function sendVerification(event) {
  try {
    // User must be logged in
    const sessionToken = getSessionToken(event);
    if (!sessionToken) {
      return jsonResponse(401, { error: 'Authentication required' });
    }

    const payload = await verifyToken(sessionToken);
    if (!payload || !payload.userId) {
      return jsonResponse(401, { error: 'Invalid session' });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true, emailVerified: true },
    });

    if (!user) {
      return jsonResponse(404, { error: 'User not found' });
    }

    if (user.emailVerified) {
      return jsonResponse(400, { error: 'Email is already verified' });
    }

    // Invalidate any existing tokens for this user
    await prisma.emailVerificationToken.updateMany({
      where: {
        userId: user.id,
        verifiedAt: null,
      },
      data: {
        verifiedAt: new Date(), // Mark as used
      },
    });

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    // Store token
    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // Get the base URL from the request
    const protocol = 'https';
    const host = event.headers.host || 'flyandearn.eu';
    const verifyUrl = `${protocol}://${host}/verify-email?token=${token}`;

    // Send verification email
    console.log(`Email verification requested for ${user.email}`);
    const baseUrl = `${protocol}://${host}`;
    const emailData = verificationEmail(user.name, token, baseUrl);
    await sendEmail({ to: user.email, ...emailData });

    return jsonResponse(200, {
      success: true,
      message: 'Verification email has been sent. Please check your inbox.',
    });
  } catch (error) {
    console.error('Error sending verification email:', error);
    return jsonResponse(500, { error: 'Failed to send verification email' });
  }
}

// POST /email-verification/verify - Verify email with token
async function verifyEmail(event) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { token } = body;

    if (!token) {
      return jsonResponse(400, { error: 'Token is required' });
    }

    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: { token },
      include: {
        user: {
          select: { id: true, email: true, emailVerified: true },
        },
      },
    });

    if (!verificationToken) {
      return jsonResponse(400, { error: 'Invalid verification link' });
    }

    if (verificationToken.verifiedAt) {
      return jsonResponse(400, { error: 'This verification link has already been used' });
    }

    if (new Date() > verificationToken.expiresAt) {
      return jsonResponse(400, { error: 'This verification link has expired' });
    }

    if (verificationToken.user.emailVerified) {
      return jsonResponse(200, {
        success: true,
        message: 'Your email is already verified.',
        alreadyVerified: true,
      });
    }

    // Update user as verified and mark token as used
    await prisma.$transaction([
      prisma.user.update({
        where: { id: verificationToken.userId },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      }),
      prisma.emailVerificationToken.update({
        where: { id: verificationToken.id },
        data: { verifiedAt: new Date() },
      }),
    ]);

    console.log(`Email verified for ${verificationToken.user.email}`);

    // Send welcome email (non-blocking)
    try {
      const user = await prisma.user.findUnique({
        where: { id: verificationToken.userId },
        select: { name: true, email: true },
      });
      if (user) {
        const emailData = welcomeEmail(user.name);
        await sendEmail({ to: user.email, ...emailData });
      }
    } catch (welcomeErr) {
      console.error('Failed to send welcome email:', welcomeErr);
    }

    return jsonResponse(200, {
      success: true,
      message: 'Your email has been verified successfully!',
    });
  } catch (error) {
    console.error('Error verifying email:', error);
    return jsonResponse(500, { error: 'Failed to verify email' });
  }
}

// POST /email-verification/status - Check verification status
async function getStatus(event) {
  try {
    // User must be logged in
    const sessionToken = getSessionToken(event);
    if (!sessionToken) {
      return jsonResponse(401, { error: 'Authentication required' });
    }

    const payload = await verifyToken(sessionToken);
    if (!payload || !payload.userId) {
      return jsonResponse(401, { error: 'Invalid session' });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        emailVerified: true,
        emailVerifiedAt: true,
      },
    });

    if (!user) {
      return jsonResponse(404, { error: 'User not found' });
    }

    return jsonResponse(200, {
      success: true,
      verified: user.emailVerified,
      verifiedAt: user.emailVerifiedAt,
    });
  } catch (error) {
    console.error('Error checking verification status:', error);
    return jsonResponse(500, { error: 'Failed to check status' });
  }
}
