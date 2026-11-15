import { ProtectedRolePage } from "@/auth/role-page";
import { AuditWorkspace } from "@/features/audit/audit-workspace";
import { getFacultyAttendanceAuditReport } from "@/services/audit/attendance-audit";
import { normalizeAuditPage } from "@/services/audit/aggregation";

type PageProps = { searchParams: Promise<{ page?: string | string[] }> };

function pageNumber(value: string | string[] | undefined): number {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return 1;
  return normalizeAuditPage(Number(value));
}

async function FacultyAuditContent({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = pageNumber(params.page);
  const report = await getFacultyAttendanceAuditReport(page);
  return <AuditWorkspace title="Offering audit" report={report} basePath="/faculty/audit" />;
}

export default async function FacultyAuditPage({ searchParams }: PageProps) {
  return (
    <ProtectedRolePage role="FACULTY">
      <FacultyAuditContent searchParams={searchParams} />
    </ProtectedRolePage>
  );
}
