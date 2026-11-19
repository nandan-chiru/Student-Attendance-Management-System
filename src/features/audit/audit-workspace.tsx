import Link from "next/link";
import type { AttendanceAuditReport } from "@/services/audit/attendance-audit";

function truncateIdentifier(identifier: string): string {
  const visibleLength = 8;
  return identifier.length > visibleLength
    ? `${identifier.slice(0, visibleLength)}…`
    : identifier;
}

function readableEventType(eventType: string): string {
  return eventType
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function offeringLabel(
  offeringId: string,
  report: AttendanceAuditReport,
): string {
  const offering = report.offeringLabels.find(({ id }) => id === offeringId);
  if (!offering) return offeringId;
  return `${offering.course.code} · ${offering.course.name} · ${offering.sectionCode} · ${offering.term.name}`;
}

export function AuditWorkspace({
  title,
  report,
  basePath,
}: {
  title: string;
  report: AttendanceAuditReport;
  basePath: string;
}) {
  const { summary, history } = report;
  const pageCount = Math.max(1, Math.ceil(history.totalEvents / history.pageSize));

  return (
    <div className="mt-8 space-y-8">
      <section>
        <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">
          Immutable finalization events from MongoDB. MySQL remains the source of truth for attendance records and percentages.
        </p>
      </section>

      <section aria-label="Audit summary" className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-600">Finalized attendance events</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{summary.totalEvents}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-600">Affected-student event count</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{summary.affectedStudentCount}</p>
          <p className="mt-1 text-xs text-slate-500">
            Sum of roster sizes across events; this is not a unique-student count.
          </p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-950">Events by date</h3>
          {summary.eventsByDate.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No finalized events in this scope.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-slate-600"><tr><th className="border-b px-3 py-2">UTC date</th><th className="border-b px-3 py-2">Events</th></tr></thead>
                <tbody>{summary.eventsByDate.map((item) => (
                  <tr key={item.date}><td className="border-b border-slate-100 px-3 py-2">{item.date}</td><td className="border-b border-slate-100 px-3 py-2">{item.eventCount}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-950">Events by offering</h3>
          {summary.eventsByOffering.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No finalized events in this scope.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-slate-600"><tr><th className="border-b px-3 py-2">Offering</th><th className="border-b px-3 py-2">Events</th><th className="border-b px-3 py-2">Affected-student event count</th></tr></thead>
                <tbody>{summary.eventsByOffering.map((item) => (
                  <tr key={item.offeringId}>
                    <td className="border-b border-slate-100 px-3 py-2">{offeringLabel(item.offeringId, report)}</td>
                    <td className="border-b border-slate-100 px-3 py-2">{item.eventCount}</td>
                    <td className="border-b border-slate-100 px-3 py-2">{item.affectedStudentCount}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold text-slate-950">Recent events</h3>
        {history.events.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No finalized events in this scope.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Occurred (UTC)</th><th className="px-3 py-2">Event type</th>
                  <th className="px-3 py-2">Offering</th><th className="px-3 py-2">Session ID</th>
                  <th className="px-3 py-2">Affected-student event count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.events.map((event) => (
                  <tr key={event.eventId}>
                    <td className="whitespace-nowrap px-3 py-2">{event.occurredAt}</td>
                    <td className="px-3 py-2">{readableEventType(event.eventType)}</td>
                    <td className="px-3 py-2">{offeringLabel(event.offeringId, report)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{truncateIdentifier(event.sessionId)}</td>
                    <td className="px-3 py-2">{event.affectedStudentCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <nav aria-label="Audit history pages" className="mt-4 flex items-center justify-between text-sm">
          <span className="text-slate-600">Page {history.page} of {pageCount} · {history.totalEvents} events</span>
          <div className="flex gap-3">
            {history.page > 1 && <Link className="font-medium text-blue-700 hover:underline" href={`${basePath}?page=${history.page - 1}`}>Previous</Link>}
            {history.page < pageCount && <Link className="font-medium text-blue-700 hover:underline" href={`${basePath}?page=${history.page + 1}`}>Next</Link>}
          </div>
        </nav>
      </section>
    </div>
  );
}
