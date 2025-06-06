
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/lib/config';
import type { UserJWTPayload } from '@/types';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateUserToken(payload: UserJWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' }); // Token expires in 7 days
}

export function verifyUserToken(token: string): UserJWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserJWTPayload;
    return decoded;
  } catch (error) {
    console.error('Invalid token:', error);
    return null;
  }
}
