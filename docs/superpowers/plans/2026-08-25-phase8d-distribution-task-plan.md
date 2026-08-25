# 阶段 8D 分销任务管理开发执行计划

## 任务 1：任务规则与数据模型

新增：

- `src/distribution/distribution-task.rules.ts`
- `src/distribution/distribution-task.rules.spec.ts`
- `src/distribution/entities/distribution-task.entity.ts`
- `src/distribution/entities/distribution-task-assignee.entity.ts`

修改：

- `src/distribution/distribution.constants.ts`
- `src/distribution/distribution.module.ts`

实施：

- 定义销售额/订单数指标、全部/等级/代理分配范围和草稿/发布/取消状态。
- 用纯函数计算展示状态、有效结束时间、完成进度和比例。
- 新增任务与固定代理名单实体，名单使用任务代理唯一键。
- 不新增奖励、进度流水、完成时间或定时任务。

检查：

- 一个规则测试覆盖时间边界、取消截断和两种指标的完成判断。

## 任务 2：任务服务

新增：

- `src/distribution/distribution-task.service.ts`

修改：

- `src/distribution/distribution.module.ts`

实施：

- 草稿新增、详情、编辑和删除。
- 发布时锁定任务，按全部代理、指定等级或指定代理生成已审核代理名单快照。
- 发布和取消幂等；发布后内容和名单不可修改。
- 复用 `distribution_direct_sales`，按已计入状态与核销时间分组实时计算进度。
- 提供后台任务分页、代理完成情况分页，以及本人任务分页和详情。
- 分组聚合当前查询所需数据，不逐代理查询。

检查：

- 服务测试或真实 HTTP 覆盖名单快照、直属核销统计、状态限制和 C 端归属校验。

## 任务 3：B/C 端接口

修改：

- `src/distribution/dto/distribution.dto.ts`
- `src/distribution/admin/distribution-admin.controller.ts`
- `src/distribution/app/distribution-app.controller.ts`

实施：

- B 端任务分页/详情、草稿增改删、发布、取消和代理完成情况分页。
- C 端本人任务分页和详情。
- DTO 校验指标目标、时间和分配范围；C 端代理 ID 只从会员 JWT 获取。
- 新增任务查询、创建、修改、删除、发布和取消权限点。

检查：

- Swagger 构建和 DTO 校验通过。

## 任务 4：数据库、菜单和种子

新增：

- `sql/mysql/biz_phase8d_distribution_task.sql`
- `sql/mysql/menu_phase8d_distribution_task.sql`

修改：

- `sql/mysql/biz_test_seed.sql`

实施：

- 创建任务和任务名单表、索引与唯一键。
- 增加“任务管理”菜单及查询、创建、修改、删除、发布、取消权限，授权 ROOT + ADMIN。
- 测试种子增加草稿、进行中、结束和取消任务样例，不自动执行清库脚本。

检查：

- 增量 SQL 在本地 MySQL 执行成功。
- 中文菜单以 UTF-8 查询无乱码；清理 ADMIN 旧权限缓存。

## 任务 5：管理端页面

修改：

- `yueji-oss/src/api/distribution/index.ts`
- `yueji-oss/src/api/distribution/types.ts`

新增：

- `yueji-oss/src/views/distribution/task/index.vue`

实施：

- 任务列表展示指标、目标、有效期、名单数、完成人数和状态。
- 新增/编辑抽屉支持全部代理、指定等级和指定代理。
- 草稿提供编辑、删除和发布；已发布提供取消；完成情况抽屉展示实时进度。
- 复用现有接口封装、权限指令、分页和 Element Plus 组件，不增加依赖。
- 销售额按元输入展示，提交时转换为整数分。

检查：

- 改动文件 ESLint/Prettier/Stylelint、类型检查和生产构建通过。

## 任务 6：真实闭环与交付

实施：

- 执行增量数据库和菜单 SQL，不执行会清空业务数据的全量种子。
- 重启后端并保持管理端运行。
- 真实 HTTP 完成“创建草稿 → 发布固定名单 → 核销直属订单 → 查询完成状态 → 取消后停止累计”。
- 验证重复发布/取消不重复写名单，未分配代理不能读取任务。
- 更新后端、管理端和小程序进度文档并分别提交。
- 保留 `.superpowers/`、环境文件、锁文件和其他用户改动。

最终检查：

- 后端全量 Jest、生产构建及改动文件 ESLint 通过。
- 管理端类型检查、生产构建及改动文件检查通过。
- 本地后端 `8000` 和管理端 `3000` 保持运行。

## 完成标准

- 运营人员能创建、发布和取消销售任务，并查看固定名单的实时完成情况。
- 销售额与订单数只统计任务有效期内直属客户的已核销订单。
- 代理可通过 C 端接口查看本人任务，不能读取未分配任务。
- 系统不包含奖励、人工完成、反馈、进度流水或首次完成时间。
