import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/auth/authorization";

export const instant = false;

const roleDestination = {
  STUDENT: "/student",
  FACULTY: "/faculty",
  ADMIN: "/admin",
} as const;

export default async function ContinuePage() {
  const user = await requireAuthenticatedUser();
  redirect(roleDestination[user.role]);
}
