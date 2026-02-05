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

    // Find payment and verify it belongs to user's order
    const payment = await prisma.payment.findFirst({
      where: {
        id: validatedData.paymentId,
        providerPaymentId: validatedData.providerPaymentId,
        provider: 'DODO',
      },
      include: {
        order: true,
      },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    if (payment.order.userId !== payload.userId) {
      return NextResponse.json({ error: 'Unauthorized access to payment' }, { status: 403 });
    }

    // Update payment status
    const newPaymentStatus = validatedData.status === 'success' ? 'PAID' : 'FAILED';
    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: newPaymentStatus,
        providerTransactionId: validatedData.transactionId,
        paidAt: validatedData.status === 'success' ? new Date() : null,
      },
    });

    // Update order status if payment successful
    if (validatedData.status === 'success') {
      await prisma.order.update({
        where: { id: payment.orderId },
        data: {
          status: 'CONFIRMED',
          paymentStatus: 'PAID',
        },
      });
    } else {
      await prisma.order.update({
        where: { id: payment.orderId },
        data: {
          paymentStatus: 'FAILED',
        },
      });
    }

    return NextResponse.json({
      payment: {
        id: updatedPayment.id,
        status: updatedPayment.status,
        orderId: updatedPayment.orderId,
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