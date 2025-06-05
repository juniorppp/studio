
'use server';

import { MongoClient, ObjectId } from 'mongodb';
import type { MonthlyData } from '@/types';

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'billbliss'; // Default DB name
const MONTHLY_DATA_COLLECTION = 'monthlyData';

if (!MONGODB_URI) {
  throw new Error(
    'Please define the MONGODB_URI environment variable inside .env.local or your server environment'
  );
}

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

// Global is used here to maintain a cached connection across hot reloads
// in development. This prevents connections from piling up during development.
// @ts-ignore
let globalWithMongo = global as typeof globalThis & {
  _mongoClientPromise: Promise<MongoClient> | undefined
}

if (process.env.NODE_ENV === 'development') {
  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(MONGODB_URI);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  client = new MongoClient(MONGODB_URI);
  clientPromise = client.connect();
}

async function getDb() {
  const mongoClient = await clientPromise;
  return mongoClient.db(DB_NAME);
}

export async function getMonthlyData(year: number, month: number): Promise<MonthlyData | null> {
  try {
    const db = await getDb();
    const data = await db.collection(MONTHLY_DATA_COLLECTION).findOne({ year, month });
    
    if (data && data._id) {
      return { ...data, _id: data._id.toString() } as MonthlyData;
    }
    return null;
  } catch (error) {
    console.error('Error fetching monthly data:', error);
    // Depending on desired error handling, you might throw or return a specific error object
    return null; 
  }
}

export async function saveMonthlyData(data: Omit<MonthlyData, '_id'> & { _id?: string }): Promise<MonthlyData> {
  try {
    const db = await getDb();
    const { year, month, _id, ...updateData } = data;

    const filter = { year, month };

    const result = await db.collection(MONTHLY_DATA_COLLECTION).findOneAndUpdate(
      filter,
      { $set: updateData },
      { upsert: true, returnDocument: 'after' }
    );

    if (!result) {
      throw new Error('Failed to save or update monthly data: No document returned.');
    }
    
    const savedDoc = result as MonthlyData;
    if (savedDoc && savedDoc._id) {
      // Ensure _id is stringified for client-side consistency
      // @ts-ignore MongoDB driver might return ObjectId, so we convert
      savedDoc._id = savedDoc._id.toString();
    }
    return savedDoc;

  } catch (error) {
    console.error('Error saving monthly data:', error);
    throw new Error('Failed to save monthly data. Ensure MongoDB is connected and credentials are correct.');
  }
}
