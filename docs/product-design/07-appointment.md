# 预约模块产品设计说明

> 模块状态：我的预约、取消、改期与服务完成已在服务端落地，三端共用同一状态口径。

## 1. 模块定位

预约模块承载两种真实预约：

- **面诊预约**：不关联订单，创建后进入待到店，由后台人工完成服务。
- **订单预约**：关联会员本人已付款订单，订单核销时自动完成。

“待预约”不是预约状态，而是动态查询“已付款且不存在待到店或已完成预约”的订单。预约表只保存已经选定日期和时间的记录。

## 2. 状态与列表

预约状态：

| 值 | 状态 | 是否占容量 | 终态 |
| --- | --- | --- | --- |
| `0` | `BOOKED` 待到店 | 是 | 否 |
| `1` | `COMPLETED` 已完成 | 否 | 是 |
| `2` | `CANCELLED` 已取消 | 否 | 是 |

小程序“我的预约”使用四个 Tab：

| Tab | 数据来源 |
| --- | --- |
| `PENDING_BOOKING` | 本人已付款且无待到店/已完成预约的订单 |
| `PENDING_ARRIVAL` | 本人 `BOOKED` 预约 |
| `SERVICE_RECORD` | 本人 `COMPLETED` 预约 |
| `CANCELLED` | 本人 `CANCELLED` 预约历史 |

## 3. 核心规则

- 日期格式为 `YYYY-MM-DD`，开放时段固定为每天 `10:00–18:00` 的整点。
- 新预约和改期目标时间必须严格晚于当前时间。
- 会员只能取消或改期本人尚未开始的待到店预约。
- 后台可代取消、代改期；已到点时由页面额外警告，但服务端仍允许后台处理。
- 面诊预约只能在预约开始后由后台完成；订单预约不能在预约后台直接完成。
- 订单核销与预约完成处于同一数据库事务；退款成功与预约取消处于同一数据库事务。
- 取消预约不取消订单、不退款；订单预约取消后自动重新进入待预约。
- 重复取消、核销和退款联动不重复写操作日志。

## 4. 容量与并发

- 所有场景共用一个可配置时段容量，默认每时段 1 人。
- 容量统计只包含 `BOOKED` 且未删除的记录。
- 创建和改期在事务内锁定容量配置行后再统计目标时段。
- `active_order_id` 生成列唯一索引保证同一订单最多一条待到店或已完成预约。
- `booked_member_slot_key` 生成列唯一索引保证同一会员不会重复占用同一有效时段。
- 已取消记录不参与两个唯一键，可以保留历史并重新预约。

## 5. 操作日志

`appointment_operation_log` 只追加，不提供更新或删除接口。记录：

- 动作：`CREATE`、`RESCHEDULE`、`CANCEL`、`COMPLETE`；
- 操作者：`MEMBER`、`ADMIN`、`SYSTEM`；
- 操作者 ID、前后日期时间、原因和发生时间。

后台详情按时间正序展示完整日志。开发期旧预约数据不回填或推断；增量脚本直接清理预约域测试数据后重新造数。

## 6. C 端接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/v1/app/appointments/slots` | 公开查询时段容量 |
| `GET` | `/api/v1/app/appointments/order-eligibility` | 查询本人订单预约资格 |
| `POST` | `/api/v1/app/appointments` | 创建面诊或订单预约 |
| `GET` | `/api/v1/app/appointments/summary` | 待预约、待到店、服务记录统计 |
| `GET` | `/api/v1/app/appointments/page` | 四类个人预约分页 |
| `POST` | `/api/v1/app/appointments/:id/cancel` | 取消本人未开始预约 |
| `PUT` | `/api/v1/app/appointments/:id/reschedule` | 改期本人未开始预约 |

分页列表由服务端返回 `canBook`、`canCancel`、`canReschedule`，前端不自行推断操作能力。

## 7. B 端接口与权限

| 方法 | 路径 | 权限 |
| --- | --- | --- |
| `GET` | `/api/v1/appointments/summary` | `biz:appointment:query` |
| `GET` | `/api/v1/appointments/page` | `biz:appointment:query` |
| `GET` | `/api/v1/appointments/calendar` | `biz:appointment:query` |
| `GET` | `/api/v1/appointments/slots` | `biz:appointment:query` |
| `GET` | `/api/v1/appointments/:id` | `biz:appointment:query` |
| `PUT` | `/api/v1/appointments/:id/reschedule` | `biz:appointment:reschedule` |
| `POST` | `/api/v1/appointments/:id/cancel` | `biz:appointment:cancel` |
| `POST` | `/api/v1/appointments/:id/complete` | `biz:appointment:complete` |
| `GET/PUT` | `/api/v1/appointments/config` | 查询 / `biz:appointment:config` |

后台分页支持 Tab、会员关键字、场景、日期范围和订单号组合筛选。月历返回全部状态记录，但只有 `occupiesCapacity = true` 的记录计入容量角标。

## 8. 订单接口摘要

C 端订单分页和详情返回：

```ts
appointment: { id: string; status: number } | null;
canBookAppointment: boolean;
```

只有已付款且没有待到店/已完成预约的订单才返回 `canBookAppointment: true`。预约创建接口仍会再次校验归属、订单状态、唯一性和容量。

## 9. 数据脚本

- 新数据库：`sql/mysql/biz_phase6.sql` 直接创建最终预约、容量和操作日志结构。
- 开发中既有数据库：`sql/mysql/appointment_lifecycle.sql` 仅清理预约域测试数据并升级结构。
- 菜单权限：`sql/mysql/menu_appointment.sql`。
- 完整测试种子：`sql/mysql/biz_test_seed.sql` 覆盖待到店、完成、取消、改期日志和订单场景。

不得在生产数据上执行开发期破坏性迁移。

## 10. 非目标

- 医生、门店、排班、独立号源或多门店容量；
- 爽约状态、自动完成、预约提醒或消息通知；
- 取消手续费、预约退款联动或提前 24 小时规则；
- 后台代用户创建待预约订单的预约。

## 11. 验收标准

- 取消后释放容量、保留历史，订单可以再次预约。
- 改期满额或失败时原预约时间不变。
- 用户不能操作他人的预约或已经开始的预约。
- 面诊只能后台完成，订单预约只能核销完成。
- 核销与退款联动幂等且与订单变更原子提交。
- 个人中心统计、四类分页、后台筛选和月历始终使用同一状态口径。
