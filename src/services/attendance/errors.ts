export class AttendanceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttendanceValidationError";
  }
}

export class AttendanceNotFoundError extends Error {
  constructor(message = "The requested attendance resource was not found.") {
    super(message);
    this.name = "AttendanceNotFoundError";
  }
}

export class AttendanceConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttendanceConflictError";
  }
}
