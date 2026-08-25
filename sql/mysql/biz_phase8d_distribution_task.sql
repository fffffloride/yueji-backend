-- 悦己阶段8D：分销任务管理
USE youlai_admin;

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `distribution_task` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `name` varchar(100) NOT NULL COMMENT '任务名称',
    `description` text NULL COMMENT '任务描述和要求',
    `metric_type` varchar(24) NOT NULL COMMENT 'SALES_AMOUNT/ORDER_COUNT',
    `target_value` int NOT NULL COMMENT '目标值(分或订单数)',
    `start_time` datetime NOT NULL,
    `end_time` datetime NOT NULL,
    `assignment_scope` varchar(16) NOT NULL COMMENT 'ALL/LEVEL/AGENT',
    `target_level_id` bigint NULL,
    `target_agent_ids` json NULL COMMENT '指定代理ID数组',
    `status` tinyint NOT NULL DEFAULT 0 COMMENT '0-草稿 1-已发布 2-已取消',
    `published_time` datetime NULL,
    `cancelled_time` datetime NULL,
    `create_by` bigint NULL, `create_time` datetime NULL,
    `update_by` bigint NULL, `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    INDEX `idx_distribution_task_status_time` (`status`,`start_time`,`end_time`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='分销销售任务';

CREATE TABLE IF NOT EXISTS `distribution_task_assignee` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `task_id` bigint NOT NULL,
    `agent_id` bigint NOT NULL,
    `create_by` bigint NULL, `create_time` datetime NULL,
    `update_by` bigint NULL, `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `uk_distribution_task_assignee` (`task_id`,`agent_id`),
    INDEX `idx_distribution_task_assignee_agent` (`agent_id`,`task_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='分销任务代理名单';
