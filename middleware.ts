// middleware.ts

import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  console.log('[MIDDLEWARE] Request to:', path);

  // Public paths
  const publicPaths = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/refresh',
  ];

  if (publicPaths.includes(path)) {
    console.log('[MIDDLEWARE] Public path, allowing');
    return NextResponse.next();
  }

  // Check for token
  const authHeader = request.headers.get('authorization');
  console.log('[MIDDLEWARE] Authorization header:', authHeader ? 'Present' : 'Missing');
  
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    console.log('[MIDDLEWARE] ❌ No token provided');
    return NextResponse.json(
      { error: 'Unauthorized - No token provided' },
      { status: 401 }
    );
  }

  console.log('[MIDDLEWARE] Token received, length:', token.length);
  console.log('[MIDDLEWARE] Token first 20 chars:', token.substring(0, 20));

  try {
    const payload = verifyAccessToken(token);
    console.log('[MIDDLEWARE] ✅ Token valid for user:', payload.userId, 'role:', payload.role);

    // Check admin routes
    if (path.startsWith('/api/admin') && payload.role !== 'ADMIN') {
      console.log('[MIDDLEWARE] ❌ User is not admin');
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    console.log('[MIDDLEWARE] ✅ Access granted to:', path);

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
    console.error('[MIDDLEWARE] ❌ Token verification failed:', error);
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