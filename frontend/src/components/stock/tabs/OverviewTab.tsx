import React, { useState, useEffect, useCallback } from 'react';
import { stockApi, type KLineData } from '../../../services/api';
import { KLineChart, type KLineDataPoint } from '../../charts/KLineChart';
import { GlassCard } from '../../ui';

export interface OverviewTabProps {
  stockCode: string;
}

// 五档盘口数据
export interface OrderBookData {
  askPrices: number[];    // 卖1-5价格
  askVolumes: number[];   // 卖1-5数量
  bidPrices: number[];    // 买1-5价格
  bidVolumes: number[];   // 买1-5数量
}

// 最新成交记录
export interface RecentTrade {
  time: string;
  price: number;
  volume: number;
  direction: 'buy' | 'sell';
}

// 技术指标
export interface TechnicalIndicator {
  name: string;
  value: string;
  signal: 'positive' | 'negative' | 'neutral';
}

type PeriodType = 'daily' | 'weekly' | 'monthly';

/**
 * 概览标签页组件
 * 显示K线图、五档盘口、最新成交记录、技术指标摘要
 * 需求: 3.1, 3.2, 3.3, 3.4, 3.5
 */
export const OverviewTab: React.FC<OverviewTabProps> = ({ stockCode }) => {
  const [klineData, setKlineData] = useState<KLineDataPoint[]>([]);
  const [period, setPeriod] = useState<PeriodType>('daily');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 五档盘口数据（模拟，实际需要实时数据接口）
  const [orderBook, setOrderBook] = useState<OrderBookData | null>(null);
  
  // 最新成交记录（模拟，实际需要实时数据接口）
  const [recentTrades, setRecentTrades] = useState<RecentTrade[]>([]);
  
  // 技术指标
  const [technicalIndicators, setTechnicalIndicators] = useState<TechnicalIndicator[]>([]);

  // 加载K线数据
  const loadKLineData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await stockApi.getKLine(stockCode, {
        period,
        limit: 60,
      });
      
      // 转换数据格式以适配KLineChart组件
      const chartData: KLineDataPoint[] = response.data.map((item: KLineData) => ({
        date: item.date,
        open: item.open,
        close: item.close,
        high: item.high,
        low: item.low,
        volume: item.volume,
      }));
      
      setKlineData(chartData);
      
      // 基于K线数据计算技术指标（简化版）
      calculateTechnicalIndicators(chartData);
    } catch (err) {
      console.error('加载K线数据失败:', err);
      setError('加载K线数据失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [stockCode, period]);

  // 加载五档盘口数据（模拟）
  const loadOrderBook = useCallback(async () => {
    // TODO: 替换为真实API调用
    // 目前AkShare没有提供实时五档盘口数据，使用模拟数据
    const mockOrderBook: OrderBookData = generateMockOrderBook();
    setOrderBook(mockOrderBook);
  }, []);

  // 加载最新成交记录（模拟）
  const loadRecentTrades = useCallback(async () => {
    // TODO: 替换为真实API调用
    // 目前AkShare没有提供实时成交记录，使用模拟数据
    const mockTrades: RecentTrade[] = generateMockRecentTrades();
    setRecentTrades(mockTrades);
  }, []);

  // 计算技术指标（简化版）
  const calculateTechnicalIndicators = (data: KLineDataPoint[]) => {
    if (data.length < 14) {
      setTechnicalIndicators([]);
      return;
    }

    const closes = data.map(d => d.close);
    const lastClose = closes[closes.length - 1];
    
    // 计算MA5和MA10
    const ma5 = calculateMA(closes, 5);
    const ma10 = calculateMA(closes, 10);
    
    // 计算RSI
    const rsi = calculateRSI(closes, 14);
    
    // 判断MACD趋势（简化）
    const macdSignal = ma5 > ma10 ? 'positive' : ma5 < ma10 ? 'negative' : 'neutral';
    
    // 判断RSI状态
    let rsiSignal: 'positive' | 'negative' | 'neutral' = 'neutral';
    let rsiStatus = '中性';
    if (rsi > 70) {
      rsiSignal = 'negative';
      rsiStatus = '超买';
    } else if (rsi < 30) {
      rsiSignal = 'positive';
      rsiStatus = '超卖';
    }

    // 判断KDJ（简化）
    const kdjSignal = lastClose > ma5 ? 'positive' : 'negative';
    
    setTechnicalIndicators([
      {
        name: 'MACD',
        value: ma5 > ma10 ? '金叉' : '死叉',
        signal: macdSignal,
      },
      {
        name: 'KDJ',
        value: lastClose > ma5 ? '多头' : '空头',
        signal: kdjSignal,
      },
      {
        name: 'RSI',
        value: `${rsi.toFixed(1)} (${rsiStatus})`,
        signal: rsiSignal,
      },
      {
        name: 'MA趋势',
        value: ma5 > ma10 ? '多头排列' : '空头排列',
        signal: ma5 > ma10 ? 'positive' : 'negative',
      },
    ]);
  };

  useEffect(() => {
    loadKLineData();
    loadOrderBook();
    loadRecentTrades();
  }, [loadKLineData, loadOrderBook, loadRecentTrades]);

  // 周期切换
  const handlePeriodChange = (newPeriod: PeriodType) => {
    setPeriod(newPeriod);
  };

  const periodLabels: Record<PeriodType, string> = {
    daily: '日K',
    weekly: '周K',
    monthly: '月K',
  };

  return (
    <div className="space-y-4" data-testid="overview-tab">
      {/* K线图区域 */}
      <GlassCard className="p-4 rounded-[7px]">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-gray-700">K线图</span>
          <div className="flex items-center gap-2">
            {error && (
              <button
                onClick={loadKLineData}
                className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                重试
              </button>
            )}
            <div className="flex gap-1" data-testid="period-selector">
              {(['daily', 'weekly', 'monthly'] as PeriodType[]).map((p) => (
                <button
                  key={p}
                  onClick={() => handlePeriodChange(p)}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    period === p
                      ? 'bg-space-black text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  data-testid={`period-${p}`}
                >
                  {periodLabels[p]}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center h-[400px]">
            <div className="text-gray-500">加载中...</div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-[400px] gap-2">
            <div className="text-red-500 text-sm">{error}</div>
            <button
              onClick={loadKLineData}
              className="px-3 py-1.5 text-xs rounded bg-space-black text-white hover:bg-gray-800 transition-colors"
            >
              点击重试
            </button>
          </div>
        ) : klineData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] gap-2">
            <div className="text-gray-400">暂无K线数据</div>
            <button
              onClick={loadKLineData}
              className="px-3 py-1.5 text-xs rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              刷新数据
            </button>
          </div>
        ) : (
          <KLineChart
            data={klineData}
            stockCode={stockCode}
            title={periodLabels[period]}
            height={400}
            showCard={false}
          />
        )}
      </GlassCard>

      {/* 五档盘口和最新成交 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 五档盘口 */}
        <GlassCard className="p-4 rounded-[7px]">
          <h3 className="text-sm font-medium text-gray-700 mb-3">五档盘口</h3>
          {orderBook ? (
            <OrderBookDisplay orderBook={orderBook} />
          ) : (
            <div className="text-center py-4 text-gray-400 text-sm">暂无盘口数据</div>
          )}
        </GlassCard>

        {/* 最新成交记录 */}
        <GlassCard className="p-4 rounded-[7px]">
          <h3 className="text-sm font-medium text-gray-700 mb-3">最新成交</h3>
          {recentTrades.length > 0 ? (
            <RecentTradesDisplay trades={recentTrades} />
          ) : (
            <div className="text-center py-4 text-gray-400 text-sm">暂无成交记录</div>
          )}
        </GlassCard>
      </div>

      {/* 技术指标摘要 */}
      <GlassCard className="p-4 rounded-[7px]">
        <h3 className="text-sm font-medium text-gray-700 mb-3">技术指标摘要</h3>
        {technicalIndicators.length > 0 ? (
          <TechnicalIndicatorsDisplay indicators={technicalIndicators} />
        ) : (
          <div className="text-center py-4 text-gray-400 text-sm">暂无技术指标数据</div>
        )}
      </GlassCard>
    </div>
  );
};

/**
 * 五档盘口显示组件
 */
interface OrderBookDisplayProps {
  orderBook: OrderBookData;
}

export const OrderBookDisplay: React.FC<OrderBookDisplayProps> = ({ orderBook }) => {
  const { askPrices, askVolumes, bidPrices, bidVolumes } = orderBook;
  
  // 计算最大成交量用于显示比例条
  const maxVolume = Math.max(...askVolumes, ...bidVolumes);
  
  return (
    <div className="space-y-1 text-xs" data-testid="order-book">
      {/* 卖盘（从卖5到卖1） */}
      {[4, 3, 2, 1, 0].map((i) => (
        <div key={`ask-${i}`} className="flex items-center gap-2" data-testid={`ask-${5 - i}`}>
          <span className="w-8 text-gray-500">卖{5 - i}</span>
          <span className="w-16 text-right text-loss-red font-medium">
            {askPrices[i]?.toFixed(2) || '-'}
          </span>
          <div className="flex-1 relative h-4">
            <div
              className="absolute right-0 top-0 h-full bg-red-100"
              style={{ width: `${(askVolumes[i] / maxVolume) * 100}%` }}
            />
            <span className="absolute right-1 top-0 text-gray-600">
              {formatVolumeShort(askVolumes[i])}
            </span>
          </div>
        </div>
      ))}
      
      {/* 分隔线 */}
      <div className="border-t border-gray-200 my-2" />
      
      {/* 买盘（从买1到买5） */}
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={`bid-${i}`} className="flex items-center gap-2" data-testid={`bid-${i + 1}`}>
          <span className="w-8 text-gray-500">买{i + 1}</span>
          <span className="w-16 text-right text-profit-green font-medium">
            {bidPrices[i]?.toFixed(2) || '-'}
          </span>
          <div className="flex-1 relative h-4">
            <div
              className="absolute left-0 top-0 h-full bg-green-100"
              style={{ width: `${(bidVolumes[i] / maxVolume) * 100}%` }}
            />
            <span className="absolute left-1 top-0 text-gray-600">
              {formatVolumeShort(bidVolumes[i])}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * 最新成交记录显示组件
 */
interface RecentTradesDisplayProps {
  trades: RecentTrade[];
}

export const RecentTradesDisplay: React.FC<RecentTradesDisplayProps> = ({ trades }) => {
  return (
    <div className="space-y-1 text-xs" data-testid="recent-trades">
      <div className="flex items-center gap-2 text-gray-500 pb-1 border-b border-gray-100">
        <span className="w-16">时间</span>
        <span className="w-16 text-right">价格</span>
        <span className="w-16 text-right">数量</span>
        <span className="w-8 text-center">方向</span>
      </div>
      {trades.slice(0, 10).map((trade, index) => (
        <div 
          key={index} 
          className="flex items-center gap-2"
          data-testid={`trade-${index}`}
        >
          <span className="w-16 text-gray-500">{trade.time}</span>
          <span className={`w-16 text-right font-medium ${
            trade.direction === 'buy' ? 'text-profit-green' : 'text-loss-red'
          }`}>
            {trade.price.toFixed(2)}
          </span>
          <span className="w-16 text-right text-gray-600">
            {formatVolumeShort(trade.volume)}
          </span>
          <span className={`w-8 text-center ${
            trade.direction === 'buy' ? 'text-profit-green' : 'text-loss-red'
          }`}>
            {trade.direction === 'buy' ? 'B' : 'S'}
          </span>
        </div>
      ))}
    </div>
  );
};

/**
 * 技术指标显示组件
 */
interface TechnicalIndicatorsDisplayProps {
  indicators: TechnicalIndicator[];
}

export const TechnicalIndicatorsDisplay: React.FC<TechnicalIndicatorsDisplayProps> = ({ indicators }) => {
  const getSignalColor = (signal: 'positive' | 'negative' | 'neutral') => {
    switch (signal) {
      case 'positive':
        return 'text-profit-green bg-green-50';
      case 'negative':
        return 'text-loss-red bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="grid grid-cols-4 gap-3" data-testid="technical-indicators">
      {indicators.map((indicator, index) => (
        <div
          key={index}
          className={`p-3 rounded-lg ${getSignalColor(indicator.signal)}`}
          data-testid={`indicator-${indicator.name}`}
        >
          <div className="text-xs opacity-70">{indicator.name}</div>
          <div className="text-sm font-medium">{indicator.value}</div>
        </div>
      ))}
    </div>
  );
};

// 辅助函数：计算移动平均线
function calculateMA(data: number[], period: number): number {
  if (data.length < period) return 0;
  const slice = data.slice(-period);
  return slice.reduce((sum, val) => sum + val, 0) / period;
}

// 辅助函数：计算RSI
function calculateRSI(data: number[], period: number): number {
  if (data.length < period + 1) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = data.length - period; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    if (change > 0) {
      gains += change;
    } else {
      losses -= change;
    }
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// 辅助函数：格式化成交量（简短格式）
function formatVolumeShort(volume: number): string {
  if (volume >= 10000) {
    return (volume / 10000).toFixed(0) + '万';
  }
  return volume.toString();
}

// 辅助函数：生成模拟五档盘口数据
function generateMockOrderBook(): OrderBookData {
  const basePrice = 10 + Math.random() * 20;
  const spread = 0.01;
  
  return {
    askPrices: [
      basePrice + spread * 5,
      basePrice + spread * 4,
      basePrice + spread * 3,
      basePrice + spread * 2,
      basePrice + spread,
    ],
    askVolumes: [
      Math.floor(Math.random() * 50000) + 10000,
      Math.floor(Math.random() * 50000) + 10000,
      Math.floor(Math.random() * 50000) + 10000,
      Math.floor(Math.random() * 50000) + 10000,
      Math.floor(Math.random() * 50000) + 10000,
    ],
    bidPrices: [
      basePrice,
      basePrice - spread,
      basePrice - spread * 2,
      basePrice - spread * 3,
      basePrice - spread * 4,
    ],
    bidVolumes: [
      Math.floor(Math.random() * 50000) + 10000,
      Math.floor(Math.random() * 50000) + 10000,
      Math.floor(Math.random() * 50000) + 10000,
      Math.floor(Math.random() * 50000) + 10000,
      Math.floor(Math.random() * 50000) + 10000,
    ],
  };
}

// 辅助函数：生成模拟最新成交记录
function generateMockRecentTrades(): RecentTrade[] {
  const trades: RecentTrade[] = [];
  const basePrice = 10 + Math.random() * 20;
  const now = new Date();
  
  for (let i = 0; i < 10; i++) {
    const time = new Date(now.getTime() - i * 5000);
    trades.push({
      time: `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}:${time.getSeconds().toString().padStart(2, '0')}`,
      price: basePrice + (Math.random() - 0.5) * 0.2,
      volume: Math.floor(Math.random() * 10000) + 100,
      direction: Math.random() > 0.5 ? 'buy' : 'sell',
    });
  }
  
  return trades;
}

export default OverviewTab;
