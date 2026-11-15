import assert from "node:assert/strict";
import { test } from "node:test";
import { createAttendanceSessionFinalizedEvent, type AttendanceSessionFinalizedEvent } from "@/services/attendance/events";
import {
  dispatchPendingOutboxBatch,
  type AttendanceEventStore,
  type OutboxRepository,
  type PendingOutboxEvent,
} from "@/services/attendance/outbox-dispatcher";
import { persistAttendanceEvent, type MongoAttendanceEventCollection } from "@/services/attendance/mongo-event-persistence";

const event = createAttendanceSessionFinalizedEvent({
  eventId: "1f876756-5314-4c79-9d39-68b35767d8ee",
  occurredAt: new Date("2026-11-15T10:00:00.000Z"),
  sessionId: "e5df7a81-3085-4fce-a37a-46d9a62b0d5c",
  offeringId: "0fbcb820-b41d-48e4-94b3-122f9e025b69",
  facultyId: "8d3e2111-a36c-417a-a942-2624365a7a6b",
  affectedStudentCount: 3,
  sessionDate: "2026-11-15",
});

function row(overrides: Partial<PendingOutboxEvent> = {}): PendingOutboxEvent {
  return {
    id: "f69b890d-b7f5-4f91-87a0-b8d0175ceaa0",
    eventId: event.eventId,
    eventType: event.eventType,
    payload: event,
    createdAt: new Date("2026-11-15T10:00:00.000Z"),
    ...overrides,
  };
}

function setup(options: {
  source?: PendingOutboxEvent[];
  persist?: (payload: AttendanceSessionFinalizedEvent) => Promise<"inserted" | "already_present">;
  mark?: () => Promise<boolean>;
} = {}) {
  const source = options.source ?? [row()];
  const calls = { ensured: 0, persisted: 0, marked: 0, batch: 0 };
  const outbox: OutboxRepository = {
    async listPending(limit) { calls.batch = limit; return source; },
    async markDeliveredIfPending() { calls.marked += 1; return options.mark ? options.mark() : true; },
  };
  const eventStore: AttendanceEventStore = {
    async ensureIndexes() { calls.ensured += 1; },
    async persist(value) { calls.persisted += 1; return options.persist ? options.persist(value) : "inserted"; },
  };
  return { outbox, eventStore, calls };
}

test("successfully persists a validated event before marking SQL delivered", async () => {
  const harness = setup();
  const result = await dispatchPendingOutboxBatch({ ...harness, now: () => new Date("2026-11-15T11:00:00.000Z") });
  assert.deepEqual(result, { read: 1, delivered: 1, failures: [] });
  assert.equal(harness.calls.ensured, 1);
  assert.equal(harness.calls.persisted, 1);
  assert.equal(harness.calls.marked, 1);
});

test("an identical event already in Mongo is an idempotent successful delivery", async () => {
  const harness = setup({ persist: async () => "already_present" });
  const result = await dispatchPendingOutboxBatch(harness);
  assert.equal(result.delivered, 1);
  assert.equal(harness.calls.marked, 1);
});

test("Mongo failure leaves the outbox event pending", async () => {
  const harness = setup({ persist: async () => { throw new Error("Mongo unavailable"); } });
  const result = await dispatchPendingOutboxBatch(harness);
  assert.equal(result.delivered, 0);
  assert.equal(result.failures[0]?.stage, "mongo");
  assert.equal(harness.calls.marked, 0);
});

test("SQL acknowledgement failure leaves the event retryable after Mongo persistence", async () => {
  const harness = setup({ mark: async () => { throw new Error("SQL update failed"); } });
  const result = await dispatchPendingOutboxBatch(harness);
  assert.equal(result.delivered, 0);
  assert.equal(result.failures[0]?.stage, "mysql");
  assert.equal(harness.calls.persisted, 1);
  assert.equal(harness.calls.marked, 1);
});

test("invalid payload remains pending and is never sent to Mongo", async () => {
  const harness = setup({ source: [row({ payload: { unexpected: true } })] });
  const result = await dispatchPendingOutboxBatch(harness);
  assert.equal(result.failures[0]?.stage, "validation");
  assert.equal(harness.calls.persisted, 0);
  assert.equal(harness.calls.marked, 0);
});

test("payload event identity mismatch remains pending and is never sent to Mongo", async () => {
  const harness = setup({ source: [row({ payload: { ...event, eventId: "f1c37fe4-a94e-4c76-bf95-c03bb6e661fb" } })] });
  const result = await dispatchPendingOutboxBatch(harness);
  assert.equal(result.failures[0]?.stage, "validation");
  assert.equal(harness.calls.persisted, 0);
  assert.equal(harness.calls.marked, 0);
});

test("conflicting Mongo event remains pending", async () => {
  const harness = setup({ persist: async () => { throw new Error("Conflicting Mongo event"); } });
  const result = await dispatchPendingOutboxBatch(harness);
  assert.equal(result.failures[0]?.stage, "mongo");
  assert.equal(harness.calls.marked, 0);
});

test("pending query limit is bounded", async () => {
  const harness = setup();
  await dispatchPendingOutboxBatch({ ...harness, batchSize: 2_000 });
  assert.equal(harness.calls.batch, 500);
});

test("Mongo event persistence inserts by eventId and accepts an identical existing document", async () => {
  let stored: (AttendanceSessionFinalizedEvent & { _id?: string }) | null = null;
  let upsert = false;
  const collection: MongoAttendanceEventCollection = {
    async updateOne(filter, update, options) {
      assert.equal(filter.eventId, event.eventId);
      assert.deepEqual(update.$setOnInsert, event);
      assert.equal(options.upsert, true);
      if (stored) return { upsertedCount: 0 };
      stored = { ...update.$setOnInsert, _id: "mongo-id" };
      upsert = true;
      return { upsertedCount: 1 };
    },
    async findOne(filter) { assert.equal(filter.eventId, event.eventId); return stored; },
  };
  assert.equal(await persistAttendanceEvent(collection, event), "inserted");
  assert.equal(upsert, true);
  assert.equal(await persistAttendanceEvent(collection, event), "already_present");
});

test("Mongo event persistence does not overwrite conflicting content", async () => {
  const conflicting = { ...event, affectedStudentCount: 9 };
  const collection: MongoAttendanceEventCollection = {
    async updateOne() { return { upsertedCount: 0 }; },
    async findOne() { return conflicting; },
  };
  await assert.rejects(persistAttendanceEvent(collection, event), /conflicting content/);
  assert.equal(conflicting.affectedStudentCount, 9);
});

test("Mongo event persistence confirms a duplicate-key race by reading the identical document", async () => {
  const collection: MongoAttendanceEventCollection = {
    async updateOne() { throw Object.assign(new Error("duplicate"), { code: 11000 }); },
    async findOne() { return { ...event, _id: "winning-worker" }; },
  };
  assert.equal(await persistAttendanceEvent(collection, event), "already_present");
});
