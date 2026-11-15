import { ProtectedRolePage } from "@/auth/role-page";
import { FacultyAttendanceWorkspace } from "@/features/attendance/faculty-workspace";
import { FacultyAnalyticsDashboard } from "@/features/analytics/faculty-dashboard";

export default function FacultyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <ProtectedRolePage role="FACULTY">
      <FacultyAnalyticsDashboard searchParams={searchParams} />
      <FacultyAttendanceWorkspace />
    </ProtectedRolePage>
  );
}
