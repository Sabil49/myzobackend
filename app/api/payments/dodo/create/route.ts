// app/api/payments/dodo/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';

const DODO_API_KEY = process.env.DODO_PAYMENTS_API_KEY!;
const DODO_RETURN_URL = process.env.DODO_PAYMENTS_RETURN_URL!;
const DODO_ENVIRONMENT = process.env.DODO_PAYMENTS_ENVIRONMENT || 'test_mode';

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
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { amount, orderId, items } = body;

    if (!amount || !orderId) {
      return NextResponse.json(
        { error: 'Amount and orderId are required' },
        { status: 400 }
      );
    }

    // Create Dodo Payments checkout session
    const checkoutUrl = `https://${DODO_ENVIRONMENT === 'test_mode' ? 'test.' : ''}checkout.dodopayments.com/buy/pdt_ctSjb2435t8p2c1vQcx98?quantity=1&redirect_url=${encodeURIComponent(DODO_RETURN_URL + '?orderId=' + orderId)}`;

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