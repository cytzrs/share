"""行情数据API路由

整合了以下端点：
- 原 data.py 的 /sync-quotes, /sync-realtime, /hot-stocks
- 原 system.py 的 /quote-sync/info
"""

import logging
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.db.session import get_db
from app.data.repositories import StockQuoteRepository
from app.data.quote_service import QuoteService, SyncResult
from app.core.trading_rules import validate_stock_code
from app.api.schemas import (
    QuoteResponse,
    QuoteHistoryResponse,
    ErrorResponse,
)
from app.core.timezone import now as tz_now, today_str
from app.core.auth import require_admin

logger = logging.getLogger(__name__)

router = APIRouter()


# ============== 行情同步相关模型（从 data.py 迁移）==============

class SyncQuotesRequest(BaseModel):
    """同步行情数据请求"""
    stock_codes: Optional[List[str]] = Field(default=None, description="股票代码列表，为空则获取热门股票")
    days: int = Field(default=30, ge=1, le=365, description="获取最近N天的数据")
    force_full: bool = Field(default=False, description="是否强制全量同步")


class SyncQuotesResponse(BaseModel):
    """同步行情数据响应"""
    success: bool
    message: str
    records_count: int = 0
    stock_codes: List[str] = []


class QuoteSyncInfoResponse(BaseModel):
    """行情同步信息响应"""
    has_data: bool = Field(description="数据库是否有数据")
    latest_date: Optional[str] = Field(default=None, description="最新行情日期")
    total_records: int = Field(default=0, description="总记录数")
    stock_count: int = Field(default=0, description="股票数量")
    data_source: str = Field(default="", description="数据源")
    status: str = Field(default="", description="状态描述")


class StockQuoteListItem(BaseModel):
    """股票行情列表项"""
    stock_code: str
    stock_name: Optional[str]
    trade_date: str
    open_price: float
    high_price: float
    low_price: float
    close_price: float
    prev_close: float
    change_pct: float = 0
    volume: int
    amount: float
    created_at: Optional[str]
    record_count: int


class StockQuoteListResponse(BaseModel):
    """股票行情列表响应"""
    items: List[StockQuoteListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class StockHistoryItem(BaseModel):
    """股票历史行情项"""
    stock_code: str
    stock_name: Optional[str]
    trade_date: str
    open_price: float
    high_price: float
    low_price: float
    close_price: float
    prev_close: float
    change_pct: float = 0
    volume: int
    amount: float
    created_at: Optional[str]


class StockHistoryResponse(BaseModel):
    """股票历史行情响应"""
    items: List[StockHistoryItem]
    total: int
    page: int
    page_size: int
    total_pages: int


def _entity_to_response(quote) -> QuoteResponse:
    """将StockQuote实体转换为响应模型"""
    return QuoteResponse(
        stock_code=quote.stock_code,
        trade_date=quote.trade_date,
        open_price=quote.open_price,
        high_price=quote.high_price,
        low_price=quote.low_price,
        close_price=quote.close_price,
        prev_close=quote.prev_close,
        volume=quote.volume,
        amount=quote.amount,
    )


@router.get(
    "/{stock_code}",
    response_model=QuoteResponse,
    summary="获取股票行情",
    description="获取指定股票的最新行情数据",
    responses={
        400: {"model": ErrorResponse, "description": "无效的股票代码"},
        404: {"model": ErrorResponse, "description": "行情数据不存在"},
    },
)
async def get_quote(
    stock_code: str,
    date: Optional[str] = Query(default=None, description="指定日期 (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
):
    """获取股票行情"""
    if not validate_stock_code(stock_code):
        raise HTTPException(
            status_code=400,
            detail={
                "error_code": "INVALID_STOCK_CODE",
                "message": f"无效的股票代码: {stock_code}",
            }
        )
    
    repo = StockQuoteRepository(db)
    
    if date:
        quote = repo.get_by_code_and_date(stock_code, date)
    else:
        quote = repo.get_latest(stock_code)
    
    if quote is None:
        raise HTTPException(
            status_code=404,
            detail={
                "error_code": "QUOTE_NOT_FOUND",
                "message": f"未找到股票 {stock_code} 的行情数据",
            }
        )
    
    return _entity_to_response(quote)


@router.get(
    "/{stock_code}/history",
    response_model=QuoteHistoryResponse,
    summary="获取历史行情",
    description="获取指定股票的历史行情数据",
    responses={
        400: {"model": ErrorResponse, "description": "无效的股票代码或日期范围"},
        404: {"model": ErrorResponse, "description": "行情数据不存在"},
    },
)
async def get_history(
    stock_code: str,
    start_date: Optional[str] = Query(default=None, description="开始日期"),
    end_date: Optional[str] = Query(default=None, description="结束日期"),
    limit: int = Query(default=100, ge=1, le=1000, description="返回记录数限制"),
    db: Session = Depends(get_db),
):
    """获取历史行情"""
    if not validate_stock_code(stock_code):
        raise HTTPException(
            status_code=400,
            detail={
                "error_code": "INVALID_STOCK_CODE",
                "message": f"无效的股票代码: {stock_code}",
            }
        )
    
    if end_date is None:
        end_date = today_str()
    
    if start_date is None:
        start_dt = tz_now() - timedelta(days=30)
        start_date = start_dt.strftime("%Y-%m-%d")
    
    try:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail={
                "error_code": "INVALID_DATE_FORMAT",
                "message": "日期格式错误，请使用 YYYY-MM-DD 格式",
            }
        )
    
    if start_dt > end_dt:
        raise HTTPException(
            status_code=400,
            detail={
                "error_code": "INVALID_DATE_RANGE",
                "message": "开始日期不能晚于结束日期",
            }
        )
    
    repo = StockQuoteRepository(db)
    quotes = repo.get_history(stock_code, start_date, end_date)
    
    if len(quotes) > limit:
        quotes = quotes[-limit:]
    
    return QuoteHistoryResponse(
        stock_code=stock_code,
        start_date=start_date,
        end_date=end_date,
        quotes=[_entity_to_response(q) for q in quotes],
    )



@router.get(
    "",
    response_model=StockQuoteListResponse,
    summary="获取股票列表",
    description="获取所有股票的最新行情数据，每只股票显示最新一条记录",
)
async def list_stock_quotes(
    page: int = Query(default=1, ge=1, description="页码"),
    page_size: int = Query(default=20, ge=1, le=100, description="每页数量"),
    search: Optional[str] = Query(default=None, description="搜索股票代码"),
    db: Session = Depends(get_db),
):
    """获取股票列表
    
    返回所有股票的最新行情数据，每只股票根据trade_date取最新一条
    """
    repo = StockQuoteRepository(db)
    items, total = repo.get_all_latest(page=page, page_size=page_size, search=search)
    
    total_pages = (total + page_size - 1) // page_size
    
    return StockQuoteListResponse(
        items=[StockQuoteListItem(**item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post(
    "/{stock_code}/refresh",
    summary="刷新单只股票行情",
    description="从数据源获取并更新指定股票的最新行情数据",
    responses={
        400: {"model": ErrorResponse, "description": "无效的股票代码"},
    },
)
async def refresh_stock_quote(
    stock_code: str,
    db: Session = Depends(get_db),
    _admin: bool = Depends(require_admin),
):
    """刷新单只股票行情
    
    从数据源获取最新行情并更新到数据库
    """
    if not validate_stock_code(stock_code):
        raise HTTPException(
            status_code=400,
            detail={
                "error_code": "INVALID_STOCK_CODE",
                "message": f"无效的股票代码: {stock_code}",
            }
        )
    
    try:
        from app.data.collector import AKShareDataCollector
        from app.core.config import settings
        
        collector = AKShareDataCollector()
        quotes = await collector.fetch_realtime_quotes([stock_code])
        
        if not quotes:
            return {
                "success": False,
                "message": f"未能获取股票 {stock_code} 的行情数据",
            }
        
        repo = StockQuoteRepository(db)
        success_count, fail_count = repo.upsert_batch(quotes)
        
        return {
            "success": success_count > 0,
            "message": f"成功更新 {success_count} 条记录" if success_count > 0 else "更新失败",
            "updated_count": success_count,
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": "REFRESH_FAILED",
                "message": f"刷新行情失败: {str(e)}",
            }
        )



@router.get(
    "/{stock_code}/all",
    response_model=StockHistoryResponse,
    summary="获取股票所有历史数据",
    description="获取指定股票的所有历史行情数据，按交易日期倒序排列",
    responses={
        400: {"model": ErrorResponse, "description": "无效的股票代码"},
    },
)
async def get_stock_all_history(
    stock_code: str,
    page: int = Query(default=1, ge=1, description="页码"),
    page_size: int = Query(default=20, ge=1, le=100, description="每页数量"),
    db: Session = Depends(get_db),
):
    """获取股票所有历史数据
    
    返回指定股票的所有历史行情记录，按trade_date倒序排列
    """
    if not validate_stock_code(stock_code):
        raise HTTPException(
            status_code=400,
            detail={
                "error_code": "INVALID_STOCK_CODE",
                "message": f"无效的股票代码: {stock_code}",
            }
        )
    
    repo = StockQuoteRepository(db)
    items, total = repo.get_all_by_code(stock_code, page=page, page_size=page_size)
    
    total_pages = (total + page_size - 1) // page_size
    
    return StockHistoryResponse(
        items=[StockHistoryItem(**item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


# ============== 行情同步端点（从 data.py 迁移）==============

@router.post(
    "/sync",
    response_model=SyncQuotesResponse,
    summary="同步股票行情数据",
    description="从数据源获取股票行情数据并存储到数据库（原 /data/sync-quotes）",
)
async def sync_quotes(
    request: SyncQuotesRequest,
    db: Session = Depends(get_db),
    _admin: bool = Depends(require_admin),
):
    """同步股票行情数据
    
    使用统一的 QuoteService 进行行情同步
    """
    try:
        quote_service = QuoteService(db)
        
        # 如果指定了股票代码，同步指定股票
        if request.stock_codes:
            result = await quote_service.sync_specific_stocks(
                stock_codes=request.stock_codes,
                days=request.days,
            )
        else:
            # 否则执行智能同步
            result = await quote_service.sync_quotes(force_full=request.force_full)
        
        return SyncQuotesResponse(
            success=result.success,
            message=result.message,
            records_count=result.success_count,
            stock_codes=result.stock_codes,
        )
        
    except Exception as e:
        logger.exception(f"同步行情数据失败: {e}")
        return SyncQuotesResponse(
            success=False,
            message=f"同步失败: {str(e)}",
            records_count=0,
            stock_codes=[],
        )


@router.post(
    "/sync-realtime",
    response_model=SyncQuotesResponse,
    summary="同步实时行情数据",
    description="获取实时行情数据并存储到数据库（原 /data/sync-realtime）",
)
async def sync_realtime(
    stock_codes: Optional[List[str]] = Query(default=None, description="股票代码列表"),
    db: Session = Depends(get_db),
    _admin: bool = Depends(require_admin),
):
    """同步实时行情数据
    
    使用统一的 QuoteService 进行实时行情同步
    """
    try:
        quote_service = QuoteService(db)
        result = await quote_service.sync_realtime_quotes(stock_codes=stock_codes)
        
        return SyncQuotesResponse(
            success=result.success,
            message=result.message,
            records_count=result.success_count,
            stock_codes=result.stock_codes,
        )
        
    except Exception as e:
        logger.exception(f"同步实时行情失败: {e}")
        return SyncQuotesResponse(
            success=False,
            message=f"同步失败: {str(e)}",
            records_count=0,
            stock_codes=[],
        )


@router.get(
    "/hot-stocks",
    summary="获取热门股票列表",
    description="获取当前成交额最高的股票列表（原 /data/hot-stocks）",
)
async def get_hot_stocks(
    limit: int = Query(default=20, ge=1, le=100, description="返回数量"),
    db: Session = Depends(get_db),
):
    """获取热门股票列表
    
    使用统一的 QuoteService 获取热门股票
    """
    try:
        quote_service = QuoteService(db)
        codes = await quote_service.get_hot_stocks(limit=limit)
        
        return {
            "success": True,
            "stock_codes": codes,
            "count": len(codes),
        }
        
    except Exception as e:
        logger.exception(f"获取热门股票失败: {e}")
        return {
            "success": False,
            "message": str(e),
            "stock_codes": [],
            "count": 0,
        }


@router.get(
    "/sync/info",
    response_model=QuoteSyncInfoResponse,
    summary="获取行情同步信息",
    description="获取行情同步状态信息（原 /system/quote-sync/info）",
)
async def get_quote_sync_info(db: Session = Depends(get_db)):
    """获取行情同步信息
    
    使用统一的 QuoteService 获取同步状态
    
    Returns:
        同步信息，包括：
        - has_data: 数据库是否有数据
        - latest_date: 最新行情日期
        - total_records: 总记录数
        - stock_count: 股票数量
        - data_source: 数据源
    """
    try:
        quote_service = QuoteService(db)
        info = quote_service.get_sync_info()
        
        return QuoteSyncInfoResponse(
            has_data=info["has_data"],
            latest_date=info.get("latest_date"),
            total_records=info.get("total_records", 0),
            stock_count=info.get("stock_count", 0),
            data_source=info.get("data_source", ""),
            status="已初始化" if info["has_data"] else "未初始化",
        )
    except Exception as e:
        logger.exception(f"获取行情同步信息失败: {e}")
        return QuoteSyncInfoResponse(
            has_data=False,
            latest_date=None,
            total_records=0,
            stock_count=0,
            data_source="",
            status=f"错误: {str(e)}",
        )
