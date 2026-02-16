import prisma from './lib/prisma.js';
import { jsonResponse, hashPassword, validatePassword } from './lib/auth.js';
import { rateLimit, getRateLimitHeaders, getClientIp } from './lib/rate-limit.js';
import crypto from 'crypto';

// Token expiry: 1 hour
const TOKEN_EXPIRY_HOURS = 1;

export async function handler(event) {
  const { httpMethod, path } = event;
  const pathParts = path.split('/').filter(Boolean);
  const action = pathParts[pathParts.length - 1];

  switch (httpMethod) {
    case 'POST': {
      // Rate limit: 3 attempts per minute per IP for request action
      if (action === 'request' || action === 'reset') {
        const ip = getClientIp(event);
        const limit = rateLimit(ip, { maxRequests: 3, windowMs: 60000 });
        if (!limit.allowed) {
          return {
            statusCode: 429,
            headers: { 'Content-Type': 'application/json', ...getRateLimitHeaders(limit) },
            body: JSON.stringify({ error: 'Too many attempts. Please try again later.' }),
          };
        }
      }
      if (action === 'request') return requestReset(event);
      if (action === 'verify') return verifyToken(event);
      if (action === 'reset') return resetPassword(event);
      return jsonResponse(400, { error: 'Unknown action' });
    }

    default:
      return jsonResponse(405, { error: 'Method not allowed' });
  }
}

// POST /password-reset/request - Request password reset email
async function requestReset(event) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { email } = body;

    if (!email) {
      return jsonResponse(400, { error: 'Email is required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, name: true, isBanned: true },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return jsonResponse(200, {
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    }

    if (user.isBanned) {
      return jsonResponse(200, {
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    }

    // Invalidate any existing tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    // Store token
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // Get the base URL from the request
    const protocol = 'https';
    const host = event.headers.host || 'flyandearn.eu';
    const resetUrl = `${protocol}://${host}/reset-password?token=${token}`;

    // Log the reset URL for development (in production, this would send an email)
    console.log(`Password reset requested for ${user.email}`);
    console.log(`Reset URL: ${resetUrl}`);

    // TODO: Send email via email service (SendGrid, SES, etc.)
    // For now, we'll just log it. In production, uncomment and configure:
    /*
    await sendEmail({
      to: user.email,
      subject: 'Reset Your FlyAndEarn Password',
      html: `
        <h2>Password Reset Request</h2>
        <p>Hi ${user.name || 'there'},</p>
        <p>We received a request to reset your password. Click the link below to set a new password:</p>
        <p><a href="${resetUrl}">Reset Password</a></p>
        <p>This link will expire in ${TOKEN_EXPIRY_HOURS} hour(s).</p>
        <p>If you didn't request this, you can safely ignore this email.</p>
        <p>Best,<br>The FlyAndEarn Team</p>
      `,
    });
    */

    return jsonResponse(200, {
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (error) {
    console.error('Error requesting password reset:', error);
    return jsonResponse(500, { error: 'Failed to process request' });
  }
}

// POST /password-reset/verify - Verify token is valid
async function verifyToken(event) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { token } = body;

    if (!token) {
      return jsonResponse(400, { error: 'Token is required' });
    }

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: {
        user: {
          select: { email: true, name: true },
        },
      },
    });

    if (!resetToken) {
      return jsonResponse(400, { error: 'Invalid or expired reset link' });
    }

    if (resetToken.usedAt) {
      return jsonResponse(400, { error: 'This reset link has already been used' });
    }

    if (new Date() > resetToken.expiresAt) {
      return jsonResponse(400, { error: 'This reset link has expired' });
    }

    return jsonResponse(200, {
      success: true,
      valid: true,
      email: resetToken.user.email,
    });
  } catch (error) {
    console.error('Error verifying token:', error);
    return jsonResponse(500, { error: 'Failed to verify token' });
  }
}

// POST /password-reset/reset - Reset password with valid token
async function resetPassword(event) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { token, password } = body;

    if (!token) {
      return jsonResponse(400, { error: 'Token is required' });
    }

    if (!password) {
      return jsonResponse(400, { error: 'New password is required' });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return jsonResponse(400, { error: 'Password does not meet requirements', details: passwordValidation.errors });
    }

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: {
        user: {
          select: { id: true, email: true },
        },
      },
    });

    if (!resetToken) {
      return jsonResponse(400, { error: 'Invalid or expired reset link' });
    }

    if (resetToken.usedAt) {
      return jsonResponse(400, { error: 'This reset link has already been used' });
    }

    if (new Date() > resetToken.expiresAt) {
      return jsonResponse(400, { error: 'This reset link has expired' });
    }

    // Hash new password
    const hashedPassword = await hashPassword(password);

    // Update password and mark token as used
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash: hashedPassword },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    console.log(`Password reset completed for ${resetToken.user.email}`);

    return jsonResponse(200, {
      success: true,
      message: 'Your password has been reset successfully. You can now log in.',
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    return jsonResponse(500, { error: 'Failed to reset password' });
  }
}
