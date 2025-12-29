"""LLM渠道管理API路由"""

import uuid
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.db.session import get_db
from app.db.models import LLMProviderModel, LLMRequestLogModel, ModelAgentModel
from app.models.entities import LLMProvider
from app.models.enums import LLMProtocol
from app.ai.llm_client import MultiProtocolLLMClient
from app.api.schemas import ErrorResponse
from app.core.auth import require_admin

router = APIRouter()


# ============== 请求/响应模型 ==============

class LLMProviderCreate(BaseModel):
    """创建LLM渠道请求"""
    name: str = Field(..., min_length=1, max_length=100, description="渠道名称")
    protocol: str = Field(..., description="协议类型: openai, anthropic, gemini")
    api_url: str = Field(..., min_length=1, description="API地址")
    api_key: str = Field(..., min_length=1, description="API密钥")


class LLMProviderUpdate(BaseModel):
    """更新LLM渠道请求"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    protocol: Optional[str] = None
    api_url: Optional[str] = None
    api_key: Optional[str] = None
    is_active: Optional[bool] = None


class LLMProviderResponse(BaseModel):
    """LLM渠道响应"""
    provider_id: str
    name: str
    protocol: str
    api_url: str
    api_key_masked: str  # 脱敏后的API Key
    is_active: bool
    log_count: int = 0  # 日志数量
    created_at: datetime
    updated_at: datetime


class LLMModelResponse(BaseModel):
    """LLM模型响应"""
    id: str
    name: str


class LLMProviderListResponse(BaseModel):
    """LLM渠道列表响应"""
    providers: List[LLMProviderResponse]
    total: int


class LLMRequestLogResponse(BaseModel):
    """LLM请求日志响应"""
    id: int
    provider_id: str
    provider_name: Optional[str] = None
    model_name: str
    agent_id: Optional[str]
    agent_name: Optional[str]
    request_content: str
    response_content: Optional[str]
    duration_ms: int
    status: str
    error_message: Optional[str]
    tokens_input: Optional[int]
    tokens_output: Optional[int]
    request_time: datetime


class LLMRequestLogListResponse(BaseModel):
    """LLM请求日志列表响应"""
    logs: List[LLMRequestLogResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ============== 辅助函数 ==============

def mask_api_key(api_key: str) -> str:
    """脱敏API Key，只显示前4位和后4位"""
    if len(api_key) <= 8:
        return "*" * len(api_key)
    return api_key[:4] + "*" * (len(api_key) - 8) + api_key[-4:]


def _model_to_response(model: LLMProviderModel, log_count: int = 0) -> LLMProviderResponse:
    """将数据库模型转换为响应"""
    return LLMProviderResponse(
        provider_id=model.provider_id,
        name=model.name,
        protocol=model.protocol,
        api_url=model.api_url,
        api_key_masked=mask_api_key(model.api_key),
        is_active=bool(model.is_active),
        log_count=log_count,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


# ============== API端点 ==============

@router.get(
    "",
    response_model=LLMProviderListResponse,
    summary="获取所有LLM渠道",
)
async def list_providers(
    db: Session = Depends(get_db),
):
    """获取所有LLM渠道配置"""
    from sqlalchemy import func
    
    providers = db.query(LLMProviderModel).order_by(LLMProviderModel.created_at.desc()).all()
    
    # 查询每个渠道的日志数量
    log_counts = db.query(
        LLMRequestLogModel.provider_id,
        func.count(LLMRequestLogModel.id).label('count')
    ).group_by(LLMRequestLogModel.provider_id).all()
    
    log_count_map = {lc.provider_id: lc.count for lc in log_counts}
    
    return LLMProviderListResponse(
        providers=[_model_to_response(p, log_count_map.get(p.provider_id, 0)) for p in providers],
        total=len(providers),
    )


@router.post(
    "",
    response_model=LLMProviderResponse,
    status_code=201,
    summary="创建LLM渠道",
)
async def create_provider(
    request: LLMProviderCreate,
    db: Session = Depends(get_db),
    _admin: bool = Depends(require_admin),
):
    """创建新的LLM渠道配置"""
    # 验证协议类型
    try:
        protocol = LLMProtocol(request.protocol)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail={
                "error_code": "INVALID_PROTOCOL",
                "message": f"无效的协议类型: {request.protocol}，支持: openai, anthropic, gemini",
            }
        )
    
    provider_id = str(uuid.uuid4())
    now = datetime.now()
    
    model = LLMProviderModel(
        provider_id=provider_id,
        name=request.name,
        protocol=request.protocol,
        api_url=request.api_url.rstrip("/"),
        api_key=request.api_key,
        is_active=1,
        created_at=now,
        updated_at=now,
    )
    
    db.add(model)
    db.commit()
    db.refresh(model)
    
    return _model_to_response(model)


@router.get(
    "/{provider_id}",
    response_model=LLMProviderResponse,
    summary="获取LLM渠道详情",
)
async def get_provider(
    provider_id: str,
    db: Session = Depends(get_db),
):
    """获取指定LLM渠道的详细信息"""
    model = db.query(LLMProviderModel).filter(
        LLMProviderModel.provider_id == provider_id
    ).first()
    
    if model is None:
        raise HTTPException(
            status_code=404,
            detail={"error_code": "PROVIDER_NOT_FOUND", "message": f"渠道不存在: {provider_id}"}
        )
    
    return _model_to_response(model)


@router.put(
    "/{provider_id}",
    response_model=LLMProviderResponse,
    summary="更新LLM渠道",
)
async def update_provider(
    provider_id: str,
    request: LLMProviderUpdate,
    db: Session = Depends(get_db),
    _admin: bool = Depends(require_admin),
):
    """更新LLM渠道配置"""
    model = db.query(LLMProviderModel).filter(
        LLMProviderModel.provider_id == provider_id
    ).first()
    
    if model is None:
        raise HTTPException(
            status_code=404,
            detail={"error_code": "PROVIDER_NOT_FOUND", "message": f"渠道不存在: {provider_id}"}
        )
    
    # 验证协议类型
    if request.protocol is not None:
        try:
            LLMProtocol(request.protocol)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail={
                    "error_code": "INVALID_PROTOCOL",
                    "message": f"无效的协议类型: {request.protocol}",
                }
            )
        model.protocol = request.protocol
    
    if request.name is not None:
        model.name = request.name
    if request.api_url is not None:
        model.api_url = request.api_url.rstrip("/")
    if request.api_key is not None:
        model.api_key = request.api_key
    if request.is_active is not None:
        old_is_active = model.is_active
        model.is_active = 1 if request.is_active else 0
        
        # 如果从启用变为停用，暂停所有关联的Agent
        if old_is_active and not request.is_active:
            agents = db.query(ModelAgentModel).filter(
                ModelAgentModel.provider_id == provider_id,
                ModelAgentModel.status == 'active'
            ).all()
            for agent in agents:
                agent.status = 'paused'
            if agents:
                db.flush()
    
    model.updated_at = datetime.now()
    db.commit()
    db.refresh(model)
    
    # 返回被暂停的Agent数量
    paused_count = 0
    if request.is_active is not None and not request.is_active:
        paused_count = db.query(ModelAgentModel).filter(
            ModelAgentModel.provider_id == provider_id,
            ModelAgentModel.status == 'paused'
        ).count()
    
    response = _model_to_response(model)
    return response


@router.delete(
    "/{provider_id}",
    status_code=204,
    summary="删除LLM渠道",
)
async def delete_provider(
    provider_id: str,
    db: Session = Depends(get_db),
    _admin: bool = Depends(require_admin),
):
    """删除LLM渠道配置"""
    model = db.query(LLMProviderModel).filter(
        LLMProviderModel.provider_id == provider_id
    ).first()
    
    if model is None:
        raise HTTPException(
            status_code=404,
            detail={"error_code": "PROVIDER_NOT_FOUND", "message": f"渠道不存在: {provider_id}"}
        )
    
    db.delete(model)
    db.commit()
    return None


@router.get(
    "/{provider_id}/models",
    response_model=List[LLMModelResponse],
    summary="获取渠道可用模型列表",
)
async def list_models(
    provider_id: str,
    db: Session = Depends(get_db),
):
    """获取指定渠道的可用模型列表"""
    model = db.query(LLMProviderModel).filter(
        LLMProviderModel.provider_id == provider_id
    ).first()
    
    if model is None:
        raise HTTPException(
            status_code=404,
            detail={"error_code": "PROVIDER_NOT_FOUND", "message": f"渠道不存在: {provider_id}"}
        )
    
    try:
        client = MultiProtocolLLMClient(
            protocol=LLMProtocol(model.protocol),
            api_base=model.api_url,
            api_key=model.api_key,
        )
        models = await client.list_models()
        return [LLMModelResponse(id=m["id"], name=m.get("name", m["id"])) for m in models]
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": "MODEL_LIST_FAILED",
                "message": f"获取模型列表失败: {str(e)}",
            }
        )


@router.post(
    "/{provider_id}/test",
    summary="测试LLM渠道连接",
)
async def test_provider(
    provider_id: str,
    db: Session = Depends(get_db),
):
    """测试LLM渠道连接是否正常"""
    model = db.query(LLMProviderModel).filter(
        LLMProviderModel.provider_id == provider_id
    ).first()
    
    if model is None:
        raise HTTPException(
            status_code=404,
            detail={"error_code": "PROVIDER_NOT_FOUND", "message": f"渠道不存在: {provider_id}"}
        )
    
    try:
        client = MultiProtocolLLMClient(
            protocol=LLMProtocol(model.protocol),
            api_base=model.api_url,
            api_key=model.api_key,
        )
        # 尝试获取模型列表来测试连接
        models = await client.list_models()
        return {
            "success": True,
            "message": "连接成功",
            "models_count": len(models),
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"连接失败: {str(e)}",
        }


@router.get(
    "/logs/all",
    response_model=LLMRequestLogListResponse,
    summary="获取所有接口日志",
    description="获取所有LLM接口调用日志，支持多种筛选条件",
)
async def list_all_logs(
    page: int = 1,
    page_size: int = 20,
    provider_id: Optional[str] = None,
    model_name: Optional[str] = None,
    agent_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """获取所有接口日志，支持按渠道、模型、Agent、状态筛选"""
    from sqlalchemy import func
    
    # 构建查询
    query = db.query(LLMRequestLogModel)
    
    # 应用筛选条件
    if provider_id:
        query = query.filter(LLMRequestLogModel.provider_id == provider_id)
    if model_name:
        query = query.filter(LLMRequestLogModel.model_name.like(f"%{model_name}%"))
    if agent_id:
        query = query.filter(LLMRequestLogModel.agent_id == agent_id)
    if status:
        query = query.filter(LLMRequestLogModel.status == status)
    
    # 查询总数
    total = query.count()
    
    # 分页查询
    offset = (page - 1) * page_size
    logs = query.order_by(
        LLMRequestLogModel.request_time.desc()
    ).offset(offset).limit(page_size).all()
    
    # 获取所有相关的 agent 信息
    agent_ids = [log.agent_id for log in logs if log.agent_id]
    agents_map = {}
    if agent_ids:
        agents = db.query(ModelAgentModel).filter(
            ModelAgentModel.agent_id.in_(agent_ids)
        ).all()
        agents_map = {a.agent_id: a.name for a in agents}
    
    # 获取所有相关的渠道信息
    provider_ids = list(set([log.provider_id for log in logs if log.provider_id]))
    providers_map = {}
    if provider_ids:
        providers = db.query(LLMProviderModel).filter(
            LLMProviderModel.provider_id.in_(provider_ids)
        ).all()
        providers_map = {p.provider_id: p.name for p in providers}
    
    # 构建响应
    log_responses = []
    for log in logs:
        log_responses.append(LLMRequestLogResponse(
            id=log.id,
            provider_id=log.provider_id,
            provider_name=providers_map.get(log.provider_id),
            model_name=log.model_name,
            agent_id=log.agent_id,
            agent_name=agents_map.get(log.agent_id) if log.agent_id else None,
            request_content=log.request_content,
            response_content=log.response_content,
            duration_ms=log.duration_ms,
            status=log.status,
            error_message=log.error_message,
            tokens_input=log.tokens_input,
            tokens_output=log.tokens_output,
            request_time=log.request_time,
        ))
    
    total_pages = (total + page_size - 1) // page_size
    
    return LLMRequestLogListResponse(
        logs=log_responses,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get(
    "/{provider_id}/logs",
    response_model=LLMRequestLogListResponse,
    summary="获取渠道请求日志",
)
async def list_provider_logs(
    provider_id: str,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
):
    """获取指定渠道的请求日志，按时间倒序排列"""
    # 验证渠道存在
    provider = db.query(LLMProviderModel).filter(
        LLMProviderModel.provider_id == provider_id
    ).first()
    
    if provider is None:
        raise HTTPException(
            status_code=404,
            detail={"error_code": "PROVIDER_NOT_FOUND", "message": f"渠道不存在: {provider_id}"}
        )
    
    # 查询总数
    total = db.query(LLMRequestLogModel).filter(
        LLMRequestLogModel.provider_id == provider_id
    ).count()
    
    # 分页查询
    offset = (page - 1) * page_size
    logs = db.query(LLMRequestLogModel).filter(
        LLMRequestLogModel.provider_id == provider_id
    ).order_by(
        LLMRequestLogModel.request_time.desc()
    ).offset(offset).limit(page_size).all()
    
    # 获取所有相关的 agent 信息
    agent_ids = [log.agent_id for log in logs if log.agent_id]
    agents_map = {}
    if agent_ids:
        agents = db.query(ModelAgentModel).filter(
            ModelAgentModel.agent_id.in_(agent_ids)
        ).all()
        agents_map = {a.agent_id: a.name for a in agents}
    
    # 构建响应
    log_responses = []
    for log in logs:
        log_responses.append(LLMRequestLogResponse(
            id=log.id,
            provider_id=log.provider_id,
            provider_name=provider.name,
            model_name=log.model_name,
            agent_id=log.agent_id,
            agent_name=agents_map.get(log.agent_id) if log.agent_id else None,
            request_content=log.request_content,
            response_content=log.response_content,
            duration_ms=log.duration_ms,
            status=log.status,
            error_message=log.error_message,
            tokens_input=log.tokens_input,
            tokens_output=log.tokens_output,
            request_time=log.request_time,
        ))
    
    total_pages = (total + page_size - 1) // page_size
    
    return LLMRequestLogListResponse(
        logs=log_responses,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get(
    "/stats/overview",
    summary="获取接口统计概览",
    description="获取接口耗时排行和渠道调用排行",
)
async def get_stats_overview(
    db: Session = Depends(get_db),
):
    """获取接口统计数据，包括耗时排行和调用排行"""
    from sqlalchemy import func
    
    # 1. 接口耗时排行：按渠道+模型聚合，统计成功请求的平均耗时
    latency_stats = db.query(
        LLMRequestLogModel.provider_id,
        LLMRequestLogModel.model_name,
        func.avg(LLMRequestLogModel.duration_ms).label('avg_duration'),
        func.count(LLMRequestLogModel.id).label('call_count'),
    ).filter(
        LLMRequestLogModel.status == 'success'
    ).group_by(
        LLMRequestLogModel.provider_id,
        LLMRequestLogModel.model_name,
    ).order_by(
        func.avg(LLMRequestLogModel.duration_ms).desc()
    ).limit(20).all()
    
    # 获取渠道名称映射
    provider_ids = list(set([s.provider_id for s in latency_stats]))
    providers_map = {}
    if provider_ids:
        providers = db.query(LLMProviderModel).filter(
            LLMProviderModel.provider_id.in_(provider_ids)
        ).all()
        providers_map = {p.provider_id: p.name for p in providers}
    
    latency_ranking = []
    for stat in latency_stats:
        latency_ranking.append({
            "provider_id": stat.provider_id,
            "provider_name": providers_map.get(stat.provider_id, "未知"),
            "model_name": stat.model_name,
            "avg_duration_ms": round(float(stat.avg_duration), 2),
            "call_count": stat.call_count,
        })
    
    # 2. 渠道调用排行：按渠道聚合，统计调用次数
    call_stats = db.query(
        LLMRequestLogModel.provider_id,
        func.count(LLMRequestLogModel.id).label('call_count'),
        func.sum(func.IF(LLMRequestLogModel.status == 'success', 1, 0)).label('success_count'),
    ).group_by(
        LLMRequestLogModel.provider_id,
    ).order_by(
        func.count(LLMRequestLogModel.id).desc()
    ).all()
    
    # 更新渠道名称映射
    all_provider_ids = list(set([s.provider_id for s in call_stats]))
    if all_provider_ids:
        providers = db.query(LLMProviderModel).filter(
            LLMProviderModel.provider_id.in_(all_provider_ids)
        ).all()
        providers_map = {p.provider_id: p.name for p in providers}
    
    call_ranking = []
    for stat in call_stats:
        success_count = int(stat.success_count or 0)
        call_count = int(stat.call_count or 0)
        call_ranking.append({
            "provider_id": stat.provider_id,
            "provider_name": providers_map.get(stat.provider_id, "未知"),
            "call_count": call_count,
            "success_count": success_count,
            "success_rate": round(success_count / call_count * 100, 2) if call_count > 0 else 0,
        })
    
    return {
        "latency_ranking": latency_ranking,
        "call_ranking": call_ranking,
    }
