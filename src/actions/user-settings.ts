
'use server';

import { getDb, USER_SETTINGS_COLLECTION } from '@/lib/mongodb';
import type { UserSettings, Locale } from '@/types';
import { ObjectId } from 'mongodb';

const DEFAULT_LOCALE: Locale = 'en';

export async function getUserSettings(userId: string): Promise<UserSettings | null> {
  try {
    const db = await getDb();
    const settings = await db.collection<UserSettings>(USER_SETTINGS_COLLECTION).findOne({ userId });
    
    if (settings && settings._id) {
        // @ts-ignore
      return { ...settings, _id: settings._id.toString() } as UserSettings;
    }
    // If no settings, return defaults associated with the user
    return {
        userId,
        userLocale: DEFAULT_LOCALE,
        defaultIncome: 0,
        defaultIncomeSourceName: ''
    };
  } catch (error: any) {
    console.error('Error fetching user settings:', error.message);
    throw new Error(`Failed to fetch user settings: ${error.message}`);
  }
}

export async function saveUserSettings(userId: string, settings: Partial<Omit<UserSettings, '_id' | 'userId'>>): Promise<UserSettings> {
  try {
    const db = await getDb();
    
    const filter = { userId };
    // Ensure userId is not in the $set part as it's part of the filter
    const { ...updateData } = settings;

    const result = await db.collection<UserSettings>(USER_SETTINGS_COLLECTION).findOneAndUpdate(
      filter,
      { $set: updateData, $setOnInsert: { userId } }, // Ensure userId is set on insert
      { upsert: true, returnDocument: 'after' }
    );

    if (!result) {
      throw new Error('Failed to save or update user settings: No document returned.');
    }
    
    // @ts-ignore
    const savedDoc = result as UserSettings & {_id: ObjectId};
    
    if (savedDoc && savedDoc._id) {
      return { ...savedDoc, _id: savedDoc._id.toString() };
    }
    throw new Error('Saved user settings document is missing _id.');

  } catch (error: any) {
    console.error('Error saving user settings:', error.message);
    throw new Error(`Failed to save user settings: ${error.message}`);
  }
}
