-- 悦己 DLumière 本地测试环境业务数据
-- 警告：会清空阶段 1–5 的业务表；保留全部 sys_* 系统表。
-- 依赖：MySQL 8，已执行 biz_p0.sql、biz_phase4.sql、biz_phase5.sql。

USE youlai_admin;
SET NAMES utf8mb4;

DROP TEMPORARY TABLE IF EXISTS `_seed_seq`;
CREATE TEMPORARY TABLE `_seed_seq` (`n` int NOT NULL PRIMARY KEY);
INSERT INTO `_seed_seq` (`n`)
SELECT ones.n + tens.n * 10 + hundreds.n * 100 + 1
FROM
  (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
   UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) ones
CROSS JOIN
  (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
   UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) tens
CROSS JOIN
  (SELECT 0 n UNION ALL SELECT 1) hundreds
WHERE ones.n + tens.n * 10 + hundreds.n * 100 < 200;

DROP TEMPORARY TABLE IF EXISTS `_seed_guard`;
CREATE TEMPORARY TABLE `_seed_guard` (
  `failures` int NOT NULL,
  CONSTRAINT `chk_seed_has_no_failure` CHECK (`failures` = 0)
);

START TRANSACTION;

DELETE FROM `member_coupon`;
DELETE FROM `coupon_scope`;
DELETE FROM `coupon`;
DELETE FROM `member_points_log`;
DELETE FROM `biz_refund`;
DELETE FROM `biz_payment`;
DELETE FROM `biz_order_item`;
DELETE FROM `biz_order`;
DELETE FROM `cart`;
DELETE FROM `product_sku`;
DELETE FROM `product`;
DELETE FROM `product_category`;
DELETE FROM `member`;
DELETE FROM `member_level`;

INSERT INTO `member_level`
  (`id`, `name`, `threshold_amount`, `discount_rate`, `status`, `sort`, `create_time`, `update_time`, `is_deleted`)
VALUES
  (1, '普通会员', 0, 10000, 1, 1, NOW(), NOW(), 0),
  (2, '白银会员', 20000, 9800, 1, 2, NOW(), NOW(), 0),
  (3, '黄金会员', 60000, 9500, 1, 3, NOW(), NOW(), 0),
  (4, '黑钻会员', 100000, 9000, 1, 4, NOW(), NOW(), 0);

INSERT INTO `member`
  (`id`, `openid`, `unionid`, `mobile`, `nickname`, `avatar`, `gender`, `status`, `points`,
   `level_id`, `total_spent`, `last_login_time`, `tags`, `remark`, `create_time`, `update_time`, `is_deleted`)
SELECT
  n,
  IF(n = 1, 'mock_openid_dev', CONCAT('local_openid_', LPAD(n, 4, '0'))),
  IF(MOD(n, 4) = 0, NULL, CONCAT('local_unionid_', LPAD(n, 4, '0'))),
  IF(MOD(n, 10) = 0, NULL, CONCAT('138', LPAD(n, 8, '0'))),
  CONCAT(
    CASE MOD(n - 1, 10)
      WHEN 0 THEN '林' WHEN 1 THEN '陈' WHEN 2 THEN '苏' WHEN 3 THEN '沈' WHEN 4 THEN '顾'
      WHEN 5 THEN '陆' WHEN 6 THEN '叶' WHEN 7 THEN '江' WHEN 8 THEN '许' ELSE '周' END,
    CASE MOD(n * 3, 12)
      WHEN 0 THEN '悦' WHEN 1 THEN '宁' WHEN 2 THEN '安' WHEN 3 THEN '妍' WHEN 4 THEN '晴' WHEN 5 THEN '琪'
      WHEN 6 THEN '晓' WHEN 7 THEN '然' WHEN 8 THEN '一诺' WHEN 9 THEN '思雨' WHEN 10 THEN '可欣' ELSE '嘉怡' END
  ),
  CONCAT('https://picsum.photos/seed/member-', LPAD(n, 3, '0'), '/200/200'),
  MOD(n, 3),
  IF(MOD(n, 19) = 0, 0, 1),
  0,
  1 + MOD(n - 1, 4),
  0,
  DATE_SUB(NOW(), INTERVAL MOD(n * 7, 120) DAY),
  CASE MOD(n, 6)
    WHEN 0 THEN '高意向,皮肤管理'
    WHEN 1 THEN '新客'
    WHEN 2 THEN '复购客户,光电项目'
    WHEN 3 THEN '价格敏感'
    WHEN 4 THEN '注射美容'
    ELSE '沉睡客户' END,
  CASE WHEN MOD(n, 15) = 0 THEN '偏好周末到店，请提前一天联系' ELSE NULL END,
  DATE_SUB(NOW(), INTERVAL (180 + MOD(n * 11, 180)) DAY),
  NOW(),
  0
FROM `_seed_seq`
WHERE n <= 60;

INSERT INTO `product_category`
  (`id`, `name`, `parent_id`, `tree_path`, `level`, `icon`, `sort`, `status`, `create_time`, `update_time`, `is_deleted`)
VALUES
  (1, '皮肤管理', 0, '0', 1, 'https://picsum.photos/seed/category-skin/160/160', 1, 1, NOW(), NOW(), 0),
  (2, '注射美容', 0, '0', 1, 'https://picsum.photos/seed/category-injection/160/160', 2, 1, NOW(), NOW(), 0),
  (3, '光电项目', 0, '0', 1, 'https://picsum.photos/seed/category-device/160/160', 3, 1, NOW(), NOW(), 0),
  (4, '身体护理', 0, '0', 1, 'https://picsum.photos/seed/category-body/160/160', 4, 1, NOW(), NOW(), 0),
  (11, '清洁焕肤', 1, '0,1', 2, NULL, 1, 1, NOW(), NOW(), 0),
  (12, '补水修护', 1, '0,1', 2, NULL, 2, 1, NOW(), NOW(), 0),
  (13, '轮廓塑形', 2, '0,2', 2, NULL, 1, 1, NOW(), NOW(), 0),
  (14, '抗衰除皱', 2, '0,2', 2, NULL, 2, 1, NOW(), NOW(), 0),
  (15, '嫩肤美白', 3, '0,3', 2, NULL, 1, 1, NOW(), NOW(), 0),
  (16, '紧致提升', 3, '0,3', 2, NULL, 2, 1, NOW(), NOW(), 0),
  (17, '舒缓理疗', 4, '0,4', 2, NULL, 1, 1, NOW(), NOW(), 0),
  (18, '塑形管理', 4, '0,4', 2, NULL, 2, 1, NOW(), NOW(), 0),
  (21, '深层清洁', 11, '0,1,11', 3, NULL, 1, 1, NOW(), NOW(), 0),
  (22, '温和焕肤', 11, '0,1,11', 3, NULL, 2, 1, NOW(), NOW(), 0),
  (23, '基础补水', 12, '0,1,12', 3, NULL, 1, 1, NOW(), NOW(), 0),
  (24, '敏感修护', 12, '0,1,12', 3, NULL, 2, 1, NOW(), NOW(), 0),
  (25, '面部塑形', 13, '0,2,13', 3, NULL, 1, 1, NOW(), NOW(), 0),
  (26, '光电嫩肤', 15, '0,3,15', 3, NULL, 1, 1, NOW(), NOW(), 0),
  (27, '仪器抗衰', 16, '0,3,16', 3, NULL, 1, 1, NOW(), NOW(), 0),
  (28, '身体塑形', 18, '0,4,18', 3, NULL, 1, 0, NOW(), NOW(), 0);

INSERT INTO `product`
  (`id`, `name`, `category_id`, `sub_title`, `main_image`, `album`, `tags`, `original_price`,
   `price`, `sales`, `stock`, `detail`, `usage_note`, `status`, `sort`, `create_time`, `update_time`, `is_deleted`)
SELECT
  n,
  CONCAT(
    CASE MOD(n - 1, 18)
      WHEN 0 THEN '深层清洁小气泡' WHEN 1 THEN '舒缓修护管理' WHEN 2 THEN '水光焕亮护理'
      WHEN 3 THEN '玻尿酸保湿导入' WHEN 4 THEN '果酸焕肤' WHEN 5 THEN '光子嫩肤'
      WHEN 6 THEN '黄金微针' WHEN 7 THEN '超皮秒净肤' WHEN 8 THEN '热玛吉紧致'
      WHEN 9 THEN '超声炮提升' WHEN 10 THEN '动态纹舒缓管理' WHEN 11 THEN '玻尿酸轮廓塑形'
      WHEN 12 THEN '胶原焕颜管理' WHEN 13 THEN '深层水光补水' WHEN 14 THEN '肩颈舒缓护理'
      WHEN 15 THEN '腰腹紧致管理' WHEN 16 THEN '背部净痘护理' ELSE '全身焕白护理' END,
    IF(n > 18, '升级版', '')
  ),
  21 + MOD(n - 1, 8),
  CASE MOD(n, 4)
    WHEN 0 THEN '院线定制方案，专业评估后操作'
    WHEN 1 THEN '温和护理，改善肤质与光泽'
    WHEN 2 THEN '分层管理，兼顾即时效果与稳定修护'
    ELSE '热门项目，支持到店面诊调整方案' END,
  CONCAT('https://picsum.photos/seed/product-', LPAD(n, 3, '0'), '/800/800'),
  CONCAT('["https://picsum.photos/seed/product-', LPAD(n, 3, '0'), '-1/800/800","https://picsum.photos/seed/product-', LPAD(n, 3, '0'), '-2/800/800"]'),
  CASE MOD(n, 5)
    WHEN 0 THEN '推荐,热卖' WHEN 1 THEN '新品' WHEN 2 THEN '限时' WHEN 3 THEN '明星项目' ELSE '口碑' END,
  8800 + n * 2100,
  6800 + n * 1900,
  n * 7,
  0,
  CONCAT('<p>项目采用标准化操作流程，适合根据面诊结果进行个性化调整。</p><p>建议按疗程完成，并遵循护理师的居家护理建议。</p>'),
  '到店后需先完成专业面诊；治疗前后避免暴晒和刺激性护肤，特殊情况请提前告知。',
  IF(MOD(n, 9) = 0 OR 21 + MOD(n - 1, 8) = 28 OR n = 36, 0, 1),
  100 - n,
  DATE_SUB(NOW(), INTERVAL MOD(n * 5, 180) DAY),
  NOW(),
  IF(n = 36, 1, 0)
FROM `_seed_seq`
WHERE n <= 36;

INSERT INTO `product_sku`
  (`id`, `product_id`, `name`, `specs`, `sku_code`, `price`, `original_price`, `stock`,
   `status`, `create_time`, `update_time`, `is_deleted`)
SELECT
  (p.id - 1) * 2 + v.variant,
  p.id,
  IF(v.variant = 1, '单次体验', '3次疗程'),
  IF(v.variant = 1, '{"疗程":"单次","服务方式":"到店"}', '{"疗程":"3次","服务方式":"到店"}'),
  CONCAT('DL', LPAD(p.id, 4, '0'), '-', v.variant),
  IF(v.variant = 1, 6800 + p.id * 1900, (6800 + p.id * 1900) * 3 - 2000),
  IF(v.variant = 1, 8800 + p.id * 2100, (8800 + p.id * 2100) * 3),
  CASE
    WHEN p.id IN (34, 36) THEN 0
    WHEN v.variant = 2 AND (MOD(p.id, 7) = 0 OR p.id = 35) THEN 0
    WHEN v.variant = 1 THEN 2 + MOD(p.id * 7, 20)
    ELSE 5 + MOD(p.id * 11, 30)
  END,
  IF(v.variant = 2 AND MOD(p.id, 7) = 0, 0, IF(p.id = 36, 0, 1)),
  DATE_SUB(NOW(), INTERVAL MOD(p.id * 5, 180) DAY),
  NOW(),
  IF((p.id = 35 AND v.variant = 2) OR p.id = 36, 1, 0)
FROM `product` p
CROSS JOIN (SELECT 1 AS variant UNION ALL SELECT 2) v;

UPDATE `product` p
LEFT JOIN (
  SELECT product_id, MIN(price) AS min_price, SUM(stock) AS total_stock
  FROM `product_sku`
  WHERE status = 1 AND is_deleted = 0
  GROUP BY product_id
) s ON s.product_id = p.id
SET p.price = COALESCE(s.min_price, p.price),
    p.stock = COALESCE(s.total_stock, 0);

INSERT INTO `cart`
  (`id`, `member_id`, `product_id`, `sku_id`, `quantity`, `checked`, `create_time`, `update_time`, `is_deleted`)
SELECT
  n,
  n,
  CEIL((1 + MOD(n * 11, 72)) / 2),
  1 + MOD(n * 11, 72),
  1 + MOD(n, 3),
  IF(MOD(n, 3) = 0, 0, 1),
  DATE_SUB(NOW(), INTERVAL MOD(n * 2, 30) DAY),
  NOW(),
  0
FROM `_seed_seq`
WHERE n <= 30;

INSERT INTO `coupon`
  (`id`, `name`, `type`, `scope_type`, `threshold_amount`, `discount_amount`, `discount_rate`,
   `max_discount_amount`, `exchange_sku_id`, `claim_start`, `claim_end`, `valid_start`, `valid_end`,
   `total_quantity`, `issued_quantity`, `per_member_limit`, `status`, `create_time`, `update_time`, `is_deleted`)
VALUES
  (1, '新客立减券', 'FULL_REDUCTION', 'ALL', 0, 1000, 10000, NULL, NULL, DATE_SUB(NOW(), INTERVAL 30 DAY), DATE_ADD(NOW(), INTERVAL 30 DAY), DATE_SUB(NOW(), INTERVAL 30 DAY), DATE_ADD(NOW(), INTERVAL 60 DAY), 500, 0, 1, 1, NOW(), NOW(), 0),
  (2, '夏日焕肤九折券', 'DISCOUNT', 'ALL', 10000, 0, 9000, 3000, NULL, DATE_SUB(NOW(), INTERVAL 15 DAY), DATE_ADD(NOW(), INTERVAL 45 DAY), DATE_SUB(NOW(), INTERVAL 15 DAY), DATE_ADD(NOW(), INTERVAL 60 DAY), 300, 0, 1, 1, NOW(), NOW(), 0),
  (3, '皮肤管理满300减50', 'FULL_REDUCTION', 'CATEGORY', 30000, 5000, 10000, NULL, NULL, DATE_SUB(NOW(), INTERVAL 20 DAY), DATE_ADD(NOW(), INTERVAL 20 DAY), DATE_SUB(NOW(), INTERVAL 20 DAY), DATE_ADD(NOW(), INTERVAL 45 DAY), 200, 0, 2, 1, NOW(), NOW(), 0),
  (4, '光电项目八五折券', 'DISCOUNT', 'CATEGORY', 20000, 0, 8500, 8000, NULL, DATE_SUB(NOW(), INTERVAL 10 DAY), DATE_ADD(NOW(), INTERVAL 20 DAY), DATE_SUB(NOW(), INTERVAL 10 DAY), DATE_ADD(NOW(), INTERVAL 40 DAY), 100, 0, 1, 1, NOW(), NOW(), 0),
  (5, '水光焕亮兑换券', 'EXCHANGE', 'PRODUCT', 0, 0, 10000, NULL, 1, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_ADD(NOW(), INTERVAL 25 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_ADD(NOW(), INTERVAL 35 DAY), 80, 0, 1, 1, NOW(), NOW(), 0),
  (6, '七夕专享券', 'FULL_REDUCTION', 'ALL', 50000, 8000, 10000, NULL, NULL, DATE_ADD(NOW(), INTERVAL 15 DAY), DATE_ADD(NOW(), INTERVAL 45 DAY), DATE_ADD(NOW(), INTERVAL 15 DAY), DATE_ADD(NOW(), INTERVAL 60 DAY), 200, 0, 1, 0, NOW(), NOW(), 0),
  (7, '春季焕新券', 'FULL_REDUCTION', 'ALL', 20000, 3000, 10000, NULL, NULL, DATE_SUB(NOW(), INTERVAL 80 DAY), DATE_SUB(NOW(), INTERVAL 20 DAY), DATE_SUB(NOW(), INTERVAL 80 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY), 300, 0, 1, 2, NOW(), NOW(), 0),
  (8, '周年庆满减券', 'FULL_REDUCTION', 'ALL', 40000, 6000, 10000, NULL, NULL, DATE_SUB(NOW(), INTERVAL 90 DAY), DATE_SUB(NOW(), INTERVAL 35 DAY), DATE_SUB(NOW(), INTERVAL 90 DAY), DATE_SUB(NOW(), INTERVAL 10 DAY), 150, 0, 1, 1, NOW(), NOW(), 0),
  (9, '国庆预热券', 'DISCOUNT', 'ALL', 10000, 0, 9200, 2500, NULL, DATE_ADD(NOW(), INTERVAL 20 DAY), DATE_ADD(NOW(), INTERVAL 50 DAY), DATE_ADD(NOW(), INTERVAL 20 DAY), DATE_ADD(NOW(), INTERVAL 70 DAY), 500, 0, 1, 1, NOW(), NOW(), 0),
  (10, '限量秒杀券', 'FULL_REDUCTION', 'PRODUCT', 10000, 2000, 10000, NULL, NULL, DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_ADD(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_ADD(NOW(), INTERVAL 10 DAY), 1, 0, 1, 1, NOW(), NOW(), 0),
  (11, '热玛吉专属券', 'DISCOUNT', 'PRODUCT', 50000, 0, 8800, 12000, NULL, DATE_SUB(NOW(), INTERVAL 7 DAY), DATE_ADD(NOW(), INTERVAL 21 DAY), DATE_SUB(NOW(), INTERVAL 7 DAY), DATE_ADD(NOW(), INTERVAL 35 DAY), 100, 0, 1, 1, NOW(), NOW(), 0),
  (12, '小气泡体验兑换券', 'EXCHANGE', 'PRODUCT', 0, 0, 10000, NULL, 3, DATE_SUB(NOW(), INTERVAL 100 DAY), DATE_SUB(NOW(), INTERVAL 50 DAY), DATE_SUB(NOW(), INTERVAL 100 DAY), DATE_SUB(NOW(), INTERVAL 30 DAY), 60, 0, 1, 2, NOW(), NOW(), 0);

INSERT INTO `coupon_scope`
  (`id`, `coupon_id`, `target_type`, `target_id`, `create_time`, `update_time`, `is_deleted`)
VALUES
  (1, 3, 'CATEGORY', 21, NOW(), NOW(), 0),
  (2, 3, 'CATEGORY', 22, NOW(), NOW(), 0),
  (3, 4, 'CATEGORY', 26, NOW(), NOW(), 0),
  (4, 10, 'PRODUCT', 6, NOW(), NOW(), 0),
  (5, 11, 'PRODUCT', 9, NOW(), NOW(), 0);

INSERT INTO `member_coupon`
  (`id`, `coupon_id`, `member_id`, `status`, `order_id`, `claimed_at`, `used_at`, `create_time`, `update_time`, `is_deleted`)
SELECT
  n,
  CASE
    WHEN n <= 120 AND MOD(n, 4) = 0 THEN IF(MOD(n, 8) = 0, 2, 1)
    ELSE CASE MOD(n, 10)
      WHEN 0 THEN 1 WHEN 1 THEN 2 WHEN 2 THEN 3 WHEN 3 THEN 4 WHEN 4 THEN 5
      WHEN 5 THEN 7 WHEN 6 THEN 8 WHEN 7 THEN 10 WHEN 8 THEN 11 ELSE 12 END
  END,
  CASE
    WHEN n <= 120 AND MOD(n, 4) = 0 THEN 1 + MOD(n * 17 + FLOOR(n / 6) * 7 - 1, 60)
    ELSE 1 + MOD(n - 1, 60)
  END,
  CASE
    WHEN MOD(n, 4) = 0 AND n <= 120 THEN 0
    WHEN MOD(n, 10) IN (6, 9) THEN 3
    ELSE 0
  END,
  NULL,
  CASE WHEN MOD(n, 10) IN (6, 9) THEN DATE_SUB(NOW(), INTERVAL 70 DAY) ELSE DATE_SUB(NOW(), INTERVAL MOD(n, 25) DAY) END,
  NULL,
  CASE WHEN MOD(n, 10) IN (6, 9) THEN DATE_SUB(NOW(), INTERVAL 70 DAY) ELSE DATE_SUB(NOW(), INTERVAL MOD(n, 25) DAY) END,
  NOW(),
  0
FROM `_seed_seq`
WHERE n <= 180;

UPDATE `coupon` c
LEFT JOIN (
  SELECT coupon_id, COUNT(*) AS issued
  FROM `member_coupon`
  WHERE is_deleted = 0
  GROUP BY coupon_id
) mc ON mc.coupon_id = c.id
SET c.issued_quantity = COALESCE(mc.issued, 0),
    c.total_quantity = IF(c.id = 10, COALESCE(mc.issued, 0), c.total_quantity);

INSERT INTO `biz_order`
  (`id`, `order_no`, `member_id`, `status`, `total_amount`, `discount_amount`, `member_level_id`,
   `member_discount`, `member_coupon_id`, `coupon_amount`, `points_used`, `points_deduct`, `pay_amount`,
   `pay_type`, `pay_time`, `contact_name`, `contact_mobile`, `remark`, `verify_code`, `verify_time`,
   `verify_by`, `cancel_time`, `cancel_reason`, `create_time`, `update_time`, `is_deleted`)
SELECT
  s.n,
  CONCAT('DL', DATE_FORMAT(DATE_SUB(NOW(), INTERVAL MOD(s.n * 7, 90) DAY), '%Y%m%d'), LPAD(s.n, 6, '0')),
  m.id,
  MOD(s.n - 1, 6),
  0,
  0,
  m.level_id,
  0,
  IF(MOD(s.n, 4) = 0, s.n, NULL),
  0,
  IF(MOD(s.n, 5) = 0, 300, 0),
  IF(MOD(s.n, 5) = 0, 300, 0),
  0,
  IF(MOD(s.n - 1, 6) IN (1, 2, 3, 5), 2, NULL),
  IF(MOD(s.n - 1, 6) IN (1, 2, 3, 5), DATE_ADD(DATE_SUB(NOW(), INTERVAL MOD(s.n * 7, 90) DAY), INTERVAL 30 MINUTE), NULL),
  m.nickname,
  COALESCE(m.mobile, CONCAT('139', LPAD(s.n, 8, '0'))),
  CASE MOD(s.n, 8)
    WHEN 0 THEN '希望安排安静房间' WHEN 1 THEN '到店前请电话确认' WHEN 2 THEN '皮肤较敏感，请先面诊' ELSE NULL END,
  IF(MOD(s.n - 1, 6) IN (1, 2, 3), CONCAT('V', LPAD(s.n, 8, '0')), NULL),
  IF(MOD(s.n - 1, 6) IN (2, 3), DATE_ADD(DATE_SUB(NOW(), INTERVAL MOD(s.n * 7, 90) DAY), INTERVAL 2 DAY), NULL),
  IF(MOD(s.n - 1, 6) IN (2, 3), 1, NULL),
  IF(MOD(s.n - 1, 6) = 4, DATE_ADD(DATE_SUB(NOW(), INTERVAL MOD(s.n * 7, 90) DAY), INTERVAL 2 HOUR), NULL),
  IF(MOD(s.n - 1, 6) = 4, CASE MOD(s.n, 3) WHEN 0 THEN '行程变更' WHEN 1 THEN '重复下单' ELSE '暂不需要' END, NULL),
  DATE_SUB(DATE_SUB(NOW(), INTERVAL MOD(s.n * 7, 90) DAY), INTERVAL MOD(s.n, 12) HOUR),
  NOW(),
  0
FROM `_seed_seq` s
JOIN `member` m ON m.id = 1 + MOD(s.n * 17 + FLOOR(s.n / 6) * 7 - 1, 60)
WHERE s.n <= 120;

INSERT INTO `biz_order_item`
  (`id`, `order_id`, `product_id`, `sku_id`, `product_name`, `product_image`, `sku_name`,
   `price`, `quantity`, `subtotal`, `create_time`, `update_time`, `is_deleted`)
SELECT
  o.id * 2 - 1,
  o.id,
  p.id,
  sku.id,
  p.name,
  p.main_image,
  sku.name,
  sku.price,
  1 + MOD(o.id, 2),
  sku.price * (1 + MOD(o.id, 2)),
  o.create_time,
  o.update_time,
  0
FROM `biz_order` o
JOIN `product_sku` sku ON sku.id = 1 + MOD(o.id - 1, 72)
JOIN `product` p ON p.id = sku.product_id;

INSERT INTO `biz_order_item`
  (`id`, `order_id`, `product_id`, `sku_id`, `product_name`, `product_image`, `sku_name`,
   `price`, `quantity`, `subtotal`, `create_time`, `update_time`, `is_deleted`)
SELECT
  o.id * 2,
  o.id,
  p.id,
  sku.id,
  p.name,
  p.main_image,
  sku.name,
  sku.price,
  1,
  sku.price,
  o.create_time,
  o.update_time,
  0
FROM `biz_order` o
JOIN `product_sku` sku ON sku.id = 1 + MOD(o.id * 5, 72)
JOIN `product` p ON p.id = sku.product_id
WHERE MOD(o.id, 3) = 0;

UPDATE `biz_order` o
JOIN (
  SELECT order_id, SUM(subtotal) AS total_amount
  FROM `biz_order_item`
  WHERE is_deleted = 0
  GROUP BY order_id
) items ON items.order_id = o.id
JOIN `member_level` level_snapshot ON level_snapshot.id = o.member_level_id
LEFT JOIN `member_coupon` mc ON mc.id = o.member_coupon_id
LEFT JOIN `coupon` c ON c.id = mc.coupon_id
SET o.total_amount = items.total_amount,
    o.member_discount = FLOOR(items.total_amount * (10000 - level_snapshot.discount_rate) / 10000),
    o.coupon_amount = CASE c.type
      WHEN 'FULL_REDUCTION' THEN LEAST(c.discount_amount, items.total_amount)
      WHEN 'DISCOUNT' THEN LEAST(COALESCE(c.max_discount_amount, items.total_amount), FLOOR(items.total_amount * (10000 - c.discount_rate) / 10000))
      ELSE 0
    END;

UPDATE `biz_order`
SET discount_amount = member_discount + coupon_amount + points_deduct,
    pay_amount = total_amount - member_discount - coupon_amount - points_deduct;

UPDATE `member_coupon` mc
JOIN `biz_order` o ON o.id = mc.id AND MOD(mc.id, 4) = 0 AND mc.id <= 120
SET mc.status = CASE o.status WHEN 1 THEN 1 WHEN 3 THEN 2 ELSE 0 END,
    mc.order_id = CASE WHEN o.status IN (1, 3) THEN o.id ELSE NULL END,
    mc.used_at = CASE WHEN o.status = 3 THEN o.update_time ELSE NULL END,
    mc.update_time = NOW();

INSERT INTO `biz_payment`
  (`id`, `payment_no`, `order_id`, `member_id`, `amount`, `channel`, `status`, `third_party_no`,
   `paid_time`, `create_time`, `update_time`, `is_deleted`)
SELECT
  o.id,
  CONCAT('PAY', LPAD(o.id, 12, '0')),
  o.id,
  o.member_id,
  o.pay_amount,
  'mock',
  CASE
    WHEN o.status = 0 THEN IF(MOD(FLOOR(o.id / 6), 2) = 0, 0, 2)
    WHEN o.status IN (1, 2, 3) THEN 1
    WHEN o.status = 5 THEN 3
    ELSE 2
  END,
  CASE WHEN o.status IN (1, 2, 3, 5) THEN CONCAT('MOCK', LPAD(o.id, 12, '0')) ELSE NULL END,
  CASE WHEN o.status IN (1, 2, 3, 5) THEN o.pay_time ELSE NULL END,
  DATE_ADD(o.create_time, INTERVAL 5 MINUTE),
  o.update_time,
  0
FROM `biz_order` o
WHERE o.status <> 4;

INSERT INTO `biz_refund`
  (`id`, `refund_no`, `payment_id`, `order_id`, `member_id`, `amount`, `reason`, `status`,
   `third_party_no`, `refund_time`, `create_time`, `update_time`, `is_deleted`)
SELECT
  o.id,
  CONCAT('REF', LPAD(o.id, 12, '0')),
  p.id,
  o.id,
  o.member_id,
  o.pay_amount,
  CASE MOD(o.id, 3) WHEN 0 THEN '治疗计划调整' WHEN 1 THEN '项目暂缓' ELSE '协商退款' END,
  1,
  CONCAT('MOCKREF', LPAD(o.id, 10, '0')),
  DATE_ADD(o.pay_time, INTERVAL 2 DAY),
  DATE_ADD(o.pay_time, INTERVAL 1 DAY),
  NOW(),
  0
FROM `biz_order` o
JOIN `biz_payment` p ON p.order_id = o.id
WHERE o.status = 5;

INSERT INTO `biz_refund`
  (`id`, `refund_no`, `payment_id`, `order_id`, `member_id`, `amount`, `reason`, `status`,
   `third_party_no`, `refund_time`, `create_time`, `update_time`, `is_deleted`)
SELECT
  1000 + o.id,
  CONCAT('REF', LPAD(1000 + o.id, 12, '0')),
  p.id,
  o.id,
  o.member_id,
  FLOOR(o.pay_amount / 2),
  '客户申请部分退款，等待审核',
  IF(MOD(FLOOR(o.id / 6), 2) = 0, 0, 2),
  NULL,
  NULL,
  DATE_ADD(o.pay_time, INTERVAL 1 DAY),
  NOW(),
  0
FROM `biz_order` o
JOIN `biz_payment` p ON p.order_id = o.id
WHERE o.status = 1 AND o.id <= 32;

INSERT INTO `member_points_log`
  (`id`, `member_id`, `change_points`, `balance_after`, `biz_type`, `biz_id`, `order_id`,
   `remark`, `create_time`, `update_time`, `is_deleted`)
WITH point_events AS (
  SELECT m.id AS member_id, 1000 + m.id * 10 AS change_points, 'INIT' AS biz_type,
         'local-seed' AS biz_id, NULL AS order_id, '初始积分余额' AS remark,
         m.create_time AS event_time, 1 AS event_sort
  FROM `member` m
  UNION ALL
  SELECT o.member_id, -o.points_used, 'ORDER_DEDUCT', o.order_no, o.id, '下单抵扣积分',
         DATE_ADD(o.create_time, INTERVAL 1 MINUTE), 2
  FROM `biz_order` o WHERE o.points_used > 0
  UNION ALL
  SELECT o.member_id, o.points_used,
         IF(o.status = 5, 'ORDER_REFUND_RETURN', 'ORDER_CANCEL_RETURN'),
         o.order_no, o.id, IF(o.status = 5, '订单退款返还积分', '订单取消返还积分'),
         COALESCE(o.cancel_time, DATE_ADD(o.pay_time, INTERVAL 2 DAY)), 3
  FROM `biz_order` o WHERE o.points_used > 0 AND o.status IN (4, 5)
  UNION ALL
  SELECT o.member_id, FLOOR(o.pay_amount / 100), 'ORDER_EARN', o.order_no, o.id, '订单完成赠送积分',
         DATE_ADD(o.verify_time, INTERVAL 1 DAY), 4
  FROM `biz_order` o WHERE o.status = 3
), sequenced AS (
  SELECT
    ROW_NUMBER() OVER (ORDER BY member_id, event_time, event_sort, biz_type) AS id,
    member_id,
    change_points,
    SUM(change_points) OVER (
      PARTITION BY member_id ORDER BY event_time, event_sort, biz_type
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS balance_after,
    biz_type,
    biz_id,
    order_id,
    remark,
    event_time
  FROM point_events
)
SELECT id, member_id, change_points, balance_after, biz_type, biz_id, order_id,
       remark, event_time, NOW(), 0
FROM sequenced;

UPDATE `member` m
LEFT JOIN (
  SELECT member_id, SUM(change_points) AS points
  FROM `member_points_log`
  WHERE is_deleted = 0
  GROUP BY member_id
) points ON points.member_id = m.id
LEFT JOIN (
  SELECT member_id, SUM(pay_amount) AS total_spent
  FROM `biz_order`
  WHERE status = 3 AND is_deleted = 0
  GROUP BY member_id
) spending ON spending.member_id = m.id
SET m.points = COALESCE(points.points, 0),
    m.total_spent = COALESCE(spending.total_spent, 0);

UPDATE `member` m
SET m.level_id = (
  SELECT level.id
  FROM `member_level` level
  WHERE level.status = 1 AND level.is_deleted = 0 AND level.threshold_amount <= m.total_spent
  ORDER BY level.threshold_amount DESC, level.id DESC
  LIMIT 1
);

UPDATE `product` p
LEFT JOIN (
  SELECT item.product_id, SUM(item.quantity) AS sales
  FROM `biz_order_item` item
  JOIN `biz_order` o ON o.id = item.order_id
  WHERE o.status IN (1, 2, 3) AND o.is_deleted = 0 AND item.is_deleted = 0
  GROUP BY item.product_id
) sold ON sold.product_id = p.id
SET p.sales = COALESCE(sold.sales, 0);

DELETE FROM `_seed_guard`;
INSERT INTO `_seed_guard` (`failures`)
SELECT
  (SELECT COUNT(*) <> 60 FROM `member`) +
  (SELECT COUNT(*) <> 4 FROM `member_level`) +
  (SELECT COUNT(*) <> 20 FROM `product_category`) +
  (SELECT COUNT(*) <> 36 FROM `product`) +
  (SELECT COUNT(*) <> 72 FROM `product_sku`) +
  (SELECT COUNT(*) <> 30 FROM `cart`) +
  (SELECT COUNT(*) <> 120 FROM `biz_order`) +
  (SELECT COUNT(*) <> 160 FROM `biz_order_item`) +
  (SELECT COUNT(*) <> 100 FROM `biz_payment`) +
  (SELECT COUNT(*) <> 26 FROM `biz_refund`) +
  (SELECT COUNT(*) <> 112 FROM `member_points_log`) +
  (SELECT COUNT(*) <> 12 FROM `coupon`) +
  (SELECT COUNT(*) <> 5 FROM `coupon_scope`) +
  (SELECT COUNT(*) <> 180 FROM `member_coupon`) +
  (SELECT COUNT(DISTINCT status) <> 6 FROM `biz_order`) +
  (SELECT COUNT(DISTINCT status) <> 4 FROM `biz_payment`) +
  (SELECT COUNT(DISTINCT status) <> 3 FROM `biz_refund`) +
  (SELECT COUNT(DISTINCT type) <> 3 FROM `coupon`) +
  (SELECT COUNT(DISTINCT status) <> 3 FROM `coupon`) +
  (SELECT COUNT(DISTINCT status) <> 4 FROM `member_coupon`) +
  (SELECT COUNT(*) FROM `biz_order` WHERE pay_amount <> total_amount - member_discount - coupon_amount - points_deduct) +
  (SELECT COUNT(*) FROM `biz_order` WHERE discount_amount <> member_discount + coupon_amount + points_deduct) +
  (SELECT COUNT(*) FROM `product` p LEFT JOIN (
      SELECT product_id, SUM(stock) stock FROM `product_sku` WHERE status = 1 AND is_deleted = 0 GROUP BY product_id
    ) s ON s.product_id = p.id WHERE p.stock <> COALESCE(s.stock, 0)) +
  (SELECT COUNT(*) FROM `member` m LEFT JOIN (
      SELECT member_id, SUM(change_points) points FROM `member_points_log` WHERE is_deleted = 0 GROUP BY member_id
    ) l ON l.member_id = m.id WHERE m.points <> COALESCE(l.points, 0)) +
  (SELECT COUNT(*) FROM `member` m LEFT JOIN (
      SELECT member_id, SUM(pay_amount) total_spent FROM `biz_order` WHERE status = 3 AND is_deleted = 0 GROUP BY member_id
    ) o ON o.member_id = m.id WHERE m.total_spent <> COALESCE(o.total_spent, 0)) +
  (SELECT COUNT(*) FROM `coupon` c LEFT JOIN (
      SELECT coupon_id, COUNT(*) issued FROM `member_coupon` WHERE is_deleted = 0 GROUP BY coupon_id
    ) mc ON mc.coupon_id = c.id WHERE c.issued_quantity <> COALESCE(mc.issued, 0)) +
  (SELECT COUNT(*) FROM `biz_order_item` i LEFT JOIN `biz_order` o ON o.id = i.order_id WHERE o.id IS NULL) +
  (SELECT COUNT(*) FROM `biz_order_item` i LEFT JOIN `product` p ON p.id = i.product_id LEFT JOIN `product_sku` s ON s.id = i.sku_id WHERE p.id IS NULL OR s.id IS NULL) +
  (SELECT COUNT(*) FROM `cart` c LEFT JOIN `member` m ON m.id = c.member_id LEFT JOIN `product` p ON p.id = c.product_id LEFT JOIN `product_sku` s ON s.id = c.sku_id WHERE m.id IS NULL OR p.id IS NULL OR s.id IS NULL) +
  (SELECT COUNT(*) FROM `biz_payment` p LEFT JOIN `biz_order` o ON o.id = p.order_id WHERE o.id IS NULL) +
  (SELECT COUNT(*) FROM `biz_refund` r LEFT JOIN `biz_payment` p ON p.id = r.payment_id LEFT JOIN `biz_order` o ON o.id = r.order_id LEFT JOIN `member` m ON m.id = r.member_id WHERE p.id IS NULL OR o.id IS NULL OR m.id IS NULL) +
  (SELECT COUNT(*) FROM `member_points_log` l LEFT JOIN `member` m ON m.id = l.member_id LEFT JOIN `biz_order` o ON o.id = l.order_id WHERE m.id IS NULL OR (l.order_id IS NOT NULL AND o.id IS NULL)) +
  (SELECT COUNT(*) FROM `coupon_scope` s LEFT JOIN `coupon` c ON c.id = s.coupon_id WHERE c.id IS NULL) +
  (SELECT COUNT(*) FROM `member_coupon` mc LEFT JOIN `member` m ON m.id = mc.member_id LEFT JOIN `coupon` c ON c.id = mc.coupon_id LEFT JOIN `biz_order` o ON o.id = mc.order_id WHERE m.id IS NULL OR c.id IS NULL OR (mc.order_id IS NOT NULL AND o.id IS NULL)) +
  (SELECT COUNT(*) FROM `biz_order` o JOIN `member_coupon` mc ON mc.id = o.member_coupon_id WHERE mc.member_id <> o.member_id);

COMMIT;

SELECT 'member' AS module, COUNT(*) AS rows_count FROM `member`
UNION ALL SELECT 'product', COUNT(*) FROM `product`
UNION ALL SELECT 'product_sku', COUNT(*) FROM `product_sku`
UNION ALL SELECT 'cart', COUNT(*) FROM `cart`
UNION ALL SELECT 'biz_order', COUNT(*) FROM `biz_order`
UNION ALL SELECT 'biz_payment', COUNT(*) FROM `biz_payment`
UNION ALL SELECT 'biz_refund', COUNT(*) FROM `biz_refund`
UNION ALL SELECT 'member_points_log', COUNT(*) FROM `member_points_log`
UNION ALL SELECT 'coupon', COUNT(*) FROM `coupon`
UNION ALL SELECT 'member_coupon', COUNT(*) FROM `member_coupon`;

DROP TEMPORARY TABLE `_seed_guard`;
DROP TEMPORARY TABLE `_seed_seq`;
