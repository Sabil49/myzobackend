// app/api/payments/dodo/create-checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createCheckoutSchema = z.object({
  orderId: z.string().cuid(),
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

    // Verify order belongs to authenticated user (or user is null and by extension order still valid)
    if (order.userId && order.userId !== payload.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
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

    // Get Dodo configuration
    const DODO_PRODUCT_ID = process.env.DODO_PRODUCT_ID || 'pdt_0NXlidWhtXLoHiO2PwrTI';
    const DODO_CHECKOUT_BASE = process.env.DODO_CHECKOUT_URL || 'https://test.checkout.dodopayments.com';
    const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://myzobackend.vercel.app';
    
    // Build return URL with order ID
    const returnUrl = `${BASE_URL}/api/payments/dodo/return?orderId=${order.id}`;
    
    // Build Dodo checkout URL
    // Note: In production, integrate with actual Dodo API to create payment intent
    // For now, using the direct checkout URL pattern
    const checkoutUrl = `${DODO_CHECKOUT_BASE}/buy/${DODO_PRODUCT_ID}?quantity=1&redirect_url=${encodeURIComponent(returnUrl)}`;

    // TODO: Integrate with actual Dodo Payments API
    // This should call: POST to Dodo API with order details
    /*
    const dodoResponse = await fetch(`${DODO_CHECKOUT_BASE}/api/v1/checkout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DODO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(order.total.toNumber() * 100), // Convert to cents
        currency: 'USD',
        customer_email: order.userEmail || order.user?.email,
        customer_name: order.userName || `${order.user?.firstName} ${order.user?.lastName}`,
        metadata: {
          order_id: order.id,
          order_number: order.orderNumber,
          user_id: order.userId,
        },
        return_url: returnUrl,
        webhook_url: `${BASE_URL}/api/payments/dodo/webhook`,
      }),
    });

    if (!dodoResponse.ok) {
      const errorData = await dodoResponse.json();
      throw new Error(`Dodo API error: ${errorData.message || 'Unknown error'}`);
    }

    const dodoData = await dodoResponse.json();
    const checkoutUrl = dodoData.checkout_url;

    // Store the Dodo order ID on the order for webhook verification
    await prisma.order.update({
      where: { id: order.id },
      data: { razorpayOrderId: dodoData.id }, // Reusing razorpayOrderId field for Dodo payment ID
    });
    */

    return NextResponse.json({
      success: true,
      checkoutUrl,
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: order.total,
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
