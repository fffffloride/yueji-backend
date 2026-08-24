# 阶段 8A + 8B 分销身份与佣金账本开发执行计划

> 执行状态：待开发。

> 设计依据：`docs/superpowers/specs/2026-08-24-phase8a-8b-distribution-design.md`

## 任务 1：分销规则、实体与数据库

后端文件：

- 新增 `src/distribution/distribution.constants.ts`，定义代理、佣金和直属业绩状态。
- 新增 `src/distribution/distribution.rules.ts` 与 `distribution.rules.spec.ts`，只承载佣金整数计算、有效比例选择、升级等级选择等纯规则。
- 新增 `src/distribution/entities/` 下代理类型、等级、代理、推荐关系、佣金、直属业绩、操作日志 7 个实体。
- 新增 `sql/mysql/biz_phase8_distribution.sql`，创建 7 张表、唯一索引、外键索引和 `utf8mb4` 字符集。
- 新增 `src/distribution/distribution.module.ts` 并注册到 `src/app.module.ts`。

最小检查：

- 佣金向下取整、专属比例覆盖、二级深度和最高可升级等级规则测试通过。
- `pnpm test -- distribution.rules.spec.ts`。
- `pnpm build`。

## 任务 2：配置与代理商后台能力

后端文件：

- 新增 `src/distribution/dto/distribution.dto.ts`，集中定义类型、等级、代理分页/表单、审核、启停、调级和专属比例 DTO。
- 新增 `src/distribution/distribution.service.ts`，先实现类型、等级和代理 CRUD、状态校验、审核、手动调级/比例及操作日志。
- 新增 `src/distribution/admin/distribution-admin.controller.ts`，提供设计文档中的 B 端接口和 RBAC。

实现约束：

- 复用现有 `BaseQueryDto`、`BusinessException`、TypeORM Repository 和事务模式。
- 代理不提供物理删除；类型/等级仅未使用时允许软删除。
- 审核、启停、调级和比例调整统一写操作日志，不抽象通用工作流。
- 上级调整在事务内检查自指和后代环。

最小检查：

- 后端生产构建通过。
- 通过 HTTP 验证类型、等级、代理新增、审核、禁用、调级和专属比例。

## 任务 3：C 端申请、邀请绑定与团队查询

后端文件：

- 在 `distribution.service.ts` 增加本人申请、身份汇总、邀请码绑定、团队摘要和团队树查询。
- 新增 `src/distribution/app/distribution-app.controller.ts`，使用现有会员鉴权和 `@CurrentMember()`。
- 在 B 端 Controller 增加团队树、佣金明细和操作日志查询。

实现约束：

- C 端本人接口不接受客户端会员 ID。
- 邀请绑定校验代理启用、自绑、重复关系和代理团队环。
- 团队树使用现有邻接关系一次查询后在内存组装，不引入闭包表；首批数据规模不足以需要额外结构。

最小检查：

- 申请后状态为待审核，审核后能读取邀请码和身份汇总。
- 首次绑定成功；自绑、重复绑定和环路返回业务错误。
- 管理端与 C 端团队查询只返回授权范围内数据。

## 任务 4：佣金、直属业绩和订单事件

后端文件：

- 在 `distribution.service.ts` 增加统一的 `syncOrder(orderId)` 幂等同步入口。
- 订阅 `order.paid`、`order.verified`、`order.refunded`；事件处理只调用同一同步入口。
- 新增 `src/distribution/distribution.task.ts`，每分钟补偿已付款、已完成和已退款订单。
- 扩展 `src/order/order-state.ts`、`src/payment/payment.service.ts` 和相关测试，允许已完成订单整单退款。

支付同步：

- 锁定订单，按支付时有效推荐关系创建直属业绩待核销记录。
- 为有效一级代理和允许二级分销的有效上级生成佣金快照。
- 冻结推荐关系；唯一索引处理事件重复和并发。

核销同步：

- 佣金待结算转可提现。
- 直属业绩待核销转已计入，累计代理直属销售额。
- 选择最高达标启用等级，只自动向上升级并记录日志。

退款同步：

- 佣金待结算/可提现转已冲销。
- 已计入直属业绩转已冲销并扣回累计值，最低为 0，不自动降级。
- 已完成订单退款复用现有库存、销量、积分和权益回退，不增加部分退款。

最小检查：

- 新增一个 `src/distribution/distribution.service.spec.ts` 闭环测试，覆盖重复支付、一级/二级金额、核销升级、退款冲销、禁用代理和重复补偿。
- 更新 `src/order/order-state.spec.ts`、`src/payment/payment.service.spec.ts` 的已完成订单退款预期。
- `pnpm test -- distribution.service.spec.ts order-state.spec.ts payment.service.spec.ts`。

## 任务 5：菜单、种子和本地数据库

SQL 文件：

- 新增 `sql/mysql/menu_phase8_distribution.sql`，创建“分销管理”及代理类型、分销等级、代理商、团队结构、佣金明细菜单和按钮权限。
- 更新 `sql/mysql/biz_test_seed.sql`，加入类型、等级、两级团队、待审核/启用/禁用代理、推荐关系和三种佣金状态。
- SQL 显式 `SET NAMES utf8mb4`，授权 ROOT、ADMIN，并清理对应权限缓存。

最小检查：

- 将业务表、菜单和测试数据 SQL 应用到本地 MySQL。
- 用数据库查询确认中文菜单、唯一约束、角色权限和测试数据正确。
- 后端重启后新接口无 403。

## 任务 6：管理端 API 与页面

管理端文件：

- 新增 `yueji-oss/src/api/distribution/index.ts` 和 `types.ts`。
- 新增 `yueji-oss/src/views/distribution/type/index.vue`。
- 新增 `yueji-oss/src/views/distribution/level/index.vue`。
- 新增 `yueji-oss/src/views/distribution/agent/index.vue`。
- 新增 `yueji-oss/src/views/distribution/team/index.vue`。
- 新增 `yueji-oss/src/views/distribution/commission/index.vue`。

页面范围：

- 类型和等级：表格、抽屉表单、启停和未使用删除。
- 代理商：筛选、新增、编辑、审核、启停、调级、专属比例及操作日志。
- 团队：复用 Element Plus 树组件，点击查看节点摘要；结构调整仍从代理商页完成。
- 佣金：订单、代理、层级、状态、时间筛选和只读明细。

实现约束：

- 复用现有请求封装、`usePageTable`、分页、抽屉和状态标签模式。
- 不修改用户已有 `.env.development` 和 `pnpm-lock.yaml`，不新增依赖。

最小检查：

- `pnpm type-check`。
- `pnpm build`。
- 浏览器逐页验证菜单、筛选、表单、状态操作、团队树和佣金表，无乱码、无控制台错误。

## 任务 7：闭环验收与交付

- 启动后端和管理端，使用真实 HTTP 完成“申请 → 审核 → 邀请绑定 → 支付 → 待结算 → 核销 → 可提现 → 10 万升级 → 退款 → 冲销”闭环。
- 重放支付、核销、退款和补偿，确认佣金、直属业绩、等级和日志无重复。
- 验证禁用代理不参与新订单，历史账本仍可查。
- 运行后端全量 Jest、lint、生产构建；运行管理端类型检查、lint、生产构建。
- 更新三端各自的 `docs/改造计划.md` 中阶段 8 进度；小程序 UI 保持未接入。
- 后端、管理端和小程序文档分别提交，只暂存本阶段文件，保留用户原有改动和 `.superpowers/` 可视化文件。

## 完成标准

- 设计文档第 9 节的 5 条闭环测试全部通过。
- ROOT、ADMIN 可使用全部分销管理页面；其他角色受 RBAC 限制。
- 佣金金额、关系、等级和比例按支付时快照保存，重复事件不重复记账。
- 10 万直属有效销售额自动升级，退款扣回业绩但不自动降级。
- 8C～8E 未提前实现，也未引入新依赖或通用基础设施。
