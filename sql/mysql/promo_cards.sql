-- 独立首页活动卡片配置；新库在 menu_phase7.sql 之后执行，已有库可直接执行。
USE youlai_admin;
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `decoration_promo_cards` (
  `id` bigint NOT NULL,
  `cards` json NOT NULL,
  `create_by` bigint NULL, `create_time` datetime NULL,
  `update_by` bigint NULL, `update_time` datetime NULL,
  `is_deleted` tinyint NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  CONSTRAINT `chk_promo_cards_id` CHECK (`id` = 1),
  CONSTRAINT `chk_promo_cards_limit` CHECK (JSON_TYPE(`cards`) = 'ARRAY' AND JSON_LENGTH(`cards`) <= 4)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='首页活动卡片配置';

INSERT INTO `sys_menu`
  (`id`,`parent_id`,`tree_path`,`name`,`type`,`route_name`,`route_path`,`component`,`perm`,
   `always_show`,`keep_alive`,`visible`,`sort`,`icon`,`redirect`,`create_time`,`update_time`,`params`)
VALUES
  (3550,3500,'0,3500','首页活动卡片','M','BizDecorationPromoCards','promo-cards','decoration/promo-cards/index',NULL,0,1,1,6,'el-icon-Picture',NULL,NOW(),NOW(),NULL),
  (3551,3550,'0,3500,3550','卡片查询','B',NULL,'',NULL,'biz:decoration:promo-cards:list',NULL,NULL,1,1,'',NULL,NOW(),NOW(),NULL),
  (3552,3550,'0,3500,3550','卡片编辑','B',NULL,'',NULL,'biz:decoration:promo-cards:update',NULL,NULL,1,2,'',NULL,NOW(),NOW(),NULL)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `component`=VALUES(`component`), `perm`=VALUES(`perm`);

INSERT INTO `sys_role_menu` (`role_id`,`menu_id`)
SELECT roles.role_id, menus.menu_id
FROM (SELECT 1 role_id UNION ALL SELECT 2) roles
CROSS JOIN (SELECT 3550 menu_id UNION ALL SELECT 3551 UNION ALL SELECT 3552) menus
WHERE NOT EXISTS (SELECT 1 FROM `sys_role_menu` existing WHERE existing.role_id=roles.role_id AND existing.menu_id=menus.menu_id);
