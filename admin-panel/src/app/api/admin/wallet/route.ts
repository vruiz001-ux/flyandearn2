import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const perPage = parseInt(searchParams.get('perPage') || '20');
    const type = searchParams.get('type') || '';
    const status = searchParams.get('status') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortDirection = (searchParams.get('sortDirection') || 'desc') as 'asc' | 'desc';

    const where: any = {};
    if (type) where.type = type;
    if (status) where.status = status;

    const total = await prisma.walletTransaction.count({ where });

    const transactions = await prisma.walletTransaction.findMany({
      where,
      select: {
        id: true,
        type: true,
        amount: true,
        currency: true,
        status: true,
        description: true,
        payoutMethod: true,
        createdAt: true,
        completedAt: true,
        wallet: {
          select: {
            user: {
              select: {
                id: true,
                displayName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { [sortBy]: sortDirection },
      skip: (page - 1) * perPage,
      take: perPage,
    });

    // Get aggregate stats
    const [totalBalance, totalHeld, pendingPayouts, completedPayouts] = await Promise.all([
      prisma.wallet.aggregate({ _sum: { balance: true } }),
      prisma.wallet.aggregate({ _sum: { holdBalance: true } }),
      prisma.walletTransaction.aggregate({
        where: { type: 'PAYOUT', status: 'PENDING' },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.walletTransaction.aggregate({
        where: { type: 'PAYOUT', status: 'COMPLETED' },
        _sum: { amount: true },
      }),
    ]);

    const formattedTransactions = transactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      amount: Number(tx.amount),
      currency: tx.currency,
      status: tx.status,
      description: tx.description,
      payoutMethod: tx.payoutMethod,
      createdAt: tx.createdAt,
      completedAt: tx.completedAt,
      user: tx.wallet.user,
    }));

    return NextResponse.json({
      success: true,
      data: formattedTransactions,
      pagination: { total, page, perPage, totalPages: Math.ceil(total / perPage) },
      stats: {
        totalBalance: Number(totalBalance._sum.balance) || 0,
        totalHeld: Number(totalHeld._sum.holdBalance) || 0,
        pendingPayouts: Math.abs(Number(pendingPayouts._sum.amount)) || 0,
        pendingPayoutsCount: pendingPayouts._count || 0,
        completedPayouts: Math.abs(Number(completedPayouts._sum.amount)) || 0,
      },
    });
  } catch (error) {
    console.error('Wallet API error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch transactions' }, { status: 500 });
  }
}
