"""API请求和响应的Pydantic模型定义"""

from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field, field_validator, ConfigDict

from app.models.enums import OrderSide, OrderStatus, DecisionType, AgentStatus, ScheduleType, TaskStatus, TaskLogStatus


# ============== 通用模型 ==============

class PaginationParams(BaseModel):
    """分页参数"""
    page: int = Field(default=1, ge=1, description="页码，从1开始")
    page_size: int = Field(default=20, ge=1, le=100, description="每页数量，最大100")
    
    @property
    def offset(self) -> int:
        """计算偏移量"""
        return (self.page - 1) * self.page_size


class SortParams(BaseModel):
    """排序参数"""
    sort_by: Optional[str] = Field(default=None, description="排序字段")
    sort_order: str = Field(default="desc", pattern="^(asc|desc)$", description="排序方向")


class PaginatedResponse(BaseModel):
    """分页响应基类"""
    total: int = Field(description="总记录数")
    page: int = Field(description="当前页码")
    page_size: int = Field(description="每页数量")
    total_pages: int = Field(description="总页数")


class ErrorResponse(BaseModel):
    """标准化错误响应"""
    error_code: str = Field(description="错误代码")
    message: str = Field(description="错误信息")
    details: Optional[Dict[str, Any]] = Field(default=None, description="详细信息")


# ============== Agent相关模型 ==============

class AgentCreate(BaseModel):
    """创建Agent请求"""
    name: str = Field(..., min_length=1, max_length=100, description="Agent名称")
    initial_cash: Decimal = Field(
        default=Decimal("20000.00"),
        ge=Decimal("1000"),
        le=Decimal("10000000"),
        description="初始资金"
    )
    template_id: Optional[str] = Field(default=None, description="提示词模板ID")
    provider_id: Optional[str] = Field(default=None, description="LLM渠道ID")
    llm_model: str = Field(default="gpt-4", description="LLM模型名称")
    schedule_type: str = Field(default="daily", description="调度类型")
    
    @field_validator("schedule_type")
    @classmethod
    def validate_schedule_type(cls, v: str) -> str:
        valid_types = ["daily", "hourly", "every_30_min", "every_15_min", "manual"]
        if v not in valid_types:
            raise ValueError(f"调度类型必须是以下之一: {valid_types}")
        return v


class AgentUpdate(BaseModel):
    """更新Agent请求"""
    name: Optional[str] = Field(default=None, min_length=1, max_length=100, description="Agent名称")
    template_id: Optional[str] = Field(default=None, description="提示词模板ID")
    provider_id: Optional[str] = Field(default=None, description="LLM渠道ID")
    llm_model: Optional[str] = Field(default=None, description="LLM模型名称")
    schedule_type: Optional[str] = Field(default=None, description="调度类型")
    status: Optional[str] = Field(default=None, description="状态")
    
    @field_validator("schedule_type")
    @classmethod
    def validate_schedule_type(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        valid_types = ["daily", "hourly", "every_30_min", "every_15_min", "manual"]
        if v not in valid_types:
            raise ValueError(f"调度类型必须是以下之一: {valid_types}")
        return v
    
    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        valid_statuses = ["active", "paused"]
        if v not in valid_statuses:
            raise ValueError(f"状态必须是以下之一: {valid_statuses}")
        return v


class AgentResponse(BaseModel):
    """Agent响应"""
    model_config = ConfigDict(from_attributes=True)
    
    agent_id: str
    name: str
    initial_cash: Decimal
    current_cash: Decimal
    template_id: Optional[str]
    provider_id: Optional[str]
    provider_name: Optional[str] = None  # 模型渠道名称
    llm_model: str
    status: str
    schedule_type: str
    created_at: datetime
    # 实时计算的字段
    total_assets: Optional[float] = None
    total_market_value: Optional[float] = None
    return_rate: Optional[float] = None
    positions_count: Optional[int] = None  # 持仓数量
    transactions_count: Optional[int] = None  # 交易记录数量
    transactions: Optional[List["TransactionResponse"]] = None  # 交易记录列表


class AgentListResponse(PaginatedResponse):
    """Agent列表响应"""
    agents: List[AgentResponse]


class TriggerDecisionRequest(BaseModel):
    """手动触发决策请求"""
    market_data: Optional[Dict[str, Any]] = Field(default=None, description="市场数据")
    financial_data: Optional[Dict[str, Any]] = Field(default=None, description="财务数据")
    sentiment_score: float = Field(default=0.0, ge=-1.0, le=1.0, description="情绪分数")


class TriggerDecisionResponse(BaseModel):
    """触发决策响应"""
    success: bool
    decision: Optional[Dict[str, Any]] = None  # 兼容旧代码，返回第一个决策
    decisions: Optional[List[Dict[str, Any]]] = None  # 所有决策
    executed_count: Optional[int] = None  # 成功执行的订单数
    error_message: Optional[str] = None
    message: Optional[str] = None  # 成功消息


# ============== 模板相关模型 ==============

class TemplateCreate(BaseModel):
    """创建模板请求"""
    name: str = Field(..., min_length=1, max_length=100, description="模板名称")
    content: str = Field(..., min_length=1, description="模板内容")


class TemplateUpdate(BaseModel):
    """更新模板请求"""
    name: Optional[str] = Field(default=None, min_length=1, max_length=100, description="模板名称")
    content: Optional[str] = Field(default=None, min_length=1, description="模板内容")


class TemplateResponse(BaseModel):
    """模板响应"""
    model_config = ConfigDict(from_attributes=True)
    
    template_id: str
    name: str
    content: str
    version: int
    created_at: datetime
    updated_at: datetime


class TemplateListResponse(PaginatedResponse):
    """模板列表响应"""
    templates: List[TemplateResponse]


# ============== 行情相关模型 ==============

class QuoteResponse(BaseModel):
    """行情响应"""
    model_config = ConfigDict(from_attributes=True)
    
    stock_code: str
    trade_date: str
    open_price: Decimal
    high_price: Decimal
    low_price: Decimal
    close_price: Decimal
    prev_close: Decimal
    volume: int
    amount: Decimal


class QuoteHistoryResponse(BaseModel):
    """历史行情响应"""
    stock_code: str
    start_date: str
    end_date: str
    quotes: List[QuoteResponse]


# ============== Portfolio相关模型 ==============

class PositionResponse(BaseModel):
    """持仓响应"""
    stock_code: str
    stock_name: Optional[str] = None
    shares: int
    avg_cost: Decimal
    buy_date: str
    current_price: Optional[Decimal] = None
    market_value: Optional[Decimal] = None
    profit_loss: Optional[Decimal] = None
    profit_loss_rate: Optional[Decimal] = None


class PortfolioResponse(BaseModel):
    """投资组合响应"""
    agent_id: str
    cash: Decimal
    total_market_value: Decimal
    total_assets: Decimal
    positions: List[PositionResponse]


class TransactionResponse(BaseModel):
    """交易记录响应"""
    tx_id: str
    order_id: str
    agent_id: str
    stock_code: Optional[str] = None  # hold 决策时为空
    stock_name: Optional[str] = None  # 股票名称
    side: str
    quantity: Optional[int] = None  # hold 决策时为空
    price: Optional[Decimal] = None  # hold 决策时为空
    commission: Optional[Decimal] = None  # hold 决策时为空
    stamp_tax: Optional[Decimal] = None  # hold 决策时为空
    transfer_fee: Optional[Decimal] = None  # hold 决策时为空
    total_fees: Optional[Decimal] = None  # hold 决策时为空
    executed_at: datetime
    reason: Optional[str] = None  # AI交易理由


class TransactionListResponse(PaginatedResponse):
    """交易记录列表响应"""
    transactions: List[TransactionResponse]


class MetricsResponse(BaseModel):
    """风险指标响应"""
    agent_id: str
    total_assets: Decimal
    total_market_value: Decimal
    cash_balance: Decimal
    total_return: Decimal
    return_rate: Decimal
    annualized_return: Optional[Decimal] = None
    max_drawdown: Optional[Decimal] = None
    sharpe_ratio: Optional[Decimal] = None


class CompareRequest(BaseModel):
    """多模型对比请求"""
    agent_ids: List[str] = Field(..., min_length=2, max_length=10, description="Agent ID列表")
    start_date: Optional[str] = Field(default=None, description="开始日期")
    end_date: Optional[str] = Field(default=None, description="结束日期")


class AgentCompareData(BaseModel):
    """单个Agent对比数据"""
    agent_id: str
    name: str
    return_rate: Decimal
    max_drawdown: Optional[Decimal]
    sharpe_ratio: Optional[Decimal]
    total_assets: Decimal


class CompareResponse(BaseModel):
    """多模型对比响应"""
    agents: List[AgentCompareData]
    comparison_period: Optional[str] = None


# ============== 决策日志相关模型 ==============

class DecisionLogResponse(BaseModel):
    """决策日志响应"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    agent_id: str
    agent_name: Optional[str] = None
    llm_model: Optional[str] = None
    parsed_decision: Optional[dict] = None
    status: str  # success, no_trade, api_error
    error_message: Optional[str] = None
    created_at: datetime


class DecisionLogListResponse(PaginatedResponse):
    """决策日志列表响应"""
    items: List[DecisionLogResponse]


# ============== 系统任务相关模型 ==============

class TaskCreate(BaseModel):
    """创建系统任务请求"""
    name: str = Field(..., min_length=1, max_length=100, description="任务名称")
    cron_expression: str = Field(..., min_length=1, max_length=100, description="Cron表达式")
    agent_ids: List[str] = Field(default=["all"], description="Agent ID列表，['all']表示全部Agent")
    trading_day_only: bool = Field(default=False, description="仅交易日运行")
    task_type: str = Field(default="agent_decision", description="任务类型: agent_decision, quote_sync")
    config: Optional[dict] = Field(default=None, description="任务配置（JSON格式）")


class TaskUpdate(BaseModel):
    """更新系统任务请求"""
    name: Optional[str] = Field(default=None, min_length=1, max_length=100, description="任务名称")
    cron_expression: Optional[str] = Field(default=None, min_length=1, max_length=100, description="Cron表达式")
    agent_ids: Optional[List[str]] = Field(default=None, description="Agent ID列表")
    trading_day_only: Optional[bool] = Field(default=None, description="仅交易日运行")
    task_type: Optional[str] = Field(default=None, description="任务类型: agent_decision, quote_sync")
    config: Optional[dict] = Field(default=None, description="任务配置（JSON格式）")


class AgentExecutionResult(BaseModel):
    """Agent执行结果"""
    agent_id: str = Field(description="Agent ID")
    agent_name: str = Field(description="Agent名称")
    status: str = Field(description="执行状态: success, failed, skipped")
    started_at: Optional[str] = Field(default=None, description="开始时间")
    completed_at: Optional[str] = Field(default=None, description="完成时间")
    duration_ms: Optional[int] = Field(default=None, description="执行耗时(毫秒)")
    error_message: Optional[str] = Field(default=None, description="错误信息")


class TaskResponse(BaseModel):
    """系统任务响应"""
    model_config = ConfigDict(from_attributes=True)
    
    task_id: str = Field(description="任务ID")
    name: str = Field(description="任务名称")
    task_type: str = Field(default="agent_decision", description="任务类型: agent_decision, quote_sync, market_refresh")
    cron_expression: str = Field(description="Cron表达式")
    cron_description: str = Field(description="Cron表达式的人性化描述")
    agent_ids: List[str] = Field(description="Agent ID列表")
    config: Optional[dict] = Field(default=None, description="任务配置（JSON格式）")
    trading_day_only: bool = Field(description="仅交易日运行")
    status: str = Field(description="任务状态: active, paused")
    next_run_time: Optional[str] = Field(default=None, description="下次执行时间")
    success_count: int = Field(default=0, description="成功执行次数")
    fail_count: int = Field(default=0, description="失败执行次数")
    created_at: str = Field(description="创建时间")


class TaskListResponse(BaseModel):
    """系统任务列表响应"""
    tasks: List[TaskResponse] = Field(description="任务列表")
    total: int = Field(description="总数")


class TaskLogSummary(BaseModel):
    """任务日志摘要"""
    log_id: int = Field(description="日志ID")
    started_at: str = Field(description="开始时间")
    completed_at: Optional[str] = Field(default=None, description="完成时间")
    status: str = Field(description="执行状态: running, success, failed, skipped")
    duration_ms: Optional[int] = Field(default=None, description="执行耗时(毫秒)")
    agent_success_count: int = Field(default=0, description="Agent成功数")
    agent_fail_count: int = Field(default=0, description="Agent失败数")


class TaskLogDetail(BaseModel):
    """任务日志详情"""
    log_id: int = Field(description="日志ID")
    task_id: str = Field(description="任务ID")
    started_at: str = Field(description="开始时间")
    completed_at: Optional[str] = Field(default=None, description="完成时间")
    status: str = Field(description="执行状态: running, success, failed, skipped")
    duration_ms: Optional[int] = Field(default=None, description="执行耗时(毫秒)")
    skip_reason: Optional[str] = Field(default=None, description="跳过原因")
    error_message: Optional[str] = Field(default=None, description="错误信息")
    agent_results: List[AgentExecutionResult] = Field(default=[], description="Agent执行结果列表")


class TaskLogListResponse(PaginatedResponse):
    """任务日志列表响应"""
    logs: List[TaskLogSummary] = Field(description="日志列表")
