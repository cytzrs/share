# AI交易竞技场模拟平台 - 后端

## 技术栈

- Python 3.11+
- FastAPI
- SQLAlchemy (MySQL)
- Redis
- pytest + Hypothesis

## 安装

```bash
# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/macOS
# venv\Scripts\activate  # Windows

# 安装依赖
pip install -e ".[dev]"
```

## 配置

复制 `.env.example` 为 `.env` 并修改配置：

```bash
cp .env.example .env
```

## 运行

```bash
# 开发模式
uvicorn app.main:app --reload

# 生产模式
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## 测试

```bash
# 运行所有测试
pytest

# 运行属性测试
pytest tests/ -v --hypothesis-show-statistics

# 生成覆盖率报告
pytest --cov=app --cov-report=html
```

## API文档

启动服务后访问：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
