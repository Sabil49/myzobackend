// app/api/payments/dodo/return/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const APP_SCHEME = 'myzo'; // your Expo deep link scheme

/** Build a deep link back into the React Native app */
function appLink(path: string, params: Record<string, string> = {}): string {
  const qs = new URLSearchParams(params).toString();
  return `${APP_SCHEME}://${path}${qs ? '?' + qs : ''}`;
}

/** Redirect helper that gracefully handles malformed base URLs */
function redirect(url: string): NextResponse {
  return NextResponse.redirect(url);
}

// ─── GET — Dodo redirects the user's browser here after checkout ──────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Dodo appends these to the return_url:
  //   ?orderId=<your-meta>&payment_id=<dodo-id>&status=succeeded|failed|cancelled
  const orderId = searchParams.get('orderId');
  const paymentId = searchParams.get('payment_id') ?? undefined;
  const status = searchParams.get('status');

  console.log('[DODO RETURN]', { orderId, paymentId, status });

  // ── Guard: orderId must exist ──────────────────────────────────────────────
  if (!orderId) {
    console.error('[DODO RETURN] Missing orderId');
    return redirect(appLink('checkout', { error: 'missing_order_id' }));
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    console.error('[DODO RETURN] Order not found:', orderId);
    return redirect(appLink('checkout', { error: 'order_not_found' }));
  }

  // ── Handle by status ───────────────────────────────────────────────────────
  if (status === 'succeeded' || status === 'success' || status === 'completed') {
    // Idempotent — skip DB write if already marked PAID (webhook may have arrived first)
    if (order.paymentStatus !== 'PAID') {
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
          notes: `Payment confirmed via Dodo return redirect (${paymentId ?? 'no-id'})`,
        },
      });
    }

    console.log('[DODO RETURN] ✅ Payment confirmed for order:', orderId);
    // Deep-link back into the app → success screen
    return redirect(appLink('checkout/success', { orderId }));

  } else if (status === 'failed') {
    await prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: 'FAILED' },
    });
    return redirect(appLink('checkout', { error: 'payment_failed', orderId }));

  } else if (status === 'cancelled') {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: 'FAILED', // PaymentStatus enum has no CANCELLED
        status: 'CANCELLED',
      },
    });
    return redirect(appLink('checkout', { error: 'payment_cancelled', orderId }));

  } else {
    // status is null or an unexpected value — still send user back into app
    console.warn('[DODO RETURN] Unexpected status:', status);
    return redirect(appLink('checkout', { error: 'unknown_status', orderId }));
  }
}

// ─── POST — Server-to-server webhook from Dodo ────────────────────────────────
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // ── Optional: verify Dodo webhook signature ───────────────────────────────
  // Dodo uses the Standard Webhooks spec (https://standardwebhooks.com).
  // Uncomment and install `standardwebhooks` to enable in production:
  //
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

  // Dodo webhook payload shape:
  //  { event_type: "payment.succeeded", data: { payload: { payment_id, metadata, status, ... } } }
  const eventType = (body.event_type as string) ?? '';
  const data = (body.data as Record<string, unknown>) ?? {};
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
    eventType.split('.')[1]; // e.g. "payment.succeeded" → "succeeded"

  if (!orderId) {
    console.error('[DODO WEBHOOK] Missing order_id in payload');
    return NextResponse.json({ error: 'Missing order_id' }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    console.error('[DODO WEBHOOK] Order not found:', orderId);
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  if (paymentStatus === 'succeeded' || paymentStatus === 'success' || paymentStatus === 'completed') {
    if (order.paymentStatus !== 'PAID') {
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
          notes: `Payment confirmed via Dodo webhook (${paymentId ?? 'no-id'})`,
        },
      });

      console.log('[DODO WEBHOOK] ✅ Order confirmed:', orderId);
    } else {
      console.log('[DODO WEBHOOK] Order already PAID (idempotent):', orderId);
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
    console.warn('[DODO WEBHOOK] Unhandled event type / status:', eventType, paymentStatus);
  }

  // Always return 200 to acknowledge receipt
  return NextResponse.json({ received: true, orderId, event: eventType });
}