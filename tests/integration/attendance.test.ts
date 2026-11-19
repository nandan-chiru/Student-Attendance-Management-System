import "dotenv/config";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";

const testDatabaseUrl = process.env.ATTENDANCE_TEST_DATABASE_URL;
let testPrisma: PrismaClient | undefined;

if (testDatabaseUrl) {
  const parsedUrl = new URL(testDatabaseUrl);
  const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ""));
  if (!databaseName.endsWith("_test")) {
    throw new Error("ATTENDANCE_TEST_DATABASE_URL must target a database ending in _test.");
  }

  testPrisma = new PrismaClient({
    adapter: new PrismaMariaDb({
      host: parsedUrl.hostname,
      port: parsedUrl.port ? Number(parsedUrl.port) : 3306,
      user: decodeURIComponent(parsedUrl.username),
      password: decodeURIComponent(parsedUrl.password),
      database: databaseName,
      connectionLimit: 2,
    }),
  });
}

after(async () => {
  await testPrisma?.$disconnect();
});

test("MySQL attendance integration: seeded relationships, uniqueness, and rollback", {
  skip: !testPrisma ? "Set ATTENDANCE_TEST_DATABASE_URL to a migrated, seeded *_test database." : false,
}, async (t) => {
  if (!testPrisma) return;
  const db = testPrisma;
  const { insertFinalizedSessionWithOutbox } = await import("@/dal/attendance/commands");

  const facultyOneUser = await db.user.findUniqueOrThrow({
    where: { email: "faculty.one@attendance-demo.test" },
    select: { id: true, facultyProfile: { select: { id: true } } },
  });
  const facultyTwoUser = await db.user.findUniqueOrThrow({
    where: { email: "faculty.two@attendance-demo.test" },
    select: { facultyProfile: { select: { id: true } } },
  });
  const offering = await db.courseOffering.findFirstOrThrow({
    where: { course: { code: "DBMS301" } },
    select: { id: true, term: { select: { startDate: true } } },
  });

  await t.test("assigned faculty has the offering assignment", async () => {
    assert.ok(facultyOneUser.facultyProfile);
    const assignment = await db.offeringFaculty.findUnique({
      where: {
        offeringId_facultyId: {
          offeringId: offering.id,
          facultyId: facultyOneUser.facultyProfile.id,
        },
      },
    });
    assert.ok(assignment);
  });

  await t.test("unassigned faculty has no matching offering assignment", async () => {
    assert.ok(facultyTwoUser.facultyProfile);
    const assignment = await db.offeringFaculty.findUnique({
      where: {
        offeringId_facultyId: {
          offeringId: offering.id,
          facultyId: facultyTwoUser.facultyProfile.id,
        },
      },
    });
    assert.equal(assignment, null);
  });

  await t.test("student attendance records remain scoped to the selected profile", async () => {
    const student = await db.studentProfile.findFirstOrThrow({
      where: { user: { email: "student.1@attendance-demo.test" } },
      select: { id: true },
    });
    const records = await db.attendanceRecord.findMany({
      where: { studentId: student.id, session: { status: "FINALIZED" } },
      select: { studentId: true },
    });
    assert.ok(records.length > 0);
    assert.ok(records.every((record) => record.studentId === student.id));
  });

  await t.test("database unique key rejects duplicate attendance marks", async () => {
    const existing = await db.attendanceRecord.findFirstOrThrow({
      where: { session: { offeringId: offering.id, status: "FINALIZED" } },
      select: { sessionId: true, studentId: true, status: true, markedBy: true },
    });
    await assert.rejects(
      db.attendanceRecord.create({
        data: { id: randomUUID(), ...existing },
      }),
      (error: unknown) =>
        typeof error === "object" && error !== null && "code" in error && error.code === "P2002",
    );
  });

  await t.test("session and records roll back together on transaction failure", async () => {
    assert.ok(facultyOneUser.facultyProfile);
    const enrollments = await db.enrollment.findMany({
      where: { offeringId: offering.id, status: "ACTIVE" },
      select: { studentId: true },
    });
    const topic = `rollback-test-${randomUUID()}`;
    const sessionDate = new Date(offering.term.startDate);
    const beforeSessions = await db.attendanceSession.count({
      where: { offeringId: offering.id, topic },
    });
    const beforeRecords = await db.attendanceRecord.count({
      where: { session: { offeringId: offering.id, topic } },
    });

    await assert.rejects(db.$transaction(async (tx) => {
      const session = await tx.attendanceSession.create({
        data: {
          offeringId: offering.id,
          sessionDate,
          topic,
          status: "FINALIZED",
          finalizedAt: new Date(),
          createdBy: facultyOneUser.id,
        },
        select: { id: true },
      });
      await tx.attendanceRecord.createMany({
        data: enrollments.map(({ studentId }) => ({
          sessionId: session.id,
          studentId,
          status: "PRESENT",
          markedBy: facultyOneUser.id,
        })),
      });
      throw new Error("intentional transaction rollback");
    }), /intentional transaction rollback/);

    assert.equal(await db.attendanceSession.count({ where: { offeringId: offering.id, topic } }), beforeSessions);
    assert.equal(await db.attendanceRecord.count({ where: { session: { offeringId: offering.id, topic } } }), beforeRecords);
  });

  await t.test("finalized attendance and exactly one pending outbox event commit together without MongoDB", async () => {
    const facultyProfile = facultyOneUser.facultyProfile;
    assert.ok(facultyProfile);
    const enrollments = await db.enrollment.findMany({
      where: { offeringId: offering.id, status: "ACTIVE" },
      select: { studentId: true },
      orderBy: { studentId: "asc" },
    });
    const topic = `outbox-success-${randomUUID()}`;
    const eventId = randomUUID();
    const records = enrollments.map(({ studentId }, index) => ({
      studentId,
      status: index % 2 === 0 ? "PRESENT" as const : "ABSENT" as const,
    }));
    let sessionId: string | undefined;
    const originalMongoUri = process.env.MONGODB_URI;
    process.env.MONGODB_URI = "mongodb://127.0.0.1:1";

    try {
      sessionId = await db.$transaction((tx) => insertFinalizedSessionWithOutbox(tx, {
        offeringId: offering.id,
        sessionDate: new Date(offering.term.startDate),
        topic,
        createdBy: facultyOneUser.id,
        facultyId: facultyProfile.id,
        records,
      }, eventId));

      const savedSession = await db.attendanceSession.findUniqueOrThrow({
        where: { id: sessionId },
        select: {
          status: true,
          records: { select: { studentId: true, status: true } },
          outboxEvents: {
            select: { eventId: true, eventType: true, deliveredAt: true, payload: true },
          },
        },
      });
      assert.equal(savedSession.status, "FINALIZED");
      assert.equal(savedSession.records.length, records.length);
      assert.deepEqual(
        savedSession.records.map(({ studentId, status }) => ({ studentId, status })).sort((a, b) => a.studentId.localeCompare(b.studentId)),
        records.slice().sort((a, b) => a.studentId.localeCompare(b.studentId)),
      );
      assert.equal(savedSession.outboxEvents.length, 1);
      assert.equal(savedSession.outboxEvents[0].eventId, eventId);
      assert.equal(savedSession.outboxEvents[0].eventType, "ATTENDANCE_SESSION_FINALIZED");
      assert.equal(savedSession.outboxEvents[0].deliveredAt, null);
      assert.deepEqual(savedSession.outboxEvents[0].payload, {
        eventId,
        eventType: "ATTENDANCE_SESSION_FINALIZED",
        occurredAt: (await db.attendanceSession.findUniqueOrThrow({
          where: { id: sessionId },
          select: { finalizedAt: true },
        })).finalizedAt?.toISOString(),
        sessionId,
        offeringId: offering.id,
        facultyId: facultyProfile.id,
        affectedStudentCount: records.length,
        metadata: { schemaVersion: 1, sessionDate: new Date(offering.term.startDate).toISOString().slice(0, 10) },
      });
    } finally {
      try {
        if (sessionId) {
          await db.$transaction(async (tx) => {
            await tx.outboxEvent.deleteMany({ where: { sessionId } });
            await tx.attendanceRecord.deleteMany({ where: { sessionId } });
            await tx.attendanceSession.deleteMany({ where: { id: sessionId } });
          });
        }
      } finally {
        if (originalMongoUri === undefined) {
          delete process.env.MONGODB_URI;
        } else {
          process.env.MONGODB_URI = originalMongoUri;
        }
      }
    }
  });

  await t.test("attendance record failure leaves no session, marks, or outbox event", async () => {
    const facultyProfile = facultyOneUser.facultyProfile;
    assert.ok(facultyProfile);
    const topic = `outbox-record-failure-${randomUUID()}`;
    await assert.rejects(db.$transaction((tx) => insertFinalizedSessionWithOutbox(tx, {
      offeringId: offering.id,
      sessionDate: new Date(offering.term.startDate),
      topic,
      createdBy: facultyOneUser.id,
      facultyId: facultyProfile.id,
      records: [{ studentId: randomUUID(), status: "PRESENT" }],
    }, randomUUID())));

    assert.equal(await db.attendanceSession.count({ where: { offeringId: offering.id, topic } }), 0);
    assert.equal(await db.attendanceRecord.count({ where: { session: { offeringId: offering.id, topic } } }), 0);
    assert.equal(await db.outboxEvent.count({
      where: { session: { offeringId: offering.id, topic }, eventType: "ATTENDANCE_SESSION_FINALIZED" },
    }), 0);
  });

  await t.test("outbox uniqueness failure rolls back the session and attendance records", async () => {
    const facultyProfile = facultyOneUser.facultyProfile;
    assert.ok(facultyProfile);
    const eventId = randomUUID();
    const topic = `outbox-insert-failure-${randomUUID()}`;
    await db.outboxEvent.create({
      data: { eventId, eventType: "TEST_IDEMPOTENCY_SENTINEL", payload: { testOnly: true } },
    });

    try {
      const enrollments = await db.enrollment.findMany({
        where: { offeringId: offering.id, status: "ACTIVE" },
        select: { studentId: true },
      });
      await assert.rejects(db.$transaction((tx) => insertFinalizedSessionWithOutbox(tx, {
        offeringId: offering.id,
        sessionDate: new Date(offering.term.startDate),
        topic,
        createdBy: facultyOneUser.id,
        facultyId: facultyProfile.id,
        records: enrollments.map(({ studentId }) => ({ studentId, status: "PRESENT" as const })),
      }, eventId)));

      assert.equal(await db.attendanceSession.count({ where: { offeringId: offering.id, topic } }), 0);
      assert.equal(await db.attendanceRecord.count({ where: { session: { offeringId: offering.id, topic } } }), 0);
      assert.equal(await db.outboxEvent.count({ where: { eventId } }), 1);
    } finally {
      await db.outboxEvent.deleteMany({ where: { eventId } });
    }
  });

  await t.test("the seeded offering's existing finalized date/topic is still detected as a duplicate", async () => {
    const existing = await db.attendanceSession.findFirstOrThrow({
      where: { offeringId: offering.id, status: "FINALIZED" },
      select: { sessionDate: true, topic: true },
    });
    const duplicate = await db.attendanceSession.findFirst({
      where: {
        offeringId: offering.id,
        sessionDate: existing.sessionDate,
        topic: existing.topic,
        status: { in: ["DRAFT", "FINALIZED"] },
      },
      select: { id: true },
    });
    assert.ok(duplicate);
  });
});
