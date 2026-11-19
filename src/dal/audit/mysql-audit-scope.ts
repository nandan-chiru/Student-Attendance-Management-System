import "server-only";
import { prisma } from "@/lib/db/prisma";

/** Faculty scope always comes from MySQL's OfferingFaculty relation. */
export async function listFacultyAuditOfferingIds(facultyId: string): Promise<string[]> {
  const assignments = await prisma.offeringFaculty.findMany({
    where: { facultyId },
    select: { offeringId: true },
    orderBy: { offeringId: "asc" },
  });
  return assignments.map(({ offeringId }) => offeringId);
}

/** Presentation labels come from canonical relational offering/course/term records. */
export async function getAuditOfferingLabels(offeringIds: string[]) {
  if (offeringIds.length === 0) return [];
  return prisma.courseOffering.findMany({
    where: { id: { in: offeringIds } },
    select: {
      id: true,
      sectionCode: true,
      course: { select: { code: true, name: true } },
      term: { select: { name: true } },
    },
    orderBy: [{ course: { code: "asc" } }, { sectionCode: "asc" }],
  });
}
