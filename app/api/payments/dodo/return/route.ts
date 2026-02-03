import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    console.log('Dodo return called with orderId:', orderId);
    const status = searchParams.get('status'); // Dodo passes payment status
    const paymentId = searchParams.get('payment_id'); // Dodo payment ID

    if (!orderId) {
      return NextResponse.redirect(
        new URL('/checkout?error=missing_order_id', request.url)
      );
    }

    // Verify order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return NextResponse.redirect(
        new URL('/checkout?error=order_not_found', request.url)
      );
    }

    // Update order based on payment status
    if (status === 'success' || status === 'completed') {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'PAID',
          paymentIntentId: paymentId || undefined,
          status: 'CONFIRMED',
        },
      });

      // Add status history
      await prisma.orderStatusHistory.create({
        data: {
          orderId,
          status: 'CONFIRMED',
          notes: 'Payment confirmed via Dodo Payments',
        },
      });

      // Redirect to success page
      return NextResponse.redirect(
        new URL(`/checkout/success?orderId=${orderId}`, request.url)
      );
    } else {
      // Payment failed or cancelled
      await prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'FAILED',
        },
      });

      return NextResponse.redirect(
        new URL(`/checkout?error=payment_failed&orderId=${orderId}`, request.url)
      );
    }

  } catch (error) {
    console.error('Dodo payment return error:', error);
    return NextResponse.redirect(
      new URL('/checkout?error=processing_failed', request.url)
    );
  }
}

// Webhook handler for server-to-server notifications
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // TODO: Verify webhook signature
    // const signature = request.headers.get('x-dodo-signature');
    // verifyDodoSignature(body, signature);

    const { order_id, payment_status, payment_id } = body;

    if (!order_id) {
      return NextResponse.json({ error: 'Missing order_id' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: order_id },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Update order based on webhook status
    if (payment_status === 'success' || payment_status === 'completed') {
      await prisma.order.update({
        where: { id: order_id },
        data: {
          paymentStatus: 'PAID',
          paymentIntentId: payment_id,
          status: 'CONFIRMED',
        },
      });

      await prisma.orderStatusHistory.create({
        data: {
          orderId: order_id,
          status: 'CONFIRMED',
          notes: 'Payment confirmed via Dodo webhook',
        },
      });
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Dodo webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}