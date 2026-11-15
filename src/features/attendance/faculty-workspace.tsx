import Link from "next/link";
import { getFacultyAttendanceWorkspace } from "@/services/attendance/faculty";
import { SessionCreateForm } from "@/features/attendance/session-create-form";
import { RiskSummary } from "@/features/attendance/risk-summary";

function displayDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

export async function FacultyAttendanceWorkspace() {
  const offerings = await getFacultyAttendanceWorkspace();

  if (offerings.length === 0) {
    return (
      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-900">No assigned offerings</h2>
        <p className="mt-2 text-sm text-slate-600">
          Course offerings assigned to your faculty profile will appear here.
        </p>
      </section>
    );
  }

  return (
    <div className="mt-8 space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-slate-950">Assigned course offerings</h2>
        <p className="mt-1 text-sm text-slate-600">
          Only offerings assigned to your faculty profile are shown.
        </p>
        <Link href="/faculty/audit" className="mt-2 inline-block text-sm font-medium text-blue-700 hover:underline">
          View attendance event audit
        </Link>
      </div>

      {offerings.map((offering) => (
        <section key={offering.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-950">
                {offering.course.code} · {offering.course.name}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Section {offering.sectionCode} · {offering.term.name} · {offering.enrollments.length} active students
              </p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-800">
              {offering.attendanceSessions.filter((session) => session.status === "FINALIZED").length} finalized sessions
            </span>
          </div>

          <details className="mt-5">
            <summary className="cursor-pointer font-semibold text-slate-800">
              Create and finalize attendance
            </summary>
            <div className="mt-4">
              <SessionCreateForm
                offeringId={offering.id}
                students={offering.enrollments.map(({ student }) => ({
                  id: student.id,
                  registrationNumber: student.registrationNumber,
                  name: student.user.name,
                }))}
              />
            </div>
          </details>

          <div className="mt-7">
            <h4 className="font-semibold text-slate-900">Student attendance risk</h4>
            <p className="mt-1 text-sm text-slate-600">
              {offering.riskStudents.filter(({ risk }) => risk.status === "AT_RISK" || risk.status === "CRITICAL").length} of {offering.riskStudents.length} students are below the {offering.attendanceThreshold.toString()}% requirement. Analysis uses finalized MySQL records for this assigned offering.
            </p>
            {offering.riskStudents.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No active enrolled students.</p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Student</th>
                      <th className="px-4 py-3 font-semibold">Attended / held</th>
                      <th className="px-4 py-3 font-semibold">Attendance</th>
                      <th className="px-4 py-3 font-semibold">Risk and recommendation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {offering.riskStudents.map((student) => (
                      <tr key={student.id}>
                        <td className="px-4 py-3">
                          <span className="font-medium text-slate-900">{student.name}</span>
                          <span className="block text-slate-600">{student.registrationNumber}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{student.attendance.attended} / {student.attendance.held}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{student.risk.currentPercent.toFixed(2)}%</td>
                        <td className="min-w-72 px-4 py-3"><RiskSummary risk={student.risk} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-7">
            <h4 className="font-semibold text-slate-900">Session history</h4>
            {offering.attendanceSessions.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No sessions have been created.</p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Topic</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Marked</th>
                      <th className="px-4 py-3 font-semibold">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {offering.attendanceSessions.map((session) => (
                      <tr key={session.id}>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-800">{displayDate(session.sessionDate)}</td>
                        <td className="px-4 py-3 text-slate-600">{session.topic || "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{session.status.toLowerCase()}</td>
                        <td className="px-4 py-3 text-slate-600">{session._count.records}</td>
                        <td className="px-4 py-3">
                          <Link href={`/faculty/sessions/${session.id}`} className="font-medium text-blue-700 hover:underline">
                            View records
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
