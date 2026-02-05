// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Public paths that don't require authentication
  const publicPaths = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/refresh',
    '/api/products',
    '/api/categories',
  ];

  // Check if path is public or starts with public path
  const isPublicPath = publicPaths.some(publicPath => 
    path === publicPath || path.startsWith(`${publicPath}/`)
  );

  if (isPublicPath) {
    return NextResponse.next();
  }

  // Check for authorization header
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return NextResponse.json(
      { error: 'Unauthorized - No token provided' },
      { status: 401 }
    );
  }

  // Verify token
  try {
    const payload = verifyAccessToken(token);
    
    if (!payload || !payload.userId) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    // Token is valid, continue
    return NextResponse.next();
  } catch {
    // Token expired or invalid
    return NextResponse.json(
      { error: 'Unauthorized - Invalid or expired token' },
      { status: 401 }
    );
  }
}

export const config = {
  matcher: [
    '/api/cart/:path*',
    '/api/wishlist/:path*',
    '/api/orders/:path*',
    '/api/addresses/:path*',
    '/api/payment/:path*',
    '/api/admin/:path*',
  ],
};