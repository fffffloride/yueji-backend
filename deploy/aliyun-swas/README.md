# 阿里云轻量应用服务器部署

本目录用于在一台 Ubuntu 轻量应用服务器上部署管理端、NestJS、MySQL、Redis 与 MinIO。
Node.js 使用官方 Node 22 LTS 发行包，NestJS 由 systemd 守护；MySQL、Redis、MinIO
和 Nginx 由 Docker Compose 管理。

## 入口

- 管理端：`http://服务器IP/`
- 后端：由管理端通过同源前缀 `/prod-api/` 反向代理
- MinIO 公共文件：`/files/public/**`
- 容器健康检查：`http://服务器IP/healthz`

## HTTPS（lumiere.love）

线上已启用 `https://lumiere.love` 和 `https://www.lumiere.love`。
普通 HTTP 请求以 308 跳转到主域名 HTTPS，健康检查与 ACME 验证路径保留 HTTP。
证书由 Let's Encrypt 签发，Certbot 定时续期；不需要购买阿里云付费证书。

服务器持久配置：

- Nginx：`/opt/yueji/shared/nginx.https.conf`
- 证书：`/etc/letsencrypt/live/lumiere.love/`（私钥不得下载到仓库）
- 域名验证目录：`/opt/yueji/shared/acme-webroot`
- 自动续期：`certbot.timer`
- 续期后重载：`/etc/letsencrypt/renewal-hooks/deploy/yueji-nginx`
- 环境变量：`PUBLIC_BASE_URL=https://lumiere.love`、
  `YUEJI_NGINX_CONFIG=/opt/yueji/shared/nginx.https.conf`；
  后端 `OSS_MINIO_CUSTOM_DOMAIN=https://lumiere.love/files`

`compose.yml` 会挂载持久配置、完整证书目录（包含 live 符号链接目标 archive）
以及 ACME 目录。发布时继续使用服务器的 `runtime.env`，并保留线上
`ci-admin.override.yml` 等已有覆盖文件，避免把管理端退回旧版本。
日常代码发布无需重新签发证书，也无需重跑 `bootstrap.sh`。

首次给同样的部署开启 HTTPS：确认两个域名的 A 记录指向本机、80/443 端口已开放，
通过 Certbot webroot 模式先签发证书，再将 `enable-https.sh` 和
`nginx.https.conf` 一起上传服务器，以 root 运行脚本。脚本会保留所有当前 Compose
覆盖文件，备份配置，只重建管理端容器并重启后端，不操作数据库。

维护检查：

```bash
systemctl list-timers certbot.timer
certbot certificates
certbot renew --dry-run
docker exec yueji-admin-1 nginx -t
curl --fail https://lumiere.love/healthz
```

若签发机构的测试服务临时繁忙，HTTPS 健康检查已经成功时不撤销有效证书；
可单独重试持久化验证目录配置：

```bash
certbot reconfigure --cert-name lumiere.love \
  --webroot-path /opt/yueji/shared/acme-webroot --non-interactive
systemctl enable --now certbot.timer
/etc/letsencrypt/renewal-hooks/deploy/yueji-nginx
```

2026-09-15 已验证：两个域名 TLS 证书校验、首页、验证码接口、308 跳转、
ACME HTTP 验证和自动续期演练。变更前服务器备份：
`/opt/yueji/shared/backups/https-20260915T145455Z`。

数据库、Redis、MinIO 和 NestJS 均只监听本机端口。生产变量放在服务器
`/opt/yueji/shared/runtime.env` 与 `backend.env`，权限为 `600`，不得提交到 Git。

## 启动

服务器首次部署时上传 `compose.yml`、`nginx.conf` 和 `bootstrap.sh`，再以 root 运行：

```bash
bash /root/yueji-bootstrap.sh
```

脚本会校验两个仓库的锁定提交、安装并校验 Node 22、构建前后端、启动基础容器、
创建 MinIO 公共桶并安装 `yueji-backend.service`。首次启动时 MySQL 会按阶段 0–8E
顺序初始化；具名卷保存业务数据，后续发布不会重复执行初始化 SQL。

常用检查：

```bash
systemctl status yueji-backend.service
docker compose --env-file /opt/yueji/shared/runtime.env -f /opt/yueji/current/compose.yml ps
curl --fail http://127.0.0.1/healthz
```

当前后端的微信支付驱动仍是占位实现。`PAYMENT_DRIVER=wechat` 可保证生产环境不会使用 Mock
支付，但真实支付必须在补齐微信支付实现和商户配置后才能开放。

## 手动发布

当前项目尚未接入微信商户，因此本部署配置明确关闭支付。打包时 `start.cjs` 成为
`dist/main.js`，先设置 `PAYMENT_DRIVER=disabled`，再加载原应用入口 `dist/application.js`。
这个非秘密设置随发布包保留，避免更改共享环境导致旧版本无法回退。付款、退款和支付回调
均被拒绝，补偿任务不处理资金状态。后台其他功能可正常运行，生产环境仍禁止 Mock 支付。
以后接入真实支付时，先补齐微信商户及 HTTPS 回调配置，再移除工作流中的入口替换步骤并
重新构建发布；不要只修改共享环境变量，因为当前发布入口会明确覆盖支付驱动。

两个仓库的 Actions → **Manual Aliyun release** → **Run workflow**，选择 `master`：

- `check`：检查连接、运行方式和备份前置条件，不构建、不停机。
- `build`：仅在 GitHub 上检查和构建，不连接生产服务器。
- `deploy`：在 GitHub 托管机器上检查并构建，上传制品，然后备份和发布。
- `rollback`：切回上一应用版本，不构建，也不覆盖数据库或上传文件。

仅手动触发，推送代码不会上线。后端仍用现有 systemd 服务，前端仍用现有 Nginx 容器。
流水线不会运行 bootstrap、执行数据库迁移或更新 MySQL、Redis、MinIO 容器。

发布顺序：构建通过 → 上传制品并校验 SHA-256 → 短暂停止后端和文件服务并生成一致备份
→ 恢复原服务 → 在隔离容器中验证数据库和文件恢复 → 上传 OSS 并下载校验
→ 切换应用 → 健康检查。构建失败不改变服务器；备份、恢复验证或上传失败时不切换版本。

每次发布的新备份保存在 `/opt/yueji/shared/backups/full-<UTC时间>/`，站外副本位于私有桶
`oss://yueji-backup-sh-e99bdc29/yueji/full-<UTC时间>/`，使用 AES256 托管加密。
包含 MySQL、MinIO 数据、恢复所需的环境和运行配置，以及校验清单；不包含可重新构建的代码包。
`upload-receipt.json` 是上传及下载校验成功凭据。每次发布记录对应的 `last-backup.path`。
备份恢复点是切换之前的时间，不包含此后新增数据。Redis 按现有用途视为缓存，不在本备份范围。

健康检查失败会尝试自动恢复先前应用并将任务标为失败。数据恢复需选定备份后单独操作，
不能把“构建失败”作为自动覆盖生产数据库的理由。隔离恢复验证可重复运行：

```bash
python3 -I /usr/local/lib/yueji-release/verify-backup.py /opt/yueji/shared/backups/full-<UTC时间>
```

### 一次性接入

服务器由管理员安装此目录的 `release.sh`、`backup.py`、`verify-backup.py`、`upload.cjs`
到 `/usr/local/lib/yueji-release/`，安装 `dispatch.sh` 为 `/usr/local/sbin/yueji-release`，
均由 root 持有且不允许部署账号修改。`yueji-release` 是仅用于解包的 nologin 系统账号。
专用 SSH 账号 `yueji-deploy` 只上传制品，sudo 仅允许调用固定的发布入口，不能传入任意脚本。
SSH 公钥、主机指纹、OSS 最小权限账号需预先配置；OSS 密钥只放在服务器 root 私有文件中。

两个仓库各配置 `production` environment，仅允许 `master`，无需审核人或分支规则：

仅需添加 `DEPLOY_SSH_KEY`，值为专用 SSH 私钥。服务器地址、账号、端口和已核验的主机公钥
记录在工作流中；这些连接信息不包含秘密。更换服务器时须重新核验主机公钥。

服务器发布任务由 systemd 执行，SSH 中断后仍继续；两个仓库共用服务器锁，串行发布。
备份和切换有短暂中断，请在低访问时段手动发布。首次构建和上线须实际验证，语法检查不等于发布成功。
现有 lint、单测、生产依赖审计和构建任一失败均停止；不自动忽略现有项目问题。

新版本在 `/opt/yueji/ci-releases/{admin,backend}/`；当前和上一版本应保留。
前端挂载覆盖在 `/opt/yueji/shared/ci-admin.override.yml`，手工操作 Compose 时也应带上此文件；
后端工作目录覆盖在 `/etc/systemd/system/yueji-backend.service.d/90-ci-release.conf`。
原始 `/opt/yueji/current` 保留。备份和旧版本不自动删除，容量增长时再安排保留策略。
