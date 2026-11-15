import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  AuthenticationRequiredError,
  ForbiddenError,
} from "@/auth/policies";
import { getFacultyAttendanceSession } from "@/services/attendance/faculty";
import { AttendanceNotFoundError } from "@/services/attendance/errors";

function displayDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

export async function FacultySessionDetails({ sessionId }: { sessionId: string }) {
  const session = await loadAuthorizedSession(sessionId);

  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <Link href="/faculty" className="text-sm font-medium text-blue-700 hover:underline">
        ← Back to offerings
      </Link>
      <h2 className="mt-4 text-xl font-semibold text-slate-950">
        {session.offering.course.code} · {session.offering.course.name}
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Section {session.offering.sectionCode} · {session.offering.term.name} · {displayDate(session.sessionDate)}
        {session.topic ? ` · ${session.topic}` : ""}
      </p>
      <p className="mt-3 text-sm text-slate-600">
        Session is {session.status.toLowerCase()}. Finalized attendance is read-only to preserve history.
      </p>

      <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Student</th>
              <th className="px-4 py-3 font-semibold">Registration No.</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Marked at</th>
              <th className="px-4 py-3 font-semibold">Remarks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {session.records.map((record) => (
              <tr key={record.student.registrationNumber}>
                <td className="px-4 py-3 text-slate-900">{record.student.user.name}</td>
                <td className="px-4 py-3 text-slate-600">{record.student.registrationNumber}</td>
                <td className="px-4 py-3 text-slate-800">{record.status.toLowerCase()}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{displayDate(record.markedAt)}</td>
                <td className="px-4 py-3 text-slate-600">{record.remarks || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {session.records.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">This session has no attendance records.</p>
        ) : null}
      </div>
    </section>
  );
}

async function loadAuthorizedSession(sessionId: string) {
  try {
    return await getFacultyAttendanceSession(sessionId);
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) redirect("/login");
    if (error instanceof ForbiddenError) redirect("/forbidden");
    if (error instanceof AttendanceNotFoundError) notFound();
    throw error;
  }
}
