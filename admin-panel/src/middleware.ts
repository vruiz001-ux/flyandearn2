import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/auth';

// Routes that don't require authentication
const publicRoutes = ['/admin/login'];

// API routes that don't require authentication
const publicApiRoutes = ['/api/auth/login', '/api/track'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (publicRoutes.some(route => pathname === route)) {
    return NextResponse.next();
  }

  // Allow public API routes
  if (publicApiRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check if it's an admin route or admin API route
  const isAdminRoute = pathname.startsWith('/admin');
  const isAdminApiRoute = pathname.startsWith('/api/admin');

  if (!isAdminRoute && !isAdminApiRoute) {
    return NextResponse.next();
  }

  // Get session
  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, sessionOptions);

  // Check if user is logged in
  if (!session.isLoggedIn || !session.adminId) {
    // For API routes, return 401
    if (isAdminApiRoute) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // For page routes, redirect to login
    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('returnUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Check session expiry (8 hours)
  const sessionAge = Date.now() - session.loginAt;
  const maxAge = 8 * 60 * 60 * 1000;

  if (sessionAge > maxAge) {
    // Session expired
    if (isAdminApiRoute) {
      return NextResponse.json(
        { success: false, error: 'Session expired' },
        { status: 401 }
      );
    }

    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('expired', 'true');
    return NextResponse.redirect(loginUrl);
  }

  // Add admin info to headers for API routes
  if (isAdminApiRoute) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-admin-id', session.adminId);
    requestHeaders.set('x-admin-username', session.username);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all admin routes
    '/admin/:path*',
    // Match admin API routes
    '/api/admin/:path*',
    // Match auth routes
    '/api/auth/:path*',
  ],
};
