"""核心配置模块"""

from app.core.trading_rules import (
    BoardType,
    get_board_type,
    validate_stock_code,
    get_price_limit_rate,
    validate_price_limit,
    validate_t_plus_1,
    calculate_fees,
    is_trading_time,
    is_trading_day,
    validate_quantity,
)

from app.core.scheduler import (
    Scheduler,
    ScheduleConfig,
    ScheduleRecord,
    ScheduleStatus,
    ScheduleStatusInfo,
    get_scheduler,
    init_scheduler,
    shutdown_scheduler,
)

__all__ = [
    "BoardType",
    "get_board_type",
    "validate_stock_code",
    "get_price_limit_rate",
    "validate_price_limit",
    "validate_t_plus_1",
    "calculate_fees",
    "is_trading_time",
    "is_trading_day",
    "validate_quantity",
    # Scheduler exports
    "Scheduler",
    "ScheduleConfig",
    "ScheduleRecord",
    "ScheduleStatus",
    "ScheduleStatusInfo",
    "get_scheduler",
    "init_scheduler",
    "shutdown_scheduler",
]
