import { ProtectedRolePage } from "@/auth/role-page";

export default function FacultyPage() {
  return <ProtectedRolePage role="FACULTY" />;
}
