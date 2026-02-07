// app/api/payments/dodo/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const dodoPaymentSchema = z.object({
  orderId: z.string().cuid(),
  currency: z.string().length(3).default('USD').optional(),
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
        orderId: order.id,
        paymentId: order.paymentIntentId ?? undefined,
      }, { status: 400 });
    }
    // Derive amount from order snapshot (server source of truth)
    const totalNumber = typeof order.total === 'object' && 'toNumber' in order.total ? order.total.toNumber() : Number(order.total);
    const amountCents = Math.round(totalNumber * 100);

    if (!amountCents || amountCents <= 0) {
      return NextResponse.json({ error: 'Invalid order amount' }, { status: 400 });
    }

    const DODO_API_BASE = process.env.DODO_API_BASE || 'https://api.test.dodopayments.com';
    const DODO_CHECKOUT_BASE = process.env.DODO_CHECKOUT_URL || 'https://test.checkout.dodopayments.com';
    const DODO_API_KEY = process.env.DODO_API_KEY;
    const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://myzobackend.vercel.app';

    if (!DODO_API_KEY) {
      console.warn('DODO_API_KEY not set; falling back to simple checkout URL');
    }

    const returnUrl = `${BASE_URL}/api/payments/dodo/return?orderId=${order.id}`;

    let checkoutUrl = `${DODO_CHECKOUT_BASE}/buy/${process.env.DODO_PRODUCT_ID || 'pdt_0NXlidWhtXLoHiO2PwrTI'}?quantity=1&redirect_url=${encodeURIComponent(returnUrl)}`;

    // If API key provided, create real checkout via Dodo API
    if (DODO_API_KEY) {
      const apiUrl = `${DODO_API_BASE}/api/payment-links`;

      const payload = {
        amount: amountCents,
        currency: validatedData.currency || 'USD',
        customer_email: validatedData.customerEmail || order.userEmail || order.user?.email,
        customer_name: order.userName || `${order.user?.firstName ?? ''} ${order.user?.lastName ?? ''}`.trim(),
        metadata: {
          order_id: order.id,
          order_number: order.orderNumber,
          user_id: order.userId,
        },
        return_url: returnUrl,
        webhook_url: `${BASE_URL}/api/payments/dodo/webhook`,
      };

      console.log('Calling Dodo API:', apiUrl, 'with payload:', payload);
      
      const dodoResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DODO_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!dodoResponse.ok) {
        const errorBody = await dodoResponse.text().catch(() => null);
        console.error('Dodo API error', dodoResponse.status, 'Response:', errorBody?.substring(0, 500));
        return NextResponse.json({ error: 'Failed to create Dodo checkout', status: dodoResponse.status, details: errorBody?.substring(0, 200) }, { status: 502 });
      }

      const dodoData = await dodoResponse.json();
      console.log('Dodo API response:', dodoData);
      if (dodoData?.checkout_url) checkoutUrl = dodoData.checkout_url;
      if (dodoData?.url) checkoutUrl = dodoData.url; // Alternative field name

      // Persist Dodo payment id to order (re-using razorpayOrderId field)
      try {
        await prisma.order.update({
          where: { id: order.id },
          data: { razorpayOrderId: dodoData?.id ?? undefined },
        });
      } catch (e) {
        console.warn('Failed to persist Dodo id on order', e);
      }
    }

    return NextResponse.json({
      success: true,
      checkoutUrl,
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: totalNumber,
      currency: validatedData.currency || 'USD',
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


