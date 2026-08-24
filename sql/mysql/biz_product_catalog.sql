-- 悦己商品目录：疼痛友好筛选
USE youlai_admin;

SET NAMES utf8mb4;

ALTER TABLE `product`
  ADD COLUMN `pain_friendly` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否疼痛友好(0-否 1-是)' AFTER `tags`;
