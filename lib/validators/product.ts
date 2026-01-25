// lib/validators/product.ts

import { z } from 'zod';

export const createProductSchema = z.object({
  styleCode: z.string().min(3).max(20),
  name: z.string().min(1).max(200),
  description: z.string().min(10),
  price: z.number().positive(),
  categoryId: z.string().cuid(),
  images: z.array(z.string().url()).min(1).max(10),
  materials: z.array(z.string()).min(1),
  dimensions: z.string(),
  careInstructions: z.string(),
  stock: z.number().int().nonnegative(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
});

export const updateProductSchema = createProductSchema.partial();