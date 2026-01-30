// app/api/products/categories/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';
import { z } from 'zod';

const toggleWishlistSchema = z.object({
  productId: z.string().cuid(),
});

// GET /api/wishlist - Get user's wishlist
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyAccessToken(token);

    const wishlistItems = await prisma.wishlist.findMany({
      where: { userId: payload.userId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            images: true,
            styleCode: true,
            stock: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ wishlistItems });
  } catch (error) {
    console.error('Wishlist fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wishlist' },
      { status: 500 }
    );
  }
}

// POST /api/wishlist - Toggle wishlist item
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyAccessToken(token);
    const body = await request.json();
    const validatedData = toggleWishlistSchema.parse(body);

    // Check if already in wishlist
    const existing = await prisma.wishlist.findUnique({
      where: {
        userId_productId: {
          userId: payload.userId,
          productId: validatedData.productId,
        },
      },
    });

    if (existing) {
      // Remove from wishlist
      await prisma.wishlist.delete({
        where: { id: existing.id },
      });
      return NextResponse.json({ message: 'Removed from wishlist' });
    } else {
      // Add to wishlist
      await prisma.wishlist.create({
        data: {
          userId: payload.userId,
          productId: validatedData.productId,
        },
      });
      return NextResponse.json({ message: 'Added to wishlist' });
    }
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Wishlist toggle error:', error);
    return NextResponse.json(
      { error: 'Failed to toggle wishlist' },
      { status: 500 }
    );
  }
}