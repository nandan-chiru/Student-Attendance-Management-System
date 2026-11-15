import { ProtectedRolePage } from "@/auth/role-page";

export default function StudentPage() {
  return <ProtectedRolePage role="STUDENT" />;
}
