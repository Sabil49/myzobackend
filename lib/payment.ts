// lib/validators/payment.ts

import { z } from 'zod';

export const dodoPaymentSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().default('USD'),
  orderId: z.string(),
  customerEmail: z.string().email(),
  customerPhone: z.string().optional(),
});

export type DodoPaymentInput = z.infer<typeof dodoPaymentSchema>;