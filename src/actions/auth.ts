
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb, USERS_COLLECTION } from '@/lib/mongodb';
import { hashPassword, comparePassword, generateUserToken, verifyUserToken } from '@/lib/authUtils';
import { AUTH_COOKIE_NAME } from '@/lib/config';
import type { User, UserJWTPayload } from '@/types';
import { ObjectId } from 'mongodb';

export async function registerUser(name: string, username: string, plainPassword: string): Promise<{ success: boolean; message: string }> {
  try {
    const db = await getDb();
    const existingUser = await db.collection(USERS_COLLECTION).findOne({ username });
    if (existingUser) {
      return { success: false, message: 'Username already exists.' };
    }

    const passwordHash = await hashPassword(plainPassword);
    const newUser: Omit<User, '_id'> = { name, username, passwordHash };
    
    const result = await db.collection(USERS_COLLECTION).insertOne(newUser);
    if (!result.insertedId) {
        return { success: false, message: 'Registration failed. Please try again.' };
    }
    return { success: true, message: 'Registration successful. Please log in.' };
  } catch (error: any) {
    console.error('Registration error:', error);
    return { success: false, message: `Registration failed: ${error.message}` };
  }
}

export async function loginUser(username: string, plainPassword: string): Promise<{ success: boolean; message: string }> {
  try {
    const db = await getDb();
    const user = await db.collection<User>(USERS_COLLECTION).findOne({ username });

    if (!user || !user._id) {
      return { success: false, message: 'Invalid username or password.' };
    }

    const isPasswordValid = await comparePassword(plainPassword, user.passwordHash);
    if (!isPasswordValid) {
      return { success: false, message: 'Invalid username or password.' };
    }

    const userPayload: UserJWTPayload = { userId: user._id.toString(), username: user.username };
    const token = generateUserToken(userPayload);

    cookies().set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
      sameSite: 'lax',
    });

    return { success: true, message: 'Login successful!' };
  } catch (error: any) {
    console.error('Login error:', error);
    return { success: false, message: `Login failed: ${error.message}` };
  }
}

export async function logoutUser(): Promise<void> {
  cookies().delete(AUTH_COOKIE_NAME);
  redirect('/login');
}

export async function getUserSession(): Promise<UserJWTPayload | null> {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  return verifyUserToken(token);
}

export async function ensureAuthenticated(redirectTo = '/login'): Promise<UserJWTPayload> {
  const session = await getUserSession();
  if (!session) {
    redirect(redirectTo);
  }
  return session;
}
