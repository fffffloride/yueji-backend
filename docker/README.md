# Docker 环境说明

## 快速启动

在 docker 目录下执行：

```bash
docker-compose up -d
```

首次启动时 MySQL 会按顺序自动执行阶段 0–5 的基础表、业务表和菜单 SQL，完成当前已实现模块的初始化。

> 注意：初始化脚本只在首次启动（数据目录为空）时执行。已有数据库必须按阶段手工执行增量 SQL；不要为了触发初始化而删除生产或仍需保留的数据目录。

## 服务说明

| 服务  | 端口      | 说明                                               |
| ----- | --------- | -------------------------------------------------- |
| MySQL | 3306      | 业务数据库（空数据目录首次启动时自动导入阶段 0–5） |
| Redis | 6379      | 缓存服务                                           |
| MinIO | 9000/9001 | 对象存储（9000: API, 9001: 控制台）                |

## 默认账号

### MySQL

- 用户名：root
- 密码：123456
- 数据库：youlai_admin

### Redis

- 密码：123456

### MinIO

- 用户名：minioadmin
- 密码：minioadmin
- 控制台：http://localhost:9001

> MinIO 首次使用需登录控制台创建名为 `public` 的 bucket（与 `.env.dev` 中 `OSS_MINIO_BUCKET` 对应），并将访问策略设为 public。

## 目录结构

```
docker/
├── docker-compose.yml
├── README.md
├── mysql/
│   └── data/          # MySQL 数据（自动生成）
├── redis/
│   └── data/          # Redis 数据（自动生成）
└── minio/
    ├── data/          # MinIO 数据（自动生成）
    └── config/        # MinIO 配置（自动生成）
```

## 注意事项

- 数据目录已添加到 .gitignore，不会提交到 Git
- 生产环境请修改默认密码
