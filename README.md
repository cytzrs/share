# AI 量化交易模拟平台

## 开发环境要求

- **后端**: Python >= 3.10
- **前端**: Node.js (推荐 18+), pnpm
- **数据库**: MySQL 8.0, Redis 7
- **可选**: Docker & Docker Compose

## 本地启动

### 方式一：一键部署脚本（推荐）

项目提供跨平台一键部署脚本，自动检测环境、配置数据库连接、安装依赖并启动服务。

**macOS / Linux:**
```bash
chmod +x deploy.sh
./deploy.sh          # 启动服务
./deploy.sh stop     # 停止服务
./deploy.sh restart  # 重启服务
./deploy.sh status   # 查看状态
./deploy.sh config   # 重新配置
```

**Windows (PowerShell):**
```powershell
.\deploy.ps1         # 启动服务
.\deploy.ps1 stop    # 停止服务
.\deploy.ps1 restart # 重启服务
.\deploy.ps1 status  # 查看状态
.\deploy.ps1 config  # 重新配置
```

**Windows (双击运行):**
直接双击 `deploy.bat` 文件即可启动。

首次运行时，脚本会：
1. 检测 Python 3.10+、Node.js 18+、pnpm，缺失时提示自动安装
2. 提示输入 MySQL 和 Redis 连接配置，自动生成 `.env` 文件
3. 创建 Python 虚拟环境并安装后端依赖
4. 安装前端依赖
5. 后台启动前后端服务

服务启动后：
- 前端地址: http://localhost:5173
- 后端地址: http://localhost:8000
- API 文档: http://localhost:8000/docs

### 方式二：Docker Compose

适合快速启动数据库服务：

```bash
# 启动 MySQL 和 Redis
docker-compose up -d mysql redis

# 查看服务状态
docker-compose ps
```

数据库默认端口：MySQL `13306`，Redis `16379`

使用 Docker Compose 启动时，SQL 初始化脚本会自动执行。

### 方式三：手动安装数据库

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
