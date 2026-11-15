import bcrypt from "bcryptjs";
import { z } from "zod";
import type { UserRole } from "@/generated/prisma/enums";

export const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z
    .string()
    .min(1)
    .max(72)
    .refine((password) => Buffer.byteLength(password, "utf8") <= 72),
});

export type LoginCredentials = z.infer<typeof loginSchema>;

export type CredentialRecord = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
};

export type AuthenticatedCredentialUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

type FindCredentialUser = (normalizedEmail: string) => Promise<CredentialRecord | null>;
type ComparePassword = (password: string, passwordHash: string) => Promise<boolean>;

export async function authenticateCredentials(
  input: unknown,
  findUser: FindCredentialUser,
  comparePassword: ComparePassword = bcrypt.compare,
): Promise<AuthenticatedCredentialUser | null> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return null;

  const user = await findUser(parsed.data.email.toLowerCase());
  if (!user) return null;

  const passwordMatches = await comparePassword(
    parsed.data.password,
    user.passwordHash,
  );
  if (!passwordMatches) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}
