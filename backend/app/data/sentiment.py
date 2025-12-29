"""情绪分析器实现"""

import logging
from typing import List, Optional

logger = logging.getLogger(__name__)


class SentimentAnalyzer:
    """情绪分析器"""
    
    NEUTRAL_SCORE = 0.0
    MIN_SCORE = -1.0
    MAX_SCORE = 1.0
    
    def __init__(self):
        """初始化情绪分析器"""
        self._nlp = None
    
    def _get_nlp(self):
        """获取NLP实例（延迟初始化）"""
        if self._nlp is None:
            try:
                from snownlp import SnowNLP
                self._nlp = SnowNLP
            except ImportError:
                logger.warning("SnowNLP not installed, using simple sentiment analysis")
                self._nlp = SimpleSentimentAnalyzer
        return self._nlp
    
    def analyze(self, text: str) -> float:
        """分析文本情绪
        
        Args:
            text: 待分析的文本
            
        Returns:
            情绪分数，范围[-1.0, +1.0]
            - 正值表示积极情绪
            - 负值表示消极情绪
            - 0表示中性情绪
        """
        # 处理空文本
        if not text or not text.strip():
            return self.NEUTRAL_SCORE
        
        try:
            nlp_class = self._get_nlp()
            
            if nlp_class == SimpleSentimentAnalyzer:
                # 使用简单分析器
                score = SimpleSentimentAnalyzer.analyze(text)
            else:
                # 使用SnowNLP
                # SnowNLP返回0-1的分数，需要转换为-1到+1
                s = nlp_class(text)
                raw_score = s.sentiments  # 0-1范围
                score = (raw_score * 2) - 1  # 转换为-1到+1
            
            # 确保分数在有效范围内
            return self._clamp_score(score)
            
        except Exception as e:
            logger.warning(f"Failed to analyze sentiment: {e}")
            return self.NEUTRAL_SCORE
    
    async def batch_analyze(self, texts: List[str]) -> List[float]:
        """批量分析文本情绪
        
        Args:
            texts: 待分析的文本列表
            
        Returns:
            情绪分数列表
        """
        return [self.analyze(text) for text in texts]
    
    def _clamp_score(self, score: float) -> float:
        """将分数限制在有效范围内
        
        Args:
            score: 原始分数
            
        Returns:
            限制后的分数
        """
        if score < self.MIN_SCORE:
            return self.MIN_SCORE
        if score > self.MAX_SCORE:
            return self.MAX_SCORE
        return score


class SimpleSentimentAnalyzer:
    """简单情绪分析器（当SnowNLP不可用时使用）
    
    基于关键词的简单情绪分析，用于测试和备用。
    """
    
    # 积极词汇
    POSITIVE_WORDS = {
        "涨", "涨停", "上涨", "大涨", "暴涨", "飙升", "突破", "新高",
        "利好", "看好", "买入", "增持", "推荐", "强烈推荐",
        "盈利", "增长", "超预期", "业绩", "分红",
        "好", "优秀", "强势", "活跃", "火爆",
        "牛市", "反弹", "回升", "企稳",
    }
    
    # 消极词汇
    NEGATIVE_WORDS = {
        "跌", "跌停", "下跌", "大跌", "暴跌", "崩盘", "破位", "新低",
        "利空", "看空", "卖出", "减持", "回避",
        "亏损", "下滑", "不及预期", "业绩下滑",
        "差", "弱势", "低迷", "萎靡",
        "熊市", "下探", "回落", "破位",
        "风险", "警惕", "谨慎", "观望",
    }
    
    @classmethod
    def analyze(cls, text: str) -> float:
        """分析文本情绪
        
        Args:
            text: 待分析的文本
            
        Returns:
            情绪分数，范围[-1.0, +1.0]
        """
        if not text or not text.strip():
            return 0.0
        
        positive_count = sum(1 for word in cls.POSITIVE_WORDS if word in text)
        negative_count = sum(1 for word in cls.NEGATIVE_WORDS if word in text)
        
        total = positive_count + negative_count
        if total == 0:
            return 0.0
        
        # 计算情绪分数
        score = (positive_count - negative_count) / total
        
        # 限制在[-1, 1]范围内
        return max(-1.0, min(1.0, score))
