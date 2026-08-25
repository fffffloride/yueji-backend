# 阶段 8C 结算与提现开发执行计划

## 任务 1：恢复核销后不可退款

修改：

- `src/order/order-state.ts`、`order-state.spec.ts`
- `src/payment/payment.service.ts`
- `src/order/order.service.ts`
- `src/marketing/marketing.constants.ts`
- `src/marketing/order-benefits.service.ts`

实施：

- 移除已完成订单到已退款的状态流转。
- 支付服务恢复为仅已付款待核销订单可退款。
- 删除完成订单退款专用的会员积分、累计消费和等级回退逻辑。
- 保留待核销订单退款对库存、销量、优惠券和已使用积分的原有回退。

检查：

- 状态机单测确认完成订单不可退款。
- 支付服务和订单相关既有测试通过。

## 任务 2：结算规则和数据模型

新增：

- `src/distribution/distribution-settlement.rules.ts`
- `src/distribution/distribution-settlement.rules.spec.ts`
- `src/distribution/entities/distribution-settlement-config.entity.ts`
- `src/distribution/entities/distribution-settlement.entity.ts`
- `src/distribution/entities/distribution-withdrawal.entity.ts`

修改：

- `src/distribution/distribution.constants.ts`
- `src/distribution/entities/distribution-commission.entity.ts`
- `src/distribution/distribution.module.ts`

实施：

- 定义周/月/季/年周期、申请/自动模式、提现状态和新的佣金状态。
- 实现最近已到期完整周期和下一结算日的纯函数。
- 新增结算配置、结算单、提现单实体。
- 将佣金核销时间字段改为待结算时间，增加结算单关联和结算时间。

检查：

- 纯规则测试覆盖周/月/季/年边界。

## 任务 3：结算与提现服务

新增：

- `src/distribution/distribution-settlement.service.ts`
- `src/distribution/distribution-settlement.service.spec.ts`

修改：

- `src/distribution/distribution.service.ts`
- `src/distribution/distribution.task.ts`
- `src/distribution/distribution.module.ts`

实施：

- 核销将佣金改为待结算；待核销退款仍冲销。
- 配置查询和更新。
- 到期周期结算、结算单分页和人工补偿入口。
- 账户余额聚合。
- 主动提现、自动生成提现、审核、驳回和确认打款。
- 代理行锁、结算唯一键、自动提现唯一键和状态条件保证并发幂等。
- 定时任务复用同一到期结算方法。

检查：

- 一个资金闭环测试覆盖核销、结算、部分提现、冻结、驳回释放、自动上限、审核和打款。

## 任务 4：B/C 端接口

修改：

- `src/distribution/dto/distribution.dto.ts`
- `src/distribution/admin/distribution-admin.controller.ts`
- `src/distribution/app/distribution-app.controller.ts`

实施：

- B 端结算配置、到期执行、结算分页、提现分页、审核和打款接口。
- C 端结算账户、主动提现和本人提现记录接口。
- 所有代理、会员、OpenID 和余额字段均从服务端上下文获取。

检查：

- Swagger 构建和 DTO 校验通过。

## 任务 5：数据库、菜单和种子

新增：

- `sql/mysql/biz_phase8c_settlement.sql`
- `sql/mysql/menu_phase8c_settlement.sql`

修改：

- `sql/mysql/biz_test_seed.sql`

实施：

- 迁移佣金状态相关字段并创建三张新表。
- 创建默认月结配置。
- 增加“结算管理”菜单及配置、执行、审核和打款权限，授权 ROOT + ADMIN。
- 测试种子加入结算单和各状态提现单，不自动执行清库脚本。

检查：

- 增量 SQL 在本地 MySQL 执行成功。
- 中文菜单以 UTF-8 查询无乱码；清理 ADMIN 旧权限缓存。

## 任务 6：管理端页面

修改：

- `yueji-oss/src/api/distribution/index.ts`
- `yueji-oss/src/api/distribution/types.ts`

新增：

- `yueji-oss/src/views/distribution/settlement/index.vue`

实施：

- 一个页面提供结算设置、结算记录、提现审核三个页签。
- 周期联动星期/日期输入；金额元分转换。
- 支持执行到期结算、筛选、审核/驳回和确认打款。
- 复用现有请求封装、权限指令、分页和 Element Plus 组件，不增加依赖。

检查：

- 改动文件 ESLint/Prettier/Stylelint、类型检查和生产构建通过。

## 任务 7：真实闭环和交付

实施：

- 重启后端和管理端。
- 使用隔离代理与订单完成支付、核销、到期结算、主动/自动提现、审核、驳回和确认打款闭环。
- 重放结算、申请、审核和打款，确认不重复。
- 更新后端、管理端和小程序进度文档。
- 后端、管理端和小程序文档分别提交；保留用户已有 `.env.development`、`pnpm-lock.yaml` 和无关改动。

最终检查：

- 后端全量 Jest、生产构建及改动文件 ESLint 通过。
- 管理端类型检查、生产构建及改动文件检查通过。
- 本地后端 `8000` 和管理端 `3000` 保持运行。
- 全量测试种子因会清空业务表而不执行，除非用户单独明确授权。

## 完成标准

- 核销后的订单不能退款。
- 佣金按上一完整周期只结算一次。
- 申请和自动模式都必须审核。
- 自定义提现、单笔上限、冻结、驳回释放和人工打款确认金额正确且可重试。
- 管理端可配置、查询和操作，C 端接口可供后续小程序直接接入。
