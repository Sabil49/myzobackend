// lib/auth.ts

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as string;

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be defined in environment variables');
}

console.log('JWT_SECRET configured:', !!JWT_SECRET);
console.log('JWT_REFRESH_SECRET configured:', !!JWT_REFRESH_SECRET);

interface JWTPayload {
  userId: string;
  email: string;
  role: 'ADMIN' | 'CUSTOMER';
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function generateAccessToken(payload: JWTPayload): string {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
  console.log('Generated access token for user:', payload.userId);
  return token;
}

export function generateRefreshToken(payload: JWTPayload): string {
  const token = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });
  console.log('Generated refresh token for user:', payload.userId);
  return token;
}

export function verifyAccessToken(token: string): JWTPayload {
  try {
    console.log('Verifying access token...');
    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
    console.log('Access token verified for user:', payload.userId, 'role:', payload.role);
    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.error('Access token expired');
      throw new Error('Token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      console.error('Invalid access token:', error.message);
      throw new Error('Invalid token');
    }
    console.error('Token verification error:', error);
    throw new Error('Invalid or expired token');
  }
}

export function verifyRefreshToken(token: string): JWTPayload {
  try {
    console.log('Verifying refresh token...');
    const payload = jwt.verify(token, JWT_REFRESH_SECRET) as JWTPayload;
    console.log('Refresh token verified for user:', payload.userId);
    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.error('Refresh token expired');
      throw new Error('Refresh token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      console.error('Invalid refresh token:', error.message);
      throw new Error('Invalid refresh token');
    }
    console.error('Refresh token verification error:', error);
    throw new Error('Invalid or expired refresh token');
  }
}