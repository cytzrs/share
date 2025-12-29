"""AI决策解析器 - 解析和验证LLM返回的交易决策"""

import json
import re
import logging
from decimal import Decimal, InvalidOperation
from typing import Optional, Dict, Any, List, Union

from app.models.entities import TradingDecision, ValidationResult, Portfolio
from app.models.enums import DecisionType
from app.core.trading_rules import (
    validate_stock_code,
    validate_quantity,
    validate_price_limit,
    get_board_type,
    BoardType,
)
from app.core.portfolio_manager import validate_cash_sufficient


logger = logging.getLogger(__name__)


class DecisionParser:
    """
    AI决策解析器
    
    负责解析LLM返回的JSON格式决策，并进行验证。
    """
    
    # JSON提取正则模式
    JSON_PATTERN = re.compile(r'\{[^{}]*\}', re.DOTALL)
    
    def parse_decision(self, response: str) -> Optional[TradingDecision]:
        """
        解析LLM响应为单个交易决策（兼容旧接口）
        
        支持单个JSON对象或JSON数组（取第一个决策）
        空数组视为 hold 决策
        
        Args:
            response: LLM响应文本
            
        Returns:
            Optional[TradingDecision]: 解析后的决策，解析失败返回None
        """
        decisions = self.parse_decisions(response)
        if not decisions:
            return None
        return decisions[0]
    
    def parse_decisions(self, response: str) -> List[TradingDecision]:
        """
        解析LLM响应为多个交易决策
        
        支持单个JSON对象或JSON数组
        空数组视为 hold 决策（返回单个 hold）
        
        Args:
            response: LLM响应文本
            
        Returns:
            List[TradingDecision]: 解析后的决策列表，解析失败返回空列表
        """
        if not response:
            logger.warning("LLM响应为空")
            return []
        
        # 尝试提取JSON
        json_str = self._extract_json(response)
        if not json_str:
            logger.warning(f"无法从响应中提取JSON: {response[:200]}...")
            return []
        
        try:
            data = json.loads(json_str)
            
            # 如果是数组
            if isinstance(data, list):
                if len(data) == 0:
                    # 空数组视为 hold 决策（观望，不操作）
                    logger.info("LLM返回空数组，视为hold决策")
                    return [TradingDecision(
                        decision=DecisionType.HOLD,
                        stock_code=None,
                        quantity=None,
                        price=None,
                        reason="LLM返回空数组，无交易建议",
                    )]
                
                # 解析所有决策
                decisions = []
                for i, item in enumerate(data):
                    try:
                        decision = self._parse_decision_dict(item)
                        decisions.append(decision)
                    except Exception as e:
                        logger.warning(f"解析第{i+1}个决策失败: {e}")
                
                logger.info(f"LLM返回了{len(data)}个决策，成功解析{len(decisions)}个")
                return decisions
            else:
                # 单个对象
                return [self._parse_decision_dict(data)]
                
        except json.JSONDecodeError as e:
            logger.warning(f"JSON解析失败: {e}")
            return []
        except Exception as e:
            logger.warning(f"决策解析失败: {e}")
            return []
    
    def _extract_json(self, text: str) -> Optional[str]:
        """
        从文本中提取JSON字符串
        
        支持从markdown代码块或纯文本中提取。
        支持JSON对象和JSON数组。
        
        Args:
            text: 原始文本
            
        Returns:
            Optional[str]: 提取的JSON字符串
        """
        if not text:
            return None
            
        # 方法1：尝试从markdown代码块提取
        code_block_matches = re.findall(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
        for match in code_block_matches:
            match = match.strip()
            if match.startswith('{') or match.startswith('['):
                try:
                    json.loads(match)
                    return match
                except json.JSONDecodeError:
                    continue
        
        # 方法2：查找JSON数组 [ ... ]
        first_bracket = text.find('[')
        last_bracket = text.rfind(']')
        if first_bracket != -1 and last_bracket != -1 and last_bracket > first_bracket:
            json_str = text[first_bracket:last_bracket + 1]
            try:
                json.loads(json_str)
                return json_str
            except json.JSONDecodeError:
                pass
        
        # 方法3：查找JSON对象 { ... }
        first_brace = text.find('{')
        last_brace = text.rfind('}')
        if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
            json_str = text[first_brace:last_brace + 1]
            try:
                json.loads(json_str)
                return json_str
            except json.JSONDecodeError:
                pass
        
        # 方法4：尝试整个文本作为JSON
        text = text.strip()
        if (text.startswith('{') and text.endswith('}')) or (text.startswith('[') and text.endswith(']')):
            try:
                json.loads(text)
                return text
            except json.JSONDecodeError:
                pass
        
        return None
    
    def _parse_decision_dict(self, data: Any) -> TradingDecision:
        """
        从字典解析决策
        
        Args:
            data: 决策字典
            
        Returns:
            TradingDecision: 解析后的决策
            
        Raises:
            ValueError: 如果数据格式无效
        """
        # 解析决策类型
        decision_str = data.get("decision", "").lower()
        try:
            decision_type = DecisionType(decision_str)
        except ValueError:
            raise ValueError(f"无效的决策类型: {decision_str}")
        
        # 解析股票代码（去除.SZ/.SH后缀）
        stock_code = data.get("stock_code")
        if stock_code:
            stock_code = str(stock_code).strip()
            # 去除交易所后缀
            if "." in stock_code:
                stock_code = stock_code.split(".")[0]
        
        # 解析数量
        quantity = data.get("quantity")
        if quantity is not None:
            try:
                quantity = int(quantity)
            except (ValueError, TypeError):
                raise ValueError(f"无效的数量: {quantity}")
        
        # 解析价格
        price = data.get("price")
        if price is not None:
            try:
                price = Decimal(str(price))
            except (InvalidOperation, ValueError):
                raise ValueError(f"无效的价格: {price}")
        
        # 解析理由
        reason = data.get("reason", "")
        
        return TradingDecision(
            decision=decision_type,
            stock_code=stock_code,
            quantity=quantity,
            price=price,
            reason=reason,
        )
    
    def serialize_decision(self, decision: TradingDecision) -> str:
        """
        将决策序列化为JSON字符串
        
        Args:
            decision: 交易决策
            
        Returns:
            str: JSON字符串
        """
        return json.dumps(decision.to_dict(), ensure_ascii=False, indent=2)
    
    def validate_decision(
        self,
        decision: TradingDecision,
        portfolio: Optional[Portfolio] = None,
        prev_close: Optional[Decimal] = None,
    ) -> ValidationResult:
        """
        验证决策的有效性
        
        验证内容：
        1. 股票代码是否有效
        2. 交易数量是否为100的整数倍
        3. 价格是否在涨跌停范围内
        4. 资金是否充足（买入时）
        
        Args:
            decision: 交易决策
            portfolio: 投资组合（用于验证资金充足性）
            prev_close: 前收盘价（用于验证涨跌停）
            
        Returns:
            ValidationResult: 验证结果
        """
        # 持有或等待决策不需要额外验证
        if decision.decision in (DecisionType.HOLD, DecisionType.WAIT):
            return ValidationResult(is_valid=True)
        
        # 买入或卖出决策需要验证详细信息
        if decision.decision in (DecisionType.BUY, DecisionType.SELL):
            # 验证股票代码
            if not decision.stock_code:
                return ValidationResult(
                    is_valid=False,
                    error_code="MISSING_STOCK_CODE",
                    error_message="买入/卖出决策必须提供股票代码"
                )
            
            # 去除交易所后缀后验证
            stock_code_clean = decision.stock_code.split(".")[0] if "." in decision.stock_code else decision.stock_code
            stock_validation = validate_stock_code(stock_code_clean)
            if not stock_validation.is_valid:
                return stock_validation
            
            # 验证数量
            if decision.quantity is None:
                return ValidationResult(
                    is_valid=False,
                    error_code="MISSING_QUANTITY",
                    error_message="买入/卖出决策必须提供数量"
                )
            
            quantity_validation = validate_quantity(decision.quantity)
            if not quantity_validation.is_valid:
                return quantity_validation
            
            # 验证价格（如果提供了价格则验证，否则允许从市场数据获取）
            if decision.price is not None:
                if decision.price <= 0:
                    return ValidationResult(
                        is_valid=False,
                        error_code="INVALID_PRICE",
                        error_message="价格必须大于0"
                    )
            
            # 验证涨跌停（如果提供了价格和前收盘价）
            if decision.price is not None and prev_close is not None:
                stock_code_clean = decision.stock_code.split(".")[0] if "." in decision.stock_code else decision.stock_code
                price_validation = validate_price_limit(
                    stock_code_clean,
                    decision.price,
                    prev_close,
                )
                if not price_validation.is_valid:
                    return price_validation
            
            # 验证资金充足性（买入时，仅当价格已知时验证）
            if decision.decision == DecisionType.BUY and portfolio is not None and decision.price is not None:
                stock_code_for_fee = decision.stock_code.split(".")[0] if "." in decision.stock_code else decision.stock_code
                cash_validation = validate_cash_sufficient(
                    portfolio.cash,
                    decision.price,
                    decision.quantity,
                    stock_code_for_fee,
                )
                if not cash_validation.is_valid:
                    return cash_validation
        
        return ValidationResult(is_valid=True)
    
    def validate_decision_format(self, decision: TradingDecision) -> ValidationResult:
        """
        验证决策格式（不涉及业务规则）
        
        Args:
            decision: 交易决策
            
        Returns:
            ValidationResult: 验证结果
        """
        # 验证决策类型
        if decision.decision not in DecisionType:
            return ValidationResult(
                is_valid=False,
                error_code="INVALID_DECISION_TYPE",
                error_message=f"无效的决策类型: {decision.decision}"
            )
        
        # 买入/卖出决策需要完整信息
        if decision.decision in (DecisionType.BUY, DecisionType.SELL):
            if not decision.stock_code:
                return ValidationResult(
                    is_valid=False,
                    error_code="MISSING_STOCK_CODE",
                    error_message="买入/卖出决策必须提供股票代码"
                )
            
            if decision.quantity is None or (isinstance(decision.quantity, int) and decision.quantity <= 0):
                return ValidationResult(
                    is_valid=False,
                    error_code="INVALID_QUANTITY",
                    error_message="买入/卖出决策必须提供有效数量"
                )
            
            # 价格可选（可以从市场数据获取）
            if decision.price is not None and decision.price <= 0:
                return ValidationResult(
                    is_valid=False,
                    error_code="INVALID_PRICE",
                    error_message="价格必须大于0"
                )
        
        return ValidationResult(is_valid=True)


class DecisionValidationError(Exception):
    """决策验证错误"""
    
    def __init__(self, message: str, error_code: str = "VALIDATION_ERROR"):
        super().__init__(message)
        self.error_code = error_code
