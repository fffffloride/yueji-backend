-- 既有环境：预约场景与订单关联
USE youlai_admin;

SET NAMES utf8mb4;

ALTER TABLE `appointment`
  ADD COLUMN `scene_type` varchar(20) NOT NULL DEFAULT 'CONSULTATION'
    COMMENT '预约场景(CONSULTATION-面诊 ORDER-订单)' AFTER `appointment_time`,
  ADD COLUMN `order_id` bigint NULL COMMENT '关联订单ID' AFTER `scene_type`,
  ADD UNIQUE INDEX `uk_appointment_order_id` (`order_id`);
