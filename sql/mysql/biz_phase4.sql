-- 悦己阶段4：支付、退款、会员360增量结构
USE youlai_admin;

SET NAMES utf8mb4;

ALTER TABLE `member`
    ADD COLUMN `tags` varchar(255) NULL COMMENT '会员标签(逗号分隔)' AFTER `last_login_time`,
    ADD COLUMN `remark` varchar(255) NULL COMMENT '管理员备注' AFTER `tags`;

ALTER TABLE `biz_order`
    MODIFY COLUMN `status` tinyint NOT NULL DEFAULT 0
    COMMENT '订单状态(0-待付款 1-已付款/待核销 2-已核销 3-已完成 4-已取消 5-已退款)',
    MODIFY COLUMN `pay_type` tinyint NULL COMMENT '支付方式(1-微信支付 2-Mock支付)';

CREATE TABLE `biz_payment` (
    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
    `payment_no` varchar(32) NOT NULL COMMENT '支付流水号',
    `order_id` bigint NOT NULL COMMENT '订单ID',
    `member_id` bigint NOT NULL COMMENT '会员ID',
    `amount` int NOT NULL COMMENT '支付金额(分)',
    `channel` varchar(16) NOT NULL COMMENT '支付渠道(mock/wechat)',
    `status` tinyint NOT NULL DEFAULT 0 COMMENT '支付状态(0-待支付 1-成功 2-失败 3-已退款)',
    `third_party_no` varchar(64) NULL COMMENT '三方支付单号',
    `paid_time` datetime NULL COMMENT '支付成功时间',
    `create_by` bigint NULL COMMENT '创建人ID',
    `create_time` datetime NULL COMMENT '创建时间',
    `update_by` bigint NULL COMMENT '修改人ID',
    `update_time` datetime NULL COMMENT '更新时间',
    `is_deleted` tinyint DEFAULT 0 COMMENT '逻辑删除标识(1-已删除 0-未删除)',
    PRIMARY KEY (`id`) USING BTREE,
    UNIQUE INDEX `uk_payment_no` (`payment_no`) USING BTREE,
    UNIQUE INDEX `uk_payment_order_id` (`order_id`) USING BTREE,
    INDEX `idx_payment_member_id` (`member_id`) USING BTREE,
    INDEX `idx_payment_status` (`status`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COMMENT = '支付流水表';

CREATE TABLE `biz_refund` (
    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
    `refund_no` varchar(32) NOT NULL COMMENT '退款流水号',
    `payment_id` bigint NOT NULL COMMENT '支付流水ID',
    `order_id` bigint NOT NULL COMMENT '订单ID',
    `member_id` bigint NOT NULL COMMENT '会员ID',
    `amount` int NOT NULL COMMENT '退款金额(分)',
    `reason` varchar(255) NOT NULL COMMENT '退款原因',
    `status` tinyint NOT NULL DEFAULT 0 COMMENT '退款状态(0-处理中 1-成功 2-失败)',
    `third_party_no` varchar(64) NULL COMMENT '三方退款单号',
    `refund_time` datetime NULL COMMENT '退款成功时间',
    `create_by` bigint NULL COMMENT '创建人ID',
    `create_time` datetime NULL COMMENT '创建时间',
    `update_by` bigint NULL COMMENT '修改人ID',
    `update_time` datetime NULL COMMENT '更新时间',
    `is_deleted` tinyint DEFAULT 0 COMMENT '逻辑删除标识(1-已删除 0-未删除)',
    PRIMARY KEY (`id`) USING BTREE,
    UNIQUE INDEX `uk_refund_no` (`refund_no`) USING BTREE,
    UNIQUE INDEX `uk_refund_order_id` (`order_id`) USING BTREE,
    INDEX `idx_refund_payment_id` (`payment_id`) USING BTREE,
    INDEX `idx_refund_member_id` (`member_id`) USING BTREE,
    INDEX `idx_refund_status` (`status`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COMMENT = '退款流水表';

-- 订单管理下新增退款按钮，并授权 ROOT / ADMIN。
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`)
VALUES (3105, 3101, '0,3100,3101', '订单退款', 'B', NULL, '', NULL, 'biz:payment:refund', NULL, NULL, 1, 4, '', NULL, now(), now(), NULL);

INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (1, 3105), (2, 3105);
