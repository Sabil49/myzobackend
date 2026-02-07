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

    // Fetch order with user info and address
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
    const totalNumber = typeof order.total === 'object' && 'toNumber' in order.total 
      ? order.total.toNumber() 
      : Number(order.total);
    const amountCents = Math.round(totalNumber * 100);

    if (!amountCents || amountCents <= 0) {
      return NextResponse.json({ error: 'Invalid order amount' }, { status: 400 });
    }

    // Get Dodo configuration
    const DODO_API_KEY = process.env.DODO_API_KEY;
    const DODO_PRODUCT_ID = process.env.DODO_PRODUCT_ID || 'pdt_0NXlidWhtXLoHiO2PwrTI';
    const DODO_ENVIRONMENT = process.env.DODO_ENVIRONMENT || 'test'; // 'test' or 'live'
    const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://myzobackend.vercel.app';
    
    // Dodo uses different base URLs for test vs live
    const DODO_API_BASE = DODO_ENVIRONMENT === 'live' 
      ? 'https://live.dodopayments.com'
      : 'https://test.dodopayments.com';
    
    if (!DODO_API_KEY) {
      return NextResponse.json({ 
        error: 'Dodo API key not configured',
        details: 'DODO_API_KEY environment variable is required'
      }, { status: 500 });
    }

    // Build return URL with order ID
    const returnUrl = `${BASE_URL}/api/payments/dodo/return?orderId=${order.id}`;

    // Prepare billing information
    const billing = {
      city: 'N/A',
      country: 'US',
      state: 'N/A',
      street: 'N/A',
      zipcode: '00000',
    };

    // Prepare customer information (simple format - just email and name)
    const customerEmail = order.userEmail || order.user?.email || '';
    const customerName = order.userName || `${order.user?.firstName ?? ''} ${order.user?.lastName ?? ''}`.trim();

    // Prepare product cart
    const productCart = [{
      product_id: DODO_PRODUCT_ID,
      quantity: 1,
    }];

    // Call Dodo Checkouts API
    const apiUrl = `${DODO_API_BASE}/checkouts`;
    
    const payload = {
      product_cart: productCart,
      customer: {
        email: customerEmail,
        name: customerName,
      },
      billing,
      return_url: returnUrl,
      metadata: {
        order_id: order.id,
        order_number: order.orderNumber,
        user_id: order.userId || '',
        amount_cents: amountCents.toString(),
      },
    };

    console.log('[DODO] Calling Checkouts API:', apiUrl);
    console.log('[DODO] Environment:', DODO_ENVIRONMENT);
    console.log('[DODO] Request payload:', JSON.stringify(payload, null, 2));

    let dodoResponse;
    try {
      dodoResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DODO_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (fetchError) {
      console.error('[DODO] Fetch error:', fetchError);
      return NextResponse.json({
        error: 'Failed to connect to Dodo API',
        details: fetchError instanceof Error ? fetchError.message : 'Unknown error',
        apiUrl,
      }, { status: 502 });
    }

    console.log('[DODO] Response status:', dodoResponse.status);

    if (!dodoResponse.ok) {
      const errorBody = await dodoResponse.text().catch(() => null);
      console.error('[DODO] Error response body:', errorBody?.substring(0, 1000));
      return NextResponse.json({
        error: 'Failed to create Dodo checkout',
        status: dodoResponse.status,
        apiUrl,
        details: errorBody?.substring(0, 500),
      }, { status: dodoResponse.status });
    }

    const dodoData = await dodoResponse.json();
    console.log('[DODO] API response:', JSON.stringify(dodoData, null, 2));

    // Extract checkout URL from response
    // Dodo returns `url` field for the checkout session
    const checkoutUrl = dodoData?.url || dodoData?.checkout_url || dodoData?.payment_link;

    if (!checkoutUrl) {
      console.error('[DODO] No checkout URL in response:', dodoData);
      return NextResponse.json({
        error: 'Invalid response from Dodo API',
        details: 'No checkout URL returned',
        response: dodoData,
      }, { status: 502 });
    }

    // Persist Dodo session ID to order
    try {
      await prisma.order.update({
        where: { id: order.id },
        data: { 
          razorpayOrderId: dodoData?.session_id || dodoData?.id || undefined 
        },
      });
      console.log('[DODO] Persisted session ID:', dodoData?.session_id || dodoData?.id);
    } catch (e) {
      console.warn('[DODO] Failed to persist Dodo session ID on order', e);
    }

    return NextResponse.json({
      success: true,
      checkoutUrl,
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: totalNumber,
      currency: 'USD',
      sessionId: dodoData?.session_id || dodoData?.id,
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
      { error: 'Failed to create checkout', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}