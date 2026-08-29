-- cart 关系、值域与查询索引加固（既有数据库一次性执行）
-- 依赖：biz_p0.sql 已执行。
-- 新建数据库已由 biz_p0.sql 包含相同最终结构，无需重复执行本文件。

USE youlai_admin;
SET NAMES utf8mb4;

DROP PROCEDURE IF EXISTS `migrate_cart_hardening`;
DELIMITER $$

CREATE PROCEDURE `migrate_cart_hardening`()
BEGIN
    IF EXISTS (
        SELECT 1
        FROM `cart`
        WHERE `quantity` IS NULL
           OR `quantity` NOT BETWEEN 1 AND 99
           OR `checked` IS NULL
           OR `checked` NOT IN (0, 1)
           OR `is_deleted` IS NULL
           OR `is_deleted` NOT IN (0, 1)
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'cart 存在非法数量、选中状态或删除标识，请先清理数据';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM `cart` c
        LEFT JOIN `member` m ON m.`id` = c.`member_id`
        WHERE m.`id` IS NULL
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'cart 存在无会员记录，请先修复 member_id';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM `cart` c
        LEFT JOIN `product_sku` s
          ON s.`id` = c.`sku_id`
         AND s.`product_id` = c.`product_id`
        WHERE s.`id` IS NULL
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'cart 存在商品与 SKU 不匹配记录，请先修复 product_id/sku_id';
    END IF;

    ALTER TABLE `cart`
        MODIFY COLUMN `quantity` int NOT NULL DEFAULT 1 COMMENT '数量',
        MODIFY COLUMN `checked` tinyint NOT NULL DEFAULT 1 COMMENT '是否选中(1-选中 0-未选中)',
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

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'cart'
          AND INDEX_NAME = 'idx_cart_member_active_updated'
    ) THEN
        ALTER TABLE `cart`
            ADD INDEX `idx_cart_member_active_updated`
                (`member_id`, `is_deleted`, `update_time` DESC, `id` DESC);
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'cart'
          AND INDEX_NAME = 'idx_member_id'
    ) THEN
        ALTER TABLE `cart` DROP INDEX `idx_member_id`;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'cart'
          AND INDEX_NAME = 'idx_cart_product_sku'
    ) THEN
        ALTER TABLE `cart`
            ADD INDEX `idx_cart_product_sku` (`product_id`, `sku_id`);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'cart'
          AND CONSTRAINT_NAME = 'fk_cart_member'
    ) THEN
        ALTER TABLE `cart`
            ADD CONSTRAINT `fk_cart_member`
            FOREIGN KEY (`member_id`) REFERENCES `member` (`id`)
            ON UPDATE RESTRICT ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'cart'
          AND CONSTRAINT_NAME = 'fk_cart_product_sku'
    ) THEN
        ALTER TABLE `cart`
            ADD CONSTRAINT `fk_cart_product_sku`
            FOREIGN KEY (`product_id`, `sku_id`) REFERENCES `product_sku` (`product_id`, `id`)
            ON UPDATE RESTRICT ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'cart'
          AND CONSTRAINT_NAME = 'chk_cart_quantity'
    ) THEN
        ALTER TABLE `cart`
            ADD CONSTRAINT `chk_cart_quantity` CHECK (`quantity` BETWEEN 1 AND 99);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'cart'
          AND CONSTRAINT_NAME = 'chk_cart_checked'
    ) THEN
        ALTER TABLE `cart`
            ADD CONSTRAINT `chk_cart_checked` CHECK (`checked` IN (0, 1));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'cart'
          AND CONSTRAINT_NAME = 'chk_cart_is_deleted'
    ) THEN
        ALTER TABLE `cart`
            ADD CONSTRAINT `chk_cart_is_deleted` CHECK (`is_deleted` IN (0, 1));
    END IF;
END$$

DELIMITER ;
CALL `migrate_cart_hardening`();
DROP PROCEDURE `migrate_cart_hardening`;
