-- Reviewed legacy reconciliation: additive columns and widening only.
-- No login or RBAC behavior is changed. Never reset or seed business records.
DROP PROCEDURE IF EXISTS yueji_adopt_schema;
DELIMITER $$
CREATE PROCEDURE yueji_adopt_schema()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sys_user_social' AND COLUMN_NAME='create_by') THEN
    ALTER TABLE sys_user_social ADD COLUMN create_by bigint NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sys_user_social' AND COLUMN_NAME='update_by') THEN
    ALTER TABLE sys_user_social ADD COLUMN update_by bigint NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sys_user_social' AND COLUMN_NAME='is_deleted') THEN
    ALTER TABLE sys_user_social ADD COLUMN is_deleted tinyint NOT NULL DEFAULT 0;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sys_config' AND COLUMN_NAME='config_value' AND CHARACTER_MAXIMUM_LENGTH<500) THEN
    ALTER TABLE sys_config MODIFY config_value varchar(500) NOT NULL COMMENT '配置值';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sys_config' AND COLUMN_NAME='remark' AND CHARACTER_MAXIMUM_LENGTH<500) THEN
    ALTER TABLE sys_config MODIFY remark varchar(500) NULL COMMENT '备注';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sys_dict_item' AND COLUMN_NAME='dict_code' AND CHARACTER_MAXIMUM_LENGTH<64) THEN
    ALTER TABLE sys_dict_item MODIFY dict_code varchar(64) NULL COMMENT '字典编码';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sys_role' AND COLUMN_NAME='data_scope' AND DATA_TYPE='tinyint') THEN
    ALTER TABLE sys_role MODIFY data_scope int NULL COMMENT '数据权限';
  END IF;
END$$
DELIMITER ;
CALL yueji_adopt_schema();
DROP PROCEDURE yueji_adopt_schema;
