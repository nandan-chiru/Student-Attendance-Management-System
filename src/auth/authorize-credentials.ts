import { authenticateCredentials } from "@/auth/credential-service";

export async function authorizeCredentials(input: unknown) {
  return authenticateCredentials(input, async (email) => {
    const { prisma } = await import("@/lib/db/prisma");

    return prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,
        role: true,
      },
    });
  });
}
