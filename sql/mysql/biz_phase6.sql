-- 悦己阶段6：最简预约记录
USE youlai_admin;

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `appointment` (
    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '预约ID',
    `member_id` bigint NOT NULL COMMENT '会员ID',
    `appointment_date` date NOT NULL COMMENT '预约日期',
    `appointment_time` time NOT NULL COMMENT '预约时间',
    `create_by` bigint NULL COMMENT '创建人ID',
    `create_time` datetime NULL COMMENT '创建时间',
    `update_by` bigint NULL COMMENT '更新人ID',
    `update_time` datetime NULL COMMENT '更新时间',
    `is_deleted` tinyint NOT NULL DEFAULT 0 COMMENT '逻辑删除标识(0-未删除 1-已删除)',
    PRIMARY KEY (`id`),
    UNIQUE INDEX `uk_member_appointment_time` (`member_id`, `appointment_date`, `appointment_time`),
    INDEX `idx_appointment_member` (`member_id`),
    INDEX `idx_appointment_date` (`appointment_date`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='预约记录';
