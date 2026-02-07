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
    } catch (error) {
      console.error('Token verification failed:', error);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const orders = await prisma.order.findMany({
      where: { userId: payload.userId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        shippingAddress: true,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('Orders fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

// POST /api/orders - Create order
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

    let validatedData;
    try {
      validatedData = createOrderSchema.parse(body);
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json({ error: error.issues }, { status: 400 });
      }
      throw error;
    }

    // Calculate totals with transaction for atomicity
    const order = await prisma.$transaction(async (tx) => {
      // Verify address ownership within transaction
      const address = await tx.address.findUnique({
        where: { id: validatedData.addressId },
        select: { userId: true },
      });

      if (!address || address.userId !== payload.userId) {
        throw new Error('Address not found or access denied');
      }

      // Atomically update product stock and validate availability
      const itemsWithPrices: Array<{ productId: string; quantity: number; price: number }> = [];

      for (const item of validatedData.items) {
        // Atomically check and decrement stock in a single operation
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }

        // Use updateMany with stock condition for atomic check-and-decrement
        const updateResult = await tx.product.updateMany({
          where: { 
            id: item.productId,
            stock: { gte: item.quantity }
          },
          data: { stock: { decrement: item.quantity } },
        });

        if (updateResult.count === 0) {
          throw new Error(`Insufficient stock for product ${item.productId}`);
        }

        itemsWithPrices.push({
          productId: item.productId,
          quantity: item.quantity,
          price: Number(product.price),
        });
      }

      const subtotal = itemsWithPrices.reduce(
        (sum, item) => sum + Number(item.price) * item.quantity,
        0
      );
      
      const shippingCost = subtotal > 500 ? 0 : 25; // Free shipping over $500
      const tax = subtotal * 0.08; // 8% tax
      const total = subtotal + shippingCost + tax;

      // Generate order number with crypto-strong UUID
      const orderNumber = `LH${Date.now()}-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;

      const paymentMethodMap: Record<string, 'STRIPE' | 'RAZORPAY' | 'DODO'> = {
       'stripe': 'STRIPE',
       'razorpay': 'RAZORPAY',
       'dodo': 'DODO',
      };
      // Create order
      const createdOrder = await tx.order.create({
        data: {
          orderNumber,
          userId: payload.userId,
          addressId: validatedData.addressId,
          subtotal,
          shippingCost,
          tax,
          total,
          paymentMethod: paymentMethodMap[validatedData.paymentMethod] as 'STRIPE' | 'RAZORPAY' | 'DODO',
          status: 'PLACED',
          paymentStatus: 'PENDING',
          items: {
            createMany: {
              data: itemsWithPrices,
            },
          },
          statusHistory: {
            create: {
              status: 'PLACED',
              notes: 'Order placed successfully',
            },
          },
        },
        include: {
          items: {
            include: { product: true },
          },
          shippingAddress: true,
        },
      });

      // Clear user's cart within transaction
      await tx.cartItem.deleteMany({
        where: { userId: payload.userId },
      });
  
      return createdOrder;
    });
  
      return NextResponse.json({ order }, { status: 201 });
    } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'message' in error) {
      const message = (error as { message?: string }).message || '';
      if (message.includes('Insufficient stock') || message.includes('Product') && message.includes('not found')) {
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }
    console.error('Order creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}


