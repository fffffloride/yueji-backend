SET NAMES utf8mb4;

SET @agreement_type_label_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'agreement'
    AND COLUMN_NAME = 'type_label'
);

SET @agreement_type_label_ddl := IF(
  @agreement_type_label_exists = 0,
  'ALTER TABLE `agreement` ADD COLUMN `type_label` varchar(50) NULL AFTER `type`',
  'SELECT 1'
);

PREPARE agreement_type_label_stmt FROM @agreement_type_label_ddl;
EXECUTE agreement_type_label_stmt;
DEALLOCATE PREPARE agreement_type_label_stmt;

UPDATE `agreement`
SET `type_label` = CASE `type`
  WHEN 'USER_AGREEMENT' THEN '用户协议'
  WHEN 'PRIVACY_POLICY' THEN '隐私政策'
  WHEN 'MEDICAL_INFORMED_CONSENT' THEN '用户就诊告知及知情同意书'
  WHEN 'ACCOUNT_CANCELLATION_NOTICE' THEN '注销须知'
  WHEN 'ABOUT_US' THEN '关于我们'
  ELSE IFNULL(NULLIF(TRIM(`type_label`), ''), `draft_title`)
END
WHERE `is_deleted` = 0
  AND (
    `type_label` IS NULL
    OR TRIM(`type_label`) = ''
    OR `type_label` REGEXP '^\\?+$'
    OR `type` IN (
      'USER_AGREEMENT',
      'PRIVACY_POLICY',
      'MEDICAL_INFORMED_CONSENT',
      'ACCOUNT_CANCELLATION_NOTICE',
      'ABOUT_US'
    )
  );

ALTER TABLE `agreement`
  MODIFY COLUMN `type_label` varchar(50) NOT NULL;

INSERT INTO `agreement`
  (`type`,`type_label`,`draft_title`,`draft_content`,`published_title`,`published_content`,`publish_time`,`create_time`,`update_time`,`is_deleted`)
SELECT
  'ACCOUNT_CANCELLATION_NOTICE','注销须知','注销须知',
  '<p>请在管理后台编辑并发布注销须知。</p>',
  '注销须知','<p>请在管理后台编辑并发布注销须知。</p>',NOW(),NOW(),NOW(),0
WHERE NOT EXISTS (
  SELECT 1 FROM `agreement`
  WHERE `type`='ACCOUNT_CANCELLATION_NOTICE' AND `is_deleted`=0
);

INSERT INTO `agreement`
  (`type`,`type_label`,`draft_title`,`draft_content`,`published_title`,`published_content`,`publish_time`,`create_time`,`update_time`,`is_deleted`)
SELECT
  'ABOUT_US','关于我们','关于我们',
  '<p>请在管理后台编辑并发布关于我们。</p>',
  '关于我们','<p>请在管理后台编辑并发布关于我们。</p>',NOW(),NOW(),NOW(),0
WHERE NOT EXISTS (
  SELECT 1 FROM `agreement`
  WHERE `type`='ABOUT_US' AND `is_deleted`=0
);

UPDATE `agreement`
SET
  `type_label` = '注销须知',
  `draft_title` = '注销须知',
  `draft_content` = '<p>请在管理后台编辑并发布注销须知。</p>'
WHERE `type` = 'ACCOUNT_CANCELLATION_NOTICE'
  AND `is_deleted` = 0
  AND `draft_title` REGEXP '^\\?+$';

UPDATE `agreement`
SET
  `type_label` = '关于我们',
  `draft_title` = '关于我们',
  `draft_content` = '<p>请在管理后台编辑并发布关于我们。</p>'
WHERE `type` = 'ABOUT_US'
  AND `is_deleted` = 0
  AND `draft_title` REGEXP '^\\?+$';

UPDATE `agreement`
SET
  `published_title` = IFNULL(`published_title`, `draft_title`),
  `published_content` = IFNULL(`published_content`, `draft_content`),
  `publish_time` = IFNULL(`publish_time`, NOW())
WHERE `type` IN ('ACCOUNT_CANCELLATION_NOTICE', 'ABOUT_US')
  AND `is_deleted` = 0
  AND (`published_title` IS NULL OR `published_content` IS NULL);

INSERT INTO `sys_menu`
  (`id`,`parent_id`,`tree_path`,`name`,`type`,`route_name`,`route_path`,`component`,`perm`,
   `always_show`,`keep_alive`,`visible`,`sort`,`icon`,`redirect`,`create_time`,`update_time`,`params`)
SELECT
  3534,3530,'0,3500,3530','协议新增','B',NULL,'',NULL,'content:agreement:create',
  NULL,NULL,1,4,'',NULL,NOW(),NOW(),NULL
WHERE NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `id`=3534);

UPDATE `sys_menu`
SET `name` = '协议新增'
WHERE `id` = 3534;

INSERT INTO `sys_role_menu` (`role_id`,`menu_id`)
SELECT roles.role_id,3534
FROM (SELECT 1 role_id UNION ALL SELECT 2) roles
WHERE NOT EXISTS (
  SELECT 1 FROM `sys_role_menu`
  WHERE `role_id`=roles.role_id AND `menu_id`=3534
);
