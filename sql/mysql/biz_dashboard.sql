-- 管理端仪表盘真实访问统计
USE youlai_admin;

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `app_visit_daily` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `visit_date` date NOT NULL COMMENT '访问日期',
  `visitor_id` varchar(36) NOT NULL COMMENT '匿名访客UUID',
  `pv_count` int NOT NULL DEFAULT 1 COMMENT '当日页面浏览量',
  `first_visit_time` datetime NOT NULL COMMENT '当日首次访问时间',
  `last_visit_time` datetime NOT NULL COMMENT '当日最近访问时间',
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_app_visit_daily_date_visitor` (`visit_date`, `visitor_id`),
  INDEX `idx_app_visit_daily_date` (`visit_date`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='小程序每日访客统计';
