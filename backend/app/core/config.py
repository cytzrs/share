"""应用配置"""

from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

# 获取 backend 目录的绝对路径
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = BACKEND_DIR / ".env"


class Settings(BaseSettings):
    """应用配置类"""

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE) if ENV_FILE.exists() else ".env",
        case_sensitive=True,
        extra="ignore"
    )

    # 应用配置
    APP_NAME: str = "AI交易竞技场模拟平台"
    DEBUG: bool = False
    SQL_ECHO: bool = False  # 是否打印SQL语句

    # 数据库配置
    MYSQL_HOST: str = "localhost"
    MYSQL_PORT: int = 3306
    MYSQL_USER: str = "root"
    MYSQL_PASSWORD: str = ""
    MYSQL_DATABASE: str = "quant_trading"

    @property
    def DATABASE_URL(self) -> str:
        # 添加时区设置，确保使用中国时区
        return f"mysql+pymysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DATABASE}?charset=utf8mb4"

    # Redis配置
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: str = ""

    @property
    def REDIS_URL(self) -> str:
        if self.REDIS_PASSWORD:
            return f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    # CORS配置 (["*"] 表示允许所有来源)
    CORS_ORIGINS: List[str] = ["*"]

    # 交易配置
    DEFAULT_INITIAL_CASH: float = 20000.0
    COMMISSION_RATE: float = 0.0003  # 佣金费率 万分之三
    STAMP_TAX_RATE: float = 0.001  # 印花税 千分之一
    TRANSFER_FEE_RATE: float = 0.00002  # 过户费 万分之0.2

    # LLM配置
    LLM_API_BASE: str = "https://api.openai.com/v1"
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "gpt-4"

    # Tushare配置
    TUSHARE_API_TOKEN: str = ""
    DATA_COLLECTOR_MAX_RETRIES: int = 3
    DATA_COLLECTOR_RETRY_DELAY: float = 1.0

    # 调度器配置
    SCHEDULER_ENABLED: bool = True
    SCHEDULER_MAX_RETRIES: int = 3
    SCHEDULER_RETRY_DELAY: float = 60.0  # 重试间隔（秒）
    SCHEDULER_TIMEZONE: str = "Asia/Shanghai"

    # 管理员认证配置
    ADMIN_SECRET_KEY: str = ""  # 管理员密钥，为空则不启用认证


settings = Settings()
