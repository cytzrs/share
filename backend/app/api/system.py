"""系统配置API"""

import os
import logging
from pathlib import Path
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import require_admin
from app.db.session import get_db

logger = logging.getLogger(__name__)

router = APIRouter()

# 获取 backend 目录的绝对路径
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = BACKEND_DIR / ".env"


class SystemConfig(BaseModel):
    """系统配置"""
    data_source: str = "tushare"
    tushare_token: str = ""
    commission_rate: str = "0.0003"
    stamp_tax_rate: str = "0.001"
    transfer_fee_rate: str = "0.00002"


def _read_env_file() -> dict:
    """读取.env文件"""
    env_vars = {}
    if ENV_FILE.exists():
        with open(ENV_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    env_vars[key.strip()] = value.strip()
    return env_vars


def _write_env_file(env_vars: dict):
    """写入.env文件"""
    lines = []
    for key, value in env_vars.items():
        lines.append(f"{key}={value}")
    with open(ENV_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


@router.get("", response_model=SystemConfig)
async def get_system_config():
    """获取系统配置"""
    env_vars = _read_env_file()
    
    config = SystemConfig(
        data_source=env_vars.get("DATA_SOURCE", "tushare"),
        tushare_token=env_vars.get("TUSHARE_API_TOKEN", ""),
        commission_rate=env_vars.get("COMMISSION_RATE", "0.0003"),
        stamp_tax_rate=env_vars.get("STAMP_TAX_RATE", "0.001"),
        transfer_fee_rate=env_vars.get("TRANSFER_FEE_RATE", "0.00002"),
    )
    
    # 隐藏token敏感信息
    if config.tushare_token:
        config.tushare_token = config.tushare_token[:4] + "****" + config.tushare_token[-4:] if len(config.tushare_token) > 8 else "****"
    
    return config


@router.put("", response_model=SystemConfig)
async def update_system_config(
    config: SystemConfig,
    _admin: bool = Depends(require_admin),
):
    """更新系统配置"""
    env_vars = _read_env_file()
    
    # 更新环境变量
    env_vars["DATA_SOURCE"] = config.data_source
    env_vars["COMMISSION_RATE"] = config.commission_rate
    env_vars["STAMP_TAX_RATE"] = config.stamp_tax_rate
    env_vars["TRANSFER_FEE_RATE"] = config.transfer_fee_rate
    
    # 只有当token不是掩码时才更新
    if config.tushare_token and "****" not in config.tushare_token:
        env_vars["TUSHARE_API_TOKEN"] = config.tushare_token
    
    # 写入文件
    _write_env_file(env_vars)
    
    # 更新运行时配置
    os.environ["DATA_SOURCE"] = config.data_source
    os.environ["COMMISSION_RATE"] = config.commission_rate
    os.environ["STAMP_TAX_RATE"] = config.stamp_tax_rate
    os.environ["TRANSFER_FEE_RATE"] = config.transfer_fee_rate
    
    if config.tushare_token and "****" not in config.tushare_token:
        os.environ["TUSHARE_API_TOKEN"] = config.tushare_token
    
    # 返回更新后的配置（隐藏token）
    result = config.model_copy()
    token = env_vars.get("TUSHARE_API_TOKEN", "")
    if token:
        result.tushare_token = token[:4] + "****" + token[-4:] if len(token) > 8 else "****"
    
    return result
