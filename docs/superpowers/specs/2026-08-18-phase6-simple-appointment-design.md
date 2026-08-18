# 阶段 6 最简预约设计

## 1. 背景与目标

原阶段 6 计划包含医生、SKU 预约间隔、排班日历、改期和取消。当前业务只需要会员选择一个日期和时间，提交后由后台记录并查询。

本阶段交付范围：

- C 端会员提交预约日期和时间。
- 服务端保存预约记录并防止相同会员重复提交同一时间。
- 管理端分页查看和筛选预约记录。
- 更新本地数据库结构、菜单权限和测试种子数据。

## 2. 明确不做

- 不建设医生资料、医生排班或医生与预约的关联。
- 不关联商品、SKU、购物车、订单、支付或核销。
- 不限制每日名额、营业时间、工作日或预约间隔。
- 不实现预约状态、改期、取消、删除、完成或消息通知。
- 不在本阶段开发小程序预约页面；仅提供后续页面可直接调用的 C 端接口。
- 不增加新的依赖或通用抽象。

## 3. 数据模型

新增 `appointment` 表：

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | bigint | 主键、自增 | 预约 ID |
| `member_id` | bigint | 非空、普通索引 | 当前登录会员 ID |
| `appointment_date` | date | 非空、普通索引 | 预约日期 |
| `appointment_time` | time | 非空 | 预约时间，精确到分钟 |
| 通用审计字段 | 与现有业务表一致 |  | `create_by/create_time/update_by/update_time/is_deleted` |

增加唯一索引 `uk_member_appointment_time(member_id, appointment_date, appointment_time)`，由数据库兜底阻止并发或网络重试产生完全相同的预约。

本阶段不保存会员昵称、手机号快照；管理端查询时关联 `member` 表读取当前资料，避免重复字段。

## 4. 服务端接口

### 4.1 C 端创建预约

- 方法：`POST /api/v1/app/appointments`
- 鉴权：`@Public()` + `@MemberAuth()`，会员 ID 只从 JWT 获取。
- 请求体：

```json
{
  "appointmentDate": "2026-08-20",
  "appointmentTime": "14:30"
}
```

- 成功响应：返回新建预约的 ID、日期、时间和创建时间。
- 校验：
  - 日期必须是有效的 `YYYY-MM-DD`。
  - 时间必须是有效的 `HH:mm`。
  - 组合后的预约时间不得早于服务端当前时间。
  - 同一会员已存在相同日期和时间时返回业务错误，不新增记录。
- 不校验医生、名额、营业时间、订单或其他业务条件。

### 4.2 B 端预约分页

- 方法：`GET /api/v1/appointments/page`
- 权限：`biz:appointment:query`
- 查询参数：
  - `pageNum`、`pageSize`
  - `keywords`：匹配会员昵称或手机号
  - `appointmentDate`：精确筛选预约日期
- 排序：先按预约日期、预约时间降序，再按 ID 降序。
- 返回字段：预约 ID、会员 ID、会员昵称、会员手机号、预约日期、预约时间、创建时间。

不提供 B/C 端更新、取消或删除接口。

## 5. 服务端结构

新增 `src/appointment` 业务模块，沿用现有业务模块结构：

- `entities/appointment.entity.ts`
- `dto/appointment-create.dto.ts`
- `dto/appointment-query.dto.ts`
- `app/appointment-app.controller.ts`
- `admin/appointment-admin.controller.ts`
- `appointment.service.ts`
- `appointment.module.ts`

`AppModule` 只新增 `AppointmentModule` 引用。Service 负责基础校验、重复预约错误转换和管理端关联会员分页，不引入事件、状态机或仓储抽象。

## 6. 管理端

新增：

- `src/api/appointment/index.ts`
- `src/api/appointment/types.ts`
- `src/views/appointment/index.vue`

页面只包含：

- 会员昵称/手机号关键字输入框。
- 预约日期选择器。
- 查询、重置按钮。
- 预约记录分页表格。

表格列为预约 ID、会员昵称、手机号、预约日期、预约时间、提交时间。不显示操作列，不提供表单、弹窗或状态标签。

## 7. SQL、菜单与测试数据

- 新增 `sql/mysql/biz_phase6.sql` 创建预约表；脚本可在已有阶段 0–5 数据库上执行。
- 新增 `sql/mysql/menu_appointment.sql` 创建“预约管理”目录/菜单和查询权限，并授权 ROOT、ADMIN。
- 更新 `sql/mysql/biz_test_seed.sql`，为不同会员生成过去、当天和未来日期的预约记录，以覆盖后台筛选与分页；历史记录只用于后台测试，不经过 C 端“不能预约过去时间”的创建校验。
- 开发完成后将阶段 6 SQL 和更新后的种子数据应用到本地 Docker MySQL。
- 菜单写入后清除 `system:role:perms` 中 ROOT、ADMIN 的权限缓存，避免新增菜单出现访问权限异常。

## 8. 验证与验收

保留一个最小服务测试，覆盖：

- 合法未来日期和时间可以保存。
- 过去时间被拒绝。
- 数据库重复键被转换为明确的业务错误。

其余验证：

- 后端 Jest、生产构建通过。
- 管理端类型检查和生产构建通过。
- 使用会员 Mock Token 调用创建接口，数据库可查到记录。
- 使用 `admin/123456` 登录管理端，预约管理页面可分页、按会员和日期筛选，无 403。

## 9. 完成标准

会员提交一个有效日期和时间后，后台预约管理页面能够稳定查到该记录；重复提交、过去时间和无效格式均返回明确错误，且阶段 0–5 现有接口与页面不受影响。
