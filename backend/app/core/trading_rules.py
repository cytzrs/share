"""交易规则引擎 - A股交易规则验证和计算"""

import re
from datetime import datetime, date, time
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from typing import Optional

from app.models.entities import Position, TradingFees, ValidationResult
from app.models.enums import OrderSide


class BoardType(str, Enum):
    """板块类型"""
    SHANGHAI_MAIN = "shanghai_main"  # 上海主板
    SHENZHEN_MAIN = "shenzhen_main"  # 深圳主板
    SHENZHEN_SME = "shenzhen_sme"  # 深圳中小板
    STAR = "star"  # 科创板
    CHINEXT = "chinext"  # 创业板
    UNKNOWN = "unknown"  # 未知


# 股票代码正则模式
STOCK_CODE_PATTERNS = {
    BoardType.SHANGHAI_MAIN: re.compile(r"^(600|601|603|605)\d{3}$"),
    BoardType.SHENZHEN_MAIN: re.compile(r"^(000|001)\d{3}$"),
    BoardType.SHENZHEN_SME: re.compile(r"^002\d{3}$"),  # 深圳中小板
    BoardType.STAR: re.compile(r"^688\d{3}$"),
    BoardType.CHINEXT: re.compile(r"^(300|301)\d{3}$"),
}

# 涨跌停比例
PRICE_LIMIT_RATES = {
    BoardType.SHANGHAI_MAIN: Decimal("0.10"),  # 10%
    BoardType.SHENZHEN_MAIN: Decimal("0.10"),  # 10%
    BoardType.SHENZHEN_SME: Decimal("0.10"),  # 10%
    BoardType.STAR: Decimal("0.20"),  # 20%
    BoardType.CHINEXT: Decimal("0.20"),  # 20%
}

# 默认佣金费率
DEFAULT_COMMISSION_RATE = Decimal("0.0003")  # 万分之三
# 印花税率（仅卖出）
STAMP_TAX_RATE = Decimal("0.001")  # 千分之一
# 过户费率（仅上海市场）
TRANSFER_FEE_RATE = Decimal("0.00002")  # 万分之0.2


def get_board_type(stock_code: str) -> BoardType:
    """
    根据股票代码获取板块类型
    
    Args:
        stock_code: 股票代码
        
    Returns:
        BoardType: 板块类型
    """
    for board_type, pattern in STOCK_CODE_PATTERNS.items():
        if pattern.match(stock_code):
            return board_type
    return BoardType.UNKNOWN


def validate_stock_code(stock_code: str) -> ValidationResult:
    """
    验证股票代码是否为有效的A股代码
    
    Args:
        stock_code: 股票代码
        
    Returns:
        ValidationResult: 验证结果
    """
    if not stock_code:
        return ValidationResult(
            is_valid=False,
            error_code="EMPTY_STOCK_CODE",
            error_message="股票代码不能为空"
        )
    
    if not isinstance(stock_code, str):
        return ValidationResult(
            is_valid=False,
            error_code="INVALID_STOCK_CODE_TYPE",
            error_message="股票代码必须是字符串"
        )
    
    # 检查长度
    if len(stock_code) != 6:
        return ValidationResult(
            is_valid=False,
            error_code="INVALID_STOCK_CODE_LENGTH",
            error_message="股票代码必须是6位数字"
        )
    
    # 检查是否全为数字
    if not stock_code.isdigit():
        return ValidationResult(
            is_valid=False,
            error_code="INVALID_STOCK_CODE_FORMAT",
            error_message="股票代码必须全为数字"
        )
    
    # 检查是否匹配有效的板块
    board_type = get_board_type(stock_code)
    if board_type == BoardType.UNKNOWN:
        return ValidationResult(
            is_valid=False,
            error_code="UNKNOWN_BOARD_TYPE",
            error_message=f"无法识别的股票代码: {stock_code}"
        )
    
    return ValidationResult(is_valid=True)



def get_price_limit_rate(stock_code: str) -> Decimal:
    """
    根据股票代码获取涨跌停比例
    
    Args:
        stock_code: 股票代码
        
    Returns:
        Decimal: 涨跌停比例（0.10 或 0.20）
    """
    board_type = get_board_type(stock_code)
    return PRICE_LIMIT_RATES.get(board_type, Decimal("0.10"))


def validate_price_limit(
    stock_code: str, 
    price: Decimal, 
    prev_close: Decimal
) -> ValidationResult:
    """
    验证订单价格是否在涨跌停范围内
    
    Args:
        stock_code: 股票代码
        price: 订单价格
        prev_close: 前收盘价
        
    Returns:
        ValidationResult: 验证结果
    """
    if prev_close is None or prev_close <= 0:
        return ValidationResult(
            is_valid=False,
            error_code="INVALID_PREV_CLOSE",
            error_message="前收盘价必须大于0"
        )
    
    if price is None or price <= 0:
        return ValidationResult(
            is_valid=False,
            error_code="INVALID_PRICE",
            error_message="订单价格必须大于0"
        )
    
    limit_rate = get_price_limit_rate(stock_code)
    
    # 计算涨跌停价格（保留2位小数，四舍五入）
    lower_limit = (prev_close * (1 - limit_rate)).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    upper_limit = (prev_close * (1 + limit_rate)).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    
    if price < lower_limit:
        return ValidationResult(
            is_valid=False,
            error_code="PRICE_BELOW_LIMIT",
            error_message=f"价格{price}低于跌停价{lower_limit}"
        )
    
    if price > upper_limit:
        return ValidationResult(
            is_valid=False,
            error_code="PRICE_ABOVE_LIMIT",
            error_message=f"价格{price}高于涨停价{upper_limit}"
        )
    
    return ValidationResult(is_valid=True)


def validate_t_plus_1(position: Position, sell_date: str) -> ValidationResult:
    """
    验证T+1规则：当天买入的股票不能当天卖出
    
    Args:
        position: 持仓信息
        sell_date: 卖出日期（格式：YYYY-MM-DD）
        
    Returns:
        ValidationResult: 验证结果
    """
    try:
        buy_dt = datetime.strptime(position.buy_date, "%Y-%m-%d").date()
        sell_dt = datetime.strptime(sell_date, "%Y-%m-%d").date()
    except ValueError as e:
        return ValidationResult(
            is_valid=False,
            error_code="INVALID_DATE_FORMAT",
            error_message=f"日期格式错误: {e}"
        )
    
    if sell_dt <= buy_dt:
        return ValidationResult(
            is_valid=False,
            error_code="T_PLUS_1_VIOLATION",
            error_message=f"T+1限制：买入日期{position.buy_date}的股票不能在{sell_date}卖出"
        )
    
    return ValidationResult(is_valid=True)


def calculate_fees(
    amount: Decimal,
    side: OrderSide,
    stock_code: str,
    commission_rate: Decimal = DEFAULT_COMMISSION_RATE
) -> TradingFees:
    """
    计算交易费用
    
    Args:
        amount: 成交金额
        side: 订单方向（买入/卖出）
        stock_code: 股票代码
        commission_rate: 佣金费率（默认万分之三）
        
    Returns:
        TradingFees: 交易费用明细
    """
    # 佣金（买卖都收）
    commission = (amount * commission_rate).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    # 佣金最低5元
    commission = max(commission, Decimal("5.00"))
    
    # 印花税（仅卖出收取）
    stamp_tax = Decimal("0.00")
    if side == OrderSide.SELL:
        stamp_tax = (amount * STAMP_TAX_RATE).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
    
    # 过户费（仅上海市场）
    transfer_fee = Decimal("0.00")
    board_type = get_board_type(stock_code)
    if board_type in (BoardType.SHANGHAI_MAIN, BoardType.STAR):
        transfer_fee = (amount * TRANSFER_FEE_RATE).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
    
    return TradingFees(
        commission=commission,
        stamp_tax=stamp_tax,
        transfer_fee=transfer_fee
    )


def is_trading_time(dt: datetime) -> bool:
    """
    判断是否为交易时间
    
    交易时间：工作日的9:30-11:30和13:00-15:00
    
    Args:
        dt: 待判断的时间
        
    Returns:
        bool: 是否为交易时间
    """
    # 检查是否为工作日（周一到周五）
    if dt.weekday() >= 5:  # 5=周六, 6=周日
        return False
    
    current_time = dt.time()
    
    # 上午交易时段：9:30-11:30
    morning_start = time(9, 30)
    morning_end = time(11, 30)
    
    # 下午交易时段：13:00-15:00
    afternoon_start = time(13, 0)
    afternoon_end = time(15, 0)
    
    if morning_start <= current_time <= morning_end:
        return True
    
    if afternoon_start <= current_time <= afternoon_end:
        return True
    
    return False


def is_trading_day(dt: date) -> bool:
    """
    判断是否为交易日（排除周末）
    
    注意：此函数仅排除周末，不处理节假日。
    完整的节假日处理需要维护节假日日历。
    
    Args:
        dt: 待判断的日期
        
    Returns:
        bool: 是否为交易日
    """
    # 周一到周五为交易日
    return dt.weekday() < 5


def validate_quantity(quantity: int) -> ValidationResult:
    """
    验证交易数量是否为100的正整数倍
    
    Args:
        quantity: 交易数量
        
    Returns:
        ValidationResult: 验证结果
    """
    if not isinstance(quantity, int):
        return ValidationResult(
            is_valid=False,
            error_code="INVALID_QUANTITY_TYPE",
            error_message="交易数量必须是整数"
        )
    
    if quantity <= 0:
        return ValidationResult(
            is_valid=False,
            error_code="INVALID_QUANTITY_VALUE",
            error_message="交易数量必须大于0"
        )
    
    if quantity % 100 != 0:
        return ValidationResult(
            is_valid=False,
            error_code="INVALID_QUANTITY_UNIT",
            error_message=f"交易数量{quantity}必须是100的整数倍"
        )
    
    return ValidationResult(is_valid=True)
