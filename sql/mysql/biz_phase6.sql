-- 悦己阶段6：最简预约记录
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
    `create_by` bigint NULL COMMENT '创建人ID',
    `create_time` datetime NULL COMMENT '创建时间',
    `update_by` bigint NULL COMMENT '更新人ID',
    `update_time` datetime NULL COMMENT '更新时间',
    `is_deleted` tinyint NOT NULL DEFAULT 0 COMMENT '逻辑删除标识(0-未删除 1-已删除)',
    PRIMARY KEY (`id`),
    UNIQUE INDEX `uk_member_appointment_time` (`member_id`, `appointment_date`, `appointment_time`),
    UNIQUE INDEX `uk_appointment_order_id` (`order_id`),
    INDEX `idx_appointment_member` (`member_id`),
    INDEX `idx_appointment_date` (`appointment_date`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='预约记录';
