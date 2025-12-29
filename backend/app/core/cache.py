"""Redis缓存模块

提供统一的缓存接口，支持：
- 用户登录Token缓存
- 股票实时数据缓存
- 通用键值缓存
"""

import json
import logging
from datetime import timedelta
from typing import Any, Optional, TypeVar, Callable
from functools import wraps

import redis
from redis import Redis

from app.core.config import settings

logger = logging.getLogger(__name__)

T = TypeVar("T")

# Redis连接池（单例）
_redis_pool: Optional[redis.ConnectionPool] = None
_redis_client: Optional[Redis] = None


def get_redis_pool() -> redis.ConnectionPool:
    """获取Redis连接池（单例）"""
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = redis.ConnectionPool(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB,
            password=settings.REDIS_PASSWORD or None,
            decode_responses=True,
            max_connections=20,
            socket_timeout=5,
            socket_connect_timeout=5,
        )
    return _redis_pool


def get_redis() -> Redis:
    """获取Redis客户端（单例）"""
    global _redis_client
    if _redis_client is None:
        _redis_client = Redis(connection_pool=get_redis_pool())
    return _redis_client


def close_redis():
    """关闭Redis连接"""
    global _redis_client, _redis_pool
    if _redis_client:
        _redis_client.close()
        _redis_client = None
    if _redis_pool:
        _redis_pool.disconnect()
        _redis_pool = None


# ============ 缓存键前缀 ============

class CacheKeys:
    """缓存键前缀常量"""
    # 用户Token
    TOKEN = "token:"
    # 股票实时行情
    STOCK_QUOTE = "stock:quote:"
    # 股票基本信息
    STOCK_INFO = "stock:info:"
    # K线数据
    STOCK_KLINE = "stock:kline:"
    # 资金流向
    STOCK_CAPITAL_FLOW = "stock:capital_flow:"
    # 资金分布
    STOCK_CAPITAL_DIST = "stock:capital_dist:"
    # 公司简介
    STOCK_PROFILE = "stock:profile:"
    # 股东信息
    STOCK_SHAREHOLDERS = "stock:shareholders:"
    # 股票新闻
    STOCK_NEWS = "stock:news:"
    # 机构评级
    STOCK_RATINGS = "stock:ratings:"
    # 财务指标
    STOCK_FINANCIALS = "stock:financials:"
    # 资产负债表
    STOCK_BALANCE_SHEET = "stock:balance_sheet:"
    # 现金流量表
    STOCK_CASH_FLOW = "stock:cash_flow:"
    # AI分析结果
    STOCK_AI_ANALYSIS = "stock:ai_analysis:"
    # 市场数据
    MARKET_DATA = "market:"


# ============ 缓存TTL配置（秒） ============

class CacheTTL:
    """缓存过期时间配置"""
    # Token: 3天
    TOKEN = 3 * 24 * 60 * 60
    # 实时行情: 30秒（交易时间内频繁更新）
    STOCK_QUOTE = 30
    # 股票基本信息: 1天
    STOCK_INFO = 24 * 60 * 60
    # K线数据: 5分钟
    STOCK_KLINE = 5 * 60
    # 资金流向: 5分钟
    STOCK_CAPITAL_FLOW = 5 * 60
    # 资金分布: 5分钟
    STOCK_CAPITAL_DIST = 5 * 60
    # 公司简介: 1天
    STOCK_PROFILE = 24 * 60 * 60
    # 股东信息: 1小时
    STOCK_SHAREHOLDERS = 60 * 60
    # 股票新闻: 10分钟
    STOCK_NEWS = 10 * 60
    # 机构评级: 1小时
    STOCK_RATINGS = 60 * 60
    # 财务指标: 1小时
    STOCK_FINANCIALS = 60 * 60
    # 资产负债表: 1小时
    STOCK_BALANCE_SHEET = 60 * 60
    # 现金流量表: 1小时
    STOCK_CASH_FLOW = 60 * 60
    # AI分析: 4小时
    STOCK_AI_ANALYSIS = 4 * 60 * 60
    # 市场数据: 5分钟
    MARKET_DATA = 5 * 60


# ============ 缓存服务类 ============

class CacheService:
    """缓存服务"""
    
    def __init__(self):
        self._redis: Optional[Redis] = None
    
    @property
    def redis(self) -> Redis:
        """获取Redis客户端"""
        if self._redis is None:
            self._redis = get_redis()
        return self._redis
    
    def _is_available(self) -> bool:
        """检查Redis是否可用"""
        try:
            self.redis.ping()
            return True
        except Exception as e:
            logger.warning(f"Redis不可用: {e}")
            return False
    
    # ============ 通用方法 ============
    
    def get(self, key: str) -> Optional[str]:
        """获取缓存值"""
        try:
            return self.redis.get(key)
        except Exception as e:
            logger.error(f"Redis GET失败 [{key}]: {e}")
            return None
    
    def set(
        self,
        key: str,
        value: str,
        ttl: Optional[int] = None,
    ) -> bool:
        """设置缓存值"""
        try:
            if ttl:
                self.redis.setex(key, ttl, value)
            else:
                self.redis.set(key, value)
            return True
        except Exception as e:
            logger.error(f"Redis SET失败 [{key}]: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """删除缓存"""
        try:
            self.redis.delete(key)
            return True
        except Exception as e:
            logger.error(f"Redis DELETE失败 [{key}]: {e}")
            return False
    
    def exists(self, key: str) -> bool:
        """检查键是否存在"""
        try:
            return bool(self.redis.exists(key))
        except Exception as e:
            logger.error(f"Redis EXISTS失败 [{key}]: {e}")
            return False
    
    def get_json(self, key: str) -> Optional[Any]:
        """获取JSON缓存"""
        value = self.get(key)
        if value:
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                logger.error(f"JSON解析失败 [{key}]")
        return None
    
    def set_json(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
    ) -> bool:
        """设置JSON缓存"""
        try:
            json_str = json.dumps(value, ensure_ascii=False, default=str)
            return self.set(key, json_str, ttl)
        except Exception as e:
            logger.error(f"JSON序列化失败 [{key}]: {e}")
            return False
    
    def delete_pattern(self, pattern: str) -> int:
        """删除匹配模式的所有键"""
        try:
            keys = self.redis.keys(pattern)
            if keys:
                return self.redis.delete(*keys)
            return 0
        except Exception as e:
            logger.error(f"Redis DELETE PATTERN失败 [{pattern}]: {e}")
            return 0
    
    # ============ Token相关方法 ============
    
    def set_token(self, token: str, user_data: dict, ttl: int = CacheTTL.TOKEN) -> bool:
        """存储Token"""
        key = f"{CacheKeys.TOKEN}{token}"
        return self.set_json(key, user_data, ttl)
    
    def get_token(self, token: str) -> Optional[dict]:
        """获取Token数据"""
        key = f"{CacheKeys.TOKEN}{token}"
        return self.get_json(key)
    
    def refresh_token(self, token: str, ttl: int = CacheTTL.TOKEN) -> bool:
        """刷新Token过期时间"""
        key = f"{CacheKeys.TOKEN}{token}"
        try:
            return bool(self.redis.expire(key, ttl))
        except Exception as e:
            logger.error(f"Token刷新失败: {e}")
            return False
    
    def delete_token(self, token: str) -> bool:
        """删除Token"""
        key = f"{CacheKeys.TOKEN}{token}"
        return self.delete(key)
    
    # ============ 股票数据缓存方法 ============
    
    def get_stock_quote(self, stock_code: str) -> Optional[dict]:
        """获取股票实时行情缓存"""
        key = f"{CacheKeys.STOCK_QUOTE}{stock_code}"
        return self.get_json(key)
    
    def set_stock_quote(self, stock_code: str, data: dict) -> bool:
        """设置股票实时行情缓存"""
        key = f"{CacheKeys.STOCK_QUOTE}{stock_code}"
        return self.set_json(key, data, CacheTTL.STOCK_QUOTE)
    
    def get_stock_info(self, stock_code: str) -> Optional[dict]:
        """获取股票基本信息缓存"""
        key = f"{CacheKeys.STOCK_INFO}{stock_code}"
        return self.get_json(key)
    
    def set_stock_info(self, stock_code: str, data: dict) -> bool:
        """设置股票基本信息缓存"""
        key = f"{CacheKeys.STOCK_INFO}{stock_code}"
        return self.set_json(key, data, CacheTTL.STOCK_INFO)
    
    def get_stock_kline(self, stock_code: str, period: str) -> Optional[list]:
        """获取K线数据缓存"""
        key = f"{CacheKeys.STOCK_KLINE}{stock_code}:{period}"
        return self.get_json(key)
    
    def set_stock_kline(self, stock_code: str, period: str, data: list) -> bool:
        """设置K线数据缓存"""
        key = f"{CacheKeys.STOCK_KLINE}{stock_code}:{period}"
        return self.set_json(key, data, CacheTTL.STOCK_KLINE)
    
    def get_capital_flow(self, stock_code: str) -> Optional[list]:
        """获取资金流向缓存"""
        key = f"{CacheKeys.STOCK_CAPITAL_FLOW}{stock_code}"
        return self.get_json(key)
    
    def set_capital_flow(self, stock_code: str, data: list) -> bool:
        """设置资金流向缓存"""
        key = f"{CacheKeys.STOCK_CAPITAL_FLOW}{stock_code}"
        return self.set_json(key, data, CacheTTL.STOCK_CAPITAL_FLOW)
    
    def get_capital_distribution(self, stock_code: str) -> Optional[dict]:
        """获取资金分布缓存"""
        key = f"{CacheKeys.STOCK_CAPITAL_DIST}{stock_code}"
        return self.get_json(key)
    
    def set_capital_distribution(self, stock_code: str, data: dict) -> bool:
        """设置资金分布缓存"""
        key = f"{CacheKeys.STOCK_CAPITAL_DIST}{stock_code}"
        return self.set_json(key, data, CacheTTL.STOCK_CAPITAL_DIST)
    
    def get_company_profile(self, stock_code: str) -> Optional[dict]:
        """获取公司简介缓存"""
        key = f"{CacheKeys.STOCK_PROFILE}{stock_code}"
        return self.get_json(key)
    
    def set_company_profile(self, stock_code: str, data: dict) -> bool:
        """设置公司简介缓存"""
        key = f"{CacheKeys.STOCK_PROFILE}{stock_code}"
        return self.set_json(key, data, CacheTTL.STOCK_PROFILE)
    
    def get_shareholders(self, stock_code: str) -> Optional[list]:
        """获取股东信息缓存"""
        key = f"{CacheKeys.STOCK_SHAREHOLDERS}{stock_code}"
        return self.get_json(key)
    
    def set_shareholders(self, stock_code: str, data: list) -> bool:
        """设置股东信息缓存"""
        key = f"{CacheKeys.STOCK_SHAREHOLDERS}{stock_code}"
        return self.set_json(key, data, CacheTTL.STOCK_SHAREHOLDERS)
    
    def get_stock_news(self, stock_code: str, page: int = 1) -> Optional[list]:
        """获取股票新闻缓存"""
        key = f"{CacheKeys.STOCK_NEWS}{stock_code}:{page}"
        return self.get_json(key)
    
    def set_stock_news(self, stock_code: str, page: int, data: list) -> bool:
        """设置股票新闻缓存"""
        key = f"{CacheKeys.STOCK_NEWS}{stock_code}:{page}"
        return self.set_json(key, data, CacheTTL.STOCK_NEWS)
    
    def get_analyst_ratings(self, stock_code: str) -> Optional[list]:
        """获取机构评级缓存"""
        key = f"{CacheKeys.STOCK_RATINGS}{stock_code}"
        return self.get_json(key)
    
    def set_analyst_ratings(self, stock_code: str, data: list) -> bool:
        """设置机构评级缓存"""
        key = f"{CacheKeys.STOCK_RATINGS}{stock_code}"
        return self.set_json(key, data, CacheTTL.STOCK_RATINGS)
    
    def get_financials(self, stock_code: str, report_type: str) -> Optional[list]:
        """获取财务指标缓存"""
        key = f"{CacheKeys.STOCK_FINANCIALS}{stock_code}:{report_type}"
        return self.get_json(key)
    
    def set_financials(self, stock_code: str, report_type: str, data: list) -> bool:
        """设置财务指标缓存"""
        key = f"{CacheKeys.STOCK_FINANCIALS}{stock_code}:{report_type}"
        return self.set_json(key, data, CacheTTL.STOCK_FINANCIALS)
    
    def get_balance_sheet(self, stock_code: str) -> Optional[list]:
        """获取资产负债表缓存"""
        key = f"{CacheKeys.STOCK_BALANCE_SHEET}{stock_code}"
        return self.get_json(key)
    
    def set_balance_sheet(self, stock_code: str, data: list) -> bool:
        """设置资产负债表缓存"""
        key = f"{CacheKeys.STOCK_BALANCE_SHEET}{stock_code}"
        return self.set_json(key, data, CacheTTL.STOCK_BALANCE_SHEET)
    
    def get_cash_flow(self, stock_code: str) -> Optional[list]:
        """获取现金流量表缓存"""
        key = f"{CacheKeys.STOCK_CASH_FLOW}{stock_code}"
        return self.get_json(key)
    
    def set_cash_flow(self, stock_code: str, data: list) -> bool:
        """设置现金流量表缓存"""
        key = f"{CacheKeys.STOCK_CASH_FLOW}{stock_code}"
        return self.set_json(key, data, CacheTTL.STOCK_CASH_FLOW)
    
    def get_ai_analysis(self, stock_code: str) -> Optional[dict]:
        """获取AI分析缓存"""
        key = f"{CacheKeys.STOCK_AI_ANALYSIS}{stock_code}"
        return self.get_json(key)
    
    def set_ai_analysis(self, stock_code: str, data: dict) -> bool:
        """设置AI分析缓存"""
        key = f"{CacheKeys.STOCK_AI_ANALYSIS}{stock_code}"
        return self.set_json(key, data, CacheTTL.STOCK_AI_ANALYSIS)
    
    # ============ 市场数据缓存 ============
    
    def get_market_data(self, data_type: str) -> Optional[Any]:
        """获取市场数据缓存"""
        key = f"{CacheKeys.MARKET_DATA}{data_type}"
        return self.get_json(key)
    
    def set_market_data(self, data_type: str, data: Any) -> bool:
        """设置市场数据缓存"""
        key = f"{CacheKeys.MARKET_DATA}{data_type}"
        return self.set_json(key, data, CacheTTL.MARKET_DATA)


# 全局缓存服务实例
cache_service = CacheService()


# ============ 缓存装饰器 ============

def cached(
    key_prefix: str,
    ttl: int,
    key_builder: Optional[Callable[..., str]] = None,
):
    """
    缓存装饰器
    
    Args:
        key_prefix: 缓存键前缀
        ttl: 过期时间（秒）
        key_builder: 自定义键构建函数，接收函数参数，返回键后缀
    
    Usage:
        @cached("stock:quote:", ttl=30, key_builder=lambda stock_code: stock_code)
        async def get_stock_quote(stock_code: str):
            ...
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            # 构建缓存键
            if key_builder:
                key_suffix = key_builder(*args, **kwargs)
            else:
                # 默认使用所有参数构建键
                key_parts = [str(a) for a in args] + [f"{k}={v}" for k, v in sorted(kwargs.items())]
                key_suffix = ":".join(key_parts)
            
            cache_key = f"{key_prefix}{key_suffix}"
            
            # 尝试从缓存获取
            cached_value = cache_service.get_json(cache_key)
            if cached_value is not None:
                logger.debug(f"缓存命中: {cache_key}")
                return cached_value
            
            # 调用原函数
            result = await func(*args, **kwargs)
            
            # 存入缓存
            if result is not None:
                cache_service.set_json(cache_key, result, ttl)
                logger.debug(f"缓存写入: {cache_key}")
            
            return result
        
        return wrapper
    return decorator
