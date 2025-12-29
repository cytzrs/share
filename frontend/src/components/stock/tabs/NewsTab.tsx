import React, { useState, useEffect, useCallback } from 'react';
import { stockApi, type StockNews, type AnalystRating } from '../../../services/api';
import { GlassCard } from '../../ui';

export interface NewsTabProps {
  stockCode: string;
}

/**
 * 获取情感标签样式
 */
export function getSentimentStyle(sentiment: 'positive' | 'negative' | 'neutral'): {
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
 * 格式化发布时间
 */
function formatPublishTime(timeStr: string): string {
  if (!timeStr) return '-';
  try {
    const date = new Date(timeStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffHours < 1) {
      return '刚刚';
    } else if (diffHours < 24) {
      return `${diffHours}小时前`;
    } else if (diffDays < 7) {
      return `${diffDays}天前`;
    } else {
      return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    }
  } catch {
    return timeStr;
  }
}

/**
 * 资讯标签页组件
 */
export const NewsTab: React.FC<NewsTabProps> = ({ stockCode }) => {
  const [news, setNews] = useState<StockNews[]>([]);
  const [ratings, setRatings] = useState<AnalystRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNewsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [newsResponse, ratingsResponse] = await Promise.all([
        stockApi.getNews(stockCode, { page: 1, page_size: 20 }),
        stockApi.getAnalystRatings(stockCode),
      ]);
      
      setNews(newsResponse.data || []);
      setRatings(ratingsResponse.ratings || []);
    } catch (err) {
      console.error('加载资讯数据失败:', err);
      setError('加载资讯数据失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [stockCode]);

  useEffect(() => {
    loadNewsData();
  }, [loadNewsData]);

  if (loading) {
    return (
      <div className="space-y-4" data-testid="news-tab-loading">
        <GlassCard className="p-4 rounded-[7px]">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-24"></div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="py-2 border-b border-gray-100 last:border-0">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/3"></div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4" data-testid="news-tab-error">
        <GlassCard className="p-6 rounded-[7px]">
          <div className="text-center">
            <p className="text-gray-500 mb-3">{error}</p>
            <button
              onClick={loadNewsData}
              className="px-4 py-1.5 bg-space-black text-white rounded text-sm"
            >
              重试
            </button>
          </div>
        </GlassCard>
      </div>
    );
  }

  if (news.length === 0 && ratings.length === 0) {
    return (
      <div className="space-y-4" data-testid="news-tab-empty">
        <GlassCard className="p-6 rounded-[7px]">
          <p className="text-center text-gray-400">暂无相关资讯</p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="news-tab">
      {/* 新闻列表 */}
      {news.length > 0 && (
        <GlassCard className="p-4 rounded-[7px]">
          <h3 className="text-sm font-medium text-gray-700 mb-3">最新资讯</h3>
          <div className="divide-y divide-gray-100">
            {news.map((item, index) => (
              <div
                key={item.id || index}
                className={`py-3 first:pt-0 last:pb-0 ${item.url ? 'cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded' : ''}`}
                onClick={() => item.url && window.open(item.url, '_blank', 'noopener,noreferrer')}
                data-testid={`news-item-${index}`}
              >
                {/* 标题行 */}
                <div className="flex items-start gap-2">
                  <span className={`px-1.5 py-0.5 text-[10px] rounded flex-shrink-0 ${getSentimentStyle(item.sentiment).bgColor} ${getSentimentStyle(item.sentiment).textColor}`}>
                    {getSentimentStyle(item.sentiment).label}
                  </span>
                  <h4 className="text-sm text-gray-900 leading-snug line-clamp-2 flex-1 text-left">
                    {item.title}
                  </h4>
                </div>
                {/* 摘要 */}
                {item.summary && (
                  <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 text-left pl-7">
                    {item.summary}
                  </p>
                )}
                {/* 来源和时间 */}
                <div className="flex items-center gap-2 mt-1.5 text-[11px] text-gray-400 pl-7">
                  <span>{item.source || '未知来源'}</span>
                  <span>·</span>
                  <span>{formatPublishTime(item.publish_time)}</span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* 机构评级 */}
      {ratings.length > 0 && (
        <GlassCard className="p-4 rounded-[7px]">
          <h3 className="text-sm font-medium text-gray-700 mb-3">机构评级</h3>
          <div className="divide-y divide-gray-100">
            {ratings.map((rating, index) => (
              <div key={index} className="py-2.5 first:pt-0 last:pb-0" data-testid={`rating-item-${index}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-sm text-gray-900 font-medium truncate">
                      {rating.institution || '-'}
                    </span>
                    <span className="text-xs text-gray-500 truncate">
                      {rating.analyst || ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <RatingBadge rating={rating.rating} />
                    {rating.target_price && (
                      <span className="text-sm text-gray-700">
                        ¥{rating.target_price.toFixed(2)}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 w-20 text-right">
                      {rating.date || '-'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
};

/**
 * 评级徽章组件
 */
interface RatingBadgeProps {
  rating: string;
}

export const RatingBadge: React.FC<RatingBadgeProps> = ({ rating }) => {
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
    <span className={`px-2 py-0.5 text-xs rounded ${style.bgColor} ${style.textColor}`}>
      {rating || '-'}
    </span>
  );
};

// 保留导出以兼容测试
export const NewsList: React.FC<{ news: StockNews[] }> = () => null;
export const NewsItem: React.FC<{ news: StockNews; index: number }> = () => null;
export const AnalystRatingList: React.FC<{ ratings: AnalystRating[] }> = () => null;

export default NewsTab;
