import { ProtectedRolePage } from "@/auth/role-page";

export default function AdminPage() {
  return <ProtectedRolePage role="ADMIN" />;
}
