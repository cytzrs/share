"""认证API路由"""

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional

from app.core.auth import (
    create_session,
    verify_token,
    invalidate_token,
    is_auth_enabled,
)

router = APIRouter()


class LoginRequest(BaseModel):
    """登录请求"""
    secret_key: str


class LoginResponse(BaseModel):
    """登录响应"""
    success: bool
    token: Optional[str] = None
    message: str


class AuthStatusResponse(BaseModel):
    """认证状态响应"""
    auth_enabled: bool
    is_authenticated: bool


@router.get(
    "/status",
    response_model=AuthStatusResponse,
    summary="获取认证状态",
    description="检查是否启用了认证以及当前是否已登录",
)
async def get_auth_status(
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """获取认证状态"""
    auth_enabled = is_auth_enabled()
    
    is_authenticated = False
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            is_authenticated = verify_token(parts[1])
    
    # 如果未启用认证，视为已认证
    if not auth_enabled:
        is_authenticated = True
    
    return AuthStatusResponse(
        auth_enabled=auth_enabled,
        is_authenticated=is_authenticated,
    )


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="管理员登录",
    description="使用管理员密钥登录",
)
async def login(request: LoginRequest):
    """管理员登录"""
    if not is_auth_enabled():
        return LoginResponse(
            success=True,
            token=None,
            message="认证未启用，无需登录",
        )
    
    token = create_session(request.secret_key)
    if token:
        return LoginResponse(
            success=True,
            token=token,
            message="登录成功",
        )
    else:
        raise HTTPException(
            status_code=401,
            detail={"error_code": "INVALID_KEY", "message": "密钥错误"}
        )


@router.post(
    "/logout",
    summary="登出",
    description="使当前token失效",
)
async def logout(
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """登出"""
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            invalidate_token(parts[1])
    
    return {"success": True, "message": "已登出"}
