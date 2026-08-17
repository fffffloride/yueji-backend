# 悦己 DLumière — 本仓库给 AI / 新对话的入口

本仓库是「悦己 DLumière」医美小程序的 **NestJS 服务端**（由 youlai-nest 模板改造）。

**先读总计划再改代码：** [docs/改造计划.md](docs/改造计划.md)

## 现在做什么

- 阶段 0 / 1 / 2 已完成。
- **阶段 4 服务端 + 管理端已完成**（支付抽象、整单退款、会员 360、管理端会员与退款操作）。小程序尚未接入。
- 下一件事：把阶段 3/4 小程序能力一次性接入。顺序仍是服务端 → 管理端 → 小程序。

## 硬约定（违反即返工）

- C 端接口前缀 `/api/v1/app/**`，会员 JWT `typ: "member"`；B 端走现有 RBAC。`member` 与 `sys_user` 不得混用。
- 金额用整数分；基础业务表见 `sql/mysql/biz_p0.sql`，阶段 4 增量见 `sql/mysql/biz_phase4.sql`。
- 模板系统层（管理端登录、`src/system`、`src/file`）不改核心逻辑。
- 回复用户用简体中文。

## 本地

- Docker：`docker/docker-compose.yml`（MySQL / Redis / MinIO）
- 启动：`pnpm start:dev` → http://localhost:8000
- 文档：B 端 `/api-docs`，C 端 `/app-api-docs`
- 管理端登录：`admin` / `123456`
