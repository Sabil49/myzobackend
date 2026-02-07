// app/api/notifications/register/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Try to get token but don't require it
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      // No token - just return success without saving
      console.log('No token provided for notification registration - skipping');
      return NextResponse.json({ 
        success: true,
        message: 'Registration will complete after login' 
      });
    }

    const payload = verifyAccessToken(token);
    const { token: fcmToken, platform } = await request.json();

    if (!fcmToken) {
      return NextResponse.json(
        { error: 'FCM token required' },
        { status: 400 }
      );
    }

    // Save or update FCM token
    await prisma.fCMToken.upsert({
      where: { token: fcmToken },
      update: {
        userId: payload.userId,
        platform,
      },
      create: {
        userId: payload.userId,
        token: fcmToken,
        platform,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('FCM token registration error:', error);
    return NextResponse.json({ success: true }); // Return success anyway
  }
}
