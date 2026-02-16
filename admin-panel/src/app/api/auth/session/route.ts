import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const session = await getSession();

    if (!session.isLoggedIn || !session.adminId) {
      return NextResponse.json({
        success: true,
        data: {
          isLoggedIn: false,
        },
      });
    }

    // Check session expiry
    const sessionAge = Date.now() - session.loginAt;
    const maxAge = 8 * 60 * 60 * 1000;

    if (sessionAge > maxAge) {
      session.destroy();
      return NextResponse.json({
        success: true,
        data: {
          isLoggedIn: false,
          expired: true,
        },
      });
    }

    // Verify admin still exists and is active
    const admin = await prisma.adminUser.findUnique({
      where: { id: session.adminId },
      select: {
        id: true,
        username: true,
        email: true,
        isActive: true,
      },
    });

    if (!admin || !admin.isActive) {
      session.destroy();
      return NextResponse.json({
        success: true,
        data: {
          isLoggedIn: false,
          invalid: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        isLoggedIn: true,
        admin: {
          id: admin.id,
          username: admin.username,
          email: admin.email,
        },
        sessionAge,
        expiresIn: maxAge - sessionAge,
      },
    });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check session',
      },
      { status: 500 }
    );
  }
}
