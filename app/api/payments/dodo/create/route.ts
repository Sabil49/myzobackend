// app/api/payments/dodo/create/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { dodoPaymentSchema } from '@/lib/validators/payment';
import { z } from 'zod';

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    verifyAccessToken(token);
    const body = await request.json();
        const validatedData = dodoPaymentSchema.parse(body);
    
        // TODO: Integrate with Dodo Payments API
        // const dodoResponse = await fetch('DODO_API_URL', {
        //   method: 'POST',
        //   headers: {
        //     'Authorization': `Bearer ${process.env.DODO_API_KEY}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify(validatedData),
    // });
    
        return NextResponse.json({
          success: true,
          paymentId: 'dodo_' + Date.now(), // Replace with actual Dodo payment ID
          // Add other Dodo response fields
          validatedData, // Include validatedData in the response to use the variable
        });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Dodo payment error:', error);
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    );
  }
}