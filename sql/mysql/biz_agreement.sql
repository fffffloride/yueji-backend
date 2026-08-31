-- 用户协议与隐私政策管理
USE youlai_admin;

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `agreement` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `type` varchar(32) NOT NULL,
  `draft_title` varchar(100) NOT NULL,
  `draft_content` text NOT NULL,
  `published_title` varchar(100) DEFAULT NULL,
  `published_content` text DEFAULT NULL,
  `publish_time` datetime DEFAULT NULL,
  `create_by` bigint DEFAULT NULL,
  `create_time` datetime DEFAULT NULL,
  `update_by` bigint DEFAULT NULL,
  `update_time` datetime DEFAULT NULL,
  `is_deleted` tinyint NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_agreement_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='协议管理';

INSERT INTO `agreement` (`type`,`draft_title`,`draft_content`,`create_time`,`update_time`,`is_deleted`)
SELECT 'USER_AGREEMENT','用户协议','<p>请在管理后台编辑并发布用户协议。</p>',NOW(),NOW(),0
WHERE NOT EXISTS (SELECT 1 FROM `agreement` WHERE `type`='USER_AGREEMENT' AND `is_deleted`=0);

INSERT INTO `agreement` (`type`,`draft_title`,`draft_content`,`create_time`,`update_time`,`is_deleted`)
SELECT 'PRIVACY_POLICY','隐私政策','<p>请在管理后台编辑并发布隐私政策。</p>',NOW(),NOW(),0
WHERE NOT EXISTS (SELECT 1 FROM `agreement` WHERE `type`='PRIVACY_POLICY' AND `is_deleted`=0);

DELETE FROM `sys_role_menu` WHERE `menu_id` IN (3530,3531,3532,3533);
DELETE FROM `sys_menu` WHERE `id` IN (3533,3532,3531,3530);

INSERT INTO `sys_menu`
  (`id`,`parent_id`,`tree_path`,`name`,`type`,`route_name`,`route_path`,`component`,`perm`,
   `always_show`,`keep_alive`,`visible`,`sort`,`icon`,`redirect`,`create_time`,`update_time`,`params`)
VALUES
  (3530,3500,'0,3500','协议管理','M','AgreementManagement','agreement','decoration/agreement/index',NULL,0,1,1,4,'el-icon-Document',NULL,NOW(),NOW(),NULL),
  (3531,3530,'0,3500,3530','协议查询','B',NULL,'',NULL,'content:agreement:list',NULL,NULL,1,1,'',NULL,NOW(),NOW(),NULL),
  (3532,3530,'0,3500,3530','协议编辑','B',NULL,'',NULL,'content:agreement:update',NULL,NULL,1,2,'',NULL,NOW(),NOW(),NULL),
  (3533,3530,'0,3500,3530','协议发布','B',NULL,'',NULL,'content:agreement:publish',NULL,NULL,1,3,'',NULL,NOW(),NOW(),NULL);

INSERT INTO `sys_role_menu` (`role_id`,`menu_id`)
SELECT roles.role_id, menus.menu_id
FROM (SELECT 1 role_id UNION ALL SELECT 2) roles
CROSS JOIN (SELECT 3530 menu_id UNION ALL SELECT 3531 UNION ALL SELECT 3532 UNION ALL SELECT 3533) menus;
