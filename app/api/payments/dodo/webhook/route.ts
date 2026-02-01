// app/api/payments/dodo/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const DODO_WEBHOOK_KEY = process.env.DODO_PAYMENTS_WEBHOOK_KEY!;

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('dodo-signature');
    
    if (!signature || !signature.startsWith(DODO_WEBHOOK_KEY)) {
      console.error('Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const body = await request.json();
    const { event, data } = body;

    console.log('Dodo webhook received:', event, data);

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

async function handlePaymentSucceeded(data: any) {
  try {
    const { orderId, amount, transactionId } = data;

    if (!orderId) {
      console.error('No orderId in payment success webhook');
      return;
    }

    // Update order status
    const order = await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: 'PAID',
        status: 'CONFIRMED',
      },
    });

    console.log('Order updated after successful payment:', order.id);

    // TODO: Send confirmation email
    // TODO: Send push notification
  } catch (error) {
    console.error('Error handling payment success:', error);
    throw error;
  }
}

async function handlePaymentFailed(data: any) {
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