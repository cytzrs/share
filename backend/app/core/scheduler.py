"""
调度系统 - 定时触发AI决策任务

实现Requirements 13.1-13.5:
- 支持配置"每日一次"、"每小时一次"等决策周期
- 到达配置的决策时间点时触发对应Model_Agent的决策流程
- 支持为不同Model_Agent配置不同的决策周期
- 记录每次调度的执行时间和结果状态
- 调度任务执行失败时记录错误并按配置决定是否重试
- 支持多线程并发执行多个Agent的决策任务
"""

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, time
from enum import Enum
from typing import Any, Callable, Dict, List, Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.jobstores.memory import MemoryJobStore
from apscheduler.executors.asyncio import AsyncIOExecutor
from apscheduler.executors.pool import ThreadPoolExecutor as APSThreadPoolExecutor

from app.core.config import settings
from app.models.enums import ScheduleType


logger = logging.getLogger(__name__)


def is_trading_hours() -> bool:
    """
    检查当前是否在A股交易时段内
    
    Returns:
        bool: 是否在交易时段内
    """
    now = datetime.now()
    current_time = now.time()
    current_weekday = now.weekday()
    
    logger.info(f"交易时段检查 - 当前时间: {now.strftime('%Y-%m-%d %H:%M:%S')}, 星期: {current_weekday}")
    
    # 检查是否是交易日（周一至周五）
    if current_weekday >= 5:  # 5=周六, 6=周日
        logger.info(f"当前是周末 ({now.strftime('%Y-%m-%d %A')})，跳过任务执行")
        return False
    
    # 检查是否在交易时间内
    morning_start = time(9, 21)
    morning_end = time(11, 30)
    afternoon_start = time(13, 0)
    afternoon_end = time(15, 0)
    
    logger.info(f"交易时段范围 - 上午: {morning_start.strftime('%H:%M')}-{morning_end.strftime('%H:%M')}, 下午: {afternoon_start.strftime('%H:%M')}-{afternoon_end.strftime('%H:%M')}")
    
    is_morning_trading = morning_start <= current_time <= morning_end
    is_afternoon_trading = afternoon_start <= current_time <= afternoon_end
    
    logger.info(f"交易时段检查结果 - 上午: {is_morning_trading}, 下午: {is_afternoon_trading}")
    
    if not (is_morning_trading or is_afternoon_trading):
        logger.info(f"当前不在交易时段内 ({current_time.strftime('%H:%M:%S')})，跳过任务执行")
        return False
    
    logger.info(f"当前在交易时段内 ({current_time.strftime('%H:%M:%S')})，执行任务")
    return True


class ScheduleStatus(str, Enum):
    """调度状态"""
    SCHEDULED = "scheduled"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"


@dataclass
class ScheduleConfig:
    """调度配置"""
    schedule_type: ScheduleType
    enabled: bool = True
    max_retries: int = 3
    retry_delay: float = 60.0  # 秒
    # 自定义cron表达式（可选）
    cron_expression: Optional[str] = None
    # 每日执行时间（仅对daily类型有效）
    daily_hour: int = 9
    daily_minute: int = 35


@dataclass
class ScheduleRecord:
    """调度执行记录"""
    agent_id: str
    job_id: str
    scheduled_time: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    status: ScheduleStatus = ScheduleStatus.SCHEDULED
    retry_count: int = 0
    error_message: Optional[str] = None
    result: Optional[Dict[str, Any]] = None


@dataclass
class ScheduleStatusInfo:
    """调度状态信息"""
    agent_id: str
    job_id: str
    schedule_type: str
    next_run_time: Optional[datetime]
    is_enabled: bool
    last_execution: Optional[ScheduleRecord] = None


class Scheduler:
    """
    调度器
    
    负责按配置周期触发AI决策任务。
    使用APScheduler实现定时调度功能。
    支持多线程并发执行多个Agent的决策任务。
    """
    
    def __init__(
        self,
        decision_callback: Optional[Callable[[str], Any]] = None,
        timezone: str = "Asia/Shanghai",
        max_workers: int = 5,
    ):
        """
        初始化调度器
        
        Args:
            decision_callback: 决策回调函数，接收agent_id参数
            timezone: 时区
            max_workers: 最大并发工作线程数
        """
        self._decision_callback = decision_callback
        self._timezone = timezone
        self._max_workers = max_workers
        
        # 配置APScheduler
        jobstores = {
            'default': MemoryJobStore()
        }
        executors = {
            'default': AsyncIOExecutor(),
            'threadpool': APSThreadPoolExecutor(max_workers=max_workers),
        }
        job_defaults = {
            'coalesce': True,  # 合并错过的执行
            'max_instances': max_workers,  # 允许多个实例并发运行
            'misfire_grace_time': 60 * 5,  # 5分钟的容错时间
        }
        
        self._scheduler = AsyncIOScheduler(
            jobstores=jobstores,
            executors=executors,
            job_defaults=job_defaults,
            timezone=timezone,
        )
        
        # Agent调度配置
        self._agent_configs: Dict[str, ScheduleConfig] = {}
        
        # 执行记录
        self._execution_records: Dict[str, List[ScheduleRecord]] = {}
        
        # 运行状态
        self._is_running = False
        
        # 线程池用于并发执行
        self._thread_pool = ThreadPoolExecutor(max_workers=max_workers)
    
    def start(self) -> None:
        """启动调度器"""
        if not self._is_running:
            self._scheduler.start()
            self._is_running = True
            logger.info("调度器已启动")
    
    def shutdown(self, wait: bool = True) -> None:
        """关闭调度器"""
        if self._is_running:
            self._scheduler.shutdown(wait=wait)
            self._thread_pool.shutdown(wait=wait)
            self._is_running = False
            logger.info("调度器已关闭")
    
    @property
    def is_running(self) -> bool:
        """调度器是否运行中"""
        return self._is_running
    
    def set_decision_callback(self, callback: Callable[[str], Any]) -> None:
        """设置决策回调函数"""
        self._decision_callback = callback
    
    def schedule_agent(
        self,
        agent_id: str,
        config: ScheduleConfig,
    ) -> str:
        """
        为Agent配置调度
        
        Args:
            agent_id: Agent ID
            config: 调度配置
            
        Returns:
            str: Job ID
        """
        job_id = f"agent_{agent_id}"
        
        # 如果已存在，先移除
        if self._scheduler.get_job(job_id):
            self._scheduler.remove_job(job_id)
        
        # 保存配置
        self._agent_configs[agent_id] = config
        
        if not config.enabled:
            logger.info(f"Agent {agent_id} 调度已禁用")
            return job_id
        
        # 创建触发器
        trigger = self._create_trigger(config)
        
        # 添加任务
        self._scheduler.add_job(
            func=self._execute_decision,
            trigger=trigger,
            args=[agent_id],
            id=job_id,
            name=f"Decision for Agent {agent_id}",
            replace_existing=True,
        )
        
        next_run = self._scheduler.get_job(job_id).next_run_time
        logger.info(
            f"Agent {agent_id} 已配置调度: {config.schedule_type.value}, "
            f"下次执行: {next_run}"
        )
        
        return job_id
    
    def unschedule_agent(self, agent_id: str) -> bool:
        """
        取消Agent的调度
        
        Args:
            agent_id: Agent ID
            
        Returns:
            bool: 是否成功
        """
        job_id = f"agent_{agent_id}"
        
        if self._scheduler.get_job(job_id):
            self._scheduler.remove_job(job_id)
            self._agent_configs.pop(agent_id, None)
            logger.info(f"Agent {agent_id} 调度已取消")
            return True
        
        return False
    
    def pause_agent(self, agent_id: str) -> bool:
        """暂停Agent的调度"""
        job_id = f"agent_{agent_id}"
        job = self._scheduler.get_job(job_id)
        
        if job:
            self._scheduler.pause_job(job_id)
            logger.info(f"Agent {agent_id} 调度已暂停")
            return True
        
        return False
    
    def resume_agent(self, agent_id: str) -> bool:
        """恢复Agent的调度"""
        job_id = f"agent_{agent_id}"
        job = self._scheduler.get_job(job_id)
        
        if job:
            self._scheduler.resume_job(job_id)
            logger.info(f"Agent {agent_id} 调度已恢复")
            return True
        
        return False
    
    async def trigger_decision(self, agent_id: str) -> ScheduleRecord:
        """
        手动触发决策
        
        Args:
            agent_id: Agent ID
            
        Returns:
            ScheduleRecord: 执行记录
        """
        logger.info(f"手动触发Agent {agent_id} 决策")
        return await self._execute_decision(agent_id, is_manual=True)
    
    async def trigger_all_decisions(self, agent_ids: List[str]) -> List[ScheduleRecord]:
        """
        并发触发多个Agent的决策
        
        Args:
            agent_ids: Agent ID列表
            
        Returns:
            List[ScheduleRecord]: 执行记录列表
        """
        logger.info(f"批量触发 {len(agent_ids)} 个Agent决策")
        
        # 使用asyncio.gather并发执行所有决策
        tasks = [
            self._execute_decision(agent_id, is_manual=True)
            for agent_id in agent_ids
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 处理结果
        records = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                # 创建失败记录
                record = ScheduleRecord(
                    agent_id=agent_ids[i],
                    job_id=f"agent_{agent_ids[i]}",
                    scheduled_time=datetime.now(),
                    started_at=datetime.now(),
                    completed_at=datetime.now(),
                    status=ScheduleStatus.FAILED,
                    error_message=str(result),
                )
                records.append(record)
            else:
                records.append(result)
        
        success_count = sum(1 for r in records if r.status == ScheduleStatus.COMPLETED)
        logger.info(f"批量触发完成: {success_count}/{len(agent_ids)} 成功")
        
        return records
    
    def get_schedule_status(self, agent_id: Optional[str] = None) -> List[ScheduleStatusInfo]:
        """
        获取调度状态
        
        Args:
            agent_id: 可选，指定Agent ID
            
        Returns:
            List[ScheduleStatusInfo]: 调度状态列表
        """
        result = []
        
        if agent_id:
            agent_ids = [agent_id]
        else:
            agent_ids = list(self._agent_configs.keys())
        
        for aid in agent_ids:
            job_id = f"agent_{aid}"
            job = self._scheduler.get_job(job_id)
            config = self._agent_configs.get(aid)
            
            # 获取最后执行记录
            records = self._execution_records.get(aid, [])
            last_execution = records[-1] if records else None
            
            status_info = ScheduleStatusInfo(
                agent_id=aid,
                job_id=job_id,
                schedule_type=config.schedule_type.value if config else "unknown",
                next_run_time=job.next_run_time if job else None,
                is_enabled=config.enabled if config else False,
                last_execution=last_execution,
            )
            result.append(status_info)
        
        return result
    
    def get_execution_history(
        self,
        agent_id: str,
        limit: int = 10,
    ) -> List[ScheduleRecord]:
        """
        获取执行历史
        
        Args:
            agent_id: Agent ID
            limit: 返回记录数量限制
            
        Returns:
            List[ScheduleRecord]: 执行记录列表
        """
        records = self._execution_records.get(agent_id, [])
        return records[-limit:]
    
    def _create_trigger(self, config: ScheduleConfig):
        """创建APScheduler触发器"""
        if config.cron_expression:
            return CronTrigger.from_crontab(
                config.cron_expression,
                timezone=self._timezone,
            )
        
        if config.schedule_type == ScheduleType.DAILY:
            # 每日执行，默认9:35（开盘后5分钟）
            return CronTrigger(
                hour=config.daily_hour,
                minute=config.daily_minute,
                timezone=self._timezone,
            )
        
        elif config.schedule_type == ScheduleType.HOURLY:
            # 每小时执行
            return IntervalTrigger(hours=1)
        
        elif config.schedule_type == ScheduleType.EVERY_30_MIN:
            # 每30分钟执行
            return IntervalTrigger(minutes=30)
        
        elif config.schedule_type == ScheduleType.EVERY_15_MIN:
            # 每15分钟执行
            return IntervalTrigger(minutes=15)
        
        else:
            # 默认每日执行
            return CronTrigger(
                hour=config.daily_hour,
                minute=config.daily_minute,
                timezone=self._timezone,
            )
    
    async def _execute_decision(
        self,
        agent_id: str,
        is_manual: bool = False,
    ) -> ScheduleRecord:
        """
        执行决策任务

        Args:
            agent_id: Agent ID
            is_manual: 是否手动触发

        Returns:
            ScheduleRecord: 执行记录
        """
        job_id = f"agent_{agent_id}"
        now = datetime.now()
        
        # 创建执行记录
        record = ScheduleRecord(
            agent_id=agent_id,
            job_id=job_id,
            scheduled_time=now,
            started_at=now,
            status=ScheduleStatus.RUNNING,
        )
        
        # 初始化记录列表
        if agent_id not in self._execution_records:
            self._execution_records[agent_id] = []
        
        config = self._agent_configs.get(agent_id)
        max_retries = config.max_retries if config else settings.SCHEDULER_MAX_RETRIES
        retry_delay = config.retry_delay if config else settings.SCHEDULER_RETRY_DELAY
        
        try:
            # 检查是否在交易时段内（仅自动触发时检查）
            if not is_manual and not is_trading_hours():
                # 更新记录为跳过状态
                record.completed_at = datetime.now()
                record.status = ScheduleStatus.COMPLETED
                record.result = {"success": True, "skipped": True, "reason": "非交易时段"}
                
                logger.info(
                    f"Agent {agent_id} 决策任务因非交易时段被跳过, "
                    f"耗时: {(record.completed_at - record.started_at).total_seconds():.2f}s"
                )
                
                # 保存记录
                self._execution_records[agent_id].append(record)
                
                # 限制记录数量
                if len(self._execution_records[agent_id]) > 100:
                    self._execution_records[agent_id] = self._execution_records[agent_id][-100:]
                
                return record
            
            if self._decision_callback is None:
                # 尝试使用默认的决策回调实现
                from app.db.session import SessionLocal
                from app.api.agents import trigger_agent_decision
                
                db = SessionLocal()
                try:
                    result = await trigger_agent_decision(agent_id, db)
                finally:
                    db.close()
            else:
                # 执行决策回调
                result = await self._call_decision_callback(agent_id)
            
            # 更新记录
            record.completed_at = datetime.now()
            record.status = ScheduleStatus.COMPLETED
            record.result = result if isinstance(result, dict) else {"success": True}
            
            logger.info(
                f"Agent {agent_id} 决策执行成功, "
                f"耗时: {(record.completed_at - record.started_at).total_seconds():.2f}s"
            )
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Agent {agent_id} 决策执行失败: {error_msg}")
            
            # 重试逻辑
            if record.retry_count < max_retries and not is_manual:
                record.retry_count += 1
                record.status = ScheduleStatus.RETRYING
                record.error_message = f"第{record.retry_count}次重试: {error_msg}"
                
                logger.info(
                    f"Agent {agent_id} 将在 {retry_delay}s 后重试 "
                    f"({record.retry_count}/{max_retries})"
                )
                
                # 延迟后重试
                await asyncio.sleep(retry_delay)
                return await self._execute_decision(agent_id, is_manual)
            else:
                record.completed_at = datetime.now()
                record.status = ScheduleStatus.FAILED
                record.error_message = error_msg
        
        # 保存记录
        self._execution_records[agent_id].append(record)
        
        # 限制记录数量
        if len(self._execution_records[agent_id]) > 100:
            self._execution_records[agent_id] = self._execution_records[agent_id][-100:]
        
        return record
    
    async def _call_decision_callback(self, agent_id: str) -> Any:
        """调用决策回调函数"""
        if self._decision_callback is None:
            # 尝试使用默认的决策回调实现
            from app.db.session import SessionLocal
            from app.api.agents import trigger_agent_decision
            
            db = SessionLocal()
            try:
                return await trigger_agent_decision(agent_id, db)
            finally:
                db.close()
        
        result = self._decision_callback(agent_id)
        
        # 如果是协程，等待执行
        if asyncio.iscoroutine(result):
            result = await result
        
        return result


# 全局调度器实例
_scheduler_instance: Optional[Scheduler] = None


def get_scheduler() -> Scheduler:
    """获取全局调度器实例"""
    global _scheduler_instance
    if _scheduler_instance is None:
        _scheduler_instance = Scheduler(
            timezone=settings.SCHEDULER_TIMEZONE,
        )
    return _scheduler_instance


def init_scheduler(decision_callback: Callable[[str], Any]) -> Scheduler:
    """
    初始化并启动调度器
    
    Args:
        decision_callback: 决策回调函数
        
    Returns:
        Scheduler: 调度器实例
    """
    scheduler = get_scheduler()
    scheduler.set_decision_callback(decision_callback)
    
    if settings.SCHEDULER_ENABLED and not scheduler.is_running:
        scheduler.start()
    
    return scheduler


def shutdown_scheduler() -> None:
    """关闭调度器"""
    global _scheduler_instance
    if _scheduler_instance is not None:
        _scheduler_instance.shutdown()
        _scheduler_instance = None
