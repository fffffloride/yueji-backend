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
    PRIMARY KEY (`id`),
    INDEX `idx_member_level_threshold` (`threshold_amount`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='会员等级';

INSERT INTO `member_level`
    (`name`, `threshold_amount`, `discount_rate`, `status`, `sort`, `create_time`, `update_time`, `is_deleted`)
VALUES ('普通会员', 0, 10000, 1, 1, now(), now(), 0);

ALTER TABLE `member`
    ADD COLUMN `total_spent` int NOT NULL DEFAULT 0 COMMENT '累计完成订单实付(分)' AFTER `level_id`;

UPDATE `member` m
LEFT JOIN (
    SELECT `member_id`, COALESCE(SUM(`pay_amount`), 0) AS `total_spent`
    FROM `biz_order`
    WHERE `status` = 3 AND `is_deleted` = 0
    GROUP BY `member_id`
) o ON o.`member_id` = m.`id`
SET m.`total_spent` = COALESCE(o.`total_spent`, 0),
    m.`level_id` = COALESCE(m.`level_id`, (SELECT MIN(`id`) FROM `member_level` WHERE `threshold_amount` = 0));

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
    INDEX `idx_points_order` (`order_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='会员积分流水';

INSERT INTO `member_points_log`
    (`member_id`, `change_points`, `balance_after`, `biz_type`, `biz_id`, `remark`, `create_time`, `update_time`, `is_deleted`)
SELECT `id`, `points`, `points`, 'INIT', 'phase5', '阶段5上线初始余额', now(), now(), 0
FROM `member` WHERE `points` <> 0 AND `is_deleted` = 0;

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
    INDEX `idx_coupon_status_time` (`status`, `claim_start`, `claim_end`)
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
    PRIMARY KEY (`id`),
    UNIQUE INDEX `uk_coupon_scope` (`coupon_id`, `target_type`, `target_id`)
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
    INDEX `idx_member_coupon_template` (`coupon_id`),
    INDEX `idx_member_coupon_order` (`order_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='会员优惠券';

ALTER TABLE `biz_order`
    ADD COLUMN `member_level_id` bigint NULL COMMENT '下单会员等级' AFTER `discount_amount`,
    ADD COLUMN `member_discount` int NOT NULL DEFAULT 0 COMMENT '会员优惠(分)' AFTER `member_level_id`,
    ADD COLUMN `member_coupon_id` bigint NULL COMMENT '会员券ID' AFTER `member_discount`,
    ADD COLUMN `coupon_amount` int NOT NULL DEFAULT 0 COMMENT '优惠券抵扣(分)' AFTER `member_coupon_id`,
    ADD COLUMN `points_used` int NOT NULL DEFAULT 0 COMMENT '使用积分' AFTER `coupon_amount`,
    ADD COLUMN `points_deduct` int NOT NULL DEFAULT 0 COMMENT '积分抵扣(分)' AFTER `points_used`,
    ADD INDEX `idx_order_member_coupon` (`member_coupon_id`);

INSERT INTO `sys_config`
    (`config_name`, `config_key`, `config_value`, `remark`, `create_time`, `update_time`, `is_deleted`)
SELECT '营销积分规则', 'marketing.points.rule',
       '{"earnPerYuan":1,"redeemPointsPerYuan":100,"maxDeductRate":5000}',
       '每元赠送、每元抵扣积分、最高抵扣万分比', now(), now(), 0
WHERE NOT EXISTS (
    SELECT 1 FROM `sys_config` WHERE `config_key` = 'marketing.points.rule' AND `is_deleted` = 0
);
