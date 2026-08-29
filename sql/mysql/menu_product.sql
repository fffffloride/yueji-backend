-- ----------------------------------------------------
-- 商品管理菜单（阶段2）
-- 目录：商品管理(/product)，菜单：商品分类、商品列表
-- ----------------------------------------------------
USE youlai_admin;

SET NAMES utf8mb4;

INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`)
VALUES (3000, 0, '0', '商品管理', 'C', '', '/product', 'Layout', NULL, NULL, NULL, 1, 0, 'el-icon-Goods', '/product/goods', now(), now(), NULL);

INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`)
VALUES (3001, 3000, '0,3000', '商品列表', 'M', 'ProductGoods', 'goods', 'product/goods/index', NULL, NULL, 1, 1, 1, 'el-icon-Goods', NULL, now(), now(), NULL);

INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`)
VALUES (3002, 3000, '0,3000', '商品分类', 'M', 'ProductCategory', 'category', 'product/category/index', NULL, NULL, 1, 1, 2, 'el-icon-Menu', NULL, now(), now(), NULL);

-- 授权：1-ROOT(超管，后端对 userId=1 直接放行，保险起见仍插入)、2-ADMIN(系统管理员)
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (1, 3000), (1, 3001), (1, 3002);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (2, 3000), (2, 3001), (2, 3002);
