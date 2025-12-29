import React, { useState, useEffect, useCallback } from 'react';
import { stockApi, type AIAnalysisResult } from '../../../services/api';
import { GlassCard } from '../../ui';

export interface AIAnalysisTabProps {
  stockCode: string;
}

/**
 * 获取评级显示文本
 */
export function getRatingText(rating: AIAnalysisResult['overall_rating']): string {
  const ratingMap: Record<AIAnalysisResult['overall_rating'], string> = {
    strong_buy: '强烈推荐',
    buy: '推荐',
    neutral: '中性',
    cautious: '谨慎',
    avoid: '回避',
  };
  return ratingMap[rating] || rating;
}

/**
 * 获取评级颜色类
 */
export function getRatingColorClass(rating: AIAnalysisResult['overall_rating']): string {
  const colorMap: Record<AIAnalysisResult['overall_rating'], string> = {
    strong_buy: 'text-profit-green bg-green-50 border-green-200',
    buy: 'text-green-600 bg-green-50 border-green-200',
    neutral: 'text-amber-600 bg-amber-50 border-amber-200',
    cautious: 'text-orange-600 bg-orange-50 border-orange-200',
    avoid: 'text-loss-red bg-red-50 border-red-200',
  };
  return colorMap[rating] || 'text-gray-600 bg-gray-50 border-gray-200';
}

/**
 * 获取趋势显示文本
 */
export function getTrendText(trend: 'bullish' | 'bearish' | 'neutral'): string {
  const trendMap: Record<string, string> = {
    bullish: '看涨',
    bearish: '看跌',
    neutral: '震荡',
  };
  return trendMap[trend] || trend;
}

/**
 * 获取趋势颜色类
 */
export function getTrendColorClass(trend: 'bullish' | 'bearish' | 'neutral'): string {
  const colorMap: Record<string, string> = {
    bullish: 'text-profit-green',
    bearish: 'text-loss-red',
    neutral: 'text-amber-600',
  };
  return colorMap[trend] || 'text-gray-600';
}

/**
 * 获取估值显示文本
 */
export function getValuationText(valuation: 'undervalued' | 'fair' | 'overvalued'): string {
  const valuationMap: Record<string, string> = {
    undervalued: '低估',
    fair: '合理',
    overvalued: '高估',
  };
  return valuationMap[valuation] || valuation;
}

/**
 * 获取估值颜色类
 */
export function getValuationColorClass(valuation: 'undervalued' | 'fair' | 'overvalued'): string {
  const colorMap: Record<string, string> = {
    undervalued: 'text-profit-green',
    fair: 'text-amber-600',
    overvalued: 'text-loss-red',
  };
  return colorMap[valuation] || 'text-gray-600';
}

/**
 * 获取情感显示文本
 */
export function getSentimentText(sentiment: 'positive' | 'negative' | 'neutral'): string {
  const sentimentMap: Record<string, string> = {
    positive: '积极',
    negative: '消极',
    neutral: '中性',
  };
  return sentimentMap[sentiment] || sentiment;
}

/**
 * 获取情感颜色类
 */
export function getSentimentColorClass(sentiment: 'positive' | 'negative' | 'neutral'): string {
  const colorMap: Record<string, string> = {
    positive: 'text-profit-green',
    negative: 'text-loss-red',
    neutral: 'text-amber-600',
  };
  return colorMap[sentiment] || 'text-gray-600';
}

/**
 * 获取信号显示文本
 */
export function getSignalText(signal: 'positive' | 'negative' | 'neutral'): string {
  const signalMap: Record<string, string> = {
    positive: '利好',
    negative: '利空',
    neutral: '中性',
  };
  return signalMap[signal] || signal;
}

/**
 * 获取信号颜色类
 */
export function getSignalColorClass(signal: 'positive' | 'negative' | 'neutral'): string {
  const colorMap: Record<string, string> = {
    positive: 'text-profit-green bg-green-50',
    negative: 'text-loss-red bg-red-50',
    neutral: 'text-amber-600 bg-amber-50',
  };
  return colorMap[signal] || 'text-gray-600 bg-gray-50';
}

/**
 * AI分析标签页组件
 * 显示AI生成的综合分析报告
 * 需求: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9
 */
export const AIAnalysisTab: React.FC<AIAnalysisTabProps> = ({ stockCode }) => {
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 加载缓存的AI分析
  const loadAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await stockApi.getAIAnalysis(stockCode);
      setAnalysis(result);
    } catch (err) {
      console.error('加载AI分析失败:', err);
      // 如果没有缓存的分析，不显示错误，而是显示生成按钮
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  }, [stockCode]);

  // 生成新的AI分析
  const generateAnalysis = useCallback(async (forceRefresh: boolean = false) => {
    setGenerating(true);
    setError(null);
    try {
      const result = await stockApi.generateAIAnalysis(stockCode, forceRefresh);
      setAnalysis(result);
    } catch (err: unknown) {
      console.error('生成AI分析失败:', err);
      const errorMessage = err instanceof Error ? err.message : 
        (err as { detail?: string })?.detail || 'AI分析生成失败，请稍后重试';
      setError(errorMessage);
    } finally {
      setGenerating(false);
    }
  }, [stockCode]);

  useEffect(() => {
    loadAnalysis();
  }, [loadAnalysis]);

  // 加载状态
  if (loading) {
    return (
      <div className="space-y-4" data-testid="ai-analysis-tab-loading">
        <GlassCard className="p-4 rounded-[7px]">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/3"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </GlassCard>
      </div>
    );
  }

  // 生成中状态
  if (generating) {
    return (
      <div className="space-y-4" data-testid="ai-analysis-tab-generating">
        <GlassCard className="p-8 rounded-[7px]">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="relative w-16 h-16 mb-4">
              <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <p className="text-gray-600 mb-2">AI正在分析中...</p>
            <p className="text-sm text-gray-400">正在收集股票数据并生成分析报告，请稍候</p>
          </div>
        </GlassCard>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="space-y-4" data-testid="ai-analysis-tab-error">
        <GlassCard className="p-8 rounded-[7px]">
          <div className="flex flex-col items-center justify-center text-center">
            <svg className="w-12 h-12 text-red-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => generateAnalysis(true)}
              className="px-4 py-2 bg-space-black text-white rounded-lg text-sm hover:bg-gray-800 transition-colors"
              data-testid="retry-button"
            >
              重试
            </button>
          </div>
        </GlassCard>
      </div>
    );
  }

  // 无分析数据状态 - 显示生成按钮
  if (!analysis) {
    return (
      <div className="space-y-4" data-testid="ai-analysis-tab-empty">
        <GlassCard className="p-8 rounded-[7px]">
          <div className="flex flex-col items-center justify-center text-center">
            <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <p className="text-gray-600 mb-2">暂无AI分析报告</p>
            <p className="text-sm text-gray-400 mb-4">点击下方按钮生成智能分析报告</p>
            <button
              onClick={() => generateAnalysis(false)}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors flex items-center gap-2"
              data-testid="generate-button"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              生成AI分析
            </button>
          </div>
        </GlassCard>
      </div>
    );
  }

  // 正常显示分析结果
  return (
    <div className="space-y-4" data-testid="ai-analysis-tab">
      {/* 综合评级 */}
      <OverallRatingCard analysis={analysis} onRegenerate={() => generateAnalysis(true)} />

      {/* 技术面分析 */}
      <TechnicalAnalysisCard analysis={analysis} />

      {/* 基本面分析 */}
      <FundamentalAnalysisCard analysis={analysis} />

      {/* 舆情分析 */}
      <SentimentAnalysisCard analysis={analysis} />

      {/* 投资要点和风险提示 */}
      <InvestmentPointsCard analysis={analysis} />

      {/* 总结 */}
      <ConclusionCard analysis={analysis} />
    </div>
  );
};


/**
 * 综合评级卡片组件
 */
interface OverallRatingCardProps {
  analysis: AIAnalysisResult;
  onRegenerate: () => void;
}

export const OverallRatingCard: React.FC<OverallRatingCardProps> = ({ analysis, onRegenerate }) => {
  return (
    <GlassCard className="p-4 rounded-[7px]" data-testid="overall-rating-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-700">综合评级</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            分析时间: {new Date(analysis.analysis_time).toLocaleString('zh-CN')}
          </span>
          <button
            onClick={onRegenerate}
            className="px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors flex items-center gap-1"
            data-testid="regenerate-button"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            重新分析
          </button>
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        {/* 评级徽章 */}
        <div
          className={`px-4 py-3 rounded-lg border ${getRatingColorClass(analysis.overall_rating)}`}
          data-testid="rating-badge"
        >
          <div className="text-2xl font-bold" data-testid="rating-text">
            {getRatingText(analysis.overall_rating)}
          </div>
        </div>
        
        {/* 评分 */}
        <div className="flex flex-col" data-testid="rating-score-container">
          <span className="text-xs text-gray-500 mb-1">评分</span>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <svg
                key={star}
                className={`w-5 h-5 ${star <= analysis.rating_score ? 'text-yellow-400' : 'text-gray-200'}`}
                fill="currentColor"
                viewBox="0 0 20 20"
                data-testid={`star-${star}`}
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
            <span className="ml-2 text-lg font-semibold text-gray-700" data-testid="rating-score">
              {analysis.rating_score}/5
            </span>
          </div>
        </div>
        
        {/* 股票信息 */}
        <div className="flex flex-col ml-auto text-right">
          <span className="text-sm font-medium text-gray-700" data-testid="stock-name">
            {analysis.stock_name}
          </span>
          <span className="text-xs text-gray-400" data-testid="stock-code">
            {analysis.stock_code}
          </span>
        </div>
      </div>
    </GlassCard>
  );
};

/**
 * 技术面分析卡片组件
 */
interface TechnicalAnalysisCardProps {
  analysis: AIAnalysisResult;
}

export const TechnicalAnalysisCard: React.FC<TechnicalAnalysisCardProps> = ({ analysis }) => {
  const { technical_analysis } = analysis;
  
  return (
    <GlassCard className="p-4 rounded-[7px]" data-testid="technical-analysis-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700">技术面分析</h3>
        <span
          className={`px-2 py-1 text-xs rounded ${getTrendColorClass(technical_analysis.trend)} bg-opacity-10`}
          data-testid="trend-badge"
        >
          趋势: {getTrendText(technical_analysis.trend)}
        </span>
      </div>
      
      <p className="text-sm text-gray-600 mb-4" data-testid="technical-summary">
        {technical_analysis.summary}
      </p>
      
      {/* 技术指标 */}
      {technical_analysis.indicators && technical_analysis.indicators.length > 0 && (
        <div className="grid grid-cols-3 gap-2" data-testid="technical-indicators">
          {technical_analysis.indicators.map((indicator, index) => (
            <div
              key={index}
              className={`p-2 rounded text-center ${getSignalColorClass(indicator.signal)}`}
              data-testid={`indicator-${index}`}
            >
              <div className="text-xs text-gray-500">{indicator.name}</div>
              <div className="text-sm font-medium">{indicator.value}</div>
              <div className="text-xs">{getSignalText(indicator.signal)}</div>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
};

/**
 * 基本面分析卡片组件
 */
interface FundamentalAnalysisCardProps {
  analysis: AIAnalysisResult;
}

export const FundamentalAnalysisCard: React.FC<FundamentalAnalysisCardProps> = ({ analysis }) => {
  const { fundamental_analysis } = analysis;
  
  return (
    <GlassCard className="p-4 rounded-[7px]" data-testid="fundamental-analysis-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700">基本面分析</h3>
        <span
          className={`px-2 py-1 text-xs rounded ${getValuationColorClass(fundamental_analysis.valuation)} bg-opacity-10`}
          data-testid="valuation-badge"
        >
          估值: {getValuationText(fundamental_analysis.valuation)}
        </span>
      </div>
      
      <p className="text-sm text-gray-600 mb-4" data-testid="fundamental-summary">
        {fundamental_analysis.summary}
      </p>
      
      <div className="grid grid-cols-2 gap-4">
        {/* 亮点 */}
        {fundamental_analysis.highlights && fundamental_analysis.highlights.length > 0 && (
          <div data-testid="highlights-section">
            <h4 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
              <svg className="w-3 h-3 text-profit-green" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              亮点
            </h4>
            <ul className="space-y-1">
              {fundamental_analysis.highlights.map((highlight, index) => (
                <li key={index} className="text-xs text-gray-600 flex items-start gap-1" data-testid={`highlight-${index}`}>
                  <span className="text-profit-green mt-0.5">•</span>
                  {highlight}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* 风险点 */}
        {fundamental_analysis.concerns && fundamental_analysis.concerns.length > 0 && (
          <div data-testid="concerns-section">
            <h4 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
              <svg className="w-3 h-3 text-loss-red" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              风险点
            </h4>
            <ul className="space-y-1">
              {fundamental_analysis.concerns.map((concern, index) => (
                <li key={index} className="text-xs text-gray-600 flex items-start gap-1" data-testid={`concern-${index}`}>
                  <span className="text-loss-red mt-0.5">•</span>
                  {concern}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </GlassCard>
  );
};

/**
 * 舆情分析卡片组件
 */
interface SentimentAnalysisCardProps {
  analysis: AIAnalysisResult;
}

export const SentimentAnalysisCard: React.FC<SentimentAnalysisCardProps> = ({ analysis }) => {
  const { sentiment_analysis } = analysis;
  
  return (
    <GlassCard className="p-4 rounded-[7px]" data-testid="sentiment-analysis-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700">舆情分析</h3>
        <span
          className={`px-2 py-1 text-xs rounded ${getSentimentColorClass(sentiment_analysis.sentiment)} bg-opacity-10`}
          data-testid="sentiment-badge"
        >
          情感: {getSentimentText(sentiment_analysis.sentiment)}
        </span>
      </div>
      
      <p className="text-sm text-gray-600 mb-4" data-testid="sentiment-summary">
        {sentiment_analysis.summary}
      </p>
      
      {/* 新闻要点 */}
      {sentiment_analysis.news_highlights && sentiment_analysis.news_highlights.length > 0 && (
        <div data-testid="news-highlights-section">
          <h4 className="text-xs font-medium text-gray-500 mb-2">新闻要点</h4>
          <ul className="space-y-1">
            {sentiment_analysis.news_highlights.map((highlight, index) => (
              <li key={index} className="text-xs text-gray-600 flex items-start gap-1" data-testid={`news-highlight-${index}`}>
                <span className="text-blue-500 mt-0.5">•</span>
                {highlight}
              </li>
            ))}
          </ul>
        </div>
      )}
    </GlassCard>
  );
};

/**
 * 投资要点和风险提示卡片组件
 */
interface InvestmentPointsCardProps {
  analysis: AIAnalysisResult;
}

export const InvestmentPointsCard: React.FC<InvestmentPointsCardProps> = ({ analysis }) => {
  return (
    <GlassCard className="p-4 rounded-[7px]" data-testid="investment-points-card">
      <div className="grid grid-cols-2 gap-4">
        {/* 投资要点 */}
        {analysis.investment_points && analysis.investment_points.length > 0 && (
          <div data-testid="investment-points-section">
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              投资要点
            </h3>
            <ul className="space-y-2">
              {analysis.investment_points.map((point, index) => (
                <li key={index} className="text-sm text-gray-600 flex items-start gap-2" data-testid={`investment-point-${index}`}>
                  <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">
                    {index + 1}
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* 风险提示 */}
        {analysis.risk_warnings && analysis.risk_warnings.length > 0 && (
          <div data-testid="risk-warnings-section">
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-loss-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              风险提示
            </h3>
            <ul className="space-y-2">
              {analysis.risk_warnings.map((warning, index) => (
                <li key={index} className="text-sm text-gray-600 flex items-start gap-2" data-testid={`risk-warning-${index}`}>
                  <span className="flex-shrink-0 w-5 h-5 bg-red-100 text-loss-red rounded-full flex items-center justify-center text-xs font-medium">
                    !
                  </span>
                  {warning}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </GlassCard>
  );
};

/**
 * 总结卡片组件
 */
interface ConclusionCardProps {
  analysis: AIAnalysisResult;
}

export const ConclusionCard: React.FC<ConclusionCardProps> = ({ analysis }) => {
  return (
    <GlassCard className="p-4 rounded-[7px]" data-testid="conclusion-card">
      <h3 className="text-sm font-medium text-gray-700 mb-3">总结</h3>
      <p className="text-sm text-gray-600 leading-relaxed" data-testid="conclusion-text">
        {analysis.conclusion}
      </p>
    </GlassCard>
  );
};

export default AIAnalysisTab;
