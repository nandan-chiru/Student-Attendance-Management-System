import { Prisma } from "@/generated/prisma/client";
import type { AttendanceStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import {
  findActiveEnrollmentStudentIds,
  findAssignedOffering,
  findDuplicateAttendanceSession,
  findFacultySessionOfferingId,
  getFacultySessionDetails as readFacultySessionDetails,
  insertFinalizedSession,
  listFacultyOfferings,
} from "@/dal/attendance/queries";
import { requireFaculty, requireFacultyOffering } from "@/auth/authorization";
import { calculateAttendance } from "@/services/attendance/calculations";
import { analyzeAttendanceRisk } from "@/services/attendance/risk";
import { ForbiddenError } from "@/auth/policies";
import {
  AttendanceConflictError,
  AttendanceNotFoundError,
  AttendanceValidationError,
} from "@/services/attendance/errors";
import {
  createAttendanceSessionSchema,
  assertCompleteAttendanceRoster,
} from "@/services/attendance/validation";

export async function getFacultyAttendanceWorkspace() {
  const faculty = await requireFaculty();
  const offerings = await listFacultyOfferings(faculty.facultyProfileId);

  return offerings.map((offering) => {
    const marksByStudent = new Map<string, AttendanceStatus[]>();
    for (const enrollment of offering.enrollments) marksByStudent.set(enrollment.student.id, []);
    for (const session of offering.attendanceSessions) {
      if (session.status !== "FINALIZED") continue;
      for (const record of session.records) {
        marksByStudent.get(record.studentId)?.push(record.status);
      }
    }

    const riskStudents = offering.enrollments.map(({ student }) => {
      const attendance = calculateAttendance(marksByStudent.get(student.id) ?? []);
      return {
        id: student.id,
        name: student.user.name,
        registrationNumber: student.registrationNumber,
        attendance,
        risk: analyzeAttendanceRisk({
          attended: attendance.attended,
          held: attendance.held,
          requiredPercent: Number(offering.attendanceThreshold),
        }),
      };
    });

    return { ...offering, riskStudents };
  });
}

export async function getFacultyAttendanceSession(sessionId: string) {
  const faculty = await requireFaculty();
  const session = await findFacultySessionOfferingId(sessionId);
  if (!session) throw new AttendanceNotFoundError("Attendance session was not found.");

  await requireFacultyOffering(session.offeringId);
  if (!faculty.facultyProfileId) throw new ForbiddenError();

  const details = await readFacultySessionDetails(sessionId);
  if (!details) throw new AttendanceNotFoundError("Attendance session was not found.");
  return details;
}

export async function createAttendanceSession(input: unknown) {
  const parsed = createAttendanceSessionSchema.safeParse(input);
  if (!parsed.success) {
    throw new AttendanceValidationError("Check the session date and each student's attendance status.");
  }

  const faculty = await requireFacultyOffering(parsed.data.offeringId);

  const sessionDate = new Date(`${parsed.data.sessionDate}T00:00:00.000Z`);

  try {
    return await prisma.$transaction(async (tx) => {
      const offering = await findAssignedOffering(
        tx,
        parsed.data.offeringId,
        faculty.facultyProfileId,
      );
      if (!offering) throw new ForbiddenError();

      const startDate = offering.term.startDate.toISOString().slice(0, 10);
      const endDate = offering.term.endDate.toISOString().slice(0, 10);
      if (parsed.data.sessionDate < startDate || parsed.data.sessionDate > endDate) {
        throw new AttendanceValidationError("The session date must fall within the offering's academic term.");
      }

      const activeStudentIds = await findActiveEnrollmentStudentIds(
        tx,
        parsed.data.offeringId,
      );
      if (activeStudentIds.length === 0) {
        throw new AttendanceConflictError("An attendance session requires active enrolled students.");
      }
      assertCompleteAttendanceRoster(parsed.data.records, activeStudentIds);

      const duplicate = await findDuplicateAttendanceSession(tx, {
        offeringId: parsed.data.offeringId,
        sessionDate,
        topic: parsed.data.topic,
      });
      if (duplicate) {
        throw new AttendanceConflictError("A session with this date and topic already exists for the offering.");
      }

      return insertFinalizedSession(tx, {
        offeringId: parsed.data.offeringId,
        sessionDate,
        topic: parsed.data.topic,
        createdBy: faculty.id,
        records: parsed.data.records,
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof AttendanceConflictError ||
        error instanceof AttendanceValidationError ||
        error instanceof ForbiddenError) {
      throw error;
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2034"
    ) {
      throw new AttendanceConflictError("Another attendance change conflicted with this save. Refresh and try again.");
    }
    throw error;
  }
}
