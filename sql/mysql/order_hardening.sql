-- order 唯一性、关系、值域与查询索引加固（既有数据库一次性执行）
-- 依赖：biz_p0.sql、biz_phase4.sql、biz_phase5.sql 已执行。
-- 新建数据库已由 biz_p0.sql + biz_phase5.sql 包含相同最终结构，无需重复执行本文件。

USE youlai_admin;
SET NAMES utf8mb4;

DROP PROCEDURE IF EXISTS `migrate_order_hardening`;
DELIMITER $$

CREATE PROCEDURE `migrate_order_hardening`()
BEGIN
    IF EXISTS (
        SELECT `verify_code`
        FROM `biz_order`
        WHERE `verify_code` IS NOT NULL
        GROUP BY `verify_code`
        HAVING COUNT(*) > 1
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'biz_order 存在重复核销码，请先清理 verify_code';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM `biz_order` o
        LEFT JOIN `member` m ON m.`id` = o.`member_id`
        WHERE m.`id` IS NULL
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'biz_order 存在无会员订单，请先修复 member_id';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM `biz_order_item` i
        LEFT JOIN `biz_order` o ON o.`id` = i.`order_id`
        WHERE o.`id` IS NULL
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'biz_order_item 存在无订单明细，请先修复 order_id';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM `biz_order_item` i
        LEFT JOIN `product_sku` s
          ON s.`id` = i.`sku_id`
         AND s.`product_id` = i.`product_id`
        WHERE s.`id` IS NULL
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'biz_order_item 存在商品与 SKU 不匹配记录';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM `biz_order`
        WHERE `status` NOT IN (0, 1, 2, 3, 4, 5)
           OR `total_amount` < 0
           OR `discount_amount` < 0
           OR `pay_amount` < 0
           OR `discount_amount` > `total_amount`
           OR `pay_amount` <> `total_amount` - `discount_amount`
           OR `member_discount` < 0
           OR `coupon_amount` < 0
           OR `points_used` < 0
           OR `points_deduct` < 0
           OR `discount_amount` <> `member_discount` + `coupon_amount` + `points_deduct`
           OR (`pay_type` IS NOT NULL AND `pay_type` NOT IN (1, 2))
           OR (`verify_code` IS NOT NULL AND `verify_code` NOT REGEXP '^[0-9]{8}$')
           OR `is_deleted` IS NULL
           OR `is_deleted` NOT IN (0, 1)
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'biz_order 存在非法状态、金额、核销码或删除标识';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM `biz_order_item`
        WHERE `price` < 0
           OR `quantity` NOT BETWEEN 1 AND 99
           OR `subtotal` < 0
           OR `subtotal` <> `price` * `quantity`
           OR `is_deleted` IS NULL
           OR `is_deleted` NOT IN (0, 1)
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'biz_order_item 存在非法金额、数量或删除标识';
    END IF;

    ALTER TABLE `biz_order`
        MODIFY COLUMN `verify_code` varchar(8) NULL COMMENT '核销码',
        MODIFY COLUMN `is_deleted` tinyint NOT NULL DEFAULT 0 COMMENT '逻辑删除标识(1-已删除 0-未删除)';
    ALTER TABLE `biz_order_item`
        MODIFY COLUMN `is_deleted` tinyint NOT NULL DEFAULT 0 COMMENT '逻辑删除标识(1-已删除 0-未删除)';

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'product_sku'
          AND INDEX_NAME = 'uk_product_sku_product_id_id'
    ) THEN
        ALTER TABLE `product_sku`
            ADD UNIQUE INDEX `uk_product_sku_product_id_id` (`product_id`, `id`);
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'biz_order'
          AND INDEX_NAME = 'uk_order_verify_code'
          AND NON_UNIQUE = 1
    ) THEN
        ALTER TABLE `biz_order` DROP INDEX `uk_order_verify_code`;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'biz_order'
          AND INDEX_NAME = 'uk_order_verify_code'
          AND NON_UNIQUE = 0
    ) THEN
        ALTER TABLE `biz_order`
            ADD UNIQUE INDEX `uk_order_verify_code` (`verify_code`);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'biz_order'
          AND INDEX_NAME = 'idx_order_member_active_created'
    ) THEN
        ALTER TABLE `biz_order`
            ADD INDEX `idx_order_member_active_created`
                (`member_id`, `is_deleted`, `create_time` DESC, `id` DESC);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'biz_order'
          AND INDEX_NAME = 'idx_order_timeout_scan'
    ) THEN
        ALTER TABLE `biz_order`
            ADD INDEX `idx_order_timeout_scan`
                (`status`, `is_deleted`, `create_time`, `id`);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'biz_order_item'
          AND INDEX_NAME = 'idx_order_item_order'
    ) THEN
        ALTER TABLE `biz_order_item`
            ADD INDEX `idx_order_item_order` (`order_id`);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'biz_order_item'
          AND INDEX_NAME = 'idx_order_item_product_sku'
    ) THEN
        ALTER TABLE `biz_order_item`
            ADD INDEX `idx_order_item_product_sku` (`product_id`, `sku_id`);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'biz_order'
          AND CONSTRAINT_NAME = 'fk_biz_order_member'
    ) THEN
        ALTER TABLE `biz_order`
            ADD CONSTRAINT `fk_biz_order_member`
            FOREIGN KEY (`member_id`) REFERENCES `member` (`id`)
            ON UPDATE RESTRICT ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'biz_order_item'
          AND CONSTRAINT_NAME = 'fk_biz_order_item_order'
    ) THEN
        ALTER TABLE `biz_order_item`
            ADD CONSTRAINT `fk_biz_order_item_order`
            FOREIGN KEY (`order_id`) REFERENCES `biz_order` (`id`)
            ON UPDATE RESTRICT ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'biz_order_item'
          AND CONSTRAINT_NAME = 'fk_biz_order_item_product_sku'
    ) THEN
        ALTER TABLE `biz_order_item`
            ADD CONSTRAINT `fk_biz_order_item_product_sku`
            FOREIGN KEY (`product_id`, `sku_id`) REFERENCES `product_sku` (`product_id`, `id`)
            ON UPDATE RESTRICT ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'biz_order'
          AND CONSTRAINT_NAME = 'chk_biz_order_status'
    ) THEN
        ALTER TABLE `biz_order`
            ADD CONSTRAINT `chk_biz_order_status`
            CHECK (`status` IN (0, 1, 2, 3, 4, 5));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'biz_order'
          AND CONSTRAINT_NAME = 'chk_biz_order_amounts'
    ) THEN
        ALTER TABLE `biz_order`
            ADD CONSTRAINT `chk_biz_order_amounts` CHECK (
                `total_amount` >= 0 AND `discount_amount` >= 0 AND
                `pay_amount` >= 0 AND `discount_amount` <= `total_amount` AND
                `pay_amount` = `total_amount` - `discount_amount`
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'biz_order'
          AND CONSTRAINT_NAME = 'chk_biz_order_benefits'
    ) THEN
        ALTER TABLE `biz_order`
            ADD CONSTRAINT `chk_biz_order_benefits` CHECK (
                `member_discount` >= 0 AND `coupon_amount` >= 0 AND
                `points_used` >= 0 AND `points_deduct` >= 0 AND
                `discount_amount` = `member_discount` + `coupon_amount` + `points_deduct`
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'biz_order'
          AND CONSTRAINT_NAME = 'chk_biz_order_pay_type'
    ) THEN
        ALTER TABLE `biz_order`
            ADD CONSTRAINT `chk_biz_order_pay_type`
            CHECK (`pay_type` IS NULL OR `pay_type` IN (1, 2));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'biz_order'
          AND CONSTRAINT_NAME = 'chk_biz_order_verify_code'
    ) THEN
        ALTER TABLE `biz_order`
            ADD CONSTRAINT `chk_biz_order_verify_code`
            CHECK (`verify_code` IS NULL OR `verify_code` REGEXP '^[0-9]{8}$');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'biz_order'
          AND CONSTRAINT_NAME = 'chk_biz_order_is_deleted'
    ) THEN
        ALTER TABLE `biz_order`
            ADD CONSTRAINT `chk_biz_order_is_deleted` CHECK (`is_deleted` IN (0, 1));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'biz_order_item'
          AND CONSTRAINT_NAME = 'chk_biz_order_item_values'
    ) THEN
        ALTER TABLE `biz_order_item`
            ADD CONSTRAINT `chk_biz_order_item_values` CHECK (
                `price` >= 0 AND `quantity` BETWEEN 1 AND 99 AND
                `subtotal` >= 0 AND `subtotal` = `price` * `quantity`
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'biz_order_item'
          AND CONSTRAINT_NAME = 'chk_biz_order_item_is_deleted'
    ) THEN
        ALTER TABLE `biz_order_item`
            ADD CONSTRAINT `chk_biz_order_item_is_deleted`
            CHECK (`is_deleted` IN (0, 1));
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_order'
          AND INDEX_NAME = 'idx_member_id'
    ) THEN
        ALTER TABLE `biz_order` DROP INDEX `idx_member_id`;
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_order'
          AND INDEX_NAME = 'idx_status'
    ) THEN
        ALTER TABLE `biz_order` DROP INDEX `idx_status`;
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_order'
          AND INDEX_NAME = 'idx_verify_code'
    ) THEN
        ALTER TABLE `biz_order` DROP INDEX `idx_verify_code`;
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_order_item'
          AND INDEX_NAME = 'idx_order_id'
    ) THEN
        ALTER TABLE `biz_order_item` DROP INDEX `idx_order_id`;
    END IF;
END$$

DELIMITER ;
CALL `migrate_order_hardening`();
DROP PROCEDURE `migrate_order_hardening`;
