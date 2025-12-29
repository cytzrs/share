"""数据采集日志和错误处理"""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
import functools
import time
import asyncio

logger = logging.getLogger(__name__)


class CollectionStatus(str, Enum):
    """采集状态"""
    SUCCESS = "success"
    PARTIAL = "partial"  # 部分成功
    FAILED = "failed"
    RETRYING = "retrying"


@dataclass
class CollectionLog:
    """采集日志记录"""
    task_id: str
    task_type: str  # 'daily_quotes', 'financial_data', 'sentiment'
    stock_codes: List[str]
    start_time: datetime
    end_time: Optional[datetime] = None
    status: CollectionStatus = CollectionStatus.SUCCESS
    records_count: int = 0
    error_count: int = 0
    errors: List[Dict[str, Any]] = field(default_factory=list)
    retry_count: int = 0
    
    @property
    def duration_seconds(self) -> float:
        """采集耗时（秒）"""
        if self.end_time:
            return (self.end_time - self.start_time).total_seconds()
        return 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "task_id": self.task_id,
            "task_type": self.task_type,
            "stock_codes": self.stock_codes,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "status": self.status.value,
            "records_count": self.records_count,
            "error_count": self.error_count,
            "errors": self.errors,
            "retry_count": self.retry_count,
            "duration_seconds": self.duration_seconds,
        }


class CollectionLogger:
    """采集日志记录器"""
    
    def __init__(self):
        self._logs: List[CollectionLog] = []
    
    def start_collection(
        self,
        task_id: str,
        task_type: str,
        stock_codes: List[str],
    ) -> CollectionLog:
        """开始采集任务
        
        Args:
            task_id: 任务ID
            task_type: 任务类型
            stock_codes: 股票代码列表
            
        Returns:
            采集日志对象
        """
        log = CollectionLog(
            task_id=task_id,
            task_type=task_type,
            stock_codes=stock_codes,
            start_time=datetime.now(),
        )
        self._logs.append(log)
        
        logger.info(
            f"Collection started: task_id={task_id}, type={task_type}, "
            f"stocks={len(stock_codes)}"
        )
        
        return log
    
    def complete_collection(
        self,
        log: CollectionLog,
        records_count: int,
        status: CollectionStatus = CollectionStatus.SUCCESS,
    ) -> None:
        """完成采集任务
        
        Args:
            log: 采集日志对象
            records_count: 采集记录数
            status: 采集状态
        """
        log.end_time = datetime.now()
        log.records_count = records_count
        log.status = status
        
        logger.info(
            f"Collection completed: task_id={log.task_id}, "
            f"status={status.value}, records={records_count}, "
            f"errors={log.error_count}, duration={log.duration_seconds:.2f}s"
        )
    
    def log_error(
        self,
        log: CollectionLog,
        stock_code: str,
        error: Exception,
        context: Optional[Dict[str, Any]] = None,
    ) -> None:
        """记录采集错误
        
        Args:
            log: 采集日志对象
            stock_code: 股票代码
            error: 异常对象
            context: 额外上下文信息
        """
        error_info = {
            "stock_code": stock_code,
            "error_type": type(error).__name__,
            "error_message": str(error),
            "timestamp": datetime.now().isoformat(),
            "context": context or {},
        }
        
        log.errors.append(error_info)
        log.error_count += 1
        
        logger.error(
            f"Collection error: task_id={log.task_id}, stock={stock_code}, "
            f"error={type(error).__name__}: {error}"
        )
    
    def log_retry(
        self,
        log: CollectionLog,
        attempt: int,
        max_attempts: int,
        delay: float,
    ) -> None:
        """记录重试
        
        Args:
            log: 采集日志对象
            attempt: 当前尝试次数
            max_attempts: 最大尝试次数
            delay: 重试延迟（秒）
        """
        log.retry_count += 1
        log.status = CollectionStatus.RETRYING
        
        logger.warning(
            f"Collection retry: task_id={log.task_id}, "
            f"attempt={attempt}/{max_attempts}, delay={delay}s"
        )
    
    def get_logs(
        self,
        task_type: Optional[str] = None,
        status: Optional[CollectionStatus] = None,
        limit: int = 100,
    ) -> List[CollectionLog]:
        """获取采集日志
        
        Args:
            task_type: 任务类型过滤
            status: 状态过滤
            limit: 返回数量限制
            
        Returns:
            采集日志列表
        """
        logs = self._logs
        
        if task_type:
            logs = [l for l in logs if l.task_type == task_type]
        
        if status:
            logs = [l for l in logs if l.status == status]
        
        return logs[-limit:]


def with_retry(
    max_retries: int = 3,
    retry_delay: float = 1.0,
    exponential_backoff: bool = True,
    exceptions: tuple = (Exception,),
):
    """重试装饰器
    
    Args:
        max_retries: 最大重试次数
        retry_delay: 初始重试延迟（秒）
        exponential_backoff: 是否使用指数退避
        exceptions: 需要重试的异常类型
    """
    def decorator(func):
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            last_error = None
            
            for attempt in range(max_retries):
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    last_error = e
                    
                    if attempt < max_retries - 1:
                        delay = retry_delay * (2 ** attempt if exponential_backoff else 1)
                        logger.warning(
                            f"Retry {attempt + 1}/{max_retries} for {func.__name__}: "
                            f"{type(e).__name__}: {e}, waiting {delay}s"
                        )
                        await asyncio.sleep(delay)
                    else:
                        logger.error(
                            f"All {max_retries} retries failed for {func.__name__}: "
                            f"{type(e).__name__}: {e}"
                        )
            
            raise last_error
        
        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            last_error = None
            
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_error = e
                    
                    if attempt < max_retries - 1:
                        delay = retry_delay * (2 ** attempt if exponential_backoff else 1)
                        logger.warning(
                            f"Retry {attempt + 1}/{max_retries} for {func.__name__}: "
                            f"{type(e).__name__}: {e}, waiting {delay}s"
                        )
                        time.sleep(delay)
                    else:
                        logger.error(
                            f"All {max_retries} retries failed for {func.__name__}: "
                            f"{type(e).__name__}: {e}"
                        )
            
            raise last_error
        
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    
    return decorator


class DataCollectionError(Exception):
    """数据采集错误基类"""
    
    def __init__(
        self,
        message: str,
        stock_code: Optional[str] = None,
        original_error: Optional[Exception] = None,
    ):
        super().__init__(message)
        self.stock_code = stock_code
        self.original_error = original_error


class APIConnectionError(DataCollectionError):
    """API连接错误"""
    pass


class APIRateLimitError(DataCollectionError):
    """API限流错误"""
    pass


class DataParseError(DataCollectionError):
    """数据解析错误"""
    pass


class DataValidationError(DataCollectionError):
    """数据验证错误"""
    pass


# 全局日志记录器实例
collection_logger = CollectionLogger()
