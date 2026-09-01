-- 既有环境：预约时段容量配置
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

INSERT INTO `sys_menu`
  (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`,
   `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`)
VALUES
  (3403, 3401, '0,3400,3401', '预约配置', 'B', NULL, '', NULL, 'biz:appointment:config',
   NULL, NULL, 1, 2, '', NULL, NOW(), NOW(), NULL)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`), `perm` = VALUES(`perm`), `update_time` = NOW();

INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`)
SELECT `id`, 3403 FROM `sys_role` WHERE `id` IN (1, 2);
