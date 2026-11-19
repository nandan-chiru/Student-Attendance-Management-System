import { ProtectedRolePage } from "@/auth/role-page";
import { FacultySessionDetails } from "@/features/attendance/faculty-session-details";

type PageProps = { params: Promise<{ sessionId: string }> };

export default function FacultySessionPage({ params }: PageProps) {
  return (
    <ProtectedRolePage role="FACULTY">
      <SessionDetails params={params} />
    </ProtectedRolePage>
  );
}

async function SessionDetails({ params }: PageProps) {
  const { sessionId } = await params;
  return <FacultySessionDetails sessionId={sessionId} />;
}
