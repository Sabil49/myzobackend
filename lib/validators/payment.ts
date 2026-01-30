import { z } from 'zod';

export const stripePaymentIntentSchema = z.object({
  orderId: z.string().cuid(),
});

export const razorpayOrderSchema = z.object({
  orderId: z.string().cuid(),
});

export const razorpayVerifySchema = z.object({
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
});

export const dodoPaymentSchema = z.object({
  amount: z.number().min(1),
  currency: z.string().length(3),
  customerEmail: z.string().email(),
  orderId: z.string().cuid(),
});