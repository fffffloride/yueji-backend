# 管理端仪表盘真实数据开发执行计划

配套设计：`docs/superpowers/specs/2026-08-25-real-dashboard-data-design.md`

## 任务 1：访问日表、权限和后端模块

新增：

- `sql/mysql/biz_dashboard.sql`
- `sql/mysql/menu_dashboard.sql`
- `src/dashboard/entities/app-visit-daily.entity.ts`
- `src/dashboard/dto/dashboard.dto.ts`
- `src/dashboard/dashboard.module.ts`

修改：

- `src/app.module.ts`
- `src/config/typeorm.config.ts`

实施：

- 创建 `app_visit_daily`，包含日期、访客 UUID、PV、首次/最近访问时间。
- 增加 `(visit_date, visitor_id)` 唯一键和日期索引。
- 增加 `dashboard:view` 权限并仅授权 ROOT、ADMIN。
- 注册 `DashboardModule` 及聚合所需的现有实体仓库。
- DTO 只接受合法访客 UUID；`days` 只允许 7 或 30，默认 7。
- 数据库连接业务时区明确为 `+08:00`，统计日期按 `Asia/Shanghai`。

检查：

- 增量 SQL 在现有本地 MySQL 执行成功且可重复检查，不运行全量清库种子。
- 后端类型检查和 Swagger 构建识别新增模块与 DTO。

## 任务 2：小程序访问上报后端闭环

新增：

- `src/dashboard/dashboard.service.ts`
- `src/dashboard/dashboard.service.spec.ts`
- `src/dashboard/app/dashboard-app.controller.ts`

实施：

- 先写上报服务测试：同一访客同日累加、不同访客分行、跨日分行。
- 使用 MySQL `INSERT ... ON DUPLICATE KEY UPDATE` 原子增加 PV。
- 新增公开 `POST /api/v1/app/analytics/visit`。
- 日期和时间仅由数据库产生；接口不接收会员、日期、IP 或 PV 数值。
- 返回 `{ success: true }`，保留全局 DTO 校验和限流。

检查：

- 服务测试覆盖唯一键累加及异常输入。
- 并发发送同一访客上报后只有一条当日记录，PV 等于请求次数。

## 任务 3：流量与会员聚合

新增：

- `src/dashboard/admin/dashboard-admin.controller.ts`

修改：

- `src/dashboard/dashboard.service.ts`
- `src/dashboard/dashboard.service.spec.ts`

实施：

- 实现 `GET /api/v1/dashboard/overview?days=7|30`，加 `dashboard:view` 权限。
- 统计今日/昨日 UV、PV，生成连续 7/30 天趋势并为缺失日补零。
- 统计正常且未删除会员总数、今日新增、昨日新增。
- 增长率统一返回小数；昨日为零返回 `null`。
- 不再从 `sys_log` 推导客户 UV/PV；旧日志统计接口保持兼容但不供首页使用。

检查：

- 测试覆盖空表、缺失日期、7/30 天、增长/下降及昨日为零。
- 无权限请求返回权限错误。

## 任务 4：真实待办聚合

修改：

- `src/dashboard/dashboard.service.ts`
- `src/dashboard/dashboard.service.spec.ts`
- `src/dashboard/dto/dashboard.dto.ts`

实施：

- 聚合待核销订单、待审核代理、待审核/待打款提现、失败和超时处理中退款。
- 超时处理中退款固定为创建超过 30 分钟仍为处理中。
- 计算当前待处理、今日新增和今日已处理。
- 按开始时间升序返回最早 5 条，附真实状态和管理端目标路由。
- 分类数量由查询结果产生；进度百分比留给管理端用 `count / total` 计算。

检查：

- 测试逐类覆盖状态边界、逻辑删除过滤、退款 30 分钟边界。
- 同一业务记录在当前待办中只出现一次；空数据返回零和空数组。

## 任务 5：真实系统动态聚合

修改：

- `src/dashboard/dashboard.service.ts`
- `src/dashboard/dashboard.service.spec.ts`
- `src/dashboard/dto/dashboard.dto.ts`

实施：

- 从 `sys_log`、会员、订单、退款、预约、代理、提现和通知表并行查询近期候选记录。
- 将创建、支付、核销、取消、退款、申请、审核、打款和发布转换为统一动态 DTO。
- 使用带来源前缀的稳定 ID，避免不同表主键冲突。
- 按真实发生时间倒序合并，返回最近 10 条及可用目标路由。
- 不增加事件表、事件总线或缓存。

检查：

- 测试覆盖跨来源排序、同一记录的多个真实时间事件、空字段回退和只取 10 条。
- 不生成数据库备份、SSL 续期等无来源文案。

## 任务 6：管理端首页接入

在 `yueji-oss` 新增：

- `src/api/dashboard/index.ts`
- `src/api/dashboard/types.ts`

修改：

- `src/views/dashboard/index.vue`

实施：

- 使用 `DashboardAPI.getOverview(days)` 替换首页 `LogAPI`。
- 删除写死的系统用户 `6`、`12.5%`、待办数组、概览数组和系统动态数组。
- “在线用户”改名“后台在线”，继续复用现有 SSE。
- “系统用户”改为会员总数，接入真实今日/昨日新增趋势。
- 访问趋势切换 7/30 天时重新请求聚合接口。
- 待办概览、待办列表和系统动态完全渲染接口结果。
- 待办和动态点击时跳转后端提供的目标路由。
- 初次加载显示骨架或 `--`；失败显示加载失败，不回填演示值或假零。
- 继续复用现有 ECharts、Element Plus、`formatGrowthRate` 和请求封装，不增加依赖。

检查：

- `rg` 确认首页不再包含固定数量和演示文案。
- 管理端改动文件 ESLint/Prettier/Stylelint、类型检查和生产构建通过。

## 任务 7：小程序统一访问追踪

在 `yueji-web` 新增：

- `src/api/analytics/index.ts`
- `src/utils/visit-tracker.ts`

修改：

- `src/constants/storage-key.ts`
- `src/main.ts`

实施：

- 增加持久化访客 ID 存储键。
- 使用平台随机数能力生成 UUID，不新增 UUID 依赖。
- 注册一次应用级页面 `onShow` 追踪，确认 App 和普通组件不会重复上报。
- 每次真实页面显示调用访问上报接口。
- 请求设置 `skipAuth: true`、`skipErrorToast: true`；失败静默忽略，不阻塞页面。
- 不在各页面复制上报代码，不采集页面路径、点击、OpenID 或手机号。

检查：

- 首次启动只生成一个访客 ID，重启后保持不变。
- 打开、切换 Tab、进入子页和返回分别产生一次 PV，没有组件级重复上报。
- 断网时页面正常使用且不弹错误提示。
- 小程序类型检查和目标构建通过。

## 任务 8：真实三端闭环与清理

实施：

- 以隔离访客 ID 从小程序产生多次页面访问，验证 UV/PV 和 7/30 天趋势。
- 新建真实会员，验证会员总数和新增趋势。
- 创建各状态订单、代理、提现和退款，验证待办计数、排序、跳转和今日处理。
- 执行真实后台操作和客户业务流，验证系统动态内容和相对时间。
- 验证昨日无数据时增长率显示 `--`，不再出现 `10000%`。
- 删除仪表盘不再使用的日志统计类型/import；不删除日志模块本身。
- 更新三端改造进度文档。
- 后端、管理端、小程序分别只提交本任务相关文件，保留用户已有未跟踪文件和无关改动。

最终检查：

- 后端 Jest、类型检查、生产构建和改动文件 ESLint 通过。
- 管理端类型检查、生产构建及改动文件检查通过。
- 小程序类型检查、目标构建及改动文件检查通过。
- 本地 MySQL 增量 SQL、唯一键和中文权限数据验证通过。
- 后端 `8000`、管理端 `3000` 和小程序联调环境保持可用。
- 不执行会清空业务数据的全量初始化脚本。

## 完成标准

- 首页所有数据均来自登录态、服务器时间、SSE、访问日表或现有业务表。
- 没有数据时显示真实零、空状态或 `--`，没有任何演示数据兜底。
- 小程序真实访问能改变 UV/PV，真实业务状态能改变会员、待办和动态。
- 增长率口径统一、权限受控、上报失败不影响 C 端用户体验。
