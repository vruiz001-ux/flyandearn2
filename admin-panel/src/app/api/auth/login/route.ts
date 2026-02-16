import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getSession,
  verifyAdminCredentials,
  logLoginAttempt,
  logAuditAction,
  getClientIP,
  getUserAgent,
} from '@/lib/auth';
import { checkCombinedRateLimit, getRateLimitHeaders } from '@/lib/rate-limit';
import { AuditAction } from '@prisma/client';

// Login request schema
const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const validation = loginSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { username, password } = validation.data;
    const ipAddress = getClientIP(request);
    const userAgent = getUserAgent(request);

    // Check rate limit
    const rateLimit = await checkCombinedRateLimit(ipAddress, username);

    if (!rateLimit.allowed) {
      const headers = getRateLimitHeaders(rateLimit.ipLimit);

      return NextResponse.json(
        {
          success: false,
          error: rateLimit.reason,
          retryAfter: Math.ceil(
            (rateLimit.ipLimit.resetAt.getTime() - Date.now()) / 1000
          ),
        },
        {
          status: 429,
          headers,
        }
      );
    }

    // Verify credentials
    const authResult = await verifyAdminCredentials(username, password);

    if (!authResult.success || !authResult.admin) {
      // Log failed attempt
      await logLoginAttempt({
        username,
        ipAddress,
        userAgent,
        success: false,
      });

      await logAuditAction({
        action: AuditAction.LOGIN_FAILURE,
        ipAddress,
        userAgent,
        details: { username },
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Invalid username or password',
        },
        { status: 401 }
      );
    }

    // Create session
    const session = await getSession();
    session.adminId = authResult.admin.id;
    session.username = authResult.admin.username;
    session.isLoggedIn = true;
    session.loginAt = Date.now();
    await session.save();

    // Log successful login
    await logLoginAttempt({
      username,
      ipAddress,
      userAgent,
      success: true,
    });

    await logAuditAction({
      adminId: authResult.admin.id,
      action: AuditAction.LOGIN_SUCCESS,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      data: {
        username: authResult.admin.username,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
