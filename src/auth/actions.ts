"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "../../auth";
import { loginSchema } from "@/auth/credential-service";

export type LoginActionState = { error: string | null };

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) return { error: "Enter a valid email and password." };

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/auth/continue",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }

    throw error;
  }

  return { error: "Unable to sign in." };
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
