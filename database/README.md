# 数据库随版本发布

生产保持 `synchronize: false`。`sql/mysql` 是历史脚本；发布不扫描、不批量重放它们。
发布包携带 `dist/database-release`，由 `pnpm build && pnpm db:prepare` 生成。

## 基线与已有库

`baseline/schema.sql` 是当前空库初始化快照，包含历史建表及默认配置，**仅允许在确认无表的临时库/新库上用 `--bootstrap` 执行**。
它不用于线上增量升级。`baseline/adopt.sql` 补齐模板历史字段，扩容字段并保留原值；
`baseline/adopt-business.sql` 补齐已确认缺少的首页卡片、活动卡片、协议草稿表及对应管理菜单。
协议仅生成未发布的占位草稿，不替代正式协议。

已有库首次接入只运行 manifest 中 `mode: adopt` 的 SQL，然后按冻结的基线结构和配置断言验收。
验收成功才标记基线已应用；缺失其他字段或索引会阻止发布，需要另写经审查的数据保留迁移。
每次发布还使用由该版本 TypeORM 实体生成的最新 contract 检查，避免旧基线掩盖新代码依赖。

校验包括全部实体表、字段、兼容类型/最小长度、主键、实体声明索引，以及显式登记的配置与约束。
为兼容历史模板，允许更宽整数、enum 的文本存储；不自动统一 null/default、排序规则、全部外键和 CHECK 表达式。
业务所依赖的额外约束必须加入 `assertions.json`，不能把此检查当作完整 DDL 等价证明。

## 新增迁移

1. 在 `migrations/` 新增 `YYYYMMDDNNNN_description.sql`，只做保持旧版兼容的增量。
2. 向 `manifest.json` 的 `migrations` 按 ID 顺序追加条目，格式与 baseline 一致：
   `id`、`backwardCompatible: true`、`files: [{path, sha256}]`。
   `sha256` 是文件 LF 字节的 SHA-256；不要修改已发布文件、ID 或历史条目的声明。
3. 新增必需默认配置或约束时更新当前 `assertions.json`，不修改冻结的 `baseline/`。
4. 执行构建、迁移单测及真实 MySQL 集成测试。默认不允许原有表记录数变化；
   确需补默认配置时在对应迁移的 `allowRowIncrease` 显式列出配置表，只允许增加，不允许减少。
5. 删除字段、修改数据含义等破坏性变更分阶段另行处理；声明兼容性仍需要代码审查，工具不会证明 SQL 无损。

迁移版本和校验值存于 `yueji_schema_history`。出现未知版本、校验值变化、`running` 状态均拒绝继续。
MySQL DDL 可能已经提交；失败后检查实际结构和备份，不能直接删历史记录或自动恢复旧数据库。

## 测试与部署

```bash
pnpm build
pnpm db:prepare
python3 -m unittest discover -s scripts/database -p 'test_*.py' -v
python3 scripts/database/integration.py
```

集成测试只使用自己创建的随机名称 MySQL/Redis 容器，端口仅绑定本机，结束自动清理。
覆盖空库、旧库接入、重复执行、配置保留、真实业务 HTTP 请求及缺表/字段/索引/默认配置等失败场景。

服务器先一次性运行 `deploy/aliyun-swas/install-database-gate.sh` 安装受信任工具，再使用现有
GitHub CLI/Actions 的 `check / build / deploy / rollback`。工作流检查服务器协议版本，旧工具会导致发布失败。
这不会随推送自动上线；仍然只通过手动触发工作流发布。

发布顺序：完整备份 → 隔离恢复与迁移两次演练 → OSS 备份校验 → 暂停业务写入 → 正式迁移与结构检查
→ 切换应用 → 带时效签名的业务就绪检查。失败不自动恢复数据库；切换后健康失败只回退应用。
应用启动还会解析所有映射列，缺表缺列会拒绝启动。HTTP 就绪检查不返回客户数据，也不开放管理接口权限。

回退要求目标版本自带数据库 contract，并通过兼容校验；首次接入前的旧版本需人工评估，不能自动回退。
数据库最新版本独立记录在 `/opt/yueji/shared/database-release.path`，应用回退不回退迁移历史；清理旧应用时必须保留它指向的发布目录。
签名就绪接口检查预约配置、统计、列表、订单列表和已有订单详情，空库详情路径由 CI 固定测试订单覆盖。

## 2026-09-16 线上只读核对

阿里云执行 ID `t-sh06x90ghgteyo0`，扫描已部署版本的 56 个实体表。
确认缺少 `decoration_home_cards`、`decoration_promo_cards`、`agreement`；
另有系统表字段缺失/长度差异及 `session_key` 映射差异。90 条预约、120 条订单仍在。
这些结果已用于编写接入脚本；本记录不代表新流程已经安装或这些迁移已经在线上执行。
