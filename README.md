# AI 量化交易模拟平台

## 开发环境要求

- **后端**: Python >= 3.10
- **前端**: Node.js (推荐 18+), pnpm
- **数据库**: MySQL 8.0, Redis 7
- **可选**: Docker & Docker Compose

## 本地启动

### 方式一：Docker Compose（推荐）

```bash
# 启动 MySQL 和 Redis
docker-compose up -d mysql redis

# 查看服务状态
docker-compose ps
```

数据库默认端口：MySQL `13306`，Redis `16379`

使用 Docker Compose 启动时，SQL 初始化脚本会自动执行。

### 方式二：手动安装数据库

自行安装 MySQL 和 Redis，确保服务运行中。

手动初始化数据库：

```bash
mysql -h localhost -P 3306 -u root -p quant_trading < backend/migrations/001_initial_schema.sql
```

---

### 启动后端

```bash
cd backend

# 配置环境变量
cp .env.example .env
# 编辑 .env 填写数据库连接信息和 LLM API Key

# 安装依赖
pip install -e .

# 启动服务
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

后端 API: http://localhost:8000

### 启动前端

```bash
cd frontend

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

前端页面: http://localhost:5173


| 菜单 | 页面 |
|------|------|
| **仪表盘** | ![仪表盘‑1](./images/仪表盘1.png)<br>![仪表盘‑2](./images/仪表盘2.png) |
| **Agent 管理** | ![Agent 管理](./images/Agent管理.png) |
| **交易日志** | ![交易日志](./images/交易日志.png) |
| **股市行情** | ![股市行情](./images/股市行情.png) |
| **提示词模版** | ![提示词模版‑1](./images/提示词模版1.png)<br>![提示词模版‑2](./images/提示词模版2.png) |
| **模型对比** | ![模型对比](./images/模型对比.png) |
| **模型渠道** | ![模型渠道](./images/模型渠道.png) |
| **接口日志** | ![接口日志](./images/接口日志.png) |
| **系统管理** | ![系统管理](./images/系统管理.png) |
