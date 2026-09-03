-- 好友代付：支付记录改为一次支付尝试，分离购买人与付款人。
-- 依赖：biz_p0.sql、biz_phase4.sql 已执行；MySQL 8。本文件可重复执行。

USE youlai_admin;
SET NAMES utf8mb4;

DROP PROCEDURE IF EXISTS `migrate_friend_payment`;
DELIMITER $$

CREATE PROCEDURE `migrate_friend_payment`()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_payment'
          AND COLUMN_NAME = 'payer_member_id'
    ) THEN
        ALTER TABLE `biz_payment`
            ADD COLUMN `payer_member_id` bigint NULL COMMENT '实际付款人会员ID'
            AFTER `member_id`;
    END IF;

    UPDATE `biz_payment`
    SET `payer_member_id` = `member_id`
    WHERE `payer_member_id` IS NULL;

    IF EXISTS (
        SELECT 1 FROM `biz_payment` p
        LEFT JOIN `member` m ON m.`id` = p.`payer_member_id`
        WHERE p.`payer_member_id` IS NULL OR m.`id` IS NULL
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'biz_payment 存在无效实际付款人，请先修复 payer_member_id';
    END IF;

    ALTER TABLE `biz_payment`
        MODIFY COLUMN `member_id` bigint NOT NULL COMMENT '订单购买人会员ID',
        MODIFY COLUMN `payer_member_id` bigint NOT NULL COMMENT '实际付款人会员ID';

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_payment'
          AND COLUMN_NAME = 'prepay_id'
    ) THEN
        ALTER TABLE `biz_payment`
            ADD COLUMN `prepay_id` varchar(64) NULL COMMENT '微信预支付会话ID'
            AFTER `third_party_no`;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_payment'
          AND COLUMN_NAME = 'expire_time'
    ) THEN
        ALTER TABLE `biz_payment`
            ADD COLUMN `expire_time` datetime NULL COMMENT '支付尝试租约结束时间'
            AFTER `prepay_id`;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_payment'
          AND INDEX_NAME = 'idx_payment_order_id'
    ) THEN
        ALTER TABLE `biz_payment` ADD INDEX `idx_payment_order_id` (`order_id`);
    END IF;

    -- order_id 外键需要可用索引；先补普通索引，再移除旧唯一索引。
    IF EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_payment'
          AND INDEX_NAME = 'uk_payment_order_id'
    ) THEN
        ALTER TABLE `biz_payment` DROP INDEX `uk_payment_order_id`;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_payment'
          AND INDEX_NAME = 'idx_payment_payer_member_id'
    ) THEN
        ALTER TABLE `biz_payment`
            ADD INDEX `idx_payment_payer_member_id` (`payer_member_id`);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_payment'
          AND CONSTRAINT_NAME = 'fk_biz_payment_payer_member'
    ) THEN
        ALTER TABLE `biz_payment`
            ADD CONSTRAINT `fk_biz_payment_payer_member`
            FOREIGN KEY (`payer_member_id`) REFERENCES `member` (`id`)
            ON UPDATE RESTRICT ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_payment'
          AND COLUMN_NAME = 'active_order_id'
    ) THEN
        ALTER TABLE `biz_payment`
            ADD COLUMN `active_order_id` bigint GENERATED ALWAYS AS (
                CASE WHEN `status` = 0 AND `is_deleted` = 0 THEN `order_id` ELSE NULL END
            ) VIRTUAL COMMENT '有效待支付订单ID';
    END IF;

    IF EXISTS (
        SELECT `order_id` FROM `biz_payment`
        WHERE `status` = 0 AND `is_deleted` = 0
        GROUP BY `order_id` HAVING COUNT(*) > 1
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'biz_payment 同一订单存在多条有效待支付记录，请先清理';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_payment'
          AND INDEX_NAME = 'uk_payment_active_order_id'
    ) THEN
        ALTER TABLE `biz_payment`
            ADD UNIQUE INDEX `uk_payment_active_order_id` (`active_order_id`);
    END IF;

    IF EXISTS (
        SELECT `payment_id` FROM `biz_refund`
        WHERE `is_deleted` = 0
        GROUP BY `payment_id` HAVING COUNT(*) > 1
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'biz_refund 同一支付存在多条有效退款，请先清理';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_refund'
          AND COLUMN_NAME = 'closed_refund_nos'
    ) THEN
        ALTER TABLE `biz_refund`
            ADD COLUMN `closed_refund_nos` varchar(1024) NULL
            COMMENT '已结束或已换号的历史商户退款单号(逗号分隔)'
            AFTER `third_party_no`;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_refund'
          AND CONSTRAINT_NAME = 'chk_biz_refund_status'
          AND CONSTRAINT_TYPE = 'CHECK'
    ) THEN
        ALTER TABLE `biz_refund` DROP CHECK `chk_biz_refund_status`;
    END IF;
    ALTER TABLE `biz_refund`
        ADD CONSTRAINT `chk_biz_refund_status` CHECK (`status` IN (0, 1, 2, 3, 4));

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_refund'
          AND INDEX_NAME = 'uk_refund_payment_id'
    ) THEN
        ALTER TABLE `biz_refund`
            ADD UNIQUE INDEX `uk_refund_payment_id` (`payment_id`);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_refund'
          AND INDEX_NAME = 'idx_refund_order_id'
    ) THEN
        ALTER TABLE `biz_refund` ADD INDEX `idx_refund_order_id` (`order_id`);
    END IF;

    -- 两个旧索引都可能被外键选中；替代索引必须先存在。
    IF EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_refund'
          AND INDEX_NAME = 'uk_refund_order_id'
    ) THEN
        ALTER TABLE `biz_refund` DROP INDEX `uk_refund_order_id`;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_refund'
          AND INDEX_NAME = 'idx_refund_payment_id'
    ) THEN
        ALTER TABLE `biz_refund` DROP INDEX `idx_refund_payment_id`;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_order'
          AND COLUMN_NAME = 'paid_payment_id'
    ) THEN
        ALTER TABLE `biz_order`
            ADD COLUMN `paid_payment_id` bigint NULL COMMENT '完成订单的支付流水ID'
            AFTER `pay_time`;
    END IF;

    UPDATE `biz_order` o
    JOIN `biz_payment` p
      ON p.`order_id` = o.`id`
     AND p.`is_deleted` = 0
     AND p.`status` IN (1, 3)
    SET o.`paid_payment_id` = p.`id`
    WHERE o.`paid_payment_id` IS NULL
      AND o.`status` IN (1, 2, 3, 5);

    IF EXISTS (
        SELECT 1 FROM `biz_order` o
        LEFT JOIN `biz_payment` p ON p.`id` = o.`paid_payment_id`
        WHERE o.`paid_payment_id` IS NOT NULL
          AND (p.`id` IS NULL OR p.`order_id` <> o.`id` OR p.`status` NOT IN (1, 3))
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'biz_order.paid_payment_id 存在无效支付关联，请先修复';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_order'
          AND INDEX_NAME = 'uk_order_paid_payment_id'
    ) THEN
        ALTER TABLE `biz_order`
            ADD UNIQUE INDEX `uk_order_paid_payment_id` (`paid_payment_id`);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_order'
          AND CONSTRAINT_NAME = 'fk_biz_order_paid_payment'
    ) THEN
        ALTER TABLE `biz_order`
            ADD CONSTRAINT `fk_biz_order_paid_payment`
            FOREIGN KEY (`paid_payment_id`) REFERENCES `biz_payment` (`id`)
            ON UPDATE RESTRICT ON DELETE RESTRICT;
    END IF;
END$$

DELIMITER ;
CALL `migrate_friend_payment`();
DROP PROCEDURE `migrate_friend_payment`;

CREATE TABLE IF NOT EXISTS `biz_proxy_pay_share` (
    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
    `order_id` bigint NOT NULL COMMENT '订单ID',
    `owner_member_id` bigint NOT NULL COMMENT '订单购买人会员ID',
    `token_hash` char(64) NOT NULL COMMENT '分享令牌SHA-256',
    `expires_at` datetime NOT NULL COMMENT '分享截止时间',
    `create_by` bigint NULL COMMENT '创建人ID',
    `create_time` datetime NULL COMMENT '创建时间',
    `update_by` bigint NULL COMMENT '修改人ID',
    `update_time` datetime NULL COMMENT '更新时间',
    `is_deleted` tinyint NOT NULL DEFAULT 0 COMMENT '逻辑删除标识(1-已删除 0-未删除)',
    PRIMARY KEY (`id`) USING BTREE,
    UNIQUE INDEX `uk_proxy_pay_share_token_hash` (`token_hash`) USING BTREE,
    INDEX `idx_proxy_pay_share_order_id` (`order_id`) USING BTREE,
    CONSTRAINT `fk_proxy_pay_share_order` FOREIGN KEY (`order_id`) REFERENCES `biz_order` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_proxy_pay_share_owner_member`
        FOREIGN KEY (`owner_member_id`) REFERENCES `member` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `chk_proxy_pay_share_is_deleted` CHECK (`is_deleted` IN (0, 1))
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COMMENT = '好友代付分享凭证表';
