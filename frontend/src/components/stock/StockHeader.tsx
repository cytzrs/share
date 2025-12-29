import React from 'react';
import type { StockBasicInfo, StockRealtimeQuote } from '../../services/api';

export interface StockHeaderProps {
  stockInfo: StockBasicInfo | null;
  quote: StockRealtimeQuote | null;
  onRefresh: () => void;
  loading: boolean;
}

// 图标组件
const Icons = {
  open: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  high: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 15l7-7 7 7" />
    </svg>
  ),
  low: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 9l-7 7-7-7" />
    </svg>
  ),
  prevClose: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  volume: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  amount: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  turnover: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  pe: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  pb: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
    </svg>
  ),
  marketCap: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
};

/**
 * 股票头部组件
 * 固定显示股票代码、名称、实时价格等基本信息
 * 需求: 1.1, 1.2, 1.3, 1.4, 11.2
 */
export const StockHeader: React.FC<StockHeaderProps> = ({
  stockInfo,
  quote,
  onRefresh,
  loading,
}) => {
  // 获取价格颜色类名
  const getPriceColorClass = (changePct: number | undefined): string => {
    if (changePct === undefined) return 'text-gray-600';
    return changePct >= 0 ? 'text-profit-green' : 'text-loss-red';
  };

  // 格式化数值
  const formatNumber = (value: number | undefined, decimals: number = 2): string => {
    if (value === undefined || value === null) return '-';
    return value.toFixed(decimals);
  };

  // 格式化成交量（万手）
  const formatVolume = (volume: number | undefined): string => {
    if (volume === undefined || volume === null) return '-';
    return (volume / 10000).toFixed(0) + '万手';
  };

  // 格式化成交额（亿）
  const formatAmount = (amount: number | undefined): string => {
    if (amount === undefined || amount === null) return '-';
    return (amount / 100000000).toFixed(2) + '亿';
  };

  // 格式化市值（亿）
  const formatMarketCap = (marketCap: number | undefined): string => {
    if (marketCap === undefined || marketCap === null) return '-';
    return (marketCap / 100000000).toFixed(2) + '亿';
  };

  // 加载骨架屏
  if (loading && !stockInfo && !quote) {
    return (
      <div className="pl-0 pr-4 py-3 animate-pulse" data-testid="stock-header-skeleton">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="h-5 w-20 bg-gray-200 rounded"></div>
            <div className="h-4 w-14 bg-gray-200 rounded"></div>
          </div>
          <div className="text-right">
            <div className="h-6 w-20 bg-gray-200 rounded"></div>
          </div>
        </div>
        <div className="flex gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-4 w-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  const priceColorClass = getPriceColorClass(quote?.change_pct);

  return (
    <div className="pl-0 pr-4 py-3" data-testid="stock-header">
      {/* 第一行：股票信息 + 价格 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {stockInfo && (
            <>
              <span className="text-lg font-bold text-space-black" data-testid="stock-name">
                {stockInfo.name}
              </span>
              <span className="text-sm text-gray-500" data-testid="stock-code">
                {stockInfo.code}
              </span>
              <span 
                className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600"
                data-testid="stock-market"
              >
                {stockInfo.market === 'SH' ? '上海' : '深圳'}
              </span>
            </>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            className={`p-1.5 rounded-lg hover:bg-gray-100 transition-colors ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            data-testid="refresh-button"
            title="刷新数据"
          >
            <svg 
              className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
              />
            </svg>
          </button>
        </div>
        
        {quote && (
          <div className="text-right">
            <span 
              className={`text-xl font-bold ${priceColorClass}`}
              data-testid="current-price"
            >
              ¥{formatNumber(quote.price)}
            </span>
            <span 
              className={`text-xs ml-2 ${priceColorClass}`}
              data-testid="price-change"
            >
              {quote.change >= 0 ? '+' : ''}{formatNumber(quote.change)}
              ({quote.change_pct >= 0 ? '+' : ''}{formatNumber(quote.change_pct)}%)
            </span>
          </div>
        )}
      </div>

      {/* 第二行：关键指标 - 紧凑横向排列 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs" data-testid="metrics-grid">
        <MetricItem icon={Icons.open} label="今开" value={formatNumber(quote?.open)} />
        <MetricItem icon={Icons.high} label="最高" value={formatNumber(quote?.high)} colorClass="text-loss-red" />
        <MetricItem icon={Icons.low} label="最低" value={formatNumber(quote?.low)} colorClass="text-profit-green" />
        <MetricItem icon={Icons.prevClose} label="昨收" value={formatNumber(quote?.prev_close)} />
        <MetricItem icon={Icons.volume} label="成交量" value={formatVolume(quote?.volume)} />
        <MetricItem icon={Icons.amount} label="成交额" value={formatAmount(quote?.amount)} />
        <MetricItem icon={Icons.turnover} label="换手率" value={quote?.turnover_rate !== undefined ? `${formatNumber(quote.turnover_rate)}%` : '-'} />
        <MetricItem icon={Icons.pe} label="市盈率" value={formatNumber(quote?.pe)} />
        <MetricItem icon={Icons.pb} label="市净率" value={formatNumber(quote?.pb)} />
        <MetricItem icon={Icons.marketCap} label="总市值" value={formatMarketCap(quote?.market_cap)} />
      </div>
    </div>
  );
};

/**
 * 指标项组件 - 带图标的紧凑版
 */
interface MetricItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  colorClass?: string;
  testId?: string;
}

const MetricItem: React.FC<MetricItemProps> = ({ 
  icon,
  label, 
  value, 
  colorClass = 'text-space-black',
  testId,
}) => (
  <div className="flex items-center gap-1" data-testid={testId}>
    <span className="text-gray-400">{icon}</span>
    <span className="text-gray-400">{label}</span>
    <span className={`font-medium ${colorClass}`}>{value}</span>
  </div>
);

// 导出辅助函数供测试使用
export const getPriceColorClass = (changePct: number | undefined): string => {
  if (changePct === undefined) return 'text-gray-600';
  return changePct >= 0 ? 'text-profit-green' : 'text-loss-red';
};

export default StockHeader;
