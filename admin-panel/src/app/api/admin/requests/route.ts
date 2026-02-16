import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const perPage = parseInt(searchParams.get('perPage') || '20');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const category = searchParams.get('category') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortDirection = (searchParams.get('sortDirection') || 'desc') as 'asc' | 'desc';

    const where: any = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) where.status = status;
    if (category) where.category = category;

    const total = await prisma.request.count({ where });

    const requests = await prisma.request.findMany({
      where,
      select: {
        id: true,
        title: true,
        category: true,
        status: true,
        itemPrice: true,
        commission: true,
        currency: true,
        pickupCity: true,
        pickupCountry: true,
        deliveryCity: true,
        deliveryCountry: true,
        createdAt: true,
        publishedAt: true,
        completedAt: true,
        requester: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
        _count: {
          select: { matches: true },
        },
      },
      orderBy: { [sortBy]: sortDirection },
      skip: (page - 1) * perPage,
      take: perPage,
    });

    const formattedRequests = requests.map((req) => ({
      id: req.id,
      title: req.title,
      category: req.category,
      status: req.status,
      itemPrice: Number(req.itemPrice),
      commission: Number(req.commission),
      currency: req.currency,
      route: `${req.pickupCountry} → ${req.deliveryCountry}`,
      createdAt: req.createdAt,
      requester: req.requester,
      matchCount: req._count.matches,
    }));

    return NextResponse.json({
      success: true,
      data: formattedRequests,
      pagination: { total, page, perPage, totalPages: Math.ceil(total / perPage) },
    });
  } catch (error) {
    console.error('Requests API error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch requests' }, { status: 500 });
  }
}
