-- 后台排序体验重设计：保留当前展示顺序并归一化为连续位置。
-- MySQL 8+；可重复执行。

UPDATE product p
JOIN (
  SELECT id, ROW_NUMBER() OVER (ORDER BY sort ASC, create_time DESC, id DESC) AS position
  FROM product
  WHERE is_deleted = 0
) ranked ON ranked.id = p.id
SET p.sort = ranked.position;

UPDATE product_category c
JOIN (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY parent_id ORDER BY sort ASC, id ASC) AS position
  FROM product_category
  WHERE is_deleted = 0
) ranked ON ranked.id = c.id
SET c.sort = ranked.position;

UPDATE decoration_banner b
JOIN (
  SELECT id, ROW_NUMBER() OVER (ORDER BY sort ASC, id DESC) AS position
  FROM decoration_banner
  WHERE is_deleted = 0
) ranked ON ranked.id = b.id
SET b.sort = ranked.position;

UPDATE decoration_notice n
JOIN (
  SELECT id, ROW_NUMBER() OVER (ORDER BY sort ASC, id DESC) AS position
  FROM decoration_notice
  WHERE is_deleted = 0
) ranked ON ranked.id = n.id
SET n.sort = ranked.position;

UPDATE distribution_agent_type t
JOIN (
  SELECT id, ROW_NUMBER() OVER (ORDER BY sort ASC, id DESC) AS position
  FROM distribution_agent_type
  WHERE is_deleted = 0
) ranked ON ranked.id = t.id
SET t.sort = ranked.position;

UPDATE sys_role r
JOIN (
  SELECT id,
         ROW_NUMBER() OVER (ORDER BY sort ASC, create_time DESC, update_time DESC, id ASC) AS position
  FROM sys_role
  WHERE is_deleted = 0 AND code <> 'ROOT'
) ranked ON ranked.id = r.id
SET r.sort = ranked.position;

UPDATE sys_dict_item i
JOIN (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY dict_code ORDER BY sort ASC, id ASC) AS position
  FROM sys_dict_item
) ranked ON ranked.id = i.id
SET i.sort = ranked.position;

UPDATE sys_dept d
JOIN (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY parent_id ORDER BY sort ASC, id ASC) AS position
  FROM sys_dept
  WHERE is_deleted = 0
) ranked ON ranked.id = d.id
SET d.sort = ranked.position;

UPDATE sys_menu m
JOIN (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY parent_id ORDER BY sort ASC, id ASC) AS position
  FROM sys_menu
) ranked ON ranked.id = m.id
SET m.sort = ranked.position;

-- 两类等级只有一套业务顺序。
UPDATE member_level SET sort = 0 WHERE is_deleted = 0;
UPDATE distribution_level SET sort = rank WHERE is_deleted = 0;

-- 悦己没有租户业务；兼容旧库中可能残留的模板菜单。
UPDATE sys_menu
SET visible = 0
WHERE component IN ('system/tenant/index', 'system/tenant/plan')
   OR name IN ('租户管理', '租户套餐');
