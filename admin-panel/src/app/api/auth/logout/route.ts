import { NextRequest, NextResponse } from 'next/server';
import { getSession, logAuditAction, getClientIP, getUserAgent } from '@/lib/auth';
import { AuditAction } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const ipAddress = getClientIP(request);
    const userAgent = getUserAgent(request);

    // Log logout before destroying session
    if (session.isLoggedIn && session.adminId) {
      await logAuditAction({
        adminId: session.adminId,
        action: AuditAction.LOGOUT,
        ipAddress,
        userAgent,
      });
    }

    // Destroy session
    session.destroy();

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to logout',
      },
      { status: 500 }
    );
  }
}
