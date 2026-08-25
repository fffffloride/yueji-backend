-- 隐藏低频系统工具菜单，保留路由和权限。
USE youlai_admin;

UPDATE `sys_menu`
SET `visible` = 0,
    `update_time` = NOW()
WHERE `id` IN (250, 260, 270, 280);
