// app/api/payment/dodo/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';
import { z } from 'zod';

const verifyPaymentSchema = z.object({
  paymentId: z.string(),
  providerPaymentId: z.string(),
  status: z.enum(['success', 'failed']),
  transactionId: z.string().optional(),
});

// POST /api/payment/dodo/verify - Verify Dodo payment status
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
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid token payload' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = verifyPaymentSchema.parse(body);

    // Find order by Dodo payment ID
    const order = await prisma.order.findFirst({
      where: {
        razorpayOrderId: validatedData.providerPaymentId,
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Verify order belongs to authenticated user
    if (order.userId !== payload.userId) {
      return NextResponse.json({ error: 'Unauthorized access to order' }, { status: 403 });
    }

    // Update order payment status
    const newPaymentStatus = validatedData.status === 'success' ? 'PAID' : 'FAILED';
    const newOrderStatus = validatedData.status === 'success' ? 'CONFIRMED' : 'PLACED';
    
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: newOrderStatus,
        paymentStatus: newPaymentStatus,
        razorpayPaymentId: validatedData.transactionId || undefined,
      },
    });

    // Add status history entry
    await prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: newOrderStatus,
        notes: `Payment verification: ${validatedData.status === 'success' ? 'succeeded' : 'failed'} (Transaction: ${validatedData.transactionId || 'N/A'})`,
      },
    });

    return NextResponse.json({
      payment: {
        id: validatedData.providerPaymentId,
        status: newPaymentStatus,
        orderId: order.id,
      },
      message: validatedData.status === 'success' 
        ? 'Payment verified successfully' 
        : 'Payment verification failed',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Dodo payment verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify payment' },
      { status: 500 }
    );
  }
}