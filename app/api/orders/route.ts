// app/api/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';
import { z } from 'zod';

const createOrderSchema = z.object({
  addressId: z.string().uuid(),
  paymentMethod: z.string().min(1),
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

    const orders = await prisma.order.findMany({
      where: { userId: payload.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        address: true,
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('Get orders error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
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
    const validatedData = createOrderSchema.parse(body);

    const address = await prisma.address.findFirst({
      where: {
        id: validatedData.addressId,
        userId: payload.userId,
      },
    });

    if (!address) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 });
    }

    const cart = await prisma.cart.findUnique({
      where: { userId: payload.userId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    for (const item of cart.items) {
      if (!item.product.isAvailable) {
        return NextResponse.json(
          { error: `Product ${item.product.name} is not available` },
          { status: 400 }
        );
      }
      if (item.product.stockQuantity < item.quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for ${item.product.name}` },
          { status: 400 }
        );
      }
    }

    const subtotal = cart.items.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );
    const tax = subtotal * 0.1;
    const shipping = 10;
    const total = subtotal + tax + shipping;

    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          userId: payload.userId,
          orderNumber,
          addressId: validatedData.addressId,
          subtotal,
          tax,
          shipping,
          total,
          paymentMethod: validatedData.paymentMethod,
          items: {
            create: cart.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.product.price,
            })),
          },
        },
        include: {
          address: true,
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  images: true,
                },
              },
            },
          },
        },
      });

      for (const item of cart.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockQuantity: {
              decrement: item.quantity,
            },
          },
        });
      }

      await tx.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      return newOrder;
    });

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Create order error:', error);
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}