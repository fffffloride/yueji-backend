-- 会员管理菜单（阶段4）
USE youlai_admin;

SET NAMES utf8mb4;

INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`)
VALUES (3200, 0, '0', '会员管理', 'C', '', '/member', 'Layout', NULL, NULL, NULL, 1, 2, 'el-icon-User', '/member/index', now(), now(), NULL);

INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`)
VALUES (3201, 3200, '0,3200', '会员列表', 'M', 'BizMember', 'index', 'member/index', NULL, NULL, 1, 1, 1, 'el-icon-UserFilled', NULL, now(), now(), NULL);

INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`)
VALUES (3202, 3201, '0,3200,3201', '会员查询', 'B', NULL, '', NULL, 'biz:member:list', NULL, NULL, 1, 1, '', NULL, now(), now(), NULL);

INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`)
VALUES (3203, 3201, '0,3200,3201', '会员编辑', 'B', NULL, '', NULL, 'biz:member:update', NULL, NULL, 1, 2, '', NULL, now(), now(), NULL);

-- 授权：1-ROOT、2-ADMIN
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (1, 3200), (1, 3201), (1, 3202), (1, 3203);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (2, 3200), (2, 3201), (2, 3202), (2, 3203);
