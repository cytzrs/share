#!/usr/bin/env python3
"""测试Telegram通知器环境变量加载功能"""

import logging
from app.services.telegram_notifier import TelegramNotifier

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def test_telegram_notifier_config():
    """测试Telegram通知器配置加载"""
    logger.info("开始测试Telegram通知器配置加载...")
    
    # 初始化Telegram通知器
    notifier = TelegramNotifier()
    
    # 检查配置
    logger.info(f"Telegram通知器启用状态: {notifier.enabled}")
    logger.info(f"Bot token配置状态: {'已配置' if notifier.bot_token else '未配置'}")
    logger.info(f"Chat ID配置状态: {'已配置' if notifier.chat_id else '未配置'}")
    
    if notifier.enabled:
        logger.info("Telegram通知器配置成功！")
    else:
        logger.warning("Telegram通知器配置失败，可能缺少必要的环境变量")
    
    logger.info("测试完成！")

if __name__ == "__main__":
    test_telegram_notifier_config()