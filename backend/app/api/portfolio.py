"""投资组合API路由"""

from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.repositories import (
    ModelAgentRepository,
    PortfolioRepository,
    PositionRepository,
    TransactionRepository,
    OrderRepository,
)
from app.data.repositories import StockQuoteRepository
from app.core.portfolio_manager import (
    calculate_total_assets,
    calculate_market_value,
    calculate_return_rate,
    calculate_max_drawdown,
    calculate_portfolio_metrics,
)
from app.models.enums import AgentStatus, OrderSide
from app.api.schemas import (
    PortfolioResponse,
    PositionResponse,
    TransactionResponse,
    TransactionListResponse,
    MetricsResponse,
    CompareRequest,
    CompareResponse,
    AgentCompareData,
    ErrorResponse,
)

router = APIRouter()


def _get_market_prices(
    db: Session,
    stock_codes: List[str],
) -> dict:
    """获取股票当前市场价格（批量查询优化）"""
    if not stock_codes:
        return {}
    
    from app.db.models import StockQuoteModel
    from sqlalchemy import func
    
    # 使用子查询获取每只股票的最新行情日期
    latest_dates_subquery = (
        db.query(
            StockQuoteModel.stock_code,
            func.max(StockQuoteModel.trade_date).label("max_date")
        )
        .filter(StockQuoteModel.stock_code.in_(stock_codes))
        .group_by(StockQuoteModel.stock_code)
        .subquery()
    )
    
    # 获取最新行情
    latest_quotes = (
        db.query(StockQuoteModel)
        .join(
            latest_dates_subquery,
            (StockQuoteModel.stock_code == latest_dates_subquery.c.stock_code) &
            (StockQuoteModel.trade_date == latest_dates_subquery.c.max_date)
        )
        .all()
    )
    
    return {q.stock_code: q.close_price for q in latest_quotes}


def _get_stock_names(
    db: Session,
    stock_codes: List[str],
) -> dict:
    """获取股票名称（批量查询优化）"""
    if not stock_codes:
        return {}
    
    from app.db.models import StockQuoteModel
    from sqlalchemy import func
    
    # 获取每只股票最新记录的名称
    latest_dates_subquery = (
        db.query(
            StockQuoteModel.stock_code,
            func.max(StockQuoteModel.trade_date).label("max_date")
        )
        .filter(StockQuoteModel.stock_code.in_(stock_codes))
        .filter(StockQuoteModel.stock_name.isnot(None))
        .group_by(StockQuoteModel.stock_code)
        .subquery()
    )
    
    latest_quotes = (
        db.query(StockQuoteModel.stock_code, StockQuoteModel.stock_name)
        .join(
            latest_dates_subquery,
            (StockQuoteModel.stock_code == latest_dates_subquery.c.stock_code) &
            (StockQuoteModel.trade_date == latest_dates_subquery.c.max_date)
        )
        .all()
    )
    
    return {q.stock_code: q.stock_name for q in latest_quotes}


@router.get(
    "/{agent_id}/portfolio",
    response_model=PortfolioResponse,
    summary="获取投资组合",
    description="获取指定Agent的投资组合详情",
    responses={
        404: {"model": ErrorResponse, "description": "Agent不存在"},
    },
)
async def get_portfolio(
    agent_id: str,
    db: Session = Depends(get_db),
):
    """获取投资组合"""
    agent_repo = ModelAgentRepository(db)
    portfolio_repo = PortfolioRepository(db)
    
    agent = agent_repo.get_by_id(agent_id)
    if agent is None or agent.status == AgentStatus.DELETED:
        raise HTTPException(
            status_code=404,
            detail={"error_code": "AGENT_NOT_FOUND", "message": f"Agent不存在: {agent_id}"}
        )
    
    portfolio = portfolio_repo.get_by_agent_id(agent_id)
    if portfolio is None:
        raise HTTPException(
            status_code=404,
            detail={"error_code": "PORTFOLIO_NOT_FOUND", "message": f"Portfolio不存在: {agent_id}"}
        )
    
    # 获取市场价格和股票名称
    stock_codes = [p.stock_code for p in portfolio.positions]
    market_prices = _get_market_prices(db, stock_codes)
    stock_names = _get_stock_names(db, stock_codes)
    
    # 构建持仓响应
    positions = []
    for pos in portfolio.positions:
        current_price = market_prices.get(pos.stock_code, pos.avg_cost)
        market_value = current_price * pos.shares
        cost_value = pos.avg_cost * pos.shares
        profit_loss = market_value - cost_value
        profit_loss_rate = (profit_loss / cost_value) if cost_value > 0 else Decimal("0")
        
        positions.append(PositionResponse(
            stock_code=pos.stock_code,
            stock_name=stock_names.get(pos.stock_code),
            shares=pos.shares,
            avg_cost=pos.avg_cost,
            buy_date=pos.buy_date,
            current_price=current_price,
            market_value=market_value,
            profit_loss=profit_loss,
            profit_loss_rate=profit_loss_rate,
        ))
    
    # 计算总市值和总资产
    total_market_value = calculate_market_value(portfolio, market_prices)
    total_assets = calculate_total_assets(portfolio, market_prices)
    
    return PortfolioResponse(
        agent_id=agent_id,
        cash=portfolio.cash,
        total_market_value=total_market_value,
        total_assets=total_assets,
        positions=positions,
    )


@router.get(
    "/{agent_id}/transactions",
    response_model=TransactionListResponse,
    summary="获取交易记录",
    description="获取指定Agent的交易记录，支持分页和筛选",
    responses={
        404: {"model": ErrorResponse, "description": "Agent不存在"},
    },
)
async def get_transactions(
    agent_id: str,
    page: int = Query(default=1, ge=1, description="页码"),
    page_size: int = Query(default=20, ge=1, le=100, description="每页数量"),
    stock_code: Optional[str] = Query(default=None, description="按股票代码筛选"),
    side: Optional[str] = Query(default=None, description="按交易方向筛选 (buy/sell)"),
    start_date: Optional[str] = Query(default=None, description="开始日期"),
    end_date: Optional[str] = Query(default=None, description="结束日期"),
    db: Session = Depends(get_db),
):
    """获取交易记录"""
    agent_repo = ModelAgentRepository(db)
    tx_repo = TransactionRepository(db)
    order_repo = OrderRepository(db)
    
    agent = agent_repo.get_by_id(agent_id)
    if agent is None or agent.status == AgentStatus.DELETED:
        raise HTTPException(
            status_code=404,
            detail={"error_code": "AGENT_NOT_FOUND", "message": f"Agent不存在: {agent_id}"}
        )
    
    # 解析交易方向
    order_side = None
    if side:
        try:
            order_side = OrderSide(side)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail={"error_code": "INVALID_SIDE", "message": f"无效的交易方向: {side}"}
            )
    
    # 获取交易记录
    if start_date and end_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail={"error_code": "INVALID_DATE", "message": "日期格式错误"}
            )
        transactions = tx_repo.get_by_date_range(
            agent_id, start_dt, end_dt, stock_code, order_side
        )
    elif stock_code:
        transactions = tx_repo.get_by_agent_and_stock(agent_id, stock_code)
    else:
        offset = (page - 1) * page_size
        transactions = tx_repo.get_by_agent(agent_id, limit=page_size, offset=offset, side=order_side)
    
    # 获取总数
    total = tx_repo.count_by_agent(agent_id, side=order_side)
    total_pages = (total + page_size - 1) // page_size
    
    # 构建响应，包含订单的reason
    tx_responses = []
    for tx in transactions:
        # 获取订单的reason
        order = order_repo.get_by_id(tx.order_id)
        reason = order.reason if order else None
        
        # hold 决策时 fees 可能为空
        total_fees = None
        if tx.fees.commission is not None or tx.fees.stamp_tax is not None or tx.fees.transfer_fee is not None:
            total_fees = tx.fees.total
        
        tx_responses.append(TransactionResponse(
            tx_id=tx.tx_id,
            order_id=tx.order_id,
            agent_id=tx.agent_id,
            stock_code=tx.stock_code,
            side=tx.side.value,
            quantity=tx.quantity,
            price=tx.price if tx.price and tx.price > 0 else None,
            commission=tx.fees.commission if tx.fees.commission and tx.fees.commission > 0 else None,
            stamp_tax=tx.fees.stamp_tax if tx.fees.stamp_tax and tx.fees.stamp_tax > 0 else None,
            transfer_fee=tx.fees.transfer_fee if tx.fees.transfer_fee and tx.fees.transfer_fee > 0 else None,
            total_fees=total_fees if total_fees and total_fees > 0 else None,
            executed_at=tx.executed_at,
            reason=reason,
        ))
    
    return TransactionListResponse(
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        transactions=tx_responses,
    )


@router.get(
    "/transactions/{tx_id}/llm-log",
    summary="获取交易记录对应的LLM请求日志",
    description="通过交易记录ID获取对应的LLM接口调用日志",
    responses={
        404: {"model": ErrorResponse, "description": "交易记录或日志不存在"},
    },
)
async def get_transaction_llm_log(
    tx_id: str,
    db: Session = Depends(get_db),
):
    """获取交易记录对应的LLM请求日志
    
    通过交易记录关联的订单，获取LLM接口调用日志
    """
    from app.db.models import TransactionModel, OrderModel, LLMRequestLogModel
    
    # 查找交易记录
    tx = db.query(TransactionModel).filter(TransactionModel.tx_id == tx_id).first()
    if not tx:
        raise HTTPException(
            status_code=404,
            detail={"error_code": "TRANSACTION_NOT_FOUND", "message": f"交易记录不存在: {tx_id}"}
        )
    
    # 查找关联的订单
    order = db.query(OrderModel).filter(OrderModel.order_id == tx.order_id).first()
    if not order or not order.llm_request_log_id:
        raise HTTPException(
            status_code=404,
            detail={"error_code": "LLM_LOG_NOT_FOUND", "message": "该交易记录没有关联的LLM请求日志"}
        )
    
    # 查找LLM请求日志
    log = db.query(LLMRequestLogModel).filter(LLMRequestLogModel.id == order.llm_request_log_id).first()
    if not log:
        raise HTTPException(
            status_code=404,
            detail={"error_code": "LLM_LOG_NOT_FOUND", "message": f"LLM请求日志不存在: {order.llm_request_log_id}"}
        )
    
    return {
        "id": log.id,
        "provider_id": log.provider_id,
        "model_name": log.model_name,
        "agent_id": log.agent_id,
        "request_content": log.request_content,
        "response_content": log.response_content,
        "duration_ms": log.duration_ms,
        "status": log.status,
        "error_message": log.error_message,
        "tokens_input": log.tokens_input,
        "tokens_output": log.tokens_output,
        "request_time": log.request_time,
    }


@router.get(
    "/{agent_id}/metrics",
    response_model=MetricsResponse,
    summary="获取风险指标",
    description="获取指定Agent的风险指标",
    responses={
        404: {"model": ErrorResponse, "description": "Agent不存在"},
    },
)
async def get_metrics(
    agent_id: str,
    db: Session = Depends(get_db),
):
    """获取风险指标"""
    agent_repo = ModelAgentRepository(db)
    portfolio_repo = PortfolioRepository(db)
    
    agent = agent_repo.get_by_id(agent_id)
    if agent is None or agent.status == AgentStatus.DELETED:
        raise HTTPException(
            status_code=404,
            detail={"error_code": "AGENT_NOT_FOUND", "message": f"Agent不存在: {agent_id}"}
        )
    
    portfolio = portfolio_repo.get_by_agent_id(agent_id)
    if portfolio is None:
        raise HTTPException(
            status_code=404,
            detail={"error_code": "PORTFOLIO_NOT_FOUND", "message": f"Portfolio不存在: {agent_id}"}
        )
    
    # 获取市场价格
    stock_codes = [p.stock_code for p in portfolio.positions]
    market_prices = _get_market_prices(db, stock_codes)
    
    # 计算持有天数
    from app.core.timezone import now as tz_now
    days_held = (tz_now() - agent.created_at).days
    if days_held < 1:
        days_held = 1  # 至少1天
    
    # 计算指标
    metrics = calculate_portfolio_metrics(
        portfolio=portfolio,
        initial_cash=agent.initial_cash,
        market_prices=market_prices,
        asset_history=None,  # TODO: 从历史数据获取
        days_held=days_held,
    )
    
    return MetricsResponse(
        agent_id=agent_id,
        total_assets=metrics.total_assets,
        total_market_value=metrics.total_market_value,
        cash_balance=metrics.cash_balance,
        total_return=metrics.total_return,
        return_rate=metrics.return_rate,
        annualized_return=metrics.annualized_return,
        max_drawdown=metrics.max_drawdown,
        sharpe_ratio=metrics.sharpe_ratio,
    )


@router.get(
    "/{agent_id}/asset-history",
    summary="获取资产历史",
    description="获取指定Agent的资产历史数据",
    responses={
        404: {"model": ErrorResponse, "description": "Agent不存在"},
    },
)
async def get_asset_history(
    agent_id: str,
    start_date: Optional[str] = Query(default=None, description="开始日期"),
    end_date: Optional[str] = Query(default=None, description="结束日期"),
    db: Session = Depends(get_db),
):
    """获取资产历史数据
    
    用于绘制资产曲线图
    """
    agent_repo = ModelAgentRepository(db)
    portfolio_repo = PortfolioRepository(db)
    
    agent = agent_repo.get_by_id(agent_id)
    if agent is None or agent.status == AgentStatus.DELETED:
        raise HTTPException(
            status_code=404,
            detail={"error_code": "AGENT_NOT_FOUND", "message": f"Agent不存在: {agent_id}"}
        )
    
    portfolio = portfolio_repo.get_by_agent_id(agent_id)
    if portfolio is None:
        raise HTTPException(
            status_code=404,
            detail={"error_code": "PORTFOLIO_NOT_FOUND", "message": f"Portfolio不存在: {agent_id}"}
        )
    
    # 获取市场价格计算当前资产
    stock_codes = [p.stock_code for p in portfolio.positions]
    market_prices = _get_market_prices(db, stock_codes)
    current_assets = calculate_total_assets(portfolio, market_prices)
    
    # 返回简化的资产历史（当前只返回初始和当前值）
    # TODO: 实现完整的资产历史记录
    from datetime import date
    history = [
        {"date": agent.created_at.strftime("%Y-%m-%d"), "value": float(agent.initial_cash)},
        {"date": date.today().strftime("%Y-%m-%d"), "value": float(current_assets)},
    ]
    
    return history


@router.get(
    "/{agent_id}/history-positions",
    summary="获取历史持仓",
    description="获取指定Agent的历史持仓（已清仓的股票）",
    responses={
        404: {"model": ErrorResponse, "description": "Agent不存在"},
    },
)
async def get_history_positions(
    agent_id: str,
    db: Session = Depends(get_db),
):
    """获取历史持仓
    
    从交易记录中计算已清仓的股票持仓历史
    返回曾经持有但现在持仓为0的股票
    """
    agent_repo = ModelAgentRepository(db)
    tx_repo = TransactionRepository(db)
    position_repo = PositionRepository(db)
    
    agent = agent_repo.get_by_id(agent_id)
    if agent is None or agent.status == AgentStatus.DELETED:
        raise HTTPException(
            status_code=404,
            detail={"error_code": "AGENT_NOT_FOUND", "message": f"Agent不存在: {agent_id}"}
        )
    
    # 获取当前持仓的股票代码
    current_positions = position_repo.get_all_by_agent(agent_id)
    current_stock_codes = {p.stock_code for p in current_positions}
    
    # 获取所有交易记录
    all_transactions = tx_repo.get_by_agent(agent_id, limit=1000, offset=0)
    
    # 按股票代码分组计算历史持仓
    stock_history = {}  # stock_code -> {buy_qty, sell_qty, buy_amount, sell_amount, first_buy_date, last_sell_date, avg_cost}
    
    for tx in all_transactions:
        code = tx.stock_code
        # 跳过没有股票代码的交易（如 hold 决策）
        if not code:
            continue
        # 跳过没有数量或价格的交易
        if tx.quantity is None or tx.price is None:
            continue
            
        if code not in stock_history:
            stock_history[code] = {
                'buy_qty': 0,
                'sell_qty': 0,
                'buy_amount': Decimal('0'),
                'sell_amount': Decimal('0'),
                'first_buy_date': None,
                'last_sell_date': None,
            }
        
        if tx.side == OrderSide.BUY:
            stock_history[code]['buy_qty'] += tx.quantity
            stock_history[code]['buy_amount'] += tx.price * tx.quantity
            if stock_history[code]['first_buy_date'] is None or tx.executed_at.strftime('%Y-%m-%d') < stock_history[code]['first_buy_date']:
                stock_history[code]['first_buy_date'] = tx.executed_at.strftime('%Y-%m-%d')
        elif tx.side == OrderSide.SELL:
            stock_history[code]['sell_qty'] += tx.quantity
            stock_history[code]['sell_amount'] += tx.price * tx.quantity
            if stock_history[code]['last_sell_date'] is None or tx.executed_at.strftime('%Y-%m-%d') > stock_history[code]['last_sell_date']:
                stock_history[code]['last_sell_date'] = tx.executed_at.strftime('%Y-%m-%d')
    
    # 筛选已清仓的股票（不在当前持仓中，且有卖出记录）
    history_stock_codes = [code for code in stock_history.keys() if code not in current_stock_codes and stock_history[code]['sell_qty'] > 0]
    stock_names = _get_stock_names(db, history_stock_codes)
    
    history_positions = []
    for code, data in stock_history.items():
        # 跳过当前仍持有的股票
        if code in current_stock_codes:
            continue
        
        # 跳过没有卖出记录的股票
        if data['sell_qty'] == 0:
            continue
        
        # 计算平均成本和盈亏
        avg_cost = data['buy_amount'] / data['buy_qty'] if data['buy_qty'] > 0 else Decimal('0')
        avg_sell_price = data['sell_amount'] / data['sell_qty'] if data['sell_qty'] > 0 else Decimal('0')
        
        # 计算已实现盈亏（基于实际卖出的数量）
        realized_qty = min(data['buy_qty'], data['sell_qty'])
        cost_basis = avg_cost * realized_qty
        sell_proceeds = data['sell_amount']
        profit_loss = sell_proceeds - cost_basis
        profit_loss_rate = (profit_loss / cost_basis * 100) if cost_basis > 0 else Decimal('0')
        
        history_positions.append({
            'stock_code': code,
            'stock_name': stock_names.get(code),
            'shares': 0,  # 已清仓
            'avg_cost': float(avg_cost),
            'buy_date': data['first_buy_date'],
            'sell_date': data['last_sell_date'],
            'current_price': float(avg_sell_price),  # 使用平均卖出价作为参考
            'market_value': 0,
            'profit_loss': float(profit_loss),
            'profit_loss_rate': float(profit_loss_rate),
            'total_buy_qty': data['buy_qty'],
            'total_sell_qty': data['sell_qty'],
        })
    
    # 按最后卖出日期降序排序
    history_positions.sort(key=lambda x: x['sell_date'] or '', reverse=True)
    
    return history_positions


@router.get(
    "/positions/summary",
    summary="获取所有Agent持仓汇总",
    description="按股票维度统计所有Agent的持仓数据，用于柱状图展示",
)
async def get_all_positions_summary(
    db: Session = Depends(get_db),
):
    """获取所有Agent持仓汇总
    
    返回按股票维度的持仓数据，每只股票包含各Agent的持仓市值
    """
    agent_repo = ModelAgentRepository(db)
    portfolio_repo = PortfolioRepository(db)
    
    # 获取所有活跃的Agent
    agents = agent_repo.get_active()
    
    # 收集所有持仓的股票代码
    all_stock_codes = set()
    agent_positions = {}  # agent_id -> {stock_code -> position}
    
    for agent in agents:
        portfolio = portfolio_repo.get_by_agent_id(agent.agent_id)
        if portfolio and portfolio.positions:
            agent_positions[agent.agent_id] = {}
            for pos in portfolio.positions:
                all_stock_codes.add(pos.stock_code)
                agent_positions[agent.agent_id][pos.stock_code] = pos
    
    if not all_stock_codes:
        return {"stocks": [], "agents": []}
    
    # 获取市场价格和股票名称
    stock_codes_list = list(all_stock_codes)
    market_prices = _get_market_prices(db, stock_codes_list)
    stock_names = _get_stock_names(db, stock_codes_list)
    
    # 构建Agent信息列表
    agents_info = [
        {"agent_id": agent.agent_id, "name": agent.name, "llm_model": agent.llm_model}
        for agent in agents
        if agent.agent_id in agent_positions
    ]
    
    # 构建股票持仓数据
    stocks_data = []
    for stock_code in sorted(all_stock_codes):
        stock_item = {
            "stock_code": stock_code,
            "stock_name": stock_names.get(stock_code, stock_code),
            "positions": []
        }
        
        for agent in agents:
            if agent.agent_id not in agent_positions:
                continue
            
            pos = agent_positions[agent.agent_id].get(stock_code)
            if pos:
                current_price = market_prices.get(stock_code, pos.avg_cost)
                market_value = float(current_price * pos.shares)
                stock_item["positions"].append({
                    "agent_id": agent.agent_id,
                    "agent_name": agent.name,
                    "shares": pos.shares,
                    "market_value": market_value,
                })
        
        # 只添加有持仓的股票
        if stock_item["positions"]:
            stocks_data.append(stock_item)
    
    # 按总市值排序
    stocks_data.sort(
        key=lambda x: sum(p["market_value"] for p in x["positions"]),
        reverse=True
    )
    
    return {"stocks": stocks_data, "agents": agents_info}


@router.post(
    "/compare",
    response_model=CompareResponse,
    summary="多模型对比",
    description="对比多个Agent的表现",
    responses={
        400: {"model": ErrorResponse, "description": "请求参数错误"},
        404: {"model": ErrorResponse, "description": "Agent不存在"},
    },
)
async def compare_agents(
    request: CompareRequest,
    db: Session = Depends(get_db),
):
    """多模型对比"""
    agent_repo = ModelAgentRepository(db)
    portfolio_repo = PortfolioRepository(db)
    
    compare_data = []
    
    for agent_id in request.agent_ids:
        agent = agent_repo.get_by_id(agent_id)
        if agent is None or agent.status == AgentStatus.DELETED:
            raise HTTPException(
                status_code=404,
                detail={"error_code": "AGENT_NOT_FOUND", "message": f"Agent不存在: {agent_id}"}
            )
        
        portfolio = portfolio_repo.get_by_agent_id(agent_id)
        if portfolio is None:
            continue
        
        # 获取市场价格
        stock_codes = [p.stock_code for p in portfolio.positions]
        market_prices = _get_market_prices(db, stock_codes)
        
        # 计算指标
        metrics = calculate_portfolio_metrics(
            portfolio=portfolio,
            initial_cash=agent.initial_cash,
            market_prices=market_prices,
        )
        
        compare_data.append(AgentCompareData(
            agent_id=agent_id,
            name=agent.name,
            return_rate=metrics.return_rate,
            max_drawdown=metrics.max_drawdown,
            sharpe_ratio=metrics.sharpe_ratio,
            total_assets=metrics.total_assets,
        ))
    
    # 构建对比周期描述
    comparison_period = None
    if request.start_date and request.end_date:
        comparison_period = f"{request.start_date} 至 {request.end_date}"
    
    return CompareResponse(
        agents=compare_data,
        comparison_period=comparison_period,
    )
