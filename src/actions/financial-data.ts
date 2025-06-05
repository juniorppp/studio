
'use server';

import { MongoClient, ObjectId } from 'mongodb';
import type { MonthlyData } from '@/types';

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'billbliss'; // Default DB name

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;
let mongoInitializationError: Error | null = null;

if (!MONGODB_URI) {
  mongoInitializationError = new Error(
    'CRITICAL: MONGODB_URI environment variable is not defined. MongoDB functionality will be disabled. Please define it in your .env.local or server environment.'
  );
  console.error("***********************************************************************************");
  console.error(mongoInitializationError.message);
  console.error("***********************************************************************************");
} else {
  // @ts-ignore
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise: Promise<MongoClient> | undefined
  }

  if (process.env.NODE_ENV === 'development') {
    if (!globalWithMongo._mongoClientPromise) {
      try {
        client = new MongoClient(MONGODB_URI);
        globalWithMongo._mongoClientPromise = client.connect();
      } catch (e: any) {
        mongoInitializationError = new Error(`Failed to initialize MongoDB client in development: ${e.message}`);
        console.error(mongoInitializationError.message);
      }
    }
    if (globalWithMongo._mongoClientPromise && !mongoInitializationError) {
      clientPromise = globalWithMongo._mongoClientPromise;
    } else if (!mongoInitializationError) {
        // This case should ideally not be hit if the above logic is correct
        mongoInitializationError = new Error('MongoDB client promise was not initialized in development without a specific error.');
        console.error(mongoInitializationError.message);
    }
  } else {
    // In production mode, it's best to not use a global variable for the promise itself,
    // but the client can be managed if necessary. For simplicity, new client per call if not careful.
    // A better production pattern involves a dedicated connection manager or ensuring client is reused.
    try {
      client = new MongoClient(MONGODB_URI);
      clientPromise = client.connect();
    } catch (e: any) {
      mongoInitializationError = new Error(`Failed to initialize MongoDB client in production: ${e.message}`);
      console.error(mongoInitializationError.message);
    }
  }
}

async function getDb() {
  if (mongoInitializationError) {
    throw mongoInitializationError;
  }
  if (!clientPromise) {
    // This should ideally be caught by mongoInitializationError if URI was missing,
    // or if MongoClient constructor failed.
    throw new Error('MongoDB client promise is not available. Initialization may have failed.');
  }
  try {
    const mongoClient = await clientPromise;
    return mongoClient.db(DB_NAME);
  } catch (e: any) {
    // Catch connection errors from clientPromise itself
    const connectionError = new Error(`Failed to connect to MongoDB: ${e.message}`);
    console.error(connectionError.message);
    throw connectionError;
  }
}

export async function getMonthlyData(year: number, month: number): Promise<MonthlyData | null> {
  try {
    const db = await getDb();
    const data = await db.collection(MONTHLY_DATA_COLLECTION).findOne({ year, month });
    
    if (data && data._id) {
      // @ts-ignore
      return { ...data, _id: data._id.toString() } as MonthlyData;
    }
    return null;
  } catch (error: any) {
    console.error('Error fetching monthly data:', error.message);
    // Propagate the error so UI can handle it, or throw a more generic one
    throw new Error(`Failed to fetch monthly data: ${error.message}`);
  }
}

const MONTHLY_DATA_COLLECTION = 'monthlyData';

export async function saveMonthlyData(data: Omit<MonthlyData, '_id'> & { _id?: string }): Promise<MonthlyData> {
  try {
    const db = await getDb();
    const { year, month, _id, ...updateData } = data;

    const filter = { year, month };
    // If _id is provided from an existing document, ensure we use it for targeting if appropriate,
    // or rely on year/month for upsert. For simplicity, upsert on year/month is robust.
    // If a new doc, _id will be undefined. If existing, it's passed from currentMonthlyData.
    // For an upsert, we generally don't filter by _id but by a business key.

    const result = await db.collection(MONTHLY_DATA_COLLECTION).findOneAndUpdate(
      filter,
      { $set: updateData },
      { upsert: true, returnDocument: 'after' }
    );

    if (!result) {
      // findOneAndUpdate with upsert:true and returnDocument:'after' should return the doc
      throw new Error('Failed to save or update monthly data: No document returned from findOneAndUpdate.');
    }
    
    // The result object from findOneAndUpdate in newer driver versions is the document itself.
    const savedDoc = result as unknown as (MonthlyData & {_id: ObjectId}); // Cast needed as driver result type is generic
    
    if (savedDoc && savedDoc._id) {
      return { ...savedDoc, _id: savedDoc._id.toString() };
    }
    // This path should ideally not be reached if result is not null.
    throw new Error('Saved document is missing _id after database operation.');

  } catch (error: any) {
    console.error('Error saving monthly data:', error.message);
    throw new Error(`Failed to save monthly data: ${error.message}. Ensure MongoDB is connected and credentials are correct.`);
  }
}
