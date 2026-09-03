-- 订单送礼：分离原购买人与当前服务权益人，并增加赠礼审计记录。
-- 依赖：biz_p0.sql 已执行；MySQL 8。本文件可重复执行。

USE youlai_admin;
SET NAMES utf8mb4;

DROP PROCEDURE IF EXISTS `migrate_order_gifting`;
DELIMITER $$

CREATE PROCEDURE `migrate_order_gifting`()
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'biz_order'
          AND COLUMN_NAME = 'beneficiary_member_id'
    ) THEN
        ALTER TABLE `biz_order`
            ADD COLUMN `beneficiary_member_id` bigint NULL
            COMMENT '当前服务权益会员ID' AFTER `member_id`;
    END IF;

    UPDATE `biz_order`
    SET `beneficiary_member_id` = `member_id`
    WHERE `beneficiary_member_id` IS NULL;

    IF EXISTS (
        SELECT 1
        FROM `biz_order` o
        LEFT JOIN `member` m ON m.`id` = o.`beneficiary_member_id`
        WHERE o.`beneficiary_member_id` IS NULL OR m.`id` IS NULL
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'biz_order 存在无效权益会员，请先修复 beneficiary_member_id';
    END IF;

    ALTER TABLE `biz_order`
        MODIFY COLUMN `beneficiary_member_id` bigint NOT NULL
        COMMENT '当前服务权益会员ID';

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'biz_order'
          AND INDEX_NAME = 'idx_order_beneficiary_active_created'
    ) THEN
        ALTER TABLE `biz_order`
            ADD INDEX `idx_order_beneficiary_active_created`
                (`beneficiary_member_id`, `is_deleted`, `create_time` DESC, `id` DESC);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'biz_order'
          AND CONSTRAINT_NAME = 'fk_biz_order_beneficiary_member'
    ) THEN
        ALTER TABLE `biz_order`
            ADD CONSTRAINT `fk_biz_order_beneficiary_member`
            FOREIGN KEY (`beneficiary_member_id`) REFERENCES `member` (`id`)
            ON UPDATE RESTRICT ON DELETE RESTRICT;
    END IF;
END$$

DELIMITER ;
CALL `migrate_order_gifting`();
DROP PROCEDURE `migrate_order_gifting`;

CREATE TABLE IF NOT EXISTS `biz_order_gift` (
    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
    `order_id` bigint NOT NULL COMMENT '订单ID',
    `sender_member_id` bigint NOT NULL COMMENT '赠送会员ID',
    `recipient_member_id` bigint NULL COMMENT '领取会员ID',
    `token_hash` char(64) NOT NULL COMMENT '分享令牌SHA-256',
    `status` tinyint NOT NULL DEFAULT 0 COMMENT '赠礼状态(0-待领取 1-已领取 2-已撤回 3-已过期 4-已退回)',
    `expires_at` datetime NOT NULL COMMENT '领取截止时间',
    `claimed_at` datetime NULL COMMENT '领取时间',
    `revoked_at` datetime NULL COMMENT '撤回时间',
    `returned_at` datetime NULL COMMENT '退回时间',
    `create_by` bigint NULL COMMENT '创建人ID',
    `create_time` datetime NULL COMMENT '创建时间',
    `update_by` bigint NULL COMMENT '修改人ID',
    `update_time` datetime NULL COMMENT '更新时间',
    `is_deleted` tinyint NOT NULL DEFAULT 0 COMMENT '逻辑删除标识(1-已删除 0-未删除)',
    `pending_order_id` bigint GENERATED ALWAYS AS (
        CASE WHEN `status` = 0 AND `is_deleted` = 0 THEN `order_id` ELSE NULL END
    ) STORED COMMENT '待领取订单ID',
    PRIMARY KEY (`id`) USING BTREE,
    UNIQUE INDEX `uk_order_gift_token_hash`(`token_hash` ASC) USING BTREE,
    UNIQUE INDEX `uk_order_gift_pending_order`(`pending_order_id` ASC) USING BTREE,
    INDEX `idx_order_gift_sender_status_created`(`sender_member_id` ASC, `status` ASC, `create_time` DESC, `id` DESC) USING BTREE,
    INDEX `idx_order_gift_recipient_status_created`(`recipient_member_id` ASC, `status` ASC, `create_time` DESC, `id` DESC) USING BTREE,
    CONSTRAINT `fk_biz_order_gift_order`
        FOREIGN KEY (`order_id`) REFERENCES `biz_order` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_biz_order_gift_sender_member`
        FOREIGN KEY (`sender_member_id`) REFERENCES `member` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_biz_order_gift_recipient_member`
        FOREIGN KEY (`recipient_member_id`) REFERENCES `member` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `chk_order_gift_status` CHECK (`status` IN (0, 1, 2, 3, 4)),
    CONSTRAINT `chk_order_gift_is_deleted` CHECK (`is_deleted` IN (0, 1))
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COMMENT = '订单赠礼记录表';
