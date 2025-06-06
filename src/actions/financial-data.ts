
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
    'CRITICAL: MONGODB_URI environment variable is not defined. MongoDB functionality will be disabled. Please ensure MONGODB_URI is correctly set in your .env.local file (in the project root) and RESTART your Next.js server.'
  );
  console.error("***********************************************************************************");
  console.error(mongoInitializationError.message);
  console.error("Example .env.local content: MONGODB_URI=\"mongodb://username:password@host:port/database?options\"");
  console.error("If using a local MongoDB instance without auth: MONGODB_URI=\"mongodb://localhost:27017/yourDatabaseName\"");
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
        mongoInitializationError = new Error(`Failed to initialize MongoDB client in development: ${e.message}. Check your MONGODB_URI.`);
        console.error(mongoInitializationError.message);
      }
    }
    if (globalWithMongo._mongoClientPromise && !mongoInitializationError) {
      clientPromise = globalWithMongo._mongoClientPromise;
    } else if (!mongoInitializationError) {
        mongoInitializationError = new Error('MongoDB client promise was not initialized in development without a specific error. This could be due to an invalid MONGODB_URI even if it is defined.');
        console.error(mongoInitializationError.message);
    }
  } else { // Production
    try {
      client = new MongoClient(MONGODB_URI);
      clientPromise = client.connect();
    } catch (e: any) {
      mongoInitializationError = new Error(`Failed to initialize MongoDB client in production: ${e.message}. Check your MONGODB_URI.`);
      console.error(mongoInitializationError.message);
    }
  }
}

async function getDb() {
  if (mongoInitializationError) {
    throw mongoInitializationError;
  }
  if (!clientPromise) {
    throw new Error('MongoDB client promise is not available. Initialization may have failed, potentially due to an invalid MONGODB_URI.');
  }
  try {
    const mongoClient = await clientPromise;
    return mongoClient.db(DB_NAME);
  } catch (e: any) {
    const connectionError = new Error(`Failed to connect to MongoDB: ${e.message}. Verify your MONGODB_URI, network access, and database server status.`);
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
    throw new Error(`Failed to fetch monthly data: ${error.message}`);
  }
}

const MONTHLY_DATA_COLLECTION = 'monthlyData';

export async function saveMonthlyData(data: Omit<MonthlyData, '_id'> & { _id?: string }): Promise<MonthlyData> {
  try {
    const db = await getDb();
    const { year, month, _id, ...updateData } = data;

    const filter = { year, month };

    // For debugging potential duplicate issues
    console.log('[DEBUG] saveMonthlyData: Filter for findOneAndUpdate:', JSON.stringify(filter));
    // console.log('[DEBUG] saveMonthlyData: Data for $set:', JSON.stringify(updateData).substring(0, 300) + '...'); // Log partial data to avoid overly long logs


    const result = await db.collection(MONTHLY_DATA_COLLECTION).findOneAndUpdate(
      filter,
      { $set: updateData },
      { upsert: true, returnDocument: 'after' }
    );

    if (!result) {
      throw new Error('Failed to save or update monthly data: No document returned from findOneAndUpdate. This may indicate a problem with the database operation or connection.');
    }
    
    const savedDoc = result as unknown as (MonthlyData & {_id: ObjectId}); 
    
    if (savedDoc && savedDoc._id) {
      return { ...savedDoc, _id: savedDoc._id.toString() };
    }
    throw new Error('Saved document is missing _id after database operation. This should not happen if the upsert was successful.');

  } catch (error: any) {
    console.error('Error saving monthly data:', error.message);
    throw new Error(`Failed to save monthly data: ${error.message}. Ensure MongoDB is connected, credentials in MONGODB_URI are correct, and the database server is accessible.`);
  }
}

