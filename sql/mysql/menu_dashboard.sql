-- 管理端仪表盘经营数据权限
-- 执行后清除 Redis Hash `system:role:perms` 的 ROOT、ADMIN 字段。
USE youlai_admin;

SET NAMES utf8mb4;

DELETE FROM `sys_role_menu` WHERE `menu_id` = 3900;
DELETE FROM `sys_menu` WHERE `id` = 3900;

INSERT INTO `sys_menu`
  (`id`,`parent_id`,`tree_path`,`name`,`type`,`route_name`,`route_path`,`component`,`perm`,
   `always_show`,`keep_alive`,`visible`,`sort`,`icon`,`redirect`,`create_time`,`update_time`,`params`)
VALUES
  (3900,0,'0','仪表盘数据','B',NULL,'',NULL,'dashboard:view',NULL,NULL,0,1,'',NULL,NOW(),NOW(),NULL);

INSERT INTO `sys_role_menu` (`role_id`,`menu_id`) VALUES (1,3900),(2,3900);
