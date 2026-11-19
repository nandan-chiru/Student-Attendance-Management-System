import "server-only";

// Use this module from Next.js server code. Standalone Node workers import the
// core implementation directly so they do not need Next.js's marker package.
export {
  createMongoAttendanceEventStore,
  mongoAttendanceEventStore,
} from "@/dal/attendance/mongo-attendance-event-store-core";
