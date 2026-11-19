import type { AttendanceRisk } from "@/services/attendance/risk";

const statusPresentation = {
  NO_DATA: { label: "No finalized data", className: "bg-slate-100 text-slate-700" },
  SAFE: { label: "Meets requirement", className: "bg-emerald-100 text-emerald-800" },
  AT_RISK: { label: "At risk", className: "bg-amber-100 text-amber-900" },
  CRITICAL: { label: "Recovery impossible", className: "bg-red-100 text-red-800" },
} as const;

function percentage(value: number) {
  return `${value.toFixed(2).replace(/\.00$/, "")}%`;
}

export function RiskSummary({ risk }: { risk: AttendanceRisk }) {
  const presentation = statusPresentation[risk.status];

  return (
    <div className="space-y-1.5">
      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${presentation.className}`}>
        {presentation.label}
      </span>
      <p className="text-xs text-slate-600">
        Required {percentage(risk.requiredPercent)}
        {risk.status === "AT_RISK" && risk.recoveryClasses !== null
          ? ` · ${risk.recoveryClasses} consecutive classes to recover`
          : null}
        {risk.status === "CRITICAL" ? " · future attendance alone is insufficient" : null}
        {risk.status === "NO_DATA" ? " · no classes to assess yet" : null}
      </p>
      <p className="text-xs text-slate-600">{risk.recommendation}</p>
    </div>
  );
}
