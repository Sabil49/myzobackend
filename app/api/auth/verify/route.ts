// app/api/auth/verify/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ 
        error: 'No token provided',
        headers: Object.fromEntries(request.headers.entries())
      }, { status: 401 });
    }

    console.log('Verifying token:', token.substring(0, 20) + '...');
    
    const payload = verifyAccessToken(token);
    
    return NextResponse.json({
      success: true,
      payload,
      message: 'Token is valid'
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('Token verification failed:', error.message);
      return NextResponse.json({
        error: 'Token verification failed',
        message: error.message
      }, { status: 401 });
    }
    return NextResponse.json({
      error: 'Unknown error'
    }, { status: 500 });
  }
}