import { authMeResponse } from "@/auth/auth-me-response";
import { getAuthenticatedUser } from "@/auth/session";

export async function GET() {
  return authMeResponse(await getAuthenticatedUser());
}
