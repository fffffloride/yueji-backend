-- 阶段8D：分销任务管理菜单
-- 执行后清除 Redis Hash `system:role:perms` 的 ADMIN 字段。
USE youlai_admin;

SET NAMES utf8mb4;

DELETE FROM `sys_role_menu` WHERE `menu_id` IN (3670,3671,3672,3673,3674,3675,3676);
DELETE FROM `sys_menu` WHERE `id` IN (3671,3672,3673,3674,3675,3676,3670);

INSERT INTO `sys_menu`
  (`id`,`parent_id`,`tree_path`,`name`,`type`,`route_name`,`route_path`,`component`,`perm`,
   `always_show`,`keep_alive`,`visible`,`sort`,`icon`,`redirect`,`create_time`,`update_time`,`params`)
VALUES
  (3670,3600,'0,3600','任务管理','M','BizDistributionTask','task','distribution/task/index',NULL,0,1,1,7,'el-icon-List',NULL,NOW(),NOW(),NULL),
  (3671,3670,'0,3600,3670','任务查询','B',NULL,'',NULL,'biz:distribution:task:list',NULL,NULL,1,1,'',NULL,NOW(),NOW(),NULL),
  (3672,3670,'0,3600,3670','任务新增','B',NULL,'',NULL,'biz:distribution:task:create',NULL,NULL,1,2,'',NULL,NOW(),NOW(),NULL),
  (3673,3670,'0,3600,3670','任务编辑','B',NULL,'',NULL,'biz:distribution:task:update',NULL,NULL,1,3,'',NULL,NOW(),NOW(),NULL),
  (3674,3670,'0,3600,3670','任务删除','B',NULL,'',NULL,'biz:distribution:task:delete',NULL,NULL,1,4,'',NULL,NOW(),NOW(),NULL),
  (3675,3670,'0,3600,3670','任务发布','B',NULL,'',NULL,'biz:distribution:task:publish',NULL,NULL,1,5,'',NULL,NOW(),NOW(),NULL),
  (3676,3670,'0,3600,3670','任务取消','B',NULL,'',NULL,'biz:distribution:task:cancel',NULL,NULL,1,6,'',NULL,NOW(),NOW(),NULL);

INSERT INTO `sys_role_menu` (`role_id`,`menu_id`)
SELECT roles.role_id, menus.menu_id
FROM (SELECT 1 role_id UNION ALL SELECT 2) roles
CROSS JOIN (
  SELECT 3670 menu_id UNION ALL SELECT 3671 UNION ALL SELECT 3672 UNION ALL SELECT 3673
  UNION ALL SELECT 3674 UNION ALL SELECT 3675 UNION ALL SELECT 3676
) menus;
