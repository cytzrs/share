"""
任务服务模块

提供系统任务的创建、更新、删除、暂停/恢复等管理功能。

实现需求:
- 1.5: 创建任务并将其添加到调度器
- 3.1, 3.2: 支持多种任务类型（agent_decision, quote_sync, market_refresh）
- 3.3: 暂停/恢复任务的调度执行
- 4.2, 4.3: 删除任务（保留日志）
- 7.2: 任务配置变更持久化到数据库
"""

import logging
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.models import SystemTaskModel, SystemTaskLogModel
from app.models.enums import TaskStatus, TaskLogStatus, TaskType
from app.core.cron_utils import (
    validate_cron_expression,
    describe_cron_expression,
    get_next_run_time,
    CronValidationError,
)
from app.core.scheduler import get_scheduler
from app.core.timezone import now

logger = logging.getLogger(__name__)


class TaskServiceError(Exception):
    """任务服务错误基类"""
    pass


class TaskNotFoundError(TaskServiceError):
    """任务不存在错误"""
    pass


class TaskValidationError(TaskServiceError):
    """任务验证错误"""
    pass


class TaskService:
    """
    任务服务类
    
    提供系统任务的CRUD操作和调度管理功能。
    支持多种任务类型：
    - agent_decision: Agent决策任务
    - quote_sync: 行情同步任务
    - market_refresh: 市场数据刷新任务
    """
    
    def __init__(self, db: Session):
        """
        初始化任务服务
        
        Args:
            db: 数据库会话
        """
        self.db = db
    
    def create_task(
        self,
        name: str,
        cron_expression: str,
        agent_ids: List[str] = None,
        trading_day_only: bool = False,
        task_type: str = "agent_decision",
        config: Dict[str, Any] = None,
    ) -> SystemTaskModel:
        """
        创建任务并添加到调度器
        
        Args:
            name: 任务名称
            cron_expression: Cron表达式
            agent_ids: Agent ID列表，默认为["all"]（仅对 agent_decision 类型有效）
            trading_day_only: 是否仅交易日运行
            task_type: 任务类型（agent_decision, quote_sync, market_refresh）
            config: 任务配置（JSON格式）
            
        Returns:
            SystemTaskModel: 创建的任务模型
            
        Raises:
            TaskValidationError: 当验证失败时
        """
        # 验证Cron表达式
        is_valid, error = validate_cron_expression(cron_expression)
        if not is_valid:
            raise TaskValidationError(f"无效的Cron表达式: {error}")
        
        # 验证任务名称
        if not name or not name.strip():
            raise TaskValidationError("任务名称不能为空")
        
        # 检查任务名称是否重复
        existing = self.db.query(SystemTaskModel).filter(
            SystemTaskModel.name == name.strip()
        ).first()
        if existing:
            raise TaskValidationError(f"任务名称已存在: {name}")
        
        # 创建任务
        task_id = str(uuid.uuid4())
        task = SystemTaskModel(
            task_id=task_id,
            name=name.strip(),
            cron_expression=cron_expression.strip(),
            task_type=task_type,
            agent_ids=agent_ids or ["all"],
            config=config,
            trading_day_only=1 if trading_day_only else 0,
            status=TaskStatus.ACTIVE.value,
        )
        
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        
        # 添加到调度器
        self._add_to_scheduler(task)
        
        logger.info(f"任务创建成功: {task.name} (ID: {task.task_id}, Type: {task_type})")
        return task
    
    def update_task(
        self,
        task_id: str,
        name: Optional[str] = None,
        cron_expression: Optional[str] = None,
        agent_ids: Optional[List[str]] = None,
        trading_day_only: Optional[bool] = None,
        task_type: Optional[str] = None,
        config: Optional[Dict[str, Any]] = None,
    ) -> SystemTaskModel:
        """
        更新任务配置
        
        Args:
            task_id: 任务ID
            name: 新的任务名称
            cron_expression: 新的Cron表达式
            agent_ids: 新的Agent ID列表
            trading_day_only: 是否仅交易日运行
            task_type: 任务类型
            config: 任务配置
            
        Returns:
            SystemTaskModel: 更新后的任务模型
            
        Raises:
            TaskNotFoundError: 当任务不存在时
            TaskValidationError: 当验证失败时
        """
        task = self._get_task(task_id)
        
        # 更新名称
        if name is not None:
            if not name.strip():
                raise TaskValidationError("任务名称不能为空")
            # 检查名称是否与其他任务重复
            existing = self.db.query(SystemTaskModel).filter(
                SystemTaskModel.name == name.strip(),
                SystemTaskModel.task_id != task_id
            ).first()
            if existing:
                raise TaskValidationError(f"任务名称已存在: {name}")
            task.name = name.strip()
        
        # 更新Cron表达式
        if cron_expression is not None:
            is_valid, error = validate_cron_expression(cron_expression)
            if not is_valid:
                raise TaskValidationError(f"无效的Cron表达式: {error}")
            task.cron_expression = cron_expression.strip()
        
        # 更新其他字段
        if agent_ids is not None:
            task.agent_ids = agent_ids
        if trading_day_only is not None:
            task.trading_day_only = 1 if trading_day_only else 0
        if task_type is not None:
            task.task_type = task_type
        if config is not None:
            task.config = config
        
        self.db.commit()
        self.db.refresh(task)
        
        # 如果任务是活跃状态，更新调度器
        if task.status == TaskStatus.ACTIVE.value:
            self._remove_from_scheduler(task_id)
            self._add_to_scheduler(task)
        
        logger.info(f"任务更新成功: {task.name} (ID: {task.task_id})")
        return task
    
    def delete_task(self, task_id: str) -> bool:
        """
        删除任务（保留日志）
        
        Args:
            task_id: 任务ID
            
        Returns:
            bool: 是否删除成功
            
        Raises:
            TaskNotFoundError: 当任务不存在时
        """
        task = self._get_task(task_id)
        
        # 从调度器中移除
        self._remove_from_scheduler(task_id)
        
        # 删除任务记录（日志通过外键SET NULL保留）
        task_name = task.name
        self.db.delete(task)
        self.db.commit()
        
        logger.info(f"任务删除成功: {task_name} (ID: {task_id})")
        return True
    
    def pause_task(self, task_id: str) -> SystemTaskModel:
        """
        暂停任务
        
        Args:
            task_id: 任务ID
            
        Returns:
            SystemTaskModel: 更新后的任务模型
            
        Raises:
            TaskNotFoundError: 当任务不存在时
        """
        task = self._get_task(task_id)
        
        if task.status == TaskStatus.PAUSED.value:
            logger.info(f"任务已经是暂停状态: {task.name}")
            return task
        
        task.status = TaskStatus.PAUSED.value
        self.db.commit()
        self.db.refresh(task)
        
        # 从调度器中暂停
        self._pause_in_scheduler(task_id)
        
        logger.info(f"任务暂停成功: {task.name} (ID: {task.task_id})")
        return task
    
    def resume_task(self, task_id: str) -> SystemTaskModel:
        """
        恢复任务
        
        Args:
            task_id: 任务ID
            
        Returns:
            SystemTaskModel: 更新后的任务模型
            
        Raises:
            TaskNotFoundError: 当任务不存在时
        """
        task = self._get_task(task_id)
        
        if task.status == TaskStatus.ACTIVE.value:
            logger.info(f"任务已经是活跃状态: {task.name}")
            return task
        
        task.status = TaskStatus.ACTIVE.value
        self.db.commit()
        self.db.refresh(task)
        
        # 在调度器中恢复（重新添加）
        self._remove_from_scheduler(task_id)
        self._add_to_scheduler(task)
        
        logger.info(f"任务恢复成功: {task.name} (ID: {task.task_id})")
        return task
    
    def get_task(self, task_id: str) -> SystemTaskModel:
        """
        获取任务
        
        Args:
            task_id: 任务ID
            
        Returns:
            SystemTaskModel: 任务模型
            
        Raises:
            TaskNotFoundError: 当任务不存在时
        """
        return self._get_task(task_id)
    
    def list_tasks(self) -> List[SystemTaskModel]:
        """
        获取所有任务列表
        
        Returns:
            List[SystemTaskModel]: 任务列表
        """
        return self.db.query(SystemTaskModel).order_by(
            SystemTaskModel.created_at.desc()
        ).all()
    
    def get_task_stats(self, task_id: str) -> Dict[str, int]:
        """
        获取任务统计信息
        
        Args:
            task_id: 任务ID
            
        Returns:
            Dict[str, int]: 包含success_count和fail_count的字典
        """
        # 统计成功次数
        success_count = self.db.query(func.count(SystemTaskLogModel.log_id)).filter(
            SystemTaskLogModel.task_id == task_id,
            SystemTaskLogModel.status == TaskLogStatus.SUCCESS.value
        ).scalar() or 0
        
        # 统计失败次数
        fail_count = self.db.query(func.count(SystemTaskLogModel.log_id)).filter(
            SystemTaskLogModel.task_id == task_id,
            SystemTaskLogModel.status == TaskLogStatus.FAILED.value
        ).scalar() or 0
        
        return {
            "success_count": success_count,
            "fail_count": fail_count,
        }
    
    def get_task_with_stats(self, task_id: str) -> Dict[str, Any]:
        """
        获取任务及其统计信息
        
        Args:
            task_id: 任务ID
            
        Returns:
            Dict[str, Any]: 包含任务信息和统计的字典
        """
        task = self._get_task(task_id)
        stats = self.get_task_stats(task_id)
        
        # 获取下次执行时间
        next_run_time = None
        if task.status == TaskStatus.ACTIVE.value:
            next_run_time = get_next_run_time(task.cron_expression)
        
        # 获取Cron描述
        try:
            cron_description = describe_cron_expression(task.cron_expression)
        except CronValidationError:
            cron_description = task.cron_expression
        
        return {
            "task_id": task.task_id,
            "name": task.name,
            "task_type": task.task_type,
            "cron_expression": task.cron_expression,
            "cron_description": cron_description,
            "agent_ids": task.agent_ids,
            "config": task.config,
            "trading_day_only": bool(task.trading_day_only),
            "status": task.status,
            "next_run_time": next_run_time.isoformat() if next_run_time else None,
            "success_count": stats["success_count"],
            "fail_count": stats["fail_count"],
            "created_at": task.created_at.isoformat() if task.created_at else None,
        }
    
    def list_tasks_with_stats(self) -> List[Dict[str, Any]]:
        """
        获取所有任务及其统计信息
        
        Returns:
            List[Dict[str, Any]]: 任务列表（包含统计信息）
        """
        tasks = self.list_tasks()
        result = []
        
        for task in tasks:
            stats = self.get_task_stats(task.task_id)
            
            # 获取下次执行时间
            next_run_time = None
            if task.status == TaskStatus.ACTIVE.value:
                next_run_time = get_next_run_time(task.cron_expression)
            
            # 获取Cron描述
            try:
                cron_description = describe_cron_expression(task.cron_expression)
            except CronValidationError:
                cron_description = task.cron_expression
                
            result.append({
                "task_id": task.task_id,
                "name": task.name,
                "task_type": task.task_type,
                "cron_expression": task.cron_expression,
                "cron_description": cron_description,
                "agent_ids": task.agent_ids,
                "config": task.config,
                "trading_day_only": bool(task.trading_day_only),
                "status": task.status,
                "next_run_time": next_run_time.isoformat() if next_run_time else None,
                "success_count": stats["success_count"],
                "fail_count": stats["fail_count"],
                "created_at": task.created_at.isoformat() if task.created_at else None,
            })
        
        return result
    
    def get_logs_count(self, task_id: str) -> int:
        """
        获取任务日志总数
        
        Args:
            task_id: 任务ID
            
        Returns:
            int: 日志总数
        """
        return self.db.query(func.count(SystemTaskLogModel.log_id)).filter(
            SystemTaskLogModel.task_id == task_id
        ).scalar() or 0
    
    def _get_task(self, task_id: str) -> SystemTaskModel:
        """
        获取任务（内部方法）
        
        Args:
            task_id: 任务ID
            
        Returns:
            SystemTaskModel: 任务模型
            
        Raises:
            TaskNotFoundError: 当任务不存在时
        """
        task = self.db.query(SystemTaskModel).filter(
            SystemTaskModel.task_id == task_id
        ).first()
        
        if not task:
            raise TaskNotFoundError(f"任务不存在: {task_id}")
        
        return task
    
    def _add_to_scheduler(self, task: SystemTaskModel) -> None:
        """
        将任务添加到调度器
        
        Args:
            task: 任务模型
        """
        try:
            from apscheduler.triggers.cron import CronTrigger
            from app.core.task_executor import TaskExecutor
            
            scheduler = get_scheduler()
            if not scheduler.is_running:
                logger.warning("调度器未运行，跳过添加任务到调度器")
                return
            
            job_id = f"system_task_{task.task_id}"
            
            # 创建Cron触发器
            trigger = CronTrigger.from_crontab(
                task.cron_expression,
                timezone="Asia/Shanghai"
            )
            
            # 添加任务到调度器
            scheduler._scheduler.add_job(
                func=self._create_task_executor_callback(task.task_id),
                trigger=trigger,
                id=job_id,
                name=f"System Task: {task.name}",
                replace_existing=True,
            )
            
            logger.info(f"任务已添加到调度器: {task.name} (Job ID: {job_id})")
        except Exception as e:
            logger.error(f"添加任务到调度器失败: {e}")
    
    def _remove_from_scheduler(self, task_id: str) -> None:
        """
        从调度器中移除任务
        
        Args:
            task_id: 任务ID
        """
        try:
            scheduler = get_scheduler()
            if not scheduler.is_running:
                return
            
            job_id = f"system_task_{task_id}"
            job = scheduler._scheduler.get_job(job_id)
            
            if job:
                scheduler._scheduler.remove_job(job_id)
                logger.info(f"任务已从调度器移除: {job_id}")
        except Exception as e:
            logger.error(f"从调度器移除任务失败: {e}")
    
    def _pause_in_scheduler(self, task_id: str) -> None:
        """
        在调度器中暂停任务
        
        Args:
            task_id: 任务ID
        """
        try:
            scheduler = get_scheduler()
            if not scheduler.is_running:
                return
            
            job_id = f"system_task_{task_id}"
            job = scheduler._scheduler.get_job(job_id)
            
            if job:
                scheduler._scheduler.pause_job(job_id)
                logger.info(f"任务已在调度器中暂停: {job_id}")
        except Exception as e:
            logger.error(f"在调度器中暂停任务失败: {e}")
    
    def _create_task_executor_callback(self, task_id: str):
        """
        创建任务执行回调函数

        Args:
            task_id: 任务ID

        Returns:
            Callable: 回调函数
        """
        async def execute_task():
            from app.db.session import SessionLocal
            from app.core.task_executor import TaskExecutor
            from app.api.agents import trigger_agent_decision
            
            db = SessionLocal()
            try:
                executor = TaskExecutor(db)
                
                # 设置决策回调函数
                async def decision_callback(agent_id: str):
                    return await trigger_agent_decision(agent_id, db)
                
                executor.set_decision_callback(decision_callback)
                await executor.execute_task(task_id)
            finally:
                db.close()
        
        return execute_task
