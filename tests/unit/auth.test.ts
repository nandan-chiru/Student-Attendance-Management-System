import assert from "node:assert/strict";
import { test } from "node:test";
import { authMeResponse } from "@/auth/auth-me-response";
import { authenticateCredentials } from "@/auth/credential-service";
import {
  assertAuthenticated,
  assertFacultyOfferingAssignment,
  assertStudentProfileAccess,
  assertUserRole,
  AuthenticationRequiredError,
  ForbiddenError,
  type AuthenticatedUserContext,
} from "@/auth/policies";

const student: AuthenticatedUserContext = {
  id: "user-student",
  email: "student@example.test",
  role: "STUDENT",
  studentProfileId: "student-profile-1",
  facultyProfileId: null,
};

const faculty: AuthenticatedUserContext = {
  id: "user-faculty",
  email: "faculty@example.test",
  role: "FACULTY",
  studentProfileId: null,
  facultyProfileId: "faculty-profile-1",
};

test("unauthenticated access is rejected", () => {
  assert.throws(() => assertAuthenticated(null), AuthenticationRequiredError);
});

test("student can pass their own role-area policy", () => {
  assert.equal(assertUserRole(student, "STUDENT").id, student.id);
});

test("student cannot pass faculty or admin role policies", () => {
  assert.throws(() => assertUserRole(student, "FACULTY"), ForbiddenError);
  assert.throws(() => assertUserRole(student, "ADMIN"), ForbiddenError);
});

test("faculty cannot pass admin role policy", () => {
  assert.throws(() => assertUserRole(faculty, "ADMIN"), ForbiddenError);
});

test("admin can pass the admin role policy", () => {
  const admin: AuthenticatedUserContext = { ...student, role: "ADMIN" };
  assert.equal(assertUserRole(admin, "ADMIN").role, "ADMIN");
});

test("student cannot request another student profile", () => {
  assert.throws(
    () => assertStudentProfileAccess(student, "another-student-profile"),
    ForbiddenError,
  );
  assert.equal(assertStudentProfileAccess(student, student.studentProfileId!).studentProfileId, student.studentProfileId);
});

test("faculty is denied when not assigned to an offering", () => {
  assert.throws(() => assertFacultyOfferingAssignment(faculty, false), ForbiddenError);
  assert.equal(assertFacultyOfferingAssignment(faculty, true).facultyProfileId, faculty.facultyProfileId);
});

test("auth me response excludes password hashes", async () => {
  const response = authMeResponse({ ...student, passwordHash: "must-not-escape" } as AuthenticatedUserContext);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body, { id: student.id, email: student.email, role: student.role });
  assert.equal("passwordHash" in body, false);
});

test("credential authentication returns safe identity only", async () => {
  const result = await authenticateCredentials(
    { email: "  STUDENT@EXAMPLE.TEST ", password: "safe-test-password" },
    async (email) => {
      assert.equal(email, "student@example.test");
      return {
        id: student.id,
        name: "Test Student",
        email: student.email,
        passwordHash: "test-hash",
        role: "STUDENT",
      };
    },
    async (password, hash) => password === "safe-test-password" && hash === "test-hash",
  );
  assert.deepEqual(result, {
    id: student.id,
    name: "Test Student",
    email: student.email,
    role: "STUDENT",
  });
});
