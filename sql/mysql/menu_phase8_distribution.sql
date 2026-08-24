-- 阶段8A+8B：分销管理菜单
-- 执行后清除 Redis Hash `system:role:perms` 的 ADMIN 字段，避免命中旧权限缓存。
USE youlai_admin;

SET NAMES utf8mb4;

DELETE FROM `sys_role_menu` WHERE `menu_id` IN
  (3600,3610,3611,3612,3613,3614,3620,3621,3622,3623,3624,
   3630,3631,3632,3633,3634,3640,3641,3650,3651);
DELETE FROM `sys_menu` WHERE `id` IN
  (3611,3612,3613,3614,3610,3621,3622,3623,3624,3620,
   3631,3632,3633,3634,3630,3641,3640,3651,3650,3600);

INSERT INTO `sys_menu`
  (`id`,`parent_id`,`tree_path`,`name`,`type`,`route_name`,`route_path`,`component`,`perm`,
   `always_show`,`keep_alive`,`visible`,`sort`,`icon`,`redirect`,`create_time`,`update_time`,`params`)
VALUES
  (3600,0,'0','分销管理','C','','/distribution','Layout',NULL,1,NULL,1,6,'el-icon-Share','/distribution/agent',NOW(),NOW(),NULL),
  (3610,3600,'0,3600','代理类型','M','BizDistributionType','type','distribution/type/index',NULL,0,1,1,1,'el-icon-CollectionTag',NULL,NOW(),NOW(),NULL),
  (3611,3610,'0,3600,3610','类型查询','B',NULL,'',NULL,'biz:distribution:type:list',NULL,NULL,1,1,'',NULL,NOW(),NOW(),NULL),
  (3612,3610,'0,3600,3610','类型新增','B',NULL,'',NULL,'biz:distribution:type:create',NULL,NULL,1,2,'',NULL,NOW(),NOW(),NULL),
  (3613,3610,'0,3600,3610','类型编辑','B',NULL,'',NULL,'biz:distribution:type:update',NULL,NULL,1,3,'',NULL,NOW(),NOW(),NULL),
  (3614,3610,'0,3600,3610','类型删除','B',NULL,'',NULL,'biz:distribution:type:delete',NULL,NULL,1,4,'',NULL,NOW(),NOW(),NULL),
  (3620,3600,'0,3600','分销等级','M','BizDistributionLevel','level','distribution/level/index',NULL,0,1,1,2,'el-icon-Histogram',NULL,NOW(),NOW(),NULL),
  (3621,3620,'0,3600,3620','等级查询','B',NULL,'',NULL,'biz:distribution:level:list',NULL,NULL,1,1,'',NULL,NOW(),NOW(),NULL),
  (3622,3620,'0,3600,3620','等级新增','B',NULL,'',NULL,'biz:distribution:level:create',NULL,NULL,1,2,'',NULL,NOW(),NOW(),NULL),
  (3623,3620,'0,3600,3620','等级编辑','B',NULL,'',NULL,'biz:distribution:level:update',NULL,NULL,1,3,'',NULL,NOW(),NOW(),NULL),
  (3624,3620,'0,3600,3620','等级删除','B',NULL,'',NULL,'biz:distribution:level:delete',NULL,NULL,1,4,'',NULL,NOW(),NOW(),NULL),
  (3630,3600,'0,3600','代理商','M','BizDistributionAgent','agent','distribution/agent/index',NULL,0,1,1,3,'el-icon-UserFilled',NULL,NOW(),NOW(),NULL),
  (3631,3630,'0,3600,3630','代理查询','B',NULL,'',NULL,'biz:distribution:agent:list',NULL,NULL,1,1,'',NULL,NOW(),NOW(),NULL),
  (3632,3630,'0,3600,3630','代理新增','B',NULL,'',NULL,'biz:distribution:agent:create',NULL,NULL,1,2,'',NULL,NOW(),NOW(),NULL),
  (3633,3630,'0,3600,3630','代理编辑','B',NULL,'',NULL,'biz:distribution:agent:update',NULL,NULL,1,3,'',NULL,NOW(),NOW(),NULL),
  (3634,3630,'0,3600,3630','代理审核','B',NULL,'',NULL,'biz:distribution:agent:audit',NULL,NULL,1,4,'',NULL,NOW(),NOW(),NULL),
  (3640,3600,'0,3600','团队结构','M','BizDistributionTeam','team','distribution/team/index',NULL,0,1,1,4,'el-icon-Share',NULL,NOW(),NOW(),NULL),
  (3641,3640,'0,3600,3640','团队查询','B',NULL,'',NULL,'biz:distribution:team:list',NULL,NULL,1,1,'',NULL,NOW(),NOW(),NULL),
  (3650,3600,'0,3600','佣金明细','M','BizDistributionCommission','commission','distribution/commission/index',NULL,0,1,1,5,'el-icon-Coin',NULL,NOW(),NOW(),NULL),
  (3651,3650,'0,3600,3650','佣金查询','B',NULL,'',NULL,'biz:distribution:commission:list',NULL,NULL,1,1,'',NULL,NOW(),NOW(),NULL);

INSERT INTO `sys_role_menu` (`role_id`,`menu_id`)
SELECT roles.role_id, menus.menu_id
FROM (SELECT 1 role_id UNION ALL SELECT 2) roles
CROSS JOIN (
  SELECT 3600 menu_id UNION ALL SELECT 3610 UNION ALL SELECT 3611 UNION ALL SELECT 3612 UNION ALL SELECT 3613 UNION ALL SELECT 3614
  UNION ALL SELECT 3620 UNION ALL SELECT 3621 UNION ALL SELECT 3622 UNION ALL SELECT 3623 UNION ALL SELECT 3624
  UNION ALL SELECT 3630 UNION ALL SELECT 3631 UNION ALL SELECT 3632 UNION ALL SELECT 3633 UNION ALL SELECT 3634
  UNION ALL SELECT 3640 UNION ALL SELECT 3641 UNION ALL SELECT 3650 UNION ALL SELECT 3651
) menus;
