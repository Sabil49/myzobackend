// app/api/payments/dodo/create-checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createCheckoutSchema = z.object({
  orderId: z.string().cuid(),
});

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validatedData = createCheckoutSchema.parse(body);

    // Fetch order with user info
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

    // Note: checkout is initiated by the client using an orderId returned
    // from the server when the order was created. This endpoint is intentionally
    // permissive so mobile/web clients can redirect the user to the Dodo
    // checkout page without requiring an additional auth header.

    // Prevent checkout for already paid orders
    if (order.paymentStatus === 'PAID') {
      return NextResponse.json({ 
        error: 'Order has already been paid',
        orderId: order.id,
      }, { status: 400 });
    }

    // Prevent checkout for cancelled orders
    if (order.status === 'CANCELLED') {
      return NextResponse.json({ 
        error: 'Cannot pay for a cancelled order',
        orderId: order.id,
      }, { status: 400 });
    }

    // Derive amount from order (server source of truth)
    const totalNumber = typeof order.total === 'object' && 'toNumber' in order.total ? order.total.toNumber() : Number(order.total);
    const amountCents = Math.round(totalNumber * 100);

    if (!amountCents || amountCents <= 0) {
      return NextResponse.json({ error: 'Invalid order amount' }, { status: 400 });
    }

    // Get Dodo configuration
    const DODO_API_BASE = process.env.DODO_API_BASE || 'https://api.test.dodopayments.com';
    const DODO_CHECKOUT_BASE = process.env.DODO_CHECKOUT_URL || 'https://test.checkout.dodopayments.com';
    const DODO_API_KEY = process.env.DODO_API_KEY;
    const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://myzobackend.vercel.app';
    
    // Build return URL with order ID
    const returnUrl = `${BASE_URL}/api/payments/dodo/return?orderId=${order.id}`;
    
    let checkoutUrl = `${DODO_CHECKOUT_BASE}/buy/${process.env.DODO_PRODUCT_ID || 'pdt_0NXlidWhtXLoHiO2PwrTI'}?quantity=1&redirect_url=${encodeURIComponent(returnUrl)}`;

    if (!DODO_API_KEY) {
      console.warn('DODO_API_KEY not set; falling back to simple checkout URL');
    }

    // Call Dodo API to create checkout with proper amount
    if (DODO_API_KEY) {
      const apiUrl = `${DODO_API_BASE}/api/payment-links`;

      const payload = {
        amount: amountCents,
        currency: 'USD',
        customer_email: order.userEmail || order.user?.email,
        customer_name: order.userName || `${order.user?.firstName ?? ''} ${order.user?.lastName ?? ''}`.trim(),
        metadata: {
          order_id: order.id,
          order_number: order.orderNumber,
          user_id: order.userId,
        },
        return_url: returnUrl,
        webhook_url: `${BASE_URL}/api/payments/dodo/webhook`,
      };

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

      // Persist Dodo payment id to order
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
      amount: typeof order.total === 'object' && 'toNumber' in order.total ? order.total.toNumber() : order.total,
      currency: 'USD',
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Dodo checkout creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout' },
      { status: 500 }
    );
  }
}
