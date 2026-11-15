import { ProtectedRolePage } from "@/auth/role-page";
import { AuditWorkspace } from "@/features/audit/audit-workspace";
import { getAdminAttendanceAuditReport } from "@/services/audit/attendance-audit";
import { normalizeAuditPage } from "@/services/audit/aggregation";

type PageProps = { searchParams: Promise<{ page?: string | string[] }> };

function pageNumber(value: string | string[] | undefined): number {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return 1;
  return normalizeAuditPage(Number(value));
}

async function AdminAuditContent({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = pageNumber(params.page);
  const report = await getAdminAttendanceAuditReport(page);
  return <AuditWorkspace title="System audit" report={report} basePath="/admin/audit" />;
}

export default async function AdminAuditPage({ searchParams }: PageProps) {
  return (
    <ProtectedRolePage role="ADMIN">
      <AdminAuditContent searchParams={searchParams} />
    </ProtectedRolePage>
  );
}
