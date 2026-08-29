-- marketing 等级、积分、优惠券关系与值域加固（既有数据库一次性执行）
-- 依赖：biz_p0.sql、biz_phase5.sql 已执行。
-- 新建数据库已由 biz_phase5.sql 包含相同最终结构，无需重复执行本文件。

USE youlai_admin;
SET NAMES utf8mb4;

DROP PROCEDURE IF EXISTS `migrate_marketing_hardening`;
DELIMITER $$

CREATE PROCEDURE `migrate_marketing_hardening`()
BEGIN
    DECLARE v_rule_table_exists int DEFAULT 0;
    DECLARE v_legacy_rule varchar(500) DEFAULT NULL;
    DECLARE v_earn int DEFAULT NULL;
    DECLARE v_redeem int DEFAULT NULL;
    DECLARE v_rate int DEFAULT NULL;

    SELECT COUNT(*) INTO v_rule_table_exists
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketing_points_rule';

    IF v_rule_table_exists = 0 THEN
        SET v_legacy_rule = (
            SELECT `config_value`
            FROM `sys_config`
            WHERE `config_key` = 'marketing.points.rule' AND `is_deleted` = 0
            ORDER BY `id` DESC
            LIMIT 1
        );

        CREATE TABLE `marketing_points_rule` (
            `id` bigint NOT NULL AUTO_INCREMENT,
            `earn_per_yuan` int NOT NULL DEFAULT 1 COMMENT '每实付1元赠送积分',
            `redeem_points_per_yuan` int NOT NULL DEFAULT 100 COMMENT '抵扣1元所需积分',
            `max_deduct_rate` int NOT NULL DEFAULT 5000 COMMENT '单笔最高抵扣万分比',
            `create_by` bigint NULL,
            `create_time` datetime NULL,
            `update_by` bigint NULL,
            `update_time` datetime NULL,
            `is_deleted` tinyint NOT NULL DEFAULT 0,
            PRIMARY KEY (`id`),
            CONSTRAINT `chk_marketing_points_rule_singleton` CHECK (`id` = 1),
            CONSTRAINT `chk_marketing_points_rule_earn`
                CHECK (`earn_per_yuan` BETWEEN 0 AND 10000),
            CONSTRAINT `chk_marketing_points_rule_redeem`
                CHECK (`redeem_points_per_yuan` BETWEEN 1 AND 1000000),
            CONSTRAINT `chk_marketing_points_rule_rate`
                CHECK (`max_deduct_rate` BETWEEN 0 AND 10000),
            CONSTRAINT `chk_marketing_points_rule_is_deleted` CHECK (`is_deleted` = 0)
        ) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='营销积分规则';

        INSERT INTO `marketing_points_rule`
            (`id`, `earn_per_yuan`, `redeem_points_per_yuan`, `max_deduct_rate`,
             `create_time`, `update_time`, `is_deleted`)
        VALUES (1, 1, 100, 5000, now(), now(), 0);

        IF v_legacy_rule IS NOT NULL AND JSON_VALID(v_legacy_rule) THEN
            SET v_earn = CAST(JSON_UNQUOTE(JSON_EXTRACT(v_legacy_rule, '$.earnPerYuan')) AS SIGNED);
            SET v_redeem = CAST(JSON_UNQUOTE(JSON_EXTRACT(v_legacy_rule, '$.redeemPointsPerYuan')) AS SIGNED);
            SET v_rate = CAST(JSON_UNQUOTE(JSON_EXTRACT(v_legacy_rule, '$.maxDeductRate')) AS SIGNED);

            UPDATE `marketing_points_rule`
            SET `earn_per_yuan` = IF(v_earn BETWEEN 0 AND 10000, v_earn, `earn_per_yuan`),
                `redeem_points_per_yuan` = IF(
                    v_redeem BETWEEN 1 AND 1000000,
                    v_redeem,
                    `redeem_points_per_yuan`
                ),
                `max_deduct_rate` = IF(v_rate BETWEEN 0 AND 10000, v_rate, `max_deduct_rate`),
                `update_time` = now()
            WHERE `id` = 1;
        END IF;
    END IF;

    UPDATE `sys_config`
    SET `is_deleted` = 1,
        `remark` = '已迁移至 marketing_points_rule，停止通过通用配置维护',
        `update_time` = now()
    WHERE `config_key` = 'marketing.points.rule' AND `is_deleted` = 0;

    IF EXISTS (
        SELECT 1 FROM `member_level`
        WHERE CHAR_LENGTH(TRIM(`name`)) = 0
           OR `threshold_amount` < 0
           OR `discount_rate` NOT BETWEEN 1 AND 10000
           OR `status` NOT IN (0, 1)
           OR `is_deleted` NOT IN (0, 1)
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'member_level 存在非法名称、门槛、折扣、状态或删除标识';
    END IF;

    IF EXISTS (
        SELECT 1 FROM `member_level`
        WHERE `is_deleted` = 0
        GROUP BY `threshold_amount`
        HAVING COUNT(*) > 1
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'member_level 存在重复活动门槛，请先合并等级';
    END IF;

    IF EXISTS (
        SELECT 1 FROM `member` m
        LEFT JOIN `member_level` l ON l.`id` = m.`level_id`
        WHERE m.`level_id` IS NOT NULL AND l.`id` IS NULL
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'member 存在无效 level_id';
    END IF;

    IF EXISTS (
        SELECT 1 FROM `member_points_log` p
        LEFT JOIN `member` m ON m.`id` = p.`member_id`
        LEFT JOIN `biz_order` o ON o.`id` = p.`order_id`
        WHERE p.`balance_after` < 0
           OR p.`biz_type` NOT IN (
               'INIT', 'ORDER_DEDUCT', 'ORDER_CANCEL_RETURN', 'ORDER_REFUND_RETURN', 'ORDER_EARN'
           )
           OR p.`is_deleted` NOT IN (0, 1)
           OR m.`id` IS NULL
           OR (p.`order_id` IS NOT NULL AND o.`id` IS NULL)
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'member_points_log 存在非法值或孤儿关系';
    END IF;

    IF EXISTS (
        SELECT 1 FROM `coupon` c
        LEFT JOIN `product_sku` s ON s.`id` = c.`exchange_sku_id`
        WHERE CHAR_LENGTH(TRIM(c.`name`)) = 0
           OR c.`type` NOT IN ('FULL_REDUCTION', 'DISCOUNT', 'EXCHANGE')
           OR c.`scope_type` NOT IN ('ALL', 'CATEGORY', 'PRODUCT')
           OR c.`threshold_amount` < 0
           OR c.`discount_amount` < 0
           OR c.`discount_rate` NOT BETWEEN 1 AND 10000
           OR (c.`max_discount_amount` IS NOT NULL AND c.`max_discount_amount` < 1)
           OR c.`claim_start` > c.`claim_end`
           OR c.`valid_start` > c.`valid_end`
           OR c.`claim_end` > c.`valid_end`
           OR c.`total_quantity` < 1
           OR c.`issued_quantity` NOT BETWEEN 0 AND c.`total_quantity`
           OR c.`per_member_limit` NOT BETWEEN 1 AND c.`total_quantity`
           OR c.`status` NOT IN (0, 1, 2)
           OR c.`is_deleted` NOT IN (0, 1)
           OR (c.`type` = 'FULL_REDUCTION' AND c.`discount_amount` <= 0)
           OR (c.`type` = 'DISCOUNT' AND c.`discount_rate` >= 10000)
           OR (c.`type` = 'EXCHANGE' AND (
               c.`scope_type` <> 'PRODUCT' OR c.`exchange_sku_id` IS NULL OR s.`id` IS NULL
           ))
           OR (c.`type` <> 'EXCHANGE' AND c.`exchange_sku_id` IS NOT NULL)
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'coupon 存在非法金额、数量、状态、时间或兑换SKU';
    END IF;

    IF EXISTS (
        SELECT 1 FROM `coupon` c
        LEFT JOIN (
            SELECT `coupon_id`, COUNT(*) AS issued
            FROM `member_coupon`
            WHERE `is_deleted` = 0
            GROUP BY `coupon_id`
        ) mc ON mc.`coupon_id` = c.`id`
        WHERE c.`issued_quantity` <> COALESCE(mc.issued, 0)
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'coupon.issued_quantity 与会员券数量不一致';
    END IF;

    IF EXISTS (
        SELECT 1 FROM `coupon_scope` cs
        LEFT JOIN `coupon` c ON c.`id` = cs.`coupon_id`
        LEFT JOIN `product_category` pc
          ON cs.`target_type` = 'CATEGORY' AND pc.`id` = cs.`target_id`
        LEFT JOIN `product` p
          ON cs.`target_type` = 'PRODUCT' AND p.`id` = cs.`target_id`
        WHERE cs.`target_type` NOT IN ('CATEGORY', 'PRODUCT')
           OR cs.`is_deleted` NOT IN (0, 1)
           OR c.`id` IS NULL
           OR (cs.`target_type` = 'CATEGORY' AND pc.`id` IS NULL)
           OR (cs.`target_type` = 'PRODUCT' AND p.`id` IS NULL)
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'coupon_scope 存在非法范围或孤儿关系';
    END IF;

    IF EXISTS (
        SELECT 1 FROM `coupon_scope`
        WHERE `is_deleted` = 0
        GROUP BY `coupon_id`, `target_type`, `target_id`
        HAVING COUNT(*) > 1
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'coupon_scope 存在重复活动范围';
    END IF;

    IF EXISTS (
        SELECT 1 FROM `member_coupon` mc
        LEFT JOIN `coupon` c ON c.`id` = mc.`coupon_id`
        LEFT JOIN `member` m ON m.`id` = mc.`member_id`
        LEFT JOIN `biz_order` o ON o.`id` = mc.`order_id`
        WHERE mc.`status` NOT IN (0, 1, 2, 3)
           OR mc.`is_deleted` NOT IN (0, 1)
           OR c.`id` IS NULL
           OR m.`id` IS NULL
           OR (mc.`order_id` IS NOT NULL AND o.`id` IS NULL)
           OR (mc.`status` IN (0, 3) AND (mc.`order_id` IS NOT NULL OR mc.`used_at` IS NOT NULL))
           OR (mc.`status` = 1 AND (mc.`order_id` IS NULL OR mc.`used_at` IS NOT NULL))
           OR (mc.`status` = 2 AND (mc.`order_id` IS NULL OR mc.`used_at` IS NULL))
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'member_coupon 存在非法状态或孤儿关系';
    END IF;

    IF EXISTS (
        SELECT 1 FROM `biz_order` o
        LEFT JOIN `member_level` l ON l.`id` = o.`member_level_id`
        LEFT JOIN `member_coupon` mc ON mc.`id` = o.`member_coupon_id`
        WHERE (o.`member_level_id` IS NOT NULL AND l.`id` IS NULL)
           OR (o.`member_coupon_id` IS NOT NULL AND mc.`id` IS NULL)
           OR (mc.`id` IS NOT NULL AND mc.`member_id` <> o.`member_id`)
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'biz_order 存在无效等级、会员券或券归属';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'member_level'
          AND COLUMN_NAME = 'active_threshold_amount'
    ) THEN
        ALTER TABLE `member_level`
            ADD COLUMN `active_threshold_amount` int GENERATED ALWAYS AS (
                CASE WHEN `is_deleted` = 0 THEN `threshold_amount` ELSE NULL END
            ) STORED;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'member_level'
          AND INDEX_NAME = 'uk_member_level_active_threshold'
    ) THEN
        ALTER TABLE `member_level`
            ADD UNIQUE INDEX `uk_member_level_active_threshold` (`active_threshold_amount`);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'coupon_scope'
          AND COLUMN_NAME = 'active_coupon_id'
    ) THEN
        ALTER TABLE `coupon_scope`
            ADD COLUMN `active_coupon_id` bigint GENERATED ALWAYS AS (
                CASE WHEN `is_deleted` = 0 THEN `coupon_id` ELSE NULL END
            ) STORED;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'coupon_scope'
          AND INDEX_NAME = 'uk_coupon_scope'
    ) THEN
        ALTER TABLE `coupon_scope` DROP INDEX `uk_coupon_scope`;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'coupon_scope'
          AND INDEX_NAME = 'uk_coupon_scope_active'
    ) THEN
        ALTER TABLE `coupon_scope`
            ADD UNIQUE INDEX `uk_coupon_scope_active`
                (`active_coupon_id`, `target_type`, `target_id`);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'coupon_scope'
          AND INDEX_NAME = 'idx_coupon_scope_coupon_active'
    ) THEN
        ALTER TABLE `coupon_scope`
            ADD INDEX `idx_coupon_scope_coupon_active` (`coupon_id`, `is_deleted`);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'member_coupon'
          AND INDEX_NAME = 'idx_member_coupon_member_template'
    ) THEN
        ALTER TABLE `member_coupon`
            ADD INDEX `idx_member_coupon_member_template`
                (`member_id`, `coupon_id`, `is_deleted`);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_member_level'
    ) THEN
        ALTER TABLE `member`
            ADD CONSTRAINT `fk_member_level`
            FOREIGN KEY (`level_id`) REFERENCES `member_level` (`id`)
            ON UPDATE RESTRICT ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_points_member'
    ) THEN
        ALTER TABLE `member_points_log`
            ADD CONSTRAINT `fk_points_member`
            FOREIGN KEY (`member_id`) REFERENCES `member` (`id`)
            ON UPDATE RESTRICT ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_points_order'
    ) THEN
        ALTER TABLE `member_points_log`
            ADD CONSTRAINT `fk_points_order`
            FOREIGN KEY (`order_id`) REFERENCES `biz_order` (`id`)
            ON UPDATE RESTRICT ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_coupon_exchange_sku'
    ) THEN
        ALTER TABLE `coupon`
            ADD CONSTRAINT `fk_coupon_exchange_sku`
            FOREIGN KEY (`exchange_sku_id`) REFERENCES `product_sku` (`id`)
            ON UPDATE RESTRICT ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_coupon_scope_coupon'
    ) THEN
        ALTER TABLE `coupon_scope`
            ADD CONSTRAINT `fk_coupon_scope_coupon`
            FOREIGN KEY (`coupon_id`) REFERENCES `coupon` (`id`)
            ON UPDATE RESTRICT ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_member_coupon_coupon'
    ) THEN
        ALTER TABLE `member_coupon`
            ADD CONSTRAINT `fk_member_coupon_coupon`
            FOREIGN KEY (`coupon_id`) REFERENCES `coupon` (`id`)
            ON UPDATE RESTRICT ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_member_coupon_member'
    ) THEN
        ALTER TABLE `member_coupon`
            ADD CONSTRAINT `fk_member_coupon_member`
            FOREIGN KEY (`member_id`) REFERENCES `member` (`id`)
            ON UPDATE RESTRICT ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_member_coupon_order'
    ) THEN
        ALTER TABLE `member_coupon`
            ADD CONSTRAINT `fk_member_coupon_order`
            FOREIGN KEY (`order_id`) REFERENCES `biz_order` (`id`)
            ON UPDATE RESTRICT ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_order_member_level'
    ) THEN
        ALTER TABLE `biz_order`
            ADD CONSTRAINT `fk_order_member_level`
            FOREIGN KEY (`member_level_id`) REFERENCES `member_level` (`id`)
            ON UPDATE RESTRICT ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'member_level'
          AND CONSTRAINT_NAME = 'chk_member_level_threshold'
    ) THEN
        ALTER TABLE `member_level`
            ADD CONSTRAINT `chk_member_level_name` CHECK (CHAR_LENGTH(TRIM(`name`)) > 0),
            ADD CONSTRAINT `chk_member_level_threshold` CHECK (`threshold_amount` >= 0),
            ADD CONSTRAINT `chk_member_level_discount`
                CHECK (`discount_rate` BETWEEN 1 AND 10000),
            ADD CONSTRAINT `chk_member_level_status` CHECK (`status` IN (0, 1)),
            ADD CONSTRAINT `chk_member_level_is_deleted` CHECK (`is_deleted` IN (0, 1));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'member_points_log'
          AND CONSTRAINT_NAME = 'chk_points_balance'
    ) THEN
        ALTER TABLE `member_points_log`
            ADD CONSTRAINT `chk_points_balance` CHECK (`balance_after` >= 0),
            ADD CONSTRAINT `chk_points_biz_type` CHECK (`biz_type` IN (
                'INIT', 'ORDER_DEDUCT', 'ORDER_CANCEL_RETURN', 'ORDER_REFUND_RETURN', 'ORDER_EARN'
            )),
            ADD CONSTRAINT `chk_points_is_deleted` CHECK (`is_deleted` IN (0, 1));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'coupon'
          AND CONSTRAINT_NAME = 'chk_coupon_type'
    ) THEN
        ALTER TABLE `coupon`
            ADD CONSTRAINT `chk_coupon_name` CHECK (CHAR_LENGTH(TRIM(`name`)) > 0),
            ADD CONSTRAINT `chk_coupon_type`
                CHECK (`type` IN ('FULL_REDUCTION', 'DISCOUNT', 'EXCHANGE')),
            ADD CONSTRAINT `chk_coupon_scope_type`
                CHECK (`scope_type` IN ('ALL', 'CATEGORY', 'PRODUCT')),
            ADD CONSTRAINT `chk_coupon_amounts` CHECK (
                `threshold_amount` >= 0 AND `discount_amount` >= 0 AND
                `discount_rate` BETWEEN 1 AND 10000 AND
                (`max_discount_amount` IS NULL OR `max_discount_amount` >= 1)
            ),
            ADD CONSTRAINT `chk_coupon_times` CHECK (
                `claim_start` <= `claim_end` AND `valid_start` <= `valid_end` AND
                `claim_end` <= `valid_end`
            ),
            ADD CONSTRAINT `chk_coupon_quantities` CHECK (
                `total_quantity` >= 1 AND
                `issued_quantity` BETWEEN 0 AND `total_quantity` AND
                `per_member_limit` BETWEEN 1 AND `total_quantity`
            ),
            ADD CONSTRAINT `chk_coupon_exchange` CHECK (
                (`type` = 'FULL_REDUCTION' AND `discount_amount` > 0 AND `exchange_sku_id` IS NULL) OR
                (`type` = 'DISCOUNT' AND `discount_rate` < 10000 AND `exchange_sku_id` IS NULL) OR
                (`type` = 'EXCHANGE' AND `scope_type` = 'PRODUCT' AND `exchange_sku_id` IS NOT NULL)
            ),
            ADD CONSTRAINT `chk_coupon_status` CHECK (`status` IN (0, 1, 2)),
            ADD CONSTRAINT `chk_coupon_is_deleted` CHECK (`is_deleted` IN (0, 1));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'coupon_scope'
          AND CONSTRAINT_NAME = 'chk_coupon_scope_target_type'
    ) THEN
        ALTER TABLE `coupon_scope`
            ADD CONSTRAINT `chk_coupon_scope_target_type`
                CHECK (`target_type` IN ('CATEGORY', 'PRODUCT')),
            ADD CONSTRAINT `chk_coupon_scope_is_deleted` CHECK (`is_deleted` IN (0, 1));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'member_coupon'
          AND CONSTRAINT_NAME = 'chk_member_coupon_status'
    ) THEN
        ALTER TABLE `member_coupon`
            ADD CONSTRAINT `chk_member_coupon_status` CHECK (`status` IN (0, 1, 2, 3)),
            ADD CONSTRAINT `chk_member_coupon_state` CHECK (
                (`status` IN (0, 3) AND `order_id` IS NULL AND `used_at` IS NULL) OR
                (`status` = 1 AND `order_id` IS NOT NULL AND `used_at` IS NULL) OR
                (`status` = 2 AND `order_id` IS NOT NULL AND `used_at` IS NOT NULL)
            ),
            ADD CONSTRAINT `chk_member_coupon_is_deleted` CHECK (`is_deleted` IN (0, 1));
    END IF;
END$$

DELIMITER ;
CALL `migrate_marketing_hardening`();
DROP PROCEDURE `migrate_marketing_hardening`;
