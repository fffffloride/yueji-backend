-- Production upgrade from the original appointment table. No deletes or test seeds.
-- Existing appointments keep all original values. New scene/status fields use
-- CONSULTATION / BOOKED defaults; completion/cancellation history is not invented.
USE youlai_admin;
SET NAMES utf8mb4;

DROP PROCEDURE IF EXISTS migrate_appointment_lifecycle_preserve;
DELIMITER $$
CREATE PROCEDURE migrate_appointment_lifecycle_preserve()
BEGIN
    DECLARE found_columns int DEFAULT 0;
    SELECT COUNT(*) INTO found_columns
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='appointment'
      AND COLUMN_NAME IN ('scene_type','order_id','status','complete_time',
                          'cancel_time','cancel_reason','active_order_id','booked_member_slot_key');

    IF found_columns=0 THEN
        IF EXISTS (
            SELECT 1 FROM appointment WHERE is_deleted=0
            GROUP BY member_id,appointment_date,appointment_time HAVING COUNT(*)>1
        ) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Duplicate active appointment slots; review without deleting records';
        END IF;

        ALTER TABLE appointment
          ADD COLUMN scene_type varchar(20) NOT NULL DEFAULT 'CONSULTATION'
            COMMENT '预约场景(CONSULTATION-面诊 ORDER-订单)' AFTER appointment_time,
          ADD COLUMN order_id bigint NULL COMMENT '关联订单ID' AFTER scene_type,
          ADD COLUMN status tinyint NOT NULL DEFAULT 0
            COMMENT '预约状态(0-待到店 1-已完成 2-已取消)' AFTER order_id,
          ADD COLUMN complete_time datetime NULL COMMENT '服务完成时间' AFTER status,
          ADD COLUMN cancel_time datetime NULL COMMENT '取消时间' AFTER complete_time,
          ADD COLUMN cancel_reason varchar(255) NULL COMMENT '取消原因' AFTER cancel_time,
          ADD COLUMN active_order_id bigint GENERATED ALWAYS AS (
            CASE WHEN is_deleted=0 AND scene_type='ORDER' AND status IN (0,1)
              THEN order_id ELSE NULL END
          ) STORED COMMENT '非取消订单预约唯一键' AFTER is_deleted,
          ADD COLUMN booked_member_slot_key varchar(80) GENERATED ALWAYS AS (
            CASE WHEN is_deleted=0 AND status=0
              THEN CONCAT(member_id,'#',appointment_date,'#',appointment_time) ELSE NULL END
          ) STORED COMMENT '待到店会员时段唯一键' AFTER active_order_id,
          ADD UNIQUE INDEX uk_appointment_active_order (active_order_id),
          ADD UNIQUE INDEX uk_appointment_booked_member_slot (booked_member_slot_key),
          ADD INDEX idx_appointment_member_status_time (member_id,status,appointment_date,appointment_time),
          ADD INDEX idx_appointment_status_time (status,appointment_date,appointment_time),
          ADD INDEX idx_appointment_order_status (order_id,status),
          ADD CONSTRAINT chk_appointment_status CHECK (status IN (0,1,2)),
          ADD CONSTRAINT chk_appointment_scene_order CHECK (
            (scene_type='CONSULTATION' AND order_id IS NULL) OR
            (scene_type='ORDER' AND order_id IS NOT NULL)
          );
    ELSEIF found_columns<>8 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Partial appointment schema; inspect before continuing';
    END IF;

    -- Replace old uniqueness rules only after the new rules exist.
    IF (SELECT COUNT(DISTINCT INDEX_NAME) FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='appointment'
          AND INDEX_NAME IN ('uk_appointment_active_order','uk_appointment_booked_member_slot'))<>2 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Missing replacement appointment indexes';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.STATISTICS
               WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='appointment'
                 AND INDEX_NAME='uk_member_appointment_time') THEN
        ALTER TABLE appointment DROP INDEX uk_member_appointment_time;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.STATISTICS
               WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='appointment'
                 AND INDEX_NAME='uk_appointment_order_id') THEN
        ALTER TABLE appointment DROP INDEX uk_appointment_order_id;
    END IF;
END$$
DELIMITER ;
CALL migrate_appointment_lifecycle_preserve();
DROP PROCEDURE migrate_appointment_lifecycle_preserve;

CREATE TABLE IF NOT EXISTS appointment_operation_log (
    id bigint NOT NULL AUTO_INCREMENT COMMENT '操作日志ID',
    appointment_id bigint NOT NULL COMMENT '预约ID',
    action varchar(20) NOT NULL COMMENT '操作(CREATE/RESCHEDULE/CANCEL/COMPLETE)',
    operator_type varchar(20) NOT NULL COMMENT '操作者类型(MEMBER/ADMIN/SYSTEM)',
    operator_id bigint NULL COMMENT '会员或管理员ID',
    before_date date NULL COMMENT '操作前预约日期',
    before_time time NULL COMMENT '操作前预约时间',
    after_date date NULL COMMENT '操作后预约日期',
    after_time time NULL COMMENT '操作后预约时间',
    reason varchar(255) NULL COMMENT '操作原因',
    create_by bigint NULL COMMENT '创建人ID',
    create_time datetime NULL COMMENT '创建时间',
    update_by bigint NULL COMMENT '更新人ID',
    update_time datetime NULL COMMENT '更新时间',
    is_deleted tinyint NOT NULL DEFAULT 0 COMMENT '逻辑删除标识(0-未删除 1-已删除)',
    PRIMARY KEY (id),
    INDEX idx_appointment_operation_log_appointment (appointment_id,create_time,id),
    CONSTRAINT chk_appointment_operation_action CHECK (action IN ('CREATE','RESCHEDULE','CANCEL','COMPLETE')),
    CONSTRAINT chk_appointment_operator_type CHECK (operator_type IN ('MEMBER','ADMIN','SYSTEM')),
    CONSTRAINT chk_appointment_operation_is_deleted CHECK (is_deleted=0)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='预约操作日志';
