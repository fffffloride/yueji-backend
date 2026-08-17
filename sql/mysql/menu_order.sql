-- ----------------------------------------------------
-- 订单管理菜单（阶段3）
-- 目录：订单管理(/order)，菜单：订单列表
-- ----------------------------------------------------
USE youlai_admin;

INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`)
VALUES (3100, 0, '0', '订单管理', 'C', '', '/order', 'Layout', NULL, NULL, NULL, 1, 1, 'el-icon-Document', '/order/index', now(), now(), NULL);

INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`)
VALUES (3101, 3100, '0,3100', '订单列表', 'M', 'BizOrder', 'index', 'order/index', NULL, NULL, 1, 1, 1, 'el-icon-Tickets', NULL, now(), now(), NULL);

INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`)
VALUES (3102, 3101, '0,3100,3101', '订单查询', 'B', NULL, '', NULL, 'biz:order:list', NULL, NULL, 1, 1, '', NULL, now(), now(), NULL);

INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`)
VALUES (3103, 3101, '0,3100,3101', '订单核销', 'B', NULL, '', NULL, 'biz:order:verify', NULL, NULL, 1, 2, '', NULL, now(), now(), NULL);

INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`)
VALUES (3104, 3101, '0,3100,3101', '订单导出', 'B', NULL, '', NULL, 'biz:order:export', NULL, NULL, 1, 3, '', NULL, now(), now(), NULL);

-- 授权：1-ROOT、2-ADMIN(admin 用户 role_id=2)
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (1, 3100), (1, 3101), (1, 3102), (1, 3103), (1, 3104);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (2, 3100), (2, 3101), (2, 3102), (2, 3103), (2, 3104);
