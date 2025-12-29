"""投资组合管理器 - 资金和持仓验证、资产计算"""

from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Optional
from datetime import datetime

from app.models.entities import (
    Portfolio,
    Position,
    ValidationResult,
    TradingFees,
    PortfolioMetrics,
)
from app.models.enums import OrderSide
from app.core.trading_rules import calculate_fees


def validate_cash_sufficient(
    cash: Decimal,
    price: Decimal,
    quantity: int,
    stock_code: str,
    commission_rate: Decimal = Decimal("0.0003"),
) -> ValidationResult:
    """
    验证现金是否足够支付买入订单
    
    Args:
        cash: 可用现金
        price: 订单价格
        quantity: 订单数量
        stock_code: 股票代码（用于计算费用）
        commission_rate: 佣金费率
        
    Returns:
        ValidationResult: 验证结果
    """
    if cash < 0:
        return ValidationResult(
            is_valid=False,
            error_code="INVALID_CASH",
            error_message="现金余额不能为负数"
        )
    
    if price is None or price <= 0:
        return ValidationResult(
            is_valid=False,
            error_code="INVALID_PRICE",
            error_message="价格必须大于0"
        )
    
    if quantity is None or quantity <= 0:
        return ValidationResult(
            is_valid=False,
            error_code="INVALID_QUANTITY",
            error_message="数量必须大于0"
        )
    
    # 计算订单金额
    order_amount = price * quantity
    
    # 计算预估费用（买入只有佣金和过户费，没有印花税）
    fees = calculate_fees(order_amount, OrderSide.BUY, stock_code, commission_rate)
    
    # 总需要金额 = 订单金额 + 费用
    total_required = order_amount + fees.total
    
    if cash < total_required:
        return ValidationResult(
            is_valid=False,
            error_code="INSUFFICIENT_CASH",
            error_message=f"现金不足：需要{total_required}，可用{cash}"
        )
    
    return ValidationResult(is_valid=True)


def validate_position_sufficient(
    position: Optional[Position],
    quantity: int,
    sell_date: str,
) -> ValidationResult:
    """
    验证持仓是否足够支持卖出订单
    
    Args:
        position: 持仓信息（可能为None表示无持仓）
        quantity: 卖出数量
        sell_date: 卖出日期（用于T+1验证）
        
    Returns:
        ValidationResult: 验证结果
    """
    if quantity is None or quantity <= 0:
        return ValidationResult(
            is_valid=False,
            error_code="INVALID_QUANTITY",
            error_message="卖出数量必须大于0"
        )
    
    if position is None:
        return ValidationResult(
            is_valid=False,
            error_code="NO_POSITION",
            error_message="没有该股票的持仓"
        )
    
    if position.shares <= 0:
        return ValidationResult(
            is_valid=False,
            error_code="NO_POSITION",
            error_message="持仓数量为0"
        )
    
    # 计算可卖出数量（考虑T+1规则）
    sellable_shares = get_sellable_shares(position, sell_date)
    
    if sellable_shares < quantity:
        return ValidationResult(
            is_valid=False,
            error_code="INSUFFICIENT_POSITION",
            error_message=f"可卖出持仓不足：需要{quantity}股，可卖出{sellable_shares}股"
        )
    
    return ValidationResult(is_valid=True)


def get_sellable_shares(position: Position, sell_date: str) -> int:
    """
    获取可卖出的股票数量（考虑T+1规则）
    
    Args:
        position: 持仓信息
        sell_date: 卖出日期
        
    Returns:
        int: 可卖出数量
    """
    try:
        buy_dt = datetime.strptime(position.buy_date, "%Y-%m-%d").date()
        sell_dt = datetime.strptime(sell_date, "%Y-%m-%d").date()
    except ValueError:
        return 0
    
    # T+1规则：当天买入的不能卖出
    if sell_dt <= buy_dt:
        return 0
    
    return position.shares


def calculate_total_assets(
    portfolio: Portfolio,
    market_prices: Dict[str, Decimal],
) -> Decimal:
    """
    计算总资产
    
    总资产 = 现金余额 + 所有持仓的当前市值
    
    Args:
        portfolio: 投资组合
        market_prices: 股票当前市场价格字典 {stock_code: price}
        
    Returns:
        Decimal: 总资产
    """
    # 现金部分
    total = portfolio.cash
    
    # 持仓市值部分
    for position in portfolio.positions:
        price = market_prices.get(position.stock_code, position.avg_cost)
        market_value = price * position.shares
        total += market_value
    
    return total


def calculate_market_value(
    portfolio: Portfolio,
    market_prices: Dict[str, Decimal],
) -> Decimal:
    """
    计算持仓总市值
    
    Args:
        portfolio: 投资组合
        market_prices: 股票当前市场价格字典
        
    Returns:
        Decimal: 持仓总市值
    """
    total_market_value = Decimal("0")
    
    for position in portfolio.positions:
        price = market_prices.get(position.stock_code, position.avg_cost)
        market_value = price * position.shares
        total_market_value += market_value
    
    return total_market_value


def calculate_return_rate(
    current_total_assets: Decimal,
    initial_cash: Decimal,
) -> Decimal:
    """
    计算累计收益率
    
    收益率 = (当前总资产 - 初始资金) / 初始资金
    
    Args:
        current_total_assets: 当前总资产
        initial_cash: 初始资金
        
    Returns:
        Decimal: 收益率（小数形式，如0.05表示5%）
    """
    if initial_cash <= 0:
        return Decimal("0")
    
    return_rate = (current_total_assets - initial_cash) / initial_cash
    return return_rate.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def calculate_max_drawdown(asset_values: List[Decimal]) -> Decimal:
    """
    计算最大回撤
    
    最大回撤 = 曲线中任意高点到其后续低点的最大跌幅百分比
    
    Args:
        asset_values: 资产曲线序列（按时间顺序）
        
    Returns:
        Decimal: 最大回撤（小数形式，如0.15表示15%）
    """
    if not asset_values or len(asset_values) < 2:
        return Decimal("0")
    
    max_drawdown = Decimal("0")
    peak = asset_values[0]
    
    for value in asset_values:
        # 更新峰值
        if value > peak:
            peak = value
        
        # 计算当前回撤
        if peak > 0:
            drawdown = (peak - value) / peak
            if drawdown > max_drawdown:
                max_drawdown = drawdown
    
    return max_drawdown.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def calculate_portfolio_metrics(
    portfolio: Portfolio,
    initial_cash: Decimal,
    market_prices: Dict[str, Decimal],
    asset_history: Optional[List[Decimal]] = None,
    days_held: int = 0,
) -> PortfolioMetrics:
    """
    计算投资组合的各项指标
    
    Args:
        portfolio: 投资组合
        initial_cash: 初始资金
        market_prices: 股票当前市场价格字典
        asset_history: 历史资产曲线（可选，用于计算最大回撤）
        days_held: 持有天数（用于计算年化收益率）
        
    Returns:
        PortfolioMetrics: 投资组合指标
    """
    # 计算总市值
    total_market_value = calculate_market_value(portfolio, market_prices)
    
    # 计算总资产
    total_assets = portfolio.cash + total_market_value
    
    # 计算累计收益
    total_return = total_assets - initial_cash
    
    # 计算收益率
    return_rate = calculate_return_rate(total_assets, initial_cash)
    
    # 计算年化收益率
    annualized_return = None
    if days_held > 0 and initial_cash > 0:
        # 年化收益率 = ((1 + 收益率) ^ (365 / 持有天数) - 1) * 100
        # return_rate 已经是小数形式 (如 0.05 表示 5%)
        if return_rate > Decimal("-1"):  # 避免负数开方
            annualized_return = ((Decimal("1") + return_rate) ** (Decimal("365") / Decimal(str(days_held))) - Decimal("1")) * Decimal("100")
            annualized_return = annualized_return.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    
    # 计算最大回撤
    max_drawdown = None
    if asset_history:
        max_drawdown = calculate_max_drawdown(asset_history)
    
    return PortfolioMetrics(
        total_assets=total_assets,
        total_market_value=total_market_value,
        cash_balance=portfolio.cash,
        total_return=total_return,
        return_rate=return_rate,
        annualized_return=annualized_return,
        max_drawdown=max_drawdown,
    )
