"""统一行情服务

整合 quote_sync_service.py 的功能，提供统一的行情数据操作入口。

职责：
- 行情数据同步（首次同步、增量同步）
- 实时行情获取
- 热门股票获取
- 行情数据查询
"""

import logging
import os
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session

from app.data.collector import get_data_collector, AKShareDataCollector
from app.data.repositories import StockQuoteRepository
from app.db.models import StockQuoteModel
from app.models.entities import StockQuote
from app.core.timezone import now as tz_now, today_str

logger = logging.getLogger(__name__)


@dataclass
class SyncResult:
    """同步结果"""
    success: bool
    success_count: int = 0
    fail_count: int = 0
    message: str = ""
    stock_codes: List[str] = None
    
    def __post_init__(self):
        if self.stock_codes is None:
            self.stock_codes = []


class QuoteService:
    """统一的行情服务
    
    职责：
    - 行情数据同步（首次同步、增量同步）
    - 实时行情获取
    - 热门股票获取
    - 行情数据查询
    """
    
    def __init__(self, db: Session):
        """初始化行情服务
        
        Args:
            db: 数据库会话
        """
        self.db = db
        self.quote_repo = StockQuoteRepository(db)
        self.data_source = os.environ.get("DATA_SOURCE", "akshare")
        self.collector = get_data_collector(self.data_source)
    
    # ============ 同步相关方法 ============
    
    def has_quote_data(self) -> bool:
        """检查数据库是否有行情数据
        
        Returns:
            True表示有数据，False表示无数据
        """
        count = self.db.query(StockQuoteModel).count()
        logger.info(f"数据库中有 {count} 条行情记录")
        return count > 0
    
    def get_latest_quote_date(self) -> Optional[str]:
        """获取数据库中最新的行情日期
        
        Returns:
            最新行情日期 (YYYY-MM-DD)，无数据返回None
        """
        latest = (
            self.db.query(StockQuoteModel)
            .order_by(StockQuoteModel.trade_date.desc())
            .first()
        )
        
        if latest:
            date_str = latest.trade_date.strftime("%Y-%m-%d")
            logger.info(f"数据库中最新行情日期: {date_str}")
            return date_str
        
        logger.info("数据库中无行情数据")
        return None
    
    async def get_all_a_stock_codes(self) -> List[str]:
        """获取所有A股股票代码
        
        Returns:
            股票代码列表
        """
        try:
            if isinstance(self.collector, AKShareDataCollector):
                logger.info("正在获取所有A股股票列表...")
                stocks = await self.collector.sync_stock_list()
                codes = [stock.stock_code for stock in stocks]
                logger.info(f"获取到 {len(codes)} 只A股股票")
                return codes
            else:
                logger.warning("当前数据源不支持获取完整股票列表")
                return []
        except Exception as e:
            logger.error(f"获取A股股票列表失败: {e}")
            return []
    
    async def sync_quotes(self, force_full: bool = False) -> SyncResult:
        """智能同步行情数据
        
        逻辑：
        1. 如果数据库无数据，执行首次同步（近三个月所有股票）
        2. 如果数据库有数据，执行增量同步（仅当天）
        3. 如果force_full=True，强制执行首次同步
        
        Args:
            force_full: 是否强制执行首次同步
            
        Returns:
            SyncResult: 同步结果
        """
        try:
            if force_full or not self.has_quote_data():
                logger.info("执行首次同步")
                return await self._sync_initial_data()
            else:
                logger.info("执行增量同步")
                return await self._sync_today_data()
                
        except Exception as e:
            logger.error(f"行情同步失败: {e}")
            return SyncResult(
                success=False,
                message=f"同步失败: {str(e)}",
            )
    
    async def _sync_initial_data(self) -> SyncResult:
        """首次同步：获取所有A股股票的近三个月数据
        
        Returns:
            SyncResult: 同步结果
        """
        logger.info("开始首次同步：获取所有A股股票的近三个月数据")
        
        stock_codes = await self.get_all_a_stock_codes()
        
        if not stock_codes:
            logger.error("无法获取A股股票列表，首次同步失败")
            return SyncResult(
                success=False,
                message="无法获取A股股票列表",
            )
        
        # 计算日期范围：近三个月
        end_date = tz_now().strftime("%Y-%m-%d")
        start_date = (tz_now() - timedelta(days=90)).strftime("%Y-%m-%d")
        
        logger.info(f"同步日期范围: {start_date} 到 {end_date}")
        logger.info(f"同步股票数量: {len(stock_codes)}")
        
        try:
            quotes = await self.collector.fetch_daily_quotes(
                stock_codes=stock_codes,
                start_date=start_date,
                end_date=end_date,
            )
            
            if not quotes:
                logger.warning("未获取到行情数据")
                return SyncResult(
                    success=False,
                    message="未获取到行情数据",
                    stock_codes=stock_codes,
                )
            
            logger.info(f"获取到 {len(quotes)} 条行情记录")
            
            success_count, fail_count = self.quote_repo.upsert_batch(quotes)
            
            logger.info(
                f"首次同步完成: 成功 {success_count} 条, 失败 {fail_count} 条"
            )
            
            return SyncResult(
                success=True,
                success_count=success_count,
                fail_count=fail_count,
                message=f"首次同步完成: 成功 {success_count} 条",
                stock_codes=list(set(q.stock_code for q in quotes)),
            )
            
        except Exception as e:
            logger.error(f"首次同步失败: {e}")
            return SyncResult(
                success=False,
                message=f"首次同步失败: {str(e)}",
            )
    
    async def _sync_today_data(self) -> SyncResult:
        """增量同步：仅同步当天数据
        
        Returns:
            SyncResult: 同步结果
        """
        logger.info("开始增量同步：仅同步当天数据")
        
        stock_codes = await self.get_all_a_stock_codes()
        
        if not stock_codes:
            logger.error("无法获取A股股票列表，增量同步失败")
            return SyncResult(
                success=False,
                message="无法获取A股股票列表",
            )
        
        today = today_str()
        
        logger.info(f"同步日期: {today}")
        logger.info(f"同步股票数量: {len(stock_codes)}")
        
        try:
            quotes = await self.collector.fetch_daily_quotes(
                stock_codes=stock_codes,
                start_date=today,
                end_date=today,
            )
            
            if not quotes:
                logger.warning(f"未获取到 {today} 的行情数据")
                return SyncResult(
                    success=False,
                    message=f"未获取到 {today} 的行情数据",
                    stock_codes=stock_codes,
                )
            
            logger.info(f"获取到 {len(quotes)} 条行情记录")
            
            success_count, fail_count = self.quote_repo.upsert_batch(quotes)
            
            logger.info(
                f"增量同步完成: 成功 {success_count} 条, 失败 {fail_count} 条"
            )
            
            return SyncResult(
                success=True,
                success_count=success_count,
                fail_count=fail_count,
                message=f"增量同步完成: 成功 {success_count} 条",
                stock_codes=list(set(q.stock_code for q in quotes)),
            )
            
        except Exception as e:
            logger.error(f"增量同步失败: {e}")
            return SyncResult(
                success=False,
                message=f"增量同步失败: {str(e)}",
            )
    
    async def sync_specific_stocks(
        self,
        stock_codes: List[str],
        days: int = 7,
    ) -> SyncResult:
        """同步指定股票的行情数据
        
        Args:
            stock_codes: 股票代码列表
            days: 同步最近N天数据
            
        Returns:
            SyncResult: 同步结果
        """
        if not stock_codes:
            logger.warning("未指定股票代码")
            return SyncResult(
                success=False,
                message="未指定股票代码",
            )
        
        logger.info(f"同步指定股票: {stock_codes}, 最近 {days} 天")
        
        end_date = tz_now().strftime("%Y-%m-%d")
        start_date = (tz_now() - timedelta(days=days)).strftime("%Y-%m-%d")
        
        try:
            quotes = await self.collector.fetch_daily_quotes(
                stock_codes=stock_codes,
                start_date=start_date,
                end_date=end_date,
            )
            
            if not quotes:
                logger.warning("未获取到行情数据")
                return SyncResult(
                    success=False,
                    message="未获取到行情数据",
                    stock_codes=stock_codes,
                )
            
            logger.info(f"获取到 {len(quotes)} 条行情记录")
            
            success_count, fail_count = self.quote_repo.upsert_batch(quotes)
            
            logger.info(
                f"指定股票同步完成: 成功 {success_count} 条, 失败 {fail_count} 条"
            )
            
            return SyncResult(
                success=True,
                success_count=success_count,
                fail_count=fail_count,
                message=f"同步完成: 成功 {success_count} 条",
                stock_codes=list(set(q.stock_code for q in quotes)),
            )
            
        except Exception as e:
            logger.error(f"指定股票同步失败: {e}")
            return SyncResult(
                success=False,
                message=f"同步失败: {str(e)}",
            )
    
    # ============ 实时行情方法 ============
    
    async def fetch_realtime_quotes(
        self,
        stock_codes: List[str],
    ) -> List[StockQuote]:
        """获取实时行情数据
        
        Args:
            stock_codes: 股票代码列表
            
        Returns:
            实时行情数据列表
        """
        if not stock_codes:
            logger.warning("未指定股票代码")
            return []
        
        try:
            if isinstance(self.collector, AKShareDataCollector):
                quotes = await self.collector.fetch_realtime_quotes(stock_codes)
                logger.info(f"获取到 {len(quotes)} 条实时行情")
                return quotes
            else:
                logger.warning("当前数据源不支持实时行情")
                return []
        except Exception as e:
            logger.error(f"获取实时行情失败: {e}")
            return []
    
    async def sync_realtime_quotes(
        self,
        stock_codes: List[str] = None,
    ) -> SyncResult:
        """同步实时行情数据到数据库
        
        Args:
            stock_codes: 股票代码列表，为空则获取热门股票
            
        Returns:
            SyncResult: 同步结果
        """
        try:
            # 如果未指定股票，获取热门股票
            if not stock_codes:
                stock_codes = await self.get_hot_stocks(limit=20)
            
            if not stock_codes:
                return SyncResult(
                    success=False,
                    message="无法获取股票列表",
                )
            
            quotes = await self.fetch_realtime_quotes(stock_codes)
            
            if not quotes:
                return SyncResult(
                    success=False,
                    message="未获取到实时行情数据",
                    stock_codes=stock_codes,
                )
            
            success_count, fail_count = self.quote_repo.upsert_batch(quotes)
            
            return SyncResult(
                success=True,
                success_count=success_count,
                fail_count=fail_count,
                message=f"成功同步 {success_count} 条实时行情",
                stock_codes=list(set(q.stock_code for q in quotes)),
            )
            
        except Exception as e:
            logger.error(f"同步实时行情失败: {e}")
            return SyncResult(
                success=False,
                message=f"同步失败: {str(e)}",
            )
    
    # ============ 热门股票方法 ============
    
    async def get_hot_stocks(self, limit: int = 20) -> List[str]:
        """获取热门股票代码列表
        
        Args:
            limit: 返回数量
            
        Returns:
            热门股票代码列表
        """
        try:
            if isinstance(self.collector, AKShareDataCollector):
                codes = await self.collector.fetch_hot_stocks(limit=limit)
                logger.info(f"获取到 {len(codes)} 只热门股票")
                return codes
            else:
                logger.warning("当前数据源不支持获取热门股票")
                return []
        except Exception as e:
            logger.error(f"获取热门股票失败: {e}")
            return []
    
    # ============ 查询方法 ============
    
    def get_quote(
        self,
        stock_code: str,
        date: Optional[str] = None,
    ) -> Optional[StockQuote]:
        """获取行情数据
        
        Args:
            stock_code: 股票代码
            date: 指定日期 (YYYY-MM-DD)，为空则获取最新
            
        Returns:
            行情数据，不存在返回None
        """
        if date:
            return self.quote_repo.get_by_code_and_date(stock_code, date)
        else:
            return self.quote_repo.get_latest(stock_code)
    
    def get_history(
        self,
        stock_code: str,
        start_date: str,
        end_date: str,
    ) -> List[StockQuote]:
        """获取历史行情数据
        
        Args:
            stock_code: 股票代码
            start_date: 开始日期 (YYYY-MM-DD)
            end_date: 结束日期 (YYYY-MM-DD)
            
        Returns:
            历史行情数据列表
        """
        return self.quote_repo.get_history(stock_code, start_date, end_date)
    
    def get_sync_info(self) -> dict:
        """获取同步状态信息
        
        Returns:
            同步状态信息字典
        """
        has_data = self.has_quote_data()
        latest_date = self.get_latest_quote_date()
        
        # 统计记录数
        total_count = self.db.query(StockQuoteModel).count()
        
        # 统计股票数
        from sqlalchemy import func
        stock_count = self.db.query(
            func.count(func.distinct(StockQuoteModel.stock_code))
        ).scalar() or 0
        
        return {
            "has_data": has_data,
            "latest_date": latest_date,
            "total_records": total_count,
            "stock_count": stock_count,
            "data_source": self.data_source,
        }
    
    # ============ 批量存储方法（供其他服务调用）============
    
    def upsert_quotes(self, quotes: List[StockQuote]) -> Tuple[int, int]:
        """批量更新或插入行情数据
        
        供其他服务（如 MarketDataService）调用，委托存储行情数据
        
        Args:
            quotes: 行情数据列表
            
        Returns:
            (成功数量, 失败数量)
        """
        if not quotes:
            return 0, 0
        return self.quote_repo.upsert_batch(quotes)
