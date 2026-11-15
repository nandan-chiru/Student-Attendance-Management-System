import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/generated/prisma/client";

export async function listFacultyOfferings(facultyId: string) {
  const assignments = await prisma.offeringFaculty.findMany({
    where: { facultyId },
    select: {
      offering: {
        select: {
          id: true,
          sectionCode: true,
          attendanceThreshold: true,
          course: { select: { code: true, name: true, credits: true } },
          term: { select: { name: true, startDate: true, endDate: true, isActive: true } },
          enrollments: {
            where: { status: "ACTIVE" },
            orderBy: { student: { registrationNumber: "asc" } },
            select: {
              student: {
                select: {
                  id: true,
                  registrationNumber: true,
                  user: { select: { name: true } },
                },
              },
            },
          },
          attendanceSessions: {
            orderBy: [{ sessionDate: "desc" }, { createdAt: "desc" }],
            select: {
              id: true,
              sessionDate: true,
              topic: true,
              status: true,
              finalizedAt: true,
              _count: { select: { records: true } },
            },
          },
        },
      },
    },
  });

  return assignments.map(({ offering }) => offering).sort((a, b) =>
    a.course.code.localeCompare(b.course.code) || a.sectionCode.localeCompare(b.sectionCode),
  );
}

export async function findFacultySessionOfferingId(sessionId: string) {
  return prisma.attendanceSession.findUnique({
    where: { id: sessionId },
    select: { offeringId: true },
  });
}

export async function getFacultySessionDetails(sessionId: string) {
  return prisma.attendanceSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      offeringId: true,
      sessionDate: true,
      topic: true,
      status: true,
      finalizedAt: true,
      offering: {
        select: {
          sectionCode: true,
          course: { select: { code: true, name: true } },
          term: { select: { name: true } },
        },
      },
      records: {
        orderBy: { student: { registrationNumber: "asc" } },
        select: {
          status: true,
          markedAt: true,
          remarks: true,
          student: {
            select: {
              registrationNumber: true,
              user: { select: { name: true } },
            },
          },
        },
      },
    },
  });
}

export async function listStudentEnrollments(studentId: string) {
  return prisma.enrollment.findMany({
    where: { studentId, status: { in: ["ACTIVE", "COMPLETED"] } },
    orderBy: { enrolledAt: "asc" },
    select: {
      status: true,
      offering: {
        select: {
          id: true,
          sectionCode: true,
          attendanceThreshold: true,
          course: { select: { code: true, name: true, credits: true } },
          term: { select: { name: true } },
          attendanceSessions: {
            where: { status: "FINALIZED" },
            orderBy: [{ sessionDate: "desc" }, { createdAt: "desc" }],
            select: {
              id: true,
              sessionDate: true,
              topic: true,
              records: {
                where: { studentId },
                select: { status: true, markedAt: true, remarks: true },
              },
            },
          },
        },
      },
    },
  });
}

export async function findAssignedOffering(
  tx: Prisma.TransactionClient,
  offeringId: string,
  facultyId: string,
) {
  const assignment = await tx.offeringFaculty.findUnique({
    where: { offeringId_facultyId: { offeringId, facultyId } },
    select: { offeringId: true },
  });
  if (!assignment) return null;

  return tx.courseOffering.findUnique({
    where: { id: offeringId },
    select: {
      id: true,
      term: { select: { startDate: true, endDate: true } },
    },
  });
}

export async function findActiveEnrollmentStudentIds(
  tx: Prisma.TransactionClient,
  offeringId: string,
) {
  const enrollments = await tx.enrollment.findMany({
    where: { offeringId, status: "ACTIVE" },
    select: { studentId: true },
    orderBy: { studentId: "asc" },
  });
  return enrollments.map(({ studentId }) => studentId);
}

export async function findDuplicateAttendanceSession(
  tx: Prisma.TransactionClient,
  input: { offeringId: string; sessionDate: Date; topic: string | null },
) {
  return tx.attendanceSession.findFirst({
    where: {
      offeringId: input.offeringId,
      sessionDate: input.sessionDate,
      topic: input.topic,
      status: { in: ["DRAFT", "FINALIZED"] },
    },
    select: { id: true },
  });
}

export async function insertFinalizedSession(
  tx: Prisma.TransactionClient,
  input: {
    offeringId: string;
    sessionDate: Date;
    topic: string | null;
    createdBy: string;
    records: Array<{ studentId: string; status: "PRESENT" | "ABSENT" | "EXCUSED" }>;
  },
) {
  const session = await tx.attendanceSession.create({
    data: {
      offeringId: input.offeringId,
      sessionDate: input.sessionDate,
      topic: input.topic,
      status: "FINALIZED",
      finalizedAt: new Date(),
      createdBy: input.createdBy,
    },
    select: { id: true },
  });

  await tx.attendanceRecord.createMany({
    data: input.records.map(({ studentId, status }) => ({
      sessionId: session.id,
      studentId,
      status,
      markedBy: input.createdBy,
    })),
  });

  return session.id;
}
