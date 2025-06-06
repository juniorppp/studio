
import { MongoClient, type Db } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'billbliss';

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
  // In development mode, use a global variable so that the MongoClient
  // instance is preserved across HMR reloads.
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

export async function getDb(): Promise<Db> {
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

// Collection names
export const USERS_COLLECTION = 'users';
export const USER_SETTINGS_COLLECTION = 'userSettings';
export const MONTHLY_DATA_COLLECTION = 'monthlyData';
