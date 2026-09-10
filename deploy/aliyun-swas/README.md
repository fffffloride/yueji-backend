# 阿里云轻量应用服务器部署

本目录用于在一台 Ubuntu 轻量应用服务器上部署管理端、NestJS、MySQL、Redis 与 MinIO。
Node.js 使用官方 Node 22 LTS 发行包，NestJS 由 systemd 守护；MySQL、Redis、MinIO
和 Nginx 由 Docker Compose 管理。

## 入口

- 管理端：`http://服务器IP/`
- 后端：由管理端通过同源前缀 `/prod-api/` 反向代理
- MinIO 公共文件：`/files/public/**`
- 容器健康检查：`http://服务器IP/healthz`

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

## GitHub Actions 自动发布

适配本目录 bootstrap 建立的现有布局：Nginx / MySQL / Redis / MinIO 使用 Compose，
NestJS 使用 `yueji-backend.service`。不会重新运行 bootstrap、更新数据库容器、执行 SQL 或覆盖生产环境变量。
后端运行环境必须是 Ubuntu 22.04 或更新的 x86_64，使用 `/opt/node-v22.23.2/bin/node`。
如实际服务器与此布局不一致，`check` 会失败，应先核对服务器，不能跳过检查。

### 一次性配置

在 **两个仓库**的 Settings → Environments 创建 `production`，部署分支仅允许 `master`。
此版本沿用首次部署的 root 管理权限，部署密钥可以管理整台服务器；仅允许可信维护者修改生产分支，
并在 `production` 设置 required reviewers。使用专用 SSH 密钥，不要复用个人主密钥。
公钥需先安装到服务器 root 的 `authorized_keys`；私钥只填写到 GitHub Environment secrets，不发到聊天或提交代码。

| Environment secret | 内容 |
| --- | --- |
| `DEPLOY_HOST` | 服务器 IP 或域名 |
| `DEPLOY_USER` | 当前版本要求 `root` |
| `DEPLOY_SSH_KEY` | 专用部署 SSH 私钥全文 |
| `DEPLOY_KNOWN_HOSTS` | 核验过的 SSH 主机公钥记录，格式与 OpenSSH known_hosts 一致 |

仓库变量 `DEPLOY_PORT` 默认 `22`。不要关闭主机密钥检查；非默认端口的记录形如 `[主机]:端口 ssh-ed25519 公钥`。
可在阿里云可信远程终端读取 `/etc/ssh/ssh_host_ed25519_key.pub` 的公钥，并在前面补上上述主机字段；不要读取主机私钥。
GitHub 托管运行器需要能连接服务器 SSH 端口。仓库变量 `AUTO_DEPLOY` 初始保持未设置。

### 首次运行与日常使用

1. 后端改动合并到 `master`，再合并前端改动；前端流水线固定引用后端的已核验提交。
2. 各仓库 Actions → **Aliyun release** → **Run workflow**，选择 `master` 和 `check`。
3. 检查通过后选择 `deploy`。构建依次执行 lint、后端现有单测、生产依赖审计和构建；前端构建自带类型检查。
4. 发布成功后核对登录和关键页面，再把对应仓库的 **repository variable** `AUTO_DEPLOY` 设置为 `true`。
   此后推送 `master` 自动发布该仓库；生产环境 reviewer 规则仍然生效。
5. 发布失败会尝试恢复原版本，并保持 Actions 失败状态；手动选择 `rollback` 可切回上一成功版本，不需要重新构建。

当前只创建发布流程，没有触发项目构建或实际发布。语法检查通过不代表首次生产验证通过。
现有 lint、单测或依赖审计若失败，需修复问题后再发布，不自动忽略失败。
前端尚无仓库自带的自动测试套件；服务器健康检查不能替代业务验收。

构建与 SSH 部署分属两个 job，生产凭据仅在部署步骤注入。制品经过 SSH 主机校验与 SHA-256 完整性校验。
后端打包 `dist`、生产依赖及 `package.json`；前端只打包 `dist`。服务器不安装构建依赖。
两个仓库使用同一服务器锁串行更新；发布过程中不要手动取消任务。重启后端或重建 Nginx 时会有短暂中断，
该方案不提供零停机；自动回滚尽力恢复服务，失败会明确输出 `RESTORE FAILED`。

### 服务器状态与恢复

- 原始部署目录和 `/opt/yueji/current` 保留。
- 新应用版本放在 `/opt/yueji/ci-releases/admin/` 与 `backend/`。
- 管理端只更新 `/opt/yueji/shared/ci-admin.override.yml` 的静态文件挂载。
- 后端只更新 `/etc/systemd/system/yueji-backend.service.d/90-ci-release.conf` 的工作目录。
- 上一版本配置保存在 `/opt/yueji/shared/ci-admin/`、`ci-backend/`，`rollback` 会交换当前和上一版。
- 回滚不撤销数据库变更；本发布流程从不自动执行数据库迁移。
- 版本目录保留用于回滚。磁盘不足会在切换前中止；清理时保留当前、上一版本和原始 bootstrap 目录。

管理端手工执行 Compose 时必须带上已生成的覆盖文件，否则会回到原始前端挂载：

```bash
docker compose --env-file /opt/yueji/shared/runtime.env \
  -f /opt/yueji/current/compose.yml \
  -f /opt/yueji/shared/ci-admin.override.yml ps
```

参考：[GitHub Actions](https://docs.github.com/en/actions/get-started/understand-github-actions)、
[并发控制](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)。
