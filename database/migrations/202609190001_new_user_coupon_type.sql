SET NAMES utf8mb4;

ALTER TABLE `coupon`
  DROP CHECK `chk_coupon_type`,
  DROP CHECK `chk_coupon_exchange`;

ALTER TABLE `coupon`
  MODIFY COLUMN `type` varchar(24) NOT NULL COMMENT 'FULL_REDUCTION/DISCOUNT/EXCHANGE/NEW_USER',
  ADD CONSTRAINT `chk_coupon_type`
    CHECK (`type` IN ('FULL_REDUCTION', 'DISCOUNT', 'EXCHANGE', 'NEW_USER')),
  ADD CONSTRAINT `chk_coupon_exchange`
    CHECK (
      (`type` IN ('FULL_REDUCTION', 'NEW_USER') AND `discount_amount` > 0 AND `exchange_sku_id` IS NULL) OR
      (`type` = 'DISCOUNT' AND `discount_rate` < 10000 AND `exchange_sku_id` IS NULL) OR
      (`type` = 'EXCHANGE' AND `scope_type` = 'PRODUCT' AND `exchange_sku_id` IS NOT NULL)
    );
