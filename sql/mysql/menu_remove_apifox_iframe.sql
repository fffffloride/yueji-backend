-- 移除 Apifox 菜单及其空的接口文档目录。
-- 可重复执行。

USE youlai_admin;

START TRANSACTION;

DELETE role_menu
FROM sys_role_menu AS role_menu
JOIN sys_menu AS menu ON menu.id = role_menu.menu_id
WHERE menu.id IN (5, 601)
   OR menu.tree_path REGEXP '^0,5(,|$)';

DELETE FROM sys_menu
WHERE tree_path REGEXP '^0,5(,|$)';

DELETE FROM sys_menu
WHERE id IN (5, 601);

COMMIT;
