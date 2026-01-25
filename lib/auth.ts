// lib/auth.ts

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error('JWT_SECRET and JWT_REFRESH_SECRET environment variables are required');
}

export interface JWTPayload {
  userId: string;
  email?: string;
  role: string;
}

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 12);
};

export const verifyPassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

export const generateAccessToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
};

export const generateRefreshToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });
};

const validatePayload = (payload: unknown): JWTPayload => {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'userId' in payload &&
    'role' in payload &&
    typeof (payload as any).userId === 'string' &&
    typeof (payload as any).role === 'string'
  ) {
    return payload as JWTPayload;
  }
  throw new Error('Invalid JWT payload structure');
};

export const verifyAccessToken = (token: string): JWTPayload => {
  const payload = jwt.verify(token, JWT_SECRET);
  return validatePayload(payload);
};

export const verifyRefreshToken = (token: string): JWTPayload => {
  const payload = jwt.verify(token, JWT_REFRESH_SECRET);
  return validatePayload(payload);
};