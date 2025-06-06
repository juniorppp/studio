
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb, USERS_COLLECTION } from '@/lib/mongodb';
import { hashPassword, comparePassword, generateUserToken, verifyUserToken } from '@/lib/authUtils';
import { AUTH_COOKIE_NAME } from '@/lib/config';
import type { User, UserJWTPayload } from '@/types';
import { ObjectId } from 'mongodb';

export async function registerUser(name: string, username: string, plainPassword: string): Promise<{ success: boolean; message: string }> {
  console.log(`[Register User] Attempting registration for username: ${username}`);
  try {
    const db = await getDb();
    console.log(`[Register User] Database connection for ${username} obtained.`);
    
    const existingUser = await db.collection(USERS_COLLECTION).findOne({ username });
    if (existingUser) {
      console.log(`[Register User] Username ${username} already exists.`);
      return { success: false, message: 'Username already exists.' };
    }
    console.log(`[Register User] Username ${username} is available.`);

    const passwordHash = await hashPassword(plainPassword);
    console.log(`[Register User] Password hashed for ${username}.`);
    
    const newUser: Omit<User, '_id'> = { name, username, passwordHash };
    
    const result = await db.collection(USERS_COLLECTION).insertOne(newUser);
    console.log(`[Register User] Insert result for ${username}:`, JSON.stringify(result));

    if (!result.insertedId) {
        console.log(`[Register User] Registration failed for ${username}: No insertedId returned from MongoDB.`);
        return { success: false, message: 'Registration failed. Please try again.' };
    }
    console.log(`[Register User] Registration successful for ${username}. User ID: ${result.insertedId.toString()}`);
    return { success: true, message: 'Registration successful. Please log in.' };
  } catch (error: any) {
    console.error(`[Register User] Error during registration for ${username}:`, error);
    if (error.code === 11000) { // MongoDB duplicate key error
      return { success: false, message: 'Username already exists. Please choose a different one.' };
    }
    return { success: false, message: `Registration failed: ${error.message}` };
  }
}

export async function loginUser(username: string, plainPassword: string): Promise<{ success: boolean; message: string }> {
  console.log(`[Login User] Attempting login for username: ${username}`);
  try {
    const db = await getDb();
    console.log(`[Login User] Database connection for ${username} obtained.`);
    
    const user = await db.collection<User>(USERS_COLLECTION).findOne({ username });

    if (!user || !user._id) {
      console.log(`[Login User] No user found with username: ${username}`);
      return { success: false, message: 'Invalid username or password.' };
    }
    console.log(`[Login User] User found for ${username}. User ID: ${user._id.toString()}`);

    const isPasswordValid = await comparePassword(plainPassword, user.passwordHash);
    if (!isPasswordValid) {
      console.log(`[Login User] Invalid password for username: ${username}`);
      return { success: false, message: 'Invalid username or password.' };
    }
    console.log(`[Login User] Password valid for ${username}.`);

    const userPayload: UserJWTPayload = { userId: user._id.toString(), username: user.username };
    const token = await generateUserToken(userPayload); // Now async
    console.log(`[Login User] JWT generated for ${username}.`);

    cookies().set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
      sameSite: 'lax',
    });
    console.log(`[Login User] Auth cookie set for ${username}.`);

    return { success: true, message: 'Login successful!' };
  } catch (error: any) {
    console.error(`[Login User] Error during login for ${username}:`, error);
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
  return await verifyUserToken(token); // Now async
}

export async function ensureAuthenticated(redirectTo = '/login'): Promise<UserJWTPayload> {
  const session = await getUserSession();
  if (!session) {
    redirect(redirectTo);
  }
  return session;
}
