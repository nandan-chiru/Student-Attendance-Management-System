import { ProtectedRolePage } from "@/auth/role-page";
import { AdminAnalyticsDashboard } from "@/features/analytics/admin-dashboard";

export default function AdminPage() {
  return (
    <ProtectedRolePage role="ADMIN">
      <AdminAnalyticsDashboard />
    </ProtectedRolePage>
  );
}
