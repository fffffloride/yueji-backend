-- 商品与分类按钮权限；可在已有阶段2数据库中单独执行。
USE youlai_admin;

SET NAMES utf8mb4;

INSERT INTO `sys_menu`
(`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`)
VALUES
(3003, 3001, '0,3000,3001', '商品查询', 'B', NULL, '', NULL, 'biz:product:list', NULL, NULL, 1, 1, '', NULL, now(), now(), NULL),
(3004, 3001, '0,3000,3001', '商品新增', 'B', NULL, '', NULL, 'biz:product:create', NULL, NULL, 1, 2, '', NULL, now(), now(), NULL),
(3005, 3001, '0,3000,3001', '商品编辑', 'B', NULL, '', NULL, 'biz:product:update', NULL, NULL, 1, 3, '', NULL, now(), now(), NULL),
(3006, 3001, '0,3000,3001', '商品删除', 'B', NULL, '', NULL, 'biz:product:delete', NULL, NULL, 1, 4, '', NULL, now(), now(), NULL),
(3007, 3001, '0,3000,3001', '商品上下架', 'B', NULL, '', NULL, 'biz:product:status', NULL, NULL, 1, 5, '', NULL, now(), now(), NULL),
(3010, 3002, '0,3000,3002', '分类查询', 'B', NULL, '', NULL, 'biz:product-category:list', NULL, NULL, 1, 1, '', NULL, now(), now(), NULL),
(3011, 3002, '0,3000,3002', '分类新增', 'B', NULL, '', NULL, 'biz:product-category:create', NULL, NULL, 1, 2, '', NULL, now(), now(), NULL),
(3012, 3002, '0,3000,3002', '分类编辑', 'B', NULL, '', NULL, 'biz:product-category:update', NULL, NULL, 1, 3, '', NULL, now(), now(), NULL),
(3013, 3002, '0,3000,3002', '分类删除', 'B', NULL, '', NULL, 'biz:product-category:delete', NULL, NULL, 1, 4, '', NULL, now(), now(), NULL)
ON DUPLICATE KEY UPDATE
`name` = VALUES(`name`), `perm` = VALUES(`perm`), `update_time` = now();

INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`)
SELECT roles.role_id, menus.menu_id
FROM (SELECT 1 AS role_id UNION ALL SELECT 2) roles
CROSS JOIN (
    SELECT 3003 AS menu_id UNION ALL SELECT 3004 UNION ALL SELECT 3005 UNION ALL SELECT 3006 UNION ALL SELECT 3007
    UNION ALL SELECT 3010 UNION ALL SELECT 3011 UNION ALL SELECT 3012 UNION ALL SELECT 3013
) menus;
