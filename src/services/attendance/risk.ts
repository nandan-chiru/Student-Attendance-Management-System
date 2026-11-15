/** Default requirement for aggregate attendance analysis; offerings default to the same database value. */
export const DEFAULT_ATTENDANCE_THRESHOLD_PERCENT = 75;

export type AttendanceRiskStatus = "NO_DATA" | "SAFE" | "AT_RISK" | "CRITICAL";

export type AttendanceRisk = {
  currentPercent: number;
  requiredPercent: number;
  status: AttendanceRiskStatus;
  recoveryPossible: boolean;
  /** null means no finite number of future attended classes can meet the threshold. */
  recoveryClasses: number | null;
  recommendation: string;
};

/**
 * Analyze finalized attendance counts. Thresholds are accepted to two decimal
 * places (matching CourseOffering.attendanceThreshold DECIMAL(5,2)); comparisons
 * and recovery arithmetic use integer hundredths to avoid display rounding
 * changing a student's classification.
 */
export function analyzeAttendanceRisk(input: {
  attended: number;
  held: number;
  requiredPercent?: number;
}): AttendanceRisk {
  const { attended, held } = input;
  const requiredPercent = input.requiredPercent ?? DEFAULT_ATTENDANCE_THRESHOLD_PERCENT;

  if (!Number.isSafeInteger(attended) || !Number.isSafeInteger(held) || attended < 0 || held < 0 || attended > held) {
    throw new RangeError("Attendance counts must be non-negative integers, with attended no greater than held.");
  }
  if (!Number.isFinite(requiredPercent) || requiredPercent < 0 || requiredPercent > 100) {
    throw new RangeError("Required attendance percentage must be between 0 and 100.");
  }

  const thresholdHundredths = Math.round(requiredPercent * 100);
  if (Math.abs(requiredPercent * 100 - thresholdHundredths) > 1e-7) {
    throw new RangeError("Required attendance percentage may have at most two decimal places.");
  }

  const currentPercent = held === 0 ? 0 : Math.round((attended / held) * 10_000) / 100;
  if (held === 0) {
    return {
      currentPercent,
      requiredPercent,
      status: "NO_DATA",
      recoveryPossible: true,
      recoveryClasses: 0,
      recommendation: "No finalized attendance has been recorded yet; status will be available after a class is finalized.",
    };
  }

  const attendedExact = BigInt(attended);
  const heldExact = BigInt(held);
  const thresholdExact = BigInt(thresholdHundredths);
  const scale = BigInt(10_000);
  const meetsRequirement = attendedExact * scale >= thresholdExact * heldExact;
  if (meetsRequirement) {
    return {
      currentPercent,
      requiredPercent,
      status: "SAFE",
      recoveryPossible: true,
      recoveryClasses: 0,
      recommendation: `Attendance currently meets the ${requiredPercent}% requirement. Continue attending scheduled classes to maintain it.`,
    };
  }

  if (thresholdHundredths === 10_000) {
    return {
      currentPercent,
      requiredPercent,
      status: "CRITICAL",
      recoveryPossible: false,
      recoveryClasses: null,
      recommendation: `Attendance is below the ${requiredPercent}% requirement. It cannot be recovered to 100% by attending future classes alone. Contact the course faculty to discuss options.`,
    };
  }

  // With percentages expressed in hundredths, x = ceil((p*h-a)/(1-p))
  // becomes ceil((q*h - 10000*a)/(10000-q)), using exact integer arithmetic.
  const numerator = thresholdExact * heldExact - scale * attendedExact;
  const denominator = scale - thresholdExact;
  const recoveryExact = (numerator + denominator - BigInt(1)) / denominator;
  if (recoveryExact > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError("Required recovery count exceeds the supported integer range.");
  }
  const recoveryClasses = Number(recoveryExact);

  return {
    currentPercent,
    requiredPercent,
    status: "AT_RISK",
    recoveryPossible: true,
    recoveryClasses,
    recommendation: `Attendance is below the ${requiredPercent}% requirement. Attend the next ${recoveryClasses} consecutive classes to reach the requirement, then continue attending to maintain it.`,
  };
}
