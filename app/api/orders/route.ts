// app/api/orders/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';
import { createOrderSchema } from '@/lib/validators/order';
import { ZodError } from 'zod';

// GET /api/orders - Get user's orders
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
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orders = await prisma.order.findMany({
      where: { userId: payload.userId },
      include: {
        items: { include: { product: true } },
        shippingAddress: true,
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('Orders fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

// POST /api/orders - Create order
//
// STOCK STRATEGY:
//   ✅ On order creation (PLACED)    → validate stock exists, but do NOT decrement
//   ✅ On payment confirmed (PAID)   → decrement stock atomically (see return/route.ts)
//   ✅ On cancellation/failure       → no stock change needed (was never decremented)
//
// This prevents stock exhaustion from abandoned/failed payment attempts.
//
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
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    let validatedData;
    try {
      validatedData = createOrderSchema.parse(body);
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json({ error: error.issues }, { status: 400 });
      }
      throw error;
    }

    const paymentMethodMap: Record<string, 'STRIPE' | 'RAZORPAY' | 'DODO'> = {
      stripe: 'STRIPE',
      razorpay: 'RAZORPAY',
      dodo: 'DODO',
    };
    const mappedPaymentMethod = paymentMethodMap[validatedData.paymentMethod];
    if (!mappedPaymentMethod) {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
    }

    const order = await prisma.$transaction(async (tx) => {
      // 1. Verify address belongs to user
      const address = await tx.address.findUnique({
        where: { id: validatedData.addressId },
        select: { userId: true },
      });
      if (!address || address.userId !== payload.userId) {
        throw new Error('BadRequest: Address not found or access denied');
      }

      // 2. Validate stock availability — READ ONLY, no decrement
      const itemsWithPrices: Array<{
        productId: string;
        quantity: number;
        price: number;
      }> = [];

      for (const item of validatedData.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { id: true, price: true, stock: true, isActive: true, name: true },
        });

        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }
        if (!product.isActive) {
          throw new Error(`Product "${product.name}" is no longer available`);
        }
        // ✅ Only CHECK stock — do not decrement here
        if (product.stock < item.quantity) {
          throw new Error(
            `"${product.name}" only has ${product.stock} item${product.stock === 1 ? '' : 's'} in stock (requested ${item.quantity})`
          );
        }

        itemsWithPrices.push({
          productId: item.productId,
          quantity: item.quantity,
          price: Number(product.price),
        });
      }

      // 3. Calculate totals
      const subtotal = itemsWithPrices.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );
      const shippingCost = subtotal > 500 ? 0 : 25;
      const tax = subtotal * 0.08;
      const total = subtotal + shippingCost + tax;

      // 4. User snapshot
      const userInfo = await tx.user.findUnique({
        where: { id: payload.userId },
        select: { email: true, firstName: true, lastName: true },
      });
      const snapshotEmail = userInfo?.email ?? 'unknown@example.com';
      const snapshotName =
        [userInfo?.firstName, userInfo?.lastName].filter(Boolean).join(' ') ||
        'Unknown';

      // 5. Create order — status PLACED, paymentStatus PENDING, stock untouched
      const orderNumber = `LH${Date.now()}-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;

      const createdOrder = await tx.order.create({
        data: {
          orderNumber,
          userId: payload.userId,
          userEmail: snapshotEmail,
          userName: snapshotName,
          addressId: validatedData.addressId,
          subtotal,
          shippingCost,
          tax,
          total,
          paymentMethod: mappedPaymentMethod,
          status: 'PLACED',
          paymentStatus: 'PENDING',
          items: {
            createMany: { data: itemsWithPrices },
          },
          statusHistory: {
            create: { status: 'PLACED', notes: 'Order placed, awaiting payment' },
          },
        },
        include: {
          items: { include: { product: true } },
          shippingAddress: true,
        },
      });

      // 6. Clear cart
      await tx.cartItem.deleteMany({ where: { userId: payload.userId } });

      return createdOrder;
    });

    return NextResponse.json({ order }, { status: 201 });
  } catch (error: unknown) {
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? (error as { message: string }).message
        : '';

    if (
      message.includes('Insufficient stock') ||
      message.includes('only has') ||
      message.includes('not found') ||
      message.includes('no longer available') ||
      message.includes('BadRequest')
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error('Order creation error:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}