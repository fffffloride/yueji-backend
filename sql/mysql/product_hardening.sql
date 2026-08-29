-- product 关系完整性加固（既有数据库一次性执行）
-- 依赖：biz_p0.sql 已执行。
-- 新建数据库已由 biz_p0.sql 包含相同最终结构，无需重复执行本文件。

USE youlai_admin;
SET NAMES utf8mb4;

DROP PROCEDURE IF EXISTS `migrate_product_hardening`;
DELIMITER $$

CREATE PROCEDURE `migrate_product_hardening`()
BEGIN
    IF EXISTS (
        SELECT 1
        FROM `product` p
        LEFT JOIN `product_category` c ON c.`id` = p.`category_id`
        WHERE c.`id` IS NULL
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'product 存在无分类记录，请先修复 category_id';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM `product_sku` s
        LEFT JOIN `product` p ON p.`id` = s.`product_id`
        WHERE p.`id` IS NULL
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'product_sku 存在无商品记录，请先修复 product_id';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND CONSTRAINT_NAME = 'fk_product_category'
    ) THEN
        ALTER TABLE `product`
            ADD CONSTRAINT `fk_product_category`
            FOREIGN KEY (`category_id`) REFERENCES `product_category` (`id`)
            ON UPDATE RESTRICT ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND CONSTRAINT_NAME = 'fk_product_sku_product'
    ) THEN
        ALTER TABLE `product_sku`
            ADD CONSTRAINT `fk_product_sku_product`
            FOREIGN KEY (`product_id`) REFERENCES `product` (`id`)
            ON UPDATE RESTRICT ON DELETE RESTRICT;
    END IF;
END$$

DELIMITER ;
CALL `migrate_product_hardening`();
DROP PROCEDURE `migrate_product_hardening`;
