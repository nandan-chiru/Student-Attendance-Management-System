import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { LoginForm } from "@/auth/login-form";
import { getAuthenticatedUser } from "@/auth/session";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoadingState />}>
      <LoginContent />
    </Suspense>
  );
}

async function LoginContent() {
  await connection();

  if (await getAuthenticatedUser()) redirect("/auth/continue");

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
          Student Attendance Management System
        </p>
        <h1 className="mt-3 text-2xl font-bold text-slate-950">Sign in</h1>
        <p className="mt-2 text-sm text-slate-600">
          Use your institution account to continue.
        </p>
        <LoginForm />
      </section>
    </main>
  );
}

function LoginLoadingState() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <p role="status" className="text-sm text-slate-600">
        Loading sign-in…
      </p>
    </main>
  );
}
