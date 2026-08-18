-- 阶段7：页面装修与拼团菜单
USE youlai_admin;

SET NAMES utf8mb4;

DELETE FROM `sys_role_menu` WHERE `menu_id` IN
  (3350,3351,3352,3353,3354,3355,3500,3501,3502,3503,3504,3505,3510,3511,3512,3513,3514,3520,3521,3522);
DELETE FROM `sys_menu` WHERE `id` IN
  (3355,3354,3353,3352,3351,3350,3522,3521,3520,3514,3513,3512,3511,3510,3505,3504,3503,3502,3501,3500);

INSERT INTO `sys_menu`
  (`id`,`parent_id`,`tree_path`,`name`,`type`,`route_name`,`route_path`,`component`,`perm`,
   `always_show`,`keep_alive`,`visible`,`sort`,`icon`,`redirect`,`create_time`,`update_time`,`params`)
VALUES
  (3350,3300,'0,3300','拼团管理','M','BizGroupBuy','groupbuy','marketing/groupbuy/index',NULL,0,1,1,3,'el-icon-UserFilled',NULL,NOW(),NOW(),NULL),
  (3351,3350,'0,3300,3350','活动查询','B',NULL,'',NULL,'biz:group-buy:activity:list',NULL,NULL,1,1,'',NULL,NOW(),NOW(),NULL),
  (3352,3350,'0,3300,3350','活动新增','B',NULL,'',NULL,'biz:group-buy:activity:create',NULL,NULL,1,2,'',NULL,NOW(),NOW(),NULL),
  (3353,3350,'0,3300,3350','活动编辑','B',NULL,'',NULL,'biz:group-buy:activity:update',NULL,NULL,1,3,'',NULL,NOW(),NOW(),NULL),
  (3354,3350,'0,3300,3350','活动删除','B',NULL,'',NULL,'biz:group-buy:activity:delete',NULL,NULL,1,4,'',NULL,NOW(),NOW(),NULL),
  (3355,3350,'0,3300,3350','拼团查询','B',NULL,'',NULL,'biz:group-buy:group:list',NULL,NULL,1,5,'',NULL,NOW(),NOW(),NULL),
  (3500,0,'0','页面管理','C','','/decoration','Layout',NULL,1,NULL,1,5,'el-icon-Brush','/decoration/banner',NOW(),NOW(),NULL),
  (3501,3500,'0,3500','Banner管理','M','BizDecorationBanner','banner','decoration/banner/index',NULL,0,1,1,1,'el-icon-Picture',NULL,NOW(),NOW(),NULL),
  (3502,3501,'0,3500,3501','Banner查询','B',NULL,'',NULL,'biz:decoration:banner:list',NULL,NULL,1,1,'',NULL,NOW(),NOW(),NULL),
  (3503,3501,'0,3500,3501','Banner新增','B',NULL,'',NULL,'biz:decoration:banner:create',NULL,NULL,1,2,'',NULL,NOW(),NOW(),NULL),
  (3504,3501,'0,3500,3501','Banner编辑','B',NULL,'',NULL,'biz:decoration:banner:update',NULL,NULL,1,3,'',NULL,NOW(),NOW(),NULL),
  (3505,3501,'0,3500,3501','Banner删除','B',NULL,'',NULL,'biz:decoration:banner:delete',NULL,NULL,1,4,'',NULL,NOW(),NOW(),NULL),
  (3510,3500,'0,3500','公告管理','M','BizDecorationNotice','notice','decoration/notice/index',NULL,0,1,1,2,'el-icon-Bell',NULL,NOW(),NOW(),NULL),
  (3511,3510,'0,3500,3510','公告查询','B',NULL,'',NULL,'biz:decoration:notice:list',NULL,NULL,1,1,'',NULL,NOW(),NOW(),NULL),
  (3512,3510,'0,3500,3510','公告新增','B',NULL,'',NULL,'biz:decoration:notice:create',NULL,NULL,1,2,'',NULL,NOW(),NOW(),NULL),
  (3513,3510,'0,3500,3510','公告编辑','B',NULL,'',NULL,'biz:decoration:notice:update',NULL,NULL,1,3,'',NULL,NOW(),NOW(),NULL),
  (3514,3510,'0,3500,3510','公告删除','B',NULL,'',NULL,'biz:decoration:notice:delete',NULL,NULL,1,4,'',NULL,NOW(),NOW(),NULL),
  (3520,3500,'0,3500','品牌背书','M','BizDecorationBrand','brand','decoration/brand/index',NULL,0,1,1,3,'el-icon-EditPen',NULL,NOW(),NOW(),NULL),
  (3521,3520,'0,3500,3520','品牌查询','B',NULL,'',NULL,'biz:decoration:brand:list',NULL,NULL,1,1,'',NULL,NOW(),NOW(),NULL),
  (3522,3520,'0,3500,3520','品牌编辑','B',NULL,'',NULL,'biz:decoration:brand:update',NULL,NULL,1,2,'',NULL,NOW(),NOW(),NULL);

INSERT INTO `sys_role_menu` (`role_id`,`menu_id`)
SELECT roles.role_id, menus.menu_id
FROM (SELECT 1 role_id UNION ALL SELECT 2) roles
CROSS JOIN (
  SELECT 3350 menu_id UNION ALL SELECT 3351 UNION ALL SELECT 3352 UNION ALL SELECT 3353 UNION ALL SELECT 3354 UNION ALL SELECT 3355
  UNION ALL SELECT 3500 UNION ALL SELECT 3501 UNION ALL SELECT 3502 UNION ALL SELECT 3503 UNION ALL SELECT 3504 UNION ALL SELECT 3505
  UNION ALL SELECT 3510 UNION ALL SELECT 3511 UNION ALL SELECT 3512 UNION ALL SELECT 3513 UNION ALL SELECT 3514
  UNION ALL SELECT 3520 UNION ALL SELECT 3521 UNION ALL SELECT 3522
) menus;

