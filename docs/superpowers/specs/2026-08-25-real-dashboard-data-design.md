# 管理端仪表盘真实数据设计

## 1. 目标与范围

将管理端首页当前写死或口径错误的数据替换为真实业务数据：

- 小程序/商城会员端的真实 UV、PV 和 7/30 天访问趋势。
- 后台 SSE 在线用户数。
- 有效会员总数及今日新增趋势。
- 订单、代理、提现和退款形成的真实待办。
- 后台操作与客户业务变化形成的真实系统动态。

本次不建设通用埋点平台、消息队列、事件仓库、BI 报表或页面级行为分析。访问统计只满足当前仪表盘的日 UV/PV；需要页面路径、来源、转化漏斗时再扩展。

## 2. 已确认口径

- “今日访客 / 今日浏览量 / 访问趋势”只统计小程序/商城会员端，不统计管理端请求。
- “系统用户”改为“会员总数”，数据来自 `member`。
- “在线用户”明确改名为“后台在线”，继续表示当前后端进程中有 SSE 连接的后台用户名数量。
- 待办只包含：待核销订单、待审核代理、待审核/待打款提现、退款异常。
- 退款异常包括失败退款，以及创建超过 30 分钟仍在处理中的退款。
- 系统动态同时展示真实后台操作和真实客户业务事件。
- 不导入演示统计，不把现有 `sys_log` 当作客户访问记录；功能上线后访问统计从零开始积累。

## 3. 总体方案

采用“每日访客累计表 + 单一仪表盘聚合接口”：

1. 小程序为设备生成并持久保存随机访客 ID。
2. 页面每次显示时调用公开访问上报接口。
3. 服务端按“日期 + 访客 ID”原子累加当天 PV，一行代表当天一个 UV。
4. 管理端通过一个聚合接口获取流量、会员、待办和动态。
5. 后台在线人数仍通过现有 SSE 实时更新，不塞入聚合接口。

现有业务表是订单、会员、代理、提现、退款和动态的唯一事实来源。不新增冗余统计表，不设置定时汇总任务。

## 4. 访问统计数据模型

新增 `app_visit_daily`：

- `id`：主键。
- `visit_date`：服务端确定的自然日。
- `visitor_id`：小程序本地随机访客 ID，UUID 字符串。
- `pv_count`：该访客当天页面显示次数，默认 1。
- `first_visit_time`：当天首次上报时间。
- `last_visit_time`：当天最近上报时间。

约束与索引：

- 唯一键 `(visit_date, visitor_id)`。
- 日期索引 `visit_date`，用于日趋势聚合。
- 不保存 OpenID、手机号或客户端提交的会员 ID。

访问上报使用 MySQL `INSERT ... ON DUPLICATE KEY UPDATE` 原子累加 `pv_count` 并更新 `last_visit_time`，避免并发覆盖。业务时区固定为 `Asia/Shanghai`（MySQL 会话使用 `+08:00`）；日期和时间均由服务端/数据库产生，客户端不能指定统计日期。

## 5. 小程序访问上报

在小程序存储键中新增访客 ID。首次需要上报且本地不存在时生成 UUID，之后保持不变。

通过应用级页面 `onShow` 混入统一上报，使用当前页面显示作为一次 PV：

- 首次打开、切换 Tab、进入子页面、返回上一页重新显示都会产生一次 PV。
- 上报只发送 `visitorId`，不携带受信任业务字段。
- 请求使用 `skipAuth: true`、`skipErrorToast: true`。
- 上报失败静默忽略，不阻塞页面、不重试、不显示提示。
- App 生命周期或普通组件不得重复上报；实现时用当前页面栈确认只在页面实例触发。

公开接口沿用现有限流，并校验 `visitorId` 必须是合法 UUID。若将来需要页面排行，再增加规范化页面路径字段；本次不提前保存。

## 6. 仪表盘指标

### 6.1 顶部指标

- 后台在线：现有 SSE `online-users`，统计唯一后台用户名。SSE 断开时显示“离线”，不把 `0` 当作已确认人数。
- 今日访客：`app_visit_daily` 当日记录数。
- 今日浏览量：当日 `pv_count` 合计。
- 会员总数：`member.status = 1 AND is_deleted = 0` 的数量。

UV、PV 和新增会员增长率均比较今日与昨日：

`(今日值 - 昨日值) / 昨日值`

接口统一返回小数比例，例如 `0.125` 表示 `12.5%`。昨日为 0 时返回 `null`，前端显示 `--`，不制造无穷大或 `10000%`。

### 6.2 访问趋势

接口接收 `days=7|30`，返回连续日期数组和每天的 UV/PV。没有记录的日期补零；日期范围按 `Asia/Shanghai` 计算。

旧的 `/logs/analytics/overview` 和 `/logs/analytics/trend` 不再供仪表盘使用。它们仍可保留给操作日志模块，但不得标为客户访问量。

## 7. 真实待办

当前待办数量为以下集合之和，全部过滤 `is_deleted = 0`：

- 待核销订单：`biz_order.status = 1`，开始时间取 `pay_time`。
- 待审核代理：`distribution_agent.status = 0`，开始时间取 `apply_time`，缺失时回退 `create_time`。
- 待审核提现：`distribution_withdrawal.status = 0`，开始时间取 `create_time`。
- 待打款提现：`distribution_withdrawal.status = 1`，开始时间取 `review_time`。
- 失败退款：`biz_refund.status = 2`，开始时间取 `update_time`。
- 超时处理中退款：`biz_refund.status = 0` 且 `create_time` 早于当前时间 30 分钟。

仪表盘返回：

- `total`：当前待办总数。
- `todayNew`：今日进入上述待办状态的数量。
- `todayDone`：今日核销、代理审核、提现审核/打款或退款成功的数量。
- `categories`：各类当前数量，前端按数量/总数计算进度条。
- `items`：开始时间最早的 5 条，包含类型、标题、状态、发生时间和目标路由。

点击待办跳转到已有订单、代理、提现或退款管理页面。接口不返回没有处理入口的预约，也不把通知草稿强行定义为待办。

## 8. 真实系统动态

不新增事件表。服务端并行读取现有事实表的近期时间字段，标准化后合并排序：

- `sys_log`：后台登录、用户、角色、配置等已记录操作。
- `member.create_time`：新会员。
- `biz_order.create_time/pay_time/verify_time/cancel_time`：下单、支付、核销、取消。
- `biz_refund.create_time/refund_time/update_time`：退款申请、成功或失败。
- `appointment.create_time`：新预约。
- `distribution_agent.apply_time/audit_time`：代理申请和审核。
- `distribution_withdrawal.create_time/review_time/paid_time`：提现申请、审核和打款。
- `sys_notice.publish_time`：后台通知发布。

每个来源只查询少量近期候选记录，再在服务层转换为统一结构、按 `occurredAt` 倒序并截取最近 10 条：

```ts
interface DashboardActivity {
  id: string;
  type: string;
  content: string;
  occurredAt: string;
  targetRoute?: string;
}
```

前端根据 `occurredAt` 计算相对时间。删除“数据库自动备份完成”“SSL 自动续期”等没有事实来源的固定文案。

当前数据量下并行小查询比建设事件仓库更简单。只有当需要不可变的完整历史、跨服务事件或当前查询出现可测量性能问题时，才增加审计事件表。

## 9. 接口设计

### 9.1 C 端访问上报

- `POST /api/v1/app/analytics/visit`
- 公开接口，无会员登录要求。
- 请求：`{ visitorId: string }`。
- 成功只返回 `{ success: true }`，不返回统计信息。

### 9.2 B 端仪表盘

- `GET /api/v1/dashboard/overview?days=7|30`
- 需要后台登录和新增权限 `dashboard:view`。
- `days` 仅允许 7 或 30，默认 7。

响应数据：

```ts
interface DashboardOverview {
  traffic: {
    todayUv: number;
    todayPv: number;
    uvGrowthRate: number | null;
    pvGrowthRate: number | null;
    dates: string[];
    uvList: number[];
    pvList: number[];
  };
  members: {
    total: number;
    todayNew: number;
    yesterdayNew: number;
    growthRate: number | null;
  };
  todos: {
    total: number;
    todayNew: number;
    todayDone: number;
    categories: Array<{ type: string; label: string; count: number }>;
    items: Array<{
      id: string;
      type: string;
      title: string;
      status: string;
      occurredAt: string;
      targetRoute: string;
    }>;
  };
  activities: DashboardActivity[];
}
```

“后台在线”不包含在该响应中，由 SSE 独立更新。

## 10. 模块与前端改造

服务端新增一个 `DashboardModule`，包含访问日实体、访问上报、聚合查询和 DTO。它直接注入现有实体仓库，不新建一层只有单一实现的接口或工厂。

管理端：

- 新增 `DashboardAPI.getOverview(days)`。
- 删除仪表盘内写死的系统用户、待办、概览和动态数组。
- 停止使用 `LogAPI` 获取客户访问指标。
- 切换 7/30 天时重新请求聚合接口。
- 待办和动态按后端路由跳转。

小程序：

- 新增访客 ID 存储键和最小访问上报 API。
- 在应用初始化处注册一次页面显示追踪。
- 不为每个页面增加重复上报代码。

数据库迁移创建 `app_visit_daily`，增加 `dashboard:view` 权限并授予 ROOT、ADMIN；不运行会清空现有数据的全量种子脚本。

## 11. 权限、安全与错误处理

- 访客 ID 是随机设备标识，不保存客户端提交的会员身份、OpenID、手机号或 IP 作为 UV 主键。
- 上报接口使用 DTO 白名单、UUID 校验和现有限流，数据库使用唯一键及原子累加。
- 仪表盘经营数据统一受 `dashboard:view` 保护。
- 所有聚合过滤逻辑删除；会员总数额外过滤禁用会员。
- 管理端首次加载显示骨架或 `--`。请求失败显示加载失败，不能用默认零值或演示数据冒充真实结果。
- 流量或部分业务表为空时合法返回零和空数组。
- 小程序上报失败不能影响正常页面功能。

## 12. 测试与验收

最小服务测试：

1. 同一访客同一天多次访问：UV 为 1，PV 正确累加。
2. 不同访客和跨日期分别统计。
3. 7/30 天日期连续，缺失日补零。
4. 今日/昨日增长率正确，昨日为零返回 `null`。
5. 有效会员总数和新增会员过滤状态、逻辑删除。
6. 四类待办及退款异常的数量、今日新增、今日处理和最早 5 条排序正确。
7. 多来源动态合并后按真实时间倒序，只返回最近 10 条。
8. 无 `dashboard:view` 权限不能读取聚合数据；非法访客 ID 和非法 `days` 被拒绝。

交付验证：

- 后端 Jest、类型检查和生产构建通过。
- 管理端类型检查和生产构建通过。
- 小程序类型检查和对应构建通过。
- 本地 MySQL 验证唯一键上报累加和 7/30 天聚合。
- 真实 HTTP 完成“小程序页面显示 → 上报 → 管理端 UV/PV/趋势变化”。
- 创建真实会员、订单、代理、提现或退款数据后，仪表盘待办和动态同步变化。
- 页面源码中不再存在系统用户 `6`、`12.5%`、固定待办或固定系统动态。

## 13. 完成标准

管理端首页的昵称、日期、后台在线、客户流量、会员、待办和动态均来自当前登录态、服务器时间、SSE 或数据库真实记录；没有业务记录时明确显示空状态或零；没有任何演示文案、硬编码数量或错误的操作日志访问口径。
