-- Baseline source: youlai_admin.sql

# YouLai_Admin 数据库(MySQL 5.7 ~ MySQL 8.x)
# Copyright (c) 2021-present, youlai.tech


-- ----------------------------
-- 1. 创建数据库
-- ----------------------------
CREATE DATABASE IF NOT EXISTS youlai_admin CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci;


-- ----------------------------
-- 2. 创建表 && 数据初始化 
-- ----------------------------
USE youlai_admin;

SET NAMES utf8mb4;  # 设置字符集
SET FOREIGN_KEY_CHECKS = 0; # 关闭外键检查，加快导入速度

-- ----------------------------
-- Table structure for sys_dept
-- ----------------------------
DROP TABLE IF EXISTS `sys_dept`;
CREATE TABLE `sys_dept`  (
                             `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
                             `name` varchar(100) NOT NULL COMMENT '部门名称',
                             `code` varchar(100) NOT NULL COMMENT '部门编号',
                             `parent_id` bigint DEFAULT 0 COMMENT '父节点id',
                             `tree_path` varchar(255) NOT NULL COMMENT '父节点id路径',
                             `sort` smallint DEFAULT 0 COMMENT '显示顺序',
                             `status` tinyint DEFAULT 1 COMMENT '状态(1-正常 0-禁用)',
                             `create_by` bigint NULL COMMENT '创建人ID',
                             `create_time` datetime NULL COMMENT '创建时间',
                             `update_by` bigint NULL COMMENT '修改人ID',
                             `update_time` datetime NULL COMMENT '更新时间',
                             `is_deleted` tinyint DEFAULT 0 COMMENT '逻辑删除标识(1-已删除 0-未删除)',
                             PRIMARY KEY (`id`) USING BTREE,
                             UNIQUE INDEX `uk_code`(`code` ASC) USING BTREE COMMENT '部门编号唯一索引'
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COMMENT = '部门管理表';

-- ----------------------------
-- Records of sys_dept
-- ----------------------------
INSERT INTO `sys_dept` VALUES (1, '有来技术', 'YOULAI', 0, '0', 1, 1, 1, NULL, 1, now(), 0);
INSERT INTO `sys_dept` VALUES (2, '研发部门', 'RD001', 1, '0,1', 1, 1, 2, NULL, 2, now(), 0);
INSERT INTO `sys_dept` VALUES (3, '测试部门', 'QA001', 1, '0,1', 1, 1, 2, NULL, 2, now(), 0);

-- ----------------------------
-- Table structure for sys_dict
-- ----------------------------
DROP TABLE IF EXISTS `sys_dict`;
CREATE TABLE `sys_dict` (
                            `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键 ',
                            `dict_code` varchar(50) COMMENT '类型编码',
                            `name` varchar(50) COMMENT '类型名称',
                            `status` tinyint(1) DEFAULT '0' COMMENT '状态(0:正常;1:禁用)',
                            `remark` varchar(255) COMMENT '备注',
                            `create_time` datetime COMMENT '创建时间',
                            `create_by` bigint COMMENT '创建人ID',
                            `update_time` datetime COMMENT '更新时间',
                            `update_by` bigint COMMENT '修改人ID',
                            `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除(1-删除，0-未删除)',
                            PRIMARY KEY (`id`) USING BTREE,
                            KEY `idx_dict_code` (`dict_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据字典类型表';
-- ----------------------------
-- Records of sys_dict
-- ----------------------------
INSERT INTO `sys_dict` VALUES (1, 'gender', '性别', 1, NULL, now() , 1,now(), 1,0);
INSERT INTO `sys_dict` VALUES (2, 'notice_type', '通知类型', 1, NULL, now(), 1,now(), 1,0);
INSERT INTO `sys_dict` VALUES (3, 'notice_level', '通知级别', 1, NULL, now(), 1,now(), 1,0);


-- ----------------------------
-- Table structure for sys_dict_item
-- ----------------------------
DROP TABLE IF EXISTS `sys_dict_item`;
CREATE TABLE `sys_dict_item` (
                                 `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
                                 `dict_code` varchar(50) COMMENT '关联字典编码，与sys_dict表中的dict_code对应',
                                 `value` varchar(50) COMMENT '字典项值',
                                 `label` varchar(100) COMMENT '字典项标签',
                                 `tag_type` varchar(50) COMMENT '标签类型，用于前端样式展示（如success、warning等）',
                                 `status` tinyint DEFAULT '0' COMMENT '状态（1-正常，0-禁用）',
                                 `sort` int DEFAULT '0' COMMENT '排序',
                                 `remark` varchar(255) COMMENT '备注',
                                 `create_time` datetime COMMENT '创建时间',
                                 `create_by` bigint COMMENT '创建人ID',
                                 `update_time` datetime COMMENT '更新时间',
                                 `update_by` bigint COMMENT '修改人ID',
                                 PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据字典项表';

-- ----------------------------
-- Records of sys_dict_item
-- ----------------------------
INSERT INTO `sys_dict_item` VALUES (1, 'gender', '1', '男', 'primary', 1, 1, NULL, now(), 1,now(),1);
INSERT INTO `sys_dict_item` VALUES (2, 'gender', '2', '女', 'danger', 1, 2, NULL, now(), 1,now(),1);
INSERT INTO `sys_dict_item` VALUES (3, 'gender', '0', '保密', 'info', 1, 3, NULL, now(), 1,now(),1);
INSERT INTO `sys_dict_item` VALUES (4, 'notice_type', '1', '系统升级', 'success', 1, 1, '', now(), 1,now(),1);
INSERT INTO `sys_dict_item` VALUES (5, 'notice_type', '2', '系统维护', 'primary', 1, 2, '', now(), 1,now(),1);
INSERT INTO `sys_dict_item` VALUES (6, 'notice_type', '3', '安全警告', 'danger', 1, 3, '', now(), 1,now(),1);
INSERT INTO `sys_dict_item` VALUES (7, 'notice_type', '4', '假期通知', 'success', 1, 4, '', now(), 1,now(),1);
INSERT INTO `sys_dict_item` VALUES (8, 'notice_type', '5', '公司新闻', 'primary', 1, 5, '', now(), 1,now(),1);
INSERT INTO `sys_dict_item` VALUES (9, 'notice_type', '99', '其他', 'info', 1, 99, '', now(), 1,now(),1);
INSERT INTO `sys_dict_item` VALUES (10, 'notice_level', 'L', '低', 'info', 1, 1, '', now(), 1,now(),1);
INSERT INTO `sys_dict_item` VALUES (11, 'notice_level', 'M', '中', 'warning', 1, 2, '', now(), 1,now(),1);
INSERT INTO `sys_dict_item` VALUES (12, 'notice_level', 'H', '高', 'danger', 1, 3, '', now(), 1,now(),1);

-- ----------------------------
-- Table structure for sys_menu
-- ----------------------------
DROP TABLE IF EXISTS `sys_menu`;
CREATE TABLE `sys_menu`  (
                             `id` bigint NOT NULL AUTO_INCREMENT COMMENT 'ID',
                             `parent_id` bigint NOT NULL COMMENT '父菜单ID',
                             `tree_path` varchar(255) COMMENT '父节点ID路径',
                             `name` varchar(64) NOT NULL COMMENT '菜单名称',
                             `type` char(1) NOT NULL COMMENT '菜单类型（C-目录 M-菜单 E-外链 B-按钮）',
                             `route_name` varchar(255) COMMENT '路由名称（Vue Router 中用于命名路由）',
                             `route_path` varchar(128) COMMENT '路由路径（Vue Router 中定义的 URL 路径）',
                             `component` varchar(128) COMMENT '组件路径（组件页面完整路径，相对于 src/views/，缺省后缀 .vue）',
                             `external_url` varchar(512) COMMENT '外链地址',
                             `perm` varchar(128) COMMENT '【按钮】权限标识',
                             `always_show` tinyint DEFAULT 0 COMMENT '【目录】只有一个子路由是否始终显示（1-是 0-否）',
                             `keep_alive` tinyint DEFAULT 0 COMMENT '【菜单】是否开启页面缓存（1-是 0-否）',
                             `visible` tinyint(1) DEFAULT 1 COMMENT '显示状态（1-显示 0-隐藏）',
                             `sort` int DEFAULT 0 COMMENT '排序',
                             `icon` varchar(64) COMMENT '菜单图标',
                             `redirect` varchar(128) COMMENT '跳转路径',
                             `create_time` datetime NULL COMMENT '创建时间',
                             `update_time` datetime NULL COMMENT '更新时间',
                             `params` json NULL COMMENT '路由参数',
                             PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COMMENT = '系统菜单表';

-- ----------------------------
-- Records of sys_menu
-- ----------------------------
-- 顶级目录：系统
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (1, 0, '0', '系统管理', 'C', '', '/system', 'Layout', NULL, NULL, NULL, 1, 1, 'system', '/system/user', now(), now(), NULL);

-- 系统管理
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (210, 1, '0,1', '用户管理', 'M', 'User', 'user', 'system/user/index', NULL, NULL, 1, 1, 1, 'el-icon-User', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2101, 210, '0,1,210', '用户查询', 'B', NULL, '', NULL, 'sys:user:list', NULL, NULL, 1, 1, '', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2102, 210, '0,1,210', '用户新增', 'B', NULL, '', NULL, 'sys:user:create', NULL, NULL, 1, 2, '', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2103, 210, '0,1,210', '用户编辑', 'B', NULL, '', NULL, 'sys:user:update', NULL, NULL, 1, 3, '', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2104, 210, '0,1,210', '用户删除', 'B', NULL, '', NULL, 'sys:user:delete', NULL, NULL, 1, 4, '', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2105, 210, '0,1,210', '重置密码', 'B', NULL, '', NULL, 'sys:user:reset-password', NULL, NULL, 1, 5, '', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2106, 210, '0,1,210', '用户导入', 'B', NULL, '', NULL, 'sys:user:import', NULL, NULL, 1, 6, '', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2107, 210, '0,1,210', '用户导出', 'B', NULL, '', NULL, 'sys:user:export', NULL, NULL, 1, 7, '', NULL, now(), now(), NULL);

INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (220, 1, '0,1', '角色管理', 'M', 'Role', 'role', 'system/role/index', NULL, NULL, 1, 1, 2, 'role', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2201, 220, '0,1,220', '角色查询', 'B', NULL, '', NULL, 'sys:role:list', NULL, NULL, 1, 1, '', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2202, 220, '0,1,220', '角色新增', 'B', NULL, '', NULL, 'sys:role:create', NULL, NULL, 1, 2, '', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2203, 220, '0,1,220', '角色编辑', 'B', NULL, '', NULL, 'sys:role:update', NULL, NULL, 1, 3, '', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2204, 220, '0,1,220', '角色删除', 'B', NULL, '', NULL, 'sys:role:delete', NULL, NULL, 1, 4, '', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2205, 220, '0,1,220', '角色分配权限', 'B', NULL, '', NULL, 'sys:role:assign', NULL, NULL, 1, 5, '', NULL, now(), now(), NULL);

INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (230, 1, '0,1', '菜单管理', 'M', 'SysMenu', 'menu', 'system/menu/index', NULL, NULL, 1, 1, 3, 'menu', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2301, 230, '0,1,230', '菜单查询', 'B', NULL, '', NULL, 'sys:menu:list', NULL, NULL, 1, 1, '', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2302, 230, '0,1,230', '菜单新增', 'B', NULL, '', NULL, 'sys:menu:create', NULL, NULL, 1, 2, '', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2303, 230, '0,1,230', '菜单编辑', 'B', NULL, '', NULL, 'sys:menu:update', NULL, NULL, 1, 3, '', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2304, 230, '0,1,230', '菜单删除', 'B', NULL, '', NULL, 'sys:menu:delete', NULL, NULL, 1, 4, '', NULL, now(), now(), NULL);

INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (240, 1, '0,1', '部门管理', 'M', 'Dept', 'dept', 'system/dept/index', NULL, NULL, 1, 1, 4, 'tree', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2401, 240, '0,1,240', '部门查询', 'B', NULL, '', NULL, 'sys:dept:list', NULL, NULL, 1, 1, '', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2402, 240, '0,1,240', '部门新增', 'B', NULL, '', NULL, 'sys:dept:create', NULL, NULL, 1, 2, '', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2403, 240, '0,1,240', '部门编辑', 'B', NULL, '', NULL, 'sys:dept:update', NULL, NULL, 1, 3, '', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2404, 240, '0,1,240', '部门删除', 'B', NULL, '', NULL, 'sys:dept:delete', NULL, NULL, 1, 4, '', NULL, now(), now(), NULL);

INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (250, 1, '0,1', '字典管理', 'M', 'Dict', 'dict', 'system/dict/index', NULL, NULL, 1, 0, 5, 'dict', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2501, 250, '0,1,250', '字典查询', 'B', NULL, '', NULL, 'sys:dict:list', NULL, NULL, 1, 1, '', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2502, 250, '0,1,250', '字典新增', 'B', NULL, '', NULL, 'sys:dict:create', NULL, NULL, 1, 2, '', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2503, 250, '0,1,250', '字典编辑', 'B', NULL, '', NULL, 'sys:dict:update', NULL, NULL, 1, 3, '', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2504, 250, '0,1,250', '字典删除', 'B', NULL, '', NULL, 'sys:dict:delete', NULL, NULL, 1, 4, '', NULL, now(), now(), NULL);

INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (251, 1, '0,1', '字典项', 'M', 'DictItem', 'dict-item', 'system/dict/dict-item', NULL, 0, 1, 0, 6, '', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2511, 251, '0,1,251', '字典项查询', 'B', NULL, '', NULL, 'sys:dict-item:list', NULL, NULL, 1, 1, '', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2512, 251, '0,1,251', '字典项新增', 'B', NULL, '', NULL, 'sys:dict-item:create', NULL, NULL, 1, 2, '', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2513, 251, '0,1,251', '字典项编辑', 'B', NULL, '', NULL, 'sys:dict-item:update', NULL, NULL, 1, 3, '', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2514, 251, '0,1,251', '字典项删除', 'B', NULL, '', NULL, 'sys:dict-item:delete', NULL, NULL, 1, 4, '', NULL, now(), now(), NULL);

INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (260, 1, '0,1', '系统日志', 'M', 'Log', 'log', 'system/log/index', NULL, 0, 1, 0, 7, 'document', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2601, 260, '0,1,260', '日志查询', 'B', NULL, '', NULL, 'sys:log:list', NULL, NULL, 1, 1, '', NULL, now(), now(), NULL);

INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (270, 1, '0,1', '系统配置', 'M', 'Config', 'config', 'system/config/index', NULL, 0, 1, 0, 8, 'setting', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2701, 270, '0,1,270', '系统配置查询', 'B', NULL, '', NULL, 'sys:config:list', 0, 1, 1, 1, '', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2702, 270, '0,1,270', '系统配置新增', 'B', NULL, '', NULL, 'sys:config:create', 0, 1, 1, 2, '', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2703, 270, '0,1,270', '系统配置修改', 'B', NULL, '', NULL, 'sys:config:update', 0, 1, 1, 3, '', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2704, 270, '0,1,270', '系统配置删除', 'B', NULL, '', NULL, 'sys:config:delete', 0, 1, 1, 4, '', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2705, 270, '0,1,270', '系统配置刷新', 'B', NULL, '', NULL, 'sys:config:refresh', 0, 1, 1, 5, '', NULL, now(), now(), NULL);

INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (280, 1, '0,1', '通知公告', 'M', 'Notice', 'notice', 'system/notice/index', NULL, NULL, NULL, 0, 9, '', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2801, 280, '0,1,280', '通知查询', 'B', NULL, '', NULL, 'sys:notice:list', NULL, NULL, 1, 1, '', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2802, 280, '0,1,280', '通知新增', 'B', NULL, '', NULL, 'sys:notice:create', NULL, NULL, 1, 2, '', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2803, 280, '0,1,280', '通知编辑', 'B', NULL, '', NULL, 'sys:notice:update', NULL, NULL, 1, 3, '', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2804, 280, '0,1,280', '通知删除', 'B', NULL, '', NULL, 'sys:notice:delete', NULL, NULL, 1, 4, '', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2805, 280, '0,1,280', '通知发布', 'B', NULL, '', NULL, 'sys:notice:publish', 0, 1, 1, 5, '', NULL, now(), now(), NULL);
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`) VALUES (2806, 280, '0,1,280', '通知撤回', 'B', NULL, '', NULL, 'sys:notice:revoke', 0, 1, 1, 6, '', NULL, now(), now(), NULL);

-- ----------------------------
-- Table structure for sys_role
-- ----------------------------
DROP TABLE IF EXISTS `sys_role`;
CREATE TABLE `sys_role`  (
                             `id` bigint NOT NULL AUTO_INCREMENT,
                             `name` varchar(64) NOT NULL COMMENT '角色名称',
                             `code` varchar(32) NOT NULL COMMENT '角色编码',
                             `sort` int NULL COMMENT '显示顺序',
                             `status` tinyint(1) DEFAULT 1 COMMENT '角色状态(1-正常 0-停用)',
                             `data_scope` tinyint NULL COMMENT '数据权限(1-所有数据 2-部门及子部门数据 3-本部门数据 4-本人数据 5-自定义部门数据)',
                             `create_by` bigint NULL COMMENT '创建人 ID',
                             `create_time` datetime NULL COMMENT '创建时间',
                             `update_by` bigint NULL COMMENT '更新人ID',
                             `update_time` datetime NULL COMMENT '更新时间',
                             `is_deleted` tinyint(1) DEFAULT 0 COMMENT '逻辑删除标识(0-未删除 1-已删除)',
                             PRIMARY KEY (`id`) USING BTREE,
                             UNIQUE INDEX `uk_name`(`name` ASC) USING BTREE COMMENT '角色名称唯一索引',
                             UNIQUE INDEX `uk_code`(`code` ASC) USING BTREE COMMENT '角色编码唯一索引'
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COMMENT = '系统角色表';

-- ----------------------------
-- Records of sys_role
-- ----------------------------
INSERT INTO `sys_role` VALUES (1, '超级管理员', 'ROOT', 1, 1, 1, NULL, now(), NULL, now(), 0);
INSERT INTO `sys_role` VALUES (2, '系统管理员', 'ADMIN', 2, 1, 1, NULL, now(), NULL, NULL, 0);
INSERT INTO `sys_role` VALUES (3, '访问游客', 'GUEST', 3, 1, 3, NULL, now(), NULL, now(), 0);
INSERT INTO `sys_role` VALUES (4, '部门主管', 'DEPT_MANAGER', 4, 1, 2, NULL, now(), NULL, now(), 0);
INSERT INTO `sys_role` VALUES (5, '部门成员', 'DEPT_MEMBER', 5, 1, 3, NULL, now(), NULL, now(), 0);
INSERT INTO `sys_role` VALUES (6, '普通员工', 'EMPLOYEE', 6, 1, 4, NULL, now(), NULL, now(), 0);
INSERT INTO `sys_role` VALUES (7, '自定义权限用户', 'CUSTOM_USER', 7, 1, 5, NULL, now(), NULL, now(), 0);

-- ----------------------------
-- Table structure for sys_role_menu
-- ----------------------------
DROP TABLE IF EXISTS `sys_role_menu`;
CREATE TABLE `sys_role_menu`  (
                                  `role_id` bigint NOT NULL COMMENT '角色ID',
                                  `menu_id` bigint NOT NULL COMMENT '菜单ID',
                                  UNIQUE INDEX `uk_roleid_menuid`(`role_id` ASC, `menu_id` ASC) USING BTREE COMMENT '角色菜单唯一索引'
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COMMENT = '角色菜单关联表';

-- ----------------------------
-- Table structure for sys_role_dept
-- ----------------------------
DROP TABLE IF EXISTS `sys_role_dept`;
CREATE TABLE `sys_role_dept`  (
                                  `role_id` bigint NOT NULL COMMENT '角色ID',
                                  `dept_id` bigint NOT NULL COMMENT '部门ID',
                                  UNIQUE INDEX `uk_roleid_deptid`(`role_id` ASC, `dept_id` ASC) USING BTREE COMMENT '角色部门唯一索引'
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COMMENT = '角色部门关联表';

-- ----------------------------
-- Records of sys_role_dept
-- ----------------------------
INSERT IGNORE INTO `sys_role_dept` VALUES (7, 1);
INSERT IGNORE INTO `sys_role_dept` VALUES (7, 2);

-- ============================================
-- 系统管理员角色菜单权限（role_id=2）
-- 顶级目录
INSERT INTO `sys_role_menu` VALUES (2, 1);
-- 系统管理
INSERT INTO `sys_role_menu` VALUES (2, 210), (2, 2101), (2, 2102), (2, 2103), (2, 2104), (2, 2105), (2, 2106), (2, 2107);
INSERT INTO `sys_role_menu` VALUES (2, 220), (2, 2201), (2, 2202), (2, 2203), (2, 2204), (2, 2205);
INSERT INTO `sys_role_menu` VALUES (2, 230), (2, 2301), (2, 2302), (2, 2303), (2, 2304);
INSERT INTO `sys_role_menu` VALUES (2, 240), (2, 2401), (2, 2402), (2, 2403), (2, 2404);
INSERT INTO `sys_role_menu` VALUES (2, 250), (2, 2501), (2, 2502), (2, 2503), (2, 2504);
INSERT INTO `sys_role_menu` VALUES (2, 251), (2, 2511), (2, 2512), (2, 2513), (2, 2514);
INSERT INTO `sys_role_menu` VALUES (2, 260), (2, 2601);
INSERT INTO `sys_role_menu` VALUES (2, 270), (2, 2701), (2, 2702), (2, 2703), (2, 2704), (2, 2705);
INSERT INTO `sys_role_menu` VALUES (2, 280), (2, 2801), (2, 2802), (2, 2803), (2, 2804), (2, 2805), (2, 2806);

INSERT IGNORE INTO `sys_role_menu` VALUES (4, 1);
INSERT IGNORE INTO `sys_role_menu` VALUES (4, 210), (4, 2101), (4, 2102), (4, 2103), (4, 2104), (4, 2105), (4, 2106), (4, 2107);
INSERT IGNORE INTO `sys_role_menu` VALUES (4, 220), (4, 2201), (4, 2202), (4, 2203), (4, 2204), (4, 2205);

INSERT IGNORE INTO `sys_role_menu` VALUES (5, 1);
INSERT IGNORE INTO `sys_role_menu` VALUES (5, 210), (5, 2101), (5, 2102), (5, 2103), (5, 2104), (5, 2105), (5, 2106), (5, 2107);
INSERT IGNORE INTO `sys_role_menu` VALUES (5, 220), (5, 2201), (5, 2202), (5, 2203), (5, 2204), (5, 2205);

INSERT IGNORE INTO `sys_role_menu` VALUES (6, 1);
INSERT IGNORE INTO `sys_role_menu` VALUES (6, 210), (6, 2101), (6, 2102), (6, 2103), (6, 2104), (6, 2105), (6, 2106), (6, 2107);
INSERT IGNORE INTO `sys_role_menu` VALUES (6, 220), (6, 2201), (6, 2202), (6, 2203), (6, 2204), (6, 2205);

INSERT IGNORE INTO `sys_role_menu` VALUES (7, 1);
INSERT IGNORE INTO `sys_role_menu` VALUES (7, 210), (7, 2101), (7, 2102), (7, 2103), (7, 2104), (7, 2105), (7, 2106), (7, 2107);
INSERT IGNORE INTO `sys_role_menu` VALUES (7, 220), (7, 2201), (7, 2202), (7, 2203), (7, 2204), (7, 2205);
-- ----------------------------
-- Table structure for sys_user
-- ----------------------------
DROP TABLE IF EXISTS `sys_user`;
CREATE TABLE `sys_user`  (
                             `id` bigint NOT NULL AUTO_INCREMENT,
                             `username` varchar(64) NOT NULL COMMENT '用户名',
                             `nickname` varchar(64) NOT NULL COMMENT '昵称',
                             `gender` tinyint(1) DEFAULT 1 COMMENT '性别((1-男 2-女 0-保密)',
                             `password` varchar(100) NOT NULL COMMENT '密码',
                             `dept_id` bigint COMMENT '部门ID',
                             `avatar` varchar(255) COMMENT '用户头像',
                             `mobile` varchar(20) COMMENT '联系方式',
                             `status` tinyint(1) NOT NULL DEFAULT 1 COMMENT '状态(1-正常 0-禁用)',
                             `email` varchar(128) COMMENT '用户邮箱',
                             `create_time` datetime COMMENT '创建时间',
                             `create_by` bigint COMMENT '创建人ID',
                             `update_time` datetime COMMENT '更新时间',
                             `update_by` bigint COMMENT '修改人ID',
                             `is_deleted` tinyint(1) NOT NULL DEFAULT 0 COMMENT '逻辑删除标识(0-未删除 1-已删除)',
                             `active_username` varchar(64) GENERATED ALWAYS AS (CASE WHEN `is_deleted` = 0 THEN `username` ELSE NULL END) STORED COMMENT '活动用户名唯一键',
                             `active_mobile` varchar(20) GENERATED ALWAYS AS (CASE WHEN `is_deleted` = 0 THEN `mobile` ELSE NULL END) STORED COMMENT '活动手机号唯一键',
                            PRIMARY KEY (`id`) USING BTREE,
                            UNIQUE INDEX `uk_sys_user_active_username` (`active_username`) USING BTREE,
                            UNIQUE INDEX `uk_sys_user_active_mobile` (`active_mobile`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COMMENT = '系统用户表';

-- ----------------------------
-- Records of sys_user
-- ----------------------------
INSERT INTO `sys_user`
(`id`, `username`, `nickname`, `gender`, `password`, `dept_id`, `avatar`, `mobile`, `status`, `email`, `create_time`, `create_by`, `update_time`, `update_by`, `is_deleted`)
VALUES
(1, 'root', '有来技术', 0, '$2a$10$xVWsNOhHrCxh5UbpCE7/HuJ.PAOKcYAqRxD2CO2nVnJS.IAXkr5aq', NULL, 'https://foruda.gitee.com/images/1723603502796844527/03cdca2a_716974.gif', '18812345677', 1, 'youlaitech@163.com', now(), NULL, now(), NULL, 0),
(2, 'admin', '系统管理员', 1, '$2a$10$xVWsNOhHrCxh5UbpCE7/HuJ.PAOKcYAqRxD2CO2nVnJS.IAXkr5aq', 1, 'https://foruda.gitee.com/images/1723603502796844527/03cdca2a_716974.gif', '18888888888', 1, 'youlaitech@163.com', now(), NULL, now(), NULL, 0),
(3, 'test', '测试小用户', 1, '$2a$10$xVWsNOhHrCxh5UbpCE7/HuJ.PAOKcYAqRxD2CO2nVnJS.IAXkr5aq', 3, 'https://foruda.gitee.com/images/1723603502796844527/03cdca2a_716974.gif', '18812345679', 1, 'youlaitech@163.com', now(), NULL, now(), NULL, 0),
(4, 'dept_manager', '部门主管', 1, '$2a$10$xVWsNOhHrCxh5UbpCE7/HuJ.PAOKcYAqRxD2CO2nVnJS.IAXkr5aq', 1, 'https://foruda.gitee.com/images/1723603502796844527/03cdca2a_716974.gif', '18812345680', 1, 'manager@youlaitech.com', now(), NULL, now(), NULL, 0),
(5, 'dept_member', '部门成员', 1, '$2a$10$xVWsNOhHrCxh5UbpCE7/HuJ.PAOKcYAqRxD2CO2nVnJS.IAXkr5aq', 1, 'https://foruda.gitee.com/images/1723603502796844527/03cdca2a_716974.gif', '18812345681', 1, 'member@youlaitech.com', now(), NULL, now(), NULL, 0),
(6, 'employee', '普通员工', 1, '$2a$10$xVWsNOhHrCxh5UbpCE7/HuJ.PAOKcYAqRxD2CO2nVnJS.IAXkr5aq', 2, 'https://foruda.gitee.com/images/1723603502796844527/03cdca2a_716974.gif', '18812345682', 1, 'employee@youlaitech.com', now(), NULL, now(), NULL, 0),
(7, 'custom_user', '自定义权限用户', 1, '$2a$10$xVWsNOhHrCxh5UbpCE7/HuJ.PAOKcYAqRxD2CO2nVnJS.IAXkr5aq', 3, 'https://foruda.gitee.com/images/1723603502796844527/03cdca2a_716974.gif', '18812345683', 1, 'custom@youlaitech.com', now(), NULL, now(), NULL, 0);

-- ----------------------------
-- Table structure for sys_user_role
-- ----------------------------
DROP TABLE IF EXISTS `sys_user_role`;
CREATE TABLE `sys_user_role`  (
                                  `user_id` bigint NOT NULL COMMENT '用户ID',
                                  `role_id` bigint NOT NULL COMMENT '角色ID',
                                  PRIMARY KEY (`user_id`, `role_id`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COMMENT = '用户角色关联表';

-- ----------------------------
-- Records of sys_user_role
-- ----------------------------
INSERT IGNORE INTO `sys_user_role` VALUES (1, 1);
INSERT IGNORE INTO `sys_user_role` VALUES (2, 2);
INSERT IGNORE INTO `sys_user_role` VALUES (3, 3);
INSERT IGNORE INTO `sys_user_role` VALUES (4, 4);
INSERT IGNORE INTO `sys_user_role` VALUES (5, 5);
INSERT IGNORE INTO `sys_user_role` VALUES (6, 6);
INSERT IGNORE INTO `sys_user_role` VALUES (7, 7);


-- ----------------------------
-- Table structure for sys_log
-- ----------------------------
DROP TABLE IF EXISTS `sys_log`;
CREATE TABLE `sys_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
    `module` TINYINT NOT NULL COMMENT '模块，数字枚举，参考 LogModule 枚举',
    `action_type` TINYINT NOT NULL COMMENT '操作类型，数字枚举，参考 ActionType 枚举',
    `title` VARCHAR(100) NOT NULL COMMENT '前端显示标题',
    `content` TEXT COMMENT '自定义日志内容',
    `operator_id` BIGINT COMMENT '操作人ID',
    `operator_name` VARCHAR(50) COMMENT '操作人名称',
    `request_uri` VARCHAR(255) COMMENT '请求路径',
    `request_method` VARCHAR(10) COMMENT '请求方法',
    `ip` VARCHAR(45) COMMENT 'IP地址',
    `province` VARCHAR(100) COMMENT '省份',
    `city` VARCHAR(100) COMMENT '城市',
    `device` VARCHAR(100) COMMENT '设备',
    `os` VARCHAR(100) COMMENT '操作系统',
    `browser` VARCHAR(100) COMMENT '浏览器',
    `status` TINYINT DEFAULT 1 COMMENT '0失败 1成功',
    `error_msg` VARCHAR(255) COMMENT '错误信息',
    `execution_time` INT COMMENT '执行时间(ms)',
    `create_time` DATETIME COMMENT '操作时间',
    PRIMARY KEY (`id`) USING BTREE,
    KEY `idx_module_action_time` (`module`, `action_type`, `create_time`),
    KEY `idx_operator_time` (`operator_id`, `create_time`),
    KEY `idx_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统操作日志表';

-- ----------------------------
-- 系统配置表
-- ----------------------------
DROP TABLE IF EXISTS `sys_config`;
CREATE TABLE `sys_config` (
                              `id` bigint NOT NULL AUTO_INCREMENT,
                              `config_name` varchar(50) NOT NULL COMMENT '配置名称',
                              `config_key` varchar(50) NOT NULL COMMENT '配置key',
                              `config_value` varchar(100) NOT NULL COMMENT '配置值',
                              `remark` varchar(255) COMMENT '备注',
                              `create_time` datetime COMMENT '创建时间',
                              `create_by` bigint COMMENT '创建人ID',
                              `update_time` datetime COMMENT '更新时间',
                              `update_by` bigint COMMENT '更新人ID',
                              `is_deleted` tinyint(4) DEFAULT '0' NOT NULL COMMENT '逻辑删除标识(0-未删除 1-已删除)',
                              PRIMARY KEY (`id`)
) ENGINE=InnoDB COMMENT='系统配置表';

INSERT INTO `sys_config` VALUES (1, '系统限流QPS', 'IP_QPS_THRESHOLD_LIMIT', '10', '单个IP请求的最大每秒查询数（QPS）阈值Key', now(), 1, NULL, NULL, 0);

-- ----------------------------
-- 通知公告表
-- ----------------------------
DROP TABLE IF EXISTS `sys_notice`;
CREATE TABLE `sys_notice` (
                              `id` bigint NOT NULL AUTO_INCREMENT,
                              `title` varchar(50) COMMENT '通知标题',
                              `content` text COMMENT '通知内容',
                              `type` tinyint NOT NULL COMMENT '通知类型（关联字典编码：notice_type）',
                              `level` varchar(5) NOT NULL COMMENT '通知等级（字典code：notice_level）',
                              `target_type` tinyint NOT NULL COMMENT '目标类型（1: 全体, 2: 指定）',
                              `target_user_ids` varchar(255) COMMENT '目标人ID集合（多个使用英文逗号,分割）',
                              `publisher_id` bigint COMMENT '发布人ID',
                              `publish_status` tinyint DEFAULT '0' COMMENT '发布状态（0: 未发布, 1: 已发布, -1: 已撤回）',
                              `publish_time` datetime COMMENT '发布时间',
                              `revoke_time` datetime COMMENT '撤回时间',
                              `create_by` bigint NOT NULL COMMENT '创建人ID',
                              `create_time` datetime NOT NULL COMMENT '创建时间',
                              `update_by` bigint COMMENT '更新人ID',
                              `update_time` datetime COMMENT '更新时间',
                              `is_deleted` tinyint(1) DEFAULT '0' COMMENT '是否删除（0: 未删除, 1: 已删除）',
                              PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统通知公告表';

INSERT INTO `sys_notice` VALUES (1, 'v3.0.0 版本发布 - 多租户功能上线', '<p>🎉 新版本发布，主要更新内容：</p><p>1. 新增多租户功能，支持租户隔离和数据管理</p><p>2. 优化系统性能，提升响应速度</p><p>3. 完善权限管理，增强安全性</p><p>4. 修复已知问题，提升系统稳定性</p>', 1, 'H', 1, NULL, 1, 1, '2024-12-15 10:00:00', NULL, 1, '2024-12-15 10:00:00', 1, '2024-12-15 10:00:00', 0);
INSERT INTO `sys_notice` VALUES (2, '系统维护通知 - 2024年12月20日', '<p>⏰ 系统维护通知</p><p>系统将于 <strong>2024年12月20日（本周五）凌晨 2:00-4:00</strong> 进行例行维护升级。</p><p>维护期间系统将暂停服务，请提前做好数据备份工作。</p><p>给您带来的不便，敬请谅解！</p>', 2, 'H', 1, NULL, 1, 1, '2024-12-18 14:30:00', NULL, 1, '2024-12-18 14:30:00', 1, '2024-12-18 14:30:00', 0);
INSERT INTO `sys_notice` VALUES (3, '安全提醒 - 防范钓鱼邮件', '<p>⚠️ 安全提醒</p><p>近期发现有不法分子通过钓鱼邮件进行网络攻击，请大家提高警惕：</p><p>1. 不要点击来源不明的邮件链接</p><p>2. 不要下载可疑附件</p><p>3. 遇到可疑邮件请及时联系IT部门</p><p>4. 定期修改密码，使用强密码策略</p>', 3, 'H', 1, NULL, 1, 1, '2024-12-10 09:00:00', NULL, 1, '2024-12-10 09:00:00', 1, '2024-12-10 09:00:00', 0);
INSERT INTO `sys_notice` VALUES (4, '元旦假期安排通知', '<p>📅 元旦假期安排</p><p>根据国家法定节假日安排，公司元旦假期时间为：</p><p><strong>2024年12月30日（周一）至 2025年1月1日（周三）</strong>，共3天。</p><p>2024年12月29日（周日）正常上班。</p><p>祝大家元旦快乐，假期愉快！</p>', 4, 'M', 1, NULL, 1, 1, '2024-12-25 16:00:00', NULL, 1, '2024-12-25 16:00:00', 1, '2024-12-25 16:00:00', 0);
INSERT INTO `sys_notice` VALUES (5, '新产品发布会邀请', '<p>🎊 新产品发布会邀请</p><p>公司将于 <strong>2025年1月15日下午14:00</strong> 在总部会议室举办新产品发布会。</p><p>届时将展示最新研发的产品和技术成果，欢迎全体员工参加。</p><p>请各部门提前安排好工作，准时参加。</p>', 5, 'M', 1, NULL, 1, 1, '2024-12-28 11:00:00', NULL, 1, '2024-12-28 11:00:00', 1, '2024-12-28 11:00:00', 0);
INSERT INTO `sys_notice` VALUES (6, 'v2.16.1 版本更新', '<p>✨ 版本更新</p><p>v2.16.1 版本已发布，主要修复内容：</p><p>1. 修复 WebSocket 重复连接导致的后台线程阻塞问题</p><p>2. 优化通知公告功能，提升用户体验</p><p>3. 修复部分已知bug</p><p>建议尽快更新到最新版本。</p>', 1, 'M', 1, NULL, 1, 1, '2024-12-05 15:30:00', NULL, 1, '2024-12-05 15:30:00', 1, '2024-12-05 15:30:00', 0);
INSERT INTO `sys_notice` VALUES (7, '年终总结会议通知', '<p>📋 年终总结会议通知</p><p>各部门年终总结会议将于 <strong>2024年12月30日上午9:00</strong> 召开。</p><p>请各部门负责人提前准备好年度工作总结和下年度工作计划。</p><p>会议地点：总部大会议室</p>', 5, 'M', 2, '1,2', 1, 1, '2024-12-22 10:00:00', NULL, 1, '2024-12-22 10:00:00', 1, '2024-12-22 10:00:00', 0);
INSERT INTO `sys_notice` VALUES (8, '系统功能优化完成', '<p>✅ 系统功能优化</p><p>已完成以下功能优化：</p><p>1. 优化用户管理界面，提升操作体验</p><p>2. 增强数据导出功能，支持更多格式</p><p>3. 优化搜索功能，提升查询效率</p><p>4. 修复部分界面显示问题</p>', 1, 'L', 1, NULL, 1, 1, '2024-12-12 14:20:00', NULL, 1, '2024-12-12 14:20:00', 1, '2024-12-12 14:20:00', 0);
INSERT INTO `sys_notice` VALUES (9, '员工培训计划', '<p>📚 员工培训计划</p><p>为提升员工专业技能，公司将于 <strong>2025年1月8日-10日</strong> 组织技术培训。</p><p>培训内容：</p><p>1. 新技术框架应用</p><p>2. 代码规范与最佳实践</p><p>3. 系统架构设计</p><p>请各部门合理安排工作，确保培训顺利进行。</p>', 5, 'M', 1, NULL, 1, 1, '2024-12-20 09:30:00', NULL, 1, '2024-12-20 09:30:00', 1, '2024-12-20 09:30:00', 0);
INSERT INTO `sys_notice` VALUES (10, '数据备份提醒', '<p>💾 数据备份提醒</p><p>请各部门注意定期备份重要数据，建议每周至少备份一次。</p><p>备份方式：</p><p>1. 使用系统自带备份功能</p><p>2. 手动导出重要数据</p><p>3. 联系IT部门协助备份</p><p>数据安全，人人有责！</p>', 3, 'L', 1, NULL, 1, 1, '2024-12-08 08:00:00', NULL, 1, '2024-12-08 08:00:00', 1, '2024-12-08 08:00:00', 0);

-- ----------------------------
-- 用户通知公告表
-- ----------------------------
DROP TABLE IF EXISTS `sys_user_notice`;
CREATE TABLE `sys_user_notice` (
                                   `id` bigint NOT NULL AUTO_INCREMENT COMMENT 'id',
                                   `notice_id` bigint NOT NULL COMMENT '公共通知id',
                                   `user_id` bigint NOT NULL COMMENT '用户id',
                                   `is_read` tinyint DEFAULT '0' COMMENT '读取状态（0: 未读, 1: 已读）',
                                   `read_time` datetime COMMENT '阅读时间',
                                   `create_time` datetime NOT NULL COMMENT '创建时间',
                                   `update_time` datetime COMMENT '更新时间',
                                   `is_deleted` tinyint DEFAULT '0' COMMENT '逻辑删除(0: 未删除, 1: 已删除)',
                                   PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户通知公告关联表';

INSERT INTO `sys_user_notice` VALUES (1, 1, 2, 1, NULL, now(), now(), 0);
INSERT INTO `sys_user_notice` VALUES (2, 2, 2, 1, NULL, now(), now(), 0);
INSERT INTO `sys_user_notice` VALUES (3, 3, 2, 1, NULL, now(), now(), 0);
INSERT INTO `sys_user_notice` VALUES (4, 4, 2, 1, NULL, now(), now(), 0);
INSERT INTO `sys_user_notice` VALUES (5, 5, 2, 1, NULL, now(), now(), 0);
INSERT INTO `sys_user_notice` VALUES (6, 6, 2, 1, NULL, now(), now(), 0);
INSERT INTO `sys_user_notice` VALUES (7, 7, 2, 1, NULL, now(), now(), 0);
INSERT INTO `sys_user_notice` VALUES (8, 8, 2, 1, NULL, now(), now(), 0);
INSERT INTO `sys_user_notice` VALUES (9, 9, 2, 1, NULL, now(), now(), 0);
INSERT INTO `sys_user_notice` VALUES (10, 10, 2, 1, NULL, now(), now(), 0);

-- ----------------------------
-- Table structure for sys_user_social
-- ----------------------------
DROP TABLE IF EXISTS `sys_user_social`;
CREATE TABLE `sys_user_social` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` bigint NOT NULL COMMENT '用户ID',
  `platform` varchar(20) NOT NULL COMMENT '平台类型(WECHAT_MINI/WECHAT_MP/ALIPAY/QQ/APPLE)',
  `openid` varchar(64) NOT NULL COMMENT '平台openid',
  `unionid` varchar(64) DEFAULT NULL COMMENT '微信unionid',
  `nickname` varchar(64) DEFAULT NULL COMMENT '第三方昵称',
  `avatar` varchar(255) DEFAULT NULL COMMENT '第三方头像URL',
  `session_key` varchar(128) DEFAULT NULL COMMENT '微信session_key',
  `verified` tinyint(1) DEFAULT 1 COMMENT '是否已验证(1-已验证 0-未验证)',
  `create_time` datetime DEFAULT NULL COMMENT '绑定时间',
  `update_time` datetime DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_platform_openid` (`platform`, `openid`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_unionid` (`unionid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户第三方账号绑定表';


-- Baseline source: biz_p0.sql
# 悦己DLumière P0 业务核心表（阶段1）
# 依赖：先执行 youlai_admin.sql 完成系统表初始化
# 约定：金额字段统一使用「分」整数存储；审计字段与系统表保持一致

USE youlai_admin;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- 会员表（C端用户，独立于 sys_user）
-- ----------------------------
DROP TABLE IF EXISTS `member`;
CREATE TABLE `member` (
    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
    `openid` varchar(64) NOT NULL COMMENT '微信小程序openid',
    `unionid` varchar(64) NULL COMMENT '微信unionid',
    `mobile` varchar(20) NULL COMMENT '手机号',
    `nickname` varchar(64) NOT NULL DEFAULT '微信用户' COMMENT '昵称',
    `avatar` varchar(255) NULL COMMENT '头像',
    `gender` tinyint NOT NULL DEFAULT 0 COMMENT '性别(1-男 2-女 0-保密)',
    `status` tinyint NOT NULL DEFAULT 1 COMMENT '状态(1-正常 0-禁用)',
    `points` int NOT NULL DEFAULT 0 COMMENT '积分余额',
    `level_id` bigint NULL COMMENT '会员等级ID(阶段5启用)',
    `last_login_time` datetime NULL COMMENT '最后登录时间',
    `create_by` bigint NULL COMMENT '创建人ID',
    `create_time` datetime NULL COMMENT '创建时间',
    `update_by` bigint NULL COMMENT '修改人ID',
    `update_time` datetime NULL COMMENT '更新时间',
    `is_deleted` tinyint NOT NULL DEFAULT 0 COMMENT '逻辑删除标识(1-已删除 0-未删除)',
    PRIMARY KEY (`id`) USING BTREE,
    UNIQUE INDEX `uk_openid`(`openid` ASC) USING BTREE COMMENT 'openid唯一索引',
    UNIQUE INDEX `uk_member_unionid`(`unionid` ASC) USING BTREE COMMENT 'unionid唯一索引',
    UNIQUE INDEX `uk_member_mobile`(`mobile` ASC) USING BTREE COMMENT '手机号唯一索引',
    INDEX `idx_member_nickname`(`nickname` ASC) USING BTREE,
    INDEX `idx_member_active_created`(`is_deleted` ASC, `create_time` ASC, `id` ASC) USING BTREE,
    INDEX `idx_member_active_status_created`(`is_deleted` ASC, `status` ASC, `create_time` ASC, `id` ASC) USING BTREE,
    INDEX `idx_member_level_id`(`level_id` ASC) USING BTREE,
    CONSTRAINT `chk_member_openid_not_blank` CHECK (CHAR_LENGTH(TRIM(`openid`)) > 0),
    CONSTRAINT `chk_member_unionid_not_blank` CHECK (`unionid` IS NULL OR CHAR_LENGTH(TRIM(`unionid`)) > 0),
    CONSTRAINT `chk_member_mobile_not_blank` CHECK (`mobile` IS NULL OR CHAR_LENGTH(TRIM(`mobile`)) > 0),
    CONSTRAINT `chk_member_nickname_not_blank` CHECK (CHAR_LENGTH(TRIM(`nickname`)) > 0),
    CONSTRAINT `chk_member_gender` CHECK (`gender` IN (0, 1, 2)),
    CONSTRAINT `chk_member_status` CHECK (`status` IN (0, 1)),
    CONSTRAINT `chk_member_points` CHECK (`points` >= 0),
    CONSTRAINT `chk_member_is_deleted` CHECK (`is_deleted` IN (0, 1))
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COMMENT = '会员表';

-- ----------------------------
-- 商品分类表（支持三级分类）
-- ----------------------------
DROP TABLE IF EXISTS `product_category`;
CREATE TABLE `product_category` (
    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
    `name` varchar(64) NOT NULL COMMENT '分类名称',
    `parent_id` bigint DEFAULT 0 COMMENT '父分类ID(0为顶级)',
    `tree_path` varchar(255) NOT NULL DEFAULT '0' COMMENT '父节点ID路径',
    `level` tinyint DEFAULT 1 COMMENT '层级(1/2/3)',
    `icon` varchar(255) NULL COMMENT '分类图标',
    `sort` smallint DEFAULT 0 COMMENT '显示顺序',
    `status` tinyint DEFAULT 1 COMMENT '状态(1-启用 0-禁用)',
    `create_by` bigint NULL COMMENT '创建人ID',
    `create_time` datetime NULL COMMENT '创建时间',
    `update_by` bigint NULL COMMENT '修改人ID',
    `update_time` datetime NULL COMMENT '更新时间',
    `is_deleted` tinyint DEFAULT 0 COMMENT '逻辑删除标识(1-已删除 0-未删除)',
    PRIMARY KEY (`id`) USING BTREE,
    INDEX `idx_parent_id`(`parent_id` ASC) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COMMENT = '商品分类表';

-- ----------------------------
-- 商品表（SPU）
-- ----------------------------
DROP TABLE IF EXISTS `product`;
CREATE TABLE `product` (
    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
    `name` varchar(100) NOT NULL COMMENT '商品名称',
    `category_id` bigint NOT NULL COMMENT '分类ID',
    `sub_title` varchar(255) NULL COMMENT '副标题',
    `main_image` varchar(255) NULL COMMENT '主图URL',
    `album` text NULL COMMENT '轮播图URL列表(JSON数组)',
    `video_url` varchar(255) NULL COMMENT '短视频URL',
    `tags` varchar(255) NULL COMMENT '标签(逗号分隔：推荐,新品,热卖)',
    `pain_friendly` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否疼痛友好(0-否 1-是)',
    `original_price` int NULL COMMENT '原价(分)',
    `price` int NOT NULL DEFAULT 0 COMMENT '现售价(分)',
    `sales` int DEFAULT 0 COMMENT '销量',
    `stock` int DEFAULT 0 COMMENT '总库存(SKU库存之和)',
    `detail` mediumtext NULL COMMENT '商品详情(富文本)',
    `usage_note` text NULL COMMENT '产品说明(适用人群/注意事项/术后护理)',
    `status` tinyint DEFAULT 0 COMMENT '状态(1-上架 0-下架)',
    `sort` smallint DEFAULT 0 COMMENT '显示顺序',
    `create_by` bigint NULL COMMENT '创建人ID',
    `create_time` datetime NULL COMMENT '创建时间',
    `update_by` bigint NULL COMMENT '修改人ID',
    `update_time` datetime NULL COMMENT '更新时间',
    `is_deleted` tinyint DEFAULT 0 COMMENT '逻辑删除标识(1-已删除 0-未删除)',
    PRIMARY KEY (`id`) USING BTREE,
    INDEX `idx_category_id`(`category_id` ASC) USING BTREE,
    INDEX `idx_status`(`status` ASC) USING BTREE,
    CONSTRAINT `fk_product_category`
        FOREIGN KEY (`category_id`) REFERENCES `product_category` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COMMENT = '商品表(SPU)';

-- ----------------------------
-- 商品SKU表
-- ----------------------------
DROP TABLE IF EXISTS `product_sku`;
CREATE TABLE `product_sku` (
    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
    `product_id` bigint NOT NULL COMMENT '商品ID',
    `name` varchar(100) NOT NULL COMMENT '规格名称(如：面部/2ml)',
    `specs` varchar(255) NULL COMMENT '规格属性(JSON：{"部位":"面部","剂量":"2ml"})',
    `sku_code` varchar(64) NULL COMMENT 'SKU编码',
    `price` int NOT NULL DEFAULT 0 COMMENT '售价(分)',
    `original_price` int NULL COMMENT '原价(分)',
    `stock` int DEFAULT 0 COMMENT '库存',
    `status` tinyint DEFAULT 1 COMMENT '状态(1-启用 0-禁用)',
    `create_by` bigint NULL COMMENT '创建人ID',
    `create_time` datetime NULL COMMENT '创建时间',
    `update_by` bigint NULL COMMENT '修改人ID',
    `update_time` datetime NULL COMMENT '更新时间',
    `is_deleted` tinyint DEFAULT 0 COMMENT '逻辑删除标识(1-已删除 0-未删除)',
    PRIMARY KEY (`id`) USING BTREE,
    INDEX `idx_product_id`(`product_id` ASC) USING BTREE,
    UNIQUE INDEX `uk_product_sku_product_id_id`(`product_id` ASC, `id` ASC) USING BTREE,
    CONSTRAINT `fk_product_sku_product`
        FOREIGN KEY (`product_id`) REFERENCES `product` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COMMENT = '商品SKU表';

-- ----------------------------
-- 购物车表
-- ----------------------------
DROP TABLE IF EXISTS `cart`;
CREATE TABLE `cart` (
    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
    `member_id` bigint NOT NULL COMMENT '会员ID',
    `product_id` bigint NOT NULL COMMENT '商品ID',
    `sku_id` bigint NOT NULL COMMENT 'SKU ID',
    `quantity` int NOT NULL DEFAULT 1 COMMENT '数量',
    `checked` tinyint NOT NULL DEFAULT 1 COMMENT '是否选中(1-选中 0-未选中)',
    `create_by` bigint NULL COMMENT '创建人ID',
    `create_time` datetime NULL COMMENT '创建时间',
    `update_by` bigint NULL COMMENT '修改人ID',
    `update_time` datetime NULL COMMENT '更新时间',
    `is_deleted` tinyint NOT NULL DEFAULT 0 COMMENT '逻辑删除标识(1-已删除 0-未删除)',
    PRIMARY KEY (`id`) USING BTREE,
    UNIQUE INDEX `uk_member_sku`(`member_id` ASC, `sku_id` ASC) USING BTREE COMMENT '会员+SKU唯一',
    INDEX `idx_cart_member_active_updated`(`member_id` ASC, `is_deleted` ASC, `update_time` DESC, `id` DESC) USING BTREE,
    INDEX `idx_cart_product_sku`(`product_id` ASC, `sku_id` ASC) USING BTREE,
    CONSTRAINT `fk_cart_member`
        FOREIGN KEY (`member_id`) REFERENCES `member` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_cart_product_sku`
        FOREIGN KEY (`product_id`, `sku_id`) REFERENCES `product_sku` (`product_id`, `id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `chk_cart_quantity` CHECK (`quantity` BETWEEN 1 AND 99),
    CONSTRAINT `chk_cart_checked` CHECK (`checked` IN (0, 1)),
    CONSTRAINT `chk_cart_is_deleted` CHECK (`is_deleted` IN (0, 1))
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COMMENT = '购物车表';

-- ----------------------------
-- 订单表（表名加 biz_ 前缀避开 MySQL 保留字 ORDER）
-- ----------------------------
DROP TABLE IF EXISTS `biz_order_gift`;
DROP TABLE IF EXISTS `biz_order`;
CREATE TABLE `biz_order` (
    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
    `order_no` varchar(32) NOT NULL COMMENT '订单号',
    `member_id` bigint NOT NULL COMMENT '会员ID',
    `beneficiary_member_id` bigint NOT NULL COMMENT '当前服务权益会员ID',
    `status` tinyint NOT NULL DEFAULT 0 COMMENT '订单状态(0-待付款 1-已付款/待核销 2-已核销 3-已完成 4-已取消 5-已退款)',
    `total_amount` int NOT NULL DEFAULT 0 COMMENT '商品总额(分)',
    `discount_amount` int NOT NULL DEFAULT 0 COMMENT '优惠金额(分)',
    `pay_amount` int NOT NULL DEFAULT 0 COMMENT '实付金额(分)',
    `pay_type` tinyint NULL COMMENT '支付方式(1-微信支付 2-Mock支付)',
    `pay_time` datetime NULL COMMENT '支付时间',
    `contact_name` varchar(32) NULL COMMENT '联系人姓名',
    `contact_mobile` varchar(20) NULL COMMENT '联系人手机号',
    `remark` varchar(255) NULL COMMENT '订单备注',
    `verify_code` varchar(8) NULL COMMENT '核销码',
    `verify_time` datetime NULL COMMENT '核销时间',
    `verify_by` bigint NULL COMMENT '核销人ID(sys_user)',
    `cancel_time` datetime NULL COMMENT '取消时间',
    `cancel_reason` varchar(255) NULL COMMENT '取消原因',
    `create_by` bigint NULL COMMENT '创建人ID',
    `create_time` datetime NULL COMMENT '创建时间',
    `update_by` bigint NULL COMMENT '修改人ID',
    `update_time` datetime NULL COMMENT '更新时间',
    `is_deleted` tinyint NOT NULL DEFAULT 0 COMMENT '逻辑删除标识(1-已删除 0-未删除)',
    PRIMARY KEY (`id`) USING BTREE,
    UNIQUE INDEX `uk_order_no`(`order_no` ASC) USING BTREE,
    UNIQUE INDEX `uk_order_verify_code`(`verify_code` ASC) USING BTREE,
    INDEX `idx_order_member_active_created`(`member_id` ASC, `is_deleted` ASC, `create_time` DESC, `id` DESC) USING BTREE,
    INDEX `idx_order_beneficiary_active_created`(`beneficiary_member_id` ASC, `is_deleted` ASC, `create_time` DESC, `id` DESC) USING BTREE,
    INDEX `idx_order_timeout_scan`(`status` ASC, `is_deleted` ASC, `create_time` ASC, `id` ASC) USING BTREE,
    CONSTRAINT `fk_biz_order_member`
        FOREIGN KEY (`member_id`) REFERENCES `member` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_biz_order_beneficiary_member`
        FOREIGN KEY (`beneficiary_member_id`) REFERENCES `member` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `chk_biz_order_status` CHECK (`status` IN (0, 1, 2, 3, 4, 5)),
    CONSTRAINT `chk_biz_order_amounts` CHECK (
        `total_amount` >= 0 AND `discount_amount` >= 0 AND
        `pay_amount` >= 0 AND `discount_amount` <= `total_amount` AND
        `pay_amount` = `total_amount` - `discount_amount`
    ),
    CONSTRAINT `chk_biz_order_pay_type` CHECK (`pay_type` IS NULL OR `pay_type` IN (1, 2)),
    CONSTRAINT `chk_biz_order_verify_code` CHECK (`verify_code` IS NULL OR `verify_code` REGEXP '^[0-9]{8}$'),
    CONSTRAINT `chk_biz_order_is_deleted` CHECK (`is_deleted` IN (0, 1))
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COMMENT = '订单表';

-- ----------------------------
-- 订单明细表
-- ----------------------------
DROP TABLE IF EXISTS `biz_order_item`;
CREATE TABLE `biz_order_item` (
    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
    `order_id` bigint NOT NULL COMMENT '订单ID',
    `product_id` bigint NOT NULL COMMENT '商品ID',
    `sku_id` bigint NOT NULL COMMENT 'SKU ID',
    `product_name` varchar(100) NOT NULL COMMENT '商品名称(下单快照)',
    `product_image` varchar(255) NULL COMMENT '商品图片(下单快照)',
    `sku_name` varchar(100) NULL COMMENT '规格名称(下单快照)',
    `price` int NOT NULL DEFAULT 0 COMMENT '单价(分,下单快照)',
    `quantity` int NOT NULL DEFAULT 1 COMMENT '数量',
    `subtotal` int NOT NULL DEFAULT 0 COMMENT '小计(分)',
    `create_by` bigint NULL COMMENT '创建人ID',
    `create_time` datetime NULL COMMENT '创建时间',
    `update_by` bigint NULL COMMENT '修改人ID',
    `update_time` datetime NULL COMMENT '更新时间',
    `is_deleted` tinyint NOT NULL DEFAULT 0 COMMENT '逻辑删除标识(1-已删除 0-未删除)',
    PRIMARY KEY (`id`) USING BTREE,
    INDEX `idx_order_item_order`(`order_id` ASC) USING BTREE,
    INDEX `idx_order_item_product_sku`(`product_id` ASC, `sku_id` ASC) USING BTREE,
    CONSTRAINT `fk_biz_order_item_order`
        FOREIGN KEY (`order_id`) REFERENCES `biz_order` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_biz_order_item_product_sku`
        FOREIGN KEY (`product_id`, `sku_id`) REFERENCES `product_sku` (`product_id`, `id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `chk_biz_order_item_values` CHECK (
        `price` >= 0 AND `quantity` BETWEEN 1 AND 99 AND
        `subtotal` >= 0 AND `subtotal` = `price` * `quantity`
    ),
    CONSTRAINT `chk_biz_order_item_is_deleted` CHECK (`is_deleted` IN (0, 1))
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COMMENT = '订单明细表';

-- ----------------------------
-- 订单赠礼记录表
-- ----------------------------
CREATE TABLE `biz_order_gift` (
    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
    `order_id` bigint NOT NULL COMMENT '订单ID',
    `sender_member_id` bigint NOT NULL COMMENT '赠送会员ID',
    `recipient_member_id` bigint NULL COMMENT '领取会员ID',
    `token_hash` char(64) NOT NULL COMMENT '分享令牌SHA-256',
    `status` tinyint NOT NULL DEFAULT 0 COMMENT '赠礼状态(0-待领取 1-已领取 2-已撤回 3-已过期 4-已退回)',
    `expires_at` datetime NOT NULL COMMENT '领取截止时间',
    `claimed_at` datetime NULL COMMENT '领取时间',
    `revoked_at` datetime NULL COMMENT '撤回时间',
    `returned_at` datetime NULL COMMENT '退回时间',
    `create_by` bigint NULL COMMENT '创建人ID',
    `create_time` datetime NULL COMMENT '创建时间',
    `update_by` bigint NULL COMMENT '修改人ID',
    `update_time` datetime NULL COMMENT '更新时间',
    `is_deleted` tinyint NOT NULL DEFAULT 0 COMMENT '逻辑删除标识(1-已删除 0-未删除)',
    `pending_order_id` bigint GENERATED ALWAYS AS (
        CASE WHEN `status` = 0 AND `is_deleted` = 0 THEN `order_id` ELSE NULL END
    ) STORED COMMENT '待领取订单ID',
    PRIMARY KEY (`id`) USING BTREE,
    UNIQUE INDEX `uk_order_gift_token_hash`(`token_hash` ASC) USING BTREE,
    UNIQUE INDEX `uk_order_gift_pending_order`(`pending_order_id` ASC) USING BTREE,
    INDEX `idx_order_gift_sender_status_created`(`sender_member_id` ASC, `status` ASC, `create_time` DESC, `id` DESC) USING BTREE,
    INDEX `idx_order_gift_recipient_status_created`(`recipient_member_id` ASC, `status` ASC, `create_time` DESC, `id` DESC) USING BTREE,
    CONSTRAINT `fk_biz_order_gift_order`
        FOREIGN KEY (`order_id`) REFERENCES `biz_order` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_biz_order_gift_sender_member`
        FOREIGN KEY (`sender_member_id`) REFERENCES `member` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_biz_order_gift_recipient_member`
        FOREIGN KEY (`recipient_member_id`) REFERENCES `member` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `chk_order_gift_status` CHECK (`status` IN (0, 1, 2, 3, 4)),
    CONSTRAINT `chk_order_gift_is_deleted` CHECK (`is_deleted` IN (0, 1))
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COMMENT = '订单赠礼记录表';

SET FOREIGN_KEY_CHECKS = 1;


-- Baseline source: biz_phase4.sql
-- 悦己阶段4：支付、退款、会员360增量结构
USE youlai_admin;

SET NAMES utf8mb4;

ALTER TABLE `member`
    ADD COLUMN `tags` varchar(255) NULL COMMENT '会员标签(逗号分隔)' AFTER `last_login_time`,
    ADD COLUMN `remark` varchar(255) NULL COMMENT '管理员备注' AFTER `tags`;

ALTER TABLE `biz_order`
    MODIFY COLUMN `status` tinyint NOT NULL DEFAULT 0
    COMMENT '订单状态(0-待付款 1-已付款/待核销 2-已核销 3-已完成 4-已取消 5-已退款)',
    MODIFY COLUMN `pay_type` tinyint NULL COMMENT '支付方式(1-微信支付 2-Mock支付)';

CREATE TABLE `biz_payment` (
    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
    `payment_no` varchar(32) NOT NULL COMMENT '支付流水号',
    `order_id` bigint NOT NULL COMMENT '订单ID',
    `member_id` bigint NOT NULL COMMENT '订单购买人会员ID',
    `payer_member_id` bigint NOT NULL COMMENT '实际付款人会员ID',
    `amount` int NOT NULL COMMENT '支付金额(分)',
    `channel` varchar(16) NOT NULL COMMENT '支付渠道(mock/wechat)',
    `status` tinyint NOT NULL DEFAULT 0 COMMENT '支付状态(0-待支付 1-成功 2-失败 3-已退款)',
    `third_party_no` varchar(64) NULL COMMENT '三方支付单号',
    `prepay_id` varchar(64) NULL COMMENT '微信预支付会话ID',
    `expire_time` datetime NULL COMMENT '支付尝试租约结束时间',
    `paid_time` datetime NULL COMMENT '支付成功时间',
    `create_by` bigint NULL COMMENT '创建人ID',
    `create_time` datetime NULL COMMENT '创建时间',
    `update_by` bigint NULL COMMENT '修改人ID',
    `update_time` datetime NULL COMMENT '更新时间',
    `is_deleted` tinyint NOT NULL DEFAULT 0 COMMENT '逻辑删除标识(1-已删除 0-未删除)',
    `active_order_id` bigint GENERATED ALWAYS AS (
        CASE WHEN `status` = 0 AND `is_deleted` = 0 THEN `order_id` ELSE NULL END
    ) VIRTUAL COMMENT '有效待支付订单ID',
    PRIMARY KEY (`id`) USING BTREE,
    UNIQUE INDEX `uk_payment_no` (`payment_no`) USING BTREE,
    UNIQUE INDEX `uk_payment_active_order_id` (`active_order_id`) USING BTREE,
    UNIQUE INDEX `uk_payment_third_party_no` (`third_party_no`) USING BTREE,
    INDEX `idx_payment_order_id` (`order_id`) USING BTREE,
    INDEX `idx_payment_member_id` (`member_id`) USING BTREE,
    INDEX `idx_payment_payer_member_id` (`payer_member_id`) USING BTREE,
    INDEX `idx_payment_status` (`status`) USING BTREE,
    INDEX `idx_payment_reconcile` (`status`, `is_deleted`, `update_time`, `id`) USING BTREE,
    CONSTRAINT `fk_biz_payment_order` FOREIGN KEY (`order_id`) REFERENCES `biz_order` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_biz_payment_member` FOREIGN KEY (`member_id`) REFERENCES `member` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_biz_payment_payer_member` FOREIGN KEY (`payer_member_id`) REFERENCES `member` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `chk_biz_payment_amount` CHECK (`amount` > 0),
    CONSTRAINT `chk_biz_payment_channel` CHECK (`channel` IN ('mock', 'wechat')),
    CONSTRAINT `chk_biz_payment_status` CHECK (`status` IN (0, 1, 2, 3)),
    CONSTRAINT `chk_biz_payment_is_deleted` CHECK (`is_deleted` IN (0, 1))
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COMMENT = '支付流水表';

ALTER TABLE `biz_order`
    ADD COLUMN `paid_payment_id` bigint NULL COMMENT '完成订单的支付流水ID' AFTER `pay_time`,
    ADD UNIQUE INDEX `uk_order_paid_payment_id` (`paid_payment_id`) USING BTREE,
    ADD CONSTRAINT `fk_biz_order_paid_payment`
        FOREIGN KEY (`paid_payment_id`) REFERENCES `biz_payment` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT;

CREATE TABLE `biz_refund` (
    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
    `refund_no` varchar(32) NOT NULL COMMENT '退款流水号',
    `payment_id` bigint NOT NULL COMMENT '支付流水ID',
    `order_id` bigint NOT NULL COMMENT '订单ID',
    `member_id` bigint NOT NULL COMMENT '会员ID',
    `amount` int NOT NULL COMMENT '退款金额(分)',
    `reason` varchar(255) NOT NULL COMMENT '退款原因',
    `status` tinyint NOT NULL DEFAULT 0 COMMENT '退款状态(0-处理中 1-成功 2-失败 3-已关闭待换单 4-异常待人工)',
    `third_party_no` varchar(64) NULL COMMENT '三方退款单号',
    `closed_refund_nos` varchar(1024) NULL COMMENT '已结束或已换号的历史商户退款单号(逗号分隔)',
    `refund_time` datetime NULL COMMENT '退款成功时间',
    `create_by` bigint NULL COMMENT '创建人ID',
    `create_time` datetime NULL COMMENT '创建时间',
    `update_by` bigint NULL COMMENT '修改人ID',
    `update_time` datetime NULL COMMENT '更新时间',
    `is_deleted` tinyint NOT NULL DEFAULT 0 COMMENT '逻辑删除标识(1-已删除 0-未删除)',
    PRIMARY KEY (`id`) USING BTREE,
    UNIQUE INDEX `uk_refund_no` (`refund_no`) USING BTREE,
    UNIQUE INDEX `uk_refund_payment_id` (`payment_id`) USING BTREE,
    UNIQUE INDEX `uk_refund_third_party_no` (`third_party_no`) USING BTREE,
    INDEX `idx_refund_order_id` (`order_id`) USING BTREE,
    INDEX `idx_refund_member_id` (`member_id`) USING BTREE,
    INDEX `idx_refund_status` (`status`) USING BTREE,
    INDEX `idx_refund_reconcile` (`status`, `is_deleted`, `update_time`, `id`) USING BTREE,
    CONSTRAINT `fk_biz_refund_payment` FOREIGN KEY (`payment_id`) REFERENCES `biz_payment` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_biz_refund_order` FOREIGN KEY (`order_id`) REFERENCES `biz_order` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_biz_refund_member` FOREIGN KEY (`member_id`) REFERENCES `member` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `chk_biz_refund_amount` CHECK (`amount` > 0),
    CONSTRAINT `chk_biz_refund_reason` CHECK (CHAR_LENGTH(TRIM(`reason`)) > 0),
    CONSTRAINT `chk_biz_refund_status` CHECK (`status` IN (0, 1, 2, 3, 4)),
    CONSTRAINT `chk_biz_refund_is_deleted` CHECK (`is_deleted` IN (0, 1))
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COMMENT = '退款流水表';

CREATE TABLE `biz_proxy_pay_share` (
    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
    `order_id` bigint NOT NULL COMMENT '订单ID',
    `owner_member_id` bigint NOT NULL COMMENT '订单购买人会员ID',
    `token_hash` char(64) NOT NULL COMMENT '分享令牌SHA-256',
    `expires_at` datetime NOT NULL COMMENT '分享截止时间',
    `create_by` bigint NULL COMMENT '创建人ID',
    `create_time` datetime NULL COMMENT '创建时间',
    `update_by` bigint NULL COMMENT '修改人ID',
    `update_time` datetime NULL COMMENT '更新时间',
    `is_deleted` tinyint NOT NULL DEFAULT 0 COMMENT '逻辑删除标识(1-已删除 0-未删除)',
    PRIMARY KEY (`id`) USING BTREE,
    UNIQUE INDEX `uk_proxy_pay_share_token_hash` (`token_hash`) USING BTREE,
    INDEX `idx_proxy_pay_share_order_id` (`order_id`) USING BTREE,
    CONSTRAINT `fk_proxy_pay_share_order` FOREIGN KEY (`order_id`) REFERENCES `biz_order` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_proxy_pay_share_owner_member` FOREIGN KEY (`owner_member_id`) REFERENCES `member` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `chk_proxy_pay_share_is_deleted` CHECK (`is_deleted` IN (0, 1))
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COMMENT = '好友代付分享凭证表';

-- 订单管理下新增退款按钮，并授权 ROOT / ADMIN。
INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`)
VALUES (3105, 3101, '0,3100,3101', '订单退款', 'B', NULL, '', NULL, 'biz:payment:refund', NULL, NULL, 1, 4, '', NULL, now(), now(), NULL);

INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (1, 3105), (2, 3105);


-- Baseline source: biz_phase5.sql
-- 悦己阶段5：会员等级、积分、优惠券
USE youlai_admin;

SET NAMES utf8mb4;

CREATE TABLE `member_level` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `name` varchar(64) NOT NULL COMMENT '等级名称',
    `threshold_amount` int NOT NULL DEFAULT 0 COMMENT '累计实付门槛(分)',
    `discount_rate` int NOT NULL DEFAULT 10000 COMMENT '折扣率(万分比)',
    `status` tinyint NOT NULL DEFAULT 1 COMMENT '状态(1-启用 0-停用)',
    `sort` smallint NOT NULL DEFAULT 0,
    `create_by` bigint NULL,
    `create_time` datetime NULL,
    `update_by` bigint NULL,
    `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    `active_threshold_amount` int GENERATED ALWAYS AS (
        CASE WHEN `is_deleted` = 0 THEN `threshold_amount` ELSE NULL END
    ) STORED,
    PRIMARY KEY (`id`),
    INDEX `idx_member_level_threshold` (`threshold_amount`),
    UNIQUE INDEX `uk_member_level_active_threshold` (`active_threshold_amount`),
    CONSTRAINT `chk_member_level_name` CHECK (CHAR_LENGTH(TRIM(`name`)) > 0),
    CONSTRAINT `chk_member_level_threshold` CHECK (`threshold_amount` >= 0),
    CONSTRAINT `chk_member_level_discount` CHECK (`discount_rate` BETWEEN 1 AND 10000),
    CONSTRAINT `chk_member_level_status` CHECK (`status` IN (0, 1)),
    CONSTRAINT `chk_member_level_is_deleted` CHECK (`is_deleted` IN (0, 1))
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='会员等级';

INSERT INTO `member_level`
    (`name`, `threshold_amount`, `discount_rate`, `status`, `sort`, `create_time`, `update_time`, `is_deleted`)
VALUES
    ('普通会员', 0, 10000, 1, 1, now(), now(), 0),
    ('白银会员', 5000000, 9000, 1, 2, now(), now(), 0),
    ('黄金会员', 10000000, 8000, 1, 3, now(), now(), 0),
    ('白金会员', 20000000, 7000, 1, 4, now(), now(), 0);

ALTER TABLE `member`
    ADD COLUMN `total_spent` int NOT NULL DEFAULT 0 COMMENT '累计完成订单实付(分)' AFTER `level_id`;

ALTER TABLE `member`
    ADD CONSTRAINT `chk_member_total_spent` CHECK (`total_spent` >= 0);

UPDATE `member` m
LEFT JOIN (
    SELECT `member_id`, COALESCE(SUM(`pay_amount`), 0) AS `total_spent`
    FROM `biz_order`
    WHERE `status` = 3 AND `is_deleted` = 0
    GROUP BY `member_id`
) o ON o.`member_id` = m.`id`
SET m.`total_spent` = COALESCE(o.`total_spent`, 0),
    m.`level_id` = COALESCE(m.`level_id`, (SELECT MIN(`id`) FROM `member_level` WHERE `threshold_amount` = 0));

ALTER TABLE `member`
    ADD CONSTRAINT `fk_member_level`
    FOREIGN KEY (`level_id`) REFERENCES `member_level` (`id`)
    ON UPDATE RESTRICT ON DELETE RESTRICT;

CREATE TABLE `member_points_log` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `member_id` bigint NOT NULL,
    `change_points` int NOT NULL,
    `balance_after` int NOT NULL,
    `biz_type` varchar(32) NOT NULL,
    `biz_id` varchar(64) NOT NULL,
    `order_id` bigint NULL,
    `remark` varchar(255) NULL,
    `create_by` bigint NULL,
    `create_time` datetime NULL,
    `update_by` bigint NULL,
    `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `uk_points_biz` (`member_id`, `biz_type`, `biz_id`),
    INDEX `idx_points_member_time` (`member_id`, `create_time`),
    INDEX `idx_points_order` (`order_id`),
    CONSTRAINT `fk_points_member`
        FOREIGN KEY (`member_id`) REFERENCES `member` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_points_order`
        FOREIGN KEY (`order_id`) REFERENCES `biz_order` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `chk_points_balance` CHECK (`balance_after` >= 0),
    CONSTRAINT `chk_points_biz_type` CHECK (`biz_type` IN (
        'INIT', 'ORDER_DEDUCT', 'ORDER_CANCEL_RETURN', 'ORDER_REFUND_RETURN', 'ORDER_EARN'
    )),
    CONSTRAINT `chk_points_is_deleted` CHECK (`is_deleted` IN (0, 1))
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='会员积分流水';

INSERT INTO `member_points_log`
    (`member_id`, `change_points`, `balance_after`, `biz_type`, `biz_id`, `remark`, `create_time`, `update_time`, `is_deleted`)
SELECT `id`, `points`, `points`, 'INIT', 'phase5', '阶段5上线初始余额', now(), now(), 0
FROM `member` WHERE `points` <> 0 AND `is_deleted` = 0;

CREATE TABLE `marketing_points_rule` (
    `id` bigint NOT NULL,
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
    CONSTRAINT `chk_marketing_points_rule_earn` CHECK (`earn_per_yuan` BETWEEN 0 AND 10000),
    CONSTRAINT `chk_marketing_points_rule_redeem`
        CHECK (`redeem_points_per_yuan` BETWEEN 1 AND 1000000),
    CONSTRAINT `chk_marketing_points_rule_rate` CHECK (`max_deduct_rate` BETWEEN 0 AND 10000),
    CONSTRAINT `chk_marketing_points_rule_is_deleted` CHECK (`is_deleted` = 0)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='营销积分规则';

INSERT INTO `marketing_points_rule`
    (`id`, `earn_per_yuan`, `redeem_points_per_yuan`, `max_deduct_rate`,
     `create_time`, `update_time`, `is_deleted`)
VALUES (1, 1, 100, 5000, now(), now(), 0);

CREATE TABLE `coupon` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `name` varchar(100) NOT NULL,
    `type` varchar(24) NOT NULL COMMENT 'FULL_REDUCTION/DISCOUNT/EXCHANGE',
    `scope_type` varchar(16) NOT NULL DEFAULT 'ALL' COMMENT 'ALL/CATEGORY/PRODUCT',
    `threshold_amount` int NOT NULL DEFAULT 0,
    `discount_amount` int NOT NULL DEFAULT 0,
    `discount_rate` int NOT NULL DEFAULT 10000,
    `max_discount_amount` int NULL,
    `exchange_sku_id` bigint NULL,
    `claim_start` datetime NOT NULL,
    `claim_end` datetime NOT NULL,
    `valid_start` datetime NOT NULL,
    `valid_end` datetime NOT NULL,
    `total_quantity` int NOT NULL,
    `issued_quantity` int NOT NULL DEFAULT 0,
    `per_member_limit` int NOT NULL DEFAULT 1,
    `status` tinyint NOT NULL DEFAULT 0 COMMENT '0-草稿 1-启用 2-停用',
    `create_by` bigint NULL,
    `create_time` datetime NULL,
    `update_by` bigint NULL,
    `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    INDEX `idx_coupon_status_time` (`status`, `claim_start`, `claim_end`),
    CONSTRAINT `fk_coupon_exchange_sku`
        FOREIGN KEY (`exchange_sku_id`) REFERENCES `product_sku` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `chk_coupon_name` CHECK (CHAR_LENGTH(TRIM(`name`)) > 0),
    CONSTRAINT `chk_coupon_type` CHECK (`type` IN ('FULL_REDUCTION', 'DISCOUNT', 'EXCHANGE')),
    CONSTRAINT `chk_coupon_scope_type` CHECK (`scope_type` IN ('ALL', 'CATEGORY', 'PRODUCT')),
    CONSTRAINT `chk_coupon_amounts` CHECK (
        `threshold_amount` >= 0 AND `discount_amount` >= 0 AND
        `discount_rate` BETWEEN 1 AND 10000 AND
        (`max_discount_amount` IS NULL OR `max_discount_amount` >= 1)
    ),
    CONSTRAINT `chk_coupon_times` CHECK (
        `claim_start` <= `claim_end` AND `valid_start` <= `valid_end` AND `claim_end` <= `valid_end`
    ),
    CONSTRAINT `chk_coupon_quantities` CHECK (
        `total_quantity` >= 1 AND `issued_quantity` BETWEEN 0 AND `total_quantity` AND
        `per_member_limit` BETWEEN 1 AND `total_quantity`
    ),
    CONSTRAINT `chk_coupon_exchange` CHECK (
        (`type` = 'FULL_REDUCTION' AND `discount_amount` > 0 AND `exchange_sku_id` IS NULL) OR
        (`type` = 'DISCOUNT' AND `discount_rate` < 10000 AND `exchange_sku_id` IS NULL) OR
        (`type` = 'EXCHANGE' AND `scope_type` = 'PRODUCT' AND `exchange_sku_id` IS NOT NULL)
    ),
    CONSTRAINT `chk_coupon_status` CHECK (`status` IN (0, 1, 2)),
    CONSTRAINT `chk_coupon_is_deleted` CHECK (`is_deleted` IN (0, 1))
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='优惠券模板';

CREATE TABLE `coupon_scope` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `coupon_id` bigint NOT NULL,
    `target_type` varchar(16) NOT NULL,
    `target_id` bigint NOT NULL,
    `create_by` bigint NULL,
    `create_time` datetime NULL,
    `update_by` bigint NULL,
    `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    `active_coupon_id` bigint GENERATED ALWAYS AS (
        CASE WHEN `is_deleted` = 0 THEN `coupon_id` ELSE NULL END
    ) STORED,
    PRIMARY KEY (`id`),
    INDEX `idx_coupon_scope_coupon_active` (`coupon_id`, `is_deleted`),
    UNIQUE INDEX `uk_coupon_scope_active` (`active_coupon_id`, `target_type`, `target_id`),
    CONSTRAINT `fk_coupon_scope_coupon`
        FOREIGN KEY (`coupon_id`) REFERENCES `coupon` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `chk_coupon_scope_target_type` CHECK (`target_type` IN ('CATEGORY', 'PRODUCT')),
    CONSTRAINT `chk_coupon_scope_is_deleted` CHECK (`is_deleted` IN (0, 1))
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='优惠券适用范围';

CREATE TABLE `member_coupon` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `coupon_id` bigint NOT NULL,
    `member_id` bigint NOT NULL,
    `status` tinyint NOT NULL DEFAULT 0 COMMENT '0-未用 1-锁定 2-已用 3-过期',
    `order_id` bigint NULL,
    `claimed_at` datetime NOT NULL,
    `used_at` datetime NULL,
    `create_by` bigint NULL,
    `create_time` datetime NULL,
    `update_by` bigint NULL,
    `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    INDEX `idx_member_coupon_status` (`member_id`, `status`),
    INDEX `idx_member_coupon_member_template` (`member_id`, `coupon_id`, `is_deleted`),
    INDEX `idx_member_coupon_template` (`coupon_id`),
    INDEX `idx_member_coupon_order` (`order_id`),
    CONSTRAINT `fk_member_coupon_coupon`
        FOREIGN KEY (`coupon_id`) REFERENCES `coupon` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_member_coupon_member`
        FOREIGN KEY (`member_id`) REFERENCES `member` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_member_coupon_order`
        FOREIGN KEY (`order_id`) REFERENCES `biz_order` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `chk_member_coupon_status` CHECK (`status` IN (0, 1, 2, 3)),
    CONSTRAINT `chk_member_coupon_state` CHECK (
        (`status` IN (0, 3) AND `order_id` IS NULL AND `used_at` IS NULL) OR
        (`status` = 1 AND `order_id` IS NOT NULL AND `used_at` IS NULL) OR
        (`status` = 2 AND `order_id` IS NOT NULL AND `used_at` IS NOT NULL)
    ),
    CONSTRAINT `chk_member_coupon_is_deleted` CHECK (`is_deleted` IN (0, 1))
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='会员优惠券';

ALTER TABLE `biz_order`
    ADD COLUMN `member_level_id` bigint NULL COMMENT '下单会员等级' AFTER `discount_amount`,
    ADD COLUMN `member_discount` int NOT NULL DEFAULT 0 COMMENT '会员优惠(分)' AFTER `member_level_id`,
    ADD COLUMN `member_coupon_id` bigint NULL COMMENT '会员券ID' AFTER `member_discount`,
    ADD COLUMN `coupon_amount` int NOT NULL DEFAULT 0 COMMENT '优惠券抵扣(分)' AFTER `member_coupon_id`,
    ADD COLUMN `points_used` int NOT NULL DEFAULT 0 COMMENT '使用积分' AFTER `coupon_amount`,
    ADD COLUMN `points_deduct` int NOT NULL DEFAULT 0 COMMENT '积分抵扣(分)' AFTER `points_used`,
    ADD INDEX `idx_order_member_coupon` (`member_coupon_id`),
    ADD CONSTRAINT `fk_order_member_level`
        FOREIGN KEY (`member_level_id`) REFERENCES `member_level` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    ADD CONSTRAINT `chk_biz_order_benefits` CHECK (
        `member_discount` >= 0 AND `coupon_amount` >= 0 AND
        `points_used` >= 0 AND `points_deduct` >= 0 AND
        `discount_amount` = `member_discount` + `coupon_amount` + `points_deduct`
    );


-- Baseline source: biz_phase6.sql
-- 悦己阶段6：预约生命周期、时段容量与操作日志
USE youlai_admin;

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `appointment_config` (
    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '配置ID',
    `slot_capacity` int NOT NULL DEFAULT 1 COMMENT '每个时间段最多预约人数',
    `create_by` bigint NULL COMMENT '创建人ID',
    `create_time` datetime NULL COMMENT '创建时间',
    `update_by` bigint NULL COMMENT '更新人ID',
    `update_time` datetime NULL COMMENT '更新时间',
    `is_deleted` tinyint NOT NULL DEFAULT 0 COMMENT '逻辑删除标识(0-未删除 1-已删除)',
    PRIMARY KEY (`id`),
    CONSTRAINT `chk_appointment_slot_capacity` CHECK (`slot_capacity` >= 1),
    CONSTRAINT `chk_appointment_config_is_deleted` CHECK (`is_deleted` = 0)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='预约配置';

INSERT INTO `appointment_config`
  (`id`, `slot_capacity`, `create_time`, `update_time`, `is_deleted`)
VALUES
  (1, 1, NOW(), NOW(), 0)
ON DUPLICATE KEY UPDATE `id` = `id`;

CREATE TABLE IF NOT EXISTS `appointment` (
    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '预约ID',
    `member_id` bigint NOT NULL COMMENT '会员ID',
    `appointment_date` date NOT NULL COMMENT '预约日期',
    `appointment_time` time NOT NULL COMMENT '预约时间',
    `scene_type` varchar(20) NOT NULL DEFAULT 'CONSULTATION' COMMENT '预约场景(CONSULTATION-面诊 ORDER-订单)',
    `order_id` bigint NULL COMMENT '关联订单ID',
    `status` tinyint NOT NULL DEFAULT 0 COMMENT '预约状态(0-待到店 1-已完成 2-已取消)',
    `complete_time` datetime NULL COMMENT '服务完成时间',
    `cancel_time` datetime NULL COMMENT '取消时间',
    `cancel_reason` varchar(255) NULL COMMENT '取消原因',
    `create_by` bigint NULL COMMENT '创建人ID',
    `create_time` datetime NULL COMMENT '创建时间',
    `update_by` bigint NULL COMMENT '更新人ID',
    `update_time` datetime NULL COMMENT '更新时间',
    `is_deleted` tinyint NOT NULL DEFAULT 0 COMMENT '逻辑删除标识(0-未删除 1-已删除)',
    `active_order_id` bigint GENERATED ALWAYS AS (
      CASE
        WHEN `is_deleted` = 0 AND `scene_type` = 'ORDER' AND `status` IN (0, 1) THEN `order_id`
        ELSE NULL
      END
    ) STORED COMMENT '非取消订单预约唯一键',
    `booked_member_slot_key` varchar(80) GENERATED ALWAYS AS (
      CASE
        WHEN `is_deleted` = 0 AND `status` = 0
          THEN CONCAT(`member_id`, '#', `appointment_date`, '#', `appointment_time`)
        ELSE NULL
      END
    ) STORED COMMENT '待到店会员时段唯一键',
    PRIMARY KEY (`id`),
    UNIQUE INDEX `uk_appointment_active_order` (`active_order_id`),
    UNIQUE INDEX `uk_appointment_booked_member_slot` (`booked_member_slot_key`),
    INDEX `idx_appointment_member_status_time` (`member_id`, `status`, `appointment_date`, `appointment_time`),
    INDEX `idx_appointment_status_time` (`status`, `appointment_date`, `appointment_time`),
    INDEX `idx_appointment_order_status` (`order_id`, `status`),
    CONSTRAINT `chk_appointment_status` CHECK (`status` IN (0, 1, 2)),
    CONSTRAINT `chk_appointment_scene_order` CHECK (
      (`scene_type` = 'CONSULTATION' AND `order_id` IS NULL) OR
      (`scene_type` = 'ORDER' AND `order_id` IS NOT NULL)
    )
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='预约记录';

CREATE TABLE IF NOT EXISTS `appointment_operation_log` (
    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '操作日志ID',
    `appointment_id` bigint NOT NULL COMMENT '预约ID',
    `action` varchar(20) NOT NULL COMMENT '操作(CREATE/RESCHEDULE/CANCEL/COMPLETE)',
    `operator_type` varchar(20) NOT NULL COMMENT '操作者类型(MEMBER/ADMIN/SYSTEM)',
    `operator_id` bigint NULL COMMENT '会员或管理员ID',
    `before_date` date NULL COMMENT '操作前预约日期',
    `before_time` time NULL COMMENT '操作前预约时间',
    `after_date` date NULL COMMENT '操作后预约日期',
    `after_time` time NULL COMMENT '操作后预约时间',
    `reason` varchar(255) NULL COMMENT '操作原因',
    `create_by` bigint NULL COMMENT '创建人ID',
    `create_time` datetime NULL COMMENT '创建时间',
    `update_by` bigint NULL COMMENT '更新人ID',
    `update_time` datetime NULL COMMENT '更新时间',
    `is_deleted` tinyint NOT NULL DEFAULT 0 COMMENT '逻辑删除标识(0-未删除 1-已删除)',
    PRIMARY KEY (`id`),
    INDEX `idx_appointment_operation_log_appointment` (`appointment_id`, `create_time`, `id`),
    CONSTRAINT `chk_appointment_operation_action` CHECK (`action` IN ('CREATE', 'RESCHEDULE', 'CANCEL', 'COMPLETE')),
    CONSTRAINT `chk_appointment_operator_type` CHECK (`operator_type` IN ('MEMBER', 'ADMIN', 'SYSTEM')),
    CONSTRAINT `chk_appointment_operation_is_deleted` CHECK (`is_deleted` = 0)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='预约操作日志';


-- Baseline source: biz_phase7.sql
-- 悦己阶段7：首页装修与拼团
USE youlai_admin;

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `decoration_banner` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `image_url` varchar(500) NOT NULL COMMENT 'Banner图片',
    `link_url` varchar(500) NULL COMMENT '跳转链接',
    `sort` int NOT NULL DEFAULT 0,
    `status` tinyint NOT NULL DEFAULT 1 COMMENT '0-下线 1-上线',
    `create_by` bigint NULL, `create_time` datetime NULL,
    `update_by` bigint NULL, `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`), INDEX `idx_banner_status_sort` (`status`, `sort`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='首页Banner';

CREATE TABLE IF NOT EXISTS `decoration_notice` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `title` varchar(100) NOT NULL,
    `content` text NOT NULL,
    `sort` int NOT NULL DEFAULT 0,
    `status` tinyint NOT NULL DEFAULT 1 COMMENT '0-下线 1-上线',
    `create_by` bigint NULL, `create_time` datetime NULL,
    `update_by` bigint NULL, `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`), INDEX `idx_decoration_notice_status_sort` (`status`, `sort`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='首页公告';

CREATE TABLE IF NOT EXISTS `decoration_brand` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `content` longtext NOT NULL,
    `create_by` bigint NULL, `create_time` datetime NULL,
    `update_by` bigint NULL, `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='品牌背书';

INSERT INTO `decoration_brand` (`id`, `content`, `create_time`, `update_time`, `is_deleted`)
SELECT 1, '', NOW(), NOW(), 0
WHERE NOT EXISTS (SELECT 1 FROM `decoration_brand` WHERE `id` = 1);

CREATE TABLE IF NOT EXISTS `group_buy_activity` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `sku_id` bigint NOT NULL,
    `name` varchar(100) NOT NULL,
    `group_price` int NOT NULL COMMENT '拼团价(分)',
    `required_people` int NOT NULL COMMENT '成团人数',
    `start_time` datetime NOT NULL,
    `end_time` datetime NOT NULL,
    `group_duration_minutes` int NOT NULL COMMENT '单团有效分钟数',
    `status` tinyint NOT NULL DEFAULT 1 COMMENT '0-下线 1-上线',
    `create_by` bigint NULL, `create_time` datetime NULL,
    `update_by` bigint NULL, `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    INDEX `idx_group_activity_sku` (`sku_id`),
    INDEX `idx_group_activity_status_time` (`status`, `start_time`, `end_time`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='拼团活动';

CREATE TABLE IF NOT EXISTS `group_buy_group` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `activity_id` bigint NOT NULL,
    `leader_member_id` bigint NOT NULL,
    `required_people` int NOT NULL,
    `group_price` int NOT NULL COMMENT '拼团价快照(分)',
    `expire_time` datetime NOT NULL,
    `status` tinyint NOT NULL DEFAULT 0 COMMENT '0-拼团中 1-已成团 2-已失败',
    `success_time` datetime NULL,
    `fail_time` datetime NULL,
    `create_by` bigint NULL, `create_time` datetime NULL,
    `update_by` bigint NULL, `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    INDEX `idx_group_activity` (`activity_id`),
    INDEX `idx_group_status_expire` (`status`, `expire_time`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='拼团实例';

CREATE TABLE IF NOT EXISTS `group_buy_member` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `group_id` bigint NOT NULL,
    `member_id` bigint NOT NULL,
    `order_id` bigint NOT NULL,
    `status` tinyint NOT NULL DEFAULT 0 COMMENT '0-待付款 1-已付款 2-已退款 3-已取消',
    `paid_time` datetime NULL,
    `refund_time` datetime NULL,
    `create_by` bigint NULL, `create_time` datetime NULL,
    `update_by` bigint NULL, `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `uk_group_member` (`group_id`, `member_id`),
    UNIQUE INDEX `uk_group_order` (`order_id`),
    INDEX `idx_group_member_status` (`group_id`, `status`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='拼团成员';



-- Baseline source: biz_phase8_distribution.sql
-- 悦己阶段8A+8B：分销身份与佣金账本
USE youlai_admin;

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `distribution_agent_type` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `name` varchar(64) NOT NULL,
    `status` tinyint NOT NULL DEFAULT 1 COMMENT '0-停用 1-启用',
    `sort` smallint NOT NULL DEFAULT 0,
    `create_by` bigint NULL, `create_time` datetime NULL,
    `update_by` bigint NULL, `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`), INDEX `idx_distribution_type_status_sort` (`status`, `sort`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='代理类型';

CREATE TABLE IF NOT EXISTS `distribution_level` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `name` varchar(64) NOT NULL,
    `rank` smallint NOT NULL,
    `upgrade_sales_amount` int NOT NULL DEFAULT 0 COMMENT '直属业绩升级门槛(分)',
    `distribution_depth` tinyint NOT NULL DEFAULT 1 COMMENT '分销深度(1/2)',
    `level1_rate_bps` int NOT NULL DEFAULT 0 COMMENT '一级佣金万分比',
    `level2_rate_bps` int NOT NULL DEFAULT 0 COMMENT '二级佣金万分比',
    `status` tinyint NOT NULL DEFAULT 1 COMMENT '0-停用 1-启用',
    `sort` smallint NOT NULL DEFAULT 0,
    `create_by` bigint NULL, `create_time` datetime NULL,
    `update_by` bigint NULL, `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `uk_distribution_level_rank` (`rank`),
    INDEX `idx_distribution_level_status_sort` (`status`, `sort`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='分销等级';

CREATE TABLE IF NOT EXISTS `distribution_agent` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `member_id` bigint NOT NULL,
    `real_name` varchar(64) NOT NULL,
    `mobile` varchar(20) NULL,
    `wechat` varchar(64) NULL,
    `contact_remark` varchar(255) NULL,
    `type_id` bigint NULL,
    `level_id` bigint NULL,
    `parent_agent_id` bigint NULL,
    `invite_code` varchar(16) NOT NULL,
    `custom_level1_rate_bps` int NULL,
    `custom_level2_rate_bps` int NULL,
    `direct_verified_sales` int NOT NULL DEFAULT 0 COMMENT '直属有效销售额(分)',
    `status` tinyint NOT NULL DEFAULT 0 COMMENT '0-待审核 1-已通过 2-已驳回 3-已禁用',
    `apply_time` datetime NULL,
    `audit_time` datetime NULL,
    `audit_by` bigint NULL,
    `audit_remark` varchar(255) NULL,
    `create_by` bigint NULL, `create_time` datetime NULL,
    `update_by` bigint NULL, `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `uk_distribution_agent_member` (`member_id`),
    UNIQUE INDEX `uk_distribution_agent_invite` (`invite_code`),
    INDEX `idx_distribution_agent_parent` (`parent_agent_id`),
    INDEX `idx_distribution_agent_type_level_status` (`type_id`, `level_id`, `status`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='分销代理商';

CREATE TABLE IF NOT EXISTS `distribution_referral` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `member_id` bigint NOT NULL,
    `referrer_agent_id` bigint NOT NULL,
    `bound_time` datetime NOT NULL,
    `frozen_time` datetime NULL,
    `create_by` bigint NULL, `create_time` datetime NULL,
    `update_by` bigint NULL, `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `uk_distribution_referral_member` (`member_id`),
    INDEX `idx_distribution_referral_agent` (`referrer_agent_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='会员推荐关系';

CREATE TABLE IF NOT EXISTS `distribution_commission` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `order_id` bigint NOT NULL,
    `order_no` varchar(32) NOT NULL,
    `buyer_member_id` bigint NOT NULL,
    `beneficiary_agent_id` bigint NOT NULL,
    `source_agent_id` bigint NOT NULL,
    `depth` tinyint NOT NULL COMMENT '佣金层级(1/2)',
    `base_amount` int NOT NULL,
    `rate_bps` int NOT NULL,
    `commission_amount` int NOT NULL,
    `agent_level_id` bigint NULL,
    `agent_level_name` varchar(64) NULL,
    `status` tinyint NOT NULL DEFAULT 0 COMMENT '0-待结算 1-可提现 2-已冲销',
    `paid_time` datetime NOT NULL,
    `available_time` datetime NULL,
    `reversed_time` datetime NULL,
    `create_by` bigint NULL, `create_time` datetime NULL,
    `update_by` bigint NULL, `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `uk_distribution_commission_order_agent_depth` (`order_id`, `beneficiary_agent_id`, `depth`),
    INDEX `idx_distribution_commission_agent_status` (`beneficiary_agent_id`, `status`),
    INDEX `idx_distribution_commission_order` (`order_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='分销佣金账本';

CREATE TABLE IF NOT EXISTS `distribution_direct_sales` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `order_id` bigint NOT NULL,
    `buyer_member_id` bigint NOT NULL,
    `agent_id` bigint NOT NULL,
    `referral_id` bigint NOT NULL,
    `amount` int NOT NULL,
    `status` tinyint NOT NULL DEFAULT 0 COMMENT '0-待核销 1-已计入 2-已冲销',
    `paid_time` datetime NOT NULL,
    `applied_time` datetime NULL,
    `reversed_time` datetime NULL,
    `create_by` bigint NULL, `create_time` datetime NULL,
    `update_by` bigint NULL, `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `uk_distribution_direct_sales_order` (`order_id`),
    INDEX `idx_distribution_direct_sales_agent_status` (`agent_id`, `status`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='代理直属业绩账本';

CREATE TABLE IF NOT EXISTS `distribution_agent_log` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `agent_id` bigint NOT NULL,
    `action` varchar(32) NOT NULL,
    `before_value` json NULL,
    `after_value` json NULL,
    `reason` varchar(255) NOT NULL,
    `operator_id` bigint NULL,
    `create_by` bigint NULL, `create_time` datetime NULL,
    `update_by` bigint NULL, `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`), INDEX `idx_distribution_agent_log_agent_time` (`agent_id`, `create_time`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='代理操作日志';


-- Baseline source: biz_phase8c_settlement.sql
-- 悦己阶段8C：分销结算与提现
USE youlai_admin;

SET NAMES utf8mb4;

ALTER TABLE `distribution_commission`
  CHANGE COLUMN `available_time` `pending_settlement_time` datetime NULL COMMENT '进入待结算时间',
  ADD COLUMN `settlement_id` bigint NULL COMMENT '结算单ID' AFTER `pending_settlement_time`,
  ADD COLUMN `settled_time` datetime NULL COMMENT '结算时间' AFTER `settlement_id`,
  ADD INDEX `idx_distribution_commission_settlement` (`settlement_id`),
  ADD INDEX `idx_distribution_commission_pending_time` (`status`, `pending_settlement_time`);

ALTER TABLE `distribution_commission`
  MODIFY COLUMN `status` tinyint NOT NULL DEFAULT 0 COMMENT '0-待核销 1-待结算 2-已冲销 3-已结算';

CREATE TABLE IF NOT EXISTS `distribution_settlement_config` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `cycle_type` varchar(16) NOT NULL COMMENT '结算周期',
    `settlement_day` tinyint NOT NULL COMMENT '结算星期或日期',
    `withdrawal_mode` varchar(16) NOT NULL COMMENT '提现模式',
    `single_limit_amount` int NOT NULL COMMENT '单笔提现上限(分)',
    `create_by` bigint NULL, `create_time` datetime NULL,
    `update_by` bigint NULL, `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='分销结算配置';

CREATE TABLE IF NOT EXISTS `distribution_settlement` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `settlement_no` varchar(32) NOT NULL,
    `agent_id` bigint NOT NULL,
    `profit_point` varchar(32) NOT NULL,
    `period_start` datetime NOT NULL,
    `period_end` datetime NOT NULL,
    `commission_count` int NOT NULL,
    `amount` int NOT NULL COMMENT '结算金额(分)',
    `settled_time` datetime NOT NULL,
    `create_by` bigint NULL, `create_time` datetime NULL,
    `update_by` bigint NULL, `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `uk_distribution_settlement_no` (`settlement_no`),
    UNIQUE INDEX `uk_distribution_settlement_agent_period` (`agent_id`,`profit_point`,`period_start`,`period_end`),
    INDEX `idx_distribution_settlement_time` (`settled_time`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='分销结算单';

CREATE TABLE IF NOT EXISTS `distribution_withdrawal` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `withdrawal_no` varchar(32) NOT NULL,
    `agent_id` bigint NOT NULL,
    `member_id` bigint NOT NULL,
    `source_mode` varchar(16) NOT NULL,
    `amount` int NOT NULL COMMENT '提现金额(分)',
    `openid_snapshot` varchar(64) NOT NULL,
    `status` tinyint NOT NULL DEFAULT 0 COMMENT '0-待审核 1-待打款 2-已驳回 3-已打款',
    `review_by` bigint NULL, `review_time` datetime NULL, `review_reason` varchar(255) NULL,
    `transfer_no` varchar(64) NULL, `paid_by` bigint NULL, `paid_time` datetime NULL,
    `paid_remark` varchar(255) NULL, `auto_period_end` datetime NULL,
    `create_by` bigint NULL, `create_time` datetime NULL,
    `update_by` bigint NULL, `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `uk_distribution_withdrawal_no` (`withdrawal_no`),
    UNIQUE INDEX `uk_distribution_withdrawal_auto_period` (`agent_id`,`source_mode`,`auto_period_end`),
    INDEX `idx_distribution_withdrawal_agent_status` (`agent_id`,`status`),
    INDEX `idx_distribution_withdrawal_status_time` (`status`,`create_time`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='分销提现单';

INSERT INTO `distribution_settlement_config`
  (`id`,`cycle_type`,`settlement_day`,`withdrawal_mode`,`single_limit_amount`,`create_time`,`update_time`,`is_deleted`)
SELECT 1,'MONTH',1,'APPLY',1000000,NOW(),NOW(),0
WHERE NOT EXISTS (SELECT 1 FROM `distribution_settlement_config` WHERE `is_deleted`=0);


-- Baseline source: biz_phase8d_distribution_task.sql
-- 悦己阶段8D：分销任务管理
USE youlai_admin;

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `distribution_task` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `name` varchar(100) NOT NULL COMMENT '任务名称',
    `description` text NULL COMMENT '任务描述和要求',
    `metric_type` varchar(24) NOT NULL COMMENT 'SALES_AMOUNT/ORDER_COUNT',
    `target_value` int NOT NULL COMMENT '目标值(分或订单数)',
    `start_time` datetime NOT NULL,
    `end_time` datetime NOT NULL,
    `assignment_scope` varchar(16) NOT NULL COMMENT 'ALL/LEVEL/AGENT',
    `target_level_id` bigint NULL,
    `target_agent_ids` json NULL COMMENT '指定代理ID数组',
    `status` tinyint NOT NULL DEFAULT 0 COMMENT '0-草稿 1-已发布 2-已取消',
    `published_time` datetime NULL,
    `cancelled_time` datetime NULL,
    `create_by` bigint NULL, `create_time` datetime NULL,
    `update_by` bigint NULL, `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    INDEX `idx_distribution_task_status_time` (`status`,`start_time`,`end_time`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='分销销售任务';

CREATE TABLE IF NOT EXISTS `distribution_task_assignee` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `task_id` bigint NOT NULL,
    `agent_id` bigint NOT NULL,
    `create_by` bigint NULL, `create_time` datetime NULL,
    `update_by` bigint NULL, `update_time` datetime NULL,
    `is_deleted` tinyint NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `uk_distribution_task_assignee` (`task_id`,`agent_id`),
    INDEX `idx_distribution_task_assignee_agent` (`agent_id`,`task_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='分销任务代理名单';


-- Baseline source: biz_phase8e_sales_analytics.sql
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


-- Baseline source: biz_dashboard.sql
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


-- Baseline source: menu_product.sql
-- ----------------------------------------------------
-- 商品管理菜单（阶段2）
-- 目录：商品管理(/product)，菜单：商品分类、商品列表
-- ----------------------------------------------------
USE youlai_admin;

SET NAMES utf8mb4;

INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`)
VALUES (3000, 0, '0', '商品管理', 'C', '', '/product', 'Layout', NULL, NULL, NULL, 1, 0, 'el-icon-Goods', '/product/goods', now(), now(), NULL);

INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`)
VALUES (3001, 3000, '0,3000', '商品列表', 'M', 'ProductGoods', 'goods', 'product/goods/index', NULL, NULL, 1, 1, 1, 'el-icon-Goods', NULL, now(), now(), NULL);

INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`)
VALUES (3002, 3000, '0,3000', '商品分类', 'M', 'ProductCategory', 'category', 'product/category/index', NULL, NULL, 1, 1, 2, 'el-icon-Menu', NULL, now(), now(), NULL);

-- 授权：1-ROOT(超管，后端对 userId=1 直接放行，保险起见仍插入)、2-ADMIN(系统管理员)
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (1, 3000), (1, 3001), (1, 3002);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (2, 3000), (2, 3001), (2, 3002);


-- Baseline source: menu_product_permissions.sql
-- 商品与分类按钮权限；可在已有阶段2数据库中单独执行。
USE youlai_admin;

SET NAMES utf8mb4;

INSERT INTO `sys_menu`
(`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`)
VALUES
(3003, 3001, '0,3000,3001', '商品查询', 'B', NULL, '', NULL, 'biz:product:list', NULL, NULL, 1, 1, '', NULL, now(), now(), NULL),
(3004, 3001, '0,3000,3001', '商品新增', 'B', NULL, '', NULL, 'biz:product:create', NULL, NULL, 1, 2, '', NULL, now(), now(), NULL),
(3005, 3001, '0,3000,3001', '商品编辑', 'B', NULL, '', NULL, 'biz:product:update', NULL, NULL, 1, 3, '', NULL, now(), now(), NULL),
(3006, 3001, '0,3000,3001', '商品删除', 'B', NULL, '', NULL, 'biz:product:delete', NULL, NULL, 1, 4, '', NULL, now(), now(), NULL),
(3007, 3001, '0,3000,3001', '商品上下架', 'B', NULL, '', NULL, 'biz:product:status', NULL, NULL, 1, 5, '', NULL, now(), now(), NULL),
(3010, 3002, '0,3000,3002', '分类查询', 'B', NULL, '', NULL, 'biz:product-category:list', NULL, NULL, 1, 1, '', NULL, now(), now(), NULL),
(3011, 3002, '0,3000,3002', '分类新增', 'B', NULL, '', NULL, 'biz:product-category:create', NULL, NULL, 1, 2, '', NULL, now(), now(), NULL),
(3012, 3002, '0,3000,3002', '分类编辑', 'B', NULL, '', NULL, 'biz:product-category:update', NULL, NULL, 1, 3, '', NULL, now(), now(), NULL),
(3013, 3002, '0,3000,3002', '分类删除', 'B', NULL, '', NULL, 'biz:product-category:delete', NULL, NULL, 1, 4, '', NULL, now(), now(), NULL)
ON DUPLICATE KEY UPDATE
`name` = VALUES(`name`), `perm` = VALUES(`perm`), `update_time` = now();

INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`)
SELECT roles.role_id, menus.menu_id
FROM (SELECT 1 AS role_id UNION ALL SELECT 2) roles
CROSS JOIN (
    SELECT 3003 AS menu_id UNION ALL SELECT 3004 UNION ALL SELECT 3005 UNION ALL SELECT 3006 UNION ALL SELECT 3007
    UNION ALL SELECT 3010 UNION ALL SELECT 3011 UNION ALL SELECT 3012 UNION ALL SELECT 3013
) menus;


-- Baseline source: menu_order.sql
-- ----------------------------------------------------
-- 订单管理菜单（阶段3）
-- 目录：订单管理(/order)，菜单：订单列表
-- ----------------------------------------------------
USE youlai_admin;

SET NAMES utf8mb4;

INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`)
VALUES (3100, 0, '0', '订单管理', 'C', '', '/order', 'Layout', NULL, NULL, NULL, 1, 1, 'el-icon-Document', '/order/index', now(), now(), NULL);

INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`)
VALUES (3101, 3100, '0,3100', '订单列表', 'M', 'BizOrder', 'index', 'order/index', NULL, NULL, 1, 1, 1, 'el-icon-Tickets', NULL, now(), now(), NULL);

INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`)
VALUES (3102, 3101, '0,3100,3101', '订单查询', 'B', NULL, '', NULL, 'biz:order:list', NULL, NULL, 1, 1, '', NULL, now(), now(), NULL);

INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`)
VALUES (3103, 3101, '0,3100,3101', '订单核销', 'B', NULL, '', NULL, 'biz:order:verify', NULL, NULL, 1, 2, '', NULL, now(), now(), NULL);

INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`)
VALUES (3104, 3101, '0,3100,3101', '订单导出', 'B', NULL, '', NULL, 'biz:order:export', NULL, NULL, 1, 3, '', NULL, now(), now(), NULL);

-- 授权：1-ROOT、2-ADMIN(admin 用户 role_id=2)
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (1, 3100), (1, 3101), (1, 3102), (1, 3103), (1, 3104);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (2, 3100), (2, 3101), (2, 3102), (2, 3103), (2, 3104);


-- Baseline source: menu_member.sql
-- 会员管理菜单（阶段4）
USE youlai_admin;

SET NAMES utf8mb4;

INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`)
VALUES (3200, 0, '0', '会员管理', 'C', '', '/member', 'Layout', NULL, NULL, NULL, 1, 2, 'el-icon-User', '/member/index', now(), now(), NULL);

INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`)
VALUES (3201, 3200, '0,3200', '会员列表', 'M', 'BizMember', 'index', 'member/index', NULL, NULL, 1, 1, 1, 'el-icon-UserFilled', NULL, now(), now(), NULL);

INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`)
VALUES (3202, 3201, '0,3200,3201', '会员查询', 'B', NULL, '', NULL, 'biz:member:list', NULL, NULL, 1, 1, '', NULL, now(), now(), NULL);

INSERT INTO `sys_menu` (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`, `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`)
VALUES (3203, 3201, '0,3200,3201', '会员编辑', 'B', NULL, '', NULL, 'biz:member:update', NULL, NULL, 1, 2, '', NULL, now(), now(), NULL);

-- 授权：1-ROOT、2-ADMIN
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (1, 3200), (1, 3201), (1, 3202), (1, 3203);
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`) VALUES (2, 3200), (2, 3201), (2, 3202), (2, 3203);


-- Baseline source: menu_marketing.sql
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


-- Baseline source: menu_appointment.sql
-- 阶段6：预约管理菜单与权限
USE youlai_admin;

SET NAMES utf8mb4;

DELETE FROM `sys_role_menu` WHERE `menu_id` IN (3400, 3401, 3402, 3403, 3404, 3405, 3406);
DELETE FROM `sys_menu` WHERE `id` IN (3406, 3405, 3404, 3403, 3402, 3401, 3400);

INSERT INTO `sys_menu`
  (`id`, `parent_id`, `tree_path`, `name`, `type`, `route_name`, `route_path`, `component`, `perm`,
   `always_show`, `keep_alive`, `visible`, `sort`, `icon`, `redirect`, `create_time`, `update_time`, `params`)
VALUES
  (3400, 0, '0', '预约管理', 'C', '', '/appointment', 'Layout', NULL,
   0, NULL, 1, 4, 'el-icon-Calendar', '/appointment/index', NOW(), NOW(), NULL),
  (3401, 3400, '0,3400', '预约记录', 'M', 'BizAppointment', 'index', 'appointment/index', NULL,
   0, 1, 1, 1, 'el-icon-Calendar', NULL, NOW(), NOW(), NULL),
  (3402, 3401, '0,3400,3401', '预约查询', 'B', NULL, '', NULL, 'biz:appointment:query',
   NULL, NULL, 1, 1, '', NULL, NOW(), NOW(), NULL),
  (3403, 3401, '0,3400,3401', '预约配置', 'B', NULL, '', NULL, 'biz:appointment:config',
   NULL, NULL, 1, 2, '', NULL, NOW(), NOW(), NULL),
  (3404, 3401, '0,3400,3401', '预约改期', 'B', NULL, '', NULL, 'biz:appointment:reschedule',
   NULL, NULL, 1, 3, '', NULL, NOW(), NOW(), NULL),
  (3405, 3401, '0,3400,3401', '取消预约', 'B', NULL, '', NULL, 'biz:appointment:cancel',
   NULL, NULL, 1, 4, '', NULL, NOW(), NOW(), NULL),
  (3406, 3401, '0,3400,3401', '完成面诊服务', 'B', NULL, '', NULL, 'biz:appointment:complete',
   NULL, NULL, 1, 5, '', NULL, NOW(), NOW(), NULL);

INSERT INTO `sys_role_menu` (`role_id`, `menu_id`)
SELECT roles.role_id, menus.menu_id
FROM (SELECT 1 AS role_id UNION ALL SELECT 2) roles
CROSS JOIN (
  SELECT 3400 AS menu_id UNION ALL SELECT 3401 UNION ALL SELECT 3402 UNION ALL SELECT 3403
  UNION ALL SELECT 3404 UNION ALL SELECT 3405 UNION ALL SELECT 3406
) menus;


-- Baseline source: menu_phase7.sql
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



-- Baseline source: menu_phase8_distribution.sql
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


-- Baseline source: menu_phase8c_settlement.sql
-- 阶段8C：分销结算管理菜单
-- 执行后清除 Redis Hash `system:role:perms` 的 ADMIN 字段。
USE youlai_admin;

SET NAMES utf8mb4;

DELETE FROM `sys_role_menu` WHERE `menu_id` IN (3660,3661,3662,3663,3664,3665,3666);
DELETE FROM `sys_menu` WHERE `id` IN (3661,3662,3663,3664,3665,3666,3660);

INSERT INTO `sys_menu`
  (`id`,`parent_id`,`tree_path`,`name`,`type`,`route_name`,`route_path`,`component`,`perm`,
   `always_show`,`keep_alive`,`visible`,`sort`,`icon`,`redirect`,`create_time`,`update_time`,`params`)
VALUES
  (3660,3600,'0,3600','结算管理','M','BizDistributionSettlement','settlement','distribution/settlement/index',NULL,0,1,1,6,'el-icon-Wallet',NULL,NOW(),NOW(),NULL),
  (3661,3660,'0,3600,3660','结算查询','B',NULL,'',NULL,'biz:distribution:settlement:list',NULL,NULL,1,1,'',NULL,NOW(),NOW(),NULL),
  (3662,3660,'0,3600,3660','结算配置','B',NULL,'',NULL,'biz:distribution:settlement:config',NULL,NULL,1,2,'',NULL,NOW(),NOW(),NULL),
  (3663,3660,'0,3600,3660','执行结算','B',NULL,'',NULL,'biz:distribution:settlement:run',NULL,NULL,1,3,'',NULL,NOW(),NOW(),NULL),
  (3664,3660,'0,3600,3660','提现查询','B',NULL,'',NULL,'biz:distribution:withdrawal:list',NULL,NULL,1,4,'',NULL,NOW(),NOW(),NULL),
  (3665,3660,'0,3600,3660','提现审核','B',NULL,'',NULL,'biz:distribution:withdrawal:audit',NULL,NULL,1,5,'',NULL,NOW(),NOW(),NULL),
  (3666,3660,'0,3600,3660','确认打款','B',NULL,'',NULL,'biz:distribution:withdrawal:paid',NULL,NULL,1,6,'',NULL,NOW(),NOW(),NULL);

INSERT INTO `sys_role_menu` (`role_id`,`menu_id`)
SELECT roles.role_id, menus.menu_id
FROM (SELECT 1 role_id UNION ALL SELECT 2) roles
CROSS JOIN (
  SELECT 3660 menu_id UNION ALL SELECT 3661 UNION ALL SELECT 3662
  UNION ALL SELECT 3663 UNION ALL SELECT 3664 UNION ALL SELECT 3665 UNION ALL SELECT 3666
) menus;


-- Baseline source: menu_phase8d_distribution_task.sql
-- 阶段8D：分销任务管理菜单
-- 执行后清除 Redis Hash `system:role:perms` 的 ADMIN 字段。
USE youlai_admin;

SET NAMES utf8mb4;

DELETE FROM `sys_role_menu` WHERE `menu_id` IN (3670,3671,3672,3673,3674,3675,3676);
DELETE FROM `sys_menu` WHERE `id` IN (3671,3672,3673,3674,3675,3676,3670);

INSERT INTO `sys_menu`
  (`id`,`parent_id`,`tree_path`,`name`,`type`,`route_name`,`route_path`,`component`,`perm`,
   `always_show`,`keep_alive`,`visible`,`sort`,`icon`,`redirect`,`create_time`,`update_time`,`params`)
VALUES
  (3670,3600,'0,3600','任务管理','M','BizDistributionTask','task','distribution/task/index',NULL,0,1,1,7,'el-icon-List',NULL,NOW(),NOW(),NULL),
  (3671,3670,'0,3600,3670','任务查询','B',NULL,'',NULL,'biz:distribution:task:list',NULL,NULL,1,1,'',NULL,NOW(),NOW(),NULL),
  (3672,3670,'0,3600,3670','任务新增','B',NULL,'',NULL,'biz:distribution:task:create',NULL,NULL,1,2,'',NULL,NOW(),NOW(),NULL),
  (3673,3670,'0,3600,3670','任务编辑','B',NULL,'',NULL,'biz:distribution:task:update',NULL,NULL,1,3,'',NULL,NOW(),NOW(),NULL),
  (3674,3670,'0,3600,3670','任务删除','B',NULL,'',NULL,'biz:distribution:task:delete',NULL,NULL,1,4,'',NULL,NOW(),NOW(),NULL),
  (3675,3670,'0,3600,3670','任务发布','B',NULL,'',NULL,'biz:distribution:task:publish',NULL,NULL,1,5,'',NULL,NOW(),NOW(),NULL),
  (3676,3670,'0,3600,3670','任务取消','B',NULL,'',NULL,'biz:distribution:task:cancel',NULL,NULL,1,6,'',NULL,NOW(),NOW(),NULL);

INSERT INTO `sys_role_menu` (`role_id`,`menu_id`)
SELECT roles.role_id, menus.menu_id
FROM (SELECT 1 role_id UNION ALL SELECT 2) roles
CROSS JOIN (
  SELECT 3670 menu_id UNION ALL SELECT 3671 UNION ALL SELECT 3672 UNION ALL SELECT 3673
  UNION ALL SELECT 3674 UNION ALL SELECT 3675 UNION ALL SELECT 3676
) menus;


-- Baseline source: menu_phase8e_sales_analytics.sql
-- 阶段8E：销售统计菜单
-- 执行后清除 Redis Hash `system:role:perms` 的 ADMIN 字段。
USE youlai_admin;

SET NAMES utf8mb4;

DELETE FROM `sys_role_menu` WHERE `menu_id` IN (3680,3681,3682);
DELETE FROM `sys_menu` WHERE `id` IN (3681,3682,3680);

INSERT INTO `sys_menu`
  (`id`,`parent_id`,`tree_path`,`name`,`type`,`route_name`,`route_path`,`component`,`perm`,
   `always_show`,`keep_alive`,`visible`,`sort`,`icon`,`redirect`,`create_time`,`update_time`,`params`)
VALUES
  (3680,3600,'0,3600','销售统计','M','BizDistributionAnalytics','analytics','distribution/analytics/index',NULL,0,1,1,8,'el-icon-TrendCharts',NULL,NOW(),NOW(),NULL),
  (3681,3680,'0,3600,3680','统计查询','B',NULL,'',NULL,'biz:distribution:analytics:list',NULL,NULL,1,1,'',NULL,NOW(),NOW(),NULL),
  (3682,3680,'0,3600,3680','统计导出','B',NULL,'',NULL,'biz:distribution:analytics:export',NULL,NULL,1,2,'',NULL,NOW(),NOW(),NULL);

INSERT INTO `sys_role_menu` (`role_id`,`menu_id`)
SELECT roles.role_id, menus.menu_id
FROM (SELECT 1 role_id UNION ALL SELECT 2) roles
CROSS JOIN (SELECT 3680 menu_id UNION ALL SELECT 3681 UNION ALL SELECT 3682) menus;


-- Baseline source: menu_dashboard.sql
-- 管理端仪表盘经营数据权限
-- 执行后清除 Redis Hash `system:role:perms` 的 ROOT、ADMIN 字段。
USE youlai_admin;

SET NAMES utf8mb4;

DELETE FROM `sys_role_menu` WHERE `menu_id` = 3900;
DELETE FROM `sys_menu` WHERE `id` = 3900;

INSERT INTO `sys_menu`
  (`id`,`parent_id`,`tree_path`,`name`,`type`,`route_name`,`route_path`,`component`,`perm`,
   `always_show`,`keep_alive`,`visible`,`sort`,`icon`,`redirect`,`create_time`,`update_time`,`params`)
VALUES
  (3900,0,'0','仪表盘数据','B',NULL,'',NULL,'dashboard:view',NULL,NULL,0,1,'',NULL,NOW(),NOW(),NULL);

INSERT INTO `sys_role_menu` (`role_id`,`menu_id`) VALUES (1,3900),(2,3900);


-- Baseline source: home_cards.sql
-- 独立首页卡片配置；新库在 menu_phase7.sql 之后执行，已有库可直接执行。
USE youlai_admin;
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `decoration_home_cards` (
  `id` bigint NOT NULL,
  `cards` json NOT NULL,
  `create_by` bigint NULL, `create_time` datetime NULL,
  `update_by` bigint NULL, `update_time` datetime NULL,
  `is_deleted` tinyint NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  CONSTRAINT `chk_home_cards_id` CHECK (`id` = 1),
  CONSTRAINT `chk_home_cards_limit` CHECK (JSON_TYPE(`cards`) = 'ARRAY' AND JSON_LENGTH(`cards`) <= 10)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='首页卡片配置';

INSERT INTO `sys_menu`
  (`id`,`parent_id`,`tree_path`,`name`,`type`,`route_name`,`route_path`,`component`,`perm`,
   `always_show`,`keep_alive`,`visible`,`sort`,`icon`,`redirect`,`create_time`,`update_time`,`params`)
VALUES
  (3540,3500,'0,3500','首页卡片','M','BizDecorationCards','cards','decoration/cards/index',NULL,0,1,1,5,'el-icon-Picture',NULL,NOW(),NOW(),NULL),
  (3541,3540,'0,3500,3540','卡片查询','B',NULL,'',NULL,'biz:decoration:cards:list',NULL,NULL,1,1,'',NULL,NOW(),NOW(),NULL),
  (3542,3540,'0,3500,3540','卡片编辑','B',NULL,'',NULL,'biz:decoration:cards:update',NULL,NULL,1,2,'',NULL,NOW(),NOW(),NULL)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `component`=VALUES(`component`), `perm`=VALUES(`perm`);

INSERT INTO `sys_role_menu` (`role_id`,`menu_id`)
SELECT roles.role_id, menus.menu_id
FROM (SELECT 1 role_id UNION ALL SELECT 2) roles
CROSS JOIN (SELECT 3540 menu_id UNION ALL SELECT 3541 UNION ALL SELECT 3542) menus
WHERE NOT EXISTS (SELECT 1 FROM `sys_role_menu` existing WHERE existing.role_id=roles.role_id AND existing.menu_id=menus.menu_id);


-- Baseline source: promo_cards.sql
-- 独立首页活动卡片配置；新库在 menu_phase7.sql 之后执行，已有库可直接执行。
USE youlai_admin;
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `decoration_promo_cards` (
  `id` bigint NOT NULL,
  `cards` json NOT NULL,
  `create_by` bigint NULL, `create_time` datetime NULL,
  `update_by` bigint NULL, `update_time` datetime NULL,
  `is_deleted` tinyint NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  CONSTRAINT `chk_promo_cards_id` CHECK (`id` = 1),
  CONSTRAINT `chk_promo_cards_limit` CHECK (JSON_TYPE(`cards`) = 'ARRAY' AND JSON_LENGTH(`cards`) <= 4)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COMMENT='首页活动卡片配置';

INSERT INTO `sys_menu`
  (`id`,`parent_id`,`tree_path`,`name`,`type`,`route_name`,`route_path`,`component`,`perm`,
   `always_show`,`keep_alive`,`visible`,`sort`,`icon`,`redirect`,`create_time`,`update_time`,`params`)
VALUES
  (3550,3500,'0,3500','首页活动卡片','M','BizDecorationPromoCards','promo-cards','decoration/promo-cards/index',NULL,0,1,1,6,'el-icon-Picture',NULL,NOW(),NOW(),NULL),
  (3551,3550,'0,3500,3550','卡片查询','B',NULL,'',NULL,'biz:decoration:promo-cards:list',NULL,NULL,1,1,'',NULL,NOW(),NOW(),NULL),
  (3552,3550,'0,3500,3550','卡片编辑','B',NULL,'',NULL,'biz:decoration:promo-cards:update',NULL,NULL,1,2,'',NULL,NOW(),NOW(),NULL)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `component`=VALUES(`component`), `perm`=VALUES(`perm`);

INSERT INTO `sys_role_menu` (`role_id`,`menu_id`)
SELECT roles.role_id, menus.menu_id
FROM (SELECT 1 role_id UNION ALL SELECT 2) roles
CROSS JOIN (SELECT 3550 menu_id UNION ALL SELECT 3551 UNION ALL SELECT 3552) menus
WHERE NOT EXISTS (SELECT 1 FROM `sys_role_menu` existing WHERE existing.role_id=roles.role_id AND existing.menu_id=menus.menu_id);


-- Baseline source: biz_agreement.sql
-- 协议管理
USE youlai_admin;

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `agreement` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `type` varchar(32) NOT NULL,
  `draft_title` varchar(100) NOT NULL,
  `draft_content` text NOT NULL,
  `published_title` varchar(100) DEFAULT NULL,
  `published_content` text DEFAULT NULL,
  `publish_time` datetime DEFAULT NULL,
  `create_by` bigint DEFAULT NULL,
  `create_time` datetime DEFAULT NULL,
  `update_by` bigint DEFAULT NULL,
  `update_time` datetime DEFAULT NULL,
  `is_deleted` tinyint NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_agreement_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='协议管理';

INSERT INTO `agreement` (`type`,`draft_title`,`draft_content`,`create_time`,`update_time`,`is_deleted`)
SELECT 'USER_AGREEMENT','用户协议','<p>请在管理后台编辑并发布用户协议。</p>',NOW(),NOW(),0
WHERE NOT EXISTS (SELECT 1 FROM `agreement` WHERE `type`='USER_AGREEMENT' AND `is_deleted`=0);

INSERT INTO `agreement` (`type`,`draft_title`,`draft_content`,`create_time`,`update_time`,`is_deleted`)
SELECT 'PRIVACY_POLICY','隐私政策','<p>请在管理后台编辑并发布隐私政策。</p>',NOW(),NOW(),0
WHERE NOT EXISTS (SELECT 1 FROM `agreement` WHERE `type`='PRIVACY_POLICY' AND `is_deleted`=0);

INSERT INTO `agreement` (`type`,`draft_title`,`draft_content`,`create_time`,`update_time`,`is_deleted`)
SELECT 'MEDICAL_INFORMED_CONSENT','用户就诊告知及知情同意书','<p>请在管理后台编辑并发布用户就诊告知及知情同意书。</p>',NOW(),NOW(),0
WHERE NOT EXISTS (SELECT 1 FROM `agreement` WHERE `type`='MEDICAL_INFORMED_CONSENT' AND `is_deleted`=0);

DELETE FROM `sys_role_menu` WHERE `menu_id` IN (3530,3531,3532,3533);
DELETE FROM `sys_menu` WHERE `id` IN (3533,3532,3531,3530);

INSERT INTO `sys_menu`
  (`id`,`parent_id`,`tree_path`,`name`,`type`,`route_name`,`route_path`,`component`,`perm`,
   `always_show`,`keep_alive`,`visible`,`sort`,`icon`,`redirect`,`create_time`,`update_time`,`params`)
VALUES
  (3530,3500,'0,3500','协议管理','M','AgreementManagement','agreement','decoration/agreement/index',NULL,0,1,1,4,'el-icon-Document',NULL,NOW(),NOW(),NULL),
  (3531,3530,'0,3500,3530','协议查询','B',NULL,'',NULL,'content:agreement:list',NULL,NULL,1,1,'',NULL,NOW(),NOW(),NULL),
  (3532,3530,'0,3500,3530','协议编辑','B',NULL,'',NULL,'content:agreement:update',NULL,NULL,1,2,'',NULL,NOW(),NOW(),NULL),
  (3533,3530,'0,3500,3530','协议发布','B',NULL,'',NULL,'content:agreement:publish',NULL,NULL,1,3,'',NULL,NOW(),NOW(),NULL);

INSERT INTO `sys_role_menu` (`role_id`,`menu_id`)
SELECT roles.role_id, menus.menu_id
FROM (SELECT 1 role_id UNION ALL SELECT 2) roles
CROSS JOIN (SELECT 3530 menu_id UNION ALL SELECT 3531 UNION ALL SELECT 3532 UNION ALL SELECT 3533) menus;


-- Baseline source: friend_payment.sql
-- 好友代付：支付记录改为一次支付尝试，分离购买人与付款人。
-- 依赖：biz_p0.sql、biz_phase4.sql 已执行；MySQL 8。本文件可重复执行。

USE youlai_admin;
SET NAMES utf8mb4;

DROP PROCEDURE IF EXISTS `migrate_friend_payment`;
DELIMITER $$

CREATE PROCEDURE `migrate_friend_payment`()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_payment'
          AND COLUMN_NAME = 'payer_member_id'
    ) THEN
        ALTER TABLE `biz_payment`
            ADD COLUMN `payer_member_id` bigint NULL COMMENT '实际付款人会员ID'
            AFTER `member_id`;
    END IF;

    UPDATE `biz_payment`
    SET `payer_member_id` = `member_id`
    WHERE `payer_member_id` IS NULL;

    IF EXISTS (
        SELECT 1 FROM `biz_payment` p
        LEFT JOIN `member` m ON m.`id` = p.`payer_member_id`
        WHERE p.`payer_member_id` IS NULL OR m.`id` IS NULL
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'biz_payment 存在无效实际付款人，请先修复 payer_member_id';
    END IF;

    ALTER TABLE `biz_payment`
        MODIFY COLUMN `member_id` bigint NOT NULL COMMENT '订单购买人会员ID',
        MODIFY COLUMN `payer_member_id` bigint NOT NULL COMMENT '实际付款人会员ID';

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_payment'
          AND COLUMN_NAME = 'prepay_id'
    ) THEN
        ALTER TABLE `biz_payment`
            ADD COLUMN `prepay_id` varchar(64) NULL COMMENT '微信预支付会话ID'
            AFTER `third_party_no`;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_payment'
          AND COLUMN_NAME = 'expire_time'
    ) THEN
        ALTER TABLE `biz_payment`
            ADD COLUMN `expire_time` datetime NULL COMMENT '支付尝试租约结束时间'
            AFTER `prepay_id`;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_payment'
          AND INDEX_NAME = 'idx_payment_order_id'
    ) THEN
        ALTER TABLE `biz_payment` ADD INDEX `idx_payment_order_id` (`order_id`);
    END IF;

    -- order_id 外键需要可用索引；先补普通索引，再移除旧唯一索引。
    IF EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_payment'
          AND INDEX_NAME = 'uk_payment_order_id'
    ) THEN
        ALTER TABLE `biz_payment` DROP INDEX `uk_payment_order_id`;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_payment'
          AND INDEX_NAME = 'idx_payment_payer_member_id'
    ) THEN
        ALTER TABLE `biz_payment`
            ADD INDEX `idx_payment_payer_member_id` (`payer_member_id`);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_payment'
          AND CONSTRAINT_NAME = 'fk_biz_payment_payer_member'
    ) THEN
        ALTER TABLE `biz_payment`
            ADD CONSTRAINT `fk_biz_payment_payer_member`
            FOREIGN KEY (`payer_member_id`) REFERENCES `member` (`id`)
            ON UPDATE RESTRICT ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_payment'
          AND COLUMN_NAME = 'active_order_id'
    ) THEN
        ALTER TABLE `biz_payment`
            ADD COLUMN `active_order_id` bigint GENERATED ALWAYS AS (
                CASE WHEN `status` = 0 AND `is_deleted` = 0 THEN `order_id` ELSE NULL END
            ) VIRTUAL COMMENT '有效待支付订单ID';
    END IF;

    IF EXISTS (
        SELECT `order_id` FROM `biz_payment`
        WHERE `status` = 0 AND `is_deleted` = 0
        GROUP BY `order_id` HAVING COUNT(*) > 1
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'biz_payment 同一订单存在多条有效待支付记录，请先清理';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_payment'
          AND INDEX_NAME = 'uk_payment_active_order_id'
    ) THEN
        ALTER TABLE `biz_payment`
            ADD UNIQUE INDEX `uk_payment_active_order_id` (`active_order_id`);
    END IF;

    IF EXISTS (
        SELECT `payment_id` FROM `biz_refund`
        WHERE `is_deleted` = 0
        GROUP BY `payment_id` HAVING COUNT(*) > 1
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'biz_refund 同一支付存在多条有效退款，请先清理';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_refund'
          AND COLUMN_NAME = 'closed_refund_nos'
    ) THEN
        ALTER TABLE `biz_refund`
            ADD COLUMN `closed_refund_nos` varchar(1024) NULL
            COMMENT '已结束或已换号的历史商户退款单号(逗号分隔)'
            AFTER `third_party_no`;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_refund'
          AND CONSTRAINT_NAME = 'chk_biz_refund_status'
          AND CONSTRAINT_TYPE = 'CHECK'
    ) THEN
        ALTER TABLE `biz_refund` DROP CHECK `chk_biz_refund_status`;
    END IF;
    ALTER TABLE `biz_refund`
        ADD CONSTRAINT `chk_biz_refund_status` CHECK (`status` IN (0, 1, 2, 3, 4));

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_refund'
          AND INDEX_NAME = 'uk_refund_payment_id'
    ) THEN
        ALTER TABLE `biz_refund`
            ADD UNIQUE INDEX `uk_refund_payment_id` (`payment_id`);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_refund'
          AND INDEX_NAME = 'idx_refund_order_id'
    ) THEN
        ALTER TABLE `biz_refund` ADD INDEX `idx_refund_order_id` (`order_id`);
    END IF;

    -- 两个旧索引都可能被外键选中；替代索引必须先存在。
    IF EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_refund'
          AND INDEX_NAME = 'uk_refund_order_id'
    ) THEN
        ALTER TABLE `biz_refund` DROP INDEX `uk_refund_order_id`;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_refund'
          AND INDEX_NAME = 'idx_refund_payment_id'
    ) THEN
        ALTER TABLE `biz_refund` DROP INDEX `idx_refund_payment_id`;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_order'
          AND COLUMN_NAME = 'paid_payment_id'
    ) THEN
        ALTER TABLE `biz_order`
            ADD COLUMN `paid_payment_id` bigint NULL COMMENT '完成订单的支付流水ID'
            AFTER `pay_time`;
    END IF;

    UPDATE `biz_order` o
    JOIN `biz_payment` p
      ON p.`order_id` = o.`id`
     AND p.`is_deleted` = 0
     AND p.`status` IN (1, 3)
    SET o.`paid_payment_id` = p.`id`
    WHERE o.`paid_payment_id` IS NULL
      AND o.`status` IN (1, 2, 3, 5);

    IF EXISTS (
        SELECT 1 FROM `biz_order` o
        LEFT JOIN `biz_payment` p ON p.`id` = o.`paid_payment_id`
        WHERE o.`paid_payment_id` IS NOT NULL
          AND (p.`id` IS NULL OR p.`order_id` <> o.`id` OR p.`status` NOT IN (1, 3))
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'biz_order.paid_payment_id 存在无效支付关联，请先修复';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_order'
          AND INDEX_NAME = 'uk_order_paid_payment_id'
    ) THEN
        ALTER TABLE `biz_order`
            ADD UNIQUE INDEX `uk_order_paid_payment_id` (`paid_payment_id`);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'biz_order'
          AND CONSTRAINT_NAME = 'fk_biz_order_paid_payment'
    ) THEN
        ALTER TABLE `biz_order`
            ADD CONSTRAINT `fk_biz_order_paid_payment`
            FOREIGN KEY (`paid_payment_id`) REFERENCES `biz_payment` (`id`)
            ON UPDATE RESTRICT ON DELETE RESTRICT;
    END IF;
END$$

DELIMITER ;
CALL `migrate_friend_payment`();
DROP PROCEDURE `migrate_friend_payment`;

CREATE TABLE IF NOT EXISTS `biz_proxy_pay_share` (
    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
    `order_id` bigint NOT NULL COMMENT '订单ID',
    `owner_member_id` bigint NOT NULL COMMENT '订单购买人会员ID',
    `token_hash` char(64) NOT NULL COMMENT '分享令牌SHA-256',
    `expires_at` datetime NOT NULL COMMENT '分享截止时间',
    `create_by` bigint NULL COMMENT '创建人ID',
    `create_time` datetime NULL COMMENT '创建时间',
    `update_by` bigint NULL COMMENT '修改人ID',
    `update_time` datetime NULL COMMENT '更新时间',
    `is_deleted` tinyint NOT NULL DEFAULT 0 COMMENT '逻辑删除标识(1-已删除 0-未删除)',
    PRIMARY KEY (`id`) USING BTREE,
    UNIQUE INDEX `uk_proxy_pay_share_token_hash` (`token_hash`) USING BTREE,
    INDEX `idx_proxy_pay_share_order_id` (`order_id`) USING BTREE,
    CONSTRAINT `fk_proxy_pay_share_order` FOREIGN KEY (`order_id`) REFERENCES `biz_order` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `fk_proxy_pay_share_owner_member`
        FOREIGN KEY (`owner_member_id`) REFERENCES `member` (`id`)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT `chk_proxy_pay_share_is_deleted` CHECK (`is_deleted` IN (0, 1))
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COMMENT = '好友代付分享凭证表';
