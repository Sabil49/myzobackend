// app/api/payments/dodo/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Validate required environment variables at startup
const validateDodoConfig = () => {
  const dodoReturnUrl = process.env.DODO_PAYMENTS_RETURN_URL;
  if (!dodoReturnUrl) {
    throw new Error('Missing required environment variable: DODO_PAYMENTS_RETURN_URL');
  }
  return {
    returnUrl: dodoReturnUrl,
    environment: process.env.DODO_PAYMENTS_ENVIRONMENT || 'test_mode',
    productId: process.env.DODO_PRODUCT_ID || 'pdt_ctSjb2435t8p2c1vQcx98',
  };
};

let dodoConfig: ReturnType<typeof validateDodoConfig>;
try {
  dodoConfig = validateDodoConfig();
} catch (error) {
  console.error('Dodo Payments configuration error:', error);
  throw error;
}

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
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { amount, orderId, productId } = body;

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      );
    }
    
    if (typeof orderId !== 'string' || !orderId.trim()) {
      return NextResponse.json(
        { error: 'Valid orderId is required' },
        { status: 400 }
      );
    }

    // Load the order and verify ownership
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Enforce authorization: ensure the order belongs to the authenticated user
    if (order.userId !== payload.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Create Dodo Payments checkout session
    const productIdToUse = productId || dodoConfig.productId;
    const redirectUrl = dodoConfig.returnUrl + '?orderId=' + encodeURIComponent(orderId);
    const checkoutUrl = `https://${dodoConfig.environment === 'test_mode' ? 'test.' : ''}checkout.dodopayments.com/buy/${productIdToUse}?quantity=1&redirect_url=${encodeURIComponent(redirectUrl)}`;

    return NextResponse.json({
      checkoutUrl,
      orderId,
    });
  } catch (error) {
    console.error('Dodo payment creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    );
  }
}