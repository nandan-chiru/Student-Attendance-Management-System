import { getAuthenticatedUser } from "@/auth/session";
import type { UserRole } from "@/generated/prisma/enums";
import {
  assertAuthenticated,
  assertFacultyOfferingAssignment,
  assertStudentProfileAccess,
  assertUserRole,
  ForbiddenError,
  type AuthenticatedUserContext,
} from "@/auth/policies";

export async function requireAuthenticatedUser(): Promise<AuthenticatedUserContext> {
  return assertAuthenticated(await getAuthenticatedUser());
}

export async function requireRole(
  ...allowedRoles: UserRole[]
): Promise<AuthenticatedUserContext> {
  return assertUserRole(await getAuthenticatedUser(), ...allowedRoles);
}

export async function requireStudent(): Promise<AuthenticatedUserContext & { studentProfileId: string }> {
  return assertStudentProfileAccess(await getAuthenticatedUser());
}

/** Compares any requested profile ID to the profile derived from the signed-in user. */
export async function requireStudentProfile(
  requestedStudentProfileId?: string,
): Promise<AuthenticatedUserContext & { studentProfileId: string }> {
  return assertStudentProfileAccess(
    await getAuthenticatedUser(),
    requestedStudentProfileId,
  );
}

export async function requireFaculty(): Promise<AuthenticatedUserContext & { facultyProfileId: string }> {
  const user = await getAuthenticatedUser();
  const faculty = assertUserRole(user, "FACULTY");
  if (!faculty.facultyProfileId) {
    throw new ForbiddenError();
  }
  return { ...faculty, facultyProfileId: faculty.facultyProfileId };
}

/** Verifies the faculty/offering link in MySQL for every offering-scoped operation. */
export async function requireFacultyOffering(
  offeringId: string,
): Promise<AuthenticatedUserContext & { facultyProfileId: string }> {
  const faculty = await requireFaculty();
  const { prisma } = await import("@/lib/db/prisma");
  const assignment = await prisma.offeringFaculty.findUnique({
    where: {
      offeringId_facultyId: {
        offeringId,
        facultyId: faculty.facultyProfileId,
      },
    },
    select: { offeringId: true },
  });

  return assertFacultyOfferingAssignment(faculty, assignment !== null);
}

export async function requireAdmin(): Promise<AuthenticatedUserContext> {
  return requireRole("ADMIN");
}
