// app/api/products/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';
import { updateProductSchema } from '@/lib/validators/product';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

// GET /api/products/:id
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error('Product fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}

// PUT /api/products/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyAccessToken(token);
    if (payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateProductSchema.parse(body);

    // Build update data with proper typing
    const updateData: Prisma.ProductUpdateInput = {};

    // Add fields that are present in validatedData
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.styleCode !== undefined) updateData.styleCode = validatedData.styleCode;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.price !== undefined) updateData.price = validatedData.price;
    if (validatedData.stock !== undefined) updateData.stock = validatedData.stock;
    if (validatedData.materials !== undefined) updateData.materials = validatedData.materials;
    if (validatedData.dimensions !== undefined) updateData.dimensions = validatedData.dimensions;
    if (validatedData.careInstructions !== undefined) updateData.careInstructions = validatedData.careInstructions;
    if (validatedData.images !== undefined) updateData.images = validatedData.images;
    if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive;
    if (validatedData.isFeatured !== undefined) updateData.isFeatured = validatedData.isFeatured;

    // Handle categoryId: connect, disconnect, or leave unchanged
    if (validatedData.categoryId !== undefined) {
      if (validatedData.categoryId === null) {
        // Disconnect category
        updateData.category = { disconnect: true };
      } else if (validatedData.categoryId) {
        // Connect to new category
        updateData.category = { connect: { id: validatedData.categoryId } };
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
      include: { category: true },
    });

    return NextResponse.json(product);
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
      if (error.code === 'P2025') {
        return NextResponse.json(
          { error: 'Product not found' },
          { status: 404 }
        );
      }
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
    }

    console.error('Product update error:', error);
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

// DELETE /api/products/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyAccessToken(token);
    if (payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    await prisma.product.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Product deleted successfully' });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          { error: 'Product not found' },
          { status: 404 }
        );
      }
      if (error.code === 'P2003') {
        return NextResponse.json(
          { error: 'Cannot delete product that is referenced in orders' },
          { status: 409 }
        );
      }
    }

    console.error('Product deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}