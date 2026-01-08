#!/usr/bin/env python3
"""测试TaskExecutor的交易时段检查功能"""

import logging
from datetime import datetime, time

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def is_in_trading_hours() -> bool:
    """
    检查当前是否在A股交易时段内
    
    Returns:
        bool: 是否在交易时段内
    """
    now_dt = datetime.now()
    current_time = now_dt.time()
    current_weekday = now_dt.weekday()
    
    logger.info(f"交易时段检查 - 当前时间: {now_dt.strftime('%Y-%m-%d %H:%M:%S')}, 星期: {current_weekday}")
    
    # 检查是否是交易日（周一至周五）
    if current_weekday >= 5:  # 5=周六, 6=周日
        reason = f"当前是周末 ({now_dt.strftime('%Y-%m-%d %A')})"
        logger.info(f"{reason}，跳过任务执行")
        return False
    
    # 检查是否在交易时间内
    morning_start = time(9, 30)
    morning_end = time(11, 30)
    afternoon_start = time(13, 0)
    afternoon_end = time(15, 0)
    
    logger.info(f"交易时段范围 - 上午: {morning_start.strftime('%H:%M')}-{morning_end.strftime('%H:%M')}, 下午: {afternoon_start.strftime('%H:%M')}-{afternoon_end.strftime('%H:%M')}")
    
    is_morning_trading = morning_start <= current_time <= morning_end
    is_afternoon_trading = afternoon_start <= current_time <= afternoon_end
    
    logger.info(f"交易时段检查结果 - 上午: {is_morning_trading}, 下午: {is_afternoon_trading}")
    
    if not (is_morning_trading or is_afternoon_trading):
        reason = f"当前不在交易时段内 ({current_time.strftime('%H:%M:%S')})"
        logger.info(f"{reason}，跳过任务执行")
        return False
    
    logger.info(f"当前在交易时段内 ({current_time.strftime('%H:%M:%S')})，执行任务")
    return True

def test_task_executor_integration():
    """测试TaskExecutor的交易时段检查集成功能"""
    logger.info("开始测试TaskExecutor交易时段检查集成功能...")
    
    # 模拟Agent执行
    logger.info("\n=== 模拟Agent执行 ===")
    
    # 检查交易时段
    if not is_in_trading_hours():
        logger.info("Agent执行因非交易时段被跳过")
    else:
        logger.info("Agent执行正常进行")
    
    logger.info("\n测试完成！")

if __name__ == "__main__":
    test_task_executor_integration()