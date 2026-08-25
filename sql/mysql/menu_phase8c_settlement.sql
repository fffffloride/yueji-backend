-- 阶段8C：分销结算管理菜单
-- 执行后清除 Redis Hash `system:role:perms` 的 ADMIN 字段。
USE youlai_admin;

SET NAMES utf8mb4;

DELETE FROM `sys_role_menu` WHERE `menu_id` IN (3660,3661,3662,3663,3664,3665,3666);
DELETE FROM `sys_menu` WHERE `id` IN (3661,3662,3663,3664,3665,3666,3660);

INSERT INTO `sys_menu`
  (`id`,`parent_id`,`tree_path`,`name`,`type`,`route_name`,`route_path`,`component`,`perm`,
   `always_show`,`keep_alive`,`visible`,`sort`,`icon`,`redirect`,`create_time`,`update_time`,`params`)
VALUES
  (3660,3600,'0,3600','结算管理','M','BizDistributionSettlement','settlement','distribution/settlement/index',NULL,0,1,1,6,'el-icon-Wallet',NULL,NOW(),NOW(),NULL),
  (3661,3660,'0,3600,3660','结算查询','B',NULL,'',NULL,'biz:distribution:settlement:list',NULL,NULL,1,1,'',NULL,NOW(),NOW(),NULL),
  (3662,3660,'0,3600,3660','结算配置','B',NULL,'',NULL,'biz:distribution:settlement:config',NULL,NULL,1,2,'',NULL,NOW(),NOW(),NULL),
  (3663,3660,'0,3600,3660','执行结算','B',NULL,'',NULL,'biz:distribution:settlement:run',NULL,NULL,1,3,'',NULL,NOW(),NOW(),NULL),
  (3664,3660,'0,3600,3660','提现查询','B',NULL,'',NULL,'biz:distribution:withdrawal:list',NULL,NULL,1,4,'',NULL,NOW(),NOW(),NULL),
  (3665,3660,'0,3600,3660','提现审核','B',NULL,'',NULL,'biz:distribution:withdrawal:audit',NULL,NULL,1,5,'',NULL,NOW(),NOW(),NULL),
  (3666,3660,'0,3600,3660','确认打款','B',NULL,'',NULL,'biz:distribution:withdrawal:paid',NULL,NULL,1,6,'',NULL,NOW(),NOW(),NULL);

INSERT INTO `sys_role_menu` (`role_id`,`menu_id`)
SELECT roles.role_id, menus.menu_id
FROM (SELECT 1 role_id UNION ALL SELECT 2) roles
CROSS JOIN (
  SELECT 3660 menu_id UNION ALL SELECT 3661 UNION ALL SELECT 3662
  UNION ALL SELECT 3663 UNION ALL SELECT 3664 UNION ALL SELECT 3665 UNION ALL SELECT 3666
) menus;
