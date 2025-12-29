"""任务管理API"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth import require_admin
from app.db.session import get_db
from app.services.task_service import (
    TaskService,
    TaskNotFoundError,
    TaskValidationError,
)
from app.api.schemas import (
    TaskCreate,
    TaskUpdate,
    TaskResponse,
    TaskListResponse,
    TaskLogSummary,
    TaskLogDetail,
    TaskLogListResponse,
    AgentExecutionResult,
)
from app.core.cron_utils import describe_cron_expression, get_next_run_time, CronValidationError
from app.db.models import SystemTaskLogModel

logger = logging.getLogger(__name__)

router = APIRouter()


# ============== Cron表达式验证API ==============

class CronValidateRequest(BaseModel):
    """Cron表达式验证请求"""
    cron_expression: str = Field(..., description="Cron表达式")


class CronValidateResponse(BaseModel):
    """Cron表达式验证响应"""
    valid: bool = Field(..., description="是否有效")
    description: str = Field(default="", description="人性化描述")
    error: Optional[str] = Field(default=None, description="错误信息")
    next_run_time: Optional[str] = Field(default=None, description="下次执行时间")


@router.post("/cron/validate", response_model=CronValidateResponse)
async def validate_cron(request: CronValidateRequest):
    """验证Cron表达式并返回人性化描述"""
    from app.core.cron_utils import validate_cron_expression
    
    cron_expr = request.cron_expression.strip()
    
    is_valid, error = validate_cron_expression(cron_expr)
    
    if not is_valid:
        return CronValidateResponse(
            valid=False,
            description="",
            error=error,
            next_run_time=None,
        )
    
    try:
        description = describe_cron_expression(cron_expr)
    except CronValidationError as e:
        description = str(e)
    
    next_time = get_next_run_time(cron_expr)
    next_run_time = next_time.isoformat() if next_time else None
    
    return CronValidateResponse(
        valid=True,
        description=description,
        error=None,
        next_run_time=next_run_time,
    )


# ============== 任务管理API ==============

@router.get("", response_model=TaskListResponse)
async def list_tasks(db: Session = Depends(get_db)):
    """获取任务列表"""
    task_service = TaskService(db)
    tasks_data = task_service.list_tasks_with_stats()
    
    tasks = [
        TaskResponse(
            task_id=t["task_id"],
            name=t["name"],
            task_type=t["task_type"],
            cron_expression=t["cron_expression"],
            cron_description=t["cron_description"],
            agent_ids=t["agent_ids"],
            config=t.get("config"),
            trading_day_only=t["trading_day_only"],
            status=t["status"],
            next_run_time=t["next_run_time"],
            success_count=t["success_count"],
            fail_count=t["fail_count"],
            created_at=t["created_at"],
        )
        for t in tasks_data
    ]
    
    return TaskListResponse(tasks=tasks, total=len(tasks))


@router.post("", response_model=TaskResponse)
async def create_task(
    task: TaskCreate,
    db: Session = Depends(get_db),
    _admin: bool = Depends(require_admin),
):
    """创建任务"""
    task_service = TaskService(db)
    
    try:
        created_task = task_service.create_task(
            name=task.name,
            cron_expression=task.cron_expression,
            agent_ids=task.agent_ids,
            trading_day_only=task.trading_day_only,
            task_type=task.task_type,
            config=task.config,
        )
        
        task_data = task_service.get_task_with_stats(created_task.task_id)
        
        return TaskResponse(
            task_id=task_data["task_id"],
            name=task_data["name"],
            task_type=task_data["task_type"],
            cron_expression=task_data["cron_expression"],
            cron_description=task_data["cron_description"],
            agent_ids=task_data["agent_ids"],
            config=task_data.get("config"),
            trading_day_only=task_data["trading_day_only"],
            status=task_data["status"],
            next_run_time=task_data["next_run_time"],
            success_count=task_data["success_count"],
            fail_count=task_data["fail_count"],
            created_at=task_data["created_at"],
        )
    except TaskValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    task: TaskUpdate,
    db: Session = Depends(get_db),
    _admin: bool = Depends(require_admin),
):
    """更新任务"""
    task_service = TaskService(db)
    
    try:
        updated_task = task_service.update_task(
            task_id=task_id,
            name=task.name,
            cron_expression=task.cron_expression,
            agent_ids=task.agent_ids,
            trading_day_only=task.trading_day_only,
            task_type=task.task_type,
            config=task.config,
        )
        
        task_data = task_service.get_task_with_stats(updated_task.task_id)
        
        return TaskResponse(
            task_id=task_data["task_id"],
            name=task_data["name"],
            task_type=task_data["task_type"],
            cron_expression=task_data["cron_expression"],
            cron_description=task_data["cron_description"],
            agent_ids=task_data["agent_ids"],
            config=task_data.get("config"),
            trading_day_only=task_data["trading_day_only"],
            status=task_data["status"],
            next_run_time=task_data["next_run_time"],
            success_count=task_data["success_count"],
            fail_count=task_data["fail_count"],
            created_at=task_data["created_at"],
        )
    except TaskNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except TaskValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{task_id}")
async def delete_task(
    task_id: str,
    db: Session = Depends(get_db),
    _admin: bool = Depends(require_admin),
):
    """删除任务"""
    task_service = TaskService(db)
    
    try:
        task_service.delete_task(task_id)
        return {"success": True, "message": "任务删除成功"}
    except TaskNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{task_id}/pause")
async def pause_task(
    task_id: str,
    db: Session = Depends(get_db),
    _admin: bool = Depends(require_admin),
):
    """暂停任务"""
    task_service = TaskService(db)
    
    try:
        task_service.pause_task(task_id)
        task_data = task_service.get_task_with_stats(task_id)
        
        return TaskResponse(
            task_id=task_data["task_id"],
            name=task_data["name"],
            task_type=task_data["task_type"],
            cron_expression=task_data["cron_expression"],
            cron_description=task_data["cron_description"],
            agent_ids=task_data["agent_ids"],
            config=task_data.get("config"),
            trading_day_only=task_data["trading_day_only"],
            status=task_data["status"],
            next_run_time=task_data["next_run_time"],
            success_count=task_data["success_count"],
            fail_count=task_data["fail_count"],
            created_at=task_data["created_at"],
        )
    except TaskNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{task_id}/resume")
async def resume_task(
    task_id: str,
    db: Session = Depends(get_db),
    _admin: bool = Depends(require_admin),
):
    """恢复任务"""
    task_service = TaskService(db)
    
    try:
        task_service.resume_task(task_id)
        task_data = task_service.get_task_with_stats(task_id)
        
        return TaskResponse(
            task_id=task_data["task_id"],
            name=task_data["name"],
            task_type=task_data["task_type"],
            cron_expression=task_data["cron_expression"],
            cron_description=task_data["cron_description"],
            agent_ids=task_data["agent_ids"],
            config=task_data.get("config"),
            trading_day_only=task_data["trading_day_only"],
            status=task_data["status"],
            next_run_time=task_data["next_run_time"],
            success_count=task_data["success_count"],
            fail_count=task_data["fail_count"],
            created_at=task_data["created_at"],
        )
    except TaskNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{task_id}/trigger")
async def trigger_task(
    task_id: str,
    db: Session = Depends(get_db),
    _admin: bool = Depends(require_admin),
):
    """手动触发任务"""
    from app.core.task_executor import TaskExecutor
    from app.ai.agent_manager import ModelAgentManager
    
    task_service = TaskService(db)
    
    try:
        task = task_service.get_task(task_id)
    except TaskNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    
    # 创建执行器并设置回调
    executor = TaskExecutor(db)
    
    async def decision_callback(agent_id: str):
        agent_manager = ModelAgentManager(db)
        return await agent_manager.trigger_decision(agent_id)
    
    executor.set_decision_callback(decision_callback)
    
    # 执行任务 - execute_task 内部会处理异常并记录日志
    log = await executor.execute_task(task_id)
    
    # 根据日志状态返回结果
    success = log.status in ("success", "skipped")
    message = "任务触发成功" if success else f"任务执行失败: {log.error_message or '未知错误'}"
    
    return {
        "success": success,
        "message": message,
        "log_id": log.log_id,
        "status": log.status,
    }


# ============== 任务日志API ==============

@router.get("/{task_id}/logs", response_model=TaskLogListResponse)
async def get_task_logs(
    task_id: str,
    page: int = Query(default=1, ge=1, description="页码"),
    page_size: int = Query(default=20, ge=1, le=100, description="每页数量"),
    db: Session = Depends(get_db),
):
    """获取任务日志列表"""
    from sqlalchemy import func
    
    total = db.query(func.count(SystemTaskLogModel.log_id)).filter(
        SystemTaskLogModel.task_id == task_id
    ).scalar() or 0
    
    offset = (page - 1) * page_size
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1
    
    logs = db.query(SystemTaskLogModel).filter(
        SystemTaskLogModel.task_id == task_id
    ).order_by(
        SystemTaskLogModel.started_at.desc()
    ).offset(offset).limit(page_size).all()
    
    log_summaries = []
    for log in logs:
        duration_ms = None
        if log.started_at and log.completed_at:
            duration_ms = int((log.completed_at - log.started_at).total_seconds() * 1000)
        
        agent_success_count = 0
        agent_fail_count = 0
        if log.agent_results:
            for result in log.agent_results:
                if result.get("status") == "success":
                    agent_success_count += 1
                elif result.get("status") == "failed":
                    agent_fail_count += 1
        
        log_summaries.append(TaskLogSummary(
            log_id=log.log_id,
            started_at=log.started_at.isoformat() if log.started_at else None,
            completed_at=log.completed_at.isoformat() if log.completed_at else None,
            status=log.status,
            duration_ms=duration_ms,
            agent_success_count=agent_success_count,
            agent_fail_count=agent_fail_count,
        ))
    
    return TaskLogListResponse(
        logs=log_summaries,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{task_id}/logs/{log_id}", response_model=TaskLogDetail)
async def get_task_log_detail(
    task_id: str,
    log_id: int,
    db: Session = Depends(get_db),
):
    """获取任务日志详情"""
    from app.db.models import ModelAgentModel
    
    log = db.query(SystemTaskLogModel).filter(
        SystemTaskLogModel.log_id == log_id,
        SystemTaskLogModel.task_id == task_id
    ).first()
    
    if not log:
        raise HTTPException(status_code=404, detail="日志不存在")
    
    duration_ms = None
    if log.started_at and log.completed_at:
        duration_ms = int((log.completed_at - log.started_at).total_seconds() * 1000)
    
    agent_results = []
    if log.agent_results:
        agent_ids = [r.get("agent_id") for r in log.agent_results if r.get("agent_id")]
        agents = db.query(ModelAgentModel).filter(
            ModelAgentModel.agent_id.in_(agent_ids)
        ).all() if agent_ids else []
        agent_name_map = {a.agent_id: a.name for a in agents}
        
        for result in log.agent_results:
            agent_id = result.get("agent_id", "")
            agent_name = result.get("agent_name") or agent_name_map.get(agent_id, "未知Agent")
            
            agent_results.append(AgentExecutionResult(
                agent_id=agent_id,
                agent_name=agent_name,
                status=result.get("status", "unknown"),
                started_at=result.get("started_at"),
                completed_at=result.get("completed_at"),
                duration_ms=result.get("duration_ms"),
                error_message=result.get("error_message"),
            ))
    
    return TaskLogDetail(
        log_id=log.log_id,
        task_id=log.task_id or task_id,
        started_at=log.started_at.isoformat() if log.started_at else None,
        completed_at=log.completed_at.isoformat() if log.completed_at else None,
        status=log.status,
        duration_ms=duration_ms,
        skip_reason=log.skip_reason,
        error_message=log.error_message,
        agent_results=agent_results,
    )
