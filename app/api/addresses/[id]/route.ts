// app/api/addresses/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';
import { z } from 'zod';

const updateAddressSchema = z.object({
  fullName: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  addressLine1: z.string().min(1).optional(),
  addressLine2: z.string().optional(),
  city: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  zipCode: z.string().min(1).optional(),
  country: z.string().optional(),
  isDefault: z.boolean().optional(),
});

// GET /api/addresses/[id] - Get a single address
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice('Bearer '.length);
    let payload;
    
    try {
      payload = verifyAccessToken(token);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await params;

    const address = await prisma.address.findFirst({
      where: {
        id: id,
        userId: payload.userId,
      },
    });

    if (!address) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 });
    }

    return NextResponse.json({ address });
  } catch (error) {
    console.error('Get address error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch address' },
      { status: 500 }
    );
  }
}

// PATCH /api/addresses/[id] - Update an address
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = updateAddressSchema.parse(body);

    // Verify address belongs to user
    const existingAddress = await prisma.address.findFirst({
      where: {
        id: params.id,
        userId: payload.userId,
      },
    });

    if (!existingAddress) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 });
    }

    // If setting as default, unset all other defaults
    if (validatedData.isDefault) {
      await prisma.address.updateMany({
        where: {
          userId: payload.userId,
          id: { not: params.id },
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    const address = await prisma.address.update({
      where: { id: params.id },
      data: validatedData,
    });

    return NextResponse.json({ address });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Update address error:', error);
    return NextResponse.json(
      { error: 'Failed to update address' },
      { status: 500 }
    );
  }
}

// DELETE /api/addresses/[id] - Delete an address
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Verify address belongs to user
    const address = await prisma.address.findFirst({
      where: {
        id: params.id,
        userId: payload.userId,
      },
    });

    if (!address) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 });
    }

    // Check if address is used in any orders
    const ordersWithAddress = await prisma.order.count({
      where: { addressId: params.id },
    });

    if (ordersWithAddress > 0) {
      return NextResponse.json(
        { error: 'Cannot delete address that is used in orders' },
        { status: 400 }
      );
    }

    await prisma.address.delete({
      where: { id: params.id },
    });

    // If this was the default address, set another as default
    if (address.isDefault) {
      const nextAddress = await prisma.address.findFirst({
        where: { userId: payload.userId },
        orderBy: { createdAt: 'desc' },
      });

      if (nextAddress) {
        await prisma.address.update({
          where: { id: nextAddress.id },
          data: { isDefault: true },
        });
      }
    }

    return NextResponse.json({ message: 'Address deleted successfully' });
  } catch (error) {
    console.error('Delete address error:', error);
    return NextResponse.json(
      { error: 'Failed to delete address' },
      { status: 500 }
    );
  }
}