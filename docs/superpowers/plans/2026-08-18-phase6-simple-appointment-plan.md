# 阶段 6 最简预约开发执行计划

> 设计依据：`docs/superpowers/specs/2026-08-18-phase6-simple-appointment-design.md`

## 目标

实现会员提交预约日期/时间、后台分页查询，并将结构、权限和测试数据应用到本地 Docker 环境。全程不引入医生、排班、订单、状态或新依赖。

## 任务 1：数据库结构与实体

涉及文件：

- 新增 `sql/mysql/biz_phase6.sql`
- 新增 `src/appointment/entities/appointment.entity.ts`

步骤：

1. 创建 `appointment` 表，包含会员、日期、时间和通用审计字段。
2. 添加会员索引、日期索引和会员+日期+时间唯一索引。
3. 创建与表字段一一对应的 TypeORM 实体并继承 `BaseEntity`。
4. 运行 `pnpm build`，确认实体元数据和类型正确。

## 任务 2：创建接口与最小测试

涉及文件：

- 新增 `src/appointment/dto/appointment-create.dto.ts`
- 新增 `src/appointment/appointment.service.ts`
- 新增 `src/appointment/appointment.service.spec.ts`
- 新增 `src/appointment/app/appointment-app.controller.ts`

步骤：

1. DTO 使用固定正则限制 `YYYY-MM-DD` 与 `HH:mm`，错误信息使用中文。
2. Service 使用现有 `dayjs` 严格解析日期/时间并拒绝过去时间。
3. 保存前检查相同会员、日期和时间；保存时仍依赖唯一索引兜底并转换重复键错误。
4. Controller 使用 `@MemberAuth()` 和 `@CurrentMember()`，只接收日期和时间。
5. 单个 Jest 文件覆盖合法预约、过去时间、重复预约三个分支。
6. 运行 `pnpm test -- appointment.service.spec.ts --runInBand`。

## 任务 3：后台分页接口与模块注册

涉及文件：

- 新增 `src/appointment/dto/appointment-query.dto.ts`
- 新增 `src/appointment/admin/appointment-admin.controller.ts`
- 新增 `src/appointment/appointment.module.ts`
- 修改 `src/appointment/appointment.service.ts`
- 修改 `src/app.module.ts`

步骤：

1. 查询 DTO 复用 `BaseQueryDto`，只增加会员关键字和预约日期。
2. Service 通过查询构造器关联 `member`，返回现有分页结构 `{ data, page }`。
3. 后台 Controller 只开放 `GET /appointments/page`，权限为 `biz:appointment:query`。
4. 注册 `AppointmentModule`，不导出无调用方的 Service。
5. 运行预约测试、全量 Jest 和 `pnpm build`。

## 任务 4：菜单权限与本地测试数据

涉及文件：

- 新增 `sql/mysql/menu_appointment.sql`
- 修改 `sql/mysql/biz_test_seed.sql`

步骤：

1. 新增顶级“预约管理”菜单、预约记录页面和查询按钮权限，使用未占用的 3400 段菜单 ID。
2. SQL 使用可重复执行的删除/插入方式，授权 ROOT 和 ADMIN。
3. 种子脚本声明依赖阶段 6，清理预约表后再清理会员表。
4. 生成覆盖过去、当天和未来日期的预约记录，并加入数量与外键完整性守卫。
5. 汇总输出增加 `appointment` 行数。

## 任务 5：管理端查询页面

涉及文件（管理端仓库 `yueji-oss`）：

- 新增 `src/api/appointment/types.ts`
- 新增 `src/api/appointment/index.ts`
- 新增 `src/views/appointment/index.vue`

步骤：

1. 定义查询参数和预约列表项类型。
2. 封装 `/api/v1/appointments/page` 查询。
3. 页面复用现有 `usePageTable`、分页组件和页面布局。
4. 只提供关键字、预约日期、查询、重置、刷新和表格；不增加操作列。
5. 运行 `pnpm type-check` 和 `pnpm build`。

## 任务 6：本地数据库更新与接口验收

步骤：

1. 将 `biz_phase6.sql`、`menu_appointment.sql` 和更新后的 `biz_test_seed.sql` 复制到 MySQL 容器执行。
2. 清除 Redis 中 ROOT、ADMIN 的 `system:role:perms` 缓存。
3. 校验预约表数量、唯一索引、会员关联和菜单授权。
4. 使用 Mock 登录 Token 调用 C 端创建接口：合法时间成功，过去时间和重复时间失败。
5. 确认后台预约分页接口使用 admin Token 可访问且筛选正确。

## 任务 7：页面验收、文档与提交

涉及文件：

- 修改三端 `docs/改造计划.md` 中阶段 6 进度；小程序仍标记页面未接入。
- 修改后端、管理端 `AGENTS.md` 当前状态。

步骤：

1. 在管理端打开预约管理页面，检查列表、分页、会员关键字和日期筛选，无 403。
2. 运行 `git diff --check`，确认未覆盖管理端已有 `.env.development`、`pnpm-lock.yaml` 用户改动。
3. 后端提交服务端、SQL、测试和文档；管理端独立提交 API、页面和文档。
4. 最终报告测试结果、本地数据库变更、提交号和明确跳过的功能。
