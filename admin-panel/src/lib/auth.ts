import { getIronSession, IronSession, SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import prisma from './db';
import { AuditAction } from '@prisma/client';

// Session data interface
export interface SessionData {
  adminId: string;
  username: string;
  isLoggedIn: boolean;
  loginAt: number;
}

// Session options
export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || 'complex_password_at_least_32_characters_long',
  cookieName: 'fae_admin_session',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8, // 8 hours
    path: '/',
  },
};

// Default session data
export const defaultSession: SessionData = {
  adminId: '',
  username: '',
  isLoggedIn: false,
  loginAt: 0,
};

// Get session from cookies
export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  return session;
}

// Verify admin credentials
export async function verifyAdminCredentials(
  username: string,
  password: string
): Promise<{ success: boolean; admin?: { id: string; username: string } }> {
  const admin = await prisma.adminUser.findUnique({
    where: { username },
  });

  if (!admin || !admin.isActive) {
    return { success: false };
  }

  const isValid = await bcrypt.compare(password, admin.passwordHash);

  if (!isValid) {
    return { success: false };
  }

  // Update last login time
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    success: true,
    admin: { id: admin.id, username: admin.username },
  };
}

// Log audit action
export async function logAuditAction(params: {
  adminId?: string | null;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: object;
  previousValue?: object;
  newValue?: object;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: params.adminId || null,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        details: params.details,
        previousValue: params.previousValue,
        newValue: params.newValue,
      },
    });
  } catch (error) {
    console.error('Failed to log audit action:', error);
  }
}

// Log login attempt
export async function logLoginAttempt(params: {
  username: string;
  ipAddress: string;
  userAgent?: string;
  success: boolean;
}) {
  try {
    await prisma.loginAttempt.create({
      data: {
        username: params.username,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        success: params.success,
      },
    });
  } catch (error) {
    console.error('Failed to log login attempt:', error);
  }
}

// Get client IP from headers
export function getClientIP(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  return '127.0.0.1';
}

// Get user agent from headers
export function getUserAgent(request: Request): string {
  return request.headers.get('user-agent') || 'Unknown';
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Validate session (for API routes)
export async function validateSession(): Promise<{
  valid: boolean;
  session?: SessionData;
}> {
  const session = await getSession();

  if (!session.isLoggedIn || !session.adminId) {
    return { valid: false };
  }

  // Check if session is expired (8 hours)
  const sessionAge = Date.now() - session.loginAt;
  const maxAge = 8 * 60 * 60 * 1000; // 8 hours in ms

  if (sessionAge > maxAge) {
    return { valid: false };
  }

  // Verify admin still exists and is active
  const admin = await prisma.adminUser.findUnique({
    where: { id: session.adminId },
  });

  if (!admin || !admin.isActive) {
    return { valid: false };
  }

  return { valid: true, session };
}

// CSRF token generation (using session-based approach)
export function generateCSRFToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
