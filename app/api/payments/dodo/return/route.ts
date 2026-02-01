// app/api/payments/dodo/return/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.redirect(new URL('/orders?error=missing_order_id', request.url));
    }

    // Verify order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return NextResponse.redirect(new URL('/orders?error=order_not_found', request.url));
    }

    // Redirect based on status
    if (order.paymentStatus === 'PAID') {
      return NextResponse.redirect(
        new URL(`/order-success?orderId=${orderId}`, request.url)
      );
    } else if (order.paymentStatus === 'FAILED') {
      return NextResponse.redirect(
        new URL(`/order-cancelled?orderId=${orderId}`, request.url)
      );
    } else {
      // Payment pending or in other state - show order details
      return NextResponse.redirect(
        new URL(`/orders/${orderId}`, request.url)
      );
    }
  } catch (error) {
    console.error('Payment return handler error:', error);
    return NextResponse.redirect(new URL('/orders?error=processing_error', request.url));
  }
}