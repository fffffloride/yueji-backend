-- member 安全加固（既有数据库一次性执行）
-- 依赖：biz_p0.sql、biz_phase4.sql、biz_phase5.sql 已执行。
-- 新建数据库已由上述阶段 SQL 包含相同最终结构，无需重复执行本文件。

USE youlai_admin;
SET NAMES utf8mb4;

DROP PROCEDURE IF EXISTS `migrate_member_hardening`;
DELIMITER $$

CREATE PROCEDURE `migrate_member_hardening`()
BEGIN
    IF EXISTS (
        SELECT 1
        FROM `member`
        WHERE `mobile` IS NOT NULL
        GROUP BY `mobile`
        HAVING COUNT(*) > 1
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'member 存在重复手机号，请先合并会员数据';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM `member`
        WHERE `unionid` IS NOT NULL
        GROUP BY `unionid`
        HAVING COUNT(*) > 1
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'member 存在重复 unionid，请先合并会员数据';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM `member`
        WHERE `nickname` IS NULL
           OR `gender` IS NULL
           OR `status` IS NULL
           OR `points` IS NULL
           OR `total_spent` IS NULL
           OR `is_deleted` IS NULL
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'member 存在 NULL 必填字段，请先补齐数据';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM `member`
        WHERE CHAR_LENGTH(TRIM(`openid`)) = 0
           OR CHAR_LENGTH(TRIM(`nickname`)) = 0
           OR (`mobile` IS NOT NULL AND CHAR_LENGTH(TRIM(`mobile`)) = 0)
           OR (`unionid` IS NOT NULL AND CHAR_LENGTH(TRIM(`unionid`)) = 0)
           OR `gender` NOT IN (0, 1, 2)
           OR `status` NOT IN (0, 1)
           OR `points` < 0
           OR `total_spent` < 0
           OR `is_deleted` NOT IN (0, 1)
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'member 存在非法身份、状态或余额字段，请先清理数据';
    END IF;

    ALTER TABLE `member`
        MODIFY COLUMN `nickname` varchar(64) NOT NULL DEFAULT '微信用户' COMMENT '昵称',
        MODIFY COLUMN `gender` tinyint NOT NULL DEFAULT 0 COMMENT '性别(1-男 2-女 0-保密)',
        MODIFY COLUMN `status` tinyint NOT NULL DEFAULT 1 COMMENT '状态(1-正常 0-禁用)',
        MODIFY COLUMN `points` int NOT NULL DEFAULT 0 COMMENT '积分余额',
        MODIFY COLUMN `is_deleted` tinyint NOT NULL DEFAULT 0 COMMENT '逻辑删除标识(1-已删除 0-未删除)',
        DROP INDEX `idx_mobile`,
        ADD UNIQUE INDEX `uk_member_unionid` (`unionid`),
        ADD UNIQUE INDEX `uk_member_mobile` (`mobile`),
        ADD INDEX `idx_member_nickname` (`nickname`),
        ADD INDEX `idx_member_active_created` (`is_deleted`, `create_time`, `id`),
        ADD INDEX `idx_member_active_status_created` (`is_deleted`, `status`, `create_time`, `id`),
        ADD INDEX `idx_member_level_id` (`level_id`),
        ADD CONSTRAINT `chk_member_openid_not_blank`
            CHECK (CHAR_LENGTH(TRIM(`openid`)) > 0),
        ADD CONSTRAINT `chk_member_unionid_not_blank`
            CHECK (`unionid` IS NULL OR CHAR_LENGTH(TRIM(`unionid`)) > 0),
        ADD CONSTRAINT `chk_member_mobile_not_blank`
            CHECK (`mobile` IS NULL OR CHAR_LENGTH(TRIM(`mobile`)) > 0),
        ADD CONSTRAINT `chk_member_nickname_not_blank`
            CHECK (CHAR_LENGTH(TRIM(`nickname`)) > 0),
        ADD CONSTRAINT `chk_member_gender` CHECK (`gender` IN (0, 1, 2)),
        ADD CONSTRAINT `chk_member_status` CHECK (`status` IN (0, 1)),
        ADD CONSTRAINT `chk_member_points` CHECK (`points` >= 0),
        ADD CONSTRAINT `chk_member_total_spent` CHECK (`total_spent` >= 0),
        ADD CONSTRAINT `chk_member_is_deleted` CHECK (`is_deleted` IN (0, 1));
END$$

DELIMITER ;
CALL `migrate_member_hardening`();
DROP PROCEDURE `migrate_member_hardening`;
