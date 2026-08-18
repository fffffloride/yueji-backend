-- 阶段6：预约管理菜单与权限
USE youlai_admin;

SET NAMES utf8mb4;

DELETE FROM `sys_role_menu` WHERE `menu_id` IN (3400, 3401, 3402);
DELETE FROM `sys_menu` WHERE `id` IN (3402, 3401, 3400);

INSERT INTO `sys_menu`
  (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`,
   `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`)
VALUES
  (3400, 0, '0', '预约管理', 'C', '', '/appointment', 'Layout', NULL,
   0, NULL, 1, 4, 'el-icon-Calendar', '/appointment/index', NOW(), NOW(), NULL),
  (3401, 3400, '0,3400', '预约记录', 'M', 'BizAppointment', 'index', 'appointment/index', NULL,
   0, 1, 1, 1, 'el-icon-Calendar', NULL, NOW(), NOW(), NULL),
  (3402, 3401, '0,3400,3401', '预约查询', 'B', NULL, '', NULL, 'biz:appointment:query',
   NULL, NULL, 1, 1, '', NULL, NOW(), NOW(), NULL);

INSERT INTO `sys_role_menu` (`role_id`, `menu_id`)
SELECT roles.role_id, menus.menu_id
FROM (SELECT 1 AS role_id UNION ALL SELECT 2) roles
CROSS JOIN (SELECT 3400 AS menu_id UNION ALL SELECT 3401 UNION ALL SELECT 3402) menus;
