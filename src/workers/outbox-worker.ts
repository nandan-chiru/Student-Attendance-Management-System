import "dotenv/config";
import { prisma } from "@/lib/db/prisma";
import { getMongoClient } from "@/lib/db/mongodb-client";
import { mongoAttendanceEventStore } from "@/dal/attendance/mongo-attendance-event-store-core";
import { prismaOutboxRepository } from "@/dal/attendance/outbox-repository-core";
import { dispatchPendingOutboxBatch } from "@/services/attendance/outbox-dispatcher";

const POLL_INTERVAL_MS = 2_000;
const MAX_BACKOFF_MS = 30_000;
const BATCH_SIZE = 50;

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    signal.addEventListener("abort", finish, { once: true });
  });
}

async function run(): Promise<void> {
  const controller = new AbortController();
  const stop = (signal: NodeJS.Signals) => {
    console.info(`Outbox worker received ${signal}; stopping after the current batch.`);
    controller.abort();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  console.info("Outbox worker started; polling pending attendance events.");

  let backoffMs = POLL_INTERVAL_MS;
  let mongoClient: Awaited<ReturnType<typeof getMongoClient>> | undefined;
  try {
    while (!controller.signal.aborted) {
      try {
        const result = await dispatchPendingOutboxBatch({
          outbox: prismaOutboxRepository,
          eventStore: mongoAttendanceEventStore,
          batchSize: BATCH_SIZE,
        });
        if (result.delivered > 0) {
          console.info(`Delivered ${result.delivered} attendance event(s) to MongoDB.`);
        }
        for (const failure of result.failures) {
          console.error(`Outbox event ${failure.eventId} failed at ${failure.stage}. It remains pending for retry.`);
        }
        if (result.failures.length > 0) {
          backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
          await wait(backoffMs, controller.signal);
        } else {
          backoffMs = POLL_INTERVAL_MS;
          if (result.read === 0) await wait(POLL_INTERVAL_MS, controller.signal);
        }
      } catch {
        // Driver errors can contain infrastructure details; avoid printing raw exception messages.
        console.error("Outbox polling cycle failed. Check database connectivity and configuration.");
        backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
        await wait(backoffMs, controller.signal);
      }
    }
  } finally {
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
    try { mongoClient = await getMongoClient(); } catch { /* Mongo may never have connected. */ }
    await mongoClient?.close().catch(() => undefined);
    await prisma.$disconnect();
  }
}

run().catch((error: unknown) => {
  console.error("Outbox worker stopped unexpectedly:", error instanceof Error ? error.message : "Unknown error.");
  process.exitCode = 1;
});
