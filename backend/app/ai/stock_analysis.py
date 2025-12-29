"""AI股票分析服务

使用LLM生成股票分析报告，包含技术面、基本面、舆情分析。
"""

import json
import logging
import re
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session
from sqlalchemy import text

from app.ai.llm_client import MultiProtocolLLMClient, Message, LLMError
from app.core.exceptions import AIAnalysisError, StockDataError
from app.data.stock_service import StockDataService

logger = logging.getLogger(__name__)


# ============ 数据模型 ============

@dataclass
class TechnicalIndicator:
    """技术指标"""
    name: str
    value: str
    signal: str  # positive/negative/neutral


@dataclass
class TechnicalAnalysis:
    """技术面分析"""
    summary: str
    trend: str  # bullish/bearish/neutral
    indicators: List[TechnicalIndicator] = field(default_factory=list)


@dataclass
class FundamentalAnalysis:
    """基本面分析"""
    summary: str
    valuation: str  # undervalued/fair/overvalued
    highlights: List[str] = field(default_factory=list)
    concerns: List[str] = field(default_factory=list)


@dataclass
class SentimentAnalysis:
    """舆情分析"""
    summary: str
    sentiment: str  # positive/negative/neutral
    news_highlights: List[str] = field(default_factory=list)


@dataclass
class AIAnalysisResult:
    """AI分析结果"""
    stock_code: str
    stock_name: str
    analysis_time: str
    overall_rating: str  # strong_buy/buy/neutral/cautious/avoid
    rating_score: int  # 1-5分
    
    technical_analysis: TechnicalAnalysis
    fundamental_analysis: FundamentalAnalysis
    sentiment_analysis: SentimentAnalysis
    
    investment_points: List[str] = field(default_factory=list)
    risk_warnings: List[str] = field(default_factory=list)
    conclusion: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "stock_code": self.stock_code,
            "stock_name": self.stock_name,
            "analysis_time": self.analysis_time,
            "overall_rating": self.overall_rating,
            "rating_score": self.rating_score,
            "technical_analysis": {
                "summary": self.technical_analysis.summary,
                "trend": self.technical_analysis.trend,
                "indicators": [
                    {"name": i.name, "value": i.value, "signal": i.signal}
                    for i in self.technical_analysis.indicators
                ],
            },
            "fundamental_analysis": {
                "summary": self.fundamental_analysis.summary,
                "valuation": self.fundamental_analysis.valuation,
                "highlights": self.fundamental_analysis.highlights,
                "concerns": self.fundamental_analysis.concerns,
            },
            "sentiment_analysis": {
                "summary": self.sentiment_analysis.summary,
                "sentiment": self.sentiment_analysis.sentiment,
                "news_highlights": self.sentiment_analysis.news_highlights,
            },
            "investment_points": self.investment_points,
            "risk_warnings": self.risk_warnings,
            "conclusion": self.conclusion,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AIAnalysisResult":
        """从字典创建"""
        tech = data.get("technical_analysis", {})
        fund = data.get("fundamental_analysis", {})
        sent = data.get("sentiment_analysis", {})
        
        return cls(
            stock_code=data.get("stock_code", ""),
            stock_name=data.get("stock_name", ""),
            analysis_time=data.get("analysis_time", ""),
            overall_rating=data.get("overall_rating", "neutral"),
            rating_score=data.get("rating_score", 3),
            technical_analysis=TechnicalAnalysis(
                summary=tech.get("summary", ""),
                trend=tech.get("trend", "neutral"),
                indicators=[
                    TechnicalIndicator(
                        name=i.get("name", ""),
                        value=i.get("value", ""),
                        signal=i.get("signal", "neutral"),
                    )
                    for i in tech.get("indicators", [])
                ],
            ),
            fundamental_analysis=FundamentalAnalysis(
                summary=fund.get("summary", ""),
                valuation=fund.get("valuation", "fair"),
                highlights=fund.get("highlights", []),
                concerns=fund.get("concerns", []),
            ),
            sentiment_analysis=SentimentAnalysis(
                summary=sent.get("summary", ""),
                sentiment=sent.get("sentiment", "neutral"),
                news_highlights=sent.get("news_highlights", []),
            ),
            investment_points=data.get("investment_points", []),
            risk_warnings=data.get("risk_warnings", []),
            conclusion=data.get("conclusion", ""),
        )
    
    def to_json(self) -> str:
        """转换为JSON字符串"""
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=2)
    
    @classmethod
    def from_json(cls, json_str: str) -> "AIAnalysisResult":
        """从JSON字符串创建"""
        data = json.loads(json_str)
        return cls.from_dict(data)


# ============ 提示词模板 ============

ANALYSIS_PROMPT_TEMPLATE = """你是一位专业的股票分析师，请根据以下股票数据进行全面分析。

## 股票基本信息
- 股票代码: {stock_code}
- 股票名称: {stock_name}
- 所属行业: {industry}
- 上市日期: {list_date}

## 实时行情
- 当前价格: {price}
- 涨跌幅: {change_pct}%
- 成交量: {volume}
- 成交额: {amount}
- 换手率: {turnover_rate}%
- 市盈率: {pe}
- 市净率: {pb}
- 总市值: {market_cap}

## 资金流向（近期）
{capital_flow_summary}

## 财务数据
{financial_summary}

## 相关新闻
{news_summary}

请根据以上数据，从技术面、基本面、舆情三个维度进行分析，并给出综合评级。

请严格按照以下JSON格式输出分析结果：
```json
{{
    "overall_rating": "strong_buy|buy|neutral|cautious|avoid",
    "rating_score": 1-5的整数,
    "technical_analysis": {{
        "summary": "技术面分析总结（100-200字）",
        "trend": "bullish|bearish|neutral",
        "indicators": [
            {{"name": "指标名称", "value": "指标值", "signal": "positive|negative|neutral"}}
        ]
    }},
    "fundamental_analysis": {{
        "summary": "基本面分析总结（100-200字）",
        "valuation": "undervalued|fair|overvalued",
        "highlights": ["亮点1", "亮点2"],
        "concerns": ["风险点1", "风险点2"]
    }},
    "sentiment_analysis": {{
        "summary": "舆情分析总结（50-100字）",
        "sentiment": "positive|negative|neutral",
        "news_highlights": ["新闻要点1", "新闻要点2"]
    }},
    "investment_points": ["投资要点1", "投资要点2", "投资要点3"],
    "risk_warnings": ["风险提示1", "风险提示2"],
    "conclusion": "综合结论（50-100字）"
}}
```

注意：
1. overall_rating 评级说明：strong_buy(强烈推荐)、buy(推荐)、neutral(中性)、cautious(谨慎)、avoid(回避)
2. rating_score 与 overall_rating 对应：strong_buy=5, buy=4, neutral=3, cautious=2, avoid=1
3. 所有分析必须基于提供的数据，不要编造数据
4. 请只输出JSON，不要有其他内容
"""


# ============ 服务类 ============

class AIAnalysisService:
    """AI分析服务 - 使用LLM生成股票分析报告"""
    
    def __init__(
        self,
        db: Session,
        llm_client: Optional[MultiProtocolLLMClient] = None,
        cache_ttl: int = 3600,  # 1小时缓存
    ):
        """初始化AI分析服务
        
        Args:
            db: 数据库会话
            llm_client: LLM客户端（可选，用于测试注入）
            cache_ttl: 缓存TTL（秒），默认1小时
        """
        self.db = db
        self.llm_client = llm_client
        self.cache_ttl = cache_ttl
        self.stock_service = StockDataService(db)
    
    async def generate_analysis(
        self,
        stock_code: str,
        force_refresh: bool = False,
    ) -> AIAnalysisResult:
        """生成AI分析报告
        
        Args:
            stock_code: 股票代码
            force_refresh: 是否强制刷新（忽略缓存）
            
        Returns:
            AIAnalysisResult: AI分析结果
            
        Raises:
            AIAnalysisError: 分析失败
        """
        # 1. 检查缓存（除非强制刷新）
        if not force_refresh:
            cached = self._get_cached_analysis(stock_code)
            if cached:
                logger.info(f"Using cached analysis for {stock_code}")
                return cached
        
        # 2. 检查LLM客户端
        if self.llm_client is None:
            raise AIAnalysisError(
                message="LLM客户端未配置",
                stock_code=stock_code,
            )
        
        try:
            # 3. 收集股票数据
            context = await self._collect_stock_context(stock_code)
            
            # 4. 构建提示词
            prompt = self._build_analysis_prompt(context)
            
            # 5. 调用LLM
            logger.info(f"Calling LLM for stock analysis: {stock_code}")
            response = await self.llm_client.chat_simple(
                prompt=prompt,
                temperature=0.3,  # 降低温度以获得更稳定的输出
            )
            
            # 6. 解析响应
            result = self._parse_analysis_response(
                response,
                stock_code,
                context.get("stock_name", ""),
            )
            
            # 7. 缓存结果
            self._cache_analysis(stock_code, result)
            
            logger.info(f"AI analysis completed for {stock_code}")
            return result
            
        except LLMError as e:
            logger.error(f"LLM error for {stock_code}: {e}")
            raise AIAnalysisError(
                message=f"LLM服务调用失败: {str(e)}",
                stock_code=stock_code,
            )
        except StockDataError as e:
            logger.error(f"Stock data error for {stock_code}: {e}")
            raise AIAnalysisError(
                message=f"获取股票数据失败: {str(e)}",
                stock_code=stock_code,
            )
        except Exception as e:
            logger.exception(f"Unexpected error in AI analysis for {stock_code}: {e}")
            raise AIAnalysisError(
                message=f"AI分析失败: {str(e)}",
                stock_code=stock_code,
            )
    
    async def get_cached_analysis(
        self,
        stock_code: str,
    ) -> Optional[AIAnalysisResult]:
        """获取缓存的AI分析报告
        
        Args:
            stock_code: 股票代码
            
        Returns:
            AIAnalysisResult 或 None（如果没有缓存或已过期）
        """
        return self._get_cached_analysis(stock_code)
    
    async def _collect_stock_context(self, stock_code: str) -> Dict[str, Any]:
        """收集股票分析所需的上下文数据
        
        Args:
            stock_code: 股票代码
            
        Returns:
            包含所有股票数据的字典
        """
        context = {
            "stock_code": stock_code,
            "stock_name": "",
            "industry": "",
            "list_date": "",
            "price": 0,
            "change_pct": 0,
            "volume": 0,
            "amount": 0,
            "turnover_rate": 0,
            "pe": 0,
            "pb": 0,
            "market_cap": 0,
            "capital_flow_summary": "暂无资金流向数据",
            "financial_summary": "暂无财务数据",
            "news_summary": "暂无相关新闻",
        }
        
        # 获取基本信息
        try:
            info = await self.stock_service.get_stock_info(stock_code)
            context["stock_name"] = info.name
            context["industry"] = info.industry
            context["list_date"] = info.list_date
        except Exception as e:
            logger.warning(f"Failed to get stock info for {stock_code}: {e}")
        
        # 获取实时行情
        try:
            quote = await self.stock_service.get_realtime_quote(stock_code)
            context["price"] = quote.price
            context["change_pct"] = quote.change_pct
            context["volume"] = quote.volume
            context["amount"] = quote.amount
            context["turnover_rate"] = quote.turnover_rate
            context["pe"] = quote.pe
            context["pb"] = quote.pb
            context["market_cap"] = quote.market_cap
        except Exception as e:
            logger.warning(f"Failed to get quote for {stock_code}: {e}")
        
        # 获取资金流向
        try:
            flows = await self.stock_service.get_capital_flow(stock_code, days=5)
            if flows:
                flow_lines = []
                for f in flows[-3:]:  # 取最近3天
                    flow_lines.append(
                        f"- {f.date}: 主力净流入 {f.main_net/10000:.2f}万, "
                        f"散户净流入 {f.retail_net/10000:.2f}万"
                    )
                context["capital_flow_summary"] = "\n".join(flow_lines)
        except Exception as e:
            logger.warning(f"Failed to get capital flow for {stock_code}: {e}")
        
        # 获取财务数据
        try:
            metrics = await self.stock_service.get_financial_metrics(
                stock_code, periods=2
            )
            if metrics:
                m = metrics[0]  # 最新一期
                context["financial_summary"] = (
                    f"- 报告期: {m.report_date}\n"
                    f"- 营业收入: {m.revenue/100000000:.2f}亿, 同比: {m.revenue_yoy:.2f}%\n"
                    f"- 净利润: {m.net_profit/100000000:.2f}亿, 同比: {m.net_profit_yoy:.2f}%\n"
                    f"- 毛利率: {m.gross_margin:.2f}%, 净利率: {m.net_margin:.2f}%\n"
                    f"- ROE: {m.roe:.2f}%, EPS: {m.eps:.2f}"
                )
        except Exception as e:
            logger.warning(f"Failed to get financials for {stock_code}: {e}")
        
        # 获取新闻
        try:
            news_list = await self.stock_service.get_stock_news(
                stock_code, page=1, page_size=5
            )
            if news_list:
                news_lines = []
                for n in news_list[:5]:
                    sentiment_label = {
                        "positive": "利好",
                        "negative": "利空",
                        "neutral": "中性",
                    }.get(n.sentiment, "中性")
                    news_lines.append(f"- [{sentiment_label}] {n.title}")
                context["news_summary"] = "\n".join(news_lines)
        except Exception as e:
            logger.warning(f"Failed to get news for {stock_code}: {e}")
        
        return context
    
    def _build_analysis_prompt(self, context: Dict[str, Any]) -> str:
        """构建分析提示词
        
        Args:
            context: 股票上下文数据
            
        Returns:
            格式化后的提示词
        """
        return ANALYSIS_PROMPT_TEMPLATE.format(**context)
    
    def _parse_analysis_response(
        self,
        response: str,
        stock_code: str,
        stock_name: str,
    ) -> AIAnalysisResult:
        """解析LLM响应为结构化结果
        
        Args:
            response: LLM响应文本
            stock_code: 股票代码
            stock_name: 股票名称
            
        Returns:
            AIAnalysisResult: 解析后的分析结果
            
        Raises:
            AIAnalysisError: 解析失败
        """
        try:
            # 尝试从响应中提取JSON
            json_match = re.search(r'```json\s*(.*?)\s*```', response, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
            else:
                # 尝试直接解析整个响应
                json_str = response.strip()
                # 移除可能的前后缀
                if json_str.startswith("```"):
                    json_str = json_str[3:]
                if json_str.endswith("```"):
                    json_str = json_str[:-3]
                json_str = json_str.strip()
            
            data = json.loads(json_str)
            
            # 添加股票信息和时间
            data["stock_code"] = stock_code
            data["stock_name"] = stock_name
            data["analysis_time"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
            return AIAnalysisResult.from_dict(data)
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response as JSON: {e}")
            logger.debug(f"Response was: {response[:500]}")
            raise AIAnalysisError(
                message=f"无法解析AI分析结果: {str(e)}",
                stock_code=stock_code,
            )
        except Exception as e:
            logger.error(f"Failed to parse analysis response: {e}")
            raise AIAnalysisError(
                message=f"解析AI分析结果失败: {str(e)}",
                stock_code=stock_code,
            )
    
    def _get_cached_analysis(self, stock_code: str) -> Optional[AIAnalysisResult]:
        """从数据库获取缓存的分析结果
        
        Args:
            stock_code: 股票代码
            
        Returns:
            AIAnalysisResult 或 None
        """
        try:
            result = self.db.execute(
                text("""
                    SELECT analysis_data 
                    FROM stock_ai_analysis 
                    WHERE stock_code = :stock_code 
                    AND expires_at > :now
                    ORDER BY created_at DESC 
                    LIMIT 1
                """),
                {
                    "stock_code": stock_code,
                    "now": datetime.now(),
                },
            )
            row = result.fetchone()
            
            if row:
                data = row[0]
                if isinstance(data, str):
                    data = json.loads(data)
                return AIAnalysisResult.from_dict(data)
            
            return None
            
        except Exception as e:
            logger.warning(f"Failed to get cached analysis for {stock_code}: {e}")
            return None
    
    def _cache_analysis(self, stock_code: str, result: AIAnalysisResult) -> None:
        """缓存分析结果到数据库
        
        Args:
            stock_code: 股票代码
            result: 分析结果
        """
        try:
            expires_at = datetime.now() + timedelta(seconds=self.cache_ttl)
            
            # 先删除旧的缓存
            self.db.execute(
                text("DELETE FROM stock_ai_analysis WHERE stock_code = :stock_code"),
                {"stock_code": stock_code},
            )
            
            # 插入新的缓存
            self.db.execute(
                text("""
                    INSERT INTO stock_ai_analysis 
                    (stock_code, analysis_data, created_at, expires_at)
                    VALUES (:stock_code, :analysis_data, :created_at, :expires_at)
                """),
                {
                    "stock_code": stock_code,
                    "analysis_data": json.dumps(result.to_dict(), ensure_ascii=False),
                    "created_at": datetime.now(),
                    "expires_at": expires_at,
                },
            )
            
            self.db.commit()
            logger.info(f"Cached AI analysis for {stock_code}, expires at {expires_at}")
            
        except Exception as e:
            logger.error(f"Failed to cache analysis for {stock_code}: {e}")
            self.db.rollback()
