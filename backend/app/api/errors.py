"""API错误处理模块"""

from typing import Any, Dict, Optional
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError

from app.api.schemas import ErrorResponse


# 错误代码定义
class ErrorCodes:
    """标准化错误代码"""
    # 通用错误
    INTERNAL_ERROR = "INTERNAL_ERROR"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    NOT_FOUND = "NOT_FOUND"
    BAD_REQUEST = "BAD_REQUEST"
    
    # Agent相关
    AGENT_NOT_FOUND = "AGENT_NOT_FOUND"
    AGENT_PAUSED = "AGENT_PAUSED"
    AGENT_DELETED = "AGENT_DELETED"
    
    # 模板相关
    TEMPLATE_NOT_FOUND = "TEMPLATE_NOT_FOUND"
    TEMPLATE_SYNTAX_ERROR = "TEMPLATE_SYNTAX_ERROR"
    
    # 行情相关
    QUOTE_NOT_FOUND = "QUOTE_NOT_FOUND"
    INVALID_STOCK_CODE = "INVALID_STOCK_CODE"
    INVALID_DATE_FORMAT = "INVALID_DATE_FORMAT"
    INVALID_DATE_RANGE = "INVALID_DATE_RANGE"
    
    # Portfolio相关
    PORTFOLIO_NOT_FOUND = "PORTFOLIO_NOT_FOUND"
    INSUFFICIENT_CASH = "INSUFFICIENT_CASH"
    INSUFFICIENT_POSITION = "INSUFFICIENT_POSITION"
    
    # 交易相关
    INVALID_SIDE = "INVALID_SIDE"
    INVALID_QUANTITY = "INVALID_QUANTITY"
    PRICE_LIMIT_EXCEEDED = "PRICE_LIMIT_EXCEEDED"
    T_PLUS_1_VIOLATION = "T_PLUS_1_VIOLATION"


class APIError(Exception):
    """API错误基类"""
    
    def __init__(
        self,
        error_code: str,
        message: str,
        status_code: int = 400,
        details: Optional[Dict[str, Any]] = None,
    ):
        self.error_code = error_code
        self.message = message
        self.status_code = status_code
        self.details = details
        super().__init__(message)
    
    def to_response(self) -> ErrorResponse:
        """转换为错误响应"""
        return ErrorResponse(
            error_code=self.error_code,
            message=self.message,
            details=self.details,
        )


class NotFoundError(APIError):
    """资源不存在错误"""
    
    def __init__(self, resource: str, resource_id: str):
        super().__init__(
            error_code=ErrorCodes.NOT_FOUND,
            message=f"{resource}不存在: {resource_id}",
            status_code=404,
        )


class ValidationError(APIError):
    """验证错误"""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            error_code=ErrorCodes.VALIDATION_ERROR,
            message=message,
            status_code=422,
            details=details,
        )


def format_validation_errors(errors: list) -> Dict[str, Any]:
    """格式化Pydantic验证错误"""
    formatted = []
    for error in errors:
        loc = ".".join(str(x) for x in error.get("loc", []))
        formatted.append({
            "field": loc,
            "message": error.get("msg", ""),
            "type": error.get("type", ""),
        })
    return {"validation_errors": formatted}


async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    """处理Pydantic验证错误"""
    errors = exc.errors()
    details = format_validation_errors(errors)
    
    return JSONResponse(
        status_code=422,
        content={
            "error_code": ErrorCodes.VALIDATION_ERROR,
            "message": "请求参数验证失败",
            "details": details,
        },
    )


async def http_exception_handler(
    request: Request,
    exc: HTTPException,
) -> JSONResponse:
    """处理HTTP异常"""
    detail = exc.detail
    
    # 如果detail已经是标准格式，直接使用
    if isinstance(detail, dict) and "error_code" in detail:
        return JSONResponse(
            status_code=exc.status_code,
            content=detail,
        )
    
    # 否则包装为标准格式
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error_code": ErrorCodes.BAD_REQUEST if exc.status_code == 400 else ErrorCodes.INTERNAL_ERROR,
            "message": str(detail),
            "details": None,
        },
    )


async def api_error_handler(
    request: Request,
    exc: APIError,
) -> JSONResponse:
    """处理自定义API错误"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error_code": exc.error_code,
            "message": exc.message,
            "details": exc.details,
        },
    )


async def general_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    """处理未捕获的异常"""
    return JSONResponse(
        status_code=500,
        content={
            "error_code": ErrorCodes.INTERNAL_ERROR,
            "message": "服务器内部错误",
            "details": None,
        },
    )


def register_exception_handlers(app: FastAPI) -> None:
    """注册异常处理器"""
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(APIError, api_error_handler)
    # 注意：生产环境可能需要更细粒度的异常处理
    # app.add_exception_handler(Exception, general_exception_handler)
