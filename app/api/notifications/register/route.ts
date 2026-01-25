import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';
import { z } from 'zod';

const registerTokenSchema = z.object({
  token: z.string(),
  platform: z.enum(['ios', 'android']),
});

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
      console.error('Token verification failed:', error);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.error('JSON parse error:', error);
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const validatedData = registerTokenSchema.parse(body);

    // Upsert FCM token
    await prisma.fCMToken.upsert({
      where: { token: validatedData.token },
      create: {
        userId: payload.userId,
        token: validatedData.token,
        platform: validatedData.platform,
      },
      update: {
        userId: payload.userId,
        platform: validatedData.platform,
      },
    });

    return NextResponse.json({ message: 'Token registered successfully' });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Token registration error:', error);
    return NextResponse.json(
      { error: 'Failed to register token' },
      { status: 500 }
    );
  }
}