"""自定义异常类层次

提供统一的异常处理机制，区分不同类型的错误
"""

from typing import Optional, Dict, Any


class AppException(Exception):
    """应用基础异常类"""
    
    def __init__(
        self,
        message: str,
        error_code: str = "INTERNAL_ERROR",
        details: Optional[Dict[str, Any]] = None,
    ):
        self.message = message
        self.error_code = error_code
        self.details = details or {}
        super().__init__(message)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "error_code": self.error_code,
            "message": self.message,
            "details": self.details,
        }


# ============ 数据采集相关异常 ============

class DataCollectionError(AppException):
    """数据采集异常基类"""
    
    def __init__(
        self,
        message: str,
        source: str = "unknown",
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            error_code="DATA_COLLECTION_ERROR",
            details={"source": source, **(details or {})},
        )
        self.source = source


class DataSourceUnavailableError(DataCollectionError):
    """数据源不可用"""
    
    def __init__(self, source: str, message: str = "数据源不可用"):
        super().__init__(
            message=message,
            source=source,
        )
        self.error_code = "DATA_SOURCE_UNAVAILABLE"


class DataFetchError(DataCollectionError):
    """数据获取失败"""
    
    def __init__(
        self,
        source: str,
        message: str = "数据获取失败",
        stock_code: Optional[str] = None,
    ):
        super().__init__(
            message=message,
            source=source,
            details={"stock_code": stock_code} if stock_code else None,
        )
        self.error_code = "DATA_FETCH_ERROR"
        self.stock_code = stock_code


class DataParseError(DataCollectionError):
    """数据解析失败"""
    
    def __init__(self, source: str, message: str = "数据解析失败"):
        super().__init__(message=message, source=source)
        self.error_code = "DATA_PARSE_ERROR"


# ============ LLM 相关异常 ============

class LLMException(AppException):
    """LLM异常基类"""
    
    def __init__(
        self,
        message: str,
        provider: str = "unknown",
        model: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            error_code="LLM_ERROR",
            details={"provider": provider, "model": model, **(details or {})},
        )
        self.provider = provider
        self.model = model


class LLMConnectionError(LLMException):
    """LLM连接失败"""
    
    def __init__(
        self,
        provider: str,
        message: str = "LLM服务连接失败",
        model: Optional[str] = None,
    ):
        super().__init__(message=message, provider=provider, model=model)
        self.error_code = "LLM_CONNECTION_ERROR"


class LLMTimeoutError(LLMException):
    """LLM请求超时"""
    
    def __init__(
        self,
        provider: str,
        message: str = "LLM请求超时",
        model: Optional[str] = None,
        timeout_seconds: Optional[float] = None,
    ):
        super().__init__(
            message=message,
            provider=provider,
            model=model,
            details={"timeout_seconds": timeout_seconds},
        )
        self.error_code = "LLM_TIMEOUT_ERROR"
        self.timeout_seconds = timeout_seconds


class LLMRateLimitError(LLMException):
    """LLM请求频率限制"""
    
    def __init__(
        self,
        provider: str,
        message: str = "LLM请求频率超限",
        model: Optional[str] = None,
        retry_after: Optional[int] = None,
    ):
        super().__init__(
            message=message,
            provider=provider,
            model=model,
            details={"retry_after": retry_after},
        )
        self.error_code = "LLM_RATE_LIMIT_ERROR"
        self.retry_after = retry_after


class LLMResponseError(LLMException):
    """LLM响应错误"""
    
    def __init__(
        self,
        provider: str,
        message: str = "LLM响应错误",
        model: Optional[str] = None,
        status_code: Optional[int] = None,
    ):
        super().__init__(
            message=message,
            provider=provider,
            model=model,
            details={"status_code": status_code},
        )
        self.error_code = "LLM_RESPONSE_ERROR"
        self.status_code = status_code


class LLMParseError(LLMException):
    """LLM响应解析失败"""
    
    def __init__(
        self,
        provider: str,
        message: str = "无法解析LLM响应",
        model: Optional[str] = None,
        raw_response: Optional[str] = None,
    ):
        super().__init__(
            message=message,
            provider=provider,
            model=model,
            details={"raw_response": raw_response[:500] if raw_response else None},
        )
        self.error_code = "LLM_PARSE_ERROR"
        self.raw_response = raw_response


# ============ 业务逻辑异常 ============

class BusinessError(AppException):
    """业务逻辑异常基类"""
    pass


class AgentNotFoundError(BusinessError):
    """Agent不存在"""
    
    def __init__(self, agent_id: str):
        super().__init__(
            message=f"Agent不存在: {agent_id}",
            error_code="AGENT_NOT_FOUND",
            details={"agent_id": agent_id},
        )
        self.agent_id = agent_id


class AgentInactiveError(BusinessError):
    """Agent状态不活跃"""
    
    def __init__(self, agent_id: str, status: str):
        super().__init__(
            message=f"Agent状态不是活跃: {status}",
            error_code="AGENT_INACTIVE",
            details={"agent_id": agent_id, "status": status},
        )
        self.agent_id = agent_id
        self.status = status


class PortfolioNotFoundError(BusinessError):
    """投资组合不存在"""
    
    def __init__(self, agent_id: str):
        super().__init__(
            message=f"投资组合不存在: {agent_id}",
            error_code="PORTFOLIO_NOT_FOUND",
            details={"agent_id": agent_id},
        )
        self.agent_id = agent_id


class InsufficientFundsError(BusinessError):
    """资金不足"""
    
    def __init__(
        self,
        required: float,
        available: float,
        agent_id: Optional[str] = None,
    ):
        super().__init__(
            message=f"资金不足: 需要 {required}, 可用 {available}",
            error_code="INSUFFICIENT_FUNDS",
            details={
                "required": required,
                "available": available,
                "agent_id": agent_id,
            },
        )
        self.required = required
        self.available = available


class InsufficientSharesError(BusinessError):
    """持仓不足"""
    
    def __init__(
        self,
        stock_code: str,
        required: int,
        available: int,
        agent_id: Optional[str] = None,
    ):
        super().__init__(
            message=f"持仓不足: {stock_code} 需要 {required} 股, 可用 {available} 股",
            error_code="INSUFFICIENT_SHARES",
            details={
                "stock_code": stock_code,
                "required": required,
                "available": available,
                "agent_id": agent_id,
            },
        )
        self.stock_code = stock_code
        self.required = required
        self.available = available


class OrderValidationError(BusinessError):
    """订单验证失败"""
    
    def __init__(self, message: str, order_id: Optional[str] = None):
        super().__init__(
            message=message,
            error_code="ORDER_VALIDATION_ERROR",
            details={"order_id": order_id},
        )
        self.order_id = order_id


class TradingTimeError(BusinessError):
    """非交易时间"""
    
    def __init__(self, message: str = "当前非交易时间"):
        super().__init__(
            message=message,
            error_code="TRADING_TIME_ERROR",
        )


# ============ 配置相关异常 ============

class ConfigurationError(AppException):
    """配置错误"""
    
    def __init__(self, message: str, config_key: Optional[str] = None):
        super().__init__(
            message=message,
            error_code="CONFIGURATION_ERROR",
            details={"config_key": config_key},
        )
        self.config_key = config_key


class ProviderNotConfiguredError(ConfigurationError):
    """LLM渠道未配置"""
    
    def __init__(self, agent_id: str):
        super().__init__(
            message="Agent未配置LLM渠道",
            config_key="provider_id",
        )
        self.details["agent_id"] = agent_id
        self.error_code = "PROVIDER_NOT_CONFIGURED"


class ProviderNotFoundError(ConfigurationError):
    """LLM渠道不存在"""
    
    def __init__(self, provider_id: str):
        super().__init__(
            message=f"LLM渠道不存在: {provider_id}",
            config_key="provider_id",
        )
        self.details["provider_id"] = provider_id
        self.error_code = "PROVIDER_NOT_FOUND"


class ProviderDisabledError(ConfigurationError):
    """LLM渠道已禁用"""
    
    def __init__(self, provider_name: str):
        super().__init__(
            message=f"LLM渠道已禁用: {provider_name}",
            config_key="provider_id",
        )
        self.details["provider_name"] = provider_name
        self.error_code = "PROVIDER_DISABLED"


# ============ 股票数据相关异常 ============

class StockDataError(AppException):
    """股票数据获取错误"""
    
    def __init__(
        self,
        message: str,
        stock_code: Optional[str] = None,
        source: str = "AkShare",
    ):
        super().__init__(
            message=message,
            error_code="STOCK_DATA_ERROR",
            details={"stock_code": stock_code, "source": source},
        )
        self.stock_code = stock_code
        self.source = source


class StockNotFoundError(StockDataError):
    """股票不存在"""
    
    def __init__(self, stock_code: str):
        super().__init__(
            message=f"股票不存在: {stock_code}",
            stock_code=stock_code,
        )
        self.error_code = "STOCK_NOT_FOUND"


class AIAnalysisError(AppException):
    """AI分析错误"""
    
    def __init__(
        self,
        message: str,
        stock_code: Optional[str] = None,
    ):
        super().__init__(
            message=message,
            error_code="AI_ANALYSIS_ERROR",
            details={"stock_code": stock_code},
        )
        self.stock_code = stock_code
