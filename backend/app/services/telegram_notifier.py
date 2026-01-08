"""Telegram 通知服务"""

import os
import requests
import logging
from typing import Optional
from app.core.order_processor import OrderResult


logger = logging.getLogger(__name__)


class TelegramNotifier:
    """Telegram 通知器"""
    
    def __init__(self):
        """初始化 Telegram 通知器"""
        # 从环境变量获取配置
        self.bot_token = os.getenv('TELEGRAM_BOT_TOKEN', '')
        self.chat_id = os.getenv('TELEGRAM_CHAT_ID', '')
        self.enabled = bool(self.bot_token and self.chat_id)
        logger.info(f"Telegram notifier initialized - enabled: {self.enabled}, chat_id: {self.chat_id}")
    
    def send_trade_notification(self, order_result: OrderResult) -> bool:
        """
        发送交易成功通知
        
        Args:
            order_result: 订单处理结果
            
        Returns:
            bool: 通知是否发送成功
        """
        if not self.enabled:
            logger.warning("Telegram notifier is disabled - missing bot token or chat id")
            return False
        
        if not order_result.success or not order_result.transaction:
            logger.debug("Skipping Telegram notification - order not successful or no transaction")
            return False
        
        order = order_result.order
        transaction = order_result.transaction
        
        # 构建通知消息
        side = "买入" if order.side.value == "buy" else "卖出"
        stock_name = self._get_stock_name(order.stock_code)
        
        # 获取决策理由
        reason = getattr(order, 'reason', '')
        
        # 获取agent名称（优先使用order上的agent_name属性，如果没有则使用agent_id）
        agent_name = getattr(order, 'agent_name', order.agent_id)
        
        # 获取开盘价（如果订单上有open_price属性）
        open_price = getattr(order, 'open_price', 'N/A')
        
        # 获取股票涨幅和板块涨幅
        stock_change, sector_change = self._get_stock_and_sector_change(order.stock_code)
        
        message = (
            f"🚨 **交易成功通知** 🚨\n\n"
            f"**方向:** {side}\n"
            f"**股票:** {order.stock_code} {stock_name}\n"
            f"**开盘价:** ¥{open_price}\n"
            f"**成交价:** ¥{order.price}\n"
            f"**股票涨幅:** {stock_change}\n"
            f"**板块涨幅:** {sector_change}\n"
            f"**数量:** {order.quantity} 股\n"
            f"**成交金额:** ¥{(order.price * order.quantity):.2f}\n"
            f"**费用:** ¥{transaction.fees.total:.2f}\n"
            f"**交易时间:** {transaction.executed_at.strftime('%Y-%m-%d %H:%M:%S')}\n"
            f"**交易ID:** {transaction.tx_id}\n"
            f"**订单ID:** {order.order_id}\n"
            f"**Agent:** {agent_name}\n"
            f"**决策理由:** {reason[:200]}{'...' if len(reason) > 200 else ''}"
        )
        
        logger.info(f"Preparing to send Telegram notification for transaction: {transaction.tx_id}")
        success = self._send_message(message)
        logger.info(f"Telegram notification sent: {success} for transaction: {transaction.tx_id}")
        return success    
    def _get_stock_name(self, stock_code: str) -> str:
        """
        获取股票名称（从数据库获取）
        
        Args:
            stock_code: 股票代码
            
        Returns:
            str: 股票名称
        """
        try:
            from app.db.session import get_db
            from app.db.models import StockQuoteModel
            from sqlalchemy import func
            
            db = next(get_db())
            try:
                # 获取股票最新的名称
                quote_model = (
                    db.query(StockQuoteModel.stock_name)
                    .filter(StockQuoteModel.stock_code == stock_code)
                    .filter(StockQuoteModel.stock_name.isnot(None))
                    .order_by(StockQuoteModel.trade_date.desc())
                    .first()
                )
                return quote_model.stock_name if quote_model else ""
            finally:
                db.close()
        except Exception as e:
            logger.error(f"获取股票名称失败: {e}")
            return ""
    
    def _get_stock_and_sector_change(self, stock_code: str) -> tuple[str, str]:
        """
        获取股票涨幅和板块涨幅
        
        Args:
            stock_code: 股票代码
            
        Returns:
            tuple: (股票涨幅, 板块涨幅)
        """
        try:
            from app.db.session import get_db
            from app.db.models import StockQuoteModel
            
            db = next(get_db())
            try:
                # 获取股票最新的行情数据
                quote_model = (
                    db.query(StockQuoteModel)
                    .filter(StockQuoteModel.stock_code == stock_code)
                    .order_by(StockQuoteModel.trade_date.desc())
                    .first()
                )
                
                if quote_model and quote_model.close_price and quote_model.prev_close:
                    # 计算股票涨幅
                    change = ((float(quote_model.close_price) - float(quote_model.prev_close)) / float(quote_model.prev_close)) * 100
                    stock_change = f"{change:+.2f}%"
                else:
                    stock_change = "N/A"
                
                # 这里可以根据实际情况获取板块涨幅
                # 暂时返回N/A，实际项目中可能需要从其他表或API获取
                sector_change = "N/A"
                
                return stock_change, sector_change
            finally:
                db.close()
        except Exception as e:
            logger.error(f"获取股票涨幅失败: {e}")
            return "N/A", "N/A"
    
    def _send_message(self, message: str) -> bool:
        """
        发送 Telegram 消息
        
        Args:
            message: 消息内容
            
        Returns:
            bool: 发送是否成功
        """
        try:
            url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
            payload = {
                'chat_id': self.chat_id,
                'text': message,
                'parse_mode': 'Markdown'
            }
            
            logger.debug(f"Sending Telegram message to chat_id: {self.chat_id}")
            response = requests.post(url, json=payload, timeout=10)
            
            if response.status_code == 200:
                logger.info("Telegram message sent successfully")
                return True
            else:
                logger.error(f"Telegram message failed with status code: {response.status_code}, content: {response.text}")
                return False
        except Exception as e:
            logger.exception(f"Telegram notification failed with exception: {e}")
            return False
