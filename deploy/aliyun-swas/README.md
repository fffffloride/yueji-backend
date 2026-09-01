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
