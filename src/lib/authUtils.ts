
import bcrypt from 'bcryptjs';
import * as jose from 'jose';
import { JWT_SECRET } from '@/lib/config';
import type { UserJWTPayload } from '@/types';

const SALT_ROUNDS = 10;
const alg = 'HS256';
const secret = new TextEncoder().encode(JWT_SECRET);


export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function generateUserToken(payload: UserJWTPayload): Promise<string> {
  return await new jose.SignJWT(payload)
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime('7d') // Token expires in 7 days
    .sign(secret);
}

export async function verifyUserToken(token: string): Promise<UserJWTPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, secret, {
        algorithms: [alg]
    });
    // Directly cast payload. It should conform to UserJWTPayload if signing is correct.
    // jose.jwtVerify already type-checks standard claims if configured.
    // For custom claims, ensure they are present as expected.
    return payload as UserJWTPayload;
  } catch (error: any) {
    // Log specific jose errors if needed, e.g., error.code === 'ERR_JWT_EXPIRED'
    console.error('Invalid token (jose):', error.message);
    return null;
  }
}
