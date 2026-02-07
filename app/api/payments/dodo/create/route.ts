// app/api/payments/dodo/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const dodoPaymentSchema = z.object({
  orderId: z.string().cuid(),
  amount: z.number().min(1),
  currency: z.string().length(3).default('USD'),
  customerEmail: z.string().email().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice('Bearer '.length);
    let payload;
    
    try {
      payload = verifyAccessToken(token);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = dodoPaymentSchema.parse(body);

    // Verify order exists and belongs to user
    const order = await prisma.order.findUnique({
      where: { id: validatedData.orderId },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.userId !== payload.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Verify order hasn't been paid already
    if (order.paymentStatus === 'PAID') {
      return NextResponse.json({ 
        error: 'Order has already been paid',
        paymentId: order.paymentIntentId 
      }, { status: 400 });
    }

    // TODO: Integrate with actual Dodo Payments API
    // For now, return a mock response with the checkout URL
    
    const DODO_PRODUCT_ID = process.env.DODO_PRODUCT_ID || 'pdt_0NXlidWhtXLoHiO2PwrTI';
    const DODO_CHECKOUT_BASE = process.env.DODO_CHECKOUT_URL || 'https://test.checkout.dodopayments.com';
    const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://myzobackend.vercel.app';
    
    const returnUrl = `${BASE_URL}/api/payments/dodo/return?orderId=${order.id}`;
    const checkoutUrl = `${DODO_CHECKOUT_BASE}/buy/${DODO_PRODUCT_ID}?quantity=1&redirect_url=${encodeURIComponent(returnUrl)}`;

    // Actual Dodo API integration would look like this:
    /*
    const dodoResponse = await fetch(`${DODO_CHECKOUT_BASE}/api/v1/payments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DODO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: validatedData.amount,
        currency: validatedData.currency,
        customer_email: validatedData.customerEmail || order.user.email,
        product_id: DODO_PRODUCT_ID,
        metadata: {
          order_id: order.id,
          order_number: order.orderNumber,
          user_id: order.userId,
        },
        return_url: returnUrl,
      }),
    });

    if (!dodoResponse.ok) {
      throw new Error('Failed to create Dodo payment');
    }

    const dodoData = await dodoResponse.json();
    checkoutUrl = dodoData.checkout_url;
    */

    return NextResponse.json({
      success: true,
      checkoutUrl,
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: validatedData.amount,
      currency: validatedData.currency,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Dodo payment creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    );
  }
}


