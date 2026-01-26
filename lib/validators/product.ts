// lib/validators/product.ts

import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  styleCode: z.string().min(1, 'Style code is required').max(50),
  description: z.string().min(1, 'Description is required'),
  price: z.number().positive('Price must be positive'),
  stock: z.number().int().min(0, 'Stock cannot be negative').default(0),
  categoryId: z.string().cuid().optional()
    .or(z.literal('').transform(() => undefined))
    .or(z.null().transform(() => undefined)),
  materials: z.array(z.string()).min(1, 'At least one material is required'),
  dimensions: z.string().min(1, 'Dimensions are required'),
  careInstructions: z.string().min(1, 'Care instructions are required'),
  images: z.array(z.string().url()).min(1, 'At least one image is required'),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
});

export const updateProductSchema = createProductSchema.partial().transform((data) => {
  // Remove categoryId if it's null or empty string
  if (data.categoryId === null || data.categoryId === '') {
    const { categoryId, ...rest } = data;
    return rest;
  }
  return data;
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;