// app/api/addresses/[id]/default/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';

// PATCH /api/addresses/[id]/default - Set address as default
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
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

    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid token payload' }, { status: 401 });
    }

    // Verify address belongs to user
    const address = await prisma.address.findFirst({
      where: {
        id: id,
        userId: payload.userId,
      },
    });

    if (!address) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 });
    }

    // Unset all other default addresses for this user
    await prisma.address.updateMany({
      where: {
        userId: payload.userId,
        isDefault: true,
      },
      data: {
        isDefault: false,
      },
    });

    // Set this address as default
    const updatedAddress = await prisma.address.update({
      where: { id: id },
      data: { isDefault: true },
    });

    return NextResponse.json({ address: updatedAddress });
  } catch (error) {
    console.error('Set default address error:', error);
    return NextResponse.json(
      { error: 'Failed to set default address' },
      { status: 500 }
    );
  }
}