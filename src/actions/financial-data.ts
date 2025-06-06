
'use server';

import { getDb, MONTHLY_DATA_COLLECTION } from '@/lib/mongodb';
import type { MonthlyData } from '@/types';
import { ObjectId } from 'mongodb';

// This function now requires userId to fetch data specific to a user
export async function getMonthlyData(userId: string, year: number, month: number): Promise<MonthlyData | null> {
  try {
    const db = await getDb();
    const data = await db.collection<MonthlyData>(MONTHLY_DATA_COLLECTION).findOne({ userId, year, month });
    
    if (data && data._id) {
      // @ts-ignore
      return { ...data, _id: data._id.toString() } as MonthlyData;
    }
    return null;
  } catch (error: any) {
    console.error('Error fetching monthly data:', error.message);
    throw new Error(`Failed to fetch monthly data: ${error.message}`);
  }
}

// This function now requires userId for saving data
// The data parameter should also include userId
export async function saveMonthlyData(data: Omit<MonthlyData, '_id'> & { _id?: string }): Promise<MonthlyData> {
  try {
    const db = await getDb();
    const { userId, year, month, _id, ...updateData } = data;

    if (!userId) {
      throw new Error('User ID is required to save monthly data.');
    }

    const filter = { userId, year, month };

    // console.log('[DEBUG] saveMonthlyData: Filter for findOneAndUpdate:', JSON.stringify(filter));
    // console.log('[DEBUG] saveMonthlyData: Bills in $set operation:', JSON.stringify(updateData.bills?.map(b => ({ id: b.id, incomeSourceId: b.incomeSourceId, name: b.name }))) || 'No bills in updateData');

    const result = await db.collection<MonthlyData>(MONTHLY_DATA_COLLECTION).findOneAndUpdate(
      filter,
      { $set: updateData, $setOnInsert: { userId, year, month } }, // ensure userId, year, month are set on insert
      { upsert: true, returnDocument: 'after' }
    );

    if (!result) {
      throw new Error('Failed to save or update monthly data: No document returned from findOneAndUpdate.');
    }
    
    // @ts-ignore
    const savedDoc = result as MonthlyData & {_id: ObjectId}; 
    
    if (savedDoc && savedDoc._id) {
      return { ...savedDoc, _id: savedDoc._id.toString() };
    }
    throw new Error('Saved document is missing _id after database operation.');

  } catch (error: any) {
    console.error('Error saving monthly data:', error.message);
    throw new Error(`Failed to save monthly data: ${error.message}. Ensure MongoDB is connected, credentials in MONGODB_URI are correct, and the database server is accessible.`);
  }
}
