"""SQLAlchemy ORM模型定义"""

from datetime import datetime
from decimal import Decimal
from sqlalchemy import (
    Column,
    String,
    Integer,
    BigInteger,
    DECIMAL,
    Text,
    Date,
    TIMESTAMP,
    JSON,
    ForeignKey,
    Index,
    UniqueConstraint,
)
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func

Base = declarative_base()


class StockQuoteModel(Base):
    """股票行情表"""

    __tablename__ = "stock_quotes"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    stock_code = Column(String(10), nullable=False)
    stock_name = Column(String(100))  # 股票名称
    trade_date = Column(Date, nullable=False)
    open_price = Column(DECIMAL(10, 3))
    high_price = Column(DECIMAL(10, 3))
    low_price = Column(DECIMAL(10, 3))
    close_price = Column(DECIMAL(10, 3))
    prev_close = Column(DECIMAL(10, 3))
    volume = Column(BigInteger)
    amount = Column(DECIMAL(18, 2))
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())

    __table_args__ = (
        UniqueConstraint("stock_code", "trade_date", name="uk_code_date"),
        Index("idx_trade_date", "trade_date"),
        Index("idx_stock_code_name", "stock_code", "stock_name"),
    )


class ModelAgentModel(Base):
    """模型代理表"""

    __tablename__ = "model_agents"

    agent_id = Column(String(36), primary_key=True)
    name = Column(String(100), nullable=False)
    initial_cash = Column(DECIMAL(18, 2), nullable=False, default=20000.00)
    current_cash = Column(DECIMAL(18, 2), nullable=False)
    template_id = Column(String(36))
    provider_id = Column(String(36))  # LLM渠道ID
    llm_model = Column(String(100), nullable=False)
    status = Column(String(20), nullable=False, default="active")
    schedule_type = Column(String(20), default="daily")
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(
        TIMESTAMP,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )

    # 关系
    positions = relationship("PositionModel", back_populates="agent")
    orders = relationship("OrderModel", back_populates="agent")
    transactions = relationship("TransactionModel", back_populates="agent")
    decision_logs = relationship("DecisionLogModel", back_populates="agent")


class PositionModel(Base):
    """持仓表"""

    __tablename__ = "positions"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    agent_id = Column(String(36), ForeignKey("model_agents.agent_id"), nullable=False)
    stock_code = Column(String(10), nullable=False)
    shares = Column(Integer, nullable=False)
    avg_cost = Column(DECIMAL(10, 3), nullable=False)
    buy_date = Column(Date, nullable=False)
    updated_at = Column(
        TIMESTAMP,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )

    __table_args__ = (
        UniqueConstraint("agent_id", "stock_code", name="uk_agent_stock"),
    )

    # 关系
    agent = relationship("ModelAgentModel", back_populates="positions")


class OrderModel(Base):
    """订单表"""

    __tablename__ = "orders"

    order_id = Column(String(36), primary_key=True)
    agent_id = Column(String(36), ForeignKey("model_agents.agent_id"), nullable=False)
    llm_request_log_id = Column(BigInteger, nullable=True)  # 关联LLM请求日志
    stock_code = Column(String(10), nullable=True)  # hold 决策时为空
    side = Column(String(10), nullable=False)  # buy/sell/hold
    quantity = Column(Integer, nullable=True)  # hold 决策时为空
    price = Column(DECIMAL(10, 3), nullable=True)  # hold 决策时为空
    status = Column(String(20), nullable=False, default="pending")
    reject_reason = Column(String(200))
    reason = Column(Text)  # AI交易理由
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())

    __table_args__ = (
        Index("idx_agent_created", "agent_id", "created_at"),
        Index("idx_order_llm_log", "llm_request_log_id"),
    )

    # 关系
    agent = relationship("ModelAgentModel", back_populates="orders")
    transactions = relationship("TransactionModel", back_populates="order")


class TransactionModel(Base):
    """成交记录表"""

    __tablename__ = "transactions"

    tx_id = Column(String(36), primary_key=True)
    order_id = Column(String(36), ForeignKey("orders.order_id"), nullable=False)
    agent_id = Column(String(36), ForeignKey("model_agents.agent_id"), nullable=False)
    stock_code = Column(String(10), nullable=True)  # hold 决策时为空
    side = Column(String(10), nullable=False)  # buy/sell/hold
    quantity = Column(Integer, nullable=True)  # hold 决策时为空
    price = Column(DECIMAL(10, 3), nullable=True)  # hold 决策时为空
    commission = Column(DECIMAL(10, 2), nullable=True)  # hold 决策时为空
    stamp_tax = Column(DECIMAL(10, 2), nullable=True)  # hold 决策时为空
    transfer_fee = Column(DECIMAL(10, 2), nullable=True)  # hold 决策时为空
    executed_at = Column(TIMESTAMP, server_default=func.current_timestamp())

    __table_args__ = (Index("idx_agent_executed", "agent_id", "executed_at"),)

    # 关系
    order = relationship("OrderModel", back_populates="transactions")
    agent = relationship("ModelAgentModel", back_populates="transactions")


class PromptTemplateModel(Base):
    """提示词模板表"""

    __tablename__ = "prompt_templates"

    template_id = Column(String(36), primary_key=True)
    name = Column(String(100), nullable=False)
    content = Column(Text, nullable=False)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(
        TIMESTAMP,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )


class DecisionLogModel(Base):
    """AI决策日志表"""

    __tablename__ = "decision_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    agent_id = Column(String(36), ForeignKey("model_agents.agent_id"), nullable=False)
    prompt_content = Column(Text)
    llm_response = Column(Text)
    parsed_decision = Column(JSON)
    validation_result = Column(JSON)
    order_id = Column(String(36))
    status = Column(String(20), nullable=False, default="success")  # success, no_trade, api_error
    error_message = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())

    __table_args__ = (
        Index("idx_decision_agent_created", "agent_id", "created_at"),
        Index("idx_decision_status", "status"),
    )

    # 关系
    agent = relationship("ModelAgentModel", back_populates="decision_logs")


class SentimentScoreModel(Base):
    """情绪分数表"""

    __tablename__ = "sentiment_scores"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    stock_code = Column(String(10))
    score = Column(DECIMAL(4, 3), nullable=False)
    source = Column(String(50))
    analyzed_at = Column(TIMESTAMP, server_default=func.current_timestamp())

    __table_args__ = (Index("idx_code_time", "stock_code", "analyzed_at"),)


class LLMProviderModel(Base):
    """LLM渠道配置表"""

    __tablename__ = "llm_providers"

    provider_id = Column(String(36), primary_key=True)
    name = Column(String(100), nullable=False)
    protocol = Column(String(20), nullable=False)  # openai, anthropic, gemini
    api_url = Column(String(500), nullable=False)
    api_key = Column(String(500), nullable=False)  # 加密存储
    is_active = Column(Integer, nullable=False, default=1)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(
        TIMESTAMP,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )


class LLMRequestLogModel(Base):
    """LLM请求日志表"""

    __tablename__ = "llm_request_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    provider_id = Column(String(36), nullable=False)
    model_name = Column(String(100), nullable=False)
    agent_id = Column(String(36))
    request_content = Column(Text, nullable=False)
    response_content = Column(Text)
    duration_ms = Column(Integer, nullable=False, default=0)
    status = Column(String(20), nullable=False, default="success")
    error_message = Column(Text)
    tokens_input = Column(Integer)
    tokens_output = Column(Integer)
    request_time = Column(TIMESTAMP, server_default=func.current_timestamp())

    __table_args__ = (
        Index("idx_llm_log_provider", "provider_id"),
        Index("idx_llm_log_agent", "agent_id"),
        Index("idx_llm_log_time", "request_time"),
        Index("idx_llm_log_status", "status"),
    )



class MarketDataModel(Base):
    """市场数据表 - 存储市场情绪、大盘概况等"""

    __tablename__ = "market_data"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    data_type = Column(String(50), nullable=False)  # market_sentiment, index_overview, hot_stocks
    data_content = Column(JSON, nullable=False)
    data_date = Column(Date, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(
        TIMESTAMP,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )

    __table_args__ = (
        UniqueConstraint("data_type", "data_date", name="uk_type_date"),
        Index("idx_market_data_type", "data_type"),
        Index("idx_market_data_date", "data_date"),
    )


class StockAIAnalysisModel(Base):
    """AI股票分析缓存表"""

    __tablename__ = "stock_ai_analysis"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    stock_code = Column(String(10), nullable=False)
    analysis_data = Column(JSON, nullable=False)  # 存储完整分析结果
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    expires_at = Column(TIMESTAMP, nullable=False)  # 缓存过期时间

    __table_args__ = (
        Index("idx_stock_ai_analysis_code", "stock_code"),
        Index("idx_stock_ai_analysis_expires", "expires_at"),
        Index("idx_stock_ai_analysis_code_expires", "stock_code", "expires_at"),
    )


class SystemTaskModel(Base):
    """系统任务表"""

    __tablename__ = "system_tasks"

    task_id = Column(String(36), primary_key=True)
    name = Column(String(100), nullable=False)
    cron_expression = Column(String(100), nullable=False)
    task_type = Column(String(50), default="agent_decision")  # agent_decision, quote_sync, market_refresh
    agent_ids = Column(JSON, nullable=False)  # ["all"] 或 ["agent_id1", "agent_id2"]
    config = Column(JSON)  # 任务配置（JSON格式）
    trading_day_only = Column(Integer, default=0)  # 0=否, 1=是
    status = Column(String(20), default="active")  # active, paused
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(
        TIMESTAMP,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )

    __table_args__ = (
        Index("idx_system_task_status", "status"),
        Index("idx_system_task_name", "name"),
    )

    # 关系
    logs = relationship("SystemTaskLogModel", back_populates="task")


class SystemTaskLogModel(Base):
    """系统任务执行日志表"""

    __tablename__ = "system_task_logs"

    log_id = Column(BigInteger, primary_key=True, autoincrement=True)
    task_id = Column(String(36), ForeignKey("system_tasks.task_id", ondelete="SET NULL"), nullable=True)
    started_at = Column(TIMESTAMP, nullable=False)
    completed_at = Column(TIMESTAMP)
    status = Column(String(20), nullable=False)  # running, success, failed, skipped
    agent_results = Column(JSON)  # [{"agent_id": "xxx", "status": "success", "error": null}]
    skip_reason = Column(String(200))  # 跳过原因（如非交易日）
    error_message = Column(Text)

    __table_args__ = (
        Index("idx_task_log_task_id", "task_id"),
        Index("idx_task_log_status", "status"),
        Index("idx_task_log_started_at", "started_at"),
    )

    # 关系
    task = relationship("SystemTaskModel", back_populates="logs")


# ============== MCP Marketplace 模型 ==============


class MCPServerModel(Base):
    """MCP服务主表"""

    __tablename__ = "mcp_servers"

    server_id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    qualified_name = Column(String(200), unique=True, nullable=False)
    display_name = Column(String(100), nullable=False)
    description = Column(Text)
    logo = Column(String(500))
    creator = Column(String(100))
    type = Column(Integer, default=1)  # 1=官方，2=社区，3=第三方
    tag = Column(String(500))
    introduction = Column(Text)
    is_domestic = Column(Integer, default=1)  # 0=否，1=是
    package_url = Column(String(500))
    repository_id = Column(String(100))
    use_count = Column(BigInteger().with_variant(Integer, "sqlite"), default=0)
    is_enabled = Column(Integer, default=1)  # 0=禁用，1=启用
    is_deleted = Column(Integer, default=0)  # 0=正常，1=已删除
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(
        TIMESTAMP,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )

    __table_args__ = (
        Index("idx_display_name", "display_name"),
        Index("idx_is_enabled", "is_enabled"),
        Index("idx_is_deleted", "is_deleted"),
        Index("idx_mcp_type", "type"),
        Index("idx_mcp_created_at", "created_at"),
    )

    # 关系
    connections = relationship(
        "MCPConnectionModel",
        back_populates="server",
        cascade="all, delete-orphan",
        lazy="joined",
    )
    tools = relationship(
        "MCPToolModel",
        back_populates="server",
        cascade="all, delete-orphan",
        lazy="joined",
    )


class MCPConnectionModel(Base):
    """MCP连接配置表"""

    __tablename__ = "mcp_connections"

    connection_id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    server_id = Column(
        BigInteger().with_variant(Integer, "sqlite"),
        ForeignKey("mcp_servers.server_id", ondelete="CASCADE"),
        nullable=False,
    )
    connection_type = Column(String(20), nullable=False)  # stdio/http/sse
    command = Column(String(200))
    args = Column(JSON)
    env = Column(JSON)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())

    __table_args__ = (Index("idx_mcp_conn_server_id", "server_id"),)

    # 关系
    server = relationship("MCPServerModel", back_populates="connections")


class MCPToolModel(Base):
    """MCP工具定义表"""

    __tablename__ = "mcp_tools"

    tool_id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    server_id = Column(
        BigInteger().with_variant(Integer, "sqlite"),
        ForeignKey("mcp_servers.server_id", ondelete="CASCADE"),
        nullable=False,
    )
    name = Column(String(100), nullable=False)
    description = Column(Text)
    input_schema = Column(JSON)
    translation = Column(String(500))
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())

    __table_args__ = (
        Index("idx_mcp_tool_server_id", "server_id"),
        Index("idx_mcp_tool_name", "name"),
    )

    # 关系
    server = relationship("MCPServerModel", back_populates="tools")
