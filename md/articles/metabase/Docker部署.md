# 使用 Docker Compose 部署 Metabase 与 PostgreSQL

使用两个容器运行 Metabase：PostgreSQL 保存 Metabase 的应用数据，Metabase 提供报表和看板服务，通过宿主机的 `13000` 端口访问。

本文保留原始配置中的 `postgres:15` 和 `metabase/metabase:v0.56.4`，用于记录这一部署方案，不表示它们是最新版本。

## 1. 先区分两类数据库

- **应用数据库**：保存 Metabase 的用户、问题、看板、连接配置等元数据。本文的 PostgreSQL 用于这一目的。
- **分析数据源**：实际查询的业务数据库，例如 MySQL、ClickHouse 或其他 PostgreSQL，需要在 Metabase 管理界面另行添加。

连接应用数据库不会自动接入业务数据。[Metabase Docker 部署文档](https://www.metabase.com/docs/latest/installation-and-operation/running-metabase-on-docker) 介绍了通过环境变量配置外部应用数据库的方法。

## 2. 准备文件

在服务器新建一个部署目录，放置：

```text
metabase/
├── compose.yaml
└── .env
```

示例文件：[compose.yaml](examples/compose.yaml ':ignore')、[.env.example](examples/.env.example ':ignore')。

将 `.env.example` 复制为 `.env`，把占位值替换为自己的强密码：

```dotenv
METABASE_DB_PASSWORD=replace_with_a_long_random_password
```

这只是示例值，部署前必须修改。`.env` 只放在部署机器，不提交到博客仓库。两个容器从同一变量读取密码，避免分别修改时不一致。

Compose 中的 `${VAR:?message}` 会在变量缺失或为空时中止配置解析，语法见 [Docker Compose 变量插值文档](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)。

## 3. compose.yaml

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:15
    container_name: metabase-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: metabase
      POSTGRES_USER: metabase
      POSTGRES_PASSWORD: "${METABASE_DB_PASSWORD:?Set METABASE_DB_PASSWORD in .env}"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U metabase -d metabase"]
      interval: 5s
      timeout: 3s
      retries: 20
    networks:
      - metabase-net

  metabase:
    image: metabase/metabase:v0.56.4
    container_name: metabase
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "13000:3000"
    environment:
      MB_DB_TYPE: postgres
      MB_DB_DBNAME: metabase
      MB_DB_PORT: "5432"
      MB_DB_USER: metabase
      MB_DB_PASS: "${METABASE_DB_PASSWORD:?Set METABASE_DB_PASSWORD in .env}"
      MB_DB_HOST: postgres
      MB_JETTY_PORT: "3000"
      JAVA_TIMEZONE: Asia/Shanghai
      JAVA_OPTS: "-Xms1g -Xmx1500m"
    volumes:
      - metabase_plugins:/plugins
    networks:
      - metabase-net

networks:
  metabase-net:
    driver: bridge

volumes:
  postgres_data:
  metabase_plugins:
```

原始的 `your_strong_password` 已改为 `.env` 引用，其余核心配置保留；数字型环境变量显式写为字符串。

保留了原文件的 `version: "3.9"`。本地新版 Compose 校验时提示该字段已弃用并被忽略，使用新版 `docker compose` 时可删除这一行。

## 4. 启动和访问

在部署目录执行，先准备 `.env` 并修改密码，再启动：

```bash
cp .env.example .env
# 编辑 .env，替换示例密码后继续。

docker compose config -q
docker compose pull
docker compose up -d
docker compose ps
```

`config -q` 只校验配置，不打印展开后的内容。避免把带真实密码的完整配置输出贴到日志或公共讨论中。

浏览器访问：

```text
http://服务器IP:13000
```

首次启动可能需要等待应用初始化；PostgreSQL 通过健康检查，只代表数据库具备启动依赖条件，不代表 Metabase 已完成初始化。可以通过日志观察状态：

```bash
docker compose logs --tail=100 -f metabase
docker compose logs --tail=100 postgres
```

进入页面后创建管理员，再添加要查询的业务数据源。

## 5. 配置说明

| 配置 | 作用 |
| --- | --- |
| `13000:3000` | 宿主机 13000 端口映射到 Metabase 容器 3000 端口 |
| `MB_DB_HOST: postgres` | 通过 Compose 服务名访问 PostgreSQL |
| `MB_DB_*` | 配置 Metabase 应用数据库，不是分析数据源 |
| `depends_on` + `service_healthy` | 初次启动时等待 PostgreSQL 健康检查通过 |
| `postgres_data` | 持久化 PostgreSQL 数据 |
| `metabase_plugins` | 持久化插件目录，第三方驱动需另行放入并核对兼容性 |
| `JAVA_TIMEZONE` | 配置 Java 运行时使用的时区 |
| `-Xms1g -Xmx1500m` | 设置 JVM 初始堆和最大堆，不等于容器总内存限制 |
| `restart: unless-stopped` | 配置容器重启策略 |

JVM 堆以外还有非堆、线程等开销，宿主机也要为 PostgreSQL、操作系统及其他服务预留内存。

报表显示还涉及 Metabase 报表时区、数据库和字段类型，不能只设置 `JAVA_TIMEZONE` 就认为所有时间处理已统一。可结合 [Metabase 时区说明](https://www.metabase.com/docs/latest/configuring-metabase/timezones) 检查。

## 6. 常用维护命令

```bash
# 查看状态。
docker compose ps

# 重启 Metabase。
docker compose restart metabase

# 停止服务。
docker compose stop

# 删除本项目容器和网络，默认保留命名卷。
docker compose down
```

`docker compose down -v` 会删除本项目声明的命名卷，包括应用数据库，不能当成普通重启命令使用。

数据库卷的名称通常带 Compose 项目前缀。后续维护时使用相同项目目录或明确指定相同项目名，避免连接到新建的空卷。

## 7. 备份应用数据库

命名卷用于持久化，不等于备份。可以通过容器里的 `pg_dump` 导出 PostgreSQL 应用库：

```bash
mkdir -p backups

docker compose exec -T postgres   pg_dump -U metabase -d metabase -Fc   > "backups/metabase-$(date +%Y%m%d-%H%M%S).dump"
```

确认命令成功、备份文件有效，再保存到独立位置。备份中包含应用配置等敏感数据，应控制访问权限；定期在隔离环境验证恢复，而不只是检查文件存在。

插件文件及实际部署配置也应有对应备份。业务数据源需要各自的备份策略，不能靠 Metabase 应用库备份覆盖。

## 8. 升级与常见问题

### 修改 .env 密码后无法连接

已有数据库的密码不会因为改了容器环境变量就自动同步修改。应先按 PostgreSQL 的密码变更流程更新数据库用户，再同步部署配置并验证连接。不要为了修改密码直接删数据卷。

### 重启后看不到原来的看板

检查是否仍连接相同应用库、是否使用相同 Compose 项目及数据卷，不要急着重新初始化。

### 应用内存不足或容器重启

检查容器日志、宿主机可用内存和容器退出状态。不要只增大 `-Xmx`，否则可能挤占 PostgreSQL 或系统的可用内存。

### 升级镜像

先备份应用库和插件，阅读目标版本升级说明，并在测试环境验证。Metabase 升级可能修改应用数据库结构，回退不能只依靠换回旧镜像，需准备匹配旧版本的数据备份。

### 端口访问范围

当前 `13000:3000` 保留原配置的宿主机端口映射。仅本机或反向代理使用时，可改为 `127.0.0.1:13000:3000`；对外提供服务时按实际需要配置访问控制与 HTTPS。PostgreSQL 没有发布宿主机端口，Metabase 通过内部网络连接。
