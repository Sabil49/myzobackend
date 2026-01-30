// app/api/cart/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';
import { z } from 'zod';

const MAX_ITEM_QUANTITY = 999; // Maximum quantity per cart item

// Custom error class for cart validation failures
class CartValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CartValidationError';
  }
}

const cartItemSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.number().int().positive(),
});

const syncCartSchema = z.object({
  items: z.array(cartItemSchema),
});

// GET /api/cart - Get user's cart
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

    const cartItems = await prisma.cartItem.findMany({
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
    });

    return NextResponse.json({ cartItems });
  } catch (error) {
    console.error('Cart fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cart' },
      { status: 500 }
    );
  }
}

// POST /api/cart - Sync cart from client
export async function POST(request: NextRequest) {
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

    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.error('JSON parse error:', error);
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const validatedData = syncCartSchema.parse(body);

    // Use transaction for atomicity
    await prisma.$transaction(async (tx) => {
      // Delete existing cart items
      await tx.cartItem.deleteMany({
        where: { userId: payload.userId },
      });

      // Deduplicate items by productId: sum quantities for duplicate entries
      // Preserves first occurrence of item metadata (productId)
      const dedupedItems = Array.from(
        validatedData.items.reduce((map, item) => {
          const existing = map.get(item.productId);
          if (existing) {
            existing.quantity += item.quantity;
          } else {
            map.set(item.productId, { ...item });
          }
          return map;
        }, new Map<string, typeof validatedData.items[0]>()).values()
      );

      // Validate aggregated quantities against MAX_ITEM_QUANTITY and product stock
      const productIds = dedupedItems.map(item => item.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, stock: true },
      });

      const productMap = new Map(products.map(p => [p.id, p.stock]));

      for (const item of dedupedItems) {
        if (item.quantity > MAX_ITEM_QUANTITY) {
          throw new CartValidationError(`Item quantity for product ${item.productId} exceeds maximum of ${MAX_ITEM_QUANTITY}`);
        }

        const productStock = productMap.get(item.productId);
        if (productStock === undefined) {
          throw new CartValidationError(`Product ${item.productId} not found`);
        }

        if (item.quantity > productStock) {
          throw new CartValidationError(`Requested quantity ${item.quantity} exceeds available stock ${productStock} for product ${item.productId}`);
        }
      }

      // Create new cart items if any
      if (dedupedItems.length > 0) {
        await tx.cartItem.createMany({
          data: dedupedItems.map((item) => ({
            userId: payload.userId,
            productId: item.productId,
            quantity: item.quantity,
          })),
        });
      }
    });

    return NextResponse.json({ message: 'Cart synced successfully' });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    if (error instanceof CartValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Cart sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync cart' },
      { status: 500 }
    );
  }
}

// DELETE /api/cart - Clear cart
export async function DELETE(request: NextRequest) {
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

    await prisma.cartItem.deleteMany({
      where: { userId: payload.userId },
    });

    return NextResponse.json({ message: 'Cart cleared successfully' });
  } catch (error) {
    console.error('Cart clear error:', error);
    return NextResponse.json(
      { error: 'Failed to clear cart' },
      { status: 500 }
    );
  }
}