// app/api/payment/dodo/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';
import { z } from 'zod';

const dodoPaymentSchema = z.object({
  orderId: z.string(),
  amount: z.number().positive(),
  currency: z.string().default('USD'),
  returnUrl: z.string().url().optional(),
});

// POST /api/payment/dodo - Initiate Dodo payment
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
    const validatedData = dodoPaymentSchema.parse(body);

    // Verify order exists and belongs to user
    const order = await prisma.order.findFirst({
      where: {
        id: validatedData.orderId,
        userId: payload.userId,
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Check if payment already exists for this order
    const existingPayment = await prisma.payment.findFirst({
      where: {
        orderId: validatedData.orderId,
        provider: 'DODO',
      },
    });

    if (existingPayment && existingPayment.status === 'PAID') {
      return NextResponse.json(
        { error: 'Order already paid' },
        { status: 400 }
      );
    }

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        orderId: validatedData.orderId,
        amount: validatedData.amount,
        currency: validatedData.currency,
        provider: 'DODO',
        status: 'PENDING',
        providerPaymentId: `dodo_${Date.now()}_${order.id}`,
      },
    });

    // Generate Dodo payment URL (mock implementation)
    const dodoPaymentUrl = `https://pay.dodo.com/checkout?payment_id=${payment.providerPaymentId}&amount=${validatedData.amount}&currency=${validatedData.currency}&return_url=${validatedData.returnUrl || ''}`;

    return NextResponse.json({
      payment: {
        id: payment.id,
        paymentUrl: dodoPaymentUrl,
        providerPaymentId: payment.providerPaymentId,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Dodo payment error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate payment' },
      { status: 500 }
    );
  }
}