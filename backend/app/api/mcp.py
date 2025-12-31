"""MCP Marketplace API路由

提供MCP服务的CRUD操作、状态管理、搜索、统计和工具测试功能。

实现需求:
- 2.1, 3.1, 4.2, 5.1, 5.2: MCP服务CRUD和状态管理
- 7.1-7.6: 搜索和分页
- 10.1-10.3: 统计数据
- 6.2, 6.5: 工具测试
"""

import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.mcp_service import (
    MCPService,
    MCPServerNotFoundError,
    MCPToolNotFoundError,
    MCPServerDisabledError,
    MCPNameDuplicateError,
    MCPValidationError,
)
from app.api.schemas import (
    MCPServerCreate,
    MCPServerUpdate,
    MCPServerResponse,
    MCPServerListResponse,
    MCPStatsResponse,
    MCPStatusUpdate,
    MCPToolTestRequest,
    MCPToolTestResponse,
    ErrorResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def get_mcp_service(db: Session = Depends(get_db)) -> MCPService:
    """获取MCP服务实例"""
    return MCPService(db)


@router.get(
    "/servers",
    response_model=MCPServerListResponse,
    summary="获取MCP服务列表",
    description="获取MCP服务列表，支持搜索、过滤和分页",
)
async def list_servers(
    page: int = Query(default=1, ge=1, description="页码"),
    page_size: int = Query(default=20, ge=1, le=100, description="每页数量"),
    server_id: Optional[int] = Query(default=None, description="按服务ID精确搜索"),
    display_name: Optional[str] = Query(default=None, description="按显示名称模糊搜索"),
    description: Optional[str] = Query(default=None, description="按描述模糊搜索"),
    keyword: Optional[str] = Query(default=None, description="关键词搜索（搜索名称、描述、标识名）"),
    status: Optional[str] = Query(default=None, description="按状态过滤: enabled/disabled"),
    service: MCPService = Depends(get_mcp_service),
):
    """获取MCP服务列表
    
    支持多种搜索和过滤条件:
    - server_id: 精确匹配服务ID
    - display_name: 模糊匹配显示名称
    - description: 模糊匹配描述
    - keyword: 同时搜索名称、描述、标识名
    - status: 按启用/禁用状态过滤
    """
    # 构建过滤条件
    filters = {}
    if server_id is not None:
        filters["server_id"] = server_id
    if display_name:
        filters["display_name"] = display_name
    if description:
        filters["description"] = description
    if keyword:
        filters["keyword"] = keyword
    if status:
        filters["status"] = status
    
    servers, total = service.list_servers(filters, page, page_size)
    
    total_pages = (total + page_size - 1) // page_size
    
    return MCPServerListResponse(
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        servers=servers,
    )


@router.get(
    "/servers/{server_id}",
    response_model=MCPServerResponse,
    summary="获取MCP服务详情",
    description="根据服务ID获取MCP服务的详细信息",
    responses={
        404: {"model": ErrorResponse, "description": "服务不存在"},
    },
)
async def get_server(
    server_id: int,
    service: MCPService = Depends(get_mcp_service),
):
    """获取MCP服务详情"""
    try:
        return service.get_server(server_id)
    except MCPServerNotFoundError as e:
        raise HTTPException(
            status_code=404,
            detail={
                "error_code": "MCP_SERVER_NOT_FOUND",
                "message": str(e),
                "details": {"server_id": server_id},
            },
        )


@router.post(
    "/servers",
    response_model=MCPServerResponse,
    status_code=201,
    summary="创建MCP服务",
    description="创建一个新的MCP服务",
    responses={
        409: {"model": ErrorResponse, "description": "名称重复"},
        422: {"model": ErrorResponse, "description": "参数验证失败"},
    },
)
async def create_server(
    request: MCPServerCreate,
    service: MCPService = Depends(get_mcp_service),
):
    """创建MCP服务
    
    创建一个新的MCP服务，包括连接配置和工具定义。
    - qualified_name 必须唯一
    - 自动设置 created_at 和初始化 use_count 为 0
    """
    try:
        return service.create_server(request)
    except MCPNameDuplicateError as e:
        raise HTTPException(
            status_code=409,
            detail={
                "error_code": "MCP_NAME_DUPLICATE",
                "message": str(e),
                "details": {"qualified_name": request.qualified_name},
            },
        )
    except MCPValidationError as e:
        raise HTTPException(
            status_code=422,
            detail={
                "error_code": "VALIDATION_ERROR",
                "message": str(e),
            },
        )


@router.put(
    "/servers/{server_id}",
    response_model=MCPServerResponse,
    summary="更新MCP服务",
    description="更新MCP服务的信息",
    responses={
        404: {"model": ErrorResponse, "description": "服务不存在"},
    },
)
async def update_server(
    server_id: int,
    request: MCPServerUpdate,
    service: MCPService = Depends(get_mcp_service),
):
    """更新MCP服务
    
    更新MCP服务的信息，包括连接配置和工具定义。
    - use_count 和 created_at 不会被修改
    - updated_at 会自动更新
    """
    try:
        return service.update_server(server_id, request)
    except MCPServerNotFoundError as e:
        raise HTTPException(
            status_code=404,
            detail={
                "error_code": "MCP_SERVER_NOT_FOUND",
                "message": str(e),
                "details": {"server_id": server_id},
            },
        )


@router.delete(
    "/servers/{server_id}",
    status_code=204,
    summary="删除MCP服务",
    description="软删除MCP服务",
    responses={
        404: {"model": ErrorResponse, "description": "服务不存在"},
    },
)
async def delete_server(
    server_id: int,
    service: MCPService = Depends(get_mcp_service),
):
    """删除MCP服务（软删除）
    
    将MCP服务标记为已删除，保留历史数据用于审计。
    """
    try:
        service.delete_server(server_id)
        return None
    except MCPServerNotFoundError as e:
        raise HTTPException(
            status_code=404,
            detail={
                "error_code": "MCP_SERVER_NOT_FOUND",
                "message": str(e),
                "details": {"server_id": server_id},
            },
        )


@router.patch(
    "/servers/{server_id}/status",
    response_model=MCPServerResponse,
    summary="更新MCP服务状态",
    description="启用或禁用MCP服务",
    responses={
        404: {"model": ErrorResponse, "description": "服务不存在"},
    },
)
async def update_server_status(
    server_id: int,
    request: MCPStatusUpdate,
    service: MCPService = Depends(get_mcp_service),
):
    """更新MCP服务状态
    
    启用或禁用MCP服务。
    - is_enabled=true: 启用服务
    - is_enabled=false: 禁用服务
    """
    try:
        return service.toggle_status(server_id, request.is_enabled)
    except MCPServerNotFoundError as e:
        raise HTTPException(
            status_code=404,
            detail={
                "error_code": "MCP_SERVER_NOT_FOUND",
                "message": str(e),
                "details": {"server_id": server_id},
            },
        )


@router.get(
    "/stats",
    response_model=MCPStatsResponse,
    summary="获取MCP生态统计数据",
    description="获取MCP市场的生态统计数据",
)
async def get_stats(
    service: MCPService = Depends(get_mcp_service),
):
    """获取MCP生态统计数据
    
    返回:
    - total_servers: 总MCP服务数量
    - enabled_servers: 启用MCP服务数量
    - total_use_count: 总调用量
    """
    return service.get_stats()


@router.post(
    "/servers/{server_id}/tools/{tool_name}/test",
    response_model=MCPToolTestResponse,
    summary="测试MCP工具",
    description="测试MCP服务的指定工具",
    responses={
        404: {"model": ErrorResponse, "description": "服务或工具不存在"},
        403: {"model": ErrorResponse, "description": "服务已禁用"},
    },
)
async def test_tool(
    server_id: int,
    tool_name: str,
    request: MCPToolTestRequest,
    service: MCPService = Depends(get_mcp_service),
):
    """测试MCP工具
    
    执行MCP服务的指定工具并返回结果。
    - 成功执行后会增加服务的 use_count
    - 服务必须处于启用状态
    """
    try:
        return service.test_tool(server_id, tool_name, request.arguments)
    except MCPServerNotFoundError as e:
        raise HTTPException(
            status_code=404,
            detail={
                "error_code": "MCP_SERVER_NOT_FOUND",
                "message": str(e),
                "details": {"server_id": server_id},
            },
        )
    except MCPToolNotFoundError as e:
        raise HTTPException(
            status_code=404,
            detail={
                "error_code": "MCP_TOOL_NOT_FOUND",
                "message": str(e),
                "details": {"server_id": server_id, "tool_name": tool_name},
            },
        )
    except MCPServerDisabledError as e:
        raise HTTPException(
            status_code=403,
            detail={
                "error_code": "MCP_SERVER_DISABLED",
                "message": str(e),
                "details": {"server_id": server_id},
            },
        )
