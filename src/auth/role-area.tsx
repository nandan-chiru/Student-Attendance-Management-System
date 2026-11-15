import Link from "next/link";
import { logoutAction } from "@/auth/actions";
import type { UserRole } from "@/generated/prisma/enums";

const roleLabels: Record<UserRole, string> = {
  STUDENT: "Student",
  FACULTY: "Faculty",
  ADMIN: "Administrator",
};

export function RoleArea({ role, name }: { role: UserRole; name: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-12">
      <header className="flex items-start justify-between gap-6 border-b border-slate-200 pb-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            {roleLabels[role]} area
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Welcome, {name}</h1>
        </div>
        <form action={logoutAction}>
          <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Sign out
          </button>
        </form>
      </header>
      <section className="mt-8 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6">
        <h2 className="font-semibold text-slate-900">Role area under construction</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Authentication and server-side access checks are active. Attendance workflows and
          dashboard features will be implemented in a later project stage.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm font-medium text-blue-700 hover:underline">
          Return to project home
        </Link>
      </section>
    </main>
  );
}
