// middleware.ts

import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  console.log('Middleware - Path:', path);

  // Public paths that don't require authentication
  const publicPaths = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/refresh',
    '/api/auth/verify', // Add debug endpoint
  ];

  if (publicPaths.includes(path)) {
    console.log('Middleware - Public path, allowing');
    return NextResponse.next();
  }

  // Check for token in Authorization header
  const token = request.headers.get('authorization')?.replace('Bearer ', '');

  if (!token) {
    console.log('Middleware - No token provided for:', path);
    return NextResponse.json(
      { error: 'Unauthorized - No token provided' },
      { status: 401 }
    );
  }

  try {
    const payload = verifyAccessToken(token);
    console.log('Middleware - Token valid for user:', payload.userId, 'role:', payload.role);

    // Check admin routes
    if (path.startsWith('/api/admin') && payload.role !== 'ADMIN') {
      console.log('Middleware - User is not admin, denying access');
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Add user info to headers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', payload.userId);
    requestHeaders.set('x-user-role', payload.role);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (error) {
    console.error('Middleware - Token verification failed:', error);
    return NextResponse.json(
      { error: 'Unauthorized - Invalid token' },
      { status: 401 }
    );
  }
}

export const config = {
  matcher: [
    '/api/products/:path*',
    '/api/cart/:path*',
    '/api/wishlist/:path*',
    '/api/orders/:path*',
    '/api/addresses/:path*',
    '/api/admin/:path*',
    '/api/notifications/:path*',
  ],
};