// lib/validators/product.ts

import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  styleCode: z.string().min(1, 'Style code is required').max(50),
  description: z.string().min(1, 'Description is required'),
  price: z.number().positive('Price must be positive'),
  stock: z.number().int().min(0, 'Stock cannot be negative').default(0),
  categoryId: z.string().cuid().optional().nullable(),
  materials: z.array(z.string()).min(1, 'At least one material is required'),
  dimensions: z.string().min(1, 'Dimensions are required'),
  careInstructions: z.string().min(1, 'Care instructions are required'),
  images: z.array(z.string().url()).min(1, 'At least one image is required'),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  styleCode: z.string().min(1).max(50).optional(),
  description: z.string().min(1).optional(),
  price: z.number().positive().optional(),
  stock: z.number().int().min(0).optional(),
  categoryId: z.string().cuid().optional().nullable(),
  materials: z.array(z.string()).min(1).optional(),
  dimensions: z.string().min(1).optional(),
  careInstructions: z.string().min(1).optional(),
  images: z.array(z.string().url()).min(1).optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;