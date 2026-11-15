import "server-only";

// Next.js callers use this protected boundary. Standalone Node workers import
// mongodb-client.ts directly, which has no dependency on Next's marker package.
export {
  getMongoClient,
  getMongoDatabase,
  MONGODB_DATABASE_NAME,
  MongoConfigurationError,
  MongoConnectionError,
} from "@/lib/db/mongodb-client";
