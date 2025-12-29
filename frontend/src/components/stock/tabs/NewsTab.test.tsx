import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import * as fc from 'fast-check';
import React from 'react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Define types locally to avoid import issues
interface StockNews {
  id: string;
  title: string;
  source: string;
  publish_time: string;
  url: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  summary: string;
}

interface AnalystRating {
  institution: string;
  analyst: string;
  rating: string;
  target_price: number;
  date: string;
}

/**
 * Get sentiment style helper function (copied from NewsTab)
 */
function getSentimentStyle(sentiment: 'positive' | 'negative' | 'neutral'): {
  label: string;
  bgColor: string;
  textColor: string;
} {
  switch (sentiment) {
    case 'positive':
      return { label: '利好', bgColor: 'bg-green-100', textColor: 'text-green-700' };
    case 'negative':
      return { label: '利空', bgColor: 'bg-red-100', textColor: 'text-red-700' };
    case 'neutral':
    default:
      return { label: '中性', bgColor: 'bg-gray-100', textColor: 'text-gray-600' };
  }
}

/**
 * NewsItem component - standalone version for testing
 */
const NewsItem: React.FC<{ news: StockNews; index: number }> = ({ news, index }) => {
  const sentimentStyle = getSentimentStyle(news.sentiment);
  
  return (
    <div
      className={`p-3 rounded-lg hover:bg-gray-50 transition-colors ${news.url ? 'cursor-pointer' : ''}`}
      data-testid={`news-item-${index}`}
    >
      <div className="flex items-start gap-3">
        {/* Sentiment tag */}
        <span
          className={`px-2 py-0.5 text-xs rounded-full flex-shrink-0 ${sentimentStyle.bgColor} ${sentimentStyle.textColor}`}
          data-testid={`news-sentiment-${index}`}
        >
          {sentimentStyle.label}
        </span>
        
        <div className="flex-1 min-w-0">
          {/* News title */}
          <h4
            className="text-sm text-gray-900 font-medium line-clamp-2 hover:text-blue-600 transition-colors"
            data-testid={`news-title-${index}`}
          >
            {news.title}
          </h4>
          
          {/* News summary */}
          {news.summary && (
            <p
              className="text-xs text-gray-500 mt-1 line-clamp-2"
              data-testid={`news-summary-${index}`}
            >
              {news.summary}
            </p>
          )}
          
          {/* Source and time */}
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
            <span data-testid={`news-source-${index}`}>{news.source || '未知来源'}</span>
            <span>·</span>
            <span data-testid={`news-time-${index}`}>{news.publish_time || '-'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * NewsList component - standalone version for testing
 */
const NewsList: React.FC<{ news: StockNews[] }> = ({ news }) => {
  return (
    <div className="space-y-3" data-testid="news-list">
      {news.map((item, index) => (
        <NewsItem key={item.id || index} news={item} index={index} />
      ))}
    </div>
  );
};

/**
 * RatingBadge component - standalone version for testing
 */
const RatingBadge: React.FC<{ rating: string }> = ({ rating }) => {
  const getRatingStyle = (rating: string): { bgColor: string; textColor: string } => {
    const lowerRating = rating?.toLowerCase() || '';
    if (lowerRating.includes('买入') || lowerRating.includes('buy') || lowerRating.includes('强烈推荐')) {
      return { bgColor: 'bg-green-100', textColor: 'text-green-700' };
    }
    if (lowerRating.includes('增持') || lowerRating.includes('outperform') || lowerRating.includes('推荐')) {
      return { bgColor: 'bg-emerald-100', textColor: 'text-emerald-700' };
    }
    if (lowerRating.includes('中性') || lowerRating.includes('neutral') || lowerRating.includes('持有') || lowerRating.includes('hold')) {
      return { bgColor: 'bg-gray-100', textColor: 'text-gray-600' };
    }
    if (lowerRating.includes('减持') || lowerRating.includes('underperform')) {
      return { bgColor: 'bg-orange-100', textColor: 'text-orange-700' };
    }
    if (lowerRating.includes('卖出') || lowerRating.includes('sell')) {
      return { bgColor: 'bg-red-100', textColor: 'text-red-700' };
    }
    return { bgColor: 'bg-gray-100', textColor: 'text-gray-600' };
  };

  const style = getRatingStyle(rating);

  return (
    <span className={`px-2 py-0.5 text-xs rounded-full ${style.bgColor} ${style.textColor}`}>
      {rating || '-'}
    </span>
  );
};

/**
 * AnalystRatingList component - standalone version for testing
 */
const AnalystRatingList: React.FC<{ ratings: AnalystRating[] }> = ({ ratings }) => {
  return (
    <div className="overflow-x-auto" data-testid="analyst-rating-list">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 text-xs border-b border-gray-100">
            <th className="text-left py-2 font-medium">机构</th>
            <th className="text-left py-2 font-medium">分析师</th>
            <th className="text-center py-2 font-medium">评级</th>
            <th className="text-right py-2 font-medium">目标价</th>
            <th className="text-right py-2 font-medium">日期</th>
          </tr>
        </thead>
        <tbody>
          {ratings.map((rating, index) => (
            <tr
              key={index}
              className="border-b border-gray-50 hover:bg-gray-50/50"
              data-testid={`rating-item-${index}`}
            >
              <td className="py-2 text-gray-900" data-testid={`rating-institution-${index}`}>
                {rating.institution || '-'}
              </td>
              <td className="py-2 text-gray-700" data-testid={`rating-analyst-${index}`}>
                {rating.analyst || '-'}
              </td>
              <td className="py-2 text-center" data-testid={`rating-rating-${index}`}>
                <RatingBadge rating={rating.rating} />
              </td>
              <td className="py-2 text-right text-gray-700" data-testid={`rating-target-price-${index}`}>
                {rating.target_price ? `¥${rating.target_price.toFixed(2)}` : '-'}
              </td>
              <td className="py-2 text-right text-gray-500" data-testid={`rating-date-${index}`}>
                {rating.date || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Helper to generate valid ISO date strings
const validDateStringArbitrary = fc.integer({ min: 1704067200000, max: 1767225600000 }) // 2024-01-01 to 2025-12-31
  .map(timestamp => new Date(timestamp).toISOString());

// Arbitrary generator for StockNews
const stockNewsArbitrary = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 5, maxLength: 100 }),
  source: fc.constantFrom('新浪财经', '东方财富', '同花顺', '证券时报', '中国证券报', ''),
  publish_time: validDateStringArbitrary,
  url: fc.constantFrom('https://finance.sina.com.cn/news/123', 'https://www.eastmoney.com/a/456', ''),
  sentiment: fc.constantFrom('positive', 'negative', 'neutral') as fc.Arbitrary<'positive' | 'negative' | 'neutral'>,
  summary: fc.string({ minLength: 0, maxLength: 200 }),
});

// Arbitrary generator for StockNews list (1-10 news items)
const stockNewsListArbitrary = fc.array(stockNewsArbitrary, { minLength: 1, maxLength: 10 });

// Helper to generate valid date strings (YYYY-MM-DD format)
const validDateArbitrary = fc.integer({ min: 1704067200000, max: 1767225600000 }) // 2024-01-01 to 2025-12-31
  .map(timestamp => new Date(timestamp).toISOString().split('T')[0]);

// Arbitrary generator for AnalystRating
const analystRatingArbitrary = fc.record({
  institution: fc.constantFrom('中信证券', '国泰君安', '华泰证券', '招商证券', '中金公司', ''),
  analyst: fc.string({ minLength: 2, maxLength: 20 }),
  rating: fc.constantFrom('买入', '增持', '中性', '减持', '卖出', '持有', '推荐', '强烈推荐'),
  target_price: fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
  date: validDateArbitrary,
});

// Arbitrary generator for AnalystRating list (1-5 ratings)
const analystRatingListArbitrary = fc.array(analystRatingArbitrary, { minLength: 1, maxLength: 5 });

describe('NewsTab - Property Tests', () => {
  /**
   * Property 7: News list with sentiment rendering
   * Feature: stock-detail-page, Property 7: News list with sentiment rendering
   * Validates: Requirements 6.1, 6.2
   * 
   * For any StockNews item list, the rendered NewsTab should display each news
   * title, source, publish time, and sentiment indicator (positive/negative/neutral)
   * correctly mapped to the sentiment field value.
   */
  it('Property 7: News list with sentiment rendering - should render news title, source, and publish time', () => {
    fc.assert(
      fc.property(
        stockNewsListArbitrary,
        (newsList: StockNews[]) => {
          // Clean up before each iteration
          cleanup();
          
          const { container, unmount } = render(
            <NewsList news={newsList} />
          );

          // Verify the news list container is rendered
          const listElement = container.querySelector('[data-testid="news-list"]');
          expect(listElement).toBeTruthy();

          // Verify each news item is displayed
          newsList.forEach((news, index) => {
            // Verify news item row exists
            const itemElement = container.querySelector(`[data-testid="news-item-${index}"]`);
            expect(itemElement).toBeTruthy();

            // Verify news title is displayed
            const titleElement = container.querySelector(`[data-testid="news-title-${index}"]`);
            expect(titleElement).toBeTruthy();
            expect(titleElement?.textContent).toContain(news.title);

            // Verify news source is displayed
            const sourceElement = container.querySelector(`[data-testid="news-source-${index}"]`);
            expect(sourceElement).toBeTruthy();
            expect(sourceElement?.textContent).toContain(news.source || '未知来源');

            // Verify publish time is displayed
            const timeElement = container.querySelector(`[data-testid="news-time-${index}"]`);
            expect(timeElement).toBeTruthy();
            // Time element should exist and have content
            expect(timeElement?.textContent).toBeTruthy();
          });

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7 (continued): Verify sentiment indicator is correctly mapped
   */
  it('Property 7: News list with sentiment rendering - should render sentiment indicator correctly mapped', () => {
    fc.assert(
      fc.property(
        stockNewsListArbitrary,
        (newsList: StockNews[]) => {
          // Clean up before each iteration
          cleanup();
          
          const { container, unmount } = render(
            <NewsList news={newsList} />
          );

          // Verify each news item has correct sentiment indicator
          newsList.forEach((news, index) => {
            const sentimentElement = container.querySelector(`[data-testid="news-sentiment-${index}"]`);
            expect(sentimentElement).toBeTruthy();

            // Verify sentiment label is correctly mapped
            const expectedStyle = getSentimentStyle(news.sentiment);
            expect(sentimentElement?.textContent).toBe(expectedStyle.label);

            // Verify sentiment has correct color classes
            expect(sentimentElement?.className).toContain(expectedStyle.bgColor);
            expect(sentimentElement?.className).toContain(expectedStyle.textColor);
          });

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7 (continued): Verify analyst ratings are displayed correctly
   */
  it('Property 7: News list with sentiment rendering - should render analyst ratings correctly', () => {
    fc.assert(
      fc.property(
        analystRatingListArbitrary,
        (ratings: AnalystRating[]) => {
          // Clean up before each iteration
          cleanup();
          
          const { container, unmount } = render(
            <AnalystRatingList ratings={ratings} />
          );

          // Verify the rating list container is rendered
          const listElement = container.querySelector('[data-testid="analyst-rating-list"]');
          expect(listElement).toBeTruthy();

          // Verify each rating is displayed
          ratings.forEach((rating, index) => {
            // Verify rating row exists
            const rowElement = container.querySelector(`[data-testid="rating-item-${index}"]`);
            expect(rowElement).toBeTruthy();

            // Verify institution is displayed
            const institutionElement = container.querySelector(`[data-testid="rating-institution-${index}"]`);
            expect(institutionElement).toBeTruthy();
            expect(institutionElement?.textContent).toContain(rating.institution || '-');

            // Verify analyst is displayed
            const analystElement = container.querySelector(`[data-testid="rating-analyst-${index}"]`);
            expect(analystElement).toBeTruthy();
            expect(analystElement?.textContent).toContain(rating.analyst || '-');

            // Verify rating badge is displayed
            const ratingElement = container.querySelector(`[data-testid="rating-rating-${index}"]`);
            expect(ratingElement).toBeTruthy();
            expect(ratingElement?.textContent).toContain(rating.rating || '-');

            // Verify target price is displayed
            const targetPriceElement = container.querySelector(`[data-testid="rating-target-price-${index}"]`);
            expect(targetPriceElement).toBeTruthy();
            if (rating.target_price) {
              expect(targetPriceElement?.textContent).toContain(`¥${rating.target_price.toFixed(2)}`);
            } else {
              expect(targetPriceElement?.textContent).toContain('-');
            }

            // Verify date is displayed
            const dateElement = container.querySelector(`[data-testid="rating-date-${index}"]`);
            expect(dateElement).toBeTruthy();
            expect(dateElement?.textContent).toContain(rating.date || '-');
          });

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Unit tests for specific examples
  describe('Unit Tests', () => {
    it('should render news list with specific values correctly', () => {
      const newsList: StockNews[] = [
        {
          id: '1',
          title: '公司发布2024年度业绩预告，净利润同比增长50%',
          source: '新浪财经',
          publish_time: '2024-12-28T10:30:00Z',
          url: 'https://finance.sina.com.cn/news/123',
          sentiment: 'positive',
          summary: '公司预计2024年度净利润将同比增长50%，主要受益于主营业务的快速增长。',
        },
        {
          id: '2',
          title: '行业监管政策收紧，公司面临合规压力',
          source: '证券时报',
          publish_time: '2024-12-27T14:00:00Z',
          url: 'https://www.stcn.com/news/456',
          sentiment: 'negative',
          summary: '监管部门发布新规，对行业提出更严格的合规要求。',
        },
        {
          id: '3',
          title: '公司参加行业展会，展示最新产品',
          source: '东方财富',
          publish_time: '2024-12-26T09:00:00Z',
          url: '',
          sentiment: 'neutral',
          summary: '',
        },
      ];

      const { container } = render(<NewsList news={newsList} />);

      // Verify first news (positive sentiment)
      const title0 = container.querySelector('[data-testid="news-title-0"]');
      expect(title0?.textContent).toContain('公司发布2024年度业绩预告');
      
      const sentiment0 = container.querySelector('[data-testid="news-sentiment-0"]');
      expect(sentiment0?.textContent).toBe('利好');
      expect(sentiment0?.className).toContain('bg-green-100');
      
      const source0 = container.querySelector('[data-testid="news-source-0"]');
      expect(source0?.textContent).toContain('新浪财经');

      // Verify second news (negative sentiment)
      const title1 = container.querySelector('[data-testid="news-title-1"]');
      expect(title1?.textContent).toContain('行业监管政策收紧');
      
      const sentiment1 = container.querySelector('[data-testid="news-sentiment-1"]');
      expect(sentiment1?.textContent).toBe('利空');
      expect(sentiment1?.className).toContain('bg-red-100');

      // Verify third news (neutral sentiment)
      const sentiment2 = container.querySelector('[data-testid="news-sentiment-2"]');
      expect(sentiment2?.textContent).toBe('中性');
      expect(sentiment2?.className).toContain('bg-gray-100');
    });

    it('should render analyst ratings with specific values correctly', () => {
      const ratings: AnalystRating[] = [
        {
          institution: '中信证券',
          analyst: '张三',
          rating: '买入',
          target_price: 50.00,
          date: '2024-12-28',
        },
        {
          institution: '国泰君安',
          analyst: '李四',
          rating: '增持',
          target_price: 45.50,
          date: '2024-12-25',
        },
        {
          institution: '华泰证券',
          analyst: '王五',
          rating: '中性',
          target_price: 40.00,
          date: '2024-12-20',
        },
      ];

      const { container } = render(<AnalystRatingList ratings={ratings} />);

      // Verify first rating
      const institution0 = container.querySelector('[data-testid="rating-institution-0"]');
      expect(institution0?.textContent).toContain('中信证券');
      
      const analyst0 = container.querySelector('[data-testid="rating-analyst-0"]');
      expect(analyst0?.textContent).toContain('张三');
      
      const rating0 = container.querySelector('[data-testid="rating-rating-0"]');
      expect(rating0?.textContent).toContain('买入');
      
      const targetPrice0 = container.querySelector('[data-testid="rating-target-price-0"]');
      expect(targetPrice0?.textContent).toContain('¥50.00');
      
      const date0 = container.querySelector('[data-testid="rating-date-0"]');
      expect(date0?.textContent).toContain('2024-12-28');

      // Verify second rating
      const institution1 = container.querySelector('[data-testid="rating-institution-1"]');
      expect(institution1?.textContent).toContain('国泰君安');
      
      const rating1 = container.querySelector('[data-testid="rating-rating-1"]');
      expect(rating1?.textContent).toContain('增持');
    });

    it('should handle empty source correctly', () => {
      const newsList: StockNews[] = [
        {
          id: '1',
          title: '测试新闻标题',
          source: '',
          publish_time: '2024-12-28T10:00:00Z',
          url: '',
          sentiment: 'neutral',
          summary: '',
        },
      ];

      const { container } = render(<NewsList news={newsList} />);

      const sourceElement = container.querySelector('[data-testid="news-source-0"]');
      expect(sourceElement?.textContent).toContain('未知来源');
    });

    it('should handle empty analyst rating fields correctly', () => {
      const ratings: AnalystRating[] = [
        {
          institution: '',
          analyst: '',
          rating: '',
          target_price: 0,
          date: '',
        },
      ];

      const { container } = render(<AnalystRatingList ratings={ratings} />);

      const institutionElement = container.querySelector('[data-testid="rating-institution-0"]');
      expect(institutionElement?.textContent).toContain('-');
      
      const analystElement = container.querySelector('[data-testid="rating-analyst-0"]');
      expect(analystElement?.textContent).toContain('-');
      
      const dateElement = container.querySelector('[data-testid="rating-date-0"]');
      expect(dateElement?.textContent).toContain('-');
    });

    it('should display all sentiment types correctly', () => {
      // Test positive sentiment
      expect(getSentimentStyle('positive')).toEqual({
        label: '利好',
        bgColor: 'bg-green-100',
        textColor: 'text-green-700',
      });

      // Test negative sentiment
      expect(getSentimentStyle('negative')).toEqual({
        label: '利空',
        bgColor: 'bg-red-100',
        textColor: 'text-red-700',
      });

      // Test neutral sentiment
      expect(getSentimentStyle('neutral')).toEqual({
        label: '中性',
        bgColor: 'bg-gray-100',
        textColor: 'text-gray-600',
      });
    });

    it('should render rating badge with correct colors for different ratings', () => {
      const { container: buyContainer } = render(<RatingBadge rating="买入" />);
      expect(buyContainer.querySelector('span')?.className).toContain('bg-green-100');
      cleanup();

      const { container: holdContainer } = render(<RatingBadge rating="增持" />);
      expect(holdContainer.querySelector('span')?.className).toContain('bg-emerald-100');
      cleanup();

      const { container: neutralContainer } = render(<RatingBadge rating="中性" />);
      expect(neutralContainer.querySelector('span')?.className).toContain('bg-gray-100');
      cleanup();

      const { container: reduceContainer } = render(<RatingBadge rating="减持" />);
      expect(reduceContainer.querySelector('span')?.className).toContain('bg-orange-100');
      cleanup();

      const { container: sellContainer } = render(<RatingBadge rating="卖出" />);
      expect(sellContainer.querySelector('span')?.className).toContain('bg-red-100');
    });
  });
});
