-- CreateTable
CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `email` VARCHAR(254) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `role` ENUM('STUDENT', 'FACULTY', 'ADMIN') NOT NULL DEFAULT 'STUDENT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_profiles` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `registrationNumber` VARCHAR(40) NOT NULL,
    `department` VARCHAR(120) NOT NULL,
    `semester` INTEGER NOT NULL,

    UNIQUE INDEX `student_profiles_userId_key`(`userId`),
    UNIQUE INDEX `student_profiles_registrationNumber_key`(`registrationNumber`),
    INDEX `student_profiles_department_semester_idx`(`department`, `semester`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `faculty_profiles` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `employeeId` VARCHAR(40) NOT NULL,
    `department` VARCHAR(120) NOT NULL,

    UNIQUE INDEX `faculty_profiles_userId_key`(`userId`),
    UNIQUE INDEX `faculty_profiles_employeeId_key`(`employeeId`),
    INDEX `faculty_profiles_department_idx`(`department`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `academic_terms` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT false,

    INDEX `academic_terms_isActive_startDate_idx`(`isActive`, `startDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `courses` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(30) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `credits` INTEGER NOT NULL,

    UNIQUE INDEX `courses_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `course_offerings` (
    `id` CHAR(36) NOT NULL,
    `courseId` CHAR(36) NOT NULL,
    `termId` CHAR(36) NOT NULL,
    `sectionCode` VARCHAR(20) NOT NULL,
    `attendanceThreshold` DECIMAL(5, 2) NOT NULL DEFAULT 75.00,

    INDEX `course_offerings_termId_courseId_idx`(`termId`, `courseId`),
    UNIQUE INDEX `course_offerings_courseId_termId_sectionCode_key`(`courseId`, `termId`, `sectionCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `offering_faculty` (
    `offeringId` CHAR(36) NOT NULL,
    `facultyId` CHAR(36) NOT NULL,

    INDEX `offering_faculty_facultyId_offeringId_idx`(`facultyId`, `offeringId`),
    PRIMARY KEY (`offeringId`, `facultyId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `enrollments` (
    `id` CHAR(36) NOT NULL,
    `offeringId` CHAR(36) NOT NULL,
    `studentId` CHAR(36) NOT NULL,
    `enrolledAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` ENUM('ACTIVE', 'DROPPED', 'COMPLETED') NOT NULL DEFAULT 'ACTIVE',

    INDEX `enrollments_studentId_status_idx`(`studentId`, `status`),
    UNIQUE INDEX `enrollments_offeringId_studentId_key`(`offeringId`, `studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_sessions` (
    `id` CHAR(36) NOT NULL,
    `offeringId` CHAR(36) NOT NULL,
    `sessionDate` DATE NOT NULL,
    `topic` VARCHAR(200) NULL,
    `status` ENUM('DRAFT', 'FINALIZED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `finalizedAt` DATETIME(3) NULL,
    `createdBy` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `attendance_sessions_offeringId_sessionDate_idx`(`offeringId`, `sessionDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_records` (
    `id` CHAR(36) NOT NULL,
    `sessionId` CHAR(36) NOT NULL,
    `studentId` CHAR(36) NOT NULL,
    `status` ENUM('PRESENT', 'ABSENT', 'EXCUSED') NOT NULL,
    `markedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `markedBy` CHAR(36) NOT NULL,
    `remarks` TEXT NULL,

    INDEX `attendance_records_studentId_sessionId_idx`(`studentId`, `sessionId`),
    UNIQUE INDEX `attendance_records_sessionId_studentId_key`(`sessionId`, `studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `outbox_events` (
    `id` CHAR(36) NOT NULL,
    `eventId` CHAR(36) NOT NULL,
    `eventType` VARCHAR(100) NOT NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actorUserId` CHAR(36) NULL,
    `studentId` CHAR(36) NULL,
    `offeringId` CHAR(36) NULL,
    `sessionId` CHAR(36) NULL,
    `attendanceRecordId` CHAR(36) NULL,
    `payload` JSON NOT NULL,
    `deliveredAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `outbox_events_eventId_key`(`eventId`),
    INDEX `outbox_events_deliveredAt_createdAt_idx`(`deliveredAt`, `createdAt`),
    INDEX `outbox_events_eventType_occurredAt_idx`(`eventType`, `occurredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `student_profiles` ADD CONSTRAINT `student_profiles_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `faculty_profiles` ADD CONSTRAINT `faculty_profiles_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course_offerings` ADD CONSTRAINT `course_offerings_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `courses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course_offerings` ADD CONSTRAINT `course_offerings_termId_fkey` FOREIGN KEY (`termId`) REFERENCES `academic_terms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offering_faculty` ADD CONSTRAINT `offering_faculty_offeringId_fkey` FOREIGN KEY (`offeringId`) REFERENCES `course_offerings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offering_faculty` ADD CONSTRAINT `offering_faculty_facultyId_fkey` FOREIGN KEY (`facultyId`) REFERENCES `faculty_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_offeringId_fkey` FOREIGN KEY (`offeringId`) REFERENCES `course_offerings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `student_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_sessions` ADD CONSTRAINT `attendance_sessions_offeringId_fkey` FOREIGN KEY (`offeringId`) REFERENCES `course_offerings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_sessions` ADD CONSTRAINT `attendance_sessions_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `attendance_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `student_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_markedBy_fkey` FOREIGN KEY (`markedBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `outbox_events` ADD CONSTRAINT `outbox_events_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `outbox_events` ADD CONSTRAINT `outbox_events_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `student_profiles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `outbox_events` ADD CONSTRAINT `outbox_events_offeringId_fkey` FOREIGN KEY (`offeringId`) REFERENCES `course_offerings`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `outbox_events` ADD CONSTRAINT `outbox_events_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `attendance_sessions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `outbox_events` ADD CONSTRAINT `outbox_events_attendanceRecordId_fkey` FOREIGN KEY (`attendanceRecordId`) REFERENCES `attendance_records`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- These integrity checks are maintained in this SQL migration because Prisma Schema Language does not express CHECK constraints.
ALTER TABLE `academic_terms` ADD CONSTRAINT `academic_terms_date_order_chk` CHECK (`startDate` <= `endDate`);
ALTER TABLE `courses` ADD CONSTRAINT `courses_credits_positive_chk` CHECK (`credits` > 0);
ALTER TABLE `course_offerings` ADD CONSTRAINT `course_offerings_attendance_threshold_chk` CHECK (`attendanceThreshold` >= 0 AND `attendanceThreshold` <= 100);
ALTER TABLE `attendance_sessions` ADD CONSTRAINT `attendance_sessions_finalized_at_chk` CHECK ((`status` = 'FINALIZED' AND `finalizedAt` IS NOT NULL) OR (`status` <> 'FINALIZED' AND `finalizedAt` IS NULL));
