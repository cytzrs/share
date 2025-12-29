import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GlassCard, Label, StatusLabel } from '../components/ui';
import { AssetCurveChart, type AssetDataPoint } from '../components/charts';
import { StockDetailDrawer, StockCodeLink } from '../components/stock';
import { agentApi, llmProviderApi } from '../services/api';
import type { ModelAgent, Portfolio as PortfolioType, PortfolioMetrics, Position, LLMProvider } from '../types';

// Time range options for asset history
type TimeRange = '7d' | '30d' | '90d' | '180d' | '1y' | 'all';

// Position tab type
type PositionTab = 'current' | 'history';

/**
 * Portfolio页面 - Agent详情与投资组合
 */
const Portfolio: React.FC = () => {
  const [searchParams] = useSearchParams();
  
  // State for stock detail drawer
  const [selectedStockCode, setSelectedStockCode] = useState<string | null>(null);
  
  // State for agents and selection
  const [agents, setAgents] = useState<ModelAgent[]>([]);
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<ModelAgent | null>(null);
  
  // State for portfolio data
  const [portfolio, setPortfolio] = useState<PortfolioType | null>(null);
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  const [assetHistory, setAssetHistory] = useState<AssetDataPoint[]>([]);
  const [historyPositions, setHistoryPositions] = useState<Position[]>([]);
  
  // State for UI
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [positionTab, setPositionTab] = useState<PositionTab>('current');
  const [filterText, setFilterText] = useState('');

  // Load agents list
  useEffect(() => {
    loadAgents();
  }, []);

  // Load portfolio data when agent is selected
  useEffect(() => {
    if (selectedAgentId) {
      loadPortfolioData(selectedAgentId);
    }
  }, [selectedAgentId, timeRange]);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const [agentsResponse, providersResponse] = await Promise.all([
        agentApi.list({ page: 1, page_size: 100 }),
        llmProviderApi.list(),
      ]);
      setAgents(agentsResponse.items);
      setProviders(providersResponse as LLMProvider[]);
      
      // Check URL param for agent_id first
      const urlAgentId = searchParams.get('agent_id');
      if (urlAgentId && agentsResponse.items.some(a => a.agent_id === urlAgentId)) {
        setSelectedAgentId(urlAgentId);
        setSelectedAgent(agentsResponse.items.find(a => a.agent_id === urlAgentId) || null);
      } else {
        // Auto-select first active agent
        const activeAgent = agentsResponse.items.find(a => a.status === 'active');
        if (activeAgent) {
          setSelectedAgentId(activeAgent.agent_id);
          setSelectedAgent(activeAgent);
        } else if (agentsResponse.items.length > 0) {
          setSelectedAgentId(agentsResponse.items[0].agent_id);
          setSelectedAgent(agentsResponse.items[0]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载Agent列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadPortfolioData = async (agentId: string) => {
    try {
      setLoading(true);
      setError(null);

      // Calculate date range based on timeRange
      const endDate = new Date();
      const startDate = new Date();
      switch (timeRange) {
        case '7d': startDate.setDate(endDate.getDate() - 7); break;
        case '30d': startDate.setDate(endDate.getDate() - 30); break;
        case '90d': startDate.setDate(endDate.getDate() - 90); break;
        case '180d': startDate.setDate(endDate.getDate() - 180); break;
        case '1y': startDate.setFullYear(endDate.getFullYear() - 1); break;
        case 'all': startDate.setFullYear(2020); break;
      }

      // Fetch portfolio, metrics in parallel
      const [portfolioData, metricsData] = await Promise.all([
        agentApi.getPortfolio(agentId),
        agentApi.getMetrics(agentId),
      ]);

      // Fetch asset history separately
      let historyData: AssetDataPoint[];
      try {
        historyData = await agentApi.getAssetHistory(agentId, {
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
        });
      } catch {
        historyData = generateMockAssetHistory(metricsData?.total_assets || 20000, timeRange);
      }

      // Fetch history positions (已清仓的股票)
      let historyPosData: Position[] = [];
      try {
        historyPosData = await agentApi.getHistoryPositions(agentId);
      } catch {
        // 如果获取失败，使用空数组
        historyPosData = [];
      }

      setPortfolio(portfolioData);
      setMetrics(metricsData);
      setAssetHistory(historyData);
      setHistoryPositions(historyPosData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载投资组合数据失败');
      generateMockData();
    } finally {
      setLoading(false);
    }
  };

  // Generate mock data for demo purposes
  const generateMockData = () => {
    const mockPortfolio: PortfolioType = {
      agent_id: selectedAgentId || '',
      cash: 15000,
      positions: [
        { stock_code: '600000', shares: 100, avg_cost: 10.5, buy_date: '2024-01-15', current_price: 11.2, market_value: 1120, profit_loss: 70, profit_loss_rate: 6.67 },
        { stock_code: '000001', shares: 200, avg_cost: 15.0, buy_date: '2024-02-01', current_price: 14.5, market_value: 2900, profit_loss: -100, profit_loss_rate: -3.33 },
      ],
      total_assets: 19020,
      total_market_value: 4020,
      return_rate: -4.9,
    };
    
    const mockMetrics: PortfolioMetrics = {
      total_assets: 19020,
      total_market_value: 4020,
      cash: 15000,
      return_rate: -4.9,
      annual_return_rate: -9.8,
      max_drawdown: 8.5,
      sharpe_ratio: 0.65,
    };

    setPortfolio(mockPortfolio);
    setMetrics(mockMetrics);
    setAssetHistory(generateMockAssetHistory(19020, timeRange));
    setHistoryPositions(generateMockHistoryPositions());
  };

  // Filtered positions
  const filteredPositions = useMemo(() => {
    const positions = positionTab === 'current' ? (portfolio?.positions || []) : historyPositions;
    if (!filterText) return positions;
    return positions.filter(p => p.stock_code.toLowerCase().includes(filterText.toLowerCase()));
  }, [portfolio?.positions, historyPositions, positionTab, filterText]);

  // Format helpers
  const formatCurrency = (value: number | string | undefined | null): string => {
    const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
    return `¥${(isNaN(num) ? 0 : num).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPercent = (value: number | string | undefined | null): string => {
    const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
    const safeNum = isNaN(num) ? 0 : num;
    const sign = safeNum >= 0 ? '+' : '';
    return `${sign}${safeNum.toFixed(2)}%`;
  };

  const formatDate = (dateStr: string, withTime: boolean = false): string => {
    const date = new Date(dateStr);
    if (withTime) {
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    }
    return date.toLocaleDateString('zh-CN');
  };

  const getScheduleLabel = (scheduleType: string): string => {
    switch (scheduleType) {
      case 'hourly': return '每小时';
      case 'daily': return '每日';
      case 'weekly': return '每周';
      case 'monthly': return '每月';
      case 'manual': return '手动';
      default: return scheduleType || '手动';
    }
  };

  const getProviderName = (providerId: string): string => {
    const provider = providers.find(p => p.provider_id === providerId);
    return provider?.name || '未设置';
  };

  // Handle export
  const handleExport = useCallback(() => {
    if (filteredPositions.length === 0) return;
    
    const headers = ['股票代码', '持仓数量', '成本价', '现价', '市值', '盈亏', '盈亏率', '买入日期'];
    const rows = filteredPositions.map(p => [
      p.stock_code,
      p.shares,
      Number(p.avg_cost).toFixed(2),
      Number(p.current_price || 0).toFixed(2),
      Number(p.market_value || 0).toFixed(2),
      Number(p.profit_loss || 0).toFixed(2),
      `${Number(p.profit_loss_rate || 0).toFixed(2)}%`,
      p.buy_date,
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `portfolio_${selectedAgentId}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [filteredPositions, selectedAgentId]);

  // Loading state
  if (loading && agents.length === 0) {
    return (
      <div className="h-full bg-ios-gray flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  // Error state
  if (error && !portfolio) {
    return (
      <div className="h-full bg-ios-gray flex items-center justify-center p-4">
        <GlassCard className="max-w-md p-6 rounded-[7px]">
          <div className="text-center">
            <div className="text-loss-red mb-4 text-lg font-semibold">加载失败</div>
            <p className="text-gray-500 mb-4">{error}</p>
            <button 
              onClick={() => selectedAgentId && loadPortfolioData(selectedAgentId)}
              className="text-info-blue hover:underline font-medium"
            >
              重试
            </button>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="h-full bg-ios-gray p-4 md:p-6 overflow-auto">
      <div className="space-y-4">
        {/* Agent Info + Portfolio Summary - Combined Card */}
        {selectedAgent && (
          <GlassCard className="p-4 rounded-[7px]">
            <div className="flex flex-col lg:flex-row lg:items-start gap-4">
              {/* Left: Agent Info */}
              <div className="flex-shrink-0 lg:w-64 lg:border-r lg:border-gray-200/50 lg:pr-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-space-black/10 flex items-center justify-center">
                    <span className="text-lg font-bold text-space-black">{selectedAgent.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-bold text-space-black truncate">{selectedAgent.name}</h2>
                    <StatusLabel status={selectedAgent.status === 'active' ? 'profit' : 'warning'} className="text-[10px] mt-0.5">
                      {selectedAgent.status === 'active' ? '运行中' : '已暂停'}
                    </StatusLabel>
                  </div>
                </div>
                
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">渠道</span>
                    <span className="text-gray-700 font-medium">{getProviderName(selectedAgent.provider_id)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">模型</span>
                    <span className="text-gray-700 font-medium">{selectedAgent.llm_model}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">调度策略</span>
                    <span className="text-gray-700 font-medium">{getScheduleLabel(selectedAgent.schedule_type)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">初始资金</span>
                    <span className="text-gray-700 font-medium">{formatCurrency(selectedAgent.initial_cash)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">创建时间</span>
                    <span className="text-gray-700">{formatDate(selectedAgent.created_at, true)}</span>
                  </div>
                </div>
              </div>

              {/* Right: Portfolio Summary */}
              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Total Assets */}
                <div className="bg-gray-50/50 rounded-lg p-3">
                  <div className="text-[10px] text-gray-500 uppercase mb-1">总资产</div>
                  <div className="text-lg font-bold text-space-black">{formatCurrency(metrics?.total_assets)}</div>
                  <div className={`text-xs ${(metrics?.return_rate ?? 0) >= 0 ? 'text-profit-green' : 'text-loss-red'}`}>
                    {formatPercent(metrics?.return_rate)}
                  </div>
                </div>
                
                {/* Cash */}
                <div className="bg-gray-50/50 rounded-lg p-3">
                  <div className="text-[10px] text-gray-500 uppercase mb-1">现金余额</div>
                  <div className="text-lg font-bold text-space-black">{formatCurrency(metrics?.cash)}</div>
                  <div className="text-xs text-gray-500">
                    占比 {metrics?.total_assets ? ((Number(metrics.cash) / Number(metrics.total_assets)) * 100).toFixed(1) : 0}%
                  </div>
                </div>
                
                {/* Market Value */}
                <div className="bg-gray-50/50 rounded-lg p-3">
                  <div className="text-[10px] text-gray-500 uppercase mb-1">持仓市值</div>
                  <div className="text-lg font-bold text-space-black">{formatCurrency(metrics?.total_market_value)}</div>
                  <div className="text-xs text-gray-500">
                    {portfolio?.positions?.length || 0} 只股票
                  </div>
                </div>
                
                {/* Annual Return */}
                <div className="bg-gray-50/50 rounded-lg p-3">
                  <div className="text-[10px] text-gray-500 uppercase mb-1">年化收益</div>
                  <div className={`text-lg font-bold ${(Number(metrics?.annual_return_rate) || 0) >= 0 ? 'text-profit-green' : 'text-loss-red'}`}>
                    {formatPercent(metrics?.annual_return_rate)}
                  </div>
                  <div className="text-xs text-gray-500">
                    夏普 {(Number(metrics?.sharpe_ratio) || 0).toFixed(2)}
                  </div>
                </div>
                
                {/* Max Drawdown */}
                <div className="bg-gray-50/50 rounded-lg p-3">
                  <div className="text-[10px] text-gray-500 uppercase mb-1">最大回撤</div>
                  <div className="text-lg font-bold text-loss-red">-{(Number(metrics?.max_drawdown) || 0).toFixed(2)}%</div>
                </div>
                
                {/* Positions Count */}
                <div className="bg-gray-50/50 rounded-lg p-3">
                  <div className="text-[10px] text-gray-500 uppercase mb-1">持仓数量</div>
                  <div className="text-lg font-bold text-space-black">{selectedAgent.positions_count ?? portfolio?.positions?.length ?? 0}</div>
                </div>
                
                {/* Transactions Count */}
                <div className="bg-gray-50/50 rounded-lg p-3">
                  <div className="text-[10px] text-gray-500 uppercase mb-1">交易次数</div>
                  <div className="text-lg font-bold text-space-black">{selectedAgent.transactions_count ?? 0}</div>
                </div>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Position Table */}
          <GlassCard className="p-4 rounded-[7px]">
            {/* Header with Tabs */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPositionTab('current')}
                  className={`px-3 py-1 text-xs rounded-lg transition-all ${
                    positionTab === 'current' ? 'bg-space-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  当前持仓
                </button>
                <button
                  onClick={() => setPositionTab('history')}
                  className={`px-3 py-1 text-xs rounded-lg transition-all ${
                    positionTab === 'history' ? 'bg-space-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  历史持仓
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder="搜索股票..."
                  className="px-2 py-1 text-xs rounded-lg bg-gray-100 border-none outline-none w-24"
                />
                <button
                  onClick={handleExport}
                  disabled={filteredPositions.length === 0}
                  className="px-2 py-1 text-xs rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50"
                >
                  导出
                </button>
              </div>
            </div>

            {/* Position List */}
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {loading ? (
                <div className="text-center py-8 text-gray-400 text-sm">加载中...</div>
              ) : filteredPositions.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  {positionTab === 'current' ? '暂无持仓' : '暂无历史持仓'}
                </div>
              ) : (
                filteredPositions.map((pos, idx) => {
                  // 计算持仓占比（仅当前持仓）
                  const positionRatio = positionTab === 'current' && metrics?.total_assets
                    ? ((Number(pos.market_value) || 0) / Number(metrics.total_assets) * 100).toFixed(1)
                    : null;
                  
                  return (
                  <div key={`${pos.stock_code}-${idx}`} className="p-3 bg-gray-50/50 rounded-lg">
                    {/* Row 1: Stock Code + Market Value */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <StockCodeLink 
                          code={pos.stock_code}
                          name={pos.stock_name}
                          onClick={setSelectedStockCode}
                          className="text-base font-bold"
                        />
                        <StockBadge code={pos.stock_code} />
                        {positionTab === 'history' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-500">已清仓</span>
                        )}
                        {positionRatio && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600">占比 {positionRatio}%</span>
                        )}
                      </div>
                      <div className="text-base font-bold text-space-black">{formatCurrency(pos.market_value)}</div>
                    </div>
                    {/* Row 2: Details */}
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-4 text-gray-600">
                        <span>{pos.shares}股</span>
                        <span>成本 ¥{Number(pos.avg_cost).toFixed(2)}</span>
                        <span>买入 {formatDate(pos.buy_date, true)}</span>
                        {positionTab === 'history' && pos.sell_date && (
                          <span>卖出 {formatDate(pos.sell_date, true)}</span>
                        )}
                      </div>
                      <div className={`font-medium ${(Number(pos.profit_loss_rate) || 0) >= 0 ? 'text-profit-green' : 'text-loss-red'}`}>
                        {formatPercent(pos.profit_loss_rate)} ({(Number(pos.profit_loss) || 0) >= 0 ? '+' : ''}¥{Number(pos.profit_loss || 0).toFixed(2)})
                      </div>
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          </GlassCard>

          {/* Asset History Chart */}
          <GlassCard className="p-4 rounded-[7px]">
            {/* Time Range Selector */}
            <div className="flex items-center justify-between mb-3">
              <Label className="text-xs">资产曲线</Label>
              <div className="flex gap-1">
                {(['7d', '30d', '90d', '1y'] as TimeRange[]).map(range => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-2 py-1 text-[10px] rounded-lg transition-all ${
                      timeRange === range ? 'bg-space-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {range === 'all' ? '全部' : range}
                  </button>
                ))}
              </div>
            </div>
            
            <AssetCurveChart 
              data={assetHistory} 
              title=""
              height={260}
              showCard={false}
            />
          </GlassCard>
        </div>
      </div>

      {/* 股票详情抽屉 */}
      <StockDetailDrawer 
        stockCode={selectedStockCode} 
        onClose={() => setSelectedStockCode(null)} 
      />
    </div>
  );
};

export default Portfolio;

// Helper function to generate mock asset history
function generateMockAssetHistory(currentTotal: number, timeRange: TimeRange): AssetDataPoint[] {
  const data: AssetDataPoint[] = [];
  const today = new Date();
  let days: number;
  
  switch (timeRange) {
    case '7d': days = 7; break;
    case '30d': days = 30; break;
    case '90d': days = 90; break;
    case '180d': days = 180; break;
    case '1y': days = 365; break;
    case 'all': days = 365; break;
    default: days = 30;
  }
  
  const baseValue = currentTotal * 0.85;
  
  for (let i = days; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const progress = (days - i) / days;
    const randomFactor = 0.97 + Math.random() * 0.06;
    const value = baseValue + (currentTotal - baseValue) * progress * randomFactor;
    data.push({
      date: date.toISOString().split('T')[0],
      value: Math.round(value * 100) / 100,
    });
  }
  
  return data;
}

// Helper function to generate mock history positions
function generateMockHistoryPositions(): Position[] {
  return [
    { stock_code: '601318', shares: 0, avg_cost: 45.5, buy_date: '2024-01-05', sell_date: '2024-02-20', current_price: 48.2, market_value: 0, profit_loss: 270, profit_loss_rate: 5.93 },
    { stock_code: '600519', shares: 0, avg_cost: 1680, buy_date: '2024-01-10', sell_date: '2024-03-15', current_price: 1720, market_value: 0, profit_loss: 400, profit_loss_rate: 2.38 },
    { stock_code: '000858', shares: 0, avg_cost: 125.5, buy_date: '2024-02-01', sell_date: '2024-03-01', current_price: 118.0, market_value: 0, profit_loss: -750, profit_loss_rate: -5.98 },
  ];
}

// Stock badge component
const StockBadge: React.FC<{ code: string }> = ({ code }) => {
  let label = '';
  let colorClass = '';
  
  if (code.startsWith('688')) {
    label = '科创';
    colorClass = 'bg-purple-100 text-purple-600';
  } else if (code.startsWith('300') || code.startsWith('301')) {
    label = '创业';
    colorClass = 'bg-orange-100 text-orange-600';
  } else if (code.startsWith('60')) {
    label = '沪A';
    colorClass = 'bg-blue-100 text-blue-600';
  } else if (code.startsWith('00')) {
    label = '深A';
    colorClass = 'bg-green-100 text-green-600';
  }
  
  if (!label) return null;
  
  return (
    <span className={`text-[10px] px-1 py-0.5 rounded font-medium ${colorClass}`}>
      {label}
    </span>
  );
};
