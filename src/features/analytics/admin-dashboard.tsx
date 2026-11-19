import Link from "next/link";
import {
  AttendanceTrend,
  MetricCards,
  OfferingComparison,
  RecentAttendanceActivity,
  RiskDistribution,
} from "@/features/analytics/dashboard-visuals";
import { getAdminAttendanceDashboard } from "@/services/analytics/admin-dashboard";

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export async function AdminAnalyticsDashboard() {
  const dashboard = await getAdminAttendanceDashboard();

  return (
    <div className="mt-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">Institution attendance overview</h2>
          <p className="mt-1 text-sm text-slate-600">Entity totals and the overall rate use MySQL. Offering comparison and risk counts focus on active-term offerings.</p>
        </div>
        <Link href="/admin/audit" className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50">Open event audit</Link>
      </header>

      <MetricCards metrics={[
        { label: "Students", value: dashboard.students },
        { label: "Faculty", value: dashboard.faculty },
        { label: "Courses", value: dashboard.courses },
        { label: "Active offerings", value: dashboard.activeOfferings },
        { label: "Finalized sessions", value: dashboard.finalizedSessions },
        { label: "Overall attendance", value: formatPercent(dashboard.overallAttendance.percentage), detail: `${dashboard.overallAttendance.attended} attended / ${dashboard.overallAttendance.held} counted marks` },
        { label: "At-risk students", value: dashboard.atRiskStudentCount, detail: "Unique across active offerings" },
        { label: "Critical students", value: dashboard.criticalStudentCount, detail: "Unique across active offerings" },
      ]} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
        <AttendanceTrend title="Institution attendance trend" points={dashboard.trend} />
        <RiskDistribution atRisk={dashboard.atRiskStudentCount} critical={dashboard.criticalStudentCount} noData={dashboard.noDataStudentCount} />
      </div>
      <OfferingComparison offerings={dashboard.offerings} title="Active offering comparison" />
      <RecentAttendanceActivity activities={dashboard.recentActivity} />
      <p className="text-xs text-slate-500">Recent sessions and risk summaries use MySQL. The separate audit page reports MongoDB event history and does not replace attendance totals.</p>
    </div>
  );
}
