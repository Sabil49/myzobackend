// lib/firebase-admin.ts
import { prisma } from './prisma';
import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export const messaging = admin.messaging();

export async function sendPushToUser(
  userId: string,
  notification: {
    title: string;
    body: string;
    data?: Record<string, string>;
  }
) {
  const tokens = await prisma.fCMToken.findMany({
    where: { userId },
    select: { token: true },
  });

  if (tokens.length === 0) return;

  const message = {
    notification: {
      title: notification.title,
      body: notification.body,
    },
    data: notification.data || {},
    tokens: tokens.map((t: { token: string }) => t.token),
  };

  try {
    const response = await messaging.sendEachForMulticast(message);
    console.log(`Sent ${response.successCount} notifications`);
    
    // Remove only tokens with permanent invalidation errors
    // Note: 'messaging/message-rate-exceeded' is transient and should not trigger deletion
    const permanentErrorCodes = [
      'messaging/registration-token-not-registered',
      'messaging/invalid-registration-token',
      'messaging/mismatched-credential',
    ];

    const failedTokens = response.responses
      .map((resp, idx) => {
        if (!resp.success && resp.error) {
          const errorCode = resp.error.code || '';
          if (permanentErrorCodes.some(code => errorCode.includes(code))) {
            return tokens[idx].token;
          }
        }
        return null;
      })
      .filter(Boolean);

    if (failedTokens.length > 0) {
      await prisma.fCMToken.deleteMany({
        where: { token: { in: failedTokens as string[] } },
      });
    }
  } catch (error) {
    console.error('Push notification error:', error);
  }
}

export async function sendOrderConfirmationPush(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true },
  });

  if (!order || !order.userId) return;

  await sendPushToUser(order.userId, {
    title: 'Order Confirmed',
    body: `Your order ${order.orderNumber} has been confirmed and will be shipped soon.`,
    data: {
      type: 'order_status',
      orderId: order.id,
    },
  });
}