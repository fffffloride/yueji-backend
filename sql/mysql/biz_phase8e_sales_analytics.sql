-- 悦己阶段8E：销售统计查询索引（可重复执行）
USE youlai_admin;

SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `biz_order` ADD INDEX `idx_biz_order_status_verify` (`status`,`verify_time`)',
    'DO 1')
  FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'biz_order'
    AND index_name = 'idx_biz_order_status_verify'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `distribution_direct_sales` ADD INDEX `idx_direct_sales_status_applied` (`status`,`applied_time`)',
    'DO 1')
  FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'distribution_direct_sales'
    AND index_name = 'idx_direct_sales_status_applied'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `distribution_direct_sales` ADD INDEX `idx_direct_sales_agent_status_applied` (`agent_id`,`status`,`applied_time`)',
    'DO 1')
  FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'distribution_direct_sales'
    AND index_name = 'idx_direct_sales_agent_status_applied'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
