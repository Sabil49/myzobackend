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
    const DODO_CHECKOUT_BASE = process.env.DODO_CHECKOUT_URL || 'https://test.checkout.dodopayments.com';
    const DODO_PRODUCT_ID = process.env.DODO_PRODUCT_ID || 'pdt_0NXlidWhtXLoHiO2PwrTI';
    const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://myzobackend.vercel.app';
    
    // Build return URL with order ID
    const returnUrl = `${BASE_URL}/api/payments/dodo/return?orderId=${order.id}`;
    
    // Build Dodo checkout URL with product and custom parameters
    // Dodo uses a product-based checkout system where you pass parameters in the URL
    const checkoutParams = new URLSearchParams({
      redirect_url: returnUrl,
      customer_email: order.userEmail || order.user?.email || '',
      customer_name: order.userName || `${order.user?.firstName ?? ''} ${order.user?.lastName ?? ''}`.trim(),
      // Dodo accepts metadata as prefixed parameters
      'metadata[order_id]': order.id,
      'metadata[order_number]': order.orderNumber,
      'metadata[user_id]': order.userId || '',
      'metadata[amount_cents]': amountCents.toString(),
    });
    
    const checkoutUrl = `${DODO_CHECKOUT_BASE}/buy/${DODO_PRODUCT_ID}?${checkoutParams.toString()}`;
    
    console.log('[DODO] Generated checkout URL for order:', order.id);
    console.log('[DODO] Amount:', amountCents, 'cents ($' + (amountCents/100).toFixed(2) + ')');
    console.log('[DODO] Customer:', order.userEmail || order.user?.email);
    
    // Note: Dodo doesn't have a payment-links API endpoint
    // The checkout is handled entirely through their hosted checkout page
    // The amount is controlled by your product configuration in Dodo dashboard
    // You may need to use variable pricing or create multiple products if you need different amounts

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