import type { UserRole } from "@/generated/prisma/enums";

export type AuthenticatedUserContext = {
  id: string;
  email: string;
  role: UserRole;
  studentProfileId: string | null;
  facultyProfileId: string | null;
};

export class AuthenticationRequiredError extends Error {
  readonly status = 401;

  constructor() {
    super("Authentication is required.");
    this.name = "AuthenticationRequiredError";
  }
}

export class ForbiddenError extends Error {
  readonly status = 403;

  constructor() {
    super("You do not have permission to access this resource.");
    this.name = "ForbiddenError";
  }
}

export function assertAuthenticated(
  user: AuthenticatedUserContext | null,
): AuthenticatedUserContext {
  if (!user) throw new AuthenticationRequiredError();
  return user;
}

export function assertUserRole(
  user: AuthenticatedUserContext | null,
  ...allowedRoles: UserRole[]
): AuthenticatedUserContext {
  const authenticatedUser = assertAuthenticated(user);
  if (!allowedRoles.includes(authenticatedUser.role)) throw new ForbiddenError();
  return authenticatedUser;
}

export function assertStudentProfileAccess(
  user: AuthenticatedUserContext | null,
  requestedStudentProfileId?: string,
): AuthenticatedUserContext & { studentProfileId: string } {
  const student = assertUserRole(user, "STUDENT");
  if (!student.studentProfileId) throw new ForbiddenError();

  if (
    requestedStudentProfileId &&
    requestedStudentProfileId !== student.studentProfileId
  ) {
    throw new ForbiddenError();
  }

  return { ...student, studentProfileId: student.studentProfileId };
}

export function assertFacultyOfferingAssignment(
  user: AuthenticatedUserContext | null,
  isAssigned: boolean,
): AuthenticatedUserContext & { facultyProfileId: string } {
  const faculty = assertUserRole(user, "FACULTY");
  if (!faculty.facultyProfileId || !isAssigned) throw new ForbiddenError();
  return { ...faculty, facultyProfileId: faculty.facultyProfileId };
}
