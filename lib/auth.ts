// lib/auth.ts

export function generateAccessToken(payload: JWTPayload): string {
  console.log('[AUTH] Generating access token for user:', payload.userId);
  const token = jwt.sign(payload, JWT_SECRET_STRING, { expiresIn: '24h' }); // Changed from 15m to 24h
  console.log('[AUTH] Access token generated, length:', token.length);
  return token;
}

export function generateRefreshToken(payload: JWTPayload): string {
  console.log('[AUTH] Generating refresh token for user:', payload.userId);
  const token = jwt.sign(payload, JWT_REFRESH_SECRET_STRING, { expiresIn: '7d' });
  console.log('[AUTH] Refresh token generated, length:', token.length);
  return token;
}

export function verifyAccessToken(token: string): JWTPayload {
  try {
    console.log('[AUTH] Verifying access token, length:', token.length);
    console.log('[AUTH] First 20 chars:', token.substring(0, 20));
    
    const decoded = jwt.verify(token, JWT_SECRET_STRING);
    const payload = decoded as JWTPayload;
    
    console.log('[AUTH] ✅ Access token verified for user:', payload.userId, 'role:', payload.role);
    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.error('[AUTH] ❌ Access token expired at:', error.expiredAt);
      throw new Error('Token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      console.error('[AUTH] ❌ Invalid access token:', error.message);
      throw new Error('Invalid token');
    }
    console.error('[AUTH] ❌ Token verification error:', error);
    throw new Error('Invalid or expired token');
  }
}

export function verifyRefreshToken(token: string): JWTPayload {
  try {
    console.log('[AUTH] Verifying refresh token, length:', token.length);
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET_STRING);
    const payload = decoded as JWTPayload;
    console.log('[AUTH] ✅ Refresh token verified for user:', payload.userId);
    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.error('[AUTH] ❌ Refresh token expired');
      throw new Error('Refresh token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      console.error('[AUTH] ❌ Invalid refresh token:', error.message);
      throw new Error('Invalid refresh token');
    }
    console.error('[AUTH] ❌ Refresh token verification error:', error);
    throw new Error('Invalid or expired refresh token');
  }
}

