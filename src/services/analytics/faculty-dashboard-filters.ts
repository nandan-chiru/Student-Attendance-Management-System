import type { DashboardDateRange } from "@/dal/analytics/attendance-dashboard";

export type FacultyDashboardFilters = DashboardDateRange & {
  offeringId?: string;
  termId?: string;
};

/** Intersects optional UI filters with offering IDs obtained from authenticated faculty assignments. */
export function selectFacultyDashboardOfferings<T extends { id: string; termId: string }>(
  assignedOfferings: T[],
  filters: FacultyDashboardFilters,
): T[] {
  return assignedOfferings.filter((offering) =>
    (!filters.offeringId || offering.id === filters.offeringId) &&
    (!filters.termId || offering.termId === filters.termId),
  );
}

function parseDate(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value ? undefined : value;
}

export function parseFacultyDashboardFilters(input: Record<string, unknown>): FacultyDashboardFilters {
  const fromDate = parseDate(input.fromDate);
  const toDate = parseDate(input.toDate);
  const validRange = !fromDate || !toDate || fromDate <= toDate;
  return {
    ...(typeof input.offeringId === "string" ? { offeringId: input.offeringId } : {}),
    ...(typeof input.termId === "string" ? { termId: input.termId } : {}),
    ...(validRange && fromDate ? { fromDate } : {}),
    ...(validRange && toDate ? { toDate } : {}),
  };
}
