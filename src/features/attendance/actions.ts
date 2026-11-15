"use server";

import { revalidatePath } from "next/cache";
import type { AttendanceActionState } from "@/features/attendance/action-state";
import {
  AuthenticationRequiredError,
  ForbiddenError,
} from "@/auth/policies";
import { createAttendanceSession } from "@/services/attendance/faculty";
import {
  AttendanceConflictError,
  AttendanceNotFoundError,
  AttendanceValidationError,
} from "@/services/attendance/errors";

export async function createAttendanceSessionAction(
  _previousState: AttendanceActionState,
  formData: FormData,
): Promise<AttendanceActionState> {
  const studentIds = formData.getAll("studentId");
  const records = studentIds.map((studentId) => ({
    studentId,
    status: formData.get(`status:${String(studentId)}`),
  }));

  try {
    await createAttendanceSession({
      offeringId: formData.get("offeringId"),
      sessionDate: formData.get("sessionDate"),
      topic: formData.get("topic"),
      records,
    });
    revalidatePath("/faculty");
    return { status: "success", message: "Attendance saved and session finalized." };
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return { status: "error", message: "Your session has expired. Sign in again." };
    }
    if (error instanceof ForbiddenError) {
      return { status: "error", message: "You are not assigned to this course offering." };
    }
    if (error instanceof AttendanceValidationError || error instanceof AttendanceConflictError) {
      return { status: "error", message: error.message };
    }
    if (error instanceof AttendanceNotFoundError) {
      return { status: "error", message: "The course offering was not found." };
    }

    return { status: "error", message: "Attendance could not be saved. Refresh and try again." };
  }
}
