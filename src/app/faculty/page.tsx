import { ProtectedRolePage } from "@/auth/role-page";
import { FacultyAttendanceWorkspace } from "@/features/attendance/faculty-workspace";

export default function FacultyPage() {
  return (
    <ProtectedRolePage role="FACULTY">
      <FacultyAttendanceWorkspace />
    </ProtectedRolePage>
  );
}
