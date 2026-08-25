-- 移除模板自带的组件、功能、多级菜单和路由参数演示。
-- 可重复执行；共享组件和菜单路由参数能力不受影响。

START TRANSACTION;

DELETE role_menu
FROM sys_role_menu AS role_menu
JOIN sys_menu AS menu ON menu.id = role_menu.menu_id
WHERE menu.id IN (6, 7, 8, 9)
   OR menu.tree_path REGEXP '^0,(6|7|8|9)(,|$)';

DELETE FROM sys_menu
WHERE tree_path REGEXP '^0,(6|7|8|9)(,|$)';

DELETE FROM sys_menu
WHERE id IN (6, 7, 8, 9);

COMMIT;
