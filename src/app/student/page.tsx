import { ProtectedRolePage } from "@/auth/role-page";
import { StudentAttendanceWorkspace } from "@/features/attendance/student-workspace";

export default function StudentPage() {
  return (
    <ProtectedRolePage role="STUDENT">
      <StudentAttendanceWorkspace />
    </ProtectedRolePage>
  );
}
