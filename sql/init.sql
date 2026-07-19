-- ============================================================
-- CourseQSort — 排课规划器 MySQL 数据库初始化脚本
-- 使用方式:
--   mysql -u root -p < init.sql
-- 或登录后执行:
--   source init.sql;
-- ============================================================

CREATE DATABASE IF NOT EXISTS course_scheduler
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_unicode_ci;

USE course_scheduler;

-- -----------------------------------------------------------
-- 1. Major — 专业
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `major` (
    `id`            BIGINT AUTO_INCREMENT PRIMARY KEY,
    `name`          VARCHAR(100)   NOT NULL,
    `code`          VARCHAR(50)    NOT NULL DEFAULT '',
    `student_count` INT            DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------------
-- 2. Teacher — 教师（含禁排时间段 JSON）
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `teacher` (
    `id`               BIGINT AUTO_INCREMENT PRIMARY KEY,
    `name`             VARCHAR(50)    NOT NULL,
    `employee_no`      VARCHAR(50)    NOT NULL DEFAULT '',
    `department`       VARCHAR(100)   NOT NULL DEFAULT '',
    `unavailable_slots` JSON          DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX `idx_teacher_name` ON `teacher` (`name`);
CREATE INDEX `idx_teacher_dept` ON `teacher` (`department`);

-- -----------------------------------------------------------
-- 3. Classroom — 教室
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `classroom` (
    `id`              BIGINT AUTO_INCREMENT PRIMARY KEY,
    `name`            VARCHAR(100)   NOT NULL,
    `capacity`        INT            NOT NULL DEFAULT 60,
    `building`        VARCHAR(200)   NOT NULL DEFAULT '',
    `equipment_types` JSON           DEFAULT NULL,
    `is_lab`          TINYINT(1)     NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX `idx_classroom_building` ON `classroom` (`building`);

-- -----------------------------------------------------------
-- 4. Course — 课程
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `course` (
    `id`                     BIGINT AUTO_INCREMENT PRIMARY KEY,
    `name`                   VARCHAR(200)   NOT NULL,
    `code`                   VARCHAR(50)    NOT NULL DEFAULT '',
    `credit`                 DOUBLE         NOT NULL DEFAULT 0,
    `hours`                  INT            DEFAULT NULL,
    `semester`               VARCHAR(20)    NOT NULL DEFAULT '',
    `campus`                 VARCHAR(50)    NOT NULL DEFAULT '',
    `major_id`               BIGINT         DEFAULT NULL,
    `expected_student_count` INT            DEFAULT NULL,
    `is_professional_course` TINYINT(1)     NOT NULL DEFAULT 1,
    `required_classroom_types` JSON         DEFAULT NULL,
    `prerequisites`          JSON           DEFAULT NULL,
    `course_id_from_source`  VARCHAR(50)    NOT NULL,

    UNIQUE KEY `uk_course_source` (`course_id_from_source`),
    CONSTRAINT `fk_course_major` FOREIGN KEY (`major_id`)
        REFERENCES `major` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX `idx_course_semester` ON `course` (`semester`);
CREATE INDEX `idx_course_code` ON `course` (`code`);

-- -----------------------------------------------------------
-- 5. course_teachers — 课程-教师 M2M 关联表（自动生成）
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `course_teachers` (
    `id`         BIGINT AUTO_INCREMENT PRIMARY KEY,
    `course_id`  BIGINT NOT NULL,
    `teacher_id` BIGINT NOT NULL,

    UNIQUE KEY `uk_course_teacher` (`course_id`, `teacher_id`),
    CONSTRAINT `fk_ct_course` FOREIGN KEY (`course_id`)
        REFERENCES `course` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_ct_teacher` FOREIGN KEY (`teacher_id`)
        REFERENCES `teacher` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------------
-- 6. course_schedule_item — 排课条目
--    由 test.json 的 teachingTimePlaceStr 解析得到
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `course_schedule_item` (
    `id`                   BIGINT AUTO_INCREMENT PRIMARY KEY,
    `course_id`            BIGINT         NOT NULL,
    `teacher_id`           BIGINT         DEFAULT NULL,
    `classroom_id`         BIGINT         DEFAULT NULL,
    `day_of_week`          INT            NOT NULL COMMENT '1=周一 … 5=周五',
    `period`               INT            NOT NULL COMMENT '第几大节(1~11)',
    `week_start`           INT            NOT NULL DEFAULT 1,
    `week_end`             INT            NOT NULL DEFAULT 18,
    `class_identification` VARCHAR(200)   NOT NULL DEFAULT '',

    CONSTRAINT `fk_si_course` FOREIGN KEY (`course_id`)
        REFERENCES `course` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_si_teacher` FOREIGN KEY (`teacher_id`)
        REFERENCES `teacher` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_si_classroom` FOREIGN KEY (`classroom_id`)
        REFERENCES `classroom` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX `idx_si_day_period` ON `course_schedule_item` (`day_of_week`, `period`);
CREATE INDEX `idx_si_course` ON `course_schedule_item` (`course_id`);

-- -----------------------------------------------------------
-- 7. Student — 学生（占位记录，供排课算法模拟用）
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `student` (
    `id`                   BIGINT AUTO_INCREMENT PRIMARY KEY,
    `student_no`           VARCHAR(50)    NOT NULL DEFAULT '',
    `name`                 VARCHAR(50)    NOT NULL DEFAULT '',
    `major_id`             BIGINT         DEFAULT NULL,
    `grade`                VARCHAR(20)    NOT NULL DEFAULT '',
    `class_identification` VARCHAR(200)   NOT NULL DEFAULT '',

    CONSTRAINT `fk_student_major` FOREIGN KEY (`major_id`)
        REFERENCES `major` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX `idx_student_grade` ON `student` (`grade`);
