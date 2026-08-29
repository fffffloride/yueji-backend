-- auth 安全加固（既有数据库一次性执行）
-- 新建数据库已由 youlai_admin.sql 包含相同最终结构，无需重复执行本文件。

USE youlai_admin;
SET NAMES utf8mb4;

DROP PROCEDURE IF EXISTS `migrate_auth_hardening`;
DELIMITER $$

CREATE PROCEDURE `migrate_auth_hardening`()
BEGIN
    IF EXISTS (
        SELECT 1
        FROM `sys_user`
        WHERE `is_deleted` = 0
        GROUP BY `username`
        HAVING COUNT(*) > 1
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'sys_user 存在重复活动用户名，请先清理数据';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM `sys_user`
        WHERE `is_deleted` = 0 AND `mobile` IS NOT NULL
        GROUP BY `mobile`
        HAVING COUNT(*) > 1
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'sys_user 存在重复活动手机号，请先清理数据';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM `sys_user`
        WHERE `username` IS NULL OR `nickname` IS NULL OR `password` IS NULL
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'sys_user 存在空身份字段，请先补齐数据';
    END IF;

    ALTER TABLE `sys_user`
        MODIFY COLUMN `username` varchar(64) NOT NULL COMMENT '用户名',
        MODIFY COLUMN `nickname` varchar(64) NOT NULL COMMENT '昵称',
        MODIFY COLUMN `password` varchar(100) NOT NULL COMMENT '密码',
        MODIFY COLUMN `dept_id` bigint NULL COMMENT '部门ID',
        MODIFY COLUMN `status` tinyint(1) NOT NULL DEFAULT 1 COMMENT '状态(1-正常 0-禁用)',
        MODIFY COLUMN `is_deleted` tinyint(1) NOT NULL DEFAULT 0 COMMENT '逻辑删除标识(0-未删除 1-已删除)',
        ADD COLUMN `active_username` varchar(64)
            GENERATED ALWAYS AS (CASE WHEN `is_deleted` = 0 THEN `username` ELSE NULL END) STORED
            COMMENT '活动用户名唯一键',
        ADD COLUMN `active_mobile` varchar(20)
            GENERATED ALWAYS AS (CASE WHEN `is_deleted` = 0 THEN `mobile` ELSE NULL END) STORED
            COMMENT '活动手机号唯一键',
        ADD UNIQUE INDEX `uk_sys_user_active_username` (`active_username`),
        ADD UNIQUE INDEX `uk_sys_user_active_mobile` (`active_mobile`);
END$$

DELIMITER ;
CALL `migrate_auth_hardening`();
DROP PROCEDURE `migrate_auth_hardening`;
