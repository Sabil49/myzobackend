// app/api/orders/[id]/status/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';
import { updateOrderStatusSchema } from '@/lib/validators/order';
import { sendPushToUser } from '@/lib/firebase-admin';
import { ZodError } from 'zod';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyAccessToken(token);
    if (payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = updateOrderStatusSchema.parse(body);

    const order = await prisma.order.update({
      where: { id: params.id },
      data: {
        status: validatedData.status,
        trackingNumber: validatedData.trackingNumber,
        carrier: validatedData.carrier,
        statusHistory: {
          create: {
            status: validatedData.status,
            notes: validatedData.notes,
          },
        },
      },
      include: {
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // Send push notification
    const statusMessages: Record<string, string> = {
      CONFIRMED: 'Your order has been confirmed',
      PROCESSING: 'Your order is being prepared',
      SHIPPED: `Your order has been shipped${validatedData.trackingNumber ? ` (Tracking: ${validatedData.trackingNumber})` : ''}`,
      DELIVERED: 'Your order has been delivered',
    };

    if (statusMessages[validatedData.status]) {
      await sendPushToUser(order.userId, {
        title: 'Order Update',
        body: statusMessages[validatedData.status],
        data: {
          type: 'order_status',
          orderId: order.id,
        },
      });
    }

    return NextResponse.json({ order });
  } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'name' in error && (error as { name?: string }).name === 'ZodError') {
        const zodError = error as ZodError;
        return NextResponse.json({ error: zodError.errors }, { status: 400 });
      }
    console.error('Order status update error:', error);
    return NextResponse.json(
      { error: 'Failed to update order status' },
      { status: 500 }
    );
  }
}