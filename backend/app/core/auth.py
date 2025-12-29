"""认证模块 - 管理员密钥认证（使用Redis存储Token）"""

import hashlib
import logging
import secrets
from typing import Optional
from fastapi import HTTPException, Header, Depends
from app.core.config import settings
from app.core.timezone import now

logger = logging.getLogger(__name__)

# Token有效期（秒）- 3天
TOKEN_EXPIRE_SECONDS = 3 * 24 * 60 * 60


def _get_cache_service():
    """延迟导入缓存服务，避免循环导入"""
    from app.core.cache import cache_service
    return cache_service


def generate_token() -> str:
    """生成随机token"""
    return secrets.token_urlsafe(32)


def hash_key(key: str) -> str:
    """对密钥进行哈希"""
    return hashlib.sha256(key.encode()).hexdigest()


def verify_admin_key(key: str) -> bool:
    """验证管理员密钥"""
    if not settings.ADMIN_SECRET_KEY:
        # 未配置密钥，不启用认证
        return True
    return key == settings.ADMIN_SECRET_KEY


def create_session(key: str) -> Optional[str]:
    """创建会话，返回token（存储到Redis）"""
    if not verify_admin_key(key):
        return None
    
    token = generate_token()
    cache = _get_cache_service()
    
    # 存储token到Redis
    token_data = {
        "created_at": now().isoformat(),
        "admin": True,
    }
    
    if cache.set_token(token, token_data, TOKEN_EXPIRE_SECONDS):
        logger.info(f"Token创建成功，有效期{TOKEN_EXPIRE_SECONDS // 3600}小时")
        return token
    else:
        logger.error("Token存储到Redis失败")
        return None


def verify_token(token: str) -> bool:
    """验证token是否有效，每次验证成功后刷新过期时间"""
    if not settings.ADMIN_SECRET_KEY:
        # 未配置密钥，不启用认证
        return True
    
    cache = _get_cache_service()
    token_data = cache.get_token(token)
    
    if token_data is None:
        return False
    
    # 刷新过期时间，保持会话活跃
    cache.refresh_token(token, TOKEN_EXPIRE_SECONDS)
    return True


def invalidate_token(token: str) -> bool:
    """使token失效（登出）"""
    cache = _get_cache_service()
    return cache.delete_token(token)


def is_auth_enabled() -> bool:
    """检查是否启用了认证"""
    return bool(settings.ADMIN_SECRET_KEY)


def require_admin(authorization: Optional[str] = Header(None, alias="Authorization")):
    """
    依赖注入：要求管理员权限
    
    用法：
    @router.post("/some-action")
    async def some_action(admin = Depends(require_admin)):
        ...
    """
    # 如果未配置密钥，不启用认证
    if not settings.ADMIN_SECRET_KEY:
        return True
    
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail={"error_code": "UNAUTHORIZED", "message": "需要登录才能执行此操作"}
        )
    
    # 解析 Bearer token
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail={"error_code": "INVALID_TOKEN", "message": "无效的认证格式"}
        )
    
    token = parts[1]
    if not verify_token(token):
        raise HTTPException(
            status_code=401,
            detail={"error_code": "TOKEN_EXPIRED", "message": "登录已过期，请重新登录"}
        )
    
    return True
