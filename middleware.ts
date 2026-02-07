


// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Public paths
  const publicPaths = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/refresh',
  ];

  if (publicPaths.includes(path)) {
    return NextResponse.next();
  }

  // Only check token existence
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return NextResponse.json(
      { error: 'Unauthorized - No token' },
      { status: 401 }
    );
  }

  // ✅ DO NOT verify token here
  return NextResponse.next();
}

// middleware.ts

export const config = {
  matcher: [
    '/api/products/:path*',
    '/api/cart/:path*',
    '/api/wishlist/:path*',
    '/api/orders/:path*',
    '/api/addresses/:path*',
    '/api/admin/:path*',
    // '/api/notifications/:path*',  // REMOVE THIS - notifications should work without auth
  ],
};
