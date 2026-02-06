import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice('Bearer '.length);

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (error) {
      console.error('Token verification failed:', error);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [
      totalOrders,
      totalRevenue,
      totalCustomers,
      recentOrders,
      topProducts,
      ordersByStatus,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.aggregate({
        where: { paymentStatus: 'PAID' },
        _sum: { total: true },
      }),
      prisma.user.count({
        where: { role: 'CUSTOMER' },
      }),
      prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.orderItem.groupBy({
        by: ['productId'],
        _sum: { quantity: true },
        _count: { productId: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10,
      }),
      prisma.order.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
    ]);

    // Local typings for the grouped result and product selection
    type TopProductGroup = {
      productId: string;
      _sum: { quantity: number | null };
      _count: { productId: number };
    };
    type ProductMinimal = {
      id: string;
      name: string;
      images: unknown;
    };

    const productIds = (topProducts as TopProductGroup[]).map((p) => p.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        images: true,
      },
    }) as ProductMinimal[];

    const topProductsWithDetails = (topProducts as TopProductGroup[]).map((tp) => {
      const product = products.find((p) => p.id === tp.productId) as (ProductMinimal & { deleted?: boolean }) | undefined;
      return {
        product: product || { id: tp.productId, name: 'Deleted product', deleted: true },
        totalSold: tp._sum.quantity ?? 0,
        orderCount: tp._count.productId,
      };
    });

    return NextResponse.json({
      overview: {
        totalOrders,
        totalRevenue: totalRevenue._sum.total || 0,
        totalCustomers,
      },
      recentOrders,
      topProducts: topProductsWithDetails,
      ordersByStatus,
    });
  } catch (error) {
    console.error('Analytics fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}