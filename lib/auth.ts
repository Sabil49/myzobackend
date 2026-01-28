// lib/auth.ts

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createHash } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as string;

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be defined in environment variables');
}
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
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
}

export function generateRefreshToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });
}

function isValidPayload(payload: unknown): payload is JWTPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'userId' in payload &&
    typeof (payload as JWTPayload).userId === 'string' &&
    'email' in payload &&
    typeof (payload as JWTPayload).email === 'string' &&
    'role' in payload &&
    ((payload as JWTPayload).role === 'ADMIN' || (payload as JWTPayload).role === 'CUSTOMER')
  );
}
export function verifyAccessToken(token: string): JWTPayload {
  let payload: unknown;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    throw new Error('Invalid or expired token');
  }
  if (!isValidPayload(payload)) {
    throw new Error('Invalid token payload structure');
  }
  return payload;
}

export function verifyRefreshToken(token: string): JWTPayload {
  try {
    const payload = jwt.verify(token, JWT_REFRESH_SECRET);
    if (!isValidPayload(payload)) {
      throw new Error('Invalid or expired refresh token');
    }
    return payload;
  } catch {
    throw new Error('Invalid or expired refresh token');
  }
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}