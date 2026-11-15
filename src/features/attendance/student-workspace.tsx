import { getStudentAttendanceOverview } from "@/services/attendance/student";
import { RiskSummary } from "@/features/attendance/risk-summary";

function displayDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

function percentage(value: number) {
  return `${value.toFixed(2).replace(/\.00$/, "")}%`;
}

export async function StudentAttendanceWorkspace() {
  const { courses, overall, overallRisk } = await getStudentAttendanceOverview();

  return (
    <div className="mt-8 space-y-8">
      <section className="rounded-xl border border-blue-100 bg-blue-50 p-5">
        <h2 className="font-semibold text-slate-950">Overall attendance</h2>
        <p className="mt-2 text-3xl font-bold text-blue-800">{percentage(overall.percentage)}</p>
        <p className="mt-1 text-sm text-slate-700">
          {overall.attended} attended of {overall.held} counted classes across your enrolled courses
          {overall.excused > 0 ? ` · ${overall.excused} excused classes excluded` : ""}.
        </p>
        <div className="mt-4 border-t border-blue-100 pt-4">
          <RiskSummary risk={overallRisk} />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-950">Course attendance</h2>
        {courses.length === 0 ? (
          <p className="mt-3 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            You do not have active or completed course enrollments.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Course</th>
                  <th className="px-4 py-3 font-semibold">Term / section</th>
                  <th className="px-4 py-3 font-semibold">Attended</th>
                  <th className="px-4 py-3 font-semibold">Absent</th>
                  <th className="px-4 py-3 font-semibold">Held</th>
                  <th className="px-4 py-3 font-semibold">Attendance</th>
                  <th className="px-4 py-3 font-semibold">Status and recovery</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {courses.map((course) => (
                  <tr key={course.offeringId}>
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-900">{course.course.code}</span>
                      <span className="block text-slate-600">{course.course.name}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{course.term.name} · {course.sectionCode}</td>
                    <td className="px-4 py-3 text-slate-800">{course.attendance.attended}</td>
                    <td className="px-4 py-3 text-slate-800">{course.attendance.absent}</td>
                    <td className="px-4 py-3 text-slate-800">{course.attendance.held}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{percentage(course.attendance.percentage)}</td>
                    <td className="min-w-64 px-4 py-3"><RiskSummary risk={course.risk} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-950">Attendance history</h2>
        <div className="mt-3 space-y-3">
          {courses.map((course) => (
            <details key={course.offeringId} className="rounded-xl border border-slate-200 bg-white p-4">
              <summary className="cursor-pointer font-medium text-slate-900">
                {course.course.code} · {course.course.name}
              </summary>
              {course.history.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No finalized attendance records yet.</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-slate-600">
                      <tr>
                        <th className="border-b px-3 py-2 font-semibold">Date</th>
                        <th className="border-b px-3 py-2 font-semibold">Topic</th>
                        <th className="border-b px-3 py-2 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {course.history.map((entry) => (
                        <tr key={entry.sessionId}>
                          <td className="border-b border-slate-100 px-3 py-2 text-slate-800">{displayDate(entry.sessionDate)}</td>
                          <td className="border-b border-slate-100 px-3 py-2 text-slate-600">{entry.topic || "—"}</td>
                          <td className="border-b border-slate-100 px-3 py-2 text-slate-800">{entry.status.toLowerCase()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
