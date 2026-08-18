# 阶段 7 页面装修与拼团设计

## 1. 目标与范围

阶段 7 交付服务端、管理端，以及供小程序后续接入的 C 端接口。本阶段不修改 `yueji-web`。

交付内容：

- 页面装修：Banner、首页公告、品牌背书内容。
- 拼团：单 SKU 活动、发起拼团、参与拼团、付款成团、超时失败和自动退款。
- 管理端：装修内容管理、拼团活动管理、拼团记录查询。
- 本地数据库结构、菜单权限和测试数据。

明确不做：

- 团长优惠、阶梯团、跨 SKU 套餐、分享奖励和分销佣金。
- 拼团价叠加会员折扣、优惠券或积分抵扣。
- 小程序页面、真实微信支付、消息通知和人工改团状态。
- 新依赖、通用工作流或新的订单状态机。

## 2. 模块边界

新增两个独立模块：

- `DecorationModule`：装修内容数据、B 端维护接口和 C 端首页聚合接口。
- `GroupBuyModule`：拼团活动、团实例、参团记录、C/B 端接口和超时任务。

拼团复用现有 `OrderModule`、`PaymentModule`、订单领域事件和定时任务模式。通用订单仍负责库存、支付、取消、退款和核销；拼团模块只负责活动与团状态，通过参团记录关联订单，不给 `biz_order` 增加拼团状态。

## 3. 数据模型

所有金额使用整数分，表使用 `utf8mb4`，并沿用现有审计字段。

### 3.1 页面装修

`decoration_banner`：

- `image_url`：Banner 图片地址。
- `link_url`：可空跳转链接。
- `sort`：升序排序。
- `status`：`0` 下线、`1` 上线。

`decoration_notice`：

- `title`、`content`。
- `sort`：升序排序。
- `status`：`0` 下线、`1` 上线。

`decoration_brand`：

- 固定单例记录 `id=1`。
- `content`：品牌背书富文本，图片继续使用现有文件上传接口后写入 HTML。

### 3.2 拼团

`group_buy_activity`：

- `sku_id`、`name`。
- `group_price`：拼团单价。
- `required_people`：成团人数，至少 2 人。
- `start_time`、`end_time`：活动可开团时间。
- `group_duration_minutes`：每个团从发起到截止的分钟数。
- `status`：`0` 下线、`1` 上线。

同一 SKU 的有效活动时间不得重叠。活动必须引用启用中的 SKU，且 `0 < group_price < sku.price`。

`group_buy_group`：

- `activity_id`、`leader_member_id`。
- `required_people`、`group_price`：创建时快照，后续活动修改不影响已有团。
- `expire_time`。
- `status`：`0` 拼团中、`1` 已成团、`2` 已失败。
- `success_time`、`fail_time`。

参与人数从参团记录实时统计，不额外保存易漂移的计数字段。

`group_buy_member`：

- `group_id`、`member_id`、`order_id`。
- `status`：`0` 待付款、`1` 已付款、`2` 已退款、`3` 已取消。
- `paid_time`、`refund_time`。
- 唯一索引 `(group_id, member_id)`，防止同一会员重复加入同一团。
- 唯一索引 `order_id`，防止一个订单关联多个参团记录。

同一会员取消后不允许重新加入原团；可加入其他团或重新开团。

## 4. 拼团主流程

### 4.1 发起与参团

- 发起时校验活动在线、当前时间在活动区间内，并锁定活动。
- 创建团实例、待付款参团记录和一件商品的待付款订单；团截止时间取“发起时间 + 成团时限”与活动结束时间中的较早值。
- 参团时锁定团实例，统计状态为待付款或已付款的记录；达到人数上限则拒绝。
- 拼团订单直接使用活动快照价，会员优惠、券和积分字段均为零。
- 订单创建仍由 `OrderService` 完成 SKU 校验、库存扣减和订单明细保存，拼团模块不复制订单逻辑。

### 4.2 支付、取消与成团

- 订阅现有 `order.paid` 事件，将对应参团记录改为已付款。
- 锁定团实例并统计已付款人数；达到快照人数时将团改为已成团。
- 订阅 `order.cancelled` 事件，将待付款参团记录改为已取消并释放名额。
- 定时任务同时扫描订单最终状态，补偿进程重启或事件处理失败造成的遗漏。

### 4.3 超时与退款

- 每分钟扫描已过 `expire_time` 且仍在拼团中的团，锁定后改为已失败。
- 对团内已付款订单调用现有支付退款能力，退款成功后将参团记录改为已退款。
- 退款调用保持幂等；失败时参团记录保留已付款状态，并由后续扫描继续重试。
- 已成团后发生单笔后台退款，只更新该参团记录为已退款，不逆转已成团状态。

## 5. 接口

### 5.1 C 端页面装修

- `GET /api/v1/app/decoration/home`：公开返回上线 Banner、公告和品牌内容。

### 5.2 B 端页面装修

- `/api/v1/decoration/banners`：分页、表单详情、新增、编辑、上下线、删除。
- `/api/v1/decoration/notices`：分页、表单详情、新增、编辑、上下线、删除。
- `GET /api/v1/decoration/brand`、`PUT /api/v1/decoration/brand`：读取和保存单例富文本。
- 权限前缀分别为 `biz:decoration:banner:*`、`biz:decoration:notice:*`、`biz:decoration:brand:*`。

### 5.3 C 端拼团

- `GET /api/v1/app/group-buy/activities`：公开分页查询可参与活动。
- `GET /api/v1/app/group-buy/activities/:id`：公开查询活动详情和可加入的拼团中团。
- `POST /api/v1/app/group-buy/groups`：会员发起拼团，参数仅为 `activityId`。
- `POST /api/v1/app/group-buy/groups/:id/join`：会员加入指定团。
- `GET /api/v1/app/group-buy/groups/:id`：公开查询团状态和脱敏成员展示信息。

发起和参团响应均返回团 ID、订单 ID、订单号、拼团价和失效时间，后续小程序直接复用现有支付接口。

### 5.4 B 端拼团

- `/api/v1/group-buy/activities`：分页、表单详情、新增、编辑、上下线、删除。
- `GET /api/v1/group-buy/groups/page`、`GET /api/v1/group-buy/groups/:id`：拼团记录分页和详情，只读。
- 权限前缀为 `biz:group-buy:activity:*` 和 `biz:group-buy:group:list`。

## 6. 管理端

沿用现有 API 分层、`usePageTable`、分页组件、图片上传和富文本组件：

Banner、公告和拼团活动先使用现有 codegen 生成基础 CRUD，再按本设计删减和补充；品牌单例页与拼团记录页直接复用现有页面模式。

- `src/views/decoration/banner/`：图片、链接、排序、状态和 CRUD。
- `src/views/decoration/notice/`：标题、正文、排序、状态和 CRUD。
- `src/views/decoration/brand/`：单页富文本保存。
- `src/views/marketing/groupbuy/`：活动管理与拼团记录两个页签；记录详情展示成员和关联订单，不提供人工改团状态。

菜单使用动态 `sys_menu`，授权 ROOT 与 ADMIN。SQL 显式设置客户端为 `utf8mb4`，避免中文菜单再次被错误转码。

## 7. 校验与异常处理

- 已产生团实例的活动不得修改 SKU、拼团价、人数、活动开始时间或成团时限；可修改名称和活动结束时间，但结束时间不得早于当前时间或已有团截止时间。
- 新增或修改活动时间时重新校验同一 SKU 不存在重叠活动。
- 下线活动仅阻止新开团，已有团继续运行。
- 有团实例的活动不得删除；无实例活动采用软删除。
- 团实例行锁与唯一索引共同防止超员、重复参团和重复订单关联。
- 订单取消、支付、成团和退款处理均幂等；重复事件不重复推进状态或退款。
- 对外只返回业务错误，不暴露数据库或支付驱动异常详情。

## 8. SQL、种子与验证

- 新增 `sql/mysql/biz_phase7.sql`、`sql/mysql/menu_phase7.sql`。
- 更新 `sql/mysql/biz_test_seed.sql`，加入上线/下线装修内容、有效/过期活动，以及拼团中/成功/失败记录。
- SQL 应用到本地 MySQL 后清除 ROOT、ADMIN 权限缓存。

后端最小测试覆盖：

- 活动时间、价格和 SKU 校验。
- 锁内名额判断与同会员重复参团。
- 付款达标成团、取消释放名额。
- 超时失败、退款成功和退款失败后的重试。

验收：

- 后端阶段 7 测试、全量 Jest 和生产构建通过。
- 管理端类型检查、生产构建通过。
- C 端发起团、参团、Mock 支付、成团与超时退款接口闭环通过。
- 管理端装修 CRUD、品牌保存、活动 CRUD、拼团分页和详情无 403。
- 阶段 0–6 测试与现有页面不回归。

## 9. 完成标准

运营人员能在管理端维护首页内容和拼团活动；会员能通过 C 端接口按拼团价发起或加入单 SKU 拼团；满员后稳定成团，超时未满的已付款订单能够自动、幂等退款。小程序页面保持不变，等待后续统一接入。
