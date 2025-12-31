"""提示词模板管理器 - 管理和渲染AI模型的提示词模板"""

import re
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any

from jinja2 import Environment, BaseLoader, TemplateSyntaxError, UndefinedError

from app.models.entities import PromptTemplate, PromptContext, ValidationResult


class PromptManager:
    """
    提示词管理器
    
    负责管理和渲染AI模型的提示词模板。
    支持创建、编辑、删除模板，以及使用Jinja2进行模板渲染。
    """
    
    # 占位符模式：匹配 {{xxx}} 格式
    PLACEHOLDER_PATTERN = re.compile(r"\{\{[\s]*(\w+)[\s]*\}\}")
    
    def __init__(self):
        """初始化提示词管理器"""
        # 内存存储（实际应用中应使用数据库）
        self._templates: Dict[str, PromptTemplate] = {}
        
        # Jinja2环境配置
        self._jinja_env = Environment(
            loader=BaseLoader(),
            autoescape=False,
            # 使用 {{ }} 作为变量分隔符
            variable_start_string="{{",
            variable_end_string="}}",
        )
    
    def create_template(
        self,
        name: str,
        content: str,
        template_id: Optional[str] = None,
    ) -> PromptTemplate:
        """
        创建新的提示词模板
        
        Args:
            name: 模板名称
            content: 模板内容
            template_id: 可选的模板ID，不提供则自动生成
            
        Returns:
            PromptTemplate: 创建的模板对象
            
        Raises:
            ValueError: 如果模板语法无效
        """
        # 验证模板语法
        validation = self.validate_template(content)
        if not validation.is_valid:
            raise ValueError(f"模板语法错误: {validation.error_message}")
        
        # 生成模板ID
        if template_id is None:
            template_id = str(uuid.uuid4())
        
        now = datetime.now()
        template = PromptTemplate(
            template_id=template_id,
            name=name,
            content=content,
            version=1,
            created_at=now,
            updated_at=now,
        )
        
        self._templates[template_id] = template
        return template
    
    def get_template(self, template_id: str) -> Optional[PromptTemplate]:
        """
        获取模板
        
        Args:
            template_id: 模板ID
            
        Returns:
            Optional[PromptTemplate]: 模板对象，不存在则返回None
        """
        return self._templates.get(template_id)
    
    def update_template(
        self,
        template_id: str,
        name: Optional[str] = None,
        content: Optional[str] = None,
    ) -> Optional[PromptTemplate]:
        """
        更新模板
        
        Args:
            template_id: 模板ID
            name: 新的模板名称（可选）
            content: 新的模板内容（可选）
            
        Returns:
            Optional[PromptTemplate]: 更新后的模板，不存在则返回None
            
        Raises:
            ValueError: 如果新内容的模板语法无效
        """
        template = self._templates.get(template_id)
        if template is None:
            return None
        
        # 如果更新内容，先验证语法
        if content is not None:
            validation = self.validate_template(content)
            if not validation.is_valid:
                raise ValueError(f"模板语法错误: {validation.error_message}")
        
        # 创建新版本
        new_template = PromptTemplate(
            template_id=template_id,
            name=name if name is not None else template.name,
            content=content if content is not None else template.content,
            version=template.version + 1,
            created_at=template.created_at,
            updated_at=datetime.now(),
        )
        
        self._templates[template_id] = new_template
        return new_template
    
    def delete_template(self, template_id: str) -> bool:
        """
        删除模板
        
        Args:
            template_id: 模板ID
            
        Returns:
            bool: 是否删除成功
        """
        if template_id in self._templates:
            del self._templates[template_id]
            return True
        return False
    
    def list_templates(self) -> List[PromptTemplate]:
        """
        列出所有模板
        
        Returns:
            List[PromptTemplate]: 模板列表
        """
        return list(self._templates.values())
    
    def validate_template(self, content: str) -> ValidationResult:
        """
        验证模板语法正确性
        
        检查：
        1. Jinja2语法是否正确
        2. 占位符格式是否正确
        
        Args:
            content: 模板内容
            
        Returns:
            ValidationResult: 验证结果
        """
        if not content:
            return ValidationResult(
                is_valid=False,
                error_code="EMPTY_TEMPLATE",
                error_message="模板内容不能为空"
            )
        
        try:
            # 尝试编译模板以验证Jinja2语法
            self._jinja_env.from_string(content)
            return ValidationResult(is_valid=True)
        except TemplateSyntaxError as e:
            return ValidationResult(
                is_valid=False,
                error_code="TEMPLATE_SYNTAX_ERROR",
                error_message=f"模板语法错误: {str(e)}"
            )
    
    def render(
        self,
        template_id: str,
        context: PromptContext,
    ) -> str:
        """
        渲染模板，用实际数据替换占位符
        
        Args:
            template_id: 模板ID
            context: 提示词上下文数据
            
        Returns:
            str: 渲染后的字符串
            
        Raises:
            ValueError: 如果模板不存在或渲染失败
        """
        template = self._templates.get(template_id)
        if template is None:
            raise ValueError(f"模板不存在: {template_id}")
        
        return self.render_content(template.content, context)
    
    def render_content(
        self,
        content: str,
        context: PromptContext,
    ) -> str:
        """
        直接渲染模板内容
        
        Args:
            content: 模板内容
            context: 提示词上下文数据
            
        Returns:
            str: 渲染后的字符串
            
        Raises:
            ValueError: 如果渲染失败
        """
        # 构建上下文字典
        context_dict = self._context_to_dict(context)
        
        try:
            jinja_template = self._jinja_env.from_string(content)
            rendered = jinja_template.render(**context_dict)
            return rendered
        except UndefinedError as e:
            raise ValueError(f"模板渲染失败，缺少变量: {str(e)}")
        except Exception as e:
            raise ValueError(f"模板渲染失败: {str(e)}")
    
    def _context_to_dict(self, context: PromptContext) -> Dict[str, Any]:
        """
        将PromptContext转换为字典
        
        Args:
            context: 提示词上下文
            
        Returns:
            Dict[str, Any]: 上下文字典
        """
        result = {
            "current_market": context.current_market,
            "history_trades": context.history_trades,
            "financial_data": context.financial_data,
            "portfolio_status": context.portfolio_status,
            "sentiment_score": context.sentiment_score,
        }
        
        # 账户资产类
        if context.cash is not None:
            result["cash"] = str(context.cash)
        if context.market_value is not None:
            result["market_value"] = str(context.market_value)
        if context.total_assets is not None:
            result["total_assets"] = str(context.total_assets)
        if context.return_rate is not None:
            result["return_rate"] = str(context.return_rate)
        if context.positions is not None:
            result["positions"] = context.positions
        if context.positions_quotes is not None:
            result["positions_quotes"] = context.positions_quotes
        if context.market_data is not None:
            result["market_data"] = context.market_data
        
        # 技术指标类
        if context.tech_indicators is not None:
            result["tech_indicators"] = context.tech_indicators
        if context.ma_data is not None:
            result["ma_data"] = context.ma_data
        if context.macd_data is not None:
            result["macd_data"] = context.macd_data
        if context.kdj_data is not None:
            result["kdj_data"] = context.kdj_data
        if context.rsi_data is not None:
            result["rsi_data"] = context.rsi_data
        if context.boll_data is not None:
            result["boll_data"] = context.boll_data
        
        # 资金流向类
        if context.fund_flow is not None:
            result["fund_flow"] = context.fund_flow
        if context.fund_flow_rank is not None:
            result["fund_flow_rank"] = context.fund_flow_rank
        if context.north_fund is not None:
            result["north_fund"] = context.north_fund
        
        # 财务指标类
        if context.financial_indicator is not None:
            result["financial_indicator"] = context.financial_indicator
        if context.profit_data is not None:
            result["profit_data"] = context.profit_data
        if context.balance_data is not None:
            result["balance_data"] = context.balance_data
        if context.cashflow_data is not None:
            result["cashflow_data"] = context.cashflow_data
        
        # 市场情绪类
        if context.news_sentiment is not None:
            result["news_sentiment"] = context.news_sentiment
        if context.market_sentiment is not None:
            result["market_sentiment"] = context.market_sentiment
        
        # 历史数据类
        if context.history_quotes is not None:
            result["history_quotes"] = context.history_quotes
        if context.history_decisions is not None:
            result["history_decisions"] = context.history_decisions
        
        # 市场概况类
        if context.stock_list is not None:
            result["stock_list"] = context.stock_list
        if context.market_overview is not None:
            result["market_overview"] = context.market_overview
        if context.sector_flow is not None:
            result["sector_flow"] = context.sector_flow
        if context.hot_stocks is not None:
            result["hot_stocks"] = context.hot_stocks
        if context.hot_stocks_quotes is not None:
            result["hot_stocks_quotes"] = context.hot_stocks_quotes
        if context.limit_up_down is not None:
            result["limit_up_down"] = context.limit_up_down
        
        # 系统时间类
        if context.current_time is not None:
            result["current_time"] = context.current_time
        if context.current_date is not None:
            result["current_date"] = context.current_date
        if context.current_weekday is not None:
            result["current_weekday"] = context.current_weekday
        if context.is_trading_day is not None:
            result["is_trading_day"] = "是" if context.is_trading_day else "否"
        
        # 涨停板数据类
        if context.limit_up_order_amount is not None:
            result["limit_up_order_amount"] = context.limit_up_order_amount
        if context.queue_amount is not None:
            result["queue_amount"] = context.queue_amount
        if context.queue_position is not None:
            result["queue_position"] = context.queue_position
        
        # MCP工具类
        if context.mcp_tools is not None:
            result["mcp_tools"] = context.mcp_tools
        
        return result
    
    def get_placeholders(self, content: str) -> List[str]:
        """
        提取模板中的所有占位符
        
        Args:
            content: 模板内容
            
        Returns:
            List[str]: 占位符名称列表
        """
        matches = self.PLACEHOLDER_PATTERN.findall(content)
        return list(set(matches))
    
    def has_unrendered_placeholders(self, rendered_content: str) -> bool:
        """
        检查渲染后的内容是否还有未替换的占位符
        
        Args:
            rendered_content: 渲染后的内容
            
        Returns:
            bool: 是否存在未替换的占位符
        """
        return bool(self.PLACEHOLDER_PATTERN.search(rendered_content))


# 系统支持的占位符定义（供前端和后端共用）
SYSTEM_PLACEHOLDERS = [
    # 账户资产类
    {"name": "cash", "label": "可用现金", "category": "账户", "description": "可用现金余额（元）"},
    {"name": "market_value", "label": "持仓市值", "category": "账户", "description": "持仓总市值（元）"},
    {"name": "total_assets", "label": "总资产", "category": "账户", "description": "总资产（现金+市值）"},
    {"name": "return_rate", "label": "收益率", "category": "账户", "description": "累计收益率（%）"},
    {"name": "positions", "label": "持仓列表", "category": "账户", "description": "当前持仓详情列表"},
    {"name": "positions_quotes", "label": "持仓股票行情", "category": "账户", "description": "持仓股票历史行情（markdown表格）"},
    {"name": "portfolio_status", "label": "持仓状态", "category": "账户", "description": "完整持仓状态信息"},
    
    # 行情数据类
    {"name": "market_data", "label": "行情数据", "category": "行情", "description": "最近活跃的50只股票近15日行情（股票|日期|开|高|低|收|涨跌%|量）"},
    {"name": "current_market", "label": "市场行情", "category": "行情", "description": "当前市场行情（同market_data）"},
    {"name": "stock_list", "label": "股票列表", "category": "行情", "description": "可交易股票代码列表"},
    
    # 技术指标类
    {"name": "tech_indicators", "label": "技术指标", "category": "技术", "description": "技术分析指标（MA/MACD/KDJ/RSI/BOLL等）"},
    {"name": "ma_data", "label": "均线数据", "category": "技术", "description": "移动平均线数据（MA5/MA10/MA20/MA60）"},
    {"name": "macd_data", "label": "MACD指标", "category": "技术", "description": "MACD指标数据（DIF/DEA/MACD柱）"},
    {"name": "kdj_data", "label": "KDJ指标", "category": "技术", "description": "KDJ随机指标数据（K/D/J值）"},
    {"name": "rsi_data", "label": "RSI指标", "category": "技术", "description": "相对强弱指标RSI数据"},
    {"name": "boll_data", "label": "布林带", "category": "技术", "description": "布林带指标（上轨/中轨/下轨）"},
    
    # 资金流向类
    {"name": "fund_flow", "label": "资金流向", "category": "资金", "description": "个股资金流向数据（主力/散户净流入）"},
    {"name": "fund_flow_rank", "label": "资金排行", "category": "资金", "description": "资金流向排行榜"},
    {"name": "north_fund", "label": "北向资金", "category": "资金", "description": "北向资金（沪股通/深股通）流入数据"},
    
    # 财务数据类
    {"name": "financial_data", "label": "财务数据", "category": "财务", "description": "财务数据（财报指标等）"},
    {"name": "financial_indicator", "label": "财务指标", "category": "财务", "description": "财务分析指标（ROE/ROA/毛利率/净利率等）"},
    {"name": "profit_data", "label": "利润数据", "category": "财务", "description": "利润表数据（营收/净利润/毛利等）"},
    {"name": "balance_data", "label": "资产负债", "category": "财务", "description": "资产负债表数据"},
    {"name": "cashflow_data", "label": "现金流", "category": "财务", "description": "现金流量表数据"},
    
    # 市场情绪类
    {"name": "sentiment_score", "label": "情绪分数", "category": "情绪", "description": "市场情绪分数（-1到1）"},
    {"name": "news_sentiment", "label": "新闻情绪", "category": "情绪", "description": "新闻舆情分析结果"},
    {"name": "market_sentiment", "label": "市场情绪", "category": "情绪", "description": "整体市场情绪指标"},
    
    # 历史数据类
    {"name": "history_trades", "label": "交易历史", "category": "历史", "description": "历史交易记录"},
    {"name": "history_quotes", "label": "历史行情", "category": "历史", "description": "历史K线数据"},
    {"name": "history_decisions", "label": "决策历史", "category": "历史", "description": "历史AI决策记录"},
    
    # 市场概况类
    {"name": "market_overview", "label": "大盘概况", "category": "大盘", "description": "大盘指数行情（上证/深证/创业板）"},
    {"name": "sector_flow", "label": "板块资金", "category": "大盘", "description": "行业板块资金流向"},
    {"name": "hot_stocks", "label": "热门股票", "category": "大盘", "description": "当日热门股票排行"},
    {"name": "hot_stocks_quotes", "label": "热门股票行情", "category": "大盘", "description": "热门股票近3日行情（markdown表格）"},
    {"name": "limit_up_down", "label": "涨跌停统计", "category": "大盘", "description": "涨停跌停股票统计"},
    
    # 系统时间类
    {"name": "current_time", "label": "当前时间", "category": "时间", "description": "当前系统时间（HH:MM:SS）"},
    {"name": "current_date", "label": "当前日期", "category": "时间", "description": "当前日期（YYYY-MM-DD）"},
    {"name": "current_weekday", "label": "星期", "category": "时间", "description": "当前星期几"},
    {"name": "is_trading_day", "label": "是否交易日", "category": "时间", "description": "当前是否为A股交易日"},
    
    # 涨停板数据类
    {"name": "limit_up_order_amount", "label": "封单金额", "category": "涨停", "description": "涨停板封单金额（亿元）"},
    {"name": "queue_amount", "label": "排队金额", "category": "涨停", "description": "当前排队买入金额"},
    {"name": "queue_position", "label": "排队位置", "category": "涨停", "description": "预估排队位置"},
    
    # MCP工具类
    {"name": "mcp_tools", "label": "MCP工具", "category": "MCP", "description": "所有可用的MCP服务及工具列表（包含工具名称、描述、参数等）"},
]


# 默认提示词模板
DEFAULT_TRADING_TEMPLATE = """你是一个专业的量化交易分析师。请根据以下市场数据和持仓状态，给出交易建议。

## 当前市场数据
{{ current_market }}

## 历史交易记录
{{ history_trades }}

## 财务数据
{{ financial_data }}

## 当前持仓状态
{{ portfolio_status }}

## 市场情绪分数
{{ sentiment_score }}

请分析以上数据，并以JSON格式返回你的交易决策：
{
    "decision": "buy" | "sell" | "hold" | "wait",
    "stock_code": "股票代码（如果是买入或卖出）",
    "quantity": 数量（必须是100的整数倍）,
    "price": 价格,
    "reason": "决策理由"
}

注意：
1. 如果决定买入或卖出，必须提供stock_code、quantity和price
2. 如果决定持有(hold)或等待(wait)，只需提供decision和reason
3. 交易数量必须是100的整数倍
4. 价格必须在涨跌停范围内
"""


# 强约束JSON格式的系统提示词
JSON_SYSTEM_PROMPT = """你是一个专业的A股量化交易分析师。你必须严格按照JSON格式返回决策结果。

【重要约束】
1. 你的回复必须是纯JSON格式，不要包含任何其他文字、解释或markdown标记
2. 不要使用```json```代码块，直接返回JSON
3. JSON必须是一个数组格式 [...]
4. 如果不建议交易，返回空数组 []

【JSON格式示例】
买入决策：
[{"decision":"buy","stock_code":"600000","quantity":100,"reason":"技术面向好","confidence":0.8,"risk_assessment":"风险可控"}]

不交易：
[]
"""
