# 悦己DLumière P0 业务核心表（阶段1）
# 依赖：先执行 youlai_admin.sql 完成系统表初始化
# 约定：金额字段统一使用「分」整数存储；审计字段与系统表保持一致

USE youlai_admin;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- 会员表（C端用户，独立于 sys_user）
-- ----------------------------
DROP TABLE IF EXISTS `member`;
CREATE TABLE `member` (
    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
    `openid` varchar(64) NOT NULL COMMENT '微信小程序openid',
    `unionid` varchar(64) NULL COMMENT '微信unionid',
    `mobile` varchar(20) NULL COMMENT '手机号',
    `nickname` varchar(64) DEFAULT '微信用户' COMMENT '昵称',
    `avatar` varchar(255) NULL COMMENT '头像',
    `gender` tinyint DEFAULT 0 COMMENT '性别(1-男 2-女 0-保密)',
    `status` tinyint DEFAULT 1 COMMENT '状态(1-正常 0-禁用)',
    `points` int DEFAULT 0 COMMENT '积分余额',
    `level_id` bigint NULL COMMENT '会员等级ID(阶段5启用)',
    `last_login_time` datetime NULL COMMENT '最后登录时间',
    `create_by` bigint NULL COMMENT '创建人ID',
    `create_time` datetime NULL COMMENT '创建时间',
    `update_by` bigint NULL COMMENT '修改人ID',
    `update_time` datetime NULL COMMENT '更新时间',
    `is_deleted` tinyint DEFAULT 0 COMMENT '逻辑删除标识(1-已删除 0-未删除)',
    PRIMARY KEY (`id`) USING BTREE,
    UNIQUE INDEX `uk_openid`(`openid` ASC) USING BTREE COMMENT 'openid唯一索引',
    INDEX `idx_mobile`(`mobile` ASC) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COMMENT = '会员表';

-- ----------------------------
-- 商品分类表（支持三级分类）
-- ----------------------------
DROP TABLE IF EXISTS `product_category`;
CREATE TABLE `product_category` (
    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
    `name` varchar(64) NOT NULL COMMENT '分类名称',
    `parent_id` bigint DEFAULT 0 COMMENT '父分类ID(0为顶级)',
    `tree_path` varchar(255) NOT NULL DEFAULT '0' COMMENT '父节点ID路径',
    `level` tinyint DEFAULT 1 COMMENT '层级(1/2/3)',
    `icon` varchar(255) NULL COMMENT '分类图标',
    `sort` smallint DEFAULT 0 COMMENT '显示顺序',
    `status` tinyint DEFAULT 1 COMMENT '状态(1-启用 0-禁用)',
    `create_by` bigint NULL COMMENT '创建人ID',
    `create_time` datetime NULL COMMENT '创建时间',
    `update_by` bigint NULL COMMENT '修改人ID',
    `update_time` datetime NULL COMMENT '更新时间',
    `is_deleted` tinyint DEFAULT 0 COMMENT '逻辑删除标识(1-已删除 0-未删除)',
    PRIMARY KEY (`id`) USING BTREE,
    INDEX `idx_parent_id`(`parent_id` ASC) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COMMENT = '商品分类表';

-- ----------------------------
-- 商品表（SPU）
-- ----------------------------
DROP TABLE IF EXISTS `product`;
CREATE TABLE `product` (
    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
    `name` varchar(100) NOT NULL COMMENT '商品名称',
    `category_id` bigint NOT NULL COMMENT '分类ID',
    `sub_title` varchar(255) NULL COMMENT '副标题',
    `main_image` varchar(255) NULL COMMENT '主图URL',
    `album` text NULL COMMENT '轮播图URL列表(JSON数组)',
    `video_url` varchar(255) NULL COMMENT '短视频URL',
    `tags` varchar(255) NULL COMMENT '标签(逗号分隔：推荐,新品,热卖)',
    `original_price` int NULL COMMENT '原价(分)',
    `price` int NOT NULL DEFAULT 0 COMMENT '现售价(分)',
    `sales` int DEFAULT 0 COMMENT '销量',
    `stock` int DEFAULT 0 COMMENT '总库存(SKU库存之和)',
    `detail` mediumtext NULL COMMENT '商品详情(富文本)',
    `usage_note` text NULL COMMENT '产品说明(适用人群/注意事项/术后护理)',
    `status` tinyint DEFAULT 0 COMMENT '状态(1-上架 0-下架)',
    `sort` smallint DEFAULT 0 COMMENT '显示顺序',
    `create_by` bigint NULL COMMENT '创建人ID',
    `create_time` datetime NULL COMMENT '创建时间',
    `update_by` bigint NULL COMMENT '修改人ID',
    `update_time` datetime NULL COMMENT '更新时间',
    `is_deleted` tinyint DEFAULT 0 COMMENT '逻辑删除标识(1-已删除 0-未删除)',
    PRIMARY KEY (`id`) USING BTREE,
    INDEX `idx_category_id`(`category_id` ASC) USING BTREE,
    INDEX `idx_status`(`status` ASC) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COMMENT = '商品表(SPU)';

-- ----------------------------
-- 商品SKU表
-- ----------------------------
DROP TABLE IF EXISTS `product_sku`;
CREATE TABLE `product_sku` (
    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
    `product_id` bigint NOT NULL COMMENT '商品ID',
    `name` varchar(100) NOT NULL COMMENT '规格名称(如：面部/2ml)',
    `specs` varchar(255) NULL COMMENT '规格属性(JSON：{"部位":"面部","剂量":"2ml"})',
    `sku_code` varchar(64) NULL COMMENT 'SKU编码',
    `price` int NOT NULL DEFAULT 0 COMMENT '售价(分)',
    `original_price` int NULL COMMENT '原价(分)',
    `stock` int DEFAULT 0 COMMENT '库存',
    `status` tinyint DEFAULT 1 COMMENT '状态(1-启用 0-禁用)',
    `create_by` bigint NULL COMMENT '创建人ID',
    `create_time` datetime NULL COMMENT '创建时间',
    `update_by` bigint NULL COMMENT '修改人ID',
    `update_time` datetime NULL COMMENT '更新时间',
    `is_deleted` tinyint DEFAULT 0 COMMENT '逻辑删除标识(1-已删除 0-未删除)',
    PRIMARY KEY (`id`) USING BTREE,
    INDEX `idx_product_id`(`product_id` ASC) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COMMENT = '商品SKU表';

-- ----------------------------
-- 购物车表
-- ----------------------------
DROP TABLE IF EXISTS `cart`;
CREATE TABLE `cart` (
    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
    `member_id` bigint NOT NULL COMMENT '会员ID',
    `product_id` bigint NOT NULL COMMENT '商品ID',
    `sku_id` bigint NOT NULL COMMENT 'SKU ID',
    `quantity` int NOT NULL DEFAULT 1 COMMENT '数量',
    `checked` tinyint DEFAULT 1 COMMENT '是否选中(1-选中 0-未选中)',
    `create_by` bigint NULL COMMENT '创建人ID',
    `create_time` datetime NULL COMMENT '创建时间',
    `update_by` bigint NULL COMMENT '修改人ID',
    `update_time` datetime NULL COMMENT '更新时间',
    `is_deleted` tinyint DEFAULT 0 COMMENT '逻辑删除标识(1-已删除 0-未删除)',
    PRIMARY KEY (`id`) USING BTREE,
    UNIQUE INDEX `uk_member_sku`(`member_id` ASC, `sku_id` ASC) USING BTREE COMMENT '会员+SKU唯一',
    INDEX `idx_member_id`(`member_id` ASC) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COMMENT = '购物车表';

-- ----------------------------
-- 订单表（表名加 biz_ 前缀避开 MySQL 保留字 ORDER）
-- ----------------------------
DROP TABLE IF EXISTS `biz_order`;
CREATE TABLE `biz_order` (
    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
    `order_no` varchar(32) NOT NULL COMMENT '订单号',
    `member_id` bigint NOT NULL COMMENT '会员ID',
    `status` tinyint NOT NULL DEFAULT 0 COMMENT '订单状态(0-待付款 1-已付款/待核销 2-已核销 3-已完成 4-已取消)',
    `total_amount` int NOT NULL DEFAULT 0 COMMENT '商品总额(分)',
    `discount_amount` int NOT NULL DEFAULT 0 COMMENT '优惠金额(分)',
    `pay_amount` int NOT NULL DEFAULT 0 COMMENT '实付金额(分)',
    `pay_type` tinyint NULL COMMENT '支付方式(1-微信支付)',
    `pay_time` datetime NULL COMMENT '支付时间',
    `contact_name` varchar(32) NULL COMMENT '联系人姓名',
    `contact_mobile` varchar(20) NULL COMMENT '联系人手机号',
    `remark` varchar(255) NULL COMMENT '订单备注',
    `verify_code` varchar(32) NULL COMMENT '核销码',
    `verify_time` datetime NULL COMMENT '核销时间',
    `verify_by` bigint NULL COMMENT '核销人ID(sys_user)',
    `cancel_time` datetime NULL COMMENT '取消时间',
    `cancel_reason` varchar(255) NULL COMMENT '取消原因',
    `create_by` bigint NULL COMMENT '创建人ID',
    `create_time` datetime NULL COMMENT '创建时间',
    `update_by` bigint NULL COMMENT '修改人ID',
    `update_time` datetime NULL COMMENT '更新时间',
    `is_deleted` tinyint DEFAULT 0 COMMENT '逻辑删除标识(1-已删除 0-未删除)',
    PRIMARY KEY (`id`) USING BTREE,
    UNIQUE INDEX `uk_order_no`(`order_no` ASC) USING BTREE,
    INDEX `idx_member_id`(`member_id` ASC) USING BTREE,
    INDEX `idx_status`(`status` ASC) USING BTREE,
    INDEX `idx_verify_code`(`verify_code` ASC) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COMMENT = '订单表';

-- ----------------------------
-- 订单明细表
-- ----------------------------
DROP TABLE IF EXISTS `biz_order_item`;
CREATE TABLE `biz_order_item` (
    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
    `order_id` bigint NOT NULL COMMENT '订单ID',
    `product_id` bigint NOT NULL COMMENT '商品ID',
    `sku_id` bigint NOT NULL COMMENT 'SKU ID',
    `product_name` varchar(100) NOT NULL COMMENT '商品名称(下单快照)',
    `product_image` varchar(255) NULL COMMENT '商品图片(下单快照)',
    `sku_name` varchar(100) NULL COMMENT '规格名称(下单快照)',
    `price` int NOT NULL DEFAULT 0 COMMENT '单价(分,下单快照)',
    `quantity` int NOT NULL DEFAULT 1 COMMENT '数量',
    `subtotal` int NOT NULL DEFAULT 0 COMMENT '小计(分)',
    `create_by` bigint NULL COMMENT '创建人ID',
    `create_time` datetime NULL COMMENT '创建时间',
    `update_by` bigint NULL COMMENT '修改人ID',
    `update_time` datetime NULL COMMENT '更新时间',
    `is_deleted` tinyint DEFAULT 0 COMMENT '逻辑删除标识(1-已删除 0-未删除)',
    PRIMARY KEY (`id`) USING BTREE,
    INDEX `idx_order_id`(`order_id` ASC) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COMMENT = '订单明细表';

SET FOREIGN_KEY_CHECKS = 1;
