"""数据采集器实现"""

import logging
import os
import asyncio
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, date
from decimal import Decimal
from typing import List, Optional, Dict, Any, Callable, TypeVar

from app.models.entities import StockQuote
from app.core.timezone import now as tz_now, today_str
from app.core.exceptions import (
    DataCollectionError,
    DataSourceUnavailableError,
    DataFetchError,
    DataParseError,
)

# 禁用 AKShare 的 tqdm 进度条
os.environ["AKSHARE_TQDM"] = "0"

logger = logging.getLogger(__name__)

T = TypeVar("T")


@dataclass
class FinancialReport:
    """财务报表数据"""
    stock_code: str
    report_date: str
    period: str  # 'Q1', 'Q2', 'Q3', 'Q4', 'annual'
    
    # 资产负债表关键指标
    total_assets: Optional[Decimal] = None
    total_liabilities: Optional[Decimal] = None
    total_equity: Optional[Decimal] = None
    
    # 利润表关键指标
    revenue: Optional[Decimal] = None
    net_profit: Optional[Decimal] = None
    gross_profit: Optional[Decimal] = None
    
    # 现金流量表关键指标
    operating_cash_flow: Optional[Decimal] = None
    investing_cash_flow: Optional[Decimal] = None
    financing_cash_flow: Optional[Decimal] = None


@dataclass
class StockInfo:
    """股票基本信息"""
    stock_code: str
    name: str
    market: str  # 'SH' or 'SZ'
    list_date: Optional[str] = None
    industry: Optional[str] = None


@dataclass
class CollectionResult:
    """采集结果"""
    success: bool
    stock_code: Optional[str] = None
    records_count: int = 0
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    error_message: Optional[str] = None
    
    @property
    def duration_seconds(self) -> float:
        """采集耗时（秒）"""
        if self.start_time and self.end_time:
            return (self.end_time - self.start_time).total_seconds()
        return 0.0


class DataCollector(ABC):
    """数据采集器抽象基类
    
    提供通用的重试逻辑、日期格式化等功能
    """
    
    def __init__(
        self,
        max_retries: int = 3,
        retry_delay: float = 1.0,
        source_name: str = "unknown",
    ):
        """初始化数据采集器
        
        Args:
            max_retries: 最大重试次数
            retry_delay: 重试间隔（秒）
            source_name: 数据源名称
        """
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.source_name = source_name
    
    @abstractmethod
    async def fetch_daily_quotes(
        self,
        stock_codes: List[str],
        start_date: str,
        end_date: str,
    ) -> List[StockQuote]:
        """获取日K线数据
        
        Args:
            stock_codes: 股票代码列表
            start_date: 开始日期 (YYYY-MM-DD)
            end_date: 结束日期 (YYYY-MM-DD)
            
        Returns:
            股票行情数据列表
        """
        pass
    
    @abstractmethod
    async def fetch_financial_data(
        self,
        stock_code: str,
        period: str,
    ) -> Optional[FinancialReport]:
        """获取财务报表数据
        
        Args:
            stock_code: 股票代码
            period: 报告期 ('Q1', 'Q2', 'Q3', 'Q4', 'annual')
            
        Returns:
            财务报表数据
        """
        pass
    
    @abstractmethod
    async def sync_stock_list(self) -> List[StockInfo]:
        """同步股票列表
        
        Returns:
            股票基本信息列表
        """
        pass
    
    # ============ 通用工具方法 ============
    
    async def _fetch_with_retry(
        self,
        func: Callable[..., T],
        *args,
        **kwargs,
    ) -> Optional[T]:
        """带重试的数据获取
        
        Args:
            func: 要执行的函数
            *args: 位置参数
            **kwargs: 关键字参数
            
        Returns:
            函数返回值或 None
        """
        last_error = None
        
        for attempt in range(self.max_retries):
            try:
                return await self._run_sync(func, *args, **kwargs)
            except DataCollectionError:
                # 自定义异常直接抛出，不重试
                raise
            except Exception as e:
                last_error = e
                logger.warning(
                    f"{self.source_name} attempt {attempt + 1}/{self.max_retries} failed: {e}"
                )
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(self.retry_delay * (attempt + 1))
        
        logger.error(f"All {self.max_retries} attempts failed: {last_error}")
        return None
    
    async def _run_sync(self, func: Callable[..., T], *args, **kwargs) -> T:
        """运行同步函数（在线程池中执行）
        
        Args:
            func: 同步函数
            *args: 位置参数
            **kwargs: 关键字参数
            
        Returns:
            函数返回值
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, lambda: func(*args, **kwargs))
    
    @staticmethod
    def _format_date_to_dash(date_str: Optional[str]) -> Optional[str]:
        """格式化日期 (YYYYMMDD -> YYYY-MM-DD)
        
        Args:
            date_str: 日期字符串
            
        Returns:
            格式化后的日期字符串
        """
        if not date_str:
            return None
        if len(date_str) == 8:
            return f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
        return date_str
    
    @staticmethod
    def _format_date_to_compact(date_str: str) -> str:
        """格式化日期 (YYYY-MM-DD -> YYYYMMDD)
        
        Args:
            date_str: 日期字符串
            
        Returns:
            格式化后的日期字符串
        """
        return date_str.replace("-", "")
    
    @staticmethod
    def _safe_decimal(value: Any) -> Optional[Decimal]:
        """安全转换为Decimal
        
        Args:
            value: 要转换的值
            
        Returns:
            Decimal 或 None
        """
        if value is None or (isinstance(value, float) and value != value):  # NaN check
            return None
        try:
            return Decimal(str(value))
        except:
            return None
    
    @staticmethod
    def _to_sh_sz_code(stock_code: str) -> str:
        """转换为 SH/SZ 格式 (000001 -> 000001.SZ)
        
        Args:
            stock_code: 6位股票代码
            
        Returns:
            带后缀的股票代码
        """
        if stock_code.startswith("6"):
            return f"{stock_code}.SH"
        else:
            return f"{stock_code}.SZ"
    
    @staticmethod
    def _from_sh_sz_code(ts_code: str) -> str:
        """从 SH/SZ 格式转换 (000001.SZ -> 000001)
        
        Args:
            ts_code: 带后缀的股票代码
            
        Returns:
            6位股票代码
        """
        return ts_code.split(".")[0]


class TushareDataCollector(DataCollector):
    """Tushare数据采集器实现"""
    
    def __init__(
        self,
        api_token: str,
        max_retries: int = 3,
        retry_delay: float = 1.0,
    ):
        """初始化Tushare数据采集器
        
        Args:
            api_token: Tushare API token
            max_retries: 最大重试次数
            retry_delay: 重试间隔（秒）
        """
        super().__init__(
            max_retries=max_retries,
            retry_delay=retry_delay,
            source_name="Tushare",
        )
        self.api_token = api_token
        self._api = None
    
    def _get_api(self):
        """获取Tushare API实例（延迟初始化）"""
        if self._api is None:
            try:
                import tushare as ts
                ts.set_token(self.api_token)
                self._api = ts.pro_api()
            except ImportError:
                logger.warning("Tushare not installed, using mock data")
                self._api = MockTushareAPI()
        return self._api
    
    async def fetch_daily_quotes(
        self,
        stock_codes: List[str],
        start_date: str,
        end_date: str,
    ) -> List[StockQuote]:
        """获取日K线数据"""
        quotes = []
        api = self._get_api()
        
        for stock_code in stock_codes:
            result = await self._fetch_with_retry(
                self._fetch_single_stock_quotes,
                stock_code,
                start_date,
                end_date,
                api,
            )
            if result:
                quotes.extend(result)
        
        logger.info(
            f"Fetched {len(quotes)} quotes for {len(stock_codes)} stocks "
            f"from {start_date} to {end_date}"
        )
        return quotes
    
    async def _fetch_single_stock_quotes(
        self,
        stock_code: str,
        start_date: str,
        end_date: str,
        api: Any,
    ) -> List[StockQuote]:
        """获取单只股票的日K线数据"""
        try:
            # 转换日期格式 YYYY-MM-DD -> YYYYMMDD
            start = self._format_date_to_compact(start_date)
            end = self._format_date_to_compact(end_date)
            
            # 调用Tushare API
            df = api.daily(
                ts_code=self._to_sh_sz_code(stock_code),
                start_date=start,
                end_date=end,
            )
            
            if df is None or df.empty:
                return []
            
            quotes = []
            for _, row in df.iterrows():
                quote = StockQuote(
                    stock_code=self._from_sh_sz_code(row["ts_code"]),
                    trade_date=self._format_date_to_dash(row["trade_date"]),
                    open_price=Decimal(str(row["open"])),
                    high_price=Decimal(str(row["high"])),
                    low_price=Decimal(str(row["low"])),
                    close_price=Decimal(str(row["close"])),
                    prev_close=Decimal(str(row.get("pre_close", row["close"]))),
                    volume=int(row["vol"]),
                    amount=Decimal(str(row["amount"] * 1000)),  # Tushare单位是千元
                )
                quotes.append(quote)
            
            return quotes
            
        except Exception as e:
            logger.error(f"Failed to fetch quotes for {stock_code}: {e}")
            raise DataFetchError(
                source="Tushare",
                message=f"获取股票 {stock_code} 行情失败: {e}",
                stock_code=stock_code,
            )
    
    async def fetch_financial_data(
        self,
        stock_code: str,
        period: str,
    ) -> Optional[FinancialReport]:
        """获取财务报表数据"""
        api = self._get_api()
        
        result = await self._fetch_with_retry(
            self._fetch_single_financial_data,
            stock_code,
            period,
            api,
        )
        
        return result
    
    async def _fetch_single_financial_data(
        self,
        stock_code: str,
        period: str,
        api: Any,
    ) -> Optional[FinancialReport]:
        """获取单只股票的财务数据"""
        try:
            ts_code = self._to_sh_sz_code(stock_code)
            
            # 获取资产负债表
            balance_df = api.balancesheet(ts_code=ts_code, period=period)
            
            # 获取利润表
            income_df = api.income(ts_code=ts_code, period=period)
            
            # 获取现金流量表
            cashflow_df = api.cashflow(ts_code=ts_code, period=period)
            
            report = FinancialReport(
                stock_code=stock_code,
                report_date=today_str(),
                period=period,
            )
            
            # 解析资产负债表
            if balance_df is not None and not balance_df.empty:
                row = balance_df.iloc[0]
                report.total_assets = self._safe_decimal(row.get("total_assets"))
                report.total_liabilities = self._safe_decimal(row.get("total_liab"))
                report.total_equity = self._safe_decimal(row.get("total_hldr_eqy_exc_min_int"))
            
            # 解析利润表
            if income_df is not None and not income_df.empty:
                row = income_df.iloc[0]
                report.revenue = self._safe_decimal(row.get("revenue"))
                report.net_profit = self._safe_decimal(row.get("n_income"))
                report.gross_profit = self._safe_decimal(row.get("operate_profit"))
            
            # 解析现金流量表
            if cashflow_df is not None and not cashflow_df.empty:
                row = cashflow_df.iloc[0]
                report.operating_cash_flow = self._safe_decimal(row.get("n_cashflow_act"))
                report.investing_cash_flow = self._safe_decimal(row.get("n_cashflow_inv_act"))
                report.financing_cash_flow = self._safe_decimal(row.get("n_cash_flows_fnc_act"))
            
            return report
            
        except Exception as e:
            logger.error(f"Failed to fetch financial data for {stock_code}: {e}")
            raise DataFetchError(
                source="Tushare",
                message=f"获取股票 {stock_code} 财务数据失败: {e}",
                stock_code=stock_code,
            )
    
    async def sync_stock_list(self) -> List[StockInfo]:
        """同步股票列表"""
        api = self._get_api()
        
        result = await self._fetch_with_retry(
            self._fetch_stock_list,
            api,
        )
        
        return result or []
    
    async def _fetch_stock_list(self, api: Any) -> List[StockInfo]:
        """获取股票列表"""
        try:
            df = api.stock_basic(
                exchange="",
                list_status="L",
                fields="ts_code,name,market,list_date,industry",
            )
            
            if df is None or df.empty:
                return []
            
            stocks = []
            for _, row in df.iterrows():
                stock = StockInfo(
                    stock_code=self._from_sh_sz_code(row["ts_code"]),
                    name=row["name"],
                    market=row["market"],
                    list_date=self._format_date_to_dash(row.get("list_date")),
                    industry=row.get("industry"),
                )
                stocks.append(stock)
            
            return stocks
            
        except Exception as e:
            logger.error(f"Failed to fetch stock list: {e}")
            raise DataFetchError(
                source="Tushare",
                message=f"获取股票列表失败: {e}",
            )
    
class MockTushareAPI:
    """Mock Tushare API for testing without actual API access"""
    
    def daily(self, ts_code: str, start_date: str, end_date: str):
        """Mock daily quotes"""
        import pandas as pd
        return pd.DataFrame()
    
    def balancesheet(self, ts_code: str, period: str):
        """Mock balance sheet"""
        import pandas as pd
        return pd.DataFrame()
    
    def income(self, ts_code: str, period: str):
        """Mock income statement"""
        import pandas as pd
        return pd.DataFrame()
    
    def cashflow(self, ts_code: str, period: str):
        """Mock cash flow statement"""
        import pandas as pd
        return pd.DataFrame()
    
    def stock_basic(self, exchange: str, list_status: str, fields: str):
        """Mock stock list"""
        import pandas as pd
        return pd.DataFrame()


class AKShareDataCollector(DataCollector):
    """AKShare数据采集器实现
    
    使用免费的AKShare库获取A股行情数据
    """
    
    def __init__(
        self,
        max_retries: int = 3,
        retry_delay: float = 1.0,
    ):
        """初始化AKShare数据采集器
        
        Args:
            max_retries: 最大重试次数
            retry_delay: 重试间隔（秒）
        """
        super().__init__(
            max_retries=max_retries,
            retry_delay=retry_delay,
            source_name="AKShare",
        )
        self._ak = None
    
    def _get_ak(self):
        """获取AKShare实例（延迟初始化）"""
        if self._ak is None:
            try:
                import akshare as ak
                self._ak = ak
            except ImportError:
                logger.warning("AKShare not installed, please run: pip install akshare")
                raise DataSourceUnavailableError(
                    source="AKShare",
                    message="AKShare 未安装，请运行: pip install akshare",
                )
        return self._ak
    
    async def fetch_daily_quotes(
        self,
        stock_codes: List[str],
        start_date: str,
        end_date: str,
    ) -> List[StockQuote]:
        """获取日K线数据
        
        优化：先获取所有股票名称，避免重复调用API
        """
        quotes = []
        
        # 先获取所有股票名称映射
        stock_names = await self._get_stock_names_map()
        logger.info(f"获取到 {len(stock_names)} 只股票的名称映射")
        
        total = len(stock_codes)
        for idx, stock_code in enumerate(stock_codes):
            if idx % 100 == 0:
                logger.info(f"同步进度: {idx}/{total} ({idx*100//total}%)")
            
            result = await self._fetch_with_retry(
                self._fetch_single_stock_quotes_with_name,
                stock_code,
                start_date,
                end_date,
                stock_names.get(stock_code),
            )
            if result:
                quotes.extend(result)
        
        logger.info(
            f"AKShare: Fetched {len(quotes)} quotes for {len(stock_codes)} stocks "
            f"from {start_date} to {end_date}"
        )
        return quotes
    
    async def _get_stock_names_map(self) -> dict:
        """获取所有股票代码到名称的映射
        
        Returns:
            {stock_code: stock_name} 字典
        """
        try:
            result = await self._run_sync(self._get_stock_names_map_sync)
            return result
        except Exception as e:
            logger.error(f"获取股票名称映射失败: {e}")
            return {}
    
    def _get_stock_names_map_sync(self) -> dict:
        """同步获取所有股票代码到名称的映射"""
        ak = self._get_ak()
        df = ak.stock_zh_a_spot_em()
        
        if df is None or df.empty:
            return {}
        
        return dict(zip(df["代码"], df["名称"]))
    
    def _fetch_single_stock_quotes_with_name(
        self,
        stock_code: str,
        start_date: str,
        end_date: str,
        stock_name: str = None,
    ) -> List[StockQuote]:
        """获取单只股票的日K线数据（带股票名称）"""
        try:
            ak = self._get_ak()
            
            # 转换日期格式 YYYY-MM-DD -> YYYYMMDD
            start = self._format_date_to_compact(start_date)
            end = self._format_date_to_compact(end_date)
            
            # 获取日K线数据
            df = ak.stock_zh_a_hist(
                symbol=stock_code,
                period="daily",
                start_date=start,
                end_date=end,
                adjust=""  # 不复权
            )
            
            if df is None or df.empty:
                return []
            
            quotes = []
            for _, row in df.iterrows():
                # AKShare返回的列名是中文
                trade_date = str(row.get("日期", ""))
                if not trade_date:
                    continue
                
                quote = StockQuote(
                    stock_code=stock_code,
                    trade_date=trade_date,
                    open_price=Decimal(str(row.get("开盘", 0))),
                    high_price=Decimal(str(row.get("最高", 0))),
                    low_price=Decimal(str(row.get("最低", 0))),
                    close_price=Decimal(str(row.get("收盘", 0))),
                    prev_close=Decimal(str(row.get("收盘", 0))),  # AKShare没有昨收，用收盘代替
                    volume=int(row.get("成交量", 0)),
                    amount=Decimal(str(row.get("成交额", 0))),
                    stock_name=stock_name,
                )
                quotes.append(quote)
            
            return quotes
            
        except DataCollectionError:
            raise
        except Exception as e:
            logger.warning(f"获取股票 {stock_code} 行情失败: {e}")
            return []  # 返回空列表而不是抛出异常，继续处理其他股票
    
    async def fetch_realtime_quotes(
        self,
        stock_codes: List[str],
    ) -> List[StockQuote]:
        """获取实时行情数据"""
        try:
            ak = self._get_ak()
            
            # 获取A股实时行情
            df = ak.stock_zh_a_spot_em()
            
            if df is None or df.empty:
                return []
            
            quotes = []
            today = today_str()
            
            for stock_code in stock_codes:
                # 在数据中查找对应股票
                row = df[df["代码"] == stock_code]
                if row.empty:
                    continue
                
                row = row.iloc[0]
                quote = StockQuote(
                    stock_code=stock_code,
                    trade_date=today,
                    open_price=Decimal(str(row.get("今开", 0) or 0)),
                    high_price=Decimal(str(row.get("最高", 0) or 0)),
                    low_price=Decimal(str(row.get("最低", 0) or 0)),
                    close_price=Decimal(str(row.get("最新价", 0) or 0)),
                    prev_close=Decimal(str(row.get("昨收", 0) or 0)),
                    volume=int(row.get("成交量", 0) or 0),
                    amount=Decimal(str(row.get("成交额", 0) or 0)),
                    stock_name=str(row.get("名称", "")) or None,
                )
                quotes.append(quote)
            
            return quotes
            
        except Exception as e:
            logger.error(f"Failed to fetch realtime quotes: {e}")
            return []
    
    async def fetch_hot_stocks(self, limit: int = 20) -> List[str]:
        """获取热门股票代码列表"""
        try:
            ak = self._get_ak()
            
            # 获取A股实时行情，按成交额排序
            df = ak.stock_zh_a_spot_em()
            
            if df is None or df.empty:
                return []
            
            # 按成交额排序，取前N只
            df = df.sort_values("成交额", ascending=False)
            codes = df["代码"].head(limit).tolist()
            
            return codes
            
        except Exception as e:
            logger.error(f"Failed to fetch hot stocks: {e}")
            return []
    
    async def fetch_financial_data(
        self,
        stock_code: str,
        period: str,
    ) -> Optional[FinancialReport]:
        """获取财务报表数据（简化实现）"""
        # AKShare的财务数据接口较复杂，这里返回None
        return None
    
    async def sync_stock_list(self) -> List[StockInfo]:
        """同步股票列表"""
        try:
            ak = self._get_ak()
            
            # 获取A股股票列表
            df = ak.stock_zh_a_spot_em()
            
            if df is None or df.empty:
                return []
            
            stocks = []
            for _, row in df.iterrows():
                code = row.get("代码", "")
                market = "SH" if code.startswith("6") else "SZ"
                
                stock = StockInfo(
                    stock_code=code,
                    name=row.get("名称", ""),
                    market=market,
                )
                stocks.append(stock)
            
            return stocks
            
        except Exception as e:
            logger.error(f"Failed to fetch stock list: {e}")
            return []
    
def get_data_collector(source: str = "akshare") -> DataCollector:
    """获取数据采集器实例
    
    Args:
        source: 数据源类型 (tushare, akshare)
        
    Returns:
        DataCollector实例
    """
    if source == "tushare":
        from app.core.config import settings
        return TushareDataCollector(api_token=settings.TUSHARE_API_TOKEN)
    elif source == "akshare":
        return AKShareDataCollector()
    else:
        raise ValueError(f"Unknown data source: {source}")
