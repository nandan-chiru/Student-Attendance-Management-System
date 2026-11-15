import { MongoClient, type Db } from "mongodb";
import { isMongoConfigured } from "@/lib/db/mongodb-config";

export const MONGODB_DATABASE_NAME = "student_attendance";

const globalForMongo = globalThis as typeof globalThis & {
  mongoClientPromise?: Promise<MongoClient>;
};

export class MongoConfigurationError extends Error {
  constructor() {
    super("MONGODB_URI is not configured.");
    this.name = "MongoConfigurationError";
  }
}

export class MongoConnectionError extends Error {
  constructor() {
    super("MongoDB connection could not be established.");
    this.name = "MongoConnectionError";
  }
}

/** Shares one server-side connection across requests, workers, and Next.js dev reloads. */
export function getMongoClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri || !isMongoConfigured(uri)) throw new MongoConfigurationError();

  if (!globalForMongo.mongoClientPromise) {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 });
    const connectionPromise = client.connect().catch(async () => {
      globalForMongo.mongoClientPromise = undefined;
      await client.close().catch(() => undefined);
      throw new MongoConnectionError();
    });
    globalForMongo.mongoClientPromise = connectionPromise;
  }

  return globalForMongo.mongoClientPromise;
}

/** Selects the project's intended database without creating a collection. */
export async function getMongoDatabase(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(MONGODB_DATABASE_NAME);
}
