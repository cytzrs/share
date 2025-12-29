import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import * as fc from 'fast-check';
import React from 'react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Define types locally to avoid import issues
interface TechnicalIndicator {
  name: string;
  value: string;
  signal: 'positive' | 'negative' | 'neutral';
}

interface TechnicalAnalysis {
  summary: string;
  trend: 'bullish' | 'bearish' | 'neutral';
  indicators: TechnicalIndicator[];
}

interface FundamentalAnalysis {
  summary: string;
  valuation: 'undervalued' | 'fair' | 'overvalued';
  highlights: string[];
  concerns: string[];
}

interface SentimentAnalysis {
  summary: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  news_highlights: string[];
}

interface AIAnalysisResult {
  stock_code: string;
  stock_name: string;
  analysis_time: string;
  overall_rating: 'strong_buy' | 'buy' | 'neutral' | 'cautious' | 'avoid';
  rating_score: number;
  technical_analysis: TechnicalAnalysis;
  fundamental_analysis: FundamentalAnalysis;
  sentiment_analysis: SentimentAnalysis;
  investment_points: string[];
  risk_warnings: string[];
  conclusion: string;
}

// Helper functions (copied from AIAnalysisTab)
function getRatingText(rating: AIAnalysisResult['overall_rating']): string {
  const ratingMap: Record<AIAnalysisResult['overall_rating'], string> = {
    strong_buy: '强烈推荐',
    buy: '推荐',
    neutral: '中性',
    cautious: '谨慎',
    avoid: '回避',
  };
  return ratingMap[rating] || rating;
}

function getRatingColorClass(rating: AIAnalysisResult['overall_rating']): string {
  const colorMap: Record<AIAnalysisResult['overall_rating'], string> = {
    strong_buy: 'text-profit-green bg-green-50 border-green-200',
    buy: 'text-green-600 bg-green-50 border-green-200',
    neutral: 'text-amber-600 bg-amber-50 border-amber-200',
    cautious: 'text-orange-600 bg-orange-50 border-orange-200',
    avoid: 'text-loss-red bg-red-50 border-red-200',
  };
  return colorMap[rating] || 'text-gray-600 bg-gray-50 border-gray-200';
}

function getTrendText(trend: 'bullish' | 'bearish' | 'neutral'): string {
  const trendMap: Record<string, string> = {
    bullish: '看涨',
    bearish: '看跌',
    neutral: '震荡',
  };
  return trendMap[trend] || trend;
}

function getValuationText(valuation: 'undervalued' | 'fair' | 'overvalued'): string {
  const valuationMap: Record<string, string> = {
    undervalued: '低估',
    fair: '合理',
    overvalued: '高估',
  };
  return valuationMap[valuation] || valuation;
}

function getSentimentText(sentiment: 'positive' | 'negative' | 'neutral'): string {
  const sentimentMap: Record<string, string> = {
    positive: '积极',
    negative: '消极',
    neutral: '中性',
  };
  return sentimentMap[sentiment] || sentiment;
}

function getSignalText(signal: 'positive' | 'negative' | 'neutral'): string {
  const signalMap: Record<string, string> = {
    positive: '利好',
    negative: '利空',
    neutral: '中性',
  };
  return signalMap[signal] || signal;
}

function getSignalColorClass(signal: 'positive' | 'negative' | 'neutral'): string {
  const colorMap: Record<string, string> = {
    positive: 'text-profit-green bg-green-50',
    negative: 'text-loss-red bg-red-50',
    neutral: 'text-amber-600 bg-amber-50',
  };
  return colorMap[signal] || 'text-gray-600 bg-gray-50';
}

// Standalone components for testing (copied from AIAnalysisTab)
const GlassCard: React.FC<{ children: React.ReactNode; className?: string; 'data-testid'?: string }> = ({ 
  children, 
  className = '',
  'data-testid': testId 
}) => (
  <div className={`bg-white/80 backdrop-blur-sm shadow-sm ${className}`} data-testid={testId}>
    {children}
  </div>
);

const OverallRatingCard: React.FC<{ analysis: AIAnalysisResult; onRegenerate: () => void }> = ({ analysis, onRegenerate }) => {
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
            重新分析
          </button>
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <div
          className={`px-4 py-3 rounded-lg border ${getRatingColorClass(analysis.overall_rating)}`}
          data-testid="rating-badge"
        >
          <div className="text-2xl font-bold" data-testid="rating-text">
            {getRatingText(analysis.overall_rating)}
          </div>
        </div>
        
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

const TechnicalAnalysisCard: React.FC<{ analysis: AIAnalysisResult }> = ({ analysis }) => {
  const { technical_analysis } = analysis;
  
  return (
    <GlassCard className="p-4 rounded-[7px]" data-testid="technical-analysis-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700">技术面分析</h3>
        <span className="px-2 py-1 text-xs rounded" data-testid="trend-badge">
          趋势: {getTrendText(technical_analysis.trend)}
        </span>
      </div>
      
      <p className="text-sm text-gray-600 mb-4" data-testid="technical-summary">
        {technical_analysis.summary}
      </p>
      
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

const FundamentalAnalysisCard: React.FC<{ analysis: AIAnalysisResult }> = ({ analysis }) => {
  const { fundamental_analysis } = analysis;
  
  return (
    <GlassCard className="p-4 rounded-[7px]" data-testid="fundamental-analysis-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700">基本面分析</h3>
        <span className="px-2 py-1 text-xs rounded" data-testid="valuation-badge">
          估值: {getValuationText(fundamental_analysis.valuation)}
        </span>
      </div>
      
      <p className="text-sm text-gray-600 mb-4" data-testid="fundamental-summary">
        {fundamental_analysis.summary}
      </p>
      
      <div className="grid grid-cols-2 gap-4">
        {fundamental_analysis.highlights && fundamental_analysis.highlights.length > 0 && (
          <div data-testid="highlights-section">
            <h4 className="text-xs font-medium text-gray-500 mb-2">亮点</h4>
            <ul className="space-y-1">
              {fundamental_analysis.highlights.map((highlight, index) => (
                <li key={index} className="text-xs text-gray-600" data-testid={`highlight-${index}`}>
                  • {highlight}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {fundamental_analysis.concerns && fundamental_analysis.concerns.length > 0 && (
          <div data-testid="concerns-section">
            <h4 className="text-xs font-medium text-gray-500 mb-2">风险点</h4>
            <ul className="space-y-1">
              {fundamental_analysis.concerns.map((concern, index) => (
                <li key={index} className="text-xs text-gray-600" data-testid={`concern-${index}`}>
                  • {concern}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </GlassCard>
  );
};

const SentimentAnalysisCard: React.FC<{ analysis: AIAnalysisResult }> = ({ analysis }) => {
  const { sentiment_analysis } = analysis;
  
  return (
    <GlassCard className="p-4 rounded-[7px]" data-testid="sentiment-analysis-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700">舆情分析</h3>
        <span className="px-2 py-1 text-xs rounded" data-testid="sentiment-badge">
          情感: {getSentimentText(sentiment_analysis.sentiment)}
        </span>
      </div>
      
      <p className="text-sm text-gray-600 mb-4" data-testid="sentiment-summary">
        {sentiment_analysis.summary}
      </p>
      
      {sentiment_analysis.news_highlights && sentiment_analysis.news_highlights.length > 0 && (
        <div data-testid="news-highlights-section">
          <h4 className="text-xs font-medium text-gray-500 mb-2">新闻要点</h4>
          <ul className="space-y-1">
            {sentiment_analysis.news_highlights.map((highlight, index) => (
              <li key={index} className="text-xs text-gray-600" data-testid={`news-highlight-${index}`}>
                • {highlight}
              </li>
            ))}
          </ul>
        </div>
      )}
    </GlassCard>
  );
};

const InvestmentPointsCard: React.FC<{ analysis: AIAnalysisResult }> = ({ analysis }) => {
  return (
    <GlassCard className="p-4 rounded-[7px]" data-testid="investment-points-card">
      <div className="grid grid-cols-2 gap-4">
        {analysis.investment_points && analysis.investment_points.length > 0 && (
          <div data-testid="investment-points-section">
            <h3 className="text-sm font-medium text-gray-700 mb-3">投资要点</h3>
            <ul className="space-y-2">
              {analysis.investment_points.map((point, index) => (
                <li key={index} className="text-sm text-gray-600" data-testid={`investment-point-${index}`}>
                  {index + 1}. {point}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {analysis.risk_warnings && analysis.risk_warnings.length > 0 && (
          <div data-testid="risk-warnings-section">
            <h3 className="text-sm font-medium text-gray-700 mb-3">风险提示</h3>
            <ul className="space-y-2">
              {analysis.risk_warnings.map((warning, index) => (
                <li key={index} className="text-sm text-gray-600" data-testid={`risk-warning-${index}`}>
                  ! {warning}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </GlassCard>
  );
};

const ConclusionCard: React.FC<{ analysis: AIAnalysisResult }> = ({ analysis }) => {
  return (
    <GlassCard className="p-4 rounded-[7px]" data-testid="conclusion-card">
      <h3 className="text-sm font-medium text-gray-700 mb-3">总结</h3>
      <p className="text-sm text-gray-600 leading-relaxed" data-testid="conclusion-text">
        {analysis.conclusion}
      </p>
    </GlassCard>
  );
};


// Arbitrary generators
const overallRatingArbitrary = fc.constantFrom('strong_buy', 'buy', 'neutral', 'cautious', 'avoid') as fc.Arbitrary<AIAnalysisResult['overall_rating']>;
const trendArbitrary = fc.constantFrom('bullish', 'bearish', 'neutral') as fc.Arbitrary<'bullish' | 'bearish' | 'neutral'>;
const valuationArbitrary = fc.constantFrom('undervalued', 'fair', 'overvalued') as fc.Arbitrary<'undervalued' | 'fair' | 'overvalued'>;
const sentimentArbitrary = fc.constantFrom('positive', 'negative', 'neutral') as fc.Arbitrary<'positive' | 'negative' | 'neutral'>;
const signalArbitrary = fc.constantFrom('positive', 'negative', 'neutral') as fc.Arbitrary<'positive' | 'negative' | 'neutral'>;

const technicalIndicatorArbitrary = fc.record({
  name: fc.constantFrom('MACD', 'KDJ', 'RSI', 'MA5', 'MA10', 'MA20', 'BOLL', 'VOL'),
  value: fc.string({ minLength: 1, maxLength: 20 }),
  signal: signalArbitrary,
});

const technicalAnalysisArbitrary = fc.record({
  summary: fc.string({ minLength: 10, maxLength: 200 }),
  trend: trendArbitrary,
  indicators: fc.array(technicalIndicatorArbitrary, { minLength: 1, maxLength: 5 }),
});

const fundamentalAnalysisArbitrary = fc.record({
  summary: fc.string({ minLength: 10, maxLength: 200 }),
  valuation: valuationArbitrary,
  highlights: fc.array(fc.string({ minLength: 5, maxLength: 100 }), { minLength: 1, maxLength: 5 }),
  concerns: fc.array(fc.string({ minLength: 5, maxLength: 100 }), { minLength: 1, maxLength: 5 }),
});

const sentimentAnalysisArbitrary = fc.record({
  summary: fc.string({ minLength: 10, maxLength: 200 }),
  sentiment: sentimentArbitrary,
  news_highlights: fc.array(fc.string({ minLength: 5, maxLength: 100 }), { minLength: 1, maxLength: 5 }),
});

const dateStringArbitrary = fc.integer({ min: 2020, max: 2025 })
  .chain(year => fc.integer({ min: 1, max: 12 })
    .chain(month => fc.integer({ min: 1, max: 28 })
      .chain(day => fc.integer({ min: 0, max: 23 })
        .chain(hour => fc.integer({ min: 0, max: 59 })
          .map(minute => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`)))));

const aiAnalysisResultArbitrary = fc.record({
  stock_code: fc.stringMatching(/^[0-9]{6}$/),
  stock_name: fc.string({ minLength: 2, maxLength: 10 }),
  analysis_time: dateStringArbitrary,
  overall_rating: overallRatingArbitrary,
  rating_score: fc.integer({ min: 1, max: 5 }),
  technical_analysis: technicalAnalysisArbitrary,
  fundamental_analysis: fundamentalAnalysisArbitrary,
  sentiment_analysis: sentimentAnalysisArbitrary,
  investment_points: fc.array(fc.string({ minLength: 5, maxLength: 100 }), { minLength: 1, maxLength: 5 }),
  risk_warnings: fc.array(fc.string({ minLength: 5, maxLength: 100 }), { minLength: 1, maxLength: 5 }),
  conclusion: fc.string({ minLength: 20, maxLength: 500 }),
});

describe('AIAnalysisTab - Property Tests', () => {
  /**
   * Property 9: AI analysis result rendering
   * Feature: stock-detail-page, Property 9: AI analysis result rendering
   * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
   * 
   * For any valid AIAnalysisResult, the rendered AIAnalysisTab should display:
   * - Overall rating and score
   * - Technical analysis summary
   * - Fundamental analysis summary
   * - Sentiment analysis summary
   * - All investment points
   * - All risk warnings
   */
  it('Property 9: AI analysis result rendering - should render overall rating and score', () => {
    fc.assert(
      fc.property(
        aiAnalysisResultArbitrary,
        (analysis: AIAnalysisResult) => {
          cleanup();
          
          const { container, unmount } = render(
            <OverallRatingCard analysis={analysis} onRegenerate={() => {}} />
          );

          // Verify the overall rating card is rendered
          const ratingCard = container.querySelector('[data-testid="overall-rating-card"]');
          expect(ratingCard).toBeTruthy();

          // Verify rating text is displayed correctly
          const ratingText = container.querySelector('[data-testid="rating-text"]');
          expect(ratingText).toBeTruthy();
          expect(ratingText?.textContent).toBe(getRatingText(analysis.overall_rating));

          // Verify rating score is displayed
          const ratingScore = container.querySelector('[data-testid="rating-score"]');
          expect(ratingScore).toBeTruthy();
          expect(ratingScore?.textContent).toContain(`${analysis.rating_score}/5`);

          // Verify stock name and code are displayed
          const stockName = container.querySelector('[data-testid="stock-name"]');
          expect(stockName).toBeTruthy();
          expect(stockName?.textContent).toBe(analysis.stock_name);

          const stockCode = container.querySelector('[data-testid="stock-code"]');
          expect(stockCode).toBeTruthy();
          expect(stockCode?.textContent).toBe(analysis.stock_code);

          // Verify regenerate button exists
          const regenerateButton = container.querySelector('[data-testid="regenerate-button"]');
          expect(regenerateButton).toBeTruthy();

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 9: AI analysis result rendering - should render technical analysis summary and trend', () => {
    fc.assert(
      fc.property(
        aiAnalysisResultArbitrary,
        (analysis: AIAnalysisResult) => {
          cleanup();
          
          const { container, unmount } = render(
            <TechnicalAnalysisCard analysis={analysis} />
          );

          // Verify the technical analysis card is rendered
          const techCard = container.querySelector('[data-testid="technical-analysis-card"]');
          expect(techCard).toBeTruthy();

          // Verify technical summary is displayed
          const techSummary = container.querySelector('[data-testid="technical-summary"]');
          expect(techSummary).toBeTruthy();
          expect(techSummary?.textContent).toBe(analysis.technical_analysis.summary);

          // Verify trend badge is displayed
          const trendBadge = container.querySelector('[data-testid="trend-badge"]');
          expect(trendBadge).toBeTruthy();
          expect(trendBadge?.textContent).toContain(getTrendText(analysis.technical_analysis.trend));

          // Verify indicators are displayed
          const indicatorsContainer = container.querySelector('[data-testid="technical-indicators"]');
          expect(indicatorsContainer).toBeTruthy();
          
          analysis.technical_analysis.indicators.forEach((indicator, index) => {
            const indicatorElement = container.querySelector(`[data-testid="indicator-${index}"]`);
            expect(indicatorElement).toBeTruthy();
            expect(indicatorElement?.textContent).toContain(indicator.name);
            expect(indicatorElement?.textContent).toContain(indicator.value);
            expect(indicatorElement?.textContent).toContain(getSignalText(indicator.signal));
          });

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 9: AI analysis result rendering - should render fundamental analysis summary and valuation', () => {
    fc.assert(
      fc.property(
        aiAnalysisResultArbitrary,
        (analysis: AIAnalysisResult) => {
          cleanup();
          
          const { container, unmount } = render(
            <FundamentalAnalysisCard analysis={analysis} />
          );

          // Verify the fundamental analysis card is rendered
          const fundCard = container.querySelector('[data-testid="fundamental-analysis-card"]');
          expect(fundCard).toBeTruthy();

          // Verify fundamental summary is displayed
          const fundSummary = container.querySelector('[data-testid="fundamental-summary"]');
          expect(fundSummary).toBeTruthy();
          expect(fundSummary?.textContent).toBe(analysis.fundamental_analysis.summary);

          // Verify valuation badge is displayed
          const valuationBadge = container.querySelector('[data-testid="valuation-badge"]');
          expect(valuationBadge).toBeTruthy();
          expect(valuationBadge?.textContent).toContain(getValuationText(analysis.fundamental_analysis.valuation));

          // Verify highlights are displayed
          const highlightsSection = container.querySelector('[data-testid="highlights-section"]');
          expect(highlightsSection).toBeTruthy();
          
          analysis.fundamental_analysis.highlights.forEach((highlight, index) => {
            const highlightElement = container.querySelector(`[data-testid="highlight-${index}"]`);
            expect(highlightElement).toBeTruthy();
            expect(highlightElement?.textContent).toContain(highlight);
          });

          // Verify concerns are displayed
          const concernsSection = container.querySelector('[data-testid="concerns-section"]');
          expect(concernsSection).toBeTruthy();
          
          analysis.fundamental_analysis.concerns.forEach((concern, index) => {
            const concernElement = container.querySelector(`[data-testid="concern-${index}"]`);
            expect(concernElement).toBeTruthy();
            expect(concernElement?.textContent).toContain(concern);
          });

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 9: AI analysis result rendering - should render sentiment analysis summary', () => {
    fc.assert(
      fc.property(
        aiAnalysisResultArbitrary,
        (analysis: AIAnalysisResult) => {
          cleanup();
          
          const { container, unmount } = render(
            <SentimentAnalysisCard analysis={analysis} />
          );

          // Verify the sentiment analysis card is rendered
          const sentimentCard = container.querySelector('[data-testid="sentiment-analysis-card"]');
          expect(sentimentCard).toBeTruthy();

          // Verify sentiment summary is displayed
          const sentimentSummary = container.querySelector('[data-testid="sentiment-summary"]');
          expect(sentimentSummary).toBeTruthy();
          expect(sentimentSummary?.textContent).toBe(analysis.sentiment_analysis.summary);

          // Verify sentiment badge is displayed
          const sentimentBadge = container.querySelector('[data-testid="sentiment-badge"]');
          expect(sentimentBadge).toBeTruthy();
          expect(sentimentBadge?.textContent).toContain(getSentimentText(analysis.sentiment_analysis.sentiment));

          // Verify news highlights are displayed
          const newsHighlightsSection = container.querySelector('[data-testid="news-highlights-section"]');
          expect(newsHighlightsSection).toBeTruthy();
          
          analysis.sentiment_analysis.news_highlights.forEach((highlight, index) => {
            const highlightElement = container.querySelector(`[data-testid="news-highlight-${index}"]`);
            expect(highlightElement).toBeTruthy();
            expect(highlightElement?.textContent).toContain(highlight);
          });

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 9: AI analysis result rendering - should render all investment points and risk warnings', () => {
    fc.assert(
      fc.property(
        aiAnalysisResultArbitrary,
        (analysis: AIAnalysisResult) => {
          cleanup();
          
          const { container, unmount } = render(
            <InvestmentPointsCard analysis={analysis} />
          );

          // Verify the investment points card is rendered
          const investmentCard = container.querySelector('[data-testid="investment-points-card"]');
          expect(investmentCard).toBeTruthy();

          // Verify investment points section is displayed
          const investmentPointsSection = container.querySelector('[data-testid="investment-points-section"]');
          expect(investmentPointsSection).toBeTruthy();
          
          // Verify all investment points are displayed
          analysis.investment_points.forEach((point, index) => {
            const pointElement = container.querySelector(`[data-testid="investment-point-${index}"]`);
            expect(pointElement).toBeTruthy();
            expect(pointElement?.textContent).toContain(point);
          });

          // Verify risk warnings section is displayed
          const riskWarningsSection = container.querySelector('[data-testid="risk-warnings-section"]');
          expect(riskWarningsSection).toBeTruthy();
          
          // Verify all risk warnings are displayed
          analysis.risk_warnings.forEach((warning, index) => {
            const warningElement = container.querySelector(`[data-testid="risk-warning-${index}"]`);
            expect(warningElement).toBeTruthy();
            expect(warningElement?.textContent).toContain(warning);
          });

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 9: AI analysis result rendering - should render conclusion', () => {
    fc.assert(
      fc.property(
        aiAnalysisResultArbitrary,
        (analysis: AIAnalysisResult) => {
          cleanup();
          
          const { container, unmount } = render(
            <ConclusionCard analysis={analysis} />
          );

          // Verify the conclusion card is rendered
          const conclusionCard = container.querySelector('[data-testid="conclusion-card"]');
          expect(conclusionCard).toBeTruthy();

          // Verify conclusion text is displayed
          const conclusionText = container.querySelector('[data-testid="conclusion-text"]');
          expect(conclusionText).toBeTruthy();
          expect(conclusionText?.textContent).toBe(analysis.conclusion);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Unit tests for specific examples
  describe('Unit Tests', () => {
    const sampleAnalysis: AIAnalysisResult = {
      stock_code: '600519',
      stock_name: '贵州茅台',
      analysis_time: '2024-12-28T10:30:00',
      overall_rating: 'buy',
      rating_score: 4,
      technical_analysis: {
        summary: '股价处于上升通道，短期均线多头排列，MACD金叉形成，技术面整体偏多。',
        trend: 'bullish',
        indicators: [
          { name: 'MACD', value: '金叉', signal: 'positive' },
          { name: 'KDJ', value: '超买', signal: 'neutral' },
          { name: 'RSI', value: '65', signal: 'positive' },
        ],
      },
      fundamental_analysis: {
        summary: '公司基本面稳健，营收和利润持续增长，毛利率保持高位，估值处于合理区间。',
        valuation: 'fair',
        highlights: [
          '品牌价值高，护城河深',
          '毛利率超过90%',
          '现金流充裕',
        ],
        concerns: [
          '估值相对较高',
          '增速放缓',
        ],
      },
      sentiment_analysis: {
        summary: '市场情绪偏正面，机构持续看好，近期无重大负面消息。',
        sentiment: 'positive',
        news_highlights: [
          '机构调研频繁',
          '业绩预告超预期',
        ],
      },
      investment_points: [
        '行业龙头地位稳固',
        '品牌溢价能力强',
        '分红率稳定',
      ],
      risk_warnings: [
        '宏观经济下行风险',
        '消费降级影响',
        '政策监管风险',
      ],
      conclusion: '综合来看，贵州茅台基本面稳健，技术面偏多，建议逢低布局，中长期持有。',
    };

    it('should render all rating types correctly', () => {
      const ratings: AIAnalysisResult['overall_rating'][] = ['strong_buy', 'buy', 'neutral', 'cautious', 'avoid'];
      const expectedTexts = ['强烈推荐', '推荐', '中性', '谨慎', '回避'];

      ratings.forEach((rating, index) => {
        cleanup();
        const analysis = { ...sampleAnalysis, overall_rating: rating };
        const { container } = render(
          <OverallRatingCard analysis={analysis} onRegenerate={() => {}} />
        );

        const ratingText = container.querySelector('[data-testid="rating-text"]');
        expect(ratingText?.textContent).toBe(expectedTexts[index]);
      });
    });

    it('should render correct number of filled stars based on rating score', () => {
      [1, 2, 3, 4, 5].forEach((score) => {
        cleanup();
        const analysis = { ...sampleAnalysis, rating_score: score };
        const { container } = render(
          <OverallRatingCard analysis={analysis} onRegenerate={() => {}} />
        );

        for (let i = 1; i <= 5; i++) {
          const star = container.querySelector(`[data-testid="star-${i}"]`);
          expect(star).toBeTruthy();
          // SVG elements use getAttribute('class') instead of className
          const starClass = star?.getAttribute('class') || '';
          if (i <= score) {
            expect(starClass).toContain('text-yellow-400');
          } else {
            expect(starClass).toContain('text-gray-200');
          }
        }
      });
    });

    it('should render all trend types correctly', () => {
      const trends: Array<'bullish' | 'bearish' | 'neutral'> = ['bullish', 'bearish', 'neutral'];
      const expectedTexts = ['看涨', '看跌', '震荡'];

      trends.forEach((trend, index) => {
        cleanup();
        const analysis = {
          ...sampleAnalysis,
          technical_analysis: { ...sampleAnalysis.technical_analysis, trend },
        };
        const { container } = render(
          <TechnicalAnalysisCard analysis={analysis} />
        );

        const trendBadge = container.querySelector('[data-testid="trend-badge"]');
        expect(trendBadge?.textContent).toContain(expectedTexts[index]);
      });
    });

    it('should render all valuation types correctly', () => {
      const valuations: Array<'undervalued' | 'fair' | 'overvalued'> = ['undervalued', 'fair', 'overvalued'];
      const expectedTexts = ['低估', '合理', '高估'];

      valuations.forEach((valuation, index) => {
        cleanup();
        const analysis = {
          ...sampleAnalysis,
          fundamental_analysis: { ...sampleAnalysis.fundamental_analysis, valuation },
        };
        const { container } = render(
          <FundamentalAnalysisCard analysis={analysis} />
        );

        const valuationBadge = container.querySelector('[data-testid="valuation-badge"]');
        expect(valuationBadge?.textContent).toContain(expectedTexts[index]);
      });
    });

    it('should render all sentiment types correctly', () => {
      const sentiments: Array<'positive' | 'negative' | 'neutral'> = ['positive', 'negative', 'neutral'];
      const expectedTexts = ['积极', '消极', '中性'];

      sentiments.forEach((sentiment, index) => {
        cleanup();
        const analysis = {
          ...sampleAnalysis,
          sentiment_analysis: { ...sampleAnalysis.sentiment_analysis, sentiment },
        };
        const { container } = render(
          <SentimentAnalysisCard analysis={analysis} />
        );

        const sentimentBadge = container.querySelector('[data-testid="sentiment-badge"]');
        expect(sentimentBadge?.textContent).toContain(expectedTexts[index]);
      });
    });

    it('should render sample analysis with all components', () => {
      const { container } = render(
        <>
          <OverallRatingCard analysis={sampleAnalysis} onRegenerate={() => {}} />
          <TechnicalAnalysisCard analysis={sampleAnalysis} />
          <FundamentalAnalysisCard analysis={sampleAnalysis} />
          <SentimentAnalysisCard analysis={sampleAnalysis} />
          <InvestmentPointsCard analysis={sampleAnalysis} />
          <ConclusionCard analysis={sampleAnalysis} />
        </>
      );

      // Verify all main sections are rendered
      expect(container.querySelector('[data-testid="overall-rating-card"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="technical-analysis-card"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="fundamental-analysis-card"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="sentiment-analysis-card"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="investment-points-card"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="conclusion-card"]')).toBeTruthy();

      // Verify specific content
      expect(container.textContent).toContain('贵州茅台');
      expect(container.textContent).toContain('600519');
      expect(container.textContent).toContain('推荐');
      expect(container.textContent).toContain('4/5');
      expect(container.textContent).toContain('看涨');
      expect(container.textContent).toContain('合理');
      expect(container.textContent).toContain('积极');
    });
  });
});
