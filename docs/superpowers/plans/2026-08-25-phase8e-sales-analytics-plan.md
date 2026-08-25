# 阶段 8E 销售统计与分析开发执行计划

## 任务 1：日期规则与统计服务

新增：

- `src/distribution/distribution-analytics.rules.ts`
- `src/distribution/distribution-analytics.rules.spec.ts`
- `src/distribution/distribution-analytics.service.ts`

修改：

- `src/distribution/distribution.module.ts`

实施：

- 纯函数完成日期范围校验、上海时区起止时间、自动日/月/年粒度、周期标签和趋势补零。
- 直接聚合已完成订单，计算全系统销售额、订单数和趋势。
- 直接聚合已计入直属业绩，计算分销销售额、代理排名、当前等级统计和代理个人趋势。
- 不新增统计表、实体、定时任务或缓存。

检查：

- 一个规则测试覆盖粒度边界、补零和非法范围。

## 任务 2：B/C 端接口与 Excel

修改：

- `src/distribution/dto/distribution.dto.ts`
- `src/distribution/admin/distribution-admin.controller.ts`
- `src/distribution/app/distribution-app.controller.ts`

实施：

- B 端提供总览、代理排名分页、代理详情和三工作表 Excel 导出。
- C 端使用会员 JWT 提供本人汇总与趋势，不接受代理 ID。
- 复用现有 XLSX、统一分页响应和 RBAC，不新增依赖。
- Excel 金额以元展示，接口金额继续使用整数分。

检查：

- Swagger、DTO、权限和越权边界通过真实 HTTP 验证。

## 任务 3：数据库索引、菜单和种子

新增：

- `sql/mysql/biz_phase8e_sales_analytics.sql`
- `sql/mysql/menu_phase8e_sales_analytics.sql`

修改：

- `sql/mysql/biz_test_seed.sql`

实施：

- 为订单核销时间和直属业绩统计增加组合索引。
- 增加“销售统计”菜单及查看、导出权限，授权 ROOT + ADMIN。
- 补充跨日期、非分销订单和不同代理等级的统计样例，不自动执行清库种子。

检查：

- 增量 SQL 在本地 MySQL 执行成功，菜单中文和权限正确。

## 任务 4：管理端页面

修改：

- `yueji-oss/src/api/distribution/index.ts`
- `yueji-oss/src/api/distribution/types.ts`

新增：

- `yueji-oss/src/views/distribution/analytics/index.vue`

实施：

- 日期筛选、四张汇总卡、双折线趋势、层级统计和代理排名分页。
- 代理排名支持姓名/手机与当前等级筛选；详情抽屉展示个人汇总与趋势。
- 复用现有 ECharts、下载工具、权限指令和分页组件。

检查：

- 改动文件 ESLint、Prettier、Stylelint、类型检查和生产构建通过。

## 任务 5：真实验收与交付

实施：

- 执行增量索引和菜单 SQL，不执行会清空业务数据的全量种子。
- 真实 HTTP 验证已支付未核销不计入、核销后计入、非分销订单只进入全系统销售。
- 验证当前等级归类、稳定排名、C 端本人数据和三工作表 Excel。
- 更新三端进度文档并分别提交，保持后端 8000 和管理端 3000 运行。

最终检查：

- 后端全量 Jest、改动文件 ESLint 和生产构建通过。
- 管理端改动文件检查、类型检查和生产构建通过。
- 保留 `.superpowers/` 和其他用户改动。

## 完成标准

- 管理员能按时间查看全系统销售、分销直属业绩、代理排名和当前等级统计。
- 管理员能查看代理个人趋势，并导出统计口径一致的三工作表 Excel。
- 代理能通过 C 端接口查看本人汇总和趋势，不能读取其他代理数据。
- 所有统计只计算已核销数据，不包含奖励、二级团队或原始订单明细。
