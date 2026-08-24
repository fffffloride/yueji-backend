-- 悦己阶段8A+8B：分销身份与佣金账本
USE youlai_admin;

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `distribution_agent_type` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `name` varchar(64) NOT NULL,
    `status` tinyint NOT NULL DEFAULT 1 COMMENT '0-停用 1-启用',
    `sort` smallint NOT NULL DEFAULT 0,
    `create_by` bigint NULL, `create_time` datetime NULL,
    `update_by` bigint NULL, `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`), INDEX `idx_distribution_type_status_sort` (`status`, `sort`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='代理类型';

CREATE TABLE IF NOT EXISTS `distribution_level` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `name` varchar(64) NOT NULL,
    `rank` smallint NOT NULL,
    `upgrade_sales_amount` int NOT NULL DEFAULT 0 COMMENT '直属业绩升级门槛(分)',
    `distribution_depth` tinyint NOT NULL DEFAULT 1 COMMENT '分销深度(1/2)',
    `level1_rate_bps` int NOT NULL DEFAULT 0 COMMENT '一级佣金万分比',
    `level2_rate_bps` int NOT NULL DEFAULT 0 COMMENT '二级佣金万分比',
    `status` tinyint NOT NULL DEFAULT 1 COMMENT '0-停用 1-启用',
    `sort` smallint NOT NULL DEFAULT 0,
    `create_by` bigint NULL, `create_time` datetime NULL,
    `update_by` bigint NULL, `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `uk_distribution_level_rank` (`rank`),
    INDEX `idx_distribution_level_status_sort` (`status`, `sort`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='分销等级';

CREATE TABLE IF NOT EXISTS `distribution_agent` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `member_id` bigint NOT NULL,
    `real_name` varchar(64) NOT NULL,
    `mobile` varchar(20) NULL,
    `wechat` varchar(64) NULL,
    `contact_remark` varchar(255) NULL,
    `type_id` bigint NULL,
    `level_id` bigint NULL,
    `parent_agent_id` bigint NULL,
    `invite_code` varchar(16) NOT NULL,
    `custom_level1_rate_bps` int NULL,
    `custom_level2_rate_bps` int NULL,
    `direct_verified_sales` int NOT NULL DEFAULT 0 COMMENT '直属有效销售额(分)',
    `status` tinyint NOT NULL DEFAULT 0 COMMENT '0-待审核 1-已通过 2-已驳回 3-已禁用',
    `apply_time` datetime NULL,
    `audit_time` datetime NULL,
    `audit_by` bigint NULL,
    `audit_remark` varchar(255) NULL,
    `create_by` bigint NULL, `create_time` datetime NULL,
    `update_by` bigint NULL, `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `uk_distribution_agent_member` (`member_id`),
    UNIQUE INDEX `uk_distribution_agent_invite` (`invite_code`),
    INDEX `idx_distribution_agent_parent` (`parent_agent_id`),
    INDEX `idx_distribution_agent_type_level_status` (`type_id`, `level_id`, `status`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='分销代理商';

CREATE TABLE IF NOT EXISTS `distribution_referral` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `member_id` bigint NOT NULL,
    `referrer_agent_id` bigint NOT NULL,
    `bound_time` datetime NOT NULL,
    `frozen_time` datetime NULL,
    `create_by` bigint NULL, `create_time` datetime NULL,
    `update_by` bigint NULL, `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `uk_distribution_referral_member` (`member_id`),
    INDEX `idx_distribution_referral_agent` (`referrer_agent_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='会员推荐关系';

CREATE TABLE IF NOT EXISTS `distribution_commission` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `order_id` bigint NOT NULL,
    `order_no` varchar(32) NOT NULL,
    `buyer_member_id` bigint NOT NULL,
    `beneficiary_agent_id` bigint NOT NULL,
    `source_agent_id` bigint NOT NULL,
    `depth` tinyint NOT NULL COMMENT '佣金层级(1/2)',
    `base_amount` int NOT NULL,
    `rate_bps` int NOT NULL,
    `commission_amount` int NOT NULL,
    `agent_level_id` bigint NULL,
    `agent_level_name` varchar(64) NULL,
    `status` tinyint NOT NULL DEFAULT 0 COMMENT '0-待结算 1-可提现 2-已冲销',
    `paid_time` datetime NOT NULL,
    `available_time` datetime NULL,
    `reversed_time` datetime NULL,
    `create_by` bigint NULL, `create_time` datetime NULL,
    `update_by` bigint NULL, `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `uk_distribution_commission_order_agent_depth` (`order_id`, `beneficiary_agent_id`, `depth`),
    INDEX `idx_distribution_commission_agent_status` (`beneficiary_agent_id`, `status`),
    INDEX `idx_distribution_commission_order` (`order_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='分销佣金账本';

CREATE TABLE IF NOT EXISTS `distribution_direct_sales` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `order_id` bigint NOT NULL,
    `buyer_member_id` bigint NOT NULL,
    `agent_id` bigint NOT NULL,
    `referral_id` bigint NOT NULL,
    `amount` int NOT NULL,
    `status` tinyint NOT NULL DEFAULT 0 COMMENT '0-待核销 1-已计入 2-已冲销',
    `paid_time` datetime NOT NULL,
    `applied_time` datetime NULL,
    `reversed_time` datetime NULL,
    `create_by` bigint NULL, `create_time` datetime NULL,
    `update_by` bigint NULL, `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `uk_distribution_direct_sales_order` (`order_id`),
    INDEX `idx_distribution_direct_sales_agent_status` (`agent_id`, `status`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='代理直属业绩账本';

CREATE TABLE IF NOT EXISTS `distribution_agent_log` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `agent_id` bigint NOT NULL,
    `action` varchar(32) NOT NULL,
    `before_value` json NULL,
    `after_value` json NULL,
    `reason` varchar(255) NOT NULL,
    `operator_id` bigint NULL,
    `create_by` bigint NULL, `create_time` datetime NULL,
    `update_by` bigint NULL, `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`), INDEX `idx_distribution_agent_log_agent_time` (`agent_id`, `create_time`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='代理操作日志';
