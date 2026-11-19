export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-900">
      <div className="max-w-2xl text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">
          DBMS Level 3 Project
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Student Attendance Management System
        </h1>
        <a href="/login" className="mt-8 inline-flex rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800">
          Sign in
        </a>
      </div>
    </main>
  );
}
