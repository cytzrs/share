"""枚举类型定义"""

from enum import Enum


class OrderSide(str, Enum):
    """订单方向"""

    BUY = "buy"
    SELL = "sell"
    HOLD = "hold"  # 持仓观望，不交易


class OrderStatus(str, Enum):
    """订单状态"""

    PENDING = "pending"
    FILLED = "filled"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class DecisionType(str, Enum):
    """AI决策类型"""

    BUY = "buy"
    SELL = "sell"
    HOLD = "hold"
    WAIT = "wait"


class AgentStatus(str, Enum):
    """Agent状态"""

    ACTIVE = "active"
    PAUSED = "paused"
    DELETED = "deleted"


class ScheduleType(str, Enum):
    """调度类型"""

    DAILY = "daily"  # 每日一次
    HOURLY = "hourly"  # 每小时一次
    EVERY_30_MIN = "every_30_min"  # 每30分钟
    EVERY_15_MIN = "every_15_min"  # 每15分钟
    MANUAL = "manual"  # 仅手动触发


class LLMProtocol(str, Enum):
    """LLM协议类型"""

    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GEMINI = "gemini"


class TaskStatus(str, Enum):
    """系统任务状态"""

    ACTIVE = "active"
    PAUSED = "paused"


class TaskLogStatus(str, Enum):
    """系统任务日志状态"""

    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


class TaskType(str, Enum):
    """系统任务类型"""
    
    AGENT_DECISION = "agent_decision"  # Agent决策任务
    QUOTE_SYNC = "quote_sync"          # 行情同步任务
    MARKET_REFRESH = "market_refresh"  # 市场数据刷新任务
