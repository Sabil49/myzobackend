// app/api/payments/dodo/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';

interface DodoPaymentData {
  orderId: string;
  reason?: string;
}

// Validate required environment variable at startup
const DODO_WEBHOOK_KEY = process.env.DODO_PAYMENTS_WEBHOOK_KEY;
if (!DODO_WEBHOOK_KEY) {
  throw new Error('Missing required environment variable: DODO_PAYMENTS_WEBHOOK_KEY');
}

// Constant-time comparison function
const constantTimeCompare = (a: Buffer, b: Buffer): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
};

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('dodo-signature');
    
    if (!signature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Read the raw request body as text
    const rawBody = await request.text();
    
    // Compute expected HMAC-SHA256 signature
    const expectedSignature = createHmac('sha256', DODO_WEBHOOK_KEY!)
      .update(rawBody)
      .digest();

    const isValid = constantTimeCompare(
      Buffer.from(signature, 'hex'),
      expectedSignature
    );

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const { event, data } = body;

    console.log('Dodo webhook received:', event, 'orderId:', data?.orderId);
    switch (event) {
      case 'payment.succeeded':
        await handlePaymentSucceeded(data);
        break;
      case 'payment.failed':
        await handlePaymentFailed(data);
        break;
      default:
        console.log('Unhandled webhook event:', event);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Dodo webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handlePaymentSucceeded(data: DodoPaymentData) {
  try {
    const { orderId } = data;

    if (!orderId) {
      console.error('No orderId in payment success webhook');
      return;
    }

    // Update order status
    // Update order status only if in expected state
    const order = await prisma.order.updateMany({
      where: { 
        id: orderId,
        paymentStatus: 'PENDING',  // Only update if still pending
      },
      data: {
        paymentStatus: 'PAID',
        status: 'CONFIRMED',
      },
    });

    if (order.count === 0) {
      console.warn('Order not updated (not found or not pending):', orderId);
      return;
    }

    console.log('Order updated after successful payment:', orderId);

    // TODO: Send confirmation email
    // TODO: Send push notification
  } catch (error) {
    console.error('Error handling payment success:', error);
    throw error;
  }
}

async function handlePaymentFailed(data: DodoPaymentData) {
  try {
    const { orderId, reason } = data;

    if (!orderId) {
      console.error('No orderId in payment failed webhook');
      return;
    }

    // Update order status
    await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: 'FAILED',
      },
    });

    console.log('Order marked as payment failed:', orderId, reason);

    // TODO: Send notification to user about payment failure
  } catch (error) {
    console.error('Error handling payment failure:', error);
    throw error;
  }
}

