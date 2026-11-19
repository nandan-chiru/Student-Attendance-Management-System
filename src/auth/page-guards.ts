import { redirect } from "next/navigation";
import type { UserRole } from "@/generated/prisma/enums";
import {
  requireAdmin,
  requireFaculty,
  requireStudent,
} from "@/auth/authorization";
import {
  AuthenticationRequiredError,
  ForbiddenError,
} from "@/auth/policies";

export async function requireRoleForPage(role: UserRole) {
  try {
    switch (role) {
      case "STUDENT":
        return await requireStudent();
      case "FACULTY":
        return await requireFaculty();
      case "ADMIN":
        return await requireAdmin();
    }
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) redirect("/login");
    if (error instanceof ForbiddenError) redirect("/forbidden");
    throw error;
  }
}
