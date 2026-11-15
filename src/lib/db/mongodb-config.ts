/** True only when a non-empty MongoDB URI is configured in the server environment. */
export function isMongoConfigured(uri = process.env.MONGODB_URI): boolean {
  return typeof uri === "string" && uri.trim().length > 0;
}
