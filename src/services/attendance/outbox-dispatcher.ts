import {
  attendanceSessionFinalizedEventSchema,
  type AttendanceSessionFinalizedEvent,
} from "@/services/attendance/events";

export type PendingOutboxEvent = {
  id: string;
  eventId: string;
  eventType: string;
  payload: unknown;
  createdAt: Date;
};

export interface OutboxRepository {
  listPending(limit: number): Promise<PendingOutboxEvent[]>;
  markDeliveredIfPending(id: string, deliveredAt: Date): Promise<boolean>;
}

export interface AttendanceEventStore {
  ensureIndexes(): Promise<void>;
  persist(event: AttendanceSessionFinalizedEvent): Promise<"inserted" | "already_present">;
}

export type DispatchFailure = {
  eventId: string;
  stage: "validation" | "mongo" | "mysql";
  message: string;
};

export type DispatchResult = {
  read: number;
  delivered: number;
  failures: DispatchFailure[];
};

const DEFAULT_BATCH_SIZE = 50;
const MAX_BATCH_SIZE = 500;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected processing error.";
}

function parseEvent(row: PendingOutboxEvent): AttendanceSessionFinalizedEvent {
  const result = attendanceSessionFinalizedEventSchema.safeParse(row.payload);
  if (!result.success) throw new Error("Outbox payload does not match the attendance event contract.");
  if (result.data.eventId !== row.eventId || result.data.eventType !== row.eventType) {
    throw new Error("Outbox row identity does not match its payload.");
  }
  return result.data;
}

/** Processes one bounded batch. Mongo persistence always precedes the conditional SQL acknowledgement. */
export async function dispatchPendingOutboxBatch(input: {
  outbox: OutboxRepository;
  eventStore: AttendanceEventStore;
  batchSize?: number;
  now?: () => Date;
}): Promise<DispatchResult> {
  const requestedBatch = input.batchSize ?? DEFAULT_BATCH_SIZE;
  if (!Number.isInteger(requestedBatch) || requestedBatch < 1) {
    throw new Error("Batch size must be a positive integer.");
  }
  const batchSize = Math.min(requestedBatch, MAX_BATCH_SIZE);
  await input.eventStore.ensureIndexes();
  const rows = await input.outbox.listPending(batchSize);
  const result: DispatchResult = { read: rows.length, delivered: 0, failures: [] };

  for (const row of rows) {
    let event: AttendanceSessionFinalizedEvent;
    try {
      event = parseEvent(row);
    } catch (error) {
      result.failures.push({ eventId: row.eventId, stage: "validation", message: errorMessage(error) });
      continue;
    }

    try {
      await input.eventStore.persist(event);
    } catch (error) {
      result.failures.push({ eventId: row.eventId, stage: "mongo", message: errorMessage(error) });
      continue;
    }

    try {
      const marked = await input.outbox.markDeliveredIfPending(row.id, (input.now ?? (() => new Date()))());
      if (!marked) throw new Error("Outbox event was not marked delivered because it is no longer pending.");
      result.delivered += 1;
    } catch (error) {
      result.failures.push({ eventId: row.eventId, stage: "mysql", message: errorMessage(error) });
    }
  }
  return result;
}
