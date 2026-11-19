import { NextResponse } from "next/server";
import type { AuthenticatedUserContext } from "@/auth/policies";

type PublicUser = Pick<AuthenticatedUserContext, "id" | "email" | "role">;

export function authMeResponse(user: PublicUser | null): NextResponse {
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { id: user.id, email: user.email, role: user.role },
    { headers: { "Cache-Control": "no-store" } },
  );
}
