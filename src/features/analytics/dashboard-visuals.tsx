import type { AttendanceTrendPoint, OfferingAttendanceAnalytics } from "@/services/analytics/dashboard-metrics";

export function MetricCards({
  metrics,
}: {
  metrics: Array<{ label: string; value: string | number; detail?: string }>;
}) {
  return (
    <section aria-label="Dashboard summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <article key={metric.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-600">{metric.label}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-slate-950">{metric.value}</p>
          {metric.detail && <p className="mt-1 text-xs text-slate-500">{metric.detail}</p>}
        </article>
      ))}
    </section>
  );
}

export function AttendanceTrend({ title, points }: { title: string; points: AttendanceTrendPoint[] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-950">{title}</h2>
      <p className="mt-1 text-xs text-slate-500">Daily PRESENT / (PRESENT + ABSENT), based on finalized MySQL sessions. EXCUSED marks are excluded.</p>
      {points.length === 0 ? (
        <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No counted finalized attendance in this period.</p>
      ) : (
        <>
          <div aria-hidden="true" className="mt-5 flex h-40 items-end gap-2 border-b border-l border-slate-200 px-2">
            {points.map((point) => (
              <div key={point.date} className="flex h-full min-w-0 flex-1 flex-col justify-end text-center">
                <span className="mb-1 text-[10px] font-medium text-slate-600">{point.percentage}%</span>
                <div className="rounded-t bg-blue-600" style={{ height: `${Math.max(point.percentage, 2)}%` }} />
                <span className="mt-1 truncate text-[10px] text-slate-500">{point.date.slice(5)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">Daily attendance trend values</caption>
              <thead className="text-slate-600"><tr><th className="border-b px-3 py-2">Date</th><th className="border-b px-3 py-2">Attended</th><th className="border-b px-3 py-2">Absent</th><th className="border-b px-3 py-2">Rate</th></tr></thead>
              <tbody>{points.map((point) => (
                <tr key={point.date}>
                  <td className="border-b border-slate-100 px-3 py-2">{point.date}</td>
                  <td className="border-b border-slate-100 px-3 py-2">{point.attended}</td>
                  <td className="border-b border-slate-100 px-3 py-2">{point.absent}</td>
                  <td className="border-b border-slate-100 px-3 py-2 font-semibold">{point.percentage}%</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

export function OfferingComparison({ offerings, title = "Offering comparison" }: {
  offerings: OfferingAttendanceAnalytics[];
  title?: string;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-950">{title}</h2>
      {offerings.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">No offerings match the current scope.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr><th className="px-3 py-3">Course / offering</th><th className="px-3 py-3">Enrolled</th><th className="px-3 py-3">Finalized</th><th className="px-3 py-3">Attendance rate</th><th className="px-3 py-3">At risk</th><th className="px-3 py-3">Critical</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {offerings.map((offering) => (
                <tr key={offering.offeringId}>
                  <td className="px-3 py-3">
                    <span className="font-semibold text-slate-900">{offering.course.code} · {offering.course.name}</span>
                    <span className="block text-xs text-slate-600">Section {offering.sectionCode} · {offering.term.name}</span>
                  </td>
                  <td className="px-3 py-3 tabular-nums">{offering.enrollmentCount}</td>
                  <td className="px-3 py-3 tabular-nums">{offering.finalizedSessionCount}</td>
                  <td className="min-w-44 px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-blue-600" style={{ width: `${Math.min(offering.attendance.percentage, 100)}%` }} /></div>
                      <span className="w-14 text-right font-semibold tabular-nums">{offering.attendance.percentage.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 tabular-nums text-amber-800">{offering.atRiskStudentCount}</td>
                  <td className="px-3 py-3 tabular-nums text-red-800">{offering.criticalStudentCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function RiskDistribution({ atRisk, critical, noData }: { atRisk: number; critical: number; noData: number }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-950">Risk distribution</h2>
      <p className="mt-1 text-xs text-slate-500">Counts are unique students within the dashboard&apos;s authorized offering scope.</p>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg bg-amber-50 p-3"><p className="text-2xl font-bold text-amber-800">{atRisk}</p><p className="text-xs text-amber-900">At risk</p></div>
        <div className="rounded-lg bg-red-50 p-3"><p className="text-2xl font-bold text-red-800">{critical}</p><p className="text-xs text-red-900">Critical</p></div>
        <div className="rounded-lg bg-slate-100 p-3"><p className="text-2xl font-bold text-slate-800">{noData}</p><p className="text-xs text-slate-700">No data</p></div>
      </div>
    </section>
  );
}

export function RecentAttendanceActivity({ activities }: {
  activities: Array<{
    id: string;
    sessionDate: Date;
    topic: string | null;
    offering: { sectionCode: string; course: { code: string; name: string }; term: { name: string } };
    _count: { records: number };
  }>;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-950">Recent finalized sessions</h2>
      {activities.length === 0 ? <p className="mt-3 text-sm text-slate-600">No finalized sessions yet.</p> : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-600"><tr><th className="border-b px-3 py-2">Date</th><th className="border-b px-3 py-2">Course</th><th className="border-b px-3 py-2">Topic</th><th className="border-b px-3 py-2">Marks</th></tr></thead>
            <tbody>{activities.map((activity) => (
              <tr key={activity.id}>
                <td className="border-b border-slate-100 px-3 py-2">{activity.sessionDate.toISOString().slice(0, 10)}</td>
                <td className="border-b border-slate-100 px-3 py-2">{activity.offering.course.code} · {activity.offering.sectionCode} · {activity.offering.term.name}</td>
                <td className="border-b border-slate-100 px-3 py-2">{activity.topic || "—"}</td>
                <td className="border-b border-slate-100 px-3 py-2">{activity._count.records}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
