import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const perPage = parseInt(searchParams.get('perPage') || '20');
    const status = searchParams.get('status') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortDirection = (searchParams.get('sortDirection') || 'desc') as 'asc' | 'desc';

    const where: any = {};
    if (status) where.status = status;

    const total = await prisma.match.count({ where });

    const matches = await prisma.match.findMany({
      where,
      select: {
        id: true,
        status: true,
        agreedPrice: true,
        commission: true,
        platformFee: true,
        expectedDelivery: true,
        createdAt: true,
        completedAt: true,
        request: {
          select: {
            id: true,
            title: true,
            status: true,
            currency: true,
          },
        },
        traveller: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
      orderBy: { [sortBy]: sortDirection },
      skip: (page - 1) * perPage,
      take: perPage,
    });

    // Calculate KPIs
    const stats = await prisma.match.aggregate({
      _count: true,
      where: { status: 'ACCEPTED' },
    });

    const totalMatches = await prisma.match.count();
    const completedMatches = await prisma.match.count({ where: { status: 'COMPLETED' } });
    const acceptanceRate = totalMatches > 0 ? (stats._count / totalMatches) * 100 : 0;
    const completionRate = stats._count > 0 ? (completedMatches / stats._count) * 100 : 0;

    const formattedMatches = matches.map((m) => ({
      id: m.id,
      status: m.status,
      agreedPrice: m.agreedPrice ? Number(m.agreedPrice) : null,
      commission: m.commission ? Number(m.commission) : null,
      platformFee: m.platformFee ? Number(m.platformFee) : null,
      currency: m.request.currency,
      expectedDelivery: m.expectedDelivery,
      createdAt: m.createdAt,
      completedAt: m.completedAt,
      request: m.request,
      traveller: m.traveller,
    }));

    return NextResponse.json({
      success: true,
      data: formattedMatches,
      pagination: { total, page, perPage, totalPages: Math.ceil(total / perPage) },
      kpis: { acceptanceRate, completionRate, totalAccepted: stats._count, totalCompleted: completedMatches },
    });
  } catch (error) {
    console.error('Matches API error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch matches' }, { status: 500 });
  }
}
