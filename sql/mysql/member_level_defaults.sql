-- 既有数据库补齐默认消费会员等级；同门槛已有配置时保留管理员配置。
USE youlai_admin;

SET NAMES utf8mb4;

INSERT INTO `member_level`
    (`name`, `threshold_amount`, `discount_rate`, `status`, `sort`, `create_time`, `update_time`, `is_deleted`)
SELECT seed.`name`, seed.`threshold_amount`, seed.`discount_rate`, 1, seed.`sort`, now(), now(), 0
FROM (
    SELECT '普通会员' AS `name`, 0 AS `threshold_amount`, 10000 AS `discount_rate`, 1 AS `sort`
    UNION ALL SELECT '白银会员', 5000000, 9000, 2
    UNION ALL SELECT '黄金会员', 10000000, 8000, 3
    UNION ALL SELECT '白金会员', 20000000, 7000, 4
) seed
LEFT JOIN `member_level` existing
    ON existing.`threshold_amount` = seed.`threshold_amount`
    AND existing.`is_deleted` = 0
WHERE existing.`id` IS NULL;
