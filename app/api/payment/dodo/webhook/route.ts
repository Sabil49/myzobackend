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
      const payment = await prisma.payment.findFirst({
        where: {
          providerPaymentId: payment_id,
          provider: 'DODO',
        },
      });

      if (!payment) {
        return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
      }

      const newStatus = status === 'completed' ? 'PAID' : 'FAILED';

      // Update payment
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: newStatus,
          providerTransactionId: transaction_id,
          paidAt: status === 'completed' ? new Date() : null,
        },
      });

      // Update order
      await prisma.order.update({
        where: { id: payment.orderId },
        data: {
          status: status === 'completed' ? 'CONFIRMED' : 'PLACED',
          paymentStatus: newStatus,
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