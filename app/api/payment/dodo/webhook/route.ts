// app/api/payment/dodo/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/payment/dodo/webhook - Handle Dodo payment webhooks
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Verify webhook signature (implement based on Dodo's documentation)
    // TODO: Implement signature verification
    // const signature = request.headers.get('x-dodo-signature');
    // if (!verifyDodoSignature(body, signature)) {
    //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    // }

    const { payment_id, status, transaction_id, event_type } = body;

    if (event_type === 'payment.completed' || event_type === 'payment.failed') {
      // Find order by Dodo payment ID (stored in razorpayOrderId field)
      const order = await prisma.order.findFirst({
        where: {
          razorpayOrderId: payment_id,
        },
      });

      if (!order) {
        console.warn('Order not found for payment:', payment_id);
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      const newPaymentStatus = status === 'completed' ? 'PAID' : 'FAILED';
      const newOrderStatus = status === 'completed' ? 'CONFIRMED' : 'PLACED';

      // Update order
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: newOrderStatus,
          paymentStatus: newPaymentStatus,
          razorpayPaymentId: transaction_id || undefined, // Store transaction ID
        },
      });

      // Add status history entry
      await prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: newOrderStatus as any,
          notes: `Dodo payment ${status === 'completed' ? 'succeeded' : 'failed'} (ID: ${payment_id})`,
        },
      });
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