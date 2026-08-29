-- payment/refund 关系、值域、渠道幂等与补偿索引加固（既有数据库一次性执行）
-- 依赖：biz_p0.sql、biz_phase4.sql 已执行。
-- 新建数据库已由 biz_phase4.sql 包含相同最终结构，无需重复执行本文件。

USE youlai_admin;
SET NAMES utf8mb4;

DROP PROCEDURE IF EXISTS `migrate_payment_hardening`;
DELIMITER $$

CREATE PROCEDURE `migrate_payment_hardening`()
BEGIN
    IF EXISTS (
        SELECT `third_party_no` FROM `biz_payment`
        WHERE `third_party_no` IS NOT NULL
        GROUP BY `third_party_no` HAVING COUNT(*) > 1
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'biz_payment 存在重复三方支付单号，请先清理';
    END IF;

    IF EXISTS (
        SELECT `third_party_no` FROM `biz_refund`
        WHERE `third_party_no` IS NOT NULL
        GROUP BY `third_party_no` HAVING COUNT(*) > 1
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'biz_refund 存在重复三方退款单号，请先清理';
    END IF;

    IF EXISTS (
        SELECT 1 FROM `biz_payment` p
        LEFT JOIN `biz_order` o ON o.`id` = p.`order_id`
        LEFT JOIN `member` m ON m.`id` = p.`member_id`
        WHERE o.`id` IS NULL OR m.`id` IS NULL
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'biz_payment 存在无订单或无会员记录，请先修复';
    END IF;

    IF EXISTS (
        SELECT 1 FROM `biz_refund` r
        LEFT JOIN `biz_payment` p ON p.`id` = r.`payment_id`
        LEFT JOIN `biz_order` o ON o.`id` = r.`order_id`
        LEFT JOIN `member` m ON m.`id` = r.`member_id`
        WHERE p.`id` IS NULL OR o.`id` IS NULL OR m.`id` IS NULL
           OR p.`order_id` <> r.`order_id` OR p.`member_id` <> r.`member_id`
           OR p.`amount` <> r.`amount`
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'biz_refund 存在孤儿、归属不一致或金额不一致记录，请先修复';
    END IF;

    IF EXISTS (
        SELECT 1 FROM `biz_payment`
        WHERE `amount` <= 0 OR `channel` NOT IN ('mock', 'wechat')
           OR `status` NOT IN (0, 1, 2, 3)
           OR `is_deleted` IS NULL OR `is_deleted` NOT IN (0, 1)
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'biz_payment 存在非法金额、渠道、状态或删除标识';
    END IF;

    IF EXISTS (
        SELECT 1 FROM `biz_refund`
        WHERE `amount` <= 0 OR CHAR_LENGTH(TRIM(`reason`)) = 0
           OR `status` NOT IN (0, 1, 2)
           OR `is_deleted` IS NULL OR `is_deleted` NOT IN (0, 1)
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'biz_refund 存在非法金额、原因、状态或删除标识';
    END IF;

    ALTER TABLE `biz_payment`
        MODIFY COLUMN `is_deleted` tinyint NOT NULL DEFAULT 0
        COMMENT '逻辑删除标识(1-已删除 0-未删除)';
    ALTER TABLE `biz_refund`
        MODIFY COLUMN `is_deleted` tinyint NOT NULL DEFAULT 0
        COMMENT '逻辑删除标识(1-已删除 0-未删除)';

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_payment'
          AND INDEX_NAME = 'uk_payment_third_party_no'
    ) THEN
        ALTER TABLE `biz_payment`
            ADD UNIQUE INDEX `uk_payment_third_party_no` (`third_party_no`);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_refund'
          AND INDEX_NAME = 'uk_refund_third_party_no'
    ) THEN
        ALTER TABLE `biz_refund`
            ADD UNIQUE INDEX `uk_refund_third_party_no` (`third_party_no`);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_payment'
          AND INDEX_NAME = 'idx_payment_reconcile'
    ) THEN
        ALTER TABLE `biz_payment`
            ADD INDEX `idx_payment_reconcile` (`status`, `is_deleted`, `update_time`, `id`);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_refund'
          AND INDEX_NAME = 'idx_refund_reconcile'
    ) THEN
        ALTER TABLE `biz_refund`
            ADD INDEX `idx_refund_reconcile` (`status`, `is_deleted`, `update_time`, `id`);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_payment'
          AND CONSTRAINT_NAME = 'fk_biz_payment_order'
    ) THEN
        ALTER TABLE `biz_payment`
            ADD CONSTRAINT `fk_biz_payment_order` FOREIGN KEY (`order_id`)
            REFERENCES `biz_order` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_payment'
          AND CONSTRAINT_NAME = 'fk_biz_payment_member'
    ) THEN
        ALTER TABLE `biz_payment`
            ADD CONSTRAINT `fk_biz_payment_member` FOREIGN KEY (`member_id`)
            REFERENCES `member` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_refund'
          AND CONSTRAINT_NAME = 'fk_biz_refund_payment'
    ) THEN
        ALTER TABLE `biz_refund`
            ADD CONSTRAINT `fk_biz_refund_payment` FOREIGN KEY (`payment_id`)
            REFERENCES `biz_payment` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_refund'
          AND CONSTRAINT_NAME = 'fk_biz_refund_order'
    ) THEN
        ALTER TABLE `biz_refund`
            ADD CONSTRAINT `fk_biz_refund_order` FOREIGN KEY (`order_id`)
            REFERENCES `biz_order` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_refund'
          AND CONSTRAINT_NAME = 'fk_biz_refund_member'
    ) THEN
        ALTER TABLE `biz_refund`
            ADD CONSTRAINT `fk_biz_refund_member` FOREIGN KEY (`member_id`)
            REFERENCES `member` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_payment'
          AND CONSTRAINT_NAME = 'chk_biz_payment_amount'
    ) THEN
        ALTER TABLE `biz_payment`
            ADD CONSTRAINT `chk_biz_payment_amount` CHECK (`amount` > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_payment'
          AND CONSTRAINT_NAME = 'chk_biz_payment_channel'
    ) THEN
        ALTER TABLE `biz_payment`
            ADD CONSTRAINT `chk_biz_payment_channel` CHECK (`channel` IN ('mock', 'wechat'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_payment'
          AND CONSTRAINT_NAME = 'chk_biz_payment_status'
    ) THEN
        ALTER TABLE `biz_payment`
            ADD CONSTRAINT `chk_biz_payment_status` CHECK (`status` IN (0, 1, 2, 3));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_payment'
          AND CONSTRAINT_NAME = 'chk_biz_payment_is_deleted'
    ) THEN
        ALTER TABLE `biz_payment`
            ADD CONSTRAINT `chk_biz_payment_is_deleted` CHECK (`is_deleted` IN (0, 1));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_refund'
          AND CONSTRAINT_NAME = 'chk_biz_refund_amount'
    ) THEN
        ALTER TABLE `biz_refund`
            ADD CONSTRAINT `chk_biz_refund_amount` CHECK (`amount` > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_refund'
          AND CONSTRAINT_NAME = 'chk_biz_refund_reason'
    ) THEN
        ALTER TABLE `biz_refund`
            ADD CONSTRAINT `chk_biz_refund_reason` CHECK (CHAR_LENGTH(TRIM(`reason`)) > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_refund'
          AND CONSTRAINT_NAME = 'chk_biz_refund_status'
    ) THEN
        ALTER TABLE `biz_refund`
            ADD CONSTRAINT `chk_biz_refund_status` CHECK (`status` IN (0, 1, 2));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_refund'
          AND CONSTRAINT_NAME = 'chk_biz_refund_is_deleted'
    ) THEN
        ALTER TABLE `biz_refund`
            ADD CONSTRAINT `chk_biz_refund_is_deleted` CHECK (`is_deleted` IN (0, 1));
    END IF;
END$$

DELIMITER ;
CALL `migrate_payment_hardening`();
DROP PROCEDURE `migrate_payment_hardening`;
