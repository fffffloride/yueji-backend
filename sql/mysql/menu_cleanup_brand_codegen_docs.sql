-- 移除代码生成和平台文档，并修复商品菜单图标。
-- 可重复执行。

USE youlai_admin;

START TRANSACTION;

DELETE role_menu
FROM sys_role_menu AS role_menu
JOIN sys_menu AS menu ON menu.id = role_menu.menu_id
WHERE menu.id IN (2, 4)
   OR menu.tree_path REGEXP '^0,(2|4)(,|$)';

DELETE FROM sys_menu
WHERE tree_path REGEXP '^0,(2|4)(,|$)';

DELETE FROM sys_menu
WHERE id IN (2, 4);

UPDATE sys_menu SET icon = 'el-icon-Goods' WHERE id = 3000;

COMMIT;

-- MySQL DDL 会隐式提交，因此放在菜单事务之后。
DROP TABLE IF EXISTS gen_table_column;
DROP TABLE IF EXISTS gen_table;
