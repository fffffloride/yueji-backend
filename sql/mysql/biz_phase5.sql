-- 悦己阶段5：会员等级、积分、优惠券
USE youlai_admin;

SET NAMES utf8mb4;

CREATE TABLE `member_level` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `name` varchar(64) NOT NULL COMMENT '等级名称',
    `threshold_amount` int NOT NULL DEFAULT 0 COMMENT '累计实付门槛(分)',
    `discount_rate` int NOT NULL DEFAULT 10000 COMMENT '折扣率(万分比)',
    `status` tinyint NOT NULL DEFAULT 1 COMMENT '状态(1-启用 0-停用)',
    `sort` smallint NOT NULL DEFAULT 0,
    `create_by` bigint NULL,
    `create_time` datetime NULL,
    `update_by` bigint NULL,
    `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    `active_threshold_amount` int GENERATED ALWAYS AS (
        CASE WHEN `is_deleted` = 0 THEN `threshold_amount` ELSE NULL END
    ) STORED,
    PRIMARY KEY (`id`),
    INDEX `idx_member_level_threshold` (`threshold_amount`),
    UNIQUE INDEX `uk_member_level_active_threshold` (`active_threshold_amount`),
    CONSTRAINT `chk_member_level_name` CHECK (CHAR_LENGTH(TRIM(`name`)) > 0),
    CONSTRAINT `chk_member_level_threshold` CHECK (`threshold_amount` >= 0),
    CONSTRAINT `chk_member_level_discount` CHECK (`discount_rate` BETWEEN 1 AND 10000),
    CONSTRAINT `chk_member_level_status` CHECK (`status` IN (0, 1)),
    CONSTRAINT `chk_member_level_is_deleted` CHECK (`is_deleted` IN (0, 1))
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='会员等级';

INSERT INTO `member_level`
    (`name`, `threshold_amount`, `discount_rate`, `status`, `sort`, `create_time`, `update_time`, `is_deleted`)
VALUES
    ('普通会员', 0, 10000, 1, 1, now(), now(), 0),
    ('白银会员', 5000000, 9000, 1, 2, now(), now(), 0),
    ('黄金会员', 10000000, 8000, 1, 3, now(), now(), 0),
    ('白金会员', 20000000, 7000, 1, 4, now(), now(), 0);

ALTER TABLE `member`
    ADD COLUMN `total_spent` int NOT NULL DEFAULT 0 COMMENT '累计完成订单实付(分)' AFTER `level_id`;

ALTER TABLE `member`
    ADD CONSTRAINT `chk_member_total_spent` CHECK (`total_spent` >= 0);

UPDATE `member` m
LEFT JOIN (
    SELECT `member_id`, COALESCE(SUM(`pay_amount`), 0) AS `total_spent`
    FROM `biz_order`
    WHERE `status` = 3 AND `is_deleted` = 0
    GROUP BY `member_id`
) o ON o.`member_id` = m.`id`
SET m.`total_spent` = COALESCE(o.`total_spent`, 0),
    m.`level_id` = COALESCE(m.`level_id`, (SELECT MIN(`id`) FROM `member_level` WHERE `threshold_amount` = 0));

ALTER TABLE `member`
    ADD CONSTRAINT `fk_member_level`
    FOREIGN KEY (`level_id`) REFERENCES `member_level` (`id`)
    ON UPDATE RESTRICT ON DELETE RESTRICT;

CREATE TABLE `member_points_log` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `member_id` bigint NOT NULL,
    `change_points` int NOT NULL,
    `balance_after` int NOT NULL,
    `biz_type` varchar(32) NOT NULL,
    `biz_id` varchar(64) NOT NULL,
    `order_id` bigint NULL,
    `remark` varchar(255) NULL,
    `create_by` bigint NULL,
    `create_time` datetime NULL,
    `update_by` bigint NULL,
    `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `uk_points_biz` (`member_id`, `biz_type`, `biz_id`),
    INDEX `idx_points_member_time` (`member_id`, `create_time`),
    INDEX `idx_points_order` (`order_id`),
    CONSTRAINT `fk_points_member`
        FOREIGN KEY (`member_id`) REFERENCES `member` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_points_order`
        FOREIGN KEY (`order_id`) REFERENCES `biz_order` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `chk_points_balance` CHECK (`balance_after` >= 0),
    CONSTRAINT `chk_points_biz_type` CHECK (`biz_type` IN (
        'INIT', 'ORDER_DEDUCT', 'ORDER_CANCEL_RETURN', 'ORDER_REFUND_RETURN', 'ORDER_EARN'
    )),
    CONSTRAINT `chk_points_is_deleted` CHECK (`is_deleted` IN (0, 1))
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='会员积分流水';

INSERT INTO `member_points_log`
    (`member_id`, `change_points`, `balance_after`, `biz_type`, `biz_id`, `remark`, `create_time`, `update_time`, `is_deleted`)
SELECT `id`, `points`, `points`, 'INIT', 'phase5', '阶段5上线初始余额', now(), now(), 0
FROM `member` WHERE `points` <> 0 AND `is_deleted` = 0;

CREATE TABLE `marketing_points_rule` (
    `id` bigint NOT NULL,
    `earn_per_yuan` int NOT NULL DEFAULT 1 COMMENT '每实付1元赠送积分',
    `redeem_points_per_yuan` int NOT NULL DEFAULT 100 COMMENT '抵扣1元所需积分',
    `max_deduct_rate` int NOT NULL DEFAULT 5000 COMMENT '单笔最高抵扣万分比',
    `create_by` bigint NULL,
    `create_time` datetime NULL,
    `update_by` bigint NULL,
    `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    CONSTRAINT `chk_marketing_points_rule_singleton` CHECK (`id` = 1),
    CONSTRAINT `chk_marketing_points_rule_earn` CHECK (`earn_per_yuan` BETWEEN 0 AND 10000),
    CONSTRAINT `chk_marketing_points_rule_redeem`
        CHECK (`redeem_points_per_yuan` BETWEEN 1 AND 1000000),
    CONSTRAINT `chk_marketing_points_rule_rate` CHECK (`max_deduct_rate` BETWEEN 0 AND 10000),
    CONSTRAINT `chk_marketing_points_rule_is_deleted` CHECK (`is_deleted` = 0)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='营销积分规则';

INSERT INTO `marketing_points_rule`
    (`id`, `earn_per_yuan`, `redeem_points_per_yuan`, `max_deduct_rate`,
     `create_time`, `update_time`, `is_deleted`)
VALUES (1, 1, 100, 5000, now(), now(), 0);

CREATE TABLE `coupon` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `name` varchar(100) NOT NULL,
    `type` varchar(24) NOT NULL COMMENT 'FULL_REDUCTION/DISCOUNT/EXCHANGE',
    `scope_type` varchar(16) NOT NULL DEFAULT 'ALL' COMMENT 'ALL/CATEGORY/PRODUCT',
    `threshold_amount` int NOT NULL DEFAULT 0,
    `discount_amount` int NOT NULL DEFAULT 0,
    `discount_rate` int NOT NULL DEFAULT 10000,
    `max_discount_amount` int NULL,
    `exchange_sku_id` bigint NULL,
    `claim_start` datetime NOT NULL,
    `claim_end` datetime NOT NULL,
    `valid_start` datetime NOT NULL,
    `valid_end` datetime NOT NULL,
    `total_quantity` int NOT NULL,
    `issued_quantity` int NOT NULL DEFAULT 0,
    `per_member_limit` int NOT NULL DEFAULT 1,
    `status` tinyint NOT NULL DEFAULT 0 COMMENT '0-草稿 1-启用 2-停用',
    `create_by` bigint NULL,
    `create_time` datetime NULL,
    `update_by` bigint NULL,
    `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    INDEX `idx_coupon_status_time` (`status`, `claim_start`, `claim_end`),
    CONSTRAINT `fk_coupon_exchange_sku`
        FOREIGN KEY (`exchange_sku_id`) REFERENCES `product_sku` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `chk_coupon_name` CHECK (CHAR_LENGTH(TRIM(`name`)) > 0),
    CONSTRAINT `chk_coupon_type` CHECK (`type` IN ('FULL_REDUCTION', 'DISCOUNT', 'EXCHANGE')),
    CONSTRAINT `chk_coupon_scope_type` CHECK (`scope_type` IN ('ALL', 'CATEGORY', 'PRODUCT')),
    CONSTRAINT `chk_coupon_amounts` CHECK (
        `threshold_amount` >= 0 AND `discount_amount` >= 0 AND
        `discount_rate` BETWEEN 1 AND 10000 AND
        (`max_discount_amount` IS NULL OR `max_discount_amount` >= 1)
    ),
    CONSTRAINT `chk_coupon_times` CHECK (
        `claim_start` <= `claim_end` AND `valid_start` <= `valid_end` AND `claim_end` <= `valid_end`
    ),
    CONSTRAINT `chk_coupon_quantities` CHECK (
        `total_quantity` >= 1 AND `issued_quantity` BETWEEN 0 AND `total_quantity` AND
        `per_member_limit` BETWEEN 1 AND `total_quantity`
    ),
    CONSTRAINT `chk_coupon_exchange` CHECK (
        (`type` = 'FULL_REDUCTION' AND `discount_amount` > 0 AND `exchange_sku_id` IS NULL) OR
        (`type` = 'DISCOUNT' AND `discount_rate` < 10000 AND `exchange_sku_id` IS NULL) OR
        (`type` = 'EXCHANGE' AND `scope_type` = 'PRODUCT' AND `exchange_sku_id` IS NOT NULL)
    ),
    CONSTRAINT `chk_coupon_status` CHECK (`status` IN (0, 1, 2)),
    CONSTRAINT `chk_coupon_is_deleted` CHECK (`is_deleted` IN (0, 1))
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='优惠券模板';

CREATE TABLE `coupon_scope` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `coupon_id` bigint NOT NULL,
    `target_type` varchar(16) NOT NULL,
    `target_id` bigint NOT NULL,
    `create_by` bigint NULL,
    `create_time` datetime NULL,
    `update_by` bigint NULL,
    `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    `active_coupon_id` bigint GENERATED ALWAYS AS (
        CASE WHEN `is_deleted` = 0 THEN `coupon_id` ELSE NULL END
    ) STORED,
    PRIMARY KEY (`id`),
    INDEX `idx_coupon_scope_coupon_active` (`coupon_id`, `is_deleted`),
    UNIQUE INDEX `uk_coupon_scope_active` (`active_coupon_id`, `target_type`, `target_id`),
    CONSTRAINT `fk_coupon_scope_coupon`
        FOREIGN KEY (`coupon_id`) REFERENCES `coupon` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `chk_coupon_scope_target_type` CHECK (`target_type` IN ('CATEGORY', 'PRODUCT')),
    CONSTRAINT `chk_coupon_scope_is_deleted` CHECK (`is_deleted` IN (0, 1))
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='优惠券适用范围';

CREATE TABLE `member_coupon` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `coupon_id` bigint NOT NULL,
    `member_id` bigint NOT NULL,
    `status` tinyint NOT NULL DEFAULT 0 COMMENT '0-未用 1-锁定 2-已用 3-过期',
    `order_id` bigint NULL,
    `claimed_at` datetime NOT NULL,
    `used_at` datetime NULL,
    `create_by` bigint NULL,
    `create_time` datetime NULL,
    `update_by` bigint NULL,
    `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    INDEX `idx_member_coupon_status` (`member_id`, `status`),
    INDEX `idx_member_coupon_member_template` (`member_id`, `coupon_id`, `is_deleted`),
    INDEX `idx_member_coupon_template` (`coupon_id`),
    INDEX `idx_member_coupon_order` (`order_id`),
    CONSTRAINT `fk_member_coupon_coupon`
        FOREIGN KEY (`coupon_id`) REFERENCES `coupon` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_member_coupon_member`
        FOREIGN KEY (`member_id`) REFERENCES `member` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_member_coupon_order`
        FOREIGN KEY (`order_id`) REFERENCES `biz_order` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `chk_member_coupon_status` CHECK (`status` IN (0, 1, 2, 3)),
    CONSTRAINT `chk_member_coupon_state` CHECK (
        (`status` IN (0, 3) AND `order_id` IS NULL AND `used_at` IS NULL) OR
        (`status` = 1 AND `order_id` IS NOT NULL AND `used_at` IS NULL) OR
        (`status` = 2 AND `order_id` IS NOT NULL AND `used_at` IS NOT NULL)
    ),
    CONSTRAINT `chk_member_coupon_is_deleted` CHECK (`is_deleted` IN (0, 1))
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='会员优惠券';

ALTER TABLE `biz_order`
    ADD COLUMN `member_level_id` bigint NULL COMMENT '下单会员等级' AFTER `discount_amount`,
    ADD COLUMN `member_discount` int NOT NULL DEFAULT 0 COMMENT '会员优惠(分)' AFTER `member_level_id`,
    ADD COLUMN `member_coupon_id` bigint NULL COMMENT '会员券ID' AFTER `member_discount`,
    ADD COLUMN `coupon_amount` int NOT NULL DEFAULT 0 COMMENT '优惠券抵扣(分)' AFTER `member_coupon_id`,
    ADD COLUMN `points_used` int NOT NULL DEFAULT 0 COMMENT '使用积分' AFTER `coupon_amount`,
    ADD COLUMN `points_deduct` int NOT NULL DEFAULT 0 COMMENT '积分抵扣(分)' AFTER `points_used`,
    ADD INDEX `idx_order_member_coupon` (`member_coupon_id`),
    ADD CONSTRAINT `fk_order_member_level`
        FOREIGN KEY (`member_level_id`) REFERENCES `member_level` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    ADD CONSTRAINT `chk_biz_order_benefits` CHECK (
        `member_discount` >= 0 AND `coupon_amount` >= 0 AND
        `points_used` >= 0 AND `points_deduct` >= 0 AND
        `discount_amount` = `member_discount` + `coupon_amount` + `points_deduct`
    );
