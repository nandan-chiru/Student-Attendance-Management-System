import { Suspense } from "react";
import { connection } from "next/server";
import type { ReactNode } from "react";
import type { UserRole } from "@/generated/prisma/enums";
import { requireRoleForPage } from "@/auth/page-guards";
import { RoleArea } from "@/auth/role-area";

export function ProtectedRolePage({ role, children }: { role: UserRole; children?: ReactNode }) {
  return (
    <Suspense fallback={<RolePageLoadingState />}>
      <ProtectedRoleContent role={role}>{children}</ProtectedRoleContent>
    </Suspense>
  );
}

async function ProtectedRoleContent({ role, children }: { role: UserRole; children?: ReactNode }) {
  await connection();

  const user = await requireRoleForPage(role);
  return <RoleArea role={user.role} name={user.email}>{children}</RoleArea>;
}

function RolePageLoadingState() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl items-center px-6 py-12">
      <p role="status" className="text-sm text-slate-600">
        Loading your secure area…
      </p>
    </main>
  );
}
