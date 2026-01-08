#!/usr/bin/env python3
"""测试交易时段检查功能（独立版本）"""

import logging
from datetime import datetime, time

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def is_trading_hours() -> bool:
    """
    检查当前是否在A股交易时段内
    
    Returns:
        bool: 是否在交易时段内
    """
    now = datetime.now()
    
    # 检查是否是交易日（周一至周五）
    if now.weekday() >= 5:  # 5=周六, 6=周日
        logger.info(f"当前是周末 ({now.strftime('%Y-%m-%d %A')})，跳过任务执行")
        return False
    
    # 检查是否在交易时间内
    current_time = now.time()
    morning_start = time(9, 30)
    morning_end = time(11, 30)
    afternoon_start = time(13, 0)
    afternoon_end = time(15, 0)
    
    is_morning_trading = morning_start <= current_time <= morning_end
    is_afternoon_trading = afternoon_start <= current_time <= afternoon_end
    
    if not (is_morning_trading or is_afternoon_trading):
        logger.info(f"当前不在交易时段内 ({current_time.strftime('%H:%M:%S')})，跳过任务执行")
        return False
    
    return True

def test_trading_hours_check():
    """测试交易时段检查功能"""
    logger.info("开始测试交易时段检查功能...")
    
    # 测试当前时间
    current_time = datetime.now().time()
    current_weekday = datetime.now().weekday()
    
    logger.info(f"当前时间: {current_time.strftime('%H:%M:%S')}")
    logger.info(f"当前星期: {current_weekday} (0=周一, 6=周日)")
    
    # 检查当前是否在交易时段
    is_in_trading_hours = is_trading_hours()
    logger.info(f"是否在交易时段: {is_in_trading_hours}")
    
    # 测试不同时间点
    test_times = [
        time(9, 0),   # 非交易时段
        time(9, 30),  # 交易时段开始
        time(10, 0),  # 交易时段
        time(11, 30), # 上午交易时段结束
        time(12, 0),  # 非交易时段
        time(13, 0),  # 下午交易时段开始
        time(14, 0),  # 交易时段
        time(15, 0),  # 交易时段结束
        time(15, 30), # 非交易时段
    ]
    
    logger.info("\n测试不同时间点:")
    for test_time in test_times:
        # 模拟时间检查
        morning_start = time(9, 30)
        morning_end = time(11, 30)
        afternoon_start = time(13, 0)
        afternoon_end = time(15, 0)
        
        is_morning_trading = morning_start <= test_time <= morning_end
        is_afternoon_trading = afternoon_start <= test_time <= afternoon_end
        is_test_trading = is_morning_trading or is_afternoon_trading
        
        logger.info(f"  {test_time.strftime('%H:%M')}: {'交易时段' if is_test_trading else '非交易时段'}")
    
    logger.info("\n测试完成！")

if __name__ == "__main__":
    test_trading_hours_check()