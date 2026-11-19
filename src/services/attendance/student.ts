import { requireStudent } from "@/auth/authorization";
import { listStudentEnrollments } from "@/dal/attendance/queries";
import { calculateAttendance } from "@/services/attendance/calculations";
import { analyzeAttendanceRisk, DEFAULT_ATTENDANCE_THRESHOLD_PERCENT } from "@/services/attendance/risk";
import { buildStudentAttendanceTrend, summarizeStudentDashboard } from "@/services/analytics/dashboard-metrics";

export async function getStudentAttendanceOverview() {
  const student = await requireStudent();
  const enrollments = await listStudentEnrollments(student.studentProfileId);

  const courses = enrollments.map((enrollment) => {
    const offering = enrollment.offering;
    const history = offering.attendanceSessions.flatMap((session) => {
      const record = session.records[0];
      return record ? [{
        sessionId: session.id,
        sessionDate: session.sessionDate,
        topic: session.topic,
        status: record.status,
        markedAt: record.markedAt,
        remarks: record.remarks,
      }] : [];
    });
    const attendance = calculateAttendance(history.map(({ status }) => status));
    const risk = analyzeAttendanceRisk({
      attended: attendance.attended,
      held: attendance.held,
      requiredPercent: Number(offering.attendanceThreshold),
    });

    return {
      offeringId: offering.id,
      enrollmentStatus: enrollment.status,
      course: offering.course,
      term: offering.term,
      sectionCode: offering.sectionCode,
      attendanceThreshold: Number(offering.attendanceThreshold),
      attendance,
      risk,
      history,
    };
  });

  const overall = calculateAttendance(
    courses.flatMap((course) => course.history.map(({ status }) => status)),
  );

  const overallRisk = analyzeAttendanceRisk({
    attended: overall.attended,
    held: overall.held,
    requiredPercent: DEFAULT_ATTENDANCE_THRESHOLD_PERCENT,
  });

  const dashboard = summarizeStudentDashboard({ overall, courses });
  const trend = buildStudentAttendanceTrend(courses);

  return { courses, overall, overallRisk, dashboard, trend };
}
