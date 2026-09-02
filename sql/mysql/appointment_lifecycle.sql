-- 开发期破坏性迁移：清空预约域测试数据并升级预约生命周期结构。
-- 只影响 appointment 与 appointment_operation_log；不清理订单、支付、会员或商品。
-- 依赖：已执行 biz_phase6.sql、appointment_capacity.sql、appointment_scene.sql。
-- 本脚本仅执行一次，不提供历史数据回填。
USE youlai_admin;

SET NAMES utf8mb4;

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

DELETE FROM `appointment_operation_log`;
DELETE FROM `appointment`;

ALTER TABLE `appointment`
  DROP INDEX `uk_member_appointment_time`,
  DROP INDEX `uk_appointment_order_id`,
  ADD COLUMN `status` tinyint NOT NULL DEFAULT 0
    COMMENT '预约状态(0-待到店 1-已完成 2-已取消)' AFTER `order_id`,
  ADD COLUMN `complete_time` datetime NULL COMMENT '服务完成时间' AFTER `status`,
  ADD COLUMN `cancel_time` datetime NULL COMMENT '取消时间' AFTER `complete_time`,
  ADD COLUMN `cancel_reason` varchar(255) NULL COMMENT '取消原因' AFTER `cancel_time`,
  ADD COLUMN `active_order_id` bigint GENERATED ALWAYS AS (
    CASE
      WHEN `is_deleted` = 0 AND `scene_type` = 'ORDER' AND `status` IN (0, 1) THEN `order_id`
      ELSE NULL
    END
  ) STORED COMMENT '非取消订单预约唯一键' AFTER `is_deleted`,
  ADD COLUMN `booked_member_slot_key` varchar(80) GENERATED ALWAYS AS (
    CASE
      WHEN `is_deleted` = 0 AND `status` = 0
        THEN CONCAT(`member_id`, '#', `appointment_date`, '#', `appointment_time`)
      ELSE NULL
    END
  ) STORED COMMENT '待到店会员时段唯一键' AFTER `active_order_id`,
  ADD UNIQUE INDEX `uk_appointment_active_order` (`active_order_id`),
  ADD UNIQUE INDEX `uk_appointment_booked_member_slot` (`booked_member_slot_key`),
  ADD INDEX `idx_appointment_member_status_time` (`member_id`, `status`, `appointment_date`, `appointment_time`),
  ADD INDEX `idx_appointment_status_time` (`status`, `appointment_date`, `appointment_time`),
  ADD INDEX `idx_appointment_order_status` (`order_id`, `status`),
  ADD CONSTRAINT `chk_appointment_status` CHECK (`status` IN (0, 1, 2)),
  ADD CONSTRAINT `chk_appointment_scene_order` CHECK (
    (`scene_type` = 'CONSULTATION' AND `order_id` IS NULL) OR
    (`scene_type` = 'ORDER' AND `order_id` IS NOT NULL)
  );

-- 最小开发测试数据：面诊待到店/完成/取消，以及订单待到店/完成/取消。
INSERT INTO `appointment`
  (`member_id`, `appointment_date`, `appointment_time`, `scene_type`, `order_id`, `status`,
   `complete_time`, `cancel_time`, `cancel_reason`, `create_time`, `update_time`, `is_deleted`)
SELECT `id`, DATE_ADD(CURDATE(), INTERVAL 3 DAY), '10:00:00', 'CONSULTATION', NULL, 0,
       NULL, NULL, NULL, DATE_SUB(NOW(), INTERVAL 1 DAY), NOW(), 0
FROM `member` WHERE `is_deleted` = 0 ORDER BY `id` LIMIT 1;

INSERT INTO `appointment`
  (`member_id`, `appointment_date`, `appointment_time`, `scene_type`, `order_id`, `status`,
   `complete_time`, `cancel_time`, `cancel_reason`, `create_time`, `update_time`, `is_deleted`)
SELECT `id`, DATE_SUB(CURDATE(), INTERVAL 3 DAY), '11:00:00', 'CONSULTATION', NULL, 1,
       DATE_SUB(NOW(), INTERVAL 2 DAY), NULL, NULL, DATE_SUB(NOW(), INTERVAL 5 DAY), NOW(), 0
FROM `member` WHERE `is_deleted` = 0 ORDER BY `id` LIMIT 1, 1;

INSERT INTO `appointment`
  (`member_id`, `appointment_date`, `appointment_time`, `scene_type`, `order_id`, `status`,
   `complete_time`, `cancel_time`, `cancel_reason`, `create_time`, `update_time`, `is_deleted`)
SELECT `id`, DATE_ADD(CURDATE(), INTERVAL 5 DAY), '12:00:00', 'CONSULTATION', NULL, 2,
       NULL, NOW(), '行程有变', DATE_SUB(NOW(), INTERVAL 2 DAY), NOW(), 0
FROM `member` WHERE `is_deleted` = 0 ORDER BY `id` LIMIT 2, 1;

INSERT INTO `appointment`
  (`member_id`, `appointment_date`, `appointment_time`, `scene_type`, `order_id`, `status`,
   `complete_time`, `cancel_time`, `cancel_reason`, `create_time`, `update_time`, `is_deleted`)
SELECT `member_id`, DATE_ADD(CURDATE(), INTERVAL 7 DAY), '14:00:00', 'ORDER', `id`, 0,
       NULL, NULL, NULL, NOW(), NOW(), 0
FROM `biz_order` WHERE `status` = 1 AND `is_deleted` = 0 ORDER BY `id` LIMIT 1;

INSERT INTO `appointment`
  (`member_id`, `appointment_date`, `appointment_time`, `scene_type`, `order_id`, `status`,
   `complete_time`, `cancel_time`, `cancel_reason`, `create_time`, `update_time`, `is_deleted`)
SELECT `member_id`, DATE_SUB(CURDATE(), INTERVAL 7 DAY), '15:00:00', 'ORDER', `id`, 1,
       COALESCE(`verify_time`, `update_time`), NULL, NULL, `create_time`, NOW(), 0
FROM `biz_order` WHERE `status` = 3 AND `is_deleted` = 0 ORDER BY `id` LIMIT 1;

INSERT INTO `appointment`
  (`member_id`, `appointment_date`, `appointment_time`, `scene_type`, `order_id`, `status`,
   `complete_time`, `cancel_time`, `cancel_reason`, `create_time`, `update_time`, `is_deleted`)
SELECT `member_id`, DATE_ADD(CURDATE(), INTERVAL 9 DAY), '16:00:00', 'ORDER', `id`, 2,
       NULL, NOW(), '用户取消', NOW(), NOW(), 0
FROM `biz_order` o
WHERE o.`status` = 1 AND o.`is_deleted` = 0
  AND NOT EXISTS (
    SELECT 1 FROM `appointment` a WHERE a.`order_id` = o.`id` AND a.`status` IN (0, 1)
  )
ORDER BY o.`id` LIMIT 1;

INSERT INTO `appointment_operation_log`
  (`appointment_id`, `action`, `operator_type`, `operator_id`, `before_date`, `before_time`,
   `after_date`, `after_time`, `reason`, `create_time`, `update_time`, `is_deleted`)
SELECT `id`, 'CREATE', 'MEMBER', `member_id`, NULL, NULL,
       `appointment_date`, `appointment_time`, NULL, `create_time`, `create_time`, 0
FROM `appointment`;

INSERT INTO `appointment_operation_log`
  (`appointment_id`, `action`, `operator_type`, `operator_id`, `before_date`, `before_time`,
   `after_date`, `after_time`, `reason`, `create_time`, `update_time`, `is_deleted`)
SELECT `id`, 'COMPLETE', 'ADMIN', 1,
       `appointment_date`, `appointment_time`, `appointment_date`, `appointment_time`,
       IF(`scene_type` = 'ORDER', '订单核销', NULL), `complete_time`, `complete_time`, 0
FROM `appointment` WHERE `status` = 1;

INSERT INTO `appointment_operation_log`
  (`appointment_id`, `action`, `operator_type`, `operator_id`, `before_date`, `before_time`,
   `after_date`, `after_time`, `reason`, `create_time`, `update_time`, `is_deleted`)
SELECT `id`, 'CANCEL', 'MEMBER', `member_id`, `appointment_date`, `appointment_time`,
       `appointment_date`, `appointment_time`, `cancel_reason`, `cancel_time`, `cancel_time`, 0
FROM `appointment` WHERE `status` = 2;
