import {
  AttendanceTrend,
  MetricCards,
  OfferingComparison,
  RecentAttendanceActivity,
  RiskDistribution,
} from "@/features/analytics/dashboard-visuals";
import { getFacultyAttendanceDashboard } from "@/services/analytics/faculty-dashboard";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function scalar(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export async function FacultyAnalyticsDashboard({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const dashboard = await getFacultyAttendanceDashboard({
    offeringId: scalar(params.offeringId),
    termId: scalar(params.termId),
    fromDate: scalar(params.fromDate),
    toDate: scalar(params.toDate),
  });

  const trendQuery = new URLSearchParams();
  if (dashboard.filters.offeringId) trendQuery.set("offeringId", dashboard.filters.offeringId);
  if (dashboard.filters.termId) trendQuery.set("termId", dashboard.filters.termId);
  const query = trendQuery.toString();

  return (
    <div className="mt-8 space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-slate-950">Faculty analytics</h2>
        <p className="mt-1 text-sm text-slate-600">Metrics include only offerings assigned to your faculty profile.</p>
      </header>

      <MetricCards metrics={[
        { label: "Assigned offerings", value: dashboard.totals.offeringCount },
        { label: "Enrolled students", value: dashboard.uniqueStudentCount, detail: "Unique across selected offerings" },
        { label: "Finalized sessions", value: dashboard.totals.finalizedSessionCount },
        { label: "Overall attendance", value: formatPercent(dashboard.totals.attendance.percentage) },
        { label: "At-risk students", value: dashboard.totals.atRiskStudentCount },
        { label: "Critical students", value: dashboard.totals.criticalStudentCount },
      ]} />

      <form method="get" className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm font-medium text-slate-700">Offering
          <select name="offeringId" defaultValue={dashboard.filters.offeringId ?? ""} className="mt-1 block w-full rounded-lg border border-slate-300 p-2 font-normal">
            <option value="">All assigned offerings</option>
            {dashboard.filterOptions.offerings.map((offering) => <option key={offering.id} value={offering.id}>{offering.label}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">Academic term
          <select name="termId" defaultValue={dashboard.filters.termId ?? ""} className="mt-1 block w-full rounded-lg border border-slate-300 p-2 font-normal">
            <option value="">All assigned terms</option>
            {dashboard.filterOptions.terms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">Trend from
          <input type="date" name="fromDate" defaultValue={dashboard.filters.fromDate ?? ""} className="mt-1 block w-full rounded-lg border border-slate-300 p-2 font-normal" />
        </label>
        <label className="text-sm font-medium text-slate-700">Trend through
          <input type="date" name="toDate" defaultValue={dashboard.filters.toDate ?? ""} className="mt-1 block w-full rounded-lg border border-slate-300 p-2 font-normal" />
        </label>
        <div className="flex items-end gap-2">
          <button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">Apply filters</button>
          <a href={query ? `/faculty?${query}` : "/faculty"} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Clear dates</a>
        </div>
        <p className="text-xs text-slate-500 sm:col-span-2 lg:col-span-5">Date filters apply to the trend only. Risk and attendance summaries use all finalized records so they remain consistent with the attendance policy.</p>
      </form>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
        <AttendanceTrend title="Assigned-offering attendance trend" points={dashboard.trend} />
        <RiskDistribution atRisk={dashboard.totals.atRiskStudentCount} critical={dashboard.totals.criticalStudentCount} noData={dashboard.totals.noDataStudentCount} />
      </div>
      <OfferingComparison offerings={dashboard.offerings} title="Assigned offering comparison" />
      <RecentAttendanceActivity activities={dashboard.recentActivity} />
    </div>
  );
}
