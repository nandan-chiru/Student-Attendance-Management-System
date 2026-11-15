import { MongoClient } from "mongodb";

const globalForMongo = globalThis as typeof globalThis & {
  mongoClientPromise?: Promise<MongoClient>;
};

/** Returns the shared MongoDB client connection without creating collections. */
export function getMongoClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  globalForMongo.mongoClientPromise ??= new MongoClient(uri).connect();
  return globalForMongo.mongoClientPromise;
}
