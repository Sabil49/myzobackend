// app/api/products/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';
import { createProductSchema } from '@/lib/validators/product';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

// GET /api/products - List products with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const featured = searchParams.get('featured');
    const pageParam = parseInt(searchParams.get('page') || '1', 10);
    const limitParam = parseInt(searchParams.get('limit') || '20', 10);

    const MAX_LIMIT = 100;
    const page = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
    const limit = isNaN(limitParam) || limitParam < 1 ? 20 : Math.min(limitParam, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = { isActive: true };
    if (categoryId) where.categoryId = categoryId;
    if (featured === 'true') where.isFeatured = true;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);

    return NextResponse.json({
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Products fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

// POST /api/products - Create product (admin only)
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyAccessToken(token);
    if (payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createProductSchema.parse(body);

    // Build the data object - handle categoryId properly
    const productData: Prisma.ProductCreateInput = {
      name: validatedData.name,
      styleCode: validatedData.styleCode,
      description: validatedData.description,
      price: validatedData.price,
      stock: validatedData.stock,
      materials: validatedData.materials,
      dimensions: validatedData.dimensions,
      careInstructions: validatedData.careInstructions,
      images: validatedData.images,
      isActive: validatedData.isActive,
      isFeatured: validatedData.isFeatured,
      // Only connect category if categoryId is provided
      ...(validatedData.categoryId && {
        category: {
          connect: { id: validatedData.categoryId }
        }
      }),
    };

    const product = await prisma.product.create({
      data: productData,
      include: { category: true },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      const errorMessage = error.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join(', ');
      
      return NextResponse.json(
        { 
          error: errorMessage,
          details: error.errors
        },
        { status: 400 }
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: 'A product with this style code already exists' },
          { status: 409 }
        );
      }
      if (error.code === 'P2003') {
        return NextResponse.json(
          { error: 'Invalid category ID' },
          { status: 400 }
        );
      }
      if (error.code === 'P2025') {
        return NextResponse.json(
          { error: 'Category not found' },
          { status: 404 }
        );
      }
    }

    console.error('Product creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
}