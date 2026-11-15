import { ProtectedRolePage } from "@/auth/role-page";
import Link from "next/link";

export default function AdminPage() {
  return (
    <ProtectedRolePage role="ADMIN">
      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-900">Administration</h2>
        <p className="mt-2 text-sm text-slate-600">Review immutable attendance-finalization events.</p>
        <Link href="/admin/audit" className="mt-4 inline-block font-medium text-blue-700 hover:underline">
          Open system audit
        </Link>
      </section>
    </ProtectedRolePage>
  );
}
