// app/api/notifications/send/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { sendPushToUser } from '@/lib/firebase-admin';
import { z } from 'zod';

const sendNotificationSchema = z.object({
  userId: z.string().cuid().optional(),
  title: z.string(),
  body: z.string(),
  data: z.record(z.string()).optional(),
  broadcast: z.boolean().optional(),
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

    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.error('JSON parse error:', error);
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const validatedData = sendNotificationSchema.parse(body);

    if (validatedData.broadcast) {
      // TODO: Implement broadcast to all users
      return NextResponse.json(
        { message: 'Broadcast not yet implemented' },
        { status: 501 }
      );
    }

    if (!validatedData.userId) {
      return NextResponse.json(
        { error: 'userId required for targeted notification' },
        { status: 400 }
      );
    }

    await sendPushToUser(validatedData.userId, {
      title: validatedData.title,
      body: validatedData.body,
      data: validatedData.data,
    });

    return NextResponse.json({ message: 'Notification sent successfully' });
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'name' in error && (error as { name?: string }).name === 'ZodError') {
      const zodError = error as z.ZodError;
      return NextResponse.json({ error: zodError.errors }, { status: 400 });
    }
    console.error('Notification send error:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}