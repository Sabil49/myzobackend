// app/api/payments/dodo/create-checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createCheckoutSchema = z.object({
  orderId: z.string().cuid(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId } = createCheckoutSchema.parse(body);

    // ── 1. Load order ────────────────────────────────────────────────────────
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: { email: true, firstName: true, lastName: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (order.paymentStatus === 'PAID') {
      return NextResponse.json({ error: 'Order already paid', orderId }, { status: 400 });
    }
    if (order.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Order is cancelled', orderId }, { status: 400 });
    }

    // ── 2. Derive total from DB (never trust the client) ─────────────────────
    const totalNumber =
      typeof order.total === 'object' && order.total !== null && 'toNumber' in order.total
        ? (order.total as { toNumber(): number }).toNumber()
        : Number(order.total);

    const amountCents = Math.round(totalNumber * 100);
    if (!amountCents || amountCents <= 0) {
      return NextResponse.json({ error: 'Invalid order amount' }, { status: 400 });
    }

    // ── 3. Config ─────────────────────────────────────────────────────────────
    const DODO_API_KEY = process.env.DODO_API_KEY;
    if (!DODO_API_KEY) {
      return NextResponse.json({ error: 'DODO_API_KEY not configured' }, { status: 500 });
    }

    const DODO_PRODUCT_ID = process.env.DODO_PRODUCT_ID || 'pdt_0NXlidWhtXLoHiO2PwrTI';
    const DODO_ENVIRONMENT = process.env.DODO_ENVIRONMENT || 'test';
    const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://myzobackend.vercel.app';

    // Dodo uses different base URLs per environment
    const DODO_API_BASE =
      DODO_ENVIRONMENT === 'live'
        ? 'https://live.dodopayments.com'
        : 'https://test.dodopayments.com';

    // ── 4. Build checkout session payload ─────────────────────────────────────
    //
    // KEY FIX: pass `unit_amount` inside each product_cart item to override
    // the product's fixed dashboard price with the real cart total.
    // Dodo accepts unit_amount in the lowest denomination (cents for USD).
    //
    const customerEmail = order.userEmail ?? order.user?.email ?? '';
    const customerName =
      (order.userName ??
      `${order.user?.firstName ?? ''} ${order.user?.lastName ?? ''}`.trim()) ||
      'Customer';

    const returnUrl = `${BASE_URL}/api/payments/dodo/return?orderId=${order.id}`;

    const payload = {
      product_cart: [
        {
          product_id: DODO_PRODUCT_ID,
          quantity: 1,
          // ✅ Dynamic price override via "Pay What You Want" — amount in cents (e.g. $62.80 = 6280)
          // Requires "Pay What You Want" to be ENABLED on this product in the Dodo dashboard.
          // Dashboard → Products → your product → Edit → enable Pay What You Want
          amount: amountCents,
        },
      ],
      customer: {
        email: customerEmail,
        name: customerName,
      },
      // billing_address is optional with the new Checkout Sessions API;
      // Dodo collects it during checkout if omitted.
      return_url: returnUrl,
      metadata: {
        order_id: order.id,
        order_number: order.orderNumber ?? '',
        user_id: order.userId ?? '',
        amount_cents: amountCents.toString(),
      },
    };

    // ── 5. Create checkout session ────────────────────────────────────────────
    // Endpoint: POST /checkouts  (Checkout Sessions API)
    const apiUrl = `${DODO_API_BASE}/checkouts`;

    console.log('[DODO] Creating checkout session:', apiUrl);
    console.log('[DODO] Environment:', DODO_ENVIRONMENT);
    console.log('[DODO] Amount (cents):', amountCents);

    let dodoResponse: Response;
    try {
      dodoResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${DODO_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (fetchError) {
      console.error('[DODO] Network error:', fetchError);
      return NextResponse.json(
        {
          error: 'Failed to reach Dodo API',
          details: fetchError instanceof Error ? fetchError.message : 'Unknown',
        },
        { status: 502 },
      );
    }

    console.log('[DODO] Response status:', dodoResponse.status);

    if (!dodoResponse.ok) {
      const errorBody = await dodoResponse.text().catch(() => '(unreadable)');
      console.error('[DODO] Error body:', errorBody.substring(0, 1000));
      return NextResponse.json(
        {
          error: 'Dodo API rejected the request',
          status: dodoResponse.status,
          details: errorBody.substring(0, 500),
        },
        { status: dodoResponse.status >= 400 && dodoResponse.status < 500 ? 400 : 502 },
      );
    }

    const dodoData = await dodoResponse.json();
    console.log('[DODO] Session created:', JSON.stringify(dodoData, null, 2));

    // ── 6. Extract checkout URL ───────────────────────────────────────────────
    // New Checkout Sessions API returns `checkout_url`; older payments API returns `url`.
    const checkoutUrl =
      dodoData?.checkout_url ??
      dodoData?.url ??
      dodoData?.payment_link ??
      dodoData?.checkoutUrl;

    if (!checkoutUrl) {
      console.error('[DODO] No checkout URL in response:', dodoData);
      return NextResponse.json(
        { error: 'No checkout URL in Dodo response', response: dodoData },
        { status: 502 },
      );
    }

    // ── 7. Persist session ID on the order ───────────────────────────────────
    const sessionId = dodoData?.session_id ?? dodoData?.id;
    if (sessionId) {
      await prisma.order.update({
        where: { id: order.id },
        data: { razorpayOrderId: sessionId },
      }).catch((e) => console.warn('[DODO] Could not persist session ID:', e));
    }

    return NextResponse.json({
      success: true,
      checkoutUrl,
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: totalNumber,
      amountCents,
      currency: 'USD',
      sessionId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }
    console.error('[DODO] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}