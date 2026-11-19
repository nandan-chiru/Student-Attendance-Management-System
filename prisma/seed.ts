import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db/prisma";

const makeId = (value: number) =>
  `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;

const demoUsers = [
  {
    id: makeId(1),
    name: "Demo Administrator",
    email: "admin@attendance-demo.test",
    role: "ADMIN" as const,
  },
  {
    id: makeId(11),
    name: "Demo Faculty One",
    email: "faculty.one@attendance-demo.test",
    role: "FACULTY" as const,
  },
  {
    id: makeId(12),
    name: "Demo Faculty Two",
    email: "faculty.two@attendance-demo.test",
    role: "FACULTY" as const,
  },
  ...Array.from({ length: 5 }, (_, index) => ({
    id: makeId(21 + index),
    name: `Demo Student ${index + 1}`,
    email: `student.${index + 1}@attendance-demo.test`,
    role: "STUDENT" as const,
  })),
];

const courseDefinitions = [
  { id: makeId(301), code: "DBMS301", name: "Database Management Systems", credits: 4 },
  { id: makeId(302), code: "CS302", name: "Data Structures", credits: 3 },
  { id: makeId(303), code: "SE303", name: "Software Engineering", credits: 3 },
];

const attendancePatterns = [
  [
    ["PRESENT", "PRESENT", "PRESENT", "PRESENT"],
    ["PRESENT", "PRESENT", "ABSENT", "PRESENT"],
    ["PRESENT", "ABSENT", "ABSENT", "PRESENT"],
    ["PRESENT", "PRESENT", "PRESENT", "ABSENT"],
    ["ABSENT", "ABSENT", "PRESENT", "ABSENT"],
  ],
  [
    ["PRESENT", "PRESENT", "PRESENT", "PRESENT"],
    ["PRESENT", "ABSENT", "PRESENT", "PRESENT"],
    ["PRESENT", "PRESENT", "ABSENT", "ABSENT"],
    ["ABSENT", "PRESENT", "PRESENT", "PRESENT"],
    ["ABSENT", "PRESENT", "ABSENT", "ABSENT"],
  ],
  [
    ["PRESENT", "PRESENT", "PRESENT", "PRESENT"],
    ["PRESENT", "PRESENT", "ABSENT", "PRESENT"],
    ["ABSENT", "ABSENT", "PRESENT", "PRESENT"],
    ["PRESENT", "ABSENT", "PRESENT", "PRESENT"],
    ["ABSENT", "ABSENT", "ABSENT", "PRESENT"],
  ],
];

async function main() {
  const seedPassword = process.env.DEMO_SEED_PASSWORD;
  if (!seedPassword) {
    throw new Error(
      "Set DEMO_SEED_PASSWORD in your ignored local .env file before seeding.",
    );
  }

  const passwordHash = await bcrypt.hash(seedPassword, 12);
  const userIds = new Map<string, string>();

  for (const user of demoUsers) {
    const savedUser = await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, passwordHash, role: user.role },
      create: { ...user, passwordHash },
    });
    userIds.set(user.email, savedUser.id);
  }

  const studentIds: string[] = [];
  for (let index = 0; index < 5; index += 1) {
    const userId = userIds.get(`student.${index + 1}@attendance-demo.test`);
    if (!userId) throw new Error("Seed student user was not created.");
    const studentData = {
      userId,
      registrationNumber: `DEMO-2026-${String(index + 1).padStart(3, "0")}`,
      department: "Computer Science",
      semester: 3,
    };
    const student = await prisma.studentProfile.upsert({
      where: { userId },
      update: studentData,
      create: { id: makeId(101 + index), ...studentData },
    });
    studentIds.push(student.id);
  }

  const facultyIds: string[] = [];
  for (let index = 0; index < 2; index += 1) {
    const userId = userIds.get(`faculty.${index === 0 ? "one" : "two"}@attendance-demo.test`);
    if (!userId) throw new Error("Seed faculty user was not created.");
    const facultyData = {
      userId,
      employeeId: `DEMO-FAC-${String(index + 1).padStart(3, "0")}`,
      department: "Computer Science",
    };
    const faculty = await prisma.facultyProfile.upsert({
      where: { userId },
      update: facultyData,
      create: { id: makeId(201 + index), ...facultyData },
    });
    facultyIds.push(faculty.id);
  }

  const termId = makeId(250);
  const term = await prisma.academicTerm.upsert({
    where: { id: termId },
    update: {
      name: "Fall 2026 Demo Term",
      startDate: new Date("2026-08-01T00:00:00.000Z"),
      endDate: new Date("2026-12-31T00:00:00.000Z"),
      isActive: true,
    },
    create: {
      id: termId,
      name: "Fall 2026 Demo Term",
      startDate: new Date("2026-08-01T00:00:00.000Z"),
      endDate: new Date("2026-12-31T00:00:00.000Z"),
      isActive: true,
    },
  });

  const courses = [];
  for (const course of courseDefinitions) {
    courses.push(await prisma.course.upsert({
      where: { code: course.code },
      update: { name: course.name, credits: course.credits },
      create: course,
    }));
  }

  const offerings = [];
  for (let index = 0; index < courses.length; index += 1) {
    const course = courses[index];
    const offeringId = makeId(401 + index);
    const offeringKey = {
      courseId: course.id,
      termId: term.id,
      sectionCode: "A",
    };
    const offering = await prisma.courseOffering.upsert({
      where: { courseId_termId_sectionCode: offeringKey },
      update: { attendanceThreshold: "75.00" },
      create: { id: offeringId, ...offeringKey, attendanceThreshold: "75.00" },
    });
    offerings.push(offering);
  }

  const facultyForOffering = [facultyIds[0], facultyIds[0], facultyIds[1]];
  for (let offeringIndex = 0; offeringIndex < offerings.length; offeringIndex += 1) {
    await prisma.offeringFaculty.upsert({
      where: {
        offeringId_facultyId: {
          offeringId: offerings[offeringIndex].id,
          facultyId: facultyForOffering[offeringIndex],
        },
      },
      update: {},
      create: {
        offeringId: offerings[offeringIndex].id,
        facultyId: facultyForOffering[offeringIndex],
      },
    });
  }

  for (let offeringIndex = 0; offeringIndex < offerings.length; offeringIndex += 1) {
    for (let studentIndex = 0; studentIndex < 5; studentIndex += 1) {
      const offeringId = offerings[offeringIndex].id;
      const studentId = studentIds[studentIndex];
      const enrollmentData = { offeringId, studentId, status: "ACTIVE" as const };
      await prisma.enrollment.upsert({
        where: { offeringId_studentId: { offeringId, studentId } },
        update: { status: enrollmentData.status },
        create: {
          id: makeId(601 + offeringIndex * 10 + studentIndex),
          ...enrollmentData,
        },
      });
    }
  }

  const sessionDates = ["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"];
  for (let offeringIndex = 0; offeringIndex < offerings.length; offeringIndex += 1) {
    const creatorUserId = userIds.get(
      offeringIndex === 2
        ? "faculty.two@attendance-demo.test"
        : "faculty.one@attendance-demo.test",
    );
    if (!creatorUserId) throw new Error("Seed faculty user was not created.");

    for (let sessionIndex = 0; sessionIndex < sessionDates.length; sessionIndex += 1) {
      const sessionId = makeId(501 + offeringIndex * 10 + sessionIndex);
      const sessionDate = new Date(`${sessionDates[sessionIndex]}T00:00:00.000Z`);
      const sessionData = {
        offeringId: offerings[offeringIndex].id,
        sessionDate,
        topic: `Demo class ${sessionIndex + 1}`,
        status: "FINALIZED" as const,
        finalizedAt: new Date(`${sessionDates[sessionIndex]}T10:00:00.000Z`),
        createdBy: creatorUserId,
      };
      await prisma.attendanceSession.upsert({
        where: { id: sessionId },
        update: sessionData,
        create: { id: sessionId, ...sessionData },
      });

      for (let studentIndex = 0; studentIndex < 5; studentIndex += 1) {
        const status = attendancePatterns[offeringIndex][studentIndex][sessionIndex] as
          | "PRESENT"
          | "ABSENT"
          | "EXCUSED";
        const sessionRecordKey = { sessionId, studentId: studentIds[studentIndex] };
        await prisma.attendanceRecord.upsert({
          where: { sessionId_studentId: sessionRecordKey },
          update: {
            status,
            markedBy: creatorUserId,
            remarks: status === "ABSENT" ? "Development demo absence" : null,
          },
          create: {
            id: makeId(701 + offeringIndex * 100 + sessionIndex * 10 + studentIndex),
            ...sessionRecordKey,
            status,
            markedBy: creatorUserId,
            remarks: status === "ABSENT" ? "Development demo absence" : null,
          },
        });
      }
    }
  }

  console.info("Development seed completed: 1 admin, 2 faculty, 5 students, 3 offerings, 12 sessions, 60 attendance records.");
}

main()
  .catch((error: unknown) => {
    console.error("Development seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
