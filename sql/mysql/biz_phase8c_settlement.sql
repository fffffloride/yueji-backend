-- 悦己阶段8C：分销结算与提现
USE youlai_admin;

SET NAMES utf8mb4;

ALTER TABLE `distribution_commission`
  CHANGE COLUMN `available_time` `pending_settlement_time` datetime NULL COMMENT '进入待结算时间',
  ADD COLUMN `settlement_id` bigint NULL COMMENT '结算单ID' AFTER `pending_settlement_time`,
  ADD COLUMN `settled_time` datetime NULL COMMENT '结算时间' AFTER `settlement_id`,
  ADD INDEX `idx_distribution_commission_settlement` (`settlement_id`),
  ADD INDEX `idx_distribution_commission_pending_time` (`status`, `pending_settlement_time`);

ALTER TABLE `distribution_commission`
  MODIFY COLUMN `status` tinyint NOT NULL DEFAULT 0 COMMENT '0-待核销 1-待结算 2-已冲销 3-已结算';

CREATE TABLE IF NOT EXISTS `distribution_settlement_config` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `cycle_type` varchar(16) NOT NULL COMMENT '结算周期',
    `settlement_day` tinyint NOT NULL COMMENT '结算星期或日期',
    `withdrawal_mode` varchar(16) NOT NULL COMMENT '提现模式',
    `single_limit_amount` int NOT NULL COMMENT '单笔提现上限(分)',
    `create_by` bigint NULL, `create_time` datetime NULL,
    `update_by` bigint NULL, `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='分销结算配置';

CREATE TABLE IF NOT EXISTS `distribution_settlement` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `settlement_no` varchar(32) NOT NULL,
    `agent_id` bigint NOT NULL,
    `profit_point` varchar(32) NOT NULL,
    `period_start` datetime NOT NULL,
    `period_end` datetime NOT NULL,
    `commission_count` int NOT NULL,
    `amount` int NOT NULL COMMENT '结算金额(分)',
    `settled_time` datetime NOT NULL,
    `create_by` bigint NULL, `create_time` datetime NULL,
    `update_by` bigint NULL, `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `uk_distribution_settlement_no` (`settlement_no`),
    UNIQUE INDEX `uk_distribution_settlement_agent_period` (`agent_id`,`profit_point`,`period_start`,`period_end`),
    INDEX `idx_distribution_settlement_time` (`settled_time`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='分销结算单';

CREATE TABLE IF NOT EXISTS `distribution_withdrawal` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `withdrawal_no` varchar(32) NOT NULL,
    `agent_id` bigint NOT NULL,
    `member_id` bigint NOT NULL,
    `source_mode` varchar(16) NOT NULL,
    `amount` int NOT NULL COMMENT '提现金额(分)',
    `openid_snapshot` varchar(64) NOT NULL,
    `status` tinyint NOT NULL DEFAULT 0 COMMENT '0-待审核 1-待打款 2-已驳回 3-已打款',
    `review_by` bigint NULL, `review_time` datetime NULL, `review_reason` varchar(255) NULL,
    `transfer_no` varchar(64) NULL, `paid_by` bigint NULL, `paid_time` datetime NULL,
    `paid_remark` varchar(255) NULL, `auto_period_end` datetime NULL,
    `create_by` bigint NULL, `create_time` datetime NULL,
    `update_by` bigint NULL, `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `uk_distribution_withdrawal_no` (`withdrawal_no`),
    UNIQUE INDEX `uk_distribution_withdrawal_auto_period` (`agent_id`,`source_mode`,`auto_period_end`),
    INDEX `idx_distribution_withdrawal_agent_status` (`agent_id`,`status`),
    INDEX `idx_distribution_withdrawal_status_time` (`status`,`create_time`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='分销提现单';

INSERT INTO `distribution_settlement_config`
  (`id`,`cycle_type`,`settlement_day`,`withdrawal_mode`,`single_limit_amount`,`create_time`,`update_time`,`is_deleted`)
SELECT 1,'MONTH',1,'APPLY',1000000,NOW(),NOW(),0
WHERE NOT EXISTS (SELECT 1 FROM `distribution_settlement_config` WHERE `is_deleted`=0);
