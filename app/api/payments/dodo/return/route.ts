// app/api/payments/dodo/return/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Dodo sends these exact parameters (based on your screenshot)
    const orderId = searchParams.get('orderId');
    const paymentId = searchParams.get('payment_id');
    const status = searchParams.get('status'); // "succeeded", "failed", "cancelled"

    console.log('Dodo return called:', { orderId, paymentId, status });

    if (!orderId) {
      console.error('Missing orderId in return URL');
      return NextResponse.redirect(
        new URL('/checkout?error=missing_order_id', request.url)
      );
    }

    // Verify order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      console.error('Order not found:', orderId);
      return NextResponse.redirect(
        new URL('/checkout?error=order_not_found', request.url)
      );
    }

    // Handle payment status
    if (status === 'succeeded' || status === 'success' || status === 'completed') {
      console.log('Processing successful payment for order:', orderId);
      
      // Update order to PAID and CONFIRMED
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
          notes: `Payment confirmed via Dodo Payments (${paymentId})`,
        },
      });

      console.log('✅ Order payment confirmed:', orderId);

      // Redirect to success page in your React Native app
      // The app should handle this deep link
      return NextResponse.redirect(
        new URL(`myzo://checkout/success?orderId=${orderId}`, request.url)
      );
      
    } else if (status === 'failed') {
      console.log('Payment failed for order:', orderId);
      
      await prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'FAILED',
        },
      });

      return NextResponse.redirect(
        new URL(`myzo://checkout?error=payment_failed&orderId=${orderId}`, request.url)
      );
      
    } else if (status === 'cancelled') {
      console.log('Payment cancelled for order:', orderId);
      
      // Update payment status to FAILED (since CANCELLED doesn't exist in PaymentStatus enum)
      // and order status to CANCELLED (which exists in OrderStatus enum)
      await prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'FAILED', // Use FAILED instead of CANCELLED
          status: 'CANCELLED',      // This one is fine - exists in OrderStatus
        },
      });

      return NextResponse.redirect(
        new URL(`myzo://checkout?error=payment_cancelled&orderId=${orderId}`, request.url)
      );
      
    } else {
      console.log('Unknown payment status:', status);
      return NextResponse.redirect(
        new URL(`myzo://checkout?error=unknown_status&orderId=${orderId}`, request.url)
      );
    }

  } catch (error) {
    console.error('Dodo payment return error:', error);
    return NextResponse.redirect(
      new URL('myzo://checkout?error=processing_failed', request.url)
    );
  }
}

// Webhook handler for server-to-server notifications
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('Dodo webhook received:', body);

    // Extract data from webhook payload
    const orderId = body.metadata?.order_id || body.order_id;
    const paymentId = body.payment_id || body.id;
    const paymentStatus = body.status || body.payment_status;

    if (!orderId) {
      console.error('Missing order_id in webhook payload');
      return NextResponse.json({ error: 'Missing order_id' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      console.error('Order not found:', orderId);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Update order based on webhook status
    if (paymentStatus === 'succeeded' || paymentStatus === 'success' || paymentStatus === 'completed') {
      console.log('Webhook: Processing successful payment for order:', orderId);
      
      await prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'PAID',
          paymentIntentId: paymentId,
          status: 'CONFIRMED',
        },
      });

      await prisma.orderStatusHistory.create({
        data: {
          orderId,
          status: 'CONFIRMED',
          notes: 'Payment confirmed via Dodo webhook',
        },
      });

      console.log('✅ Webhook: Order payment confirmed:', orderId);
    } else if (paymentStatus === 'failed') {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'FAILED',
        },
      });
    } else if (paymentStatus === 'cancelled') {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'FAILED', // Use FAILED instead of CANCELLED
          status: 'CANCELLED',      // Order status can be CANCELLED
        },
      });
    }

    return NextResponse.json({ received: true, orderId });

  } catch (error) {
    console.error('Dodo webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}