import { auth } from "../../auth";
import type { AuthenticatedUserContext } from "@/auth/policies";

/** Resolves the session identity against MySQL so deleted users and changed roles take effect immediately. */
export async function getAuthenticatedUser(): Promise<AuthenticatedUserContext | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const { prisma } = await import("@/lib/db/prisma");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      studentProfile: { select: { id: true } },
      facultyProfile: { select: { id: true } },
    },
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    studentProfileId: user.studentProfile?.id ?? null,
    facultyProfileId: user.facultyProfile?.id ?? null,
  };
}
