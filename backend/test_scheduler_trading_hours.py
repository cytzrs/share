#!/usr/bin/env python3
"""测试调度器的交易时段检查功能"""

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
    current_time = now.time()
    current_weekday = now.weekday()
    
    logger.info(f"交易时段检查 - 当前时间: {now.strftime('%Y-%m-%d %H:%M:%S')}, 星期: {current_weekday}")
    
    # 检查是否是交易日（周一至周五）
    if current_weekday >= 5:  # 5=周六, 6=周日
        logger.info(f"当前是周末 ({now.strftime('%Y-%m-%d %A')})，跳过任务执行")
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
        logger.info(f"当前不在交易时段内 ({current_time.strftime('%H:%M:%S')})，跳过任务执行")
        return False
    
    logger.info(f"当前在交易时段内 ({current_time.strftime('%H:%M:%S')})，执行任务")
    return True

def test_trading_hours_integration():
    """测试交易时段检查的集成功能"""
    logger.info("开始测试交易时段检查集成功能...")
    
    # 模拟自动任务执行
    logger.info("\n=== 模拟自动任务执行 ===")
    is_manual = False
    
    # 检查交易时段
    if not is_manual and not is_trading_hours():
        logger.info("自动任务因非交易时段被跳过")
    else:
        logger.info("自动任务正常执行")
    
    # 模拟手动任务执行
    logger.info("\n=== 模拟手动任务执行 ===")
    is_manual = True
    
    # 检查交易时段（手动任务不受限制）
    if not is_manual and not is_trading_hours():
        logger.info("手动任务因非交易时段被跳过")
    else:
        logger.info("手动任务正常执行（不受交易时段限制）")
    
    logger.info("\n测试完成！")

if __name__ == "__main__":
    test_trading_hours_integration()