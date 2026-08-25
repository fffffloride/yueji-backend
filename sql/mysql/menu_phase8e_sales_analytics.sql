-- 阶段8E：销售统计菜单
-- 执行后清除 Redis Hash `system:role:perms` 的 ADMIN 字段。
USE youlai_admin;

SET NAMES utf8mb4;

DELETE FROM `sys_role_menu` WHERE `menu_id` IN (3680,3681,3682);
DELETE FROM `sys_menu` WHERE `id` IN (3681,3682,3680);

INSERT INTO `sys_menu`
  (`id`,`parent_id`,`tree_path`,`name`,`type`,`route_name`,`route_path`,`component`,`perm`,
   `always_show`,`keep_alive`,`visible`,`sort`,`icon`,`redirect`,`create_time`,`update_time`,`params`)
VALUES
  (3680,3600,'0,3600','销售统计','M','BizDistributionAnalytics','analytics','distribution/analytics/index',NULL,0,1,1,8,'el-icon-TrendCharts',NULL,NOW(),NOW(),NULL),
  (3681,3680,'0,3600,3680','统计查询','B',NULL,'',NULL,'biz:distribution:analytics:list',NULL,NULL,1,1,'',NULL,NOW(),NOW(),NULL),
  (3682,3680,'0,3600,3680','统计导出','B',NULL,'',NULL,'biz:distribution:analytics:export',NULL,NULL,1,2,'',NULL,NOW(),NOW(),NULL);

INSERT INTO `sys_role_menu` (`role_id`,`menu_id`)
SELECT roles.role_id, menus.menu_id
FROM (SELECT 1 role_id UNION ALL SELECT 2) roles
CROSS JOIN (SELECT 3680 menu_id UNION ALL SELECT 3681 UNION ALL SELECT 3682) menus;
