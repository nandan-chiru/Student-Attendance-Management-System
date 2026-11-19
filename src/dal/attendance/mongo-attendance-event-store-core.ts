import type { Collection, Document } from "mongodb";
import { getMongoDatabase } from "@/lib/db/mongodb-client";
import { ATTENDANCE_EVENTS_COLLECTION, type AttendanceSessionFinalizedEvent } from "@/services/attendance/events";
import type { AttendanceEventStore } from "@/services/attendance/outbox-dispatcher";
import { persistAttendanceEvent } from "@/services/attendance/mongo-event-persistence";

type EventDocument = AttendanceSessionFinalizedEvent & Document;
type EventCollection = Pick<Collection<EventDocument>, "createIndex" | "updateOne" | "findOne">;

export function createMongoAttendanceEventStore(getCollection: () => Promise<EventCollection>): AttendanceEventStore {
  return {
    async ensureIndexes() {
      const collection = await getCollection();
      await collection.createIndex({ eventId: 1 }, { unique: true, name: "attendance_events_eventId_unique" });
      await collection.createIndex({ occurredAt: -1 }, { name: "attendance_events_occurredAt_desc_idx" });
      await collection.createIndex(
        { offeringId: 1, occurredAt: -1 },
        { name: "attendance_events_offering_occurredAt_idx" },
      );
    },
    async persist(event) {
      const collection = await getCollection();
      return persistAttendanceEvent(collection, event);
    },
  };
}

export const mongoAttendanceEventStore = createMongoAttendanceEventStore(async () => {
  const collection = (await getMongoDatabase()).collection<EventDocument>(ATTENDANCE_EVENTS_COLLECTION);
  return collection;
});
