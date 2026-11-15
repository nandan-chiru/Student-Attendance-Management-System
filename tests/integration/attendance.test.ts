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
});
