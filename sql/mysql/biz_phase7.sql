-- 悦己阶段7：首页装修与拼团
USE youlai_admin;

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `decoration_banner` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `image_url` varchar(500) NOT NULL COMMENT 'Banner图片',
    `link_url` varchar(500) NULL COMMENT '跳转链接',
    `sort` int NOT NULL DEFAULT 0,
    `status` tinyint NOT NULL DEFAULT 1 COMMENT '0-下线 1-上线',
    `create_by` bigint NULL, `create_time` datetime NULL,
    `update_by` bigint NULL, `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`), INDEX `idx_banner_status_sort` (`status`, `sort`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='首页Banner';

CREATE TABLE IF NOT EXISTS `decoration_notice` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `title` varchar(100) NOT NULL,
    `content` text NOT NULL,
    `sort` int NOT NULL DEFAULT 0,
    `status` tinyint NOT NULL DEFAULT 1 COMMENT '0-下线 1-上线',
    `create_by` bigint NULL, `create_time` datetime NULL,
    `update_by` bigint NULL, `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`), INDEX `idx_decoration_notice_status_sort` (`status`, `sort`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='首页公告';

CREATE TABLE IF NOT EXISTS `decoration_brand` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `content` longtext NOT NULL,
    `create_by` bigint NULL, `create_time` datetime NULL,
    `update_by` bigint NULL, `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='品牌背书';

INSERT INTO `decoration_brand` (`id`, `content`, `create_time`, `update_time`, `is_deleted`)
SELECT 1, '', NOW(), NOW(), 0
WHERE NOT EXISTS (SELECT 1 FROM `decoration_brand` WHERE `id` = 1);

CREATE TABLE IF NOT EXISTS `group_buy_activity` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `sku_id` bigint NOT NULL,
    `name` varchar(100) NOT NULL,
    `group_price` int NOT NULL COMMENT '拼团价(分)',
    `required_people` int NOT NULL COMMENT '成团人数',
    `start_time` datetime NOT NULL,
    `end_time` datetime NOT NULL,
    `group_duration_minutes` int NOT NULL COMMENT '单团有效分钟数',
    `status` tinyint NOT NULL DEFAULT 1 COMMENT '0-下线 1-上线',
    `create_by` bigint NULL, `create_time` datetime NULL,
    `update_by` bigint NULL, `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    INDEX `idx_group_activity_sku` (`sku_id`),
    INDEX `idx_group_activity_status_time` (`status`, `start_time`, `end_time`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='拼团活动';

CREATE TABLE IF NOT EXISTS `group_buy_group` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `activity_id` bigint NOT NULL,
    `leader_member_id` bigint NOT NULL,
    `required_people` int NOT NULL,
    `group_price` int NOT NULL COMMENT '拼团价快照(分)',
    `expire_time` datetime NOT NULL,
    `status` tinyint NOT NULL DEFAULT 0 COMMENT '0-拼团中 1-已成团 2-已失败',
    `success_time` datetime NULL,
    `fail_time` datetime NULL,
    `create_by` bigint NULL, `create_time` datetime NULL,
    `update_by` bigint NULL, `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    INDEX `idx_group_activity` (`activity_id`),
    INDEX `idx_group_status_expire` (`status`, `expire_time`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='拼团实例';

CREATE TABLE IF NOT EXISTS `group_buy_member` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `group_id` bigint NOT NULL,
    `member_id` bigint NOT NULL,
    `order_id` bigint NOT NULL,
    `status` tinyint NOT NULL DEFAULT 0 COMMENT '0-待付款 1-已付款 2-已退款 3-已取消',
    `paid_time` datetime NULL,
    `refund_time` datetime NULL,
    `create_by` bigint NULL, `create_time` datetime NULL,
    `update_by` bigint NULL, `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `uk_group_member` (`group_id`, `member_id`),
    UNIQUE INDEX `uk_group_order` (`order_id`),
    INDEX `idx_group_member_status` (`group_id`, `status`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='拼团成员';

