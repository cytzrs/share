"""ModelAgent管理器 - 管理多个AI交易代理"""

import uuid
import logging
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Any

# 中国时区 (UTC+8)
CHINA_TZ = timezone(timedelta(hours=8))

from app.models.entities import (
    ModelAgent,
    Portfolio,
    Position,
    TradingDecision,
    PromptContext,
    Order,
    ValidationResult,
    PortfolioMetrics,
)
from app.models.enums import AgentStatus, DecisionType, OrderSide, OrderStatus
from app.ai.prompt_manager import PromptManager
from app.ai.llm_client import LLMClient, Message, LLMError
from app.ai.decision_parser import DecisionParser
from app.core.config import settings


logger = logging.getLogger(__name__)


@dataclass
class AgentConfig:
    """Agent配置"""
    name: str
    initial_cash: Decimal = Decimal("20000.00")
    template_id: Optional[str] = None
    llm_model: str = "gpt-4"
    schedule_type: str = "daily"


@dataclass
class DecisionResult:
    """决策执行结果"""
    success: bool
    decision: Optional[TradingDecision] = None  # 兼容旧代码，返回第一个决策
    decisions: Optional[List[TradingDecision]] = None  # 所有决策
    order: Optional[Order] = None
    validation_result: Optional[ValidationResult] = None
    error_message: Optional[str] = None
    raw_response: Optional[str] = None


@dataclass
class AgentStatusInfo:
    """Agent状态信息"""
    agent_id: str
    name: str
    status: str
    current_cash: Decimal
    total_assets: Decimal
    return_rate: Decimal
    positions_count: int
    last_decision_time: Optional[datetime] = None



class ModelAgentManager:
    """
    模型代理管理器
    
    负责执行AI交易代理的决策周期。
    注意：Agent和Portfolio数据从数据库读取，不再使用内存缓存。
    """
    
    def __init__(
        self,
        prompt_manager: Optional[PromptManager] = None,
        llm_client: Optional[LLMClient] = None,
        decision_parser: Optional[DecisionParser] = None,
    ):
        """
        初始化管理器
        
        Args:
            prompt_manager: 提示词管理器
            llm_client: LLM客户端
            decision_parser: 决策解析器
        """
        self.prompt_manager = prompt_manager or PromptManager()
        self.llm_client = llm_client
        self.decision_parser = decision_parser or DecisionParser()
        
        # 临时存储：仅用于决策执行期间的上下文传递
        # 这些数据在每次决策前从数据库加载，决策后不保留
        self._current_agent: Optional[ModelAgent] = None
        self._current_portfolio: Optional[Portfolio] = None
    
    # 以下方法已废弃，Agent的CRUD操作应通过Repository进行
    # 保留方法签名以保持向后兼容，但标记为废弃
    
    def create_agent(self, config: AgentConfig) -> ModelAgent:
        """
        [已废弃] 创建新的模型代理
        请使用 ModelAgentRepository.save() 代替
        """
        raise NotImplementedError(
            "create_agent is deprecated. Use ModelAgentRepository.save() instead."
        )
    
    def get_agent(self, agent_id: str) -> Optional[ModelAgent]:
        """
        [已废弃] 获取Agent
        请使用 ModelAgentRepository.get_by_id() 代替
        """
        raise NotImplementedError(
            "get_agent is deprecated. Use ModelAgentRepository.get_by_id() instead."
        )
    
    def list_agents(self) -> List[ModelAgent]:
        """
        [已废弃] 列出所有Agent
        请使用 ModelAgentRepository.get_all() 代替
        """
        raise NotImplementedError(
            "list_agents is deprecated. Use ModelAgentRepository.get_all() instead."
        )
    
    def update_agent(
        self,
        agent_id: str,
        name: Optional[str] = None,
        template_id: Optional[str] = None,
        llm_model: Optional[str] = None,
        schedule_type: Optional[str] = None,
    ) -> Optional[ModelAgent]:
        """
        [已废弃] 更新Agent配置
        请使用 ModelAgentRepository.save() 代替
        """
        raise NotImplementedError(
            "update_agent is deprecated. Use ModelAgentRepository.save() instead."
        )
    
    def delete_agent(self, agent_id: str) -> bool:
        """
        [已废弃] 删除Agent
        请使用 ModelAgentRepository.delete() 代替
        """
        raise NotImplementedError(
            "delete_agent is deprecated. Use ModelAgentRepository.delete() instead."
        )
    
    def pause_agent(self, agent_id: str) -> bool:
        """
        [已废弃] 暂停Agent
        请使用 ModelAgentRepository.update_status() 代替
        """
        raise NotImplementedError(
            "pause_agent is deprecated. Use ModelAgentRepository.update_status() instead."
        )
    
    def resume_agent(self, agent_id: str) -> bool:
        """
        [已废弃] 恢复Agent
        请使用 ModelAgentRepository.update_status() 代替
        """
        raise NotImplementedError(
            "resume_agent is deprecated. Use ModelAgentRepository.update_status() instead."
        )
    
    def get_portfolio(self, agent_id: str) -> Optional[Portfolio]:
        """
        [已废弃] 获取Agent的投资组合
        请使用 PortfolioRepository.get_by_agent_id() 代替
        """
        raise NotImplementedError(
            "get_portfolio is deprecated. Use PortfolioRepository.get_by_agent_id() instead."
        )

    
    def get_agent_status(
        self,
        agent: ModelAgent,
        portfolio: Portfolio,
        market_prices: Optional[Dict[str, Decimal]] = None,
    ) -> AgentStatusInfo:
        """
        获取Agent状态
        
        Args:
            agent: Agent实体（从数据库获取）
            portfolio: Portfolio实体（从数据库获取）
            market_prices: 市场价格字典
            
        Returns:
            AgentStatusInfo: Agent状态信息
        """
        # 计算总资产
        market_prices = market_prices or {}
        total_assets = portfolio.cash
        for position in portfolio.positions:
            price = market_prices.get(position.stock_code, position.avg_cost)
            total_assets += price * position.shares
        
        # 计算收益率
        return_rate = Decimal("0")
        if agent.initial_cash > 0:
            return_rate = (total_assets - agent.initial_cash) / agent.initial_cash
        
        return AgentStatusInfo(
            agent_id=agent.agent_id,
            name=agent.name,
            status=agent.status.value if isinstance(agent.status, AgentStatus) else str(agent.status),
            current_cash=portfolio.cash,
            total_assets=total_assets,
            return_rate=return_rate,
            positions_count=len(portfolio.positions),
            last_decision_time=None,
        )
    
    async def execute_decision_cycle(
        self,
        agent: ModelAgent,
        portfolio: Portfolio,
        market_data: Dict[str, Any],
        financial_data: Dict[str, Any],
        sentiment_score: float = 0.0,
        market_sentiment: Optional[Dict[str, Any]] = None,
        index_overview: Optional[Dict[str, Any]] = None,
        hot_stocks: Optional[List[Dict[str, Any]]] = None,
        hot_stocks_quotes: Optional[str] = None,
        positions_quotes: Optional[str] = None,
        mcp_tools: Optional[str] = None,
    ) -> DecisionResult:
        """
        执行一次决策周期
        
        流程：
        1. 收集市场数据
        2. 获取持仓状态
        3. 渲染提示词
        4. 调用LLM
        5. 解析决策
        6. 验证决策
        7. 返回结果（订单提交由外部处理）
        
        Args:
            agent: Agent实体（从数据库获取）
            portfolio: Portfolio实体（从数据库获取）
            market_data: 市场数据
            financial_data: 财务数据
            sentiment_score: 情绪分数
            market_sentiment: 市场情绪数据
            index_overview: 大盘概况数据
            hot_stocks: 热门股票列表
            hot_stocks_quotes: 热门股票近3日行情
            positions_quotes: 持仓股票历史行情
            mcp_tools: MCP工具列表（Markdown格式）
            
        Returns:
            DecisionResult: 决策结果
        """
        # 保存当前上下文（用于决策期间）
        self._current_agent = agent
        self._current_portfolio = portfolio
        
        if agent.status != AgentStatus.ACTIVE:
            return DecisionResult(
                success=False,
                error_message=f"Agent状态不是活跃: {agent.status}"
            )
        
        # 检查LLM客户端
        if self.llm_client is None:
            return DecisionResult(
                success=False,
                error_message="LLM客户端未配置"
            )
        
        try:
            # 1. 构建提示词上下文
            # 计算扩展字段
            cash = portfolio.cash
            positions_list = [
                {
                    "stock_code": p.stock_code,
                    "shares": p.shares,
                    "avg_cost": str(p.avg_cost),
                    "buy_date": p.buy_date,
                }
                for p in portfolio.positions
            ]
            
            # 计算市值（简化：使用成本价，实际应使用市场价）
            market_value = sum(
                p.avg_cost * p.shares for p in portfolio.positions
            )
            total_assets = cash + market_value
            return_rate = Decimal("0")
            if agent.initial_cash > 0:
                return_rate = ((total_assets - agent.initial_cash) / agent.initial_cash) * 100
            
            context = PromptContext(
                current_market=market_data,
                history_trades=[],  # 交易历史应从数据库获取
                financial_data=financial_data,
                portfolio_status=self._portfolio_to_dict(portfolio),
                sentiment_score=sentiment_score,
                market_sentiment=market_sentiment,
                # 扩展字段
                cash=cash,
                market_value=market_value,
                total_assets=total_assets,
                return_rate=return_rate,
                positions=positions_list,
                positions_quotes=positions_quotes,  # 持仓股票历史行情
                market_data=market_data,  # 同 current_market
                hot_stocks_quotes=hot_stocks_quotes,  # 热门股票近3日行情
                # 系统时间字段
                current_time=datetime.now(CHINA_TZ).strftime("%H:%M:%S"),
                current_date=datetime.now(CHINA_TZ).strftime("%Y-%m-%d"),
                current_weekday=self._get_weekday_name(datetime.now(CHINA_TZ).weekday()),
                is_trading_day=self._is_trading_time(),
                # MCP工具字段
                mcp_tools=mcp_tools,
            )
            
            # 2. 渲染提示词
            prompt = None
            if agent.template_id:
                try:
                    prompt = self.prompt_manager.render(agent.template_id, context)
                except ValueError:
                    # 模板不存在，使用默认提示词
                    logger.warning(f"模板 {agent.template_id} 不存在，使用默认提示词")
                    prompt = self._build_default_prompt(context)
            else:
                prompt = self._build_default_prompt(context)
            
            # 3. 调用LLM
            response = await self.llm_client.chat_simple(
                prompt=prompt,
                model=agent.llm_model,
            )
            
            # 4. 解析决策（支持多个）
            decisions = self.decision_parser.parse_decisions(response)
            if not decisions:
                return DecisionResult(
                    success=False,
                    error_message="无法解析LLM响应",
                    raw_response=response,
                )
            
            # 5. 验证所有决策
            valid_decisions = []
            validation = None
            for decision in decisions:
                validation = self.decision_parser.validate_decision(
                    decision,
                    portfolio=portfolio,
                )
                if validation.is_valid:
                    valid_decisions.append(decision)
                else:
                    logger.warning(f"决策验证失败: {decision.stock_code} - {validation.error_message}")
            
            if not valid_decisions:
                # 所有决策都验证失败
                return DecisionResult(
                    success=False,
                    decision=decisions[0] if decisions else None,
                    decisions=decisions,
                    validation_result=validation,
                    error_message=f"所有决策验证失败: {validation.error_message if validation else 'unknown'}",
                    raw_response=response,
                )
            
            # 6. 返回成功结果（包含所有有效决策）
            result = DecisionResult(
                success=True,
                decision=valid_decisions[0],  # 兼容旧代码
                decisions=valid_decisions,  # 所有有效决策
                validation_result=ValidationResult(is_valid=True),
                raw_response=response,
            )
            
            logger.info(f"Agent {agent.agent_id} 决策成功: {len(valid_decisions)}个有效决策")
            return result
            
        except LLMError as e:
            return DecisionResult(
                success=False,
                error_message=f"LLM调用失败: {str(e)}"
            )
        except Exception as e:
            logger.exception(f"决策周期执行失败: {e}")
            return DecisionResult(
                success=False,
                error_message=f"决策执行失败: {str(e)}"
            )
        finally:
            # 清理临时上下文
            self._current_agent = None
            self._current_portfolio = None
    
    def _portfolio_to_dict(self, portfolio: Portfolio) -> Dict[str, Any]:
        """将Portfolio转换为字典"""
        return {
            "cash": str(portfolio.cash),
            "positions": [
                {
                    "stock_code": p.stock_code,
                    "shares": p.shares,
                    "avg_cost": str(p.avg_cost),
                    "buy_date": p.buy_date,
                }
                for p in portfolio.positions
            ],
        }
    
    def _build_default_prompt(self, context: PromptContext) -> str:
        """构建默认提示词"""
        return f"""你是一个专业的量化交易分析师。请根据以下市场数据和持仓状态，给出交易建议。

## 当前市场数据
{context.current_market}

## 历史交易记录
{context.history_trades}

## 财务数据
{context.financial_data}

## 当前持仓状态
{context.portfolio_status}

## 市场情绪分数
{context.sentiment_score}

请分析以上数据，并以JSON格式返回你的交易决策：
{{
    "decision": "buy" | "sell" | "hold" | "wait",
    "stock_code": "股票代码（如果是买入或卖出）",
    "quantity": 数量（必须是100的整数倍）,
    "price": 价格,
    "reason": "决策理由"
}}
"""
    
    def _get_weekday_name(self, weekday: int) -> str:
        """获取星期几的中文名称"""
        weekday_names = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"]
        return weekday_names[weekday] if 0 <= weekday <= 6 else "未知"
    
    def _is_trading_time(self) -> bool:
        """
        判断当前是否为A股交易时间
        交易时间：周一至周五 9:30-11:30, 13:00-15:00
        注意：不包含节假日判断，实际应用中需要接入交易日历
        """
        now = datetime.now(CHINA_TZ)
        weekday = now.weekday()
        
        # 周末不交易
        if weekday >= 5:
            return False
        
        # 检查时间段
        current_time = now.hour * 100 + now.minute
        
        # 上午 9:30-11:30
        morning_start = 930
        morning_end = 1130
        
        # 下午 13:00-15:00
        afternoon_start = 1300
        afternoon_end = 1500
        
        return (morning_start <= current_time <= morning_end) or \
               (afternoon_start <= current_time <= afternoon_end)
