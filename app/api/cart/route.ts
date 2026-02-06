// app/api/cart/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';
import { z } from 'zod';

const MAX_ITEM_QUANTITY = 10;

const addToCartSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(MAX_ITEM_QUANTITY),
});

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
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid token payload' }, { status: 401 });
    }

    let cart = await prisma.cart.findUnique({
      where: { userId: payload.userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                images: true,
                stockQuantity: true,
                isAvailable: true,
              },
            },
          },
        },
      },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: {
          userId: payload.userId,
        },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  images: true,
                  stockQuantity: true,
                  isAvailable: true,
                },
              },
            },
          },
        },
      });
    }

    return NextResponse.json({ cart });
  } catch (error) {
    console.error('Get cart error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cart' },
      { status: 500 }
    );
  }
}

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
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid token payload' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = addToCartSchema.parse(body);

    const product = await prisma.product.findUnique({
      where: { id: validatedData.productId },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (!product.isAvailable) {
      return NextResponse.json({ error: 'Product is not available' }, { status: 400 });
    }

    if (product.stockQuantity < validatedData.quantity) {
      return NextResponse.json(
        { error: 'Insufficient stock' },
        { status: 400 }
      );
    }

    let cart = await prisma.cart.findUnique({
      where: { userId: payload.userId },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId: payload.userId },
      });
    }

    const existingItem = await prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId: validatedData.productId,
        },
      },
    });

    let cartItem;
    if (existingItem) {
      const newQuantity = existingItem.quantity + validatedData.quantity;
      
      if (newQuantity > MAX_ITEM_QUANTITY) {
        return NextResponse.json(
          { error: `Cannot add more than ${MAX_ITEM_QUANTITY} items` },
          { status: 400 }
        );
      }

      if (newQuantity > product.stockQuantity) {
        return NextResponse.json(
          { error: 'Insufficient stock' },
          { status: 400 }
        );
      }

      cartItem = await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              price: true,
              images: true,
              stockQuantity: true,
              isAvailable: true,
            },
          },
        },
      });
    } else {
      cartItem = await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: validatedData.productId,
          quantity: validatedData.quantity,
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              price: true,
              images: true,
              stockQuantity: true,
              isAvailable: true,
            },
          },
        },
      });
    }

    return NextResponse.json({ cartItem });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Add to cart error:', error);
    return NextResponse.json(
      { error: 'Failed to add to cart' },
      { status: 500 }
    );
  }
}

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
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid token payload' }, { status: 401 });
    }

    const cart = await prisma.cart.findUnique({
      where: { userId: payload.userId },
    });

    if (!cart) {
      return NextResponse.json({ message: 'Cart is already empty' });
    }

    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    return NextResponse.json({ message: 'Cart cleared successfully' });
  } catch (error) {
    console.error('Clear cart error:', error);
    return NextResponse.json(
      { error: 'Failed to clear cart' },
      { status: 500 }
    );
  }
}