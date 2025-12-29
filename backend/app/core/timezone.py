"""时区工具模块

统一使用中国时区（Asia/Shanghai, UTC+8）
"""

from datetime import datetime, timezone, timedelta

# 中国时区 UTC+8
CHINA_TZ = timezone(timedelta(hours=8))


def now() -> datetime:
    """获取当前中国时间（不带时区信息，用于数据库存储）
    
    Returns:
        当前中国时间
    """
    return datetime.now(CHINA_TZ).replace(tzinfo=None)


def now_str(fmt: str = "%Y-%m-%d %H:%M:%S") -> str:
    """获取当前中国时间字符串
    
    Args:
        fmt: 时间格式
        
    Returns:
        格式化的时间字符串
    """
    return now().strftime(fmt)


def today_str() -> str:
    """获取今天日期字符串
    
    Returns:
        YYYY-MM-DD 格式的日期
    """
    return now().strftime("%Y-%m-%d")
