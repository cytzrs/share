"""Redis客户端配置"""

import redis
from typing import Optional

from app.core.config import settings


class RedisClient:
    """Redis客户端封装"""

    def __init__(self):
        self._client: Optional[redis.Redis] = None

    @property
    def client(self) -> redis.Redis:
        """获取Redis客户端实例（懒加载）"""
        if self._client is None:
            self._client = redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
            )
        return self._client

    def get(self, key: str) -> Optional[str]:
        """获取缓存值"""
        return self.client.get(key)

    def set(self, key: str, value: str, ex: Optional[int] = None) -> bool:
        """设置缓存值"""
        return self.client.set(key, value, ex=ex)

    def delete(self, key: str) -> int:
        """删除缓存键"""
        return self.client.delete(key)

    def exists(self, key: str) -> bool:
        """检查键是否存在"""
        return self.client.exists(key) > 0

    def close(self) -> None:
        """关闭连接"""
        if self._client:
            self._client.close()
            self._client = None


# 全局Redis客户端实例
redis_client = RedisClient()


def get_redis() -> RedisClient:
    """获取Redis客户端的依赖注入函数"""
    return redis_client
