-- 悦己商品目录：疼痛友好筛选
USE youlai_admin;

SET NAMES utf8mb4;

SET @pain_friendly_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'product'
    AND COLUMN_NAME = 'pain_friendly'
);

SET @pain_friendly_ddl := IF(
  @pain_friendly_exists = 0,
  'ALTER TABLE `product` ADD COLUMN `pain_friendly` tinyint(1) NOT NULL DEFAULT 0 COMMENT ''是否疼痛友好(0-否 1-是)'' AFTER `tags`',
  'SELECT 1'
);

PREPARE pain_friendly_stmt FROM @pain_friendly_ddl;
EXECUTE pain_friendly_stmt;
DEALLOCATE PREPARE pain_friendly_stmt;
