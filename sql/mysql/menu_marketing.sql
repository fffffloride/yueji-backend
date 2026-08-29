-- 阶段5：会员等级、积分、优惠券菜单
USE youlai_admin;

SET NAMES utf8mb4;

INSERT INTO `sys_menu` (`id`,`parent_id`,`tree_path`,`name`,`type`,`route_name`,`route_path`,`component`,`perm`,`always_show`,`keep_alive`,`visible`,`sort`,`icon`,`redirect`,`create_time`,`update_time`,`params`) VALUES
(3210,3200,'0,3200','会员等级','M','BizMemberLevel','level','member/level/index',NULL,0,1,1,2,'el-icon-Medal',NULL,now(),now(),NULL),
(3211,3210,'0,3200,3210','等级查询','B',NULL,'',NULL,'biz:member-level:list',NULL,NULL,1,1,'',NULL,now(),now(),NULL),
(3212,3210,'0,3200,3210','等级新增','B',NULL,'',NULL,'biz:member-level:create',NULL,NULL,1,2,'',NULL,now(),now(),NULL),
(3213,3210,'0,3200,3210','等级编辑','B',NULL,'',NULL,'biz:member-level:update',NULL,NULL,1,3,'',NULL,now(),now(),NULL),
(3214,3210,'0,3200,3210','等级删除','B',NULL,'',NULL,'biz:member-level:delete',NULL,NULL,1,4,'',NULL,now(),now(),NULL),
(3300,0,'0','营销管理','C','','/marketing','Layout',NULL,1,NULL,1,3,'el-icon-Present','/marketing/points',now(),now(),NULL),
(3301,3300,'0,3300','积分管理','M','BizPoints','points','marketing/points/index',NULL,0,1,1,1,'el-icon-Coin',NULL,now(),now(),NULL),
(3302,3301,'0,3300,3301','积分查询','B',NULL,'',NULL,'biz:points:list',NULL,NULL,1,1,'',NULL,now(),now(),NULL),
(3303,3301,'0,3300,3301','积分规则','B',NULL,'',NULL,'biz:points:rule',NULL,NULL,1,2,'',NULL,now(),now(),NULL),
(3310,3300,'0,3300','优惠券管理','M','BizCoupon','coupon','marketing/coupon/index',NULL,0,1,1,2,'el-icon-Ticket',NULL,now(),now(),NULL),
(3311,3310,'0,3300,3310','优惠券查询','B',NULL,'',NULL,'biz:coupon:list',NULL,NULL,1,1,'',NULL,now(),now(),NULL),
(3312,3310,'0,3300,3310','优惠券新增','B',NULL,'',NULL,'biz:coupon:create',NULL,NULL,1,2,'',NULL,now(),now(),NULL),
(3313,3310,'0,3300,3310','优惠券编辑','B',NULL,'',NULL,'biz:coupon:update',NULL,NULL,1,3,'',NULL,now(),now(),NULL),
(3314,3310,'0,3300,3310','优惠券删除','B',NULL,'',NULL,'biz:coupon:delete',NULL,NULL,1,4,'',NULL,now(),now(),NULL),
(3315,3310,'0,3300,3310','优惠券发放','B',NULL,'',NULL,'biz:coupon:issue',NULL,NULL,1,5,'',NULL,now(),now(),NULL);

INSERT INTO `sys_role_menu` (`role_id`,`menu_id`)
SELECT role_id, menu_id
FROM (SELECT 1 role_id UNION ALL SELECT 2) roles
CROSS JOIN (
    SELECT 3210 menu_id UNION ALL SELECT 3211 UNION ALL SELECT 3212 UNION ALL SELECT 3213 UNION ALL SELECT 3214
    UNION ALL SELECT 3300 UNION ALL SELECT 3301 UNION ALL SELECT 3302 UNION ALL SELECT 3303
    UNION ALL SELECT 3310 UNION ALL SELECT 3311 UNION ALL SELECT 3312 UNION ALL SELECT 3313 UNION ALL SELECT 3314 UNION ALL SELECT 3315
) menus;
