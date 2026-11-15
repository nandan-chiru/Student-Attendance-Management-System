import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6">
      <h1 className="text-3xl font-bold text-slate-950">Access denied</h1>
      <p className="mt-3 text-slate-600">
        Your account does not have permission to open this area.
      </p>
      <Link href="/" className="mt-6 font-medium text-blue-700 hover:underline">
        Return to home
      </Link>
    </main>
  );
}
