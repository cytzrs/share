"""市场数据API路由

提供市场情绪、大盘概况、热门股票等数据的查询和刷新接口
"""

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db.session import get_db
from app.data.market_service import MarketDataService

router = APIRouter()


class MarketDataResponse(BaseModel):
    """市场数据响应"""
    market_sentiment: Optional[dict] = None
    index_overview: Optional[dict] = None
    hot_stocks: Optional[dict] = None


class RefreshResponse(BaseModel):
    """刷新响应"""
    success: bool
    results: dict
    message: str


@router.get(
    "",
    response_model=MarketDataResponse,
    summary="获取市场数据",
    description="获取市场情绪、大盘概况、热门股票等数据",
)
async def get_market_data(
    db: Session = Depends(get_db),
):
    """获取所有市场数据"""
    service = MarketDataService(db)
    all_data = service.get_all_market_data()
    
    return MarketDataResponse(
        market_sentiment=all_data.get(MarketDataService.TYPE_MARKET_SENTIMENT),
        index_overview=all_data.get(MarketDataService.TYPE_INDEX_OVERVIEW),
        hot_stocks=all_data.get(MarketDataService.TYPE_HOT_STOCKS),
    )


@router.get(
    "/sentiment",
    summary="获取市场情绪",
    description="获取市场情绪数据",
)
async def get_market_sentiment(
    db: Session = Depends(get_db),
):
    """获取市场情绪数据"""
    service = MarketDataService(db)
    data = service.get_market_sentiment()
    
    if not data:
        return {"data": None, "message": "暂无数据，请先刷新"}
    
    return data


@router.get(
    "/indices",
    summary="获取大盘概况",
    description="获取主要指数数据",
)
async def get_index_overview(
    db: Session = Depends(get_db),
):
    """获取大盘概况数据"""
    service = MarketDataService(db)
    data = service.get_index_overview()
    
    if not data:
        return {"data": None, "message": "暂无数据，请先刷新"}
    
    return data


@router.get(
    "/hot-stocks",
    summary="获取热门股票",
    description="获取热门股票列表，支持分页",
)
async def get_hot_stocks(
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
):
    """获取热门股票数据（支持分页）"""
    service = MarketDataService(db)
    data = service.get_hot_stocks()
    
    if not data:
        return {"data": None, "message": "暂无数据，请先刷新"}
    
    # 分页处理
    stocks = data.get("data", {}).get("stocks", [])
    total = len(stocks)
    total_pages = (total + page_size - 1) // page_size if page_size > 0 else 1
    
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    paginated_stocks = stocks[start_idx:end_idx]
    
    return {
        "data": {
            "stocks": paginated_stocks,
            "updated_at": data.get("data", {}).get("updated_at"),
        },
        "date": data.get("date"),
        "updated_at": data.get("updated_at"),
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": total_pages,
        }
    }


@router.get(
    "/overview",
    summary="获取股市概览",
    description="获取大盘概况和市场情绪的综合数据，用于仪表盘展示",
)
async def get_market_overview(
    db: Session = Depends(get_db),
):
    """获取股市概览数据（大盘概况+市场情绪）"""
    service = MarketDataService(db)
    
    sentiment = service.get_market_sentiment()
    indices = service.get_index_overview()
    
    sentiment_data = sentiment.get("data", {}) if sentiment else {}
    indices_data = indices.get("data", {}) if indices else {}
    
    return {
        "market_sentiment": {
            "fear_greed_index": sentiment_data.get("fear_greed_index", 50),
            "market_mood": sentiment_data.get("market_mood", "中性"),
            "trading_activity": sentiment_data.get("trading_activity", "正常"),
            "up_count": sentiment_data.get("up_count", 0),
            "down_count": sentiment_data.get("down_count", 0),
            "flat_count": sentiment_data.get("flat_count", 0),
            "total_count": sentiment_data.get("total_count", 0),
            "limit_up_count": sentiment_data.get("limit_up_count", 0),
            "limit_down_count": sentiment_data.get("limit_down_count", 0),
            "updated_at": sentiment_data.get("updated_at"),
        },
        "indices": indices_data.get("indices", []),
        "updated_at": indices_data.get("updated_at") or sentiment_data.get("updated_at"),
    }


@router.post(
    "/refresh",
    response_model=RefreshResponse,
    summary="刷新市场数据",
    description="从数据源刷新所有市场数据",
)
async def refresh_market_data(
    db: Session = Depends(get_db),
):
    """刷新所有市场数据"""
    service = MarketDataService(db)
    
    try:
        results = await service.refresh_all()
        
        success_count = sum(1 for v in results.values() if v)
        total_count = len(results)
        
        return RefreshResponse(
            success=success_count == total_count,
            results=results,
            message=f"刷新完成: {success_count}/{total_count} 成功",
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error_code": "REFRESH_FAILED", "message": str(e)},
        )


@router.post(
    "/refresh/sentiment",
    summary="刷新市场情绪",
    description="刷新市场情绪数据",
)
async def refresh_sentiment(
    db: Session = Depends(get_db),
):
    """刷新市场情绪数据"""
    service = MarketDataService(db)
    success = await service.refresh_market_sentiment()
    
    return {
        "success": success,
        "message": "刷新成功" if success else "刷新失败",
    }


@router.post(
    "/refresh/indices",
    summary="刷新大盘概况",
    description="刷新大盘指数数据",
)
async def refresh_indices(
    db: Session = Depends(get_db),
):
    """刷新大盘概况数据"""
    service = MarketDataService(db)
    success = await service.refresh_index_overview()
    
    return {
        "success": success,
        "message": "刷新成功" if success else "刷新失败",
    }


@router.post(
    "/refresh/hot-stocks",
    summary="刷新热门股票",
    description="刷新热门股票数据",
)
async def refresh_hot_stocks(
    db: Session = Depends(get_db),
):
    """刷新热门股票数据"""
    service = MarketDataService(db)
    success = await service.refresh_hot_stocks()
    
    return {
        "success": success,
        "message": "刷新成功" if success else "刷新失败",
    }
