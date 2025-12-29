"""订单处理器 - 整合所有验证规则，处理订单执行"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Optional

from app.models.entities import (
    Order,
    Transaction,
    Position,
    Portfolio,
    TradingFees,
    ValidationResult,
)
from app.models.enums import OrderSide, OrderStatus
from app.core.trading_rules import (
    validate_stock_code,
    validate_price_limit,
    validate_t_plus_1,
    validate_quantity,
    calculate_fees,
    is_trading_time,
)
from app.core.portfolio_manager import (
    validate_cash_sufficient,
    validate_position_sufficient,
)
from app.core.timezone import now


@dataclass
class OrderResult:
    """订单处理结果"""
    
    success: bool
    order: Order
    transaction: Optional[Transaction] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None


class OrderProcessor:
    """订单处理器
    
    整合所有交易规则验证，处理订单的完整生命周期：
    1. 验证交易时间（可选）
    2. 验证股票代码
    3. 验证交易数量
    4. 验证价格限制
    5. 验证T+1规则（卖出时）
    6. 验证资金/持仓充足
    7. 计算费用
    8. 执行撮合
    9. 更新持仓和现金
    """
    
    def __init__(
        self,
        check_trading_time: bool = True,
        commission_rate: Decimal = Decimal("0.0003"),
    ):
        """
        初始化订单处理器
        
        Args:
            check_trading_time: 是否检查交易时间（回测模式可关闭）
            commission_rate: 佣金费率
        """
        self.check_trading_time = check_trading_time
        self.commission_rate = commission_rate
    
    def process_order(
        self,
        order: Order,
        portfolio: Portfolio,
        prev_close: Decimal,
        current_time: Optional[datetime] = None,
    ) -> OrderResult:
        """
        处理订单
        
        Args:
            order: 待处理的订单
            portfolio: 当前投资组合
            prev_close: 前收盘价（用于涨跌停验证）
            current_time: 当前时间（用于交易时间验证，默认为当前时间）
            
        Returns:
            OrderResult: 订单处理结果
        """
        if current_time is None:
            current_time = now()
        
        # 1. 验证交易时间
        if self.check_trading_time:
            if not is_trading_time(current_time):
                return self._reject_order(
                    order,
                    "NOT_TRADING_TIME",
                    f"当前时间{current_time}不在交易时段内"
                )
        
        # 2. 验证股票代码
        stock_validation = validate_stock_code(order.stock_code)
        if not stock_validation.is_valid:
            return self._reject_order(
                order,
                stock_validation.error_code,
                stock_validation.error_message
            )
        
        # 3. 验证交易数量
        quantity_validation = validate_quantity(order.quantity)
        if not quantity_validation.is_valid:
            return self._reject_order(
                order,
                quantity_validation.error_code,
                quantity_validation.error_message
            )
        
        # 4. 验证价格限制
        price_validation = validate_price_limit(
            order.stock_code,
            order.price,
            prev_close
        )
        if not price_validation.is_valid:
            return self._reject_order(
                order,
                price_validation.error_code,
                price_validation.error_message
            )
        
        # 5-6. 根据订单方向验证资金或持仓
        if order.side == OrderSide.BUY:
            validation_result = self._validate_buy_order(order, portfolio)
        else:
            validation_result = self._validate_sell_order(order, portfolio)
        
        if not validation_result.is_valid:
            return self._reject_order(
                order,
                validation_result.error_code,
                validation_result.error_message
            )
        
        # 7. 计算费用
        order_amount = order.price * order.quantity
        fees = calculate_fees(
            order_amount,
            order.side,
            order.stock_code,
            self.commission_rate
        )
        
        # 8-9. 执行撮合并更新持仓和现金
        transaction = self._execute_order(order, fees)
        updated_portfolio = self._update_portfolio(
            portfolio,
            order,
            fees,
            current_time.strftime("%Y-%m-%d")
        )
        
        # 更新订单状态
        order.status = OrderStatus.FILLED
        
        return OrderResult(
            success=True,
            order=order,
            transaction=transaction,
        )
    
    def _validate_buy_order(
        self,
        order: Order,
        portfolio: Portfolio,
    ) -> ValidationResult:
        """验证买入订单"""
        return validate_cash_sufficient(
            cash=portfolio.cash,
            price=order.price,
            quantity=order.quantity,
            stock_code=order.stock_code,
            commission_rate=self.commission_rate,
        )
    
    def _validate_sell_order(
        self,
        order: Order,
        portfolio: Portfolio,
    ) -> ValidationResult:
        """验证卖出订单"""
        # 查找持仓
        position = None
        for pos in portfolio.positions:
            if pos.stock_code == order.stock_code:
                position = pos
                break
        
        # 获取卖出日期（从订单创建时间）
        sell_date = order.created_at.strftime("%Y-%m-%d")
        
        # 验证持仓充足性（包含T+1规则）
        position_validation = validate_position_sufficient(
            position=position,
            quantity=order.quantity,
            sell_date=sell_date,
        )
        
        if not position_validation.is_valid:
            return position_validation
        
        # 额外验证T+1规则
        if position:
            t_plus_1_validation = validate_t_plus_1(position, sell_date)
            if not t_plus_1_validation.is_valid:
                return t_plus_1_validation
        
        return ValidationResult(is_valid=True)
    
    def _execute_order(
        self,
        order: Order,
        fees: TradingFees,
    ) -> Transaction:
        """执行订单，生成成交记录"""
        return Transaction(
            tx_id=str(uuid.uuid4()),
            order_id=order.order_id,
            agent_id=order.agent_id,
            stock_code=order.stock_code,
            side=order.side,
            quantity=order.quantity,
            price=order.price,
            fees=fees,
            executed_at=now(),
        )
    
    def _update_portfolio(
        self,
        portfolio: Portfolio,
        order: Order,
        fees: TradingFees,
        trade_date: str,
    ) -> Portfolio:
        """
        更新投资组合（现金和持仓）
        
        注意：此方法返回更新后的Portfolio对象，
        实际的持久化操作应由调用方完成。
        """
        order_amount = order.price * order.quantity
        
        if order.side == OrderSide.BUY:
            # 买入：现金减少，持仓增加
            new_cash = portfolio.cash - order_amount - fees.total
            portfolio.cash = new_cash
            
            # 更新或新增持仓
            self._update_position_for_buy(
                portfolio,
                order.stock_code,
                order.quantity,
                order.price,
                trade_date,
            )
        else:
            # 卖出：现金增加，持仓减少
            new_cash = portfolio.cash + order_amount - fees.total
            portfolio.cash = new_cash
            
            # 减少持仓
            self._update_position_for_sell(
                portfolio,
                order.stock_code,
                order.quantity,
            )
        
        return portfolio
    
    def _update_position_for_buy(
        self,
        portfolio: Portfolio,
        stock_code: str,
        quantity: int,
        price: Decimal,
        trade_date: str,
    ) -> None:
        """更新买入后的持仓"""
        # 查找现有持仓
        existing_position = None
        for pos in portfolio.positions:
            if pos.stock_code == stock_code:
                existing_position = pos
                break
        
        if existing_position:
            # 计算新的平均成本
            total_cost = (
                existing_position.avg_cost * existing_position.shares +
                price * quantity
            )
            new_shares = existing_position.shares + quantity
            new_avg_cost = total_cost / new_shares
            
            existing_position.shares = new_shares
            existing_position.avg_cost = new_avg_cost
            # 更新买入日期为最新买入日期（用于T+1判断）
            existing_position.buy_date = trade_date
        else:
            # 新建持仓
            new_position = Position(
                stock_code=stock_code,
                shares=quantity,
                avg_cost=price,
                buy_date=trade_date,
            )
            portfolio.positions.append(new_position)
    
    def _update_position_for_sell(
        self,
        portfolio: Portfolio,
        stock_code: str,
        quantity: int,
    ) -> None:
        """更新卖出后的持仓"""
        for i, pos in enumerate(portfolio.positions):
            if pos.stock_code == stock_code:
                pos.shares -= quantity
                # 如果持仓为0，移除该持仓
                if pos.shares <= 0:
                    portfolio.positions.pop(i)
                break
    
    def _reject_order(
        self,
        order: Order,
        error_code: str,
        error_message: str,
    ) -> OrderResult:
        """拒绝订单"""
        order.status = OrderStatus.REJECTED
        order.reject_reason = error_message
        
        return OrderResult(
            success=False,
            order=order,
            error_code=error_code,
            error_message=error_message,
        )


def calculate_assets_before_and_after(
    portfolio_before: Portfolio,
    portfolio_after: Portfolio,
    market_prices: dict[str, Decimal],
) -> tuple[Decimal, Decimal]:
    """
    计算交易前后的总资产
    
    用于验证资产守恒属性（Property 8）
    
    Args:
        portfolio_before: 交易前的投资组合
        portfolio_after: 交易后的投资组合
        market_prices: 市场价格字典
        
    Returns:
        tuple: (交易前总资产, 交易后总资产)
    """
    def calc_total(portfolio: Portfolio) -> Decimal:
        total = portfolio.cash
        for pos in portfolio.positions:
            price = market_prices.get(pos.stock_code, pos.avg_cost)
            total += price * pos.shares
        return total
    
    return calc_total(portfolio_before), calc_total(portfolio_after)
