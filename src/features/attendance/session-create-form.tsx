"use client";

import { useActionState } from "react";
import { createAttendanceSessionAction } from "@/features/attendance/actions";
import { initialAttendanceActionState } from "@/features/attendance/action-state";

export type AttendanceRosterStudent = {
  id: string;
  registrationNumber: string;
  name: string;
};

export function SessionCreateForm({
  offeringId,
  students,
}: {
  offeringId: string;
  students: AttendanceRosterStudent[];
}) {
  const [state, action, pending] = useActionState(
    createAttendanceSessionAction,
    initialAttendanceActionState,
  );

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="offeringId" value={offeringId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          Session date
          <input
            name="sessionDate"
            type="date"
            required
            className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Topic (optional)
          <input
            name="topic"
            type="text"
            maxLength={200}
            className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
          />
        </label>
      </div>

      {students.length === 0 ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          This offering has no active students to mark.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Student</th>
                <th className="px-4 py-3 font-semibold">Registration No.</th>
                <th className="px-4 py-3 font-semibold">Attendance status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((student) => (
                <tr key={student.id}>
                  <td className="px-4 py-3 text-slate-900">{student.name}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {student.registrationNumber}
                  </td>
                  <td className="px-4 py-3">
                    <input type="hidden" name="studentId" value={student.id} />
                    <select
                      name={`status:${student.id}`}
                      required
                      defaultValue=""
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                    >
                      <option value="" disabled>Select status</option>
                      <option value="PRESENT">Present</option>
                      <option value="ABSENT">Absent</option>
                      <option value="EXCUSED">Excused</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {state.message ? (
        <p role="status" className={state.status === "error" ? "text-sm text-red-700" : "text-sm text-emerald-700"}>
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || students.length === 0}
        className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Saving attendance…" : "Save and finalize session"}
      </button>
    </form>
  );
}
