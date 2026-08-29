-- 修复阶段2–5菜单：导入时未 SET NAMES utf8mb4，中文被按 latin1 写入。
-- 可重复执行：只改仍是乱码（UTF-8 二次编码）的行。
USE youlai_admin;

SET NAMES utf8mb4;

UPDATE `sys_menu`
SET `name` = CONVERT(BINARY CONVERT(`name` USING latin1) USING utf8mb4),
    `update_time` = NOW()
WHERE HEX(`name`) LIKE 'C3%';
