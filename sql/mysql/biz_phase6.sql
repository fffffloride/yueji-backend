-- 悦己阶段6：预约生命周期、时段容量与操作日志
USE youlai_admin;

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `appointment_config` (
    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '配置ID',
    `slot_capacity` int NOT NULL DEFAULT 1 COMMENT '每个时间段最多预约人数',
    `create_by` bigint NULL COMMENT '创建人ID',
    `create_time` datetime NULL COMMENT '创建时间',
    `update_by` bigint NULL COMMENT '更新人ID',
    `update_time` datetime NULL COMMENT '更新时间',
    `is_deleted` tinyint NOT NULL DEFAULT 0 COMMENT '逻辑删除标识(0-未删除 1-已删除)',
    PRIMARY KEY (`id`),
    CONSTRAINT `chk_appointment_slot_capacity` CHECK (`slot_capacity` >= 1),
    CONSTRAINT `chk_appointment_config_is_deleted` CHECK (`is_deleted` = 0)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='预约配置';

INSERT INTO `appointment_config`
  (`id`, `slot_capacity`, `create_time`, `update_time`, `is_deleted`)
VALUES
  (1, 1, NOW(), NOW(), 0)
ON DUPLICATE KEY UPDATE `id` = `id`;

CREATE TABLE IF NOT EXISTS `appointment` (
    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '预约ID',
    `member_id` bigint NOT NULL COMMENT '会员ID',
    `appointment_date` date NOT NULL COMMENT '预约日期',
    `appointment_time` time NOT NULL COMMENT '预约时间',
    `scene_type` varchar(20) NOT NULL DEFAULT 'CONSULTATION' COMMENT '预约场景(CONSULTATION-面诊 ORDER-订单)',
    `order_id` bigint NULL COMMENT '关联订单ID',
    `status` tinyint NOT NULL DEFAULT 0 COMMENT '预约状态(0-待到店 1-已完成 2-已取消)',
    `complete_time` datetime NULL COMMENT '服务完成时间',
    `cancel_time` datetime NULL COMMENT '取消时间',
    `cancel_reason` varchar(255) NULL COMMENT '取消原因',
    `create_by` bigint NULL COMMENT '创建人ID',
    `create_time` datetime NULL COMMENT '创建时间',
    `update_by` bigint NULL COMMENT '更新人ID',
    `update_time` datetime NULL COMMENT '更新时间',
    `is_deleted` tinyint NOT NULL DEFAULT 0 COMMENT '逻辑删除标识(0-未删除 1-已删除)',
    `active_order_id` bigint GENERATED ALWAYS AS (
      CASE
        WHEN `is_deleted` = 0 AND `scene_type` = 'ORDER' AND `status` IN (0, 1) THEN `order_id`
        ELSE NULL
      END
    ) STORED COMMENT '非取消订单预约唯一键',
    `booked_member_slot_key` varchar(80) GENERATED ALWAYS AS (
      CASE
        WHEN `is_deleted` = 0 AND `status` = 0
          THEN CONCAT(`member_id`, '#', `appointment_date`, '#', `appointment_time`)
        ELSE NULL
      END
    ) STORED COMMENT '待到店会员时段唯一键',
    PRIMARY KEY (`id`),
    UNIQUE INDEX `uk_appointment_active_order` (`active_order_id`),
    UNIQUE INDEX `uk_appointment_booked_member_slot` (`booked_member_slot_key`),
    INDEX `idx_appointment_member_status_time` (`member_id`, `status`, `appointment_date`, `appointment_time`),
    INDEX `idx_appointment_status_time` (`status`, `appointment_date`, `appointment_time`),
    INDEX `idx_appointment_order_status` (`order_id`, `status`),
    CONSTRAINT `chk_appointment_status` CHECK (`status` IN (0, 1, 2)),
    CONSTRAINT `chk_appointment_scene_order` CHECK (
      (`scene_type` = 'CONSULTATION' AND `order_id` IS NULL) OR
      (`scene_type` = 'ORDER' AND `order_id` IS NOT NULL)
    )
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='预约记录';

CREATE TABLE IF NOT EXISTS `appointment_operation_log` (
    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '操作日志ID',
    `appointment_id` bigint NOT NULL COMMENT '预约ID',
    `action` varchar(20) NOT NULL COMMENT '操作(CREATE/RESCHEDULE/CANCEL/COMPLETE)',
    `operator_type` varchar(20) NOT NULL COMMENT '操作者类型(MEMBER/ADMIN/SYSTEM)',
    `operator_id` bigint NULL COMMENT '会员或管理员ID',
    `before_date` date NULL COMMENT '操作前预约日期',
    `before_time` time NULL COMMENT '操作前预约时间',
    `after_date` date NULL COMMENT '操作后预约日期',
    `after_time` time NULL COMMENT '操作后预约时间',
    `reason` varchar(255) NULL COMMENT '操作原因',
    `create_by` bigint NULL COMMENT '创建人ID',
    `create_time` datetime NULL COMMENT '创建时间',
    `update_by` bigint NULL COMMENT '更新人ID',
    `update_time` datetime NULL COMMENT '更新时间',
    `is_deleted` tinyint NOT NULL DEFAULT 0 COMMENT '逻辑删除标识(0-未删除 1-已删除)',
    PRIMARY KEY (`id`),
    INDEX `idx_appointment_operation_log_appointment` (`appointment_id`, `create_time`, `id`),
    CONSTRAINT `chk_appointment_operation_action` CHECK (`action` IN ('CREATE', 'RESCHEDULE', 'CANCEL', 'COMPLETE')),
    CONSTRAINT `chk_appointment_operator_type` CHECK (`operator_type` IN ('MEMBER', 'ADMIN', 'SYSTEM')),
    CONSTRAINT `chk_appointment_operation_is_deleted` CHECK (`is_deleted` = 0)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='预约操作日志';
