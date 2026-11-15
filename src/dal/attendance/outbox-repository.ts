import "server-only";

// Next.js server code imports this protected boundary; the standalone worker
// uses the core adapter directly.
export { prismaOutboxRepository } from "@/dal/attendance/outbox-repository-core";
