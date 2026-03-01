// app/api/payments/dodo/return/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const APP_SCHEME = 'myzo';

function appLink(path: string, params: Record<string, string> = {}): string {
  const qs = new URLSearchParams(params).toString();
  return `${APP_SCHEME}://${path}${qs ? '?' + qs : ''}`;
}

/**
 * Atomically decrement stock for all items in an order.
 * Uses updateMany with stock >= quantity guard so it can never go negative.
 */
async function decrementStockForOrder(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  orderId: string,
): Promise<void> {
  const items = await tx.orderItem.findMany({
    where: { orderId },
    select: { productId: true, quantity: true },
  });

  for (const item of items) {
    const result = await tx.product.updateMany({
      where: {
        id: item.productId,
        stock: { gte: item.quantity }, // atomic guard — never go negative
      },
      data: { stock: { decrement: item.quantity } },
    });

    if (result.count === 0) {
      // Log but don't block — order is paid, fulfillment team handles stock issues
      console.error(
        `[DODO] Stock decrement failed for product ${item.productId} on order ${orderId} — needs manual review`,
      );
    }
  }
}

// ─── GET — Dodo redirects user's browser here after checkout ─────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const orderId   = searchParams.get('orderId');
  const paymentId = searchParams.get('payment_id') ?? undefined;
  const status    = searchParams.get('status');

  console.log('[DODO RETURN]', { orderId, paymentId, status });

  if (!orderId) {
    return NextResponse.redirect(appLink('checkout', { error: 'missing_order_id' }));
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    return NextResponse.redirect(appLink('checkout', { error: 'order_not_found' }));
  }

  if (status === 'succeeded' || status === 'success' || status === 'completed') {
    if (order.paymentStatus !== 'PAID') {
      await prisma.$transaction(async (tx) => {
        // ✅ Decrement stock here — only when payment is confirmed
        await decrementStockForOrder(tx, orderId);

        await tx.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: 'PAID',
            paymentIntentId: paymentId,
            status: 'CONFIRMED',
          },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId,
            status: 'CONFIRMED',
            notes: `Payment confirmed via Dodo return redirect (${paymentId ?? 'no-id'})`,
          },
        });
      });

      console.log('[DODO RETURN] ✅ Payment confirmed, stock decremented:', orderId);
    } else {
      console.log('[DODO RETURN] Order already PAID (idempotent):', orderId);
    }

    return NextResponse.redirect(appLink('checkout/success', { orderId }));

  } else if (status === 'failed') {
    // No stock change needed — was never decremented
    await prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: 'FAILED' },
    });
    return NextResponse.redirect(appLink('checkout', { error: 'payment_failed', orderId }));

  } else if (status === 'cancelled') {
    await prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: 'FAILED', status: 'CANCELLED' },
    });
    return NextResponse.redirect(appLink('checkout', { error: 'payment_cancelled', orderId }));

  } else {
    console.warn('[DODO RETURN] Unexpected status:', status);
    return NextResponse.redirect(appLink('checkout', { error: 'unknown_status', orderId }));
  }
}

// ─── POST — Server-to-server webhook from Dodo ────────────────────────────────
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // ── Optional: verify Dodo webhook signature (Standard Webhooks spec) ─────
  // import { Webhook } from 'standardwebhooks';
  // const wh = new Webhook(process.env.DODO_WEBHOOK_KEY!);
  // try {
  //   await wh.verify(rawBody, {
  //     'webhook-id':        request.headers.get('webhook-id') ?? '',
  //     'webhook-signature': request.headers.get('webhook-signature') ?? '',
  //     'webhook-timestamp': request.headers.get('webhook-timestamp') ?? '',
  //   });
  // } catch {
  //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  // }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  console.log('[DODO WEBHOOK] Received:', JSON.stringify(body, null, 2));

  const eventType   = (body.event_type as string) ?? '';
  const data        = (body.data as Record<string, unknown>) ?? {};
  const payloadData = (data.payload as Record<string, unknown>) ?? data;

  const orderId =
    (payloadData.metadata as Record<string, string> | undefined)?.order_id ??
    (body.metadata as Record<string, string> | undefined)?.order_id ??
    (body.order_id as string | undefined);

  const paymentId =
    (payloadData.payment_id as string) ??
    (body.payment_id as string) ??
    (body.id as string);

  const paymentStatus =
    (payloadData.status as string) ??
    (body.status as string) ??
    eventType.split('.')[1];

  if (!orderId) {
    return NextResponse.json({ error: 'Missing order_id' }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  if (
    paymentStatus === 'succeeded' ||
    paymentStatus === 'success' ||
    paymentStatus === 'completed'
  ) {
    if (order.paymentStatus !== 'PAID') {
      await prisma.$transaction(async (tx) => {
        // ✅ Decrement stock on payment confirmation
        await decrementStockForOrder(tx, orderId);

        await tx.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: 'PAID',
            paymentIntentId: paymentId,
            status: 'CONFIRMED',
          },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId,
            status: 'CONFIRMED',
            notes: `Payment confirmed via Dodo webhook (${paymentId ?? 'no-id'})`,
          },
        });
      });

      console.log('[DODO WEBHOOK] ✅ Order confirmed, stock decremented:', orderId);
    } else {
      console.log('[DODO WEBHOOK] Idempotent — already PAID:', orderId);
    }

  } else if (paymentStatus === 'failed') {
    await prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: 'FAILED' },
    });

  } else if (paymentStatus === 'cancelled') {
    await prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: 'FAILED', status: 'CANCELLED' },
    });

  } else {
    console.warn('[DODO WEBHOOK] Unhandled status:', eventType, paymentStatus);
  }

  return NextResponse.json({ received: true, orderId, event: eventType });
}