"""FastAPI应用入口"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import agents, templates, quotes, portfolio, llm_providers, system, tasks, auth, market, stock, mcp
from app.api.errors import register_exception_handlers
from app.core.config import settings
from app.core.scheduler import get_scheduler, shutdown_scheduler
from app.core.cache import close_redis

# 配置日志
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

# 降低第三方库的日志级别
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)
logging.getLogger("apscheduler").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)


def load_system_tasks() -> int:
    """
    从数据库加载所有活跃的系统任务并添加到调度器
    
    Returns:
        int: 成功加载的任务数量
    """
    from app.db.session import SessionLocal
    from app.db.models import SystemTaskModel
    from app.models.enums import TaskStatus
    from app.services.task_service import TaskService
    
    db = SessionLocal()
    loaded_count = 0
    
    try:
        # 查询所有状态为active的任务
        active_tasks = db.query(SystemTaskModel).filter(
            SystemTaskModel.status == TaskStatus.ACTIVE.value
        ).all()
        
        if not active_tasks:
            logger.info("没有需要加载的活跃系统任务")
            return 0
        
        logger.info(f"发现 {len(active_tasks)} 个活跃系统任务，开始加载...")
        
        # 创建TaskService实例用于添加任务到调度器
        task_service = TaskService(db)
        
        for task in active_tasks:
            try:
                # 使用TaskService的内部方法将任务添加到调度器
                task_service._add_to_scheduler(task)
                loaded_count += 1
                logger.info(f"系统任务已加载: {task.name} (ID: {task.task_id})")
            except Exception as e:
                logger.error(f"加载系统任务失败: {task.name} (ID: {task.task_id}), 错误: {e}")
        
        logger.info(f"系统任务加载完成: 成功 {loaded_count}/{len(active_tasks)} 个")
        return loaded_count
        
    except Exception as e:
        logger.error(f"加载系统任务时发生错误: {e}")
        return 0
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时
    logger.info("应用启动中...")
    
    # 测试Redis连接
    try:
        from app.core.cache import get_redis
        redis = get_redis()
        redis.ping()
        logger.info("Redis连接成功")
    except Exception as e:
        logger.warning(f"Redis连接失败，缓存功能将不可用: {e}")
    
    if settings.SCHEDULER_ENABLED:
        scheduler = get_scheduler()
        scheduler.start()
        
        # 从数据库加载所有活跃的系统任务
        try:
            loaded_count = load_system_tasks()
            if loaded_count > 0:
                logger.info(f"已恢复 {loaded_count} 个系统任务的调度")
        except Exception as e:
            logger.error(f"加载系统任务失败: {e}")
    
    yield
    
    # 关闭时
    logger.info("应用关闭中...")
    shutdown_scheduler()
    close_redis()
    logger.info("应用已关闭")


app = FastAPI(
    title="AI交易竞技场模拟平台",
    description="AI驱动的A股量化交易模拟系统",
    version="0.1.0",
    lifespan=lifespan,
)

# 注册异常处理器
register_exception_handlers(app)

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # 使用 * 时不能启用 credentials
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(agents.router, prefix="/agents", tags=["Model Agents"])
app.include_router(templates.router, prefix="/templates", tags=["Prompt Templates"])
app.include_router(quotes.router, prefix="/quotes", tags=["Market Quotes"])
app.include_router(llm_providers.router, prefix="/llm-providers", tags=["LLM Providers"])
# Portfolio路由挂载在/agents下，因为portfolio是agent的子资源
app.include_router(portfolio.router, prefix="/agents", tags=["Portfolio"])
app.include_router(system.router, prefix="/system", tags=["System Config"])
app.include_router(tasks.router, prefix="/tasks", tags=["Task Management"])
app.include_router(market.router, prefix="/market", tags=["Market Data"])
app.include_router(stock.router, prefix="/stock", tags=["Stock Data"])
app.include_router(mcp.router, prefix="/mcp", tags=["MCP Marketplace"])


# 单独注册compare端点
@app.post("/compare", tags=["Compare"])
async def compare_agents_endpoint(request: "CompareRequest"):
    """多模型对比 - 重定向到portfolio模块"""
    from app.api.portfolio import compare_agents
    from app.db.session import SessionLocal
    
    db = SessionLocal()
    try:
        return await compare_agents(request, db)
    finally:
        db.close()


# 导入CompareRequest用于类型注解
from app.api.schemas import CompareRequest


@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {"status": "healthy", "version": "0.1.0"}
