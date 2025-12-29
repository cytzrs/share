import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { GlassCard, Label, SecondaryButton } from '../components/ui';
import { CompareChart, type AgentAssetCurve } from '../components/charts';
import { agentApi, compareApi } from '../services/api';
import { ChartSkeleton, CardSkeleton } from '../components/common';
import type { ModelAgent, PortfolioMetrics } from '../types';

// Time range options
type TimeRange = '7d' | '30d' | '90d' | '180d' | '1y' | 'all';

// Agent with metrics for comparison
interface AgentWithMetrics {
  agent: ModelAgent;
  metrics: PortfolioMetrics | null;
  assetCurve: Array<{ date: string; value: number }>;
  selected: boolean;
}

/**
 * Compare页面 - 多模型对比分析
 * 支持模型选择、收益率对比图和风险指标对比表
 */
const Compare: React.FC = () => {
  // State for agents
  const [agentsWithMetrics, setAgentsWithMetrics] = useState<AgentWithMetrics[]>([]);
  
  // State for UI
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  // Load agents on mount
  useEffect(() => {
    loadAgents();
  }, []);

  // Reload data when time range changes
  useEffect(() => {
    const selectedAgentIds = agentsWithMetrics
      .filter(a => a.selected)
      .map(a => a.agent.agent_id);
    
    if (selectedAgentIds.length > 0) {
      loadComparisonData(selectedAgentIds);
    }
  }, [timeRange]);

  const loadAgents = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await agentApi.list({ page: 1, page_size: 100 });
      
      // Initialize agents with empty metrics
      const agentsData: AgentWithMetrics[] = response.items.map(agent => ({
        agent,
        metrics: null,
        assetCurve: [],
        selected: false,
      }));

      setAgentsWithMetrics(agentsData);

      // Auto-select first 2 active agents
      const activeAgents = agentsData.filter(a => a.agent.status === 'active');
      if (activeAgents.length >= 2) {
        const selectedIds = activeAgents.slice(0, 2).map(a => a.agent.agent_id);
        setAgentsWithMetrics(prev => prev.map(a => ({
          ...a,
          selected: selectedIds.includes(a.agent.agent_id),
        })));
        await loadComparisonData(selectedIds);
      } else if (activeAgents.length === 1) {
        const selectedIds = [activeAgents[0].agent.agent_id];
        setAgentsWithMetrics(prev => prev.map(a => ({
          ...a,
          selected: selectedIds.includes(a.agent.agent_id),
        })));
        await loadComparisonData(selectedIds);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载Agent列表失败');
      // Generate mock data for demo
      generateMockData();
    } finally {
      setLoading(false);
    }
  };

  const loadComparisonData = async (agentIds: string[]) => {
    if (agentIds.length === 0) return;

    try {
      setLoading(true);
      setError(null);

      // Calculate date range
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

      // Try to use compare API only if we have at least 2 agents
      if (agentIds.length >= 2) {
        try {
          const compareData = await compareApi.compare(agentIds, {
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0],
          });

          setAgentsWithMetrics(prev => prev.map(a => {
            const compareAgent = compareData.agents.find(ca => ca.agent_id === a.agent.agent_id);
            if (compareAgent) {
              return {
                ...a,
                metrics: compareAgent.metrics,
                assetCurve: compareAgent.asset_curve,
              };
            }
            return a;
          }));
          return;
        } catch {
          // Fallback to individual loading
        }
      }

      // Fallback: load metrics individually
      const metricsPromises = agentIds.map(async (agentId) => {
        try {
          const [metrics, assetHistory] = await Promise.all([
            agentApi.getMetrics(agentId),
            agentApi.getAssetHistory(agentId, {
              start_date: startDate.toISOString().split('T')[0],
              end_date: endDate.toISOString().split('T')[0],
            }).catch(() => generateMockAssetCurve(20000, timeRange)),
          ]);
          return { agentId, metrics, assetHistory };
        } catch {
          return { 
            agentId, 
            metrics: generateMockMetrics(), 
            assetHistory: generateMockAssetCurve(20000, timeRange) 
          };
        }
      });

      const results = await Promise.all(metricsPromises);
      
      setAgentsWithMetrics(prev => prev.map(a => {
        const result = results.find(r => r.agentId === a.agent.agent_id);
        if (result) {
          return {
            ...a,
            metrics: result.metrics,
            assetCurve: result.assetHistory,
          };
        }
        return a;
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载对比数据失败');
    } finally {
      setLoading(false);
    }
  };

  // Generate mock data for demo
  const generateMockData = () => {
    const mockAgents: AgentWithMetrics[] = [
      {
        agent: {
          agent_id: 'agent_1',
          name: '稳健型策略',
          initial_cash: 20000,
          current_cash: 15000,
          template_id: 'template_1',
          provider_id: '',
          llm_model: 'gpt-4',
          status: 'active',
          schedule_type: 'daily',
          created_at: new Date().toISOString(),
        },
        metrics: {
          total_assets: 23500,
          total_market_value: 8500,
          cash: 15000,
          return_rate: 17.5,
          annual_return_rate: 35.0,
          max_drawdown: 5.2,
          sharpe_ratio: 1.85,
        },
        assetCurve: generateMockAssetCurve(23500, timeRange),
        selected: true,
      },
      {
        agent: {
          agent_id: 'agent_2',
          name: '激进型策略',
          initial_cash: 20000,
          current_cash: 12000,
          template_id: 'template_2',
          provider_id: '',
          llm_model: 'gpt-4',
          status: 'active',
          schedule_type: 'daily',
          created_at: new Date().toISOString(),
        },
        metrics: {
          total_assets: 25800,
          total_market_value: 13800,
          cash: 12000,
          return_rate: 29.0,
          annual_return_rate: 58.0,
          max_drawdown: 12.5,
          sharpe_ratio: 1.45,
        },
        assetCurve: generateMockAssetCurve(25800, timeRange),
        selected: true,
      },
      {
        agent: {
          agent_id: 'agent_3',
          name: '均衡型策略',
          initial_cash: 20000,
          current_cash: 14000,
          template_id: 'template_3',
          provider_id: '',
          llm_model: 'gpt-3.5-turbo',
          status: 'active',
          schedule_type: 'daily',
          created_at: new Date().toISOString(),
        },
        metrics: {
          total_assets: 21200,
          total_market_value: 7200,
          cash: 14000,
          return_rate: 6.0,
          annual_return_rate: 12.0,
          max_drawdown: 3.8,
          sharpe_ratio: 1.25,
        },
        assetCurve: generateMockAssetCurve(21200, timeRange),
        selected: false,
      },
    ];

    setAgentsWithMetrics(mockAgents);
  };

  // Handle agent selection toggle
  const handleAgentToggle = useCallback((agentId: string) => {
    setAgentsWithMetrics(prev => {
      const updated = prev.map(a => 
        a.agent.agent_id === agentId 
          ? { ...a, selected: !a.selected }
          : a
      );
      
      // Load data for newly selected agents
      const newlySelected = updated.filter(a => a.selected && !prev.find(p => p.agent.agent_id === a.agent.agent_id && p.selected));
      if (newlySelected.length > 0) {
        const selectedIds = updated.filter(a => a.selected).map(a => a.agent.agent_id);
        loadComparisonData(selectedIds);
      }
      
      return updated;
    });
  }, []);

  // Handle select all
  const handleSelectAll = useCallback(() => {
    const allSelected = agentsWithMetrics.every(a => a.selected);
    setAgentsWithMetrics(prev => prev.map(a => ({ ...a, selected: !allSelected })));
    
    if (!allSelected) {
      const allIds = agentsWithMetrics.map(a => a.agent.agent_id);
      loadComparisonData(allIds);
    }
  }, [agentsWithMetrics]);

  // Get selected agents for chart
  const selectedAgentsForChart: AgentAssetCurve[] = useMemo(() => {
    return agentsWithMetrics
      .filter(a => a.selected && a.assetCurve.length > 0)
      .map(a => ({
        agentId: a.agent.agent_id,
        agentName: a.agent.name,
        data: a.assetCurve,
      }));
  }, [agentsWithMetrics]);

  // Get selected agents with metrics for table
  const selectedAgentsWithMetrics = useMemo(() => {
    return agentsWithMetrics.filter(a => a.selected && a.metrics);
  }, [agentsWithMetrics]);

  // Format helpers
  const formatPercent = (value: number | string | undefined): string => {
    const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
    const sign = num >= 0 ? '+' : '';
    return `${sign}${num.toFixed(2)}%`;
  };

  // Loading state
  if (loading && agentsWithMetrics.length === 0) {
    return (
      <div className="h-full bg-ios-gray p-4 md:p-6 overflow-auto">
        <div className="space-y-4">
          <CardSkeleton rows={2} />
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-4">
            <div className="lg:col-span-6">
              <ChartSkeleton height="h-[350px]" />
            </div>
            <div className="lg:col-span-4">
              <CardSkeleton rows={6} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-ios-gray p-4 md:p-6 overflow-auto">
      <div className="space-y-4">
        {/* Error Message */}
        {error && (
          <div className="bg-loss-red/10 text-loss-red px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* Model Selector */}
        <GlassCard className="p-4 rounded-[7px]">
          <div className="flex items-center justify-between mb-3">
            <Label>选择对比模型</Label>
            <div className="flex items-center gap-4">
              <SecondaryButton
                onClick={handleSelectAll}
                className="px-2 text-xs rounded"
              >
                {agentsWithMetrics.every(a => a.selected) ? '取消全选' : '全选模型'}
              </SecondaryButton>
              {/* Time Range Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">时间范围</span>
                <div className="flex gap-1">
                  {(['7d', '30d', '90d', '180d', '1y', 'all'] as TimeRange[]).map(range => (
                    <button
                      key={range}
                      onClick={() => setTimeRange(range)}
                      className={`px-2 py-1 text-xs rounded-lg transition-all ${
                        timeRange === range
                          ? 'bg-space-black text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {range === 'all' ? '全部' : range}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {agentsWithMetrics.map(({ agent, selected }) => (
              <button
                key={agent.agent_id}
                onClick={() => handleAgentToggle(agent.agent_id)}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all
                  ${selected 
                    ? 'bg-space-black text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }
                `}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${selected ? 'bg-white' : 'bg-gray-400'}`} />
                <span className="font-medium">{agent.name}</span>
                <span className={`text-[10px] px-1 py-0.5 rounded ${
                  selected 
                    ? 'bg-white/20 text-white' 
                    : agent.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'
                }`}>
                  {agent.status === 'active' ? '运行中' : agent.status === 'paused' ? '已暂停' : agent.status}
                </span>
              </button>
            ))}
          </div>
          
          {agentsWithMetrics.filter(a => a.selected).length === 0 && (
            <p className="text-gray-400 text-sm mt-3">请选择至少一个模型进行对比</p>
          )}
        </GlassCard>

        {/* Comparison Chart & Risk Metrics - 6/4 Layout */}
        {selectedAgentsForChart.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-4">
            {/* 收益率对比 - 6 columns */}
            <div className="lg:col-span-6">
              <CompareChart
                agents={selectedAgentsForChart}
                title="收益率对比"
                height={350}
              />
            </div>

            {/* 风险指标对比 - 4 columns */}
            <div className="lg:col-span-4">
              <GlassCard className="p-4 rounded-[7px] h-full">
                <Label className="mb-3 block">风险指标对比</Label>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200/40">
                        <th className="py-2 px-2 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                          模型
                        </th>
                        <th className="py-2 px-2 text-right text-xs font-bold uppercase tracking-wider text-gray-500">
                          收益率
                        </th>
                        <th className="py-2 px-2 text-right text-xs font-bold uppercase tracking-wider text-gray-500">
                          回撤
                        </th>
                        <th className="py-2 px-2 text-right text-xs font-bold uppercase tracking-wider text-gray-500">
                          夏普
                        </th>
                        <th className="py-2 px-2 text-center text-xs font-bold uppercase tracking-wider text-gray-500">
                          评级
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedAgentsWithMetrics.map(({ agent, metrics }, index) => {
                        if (!metrics) return null;
                        const rating = calculateRating(metrics);
                        
                        return (
                          <tr 
                            key={agent.agent_id}
                            className={`
                              border-b border-gray-100/40 
                              hover:bg-gray-50/50 transition-colors
                              ${index % 2 === 0 ? 'bg-white/20' : 'bg-gray-50/20'}
                            `}
                          >
                            <td className="py-2 px-2">
                              <div className="flex items-center gap-1.5">
                                <span 
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: getAgentColor(index) }}
                                />
                                <span className="font-medium text-space-black truncate max-w-[80px]" title={agent.name}>
                                  {agent.name}
                                </span>
                              </div>
                            </td>
                            <td className="py-2 px-2 text-right">
                              <span className={metrics.return_rate >= 0 ? 'text-profit-green' : 'text-loss-red'}>
                                {formatPercent(metrics.return_rate)}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-right">
                              <span className="text-loss-red">
                                -{(Number(metrics.max_drawdown) || 0).toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-2 px-2 text-right font-medium">
                              {(Number(metrics.sharpe_ratio) || 0).toFixed(2)}
                            </td>
                            <td className="py-2 px-2 text-center">
                              <RatingBadge rating={rating} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Summary Cards */}
                <div className="mt-4 pt-3 border-t border-gray-200/40 grid grid-cols-3 gap-2">
                  {/* Best Return */}
                  <div className="bg-profit-green/5 rounded-lg p-2 text-center">
                    <div className="text-[10px] text-profit-green font-medium">最高收益</div>
                    <div className="text-sm font-bold text-profit-green">
                      {(() => {
                        const best = selectedAgentsWithMetrics.reduce((prev, curr) => 
                          (curr.metrics?.return_rate || 0) > (prev.metrics?.return_rate || 0) ? curr : prev
                        );
                        return formatPercent(best.metrics?.return_rate || 0);
                      })()}
                    </div>
                  </div>

                  {/* Lowest Drawdown */}
                  <div className="bg-info-blue/5 rounded-lg p-2 text-center">
                    <div className="text-[10px] text-info-blue font-medium">最低回撤</div>
                    <div className="text-sm font-bold text-info-blue">
                      {(() => {
                        const best = selectedAgentsWithMetrics.reduce((prev, curr) => 
                          (Number(curr.metrics?.max_drawdown) || 100) < (Number(prev.metrics?.max_drawdown) || 100) ? curr : prev
                        );
                        return `-${(Number(best.metrics?.max_drawdown) || 0).toFixed(1)}%`;
                      })()}
                    </div>
                  </div>

                  {/* Best Sharpe */}
                  <div className="bg-purple-500/5 rounded-lg p-2 text-center">
                    <div className="text-[10px] text-purple-600 font-medium">最高夏普</div>
                    <div className="text-sm font-bold text-purple-600">
                      {(() => {
                        const best = selectedAgentsWithMetrics.reduce((prev, curr) => 
                          (Number(curr.metrics?.sharpe_ratio) || 0) > (Number(prev.metrics?.sharpe_ratio) || 0) ? curr : prev
                        );
                        return (Number(best.metrics?.sharpe_ratio) || 0).toFixed(2);
                      })()}
                    </div>
                  </div>
                </div>
              </GlassCard>
            </div>
          </div>
        )}

        {/* Empty State */}
        {selectedAgentsWithMetrics.length === 0 && !loading && (
          <GlassCard className="p-12 rounded-[7px] text-center">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-gray-500 mb-2">请选择要对比的模型</p>
            <p className="text-xs text-gray-400">选择两个或更多模型以查看对比分析</p>
          </GlassCard>
        )}
      </div>
    </div>
  );
};

export default Compare;

// Helper functions

function generateMockAssetCurve(currentTotal: number, timeRange: TimeRange): Array<{ date: string; value: number }> {
  const data: Array<{ date: string; value: number }> = [];
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

function generateMockMetrics(): PortfolioMetrics {
  const returnRate = -10 + Math.random() * 40;
  return {
    total_assets: 20000 + Math.random() * 10000,
    total_market_value: 5000 + Math.random() * 10000,
    cash: 10000 + Math.random() * 5000,
    return_rate: returnRate,
    annual_return_rate: returnRate * 2,
    max_drawdown: 2 + Math.random() * 15,
    sharpe_ratio: 0.5 + Math.random() * 2,
  };
}

function calculateRating(metrics: PortfolioMetrics): 'A' | 'B' | 'C' | 'D' {
  let score = 0;
  
  // Return rate scoring
  if (metrics.return_rate > 20) score += 3;
  else if (metrics.return_rate > 10) score += 2;
  else if (metrics.return_rate > 0) score += 1;
  
  // Max drawdown scoring (lower is better)
  if ((metrics.max_drawdown || 0) < 5) score += 3;
  else if ((metrics.max_drawdown || 0) < 10) score += 2;
  else if ((metrics.max_drawdown || 0) < 15) score += 1;
  
  // Sharpe ratio scoring
  if ((metrics.sharpe_ratio || 0) > 2) score += 3;
  else if ((metrics.sharpe_ratio || 0) > 1.5) score += 2;
  else if ((metrics.sharpe_ratio || 0) > 1) score += 1;
  
  if (score >= 7) return 'A';
  if (score >= 5) return 'B';
  if (score >= 3) return 'C';
  return 'D';
}

function getAgentColor(index: number): string {
  const colors = [
    '#007AFF', // iOS Blue
    '#34C759', // iOS Green
    '#FF9500', // iOS Orange
    '#AF52DE', // iOS Purple
    '#FF3B30', // iOS Red
    '#5AC8FA', // iOS Teal
    '#FFCC00', // iOS Yellow
    '#FF2D55', // iOS Pink
  ];
  return colors[index % colors.length];
}

// Rating Badge Component
const RatingBadge: React.FC<{ rating: 'A' | 'B' | 'C' | 'D' }> = ({ rating }) => {
  const colors = {
    A: 'bg-profit-green/10 text-profit-green border-profit-green/20',
    B: 'bg-info-blue/10 text-info-blue border-info-blue/20',
    C: 'bg-warning-orange/10 text-warning-orange border-warning-orange/20',
    D: 'bg-loss-red/10 text-loss-red border-loss-red/20',
  };
  
  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm border ${colors[rating]}`}>
      {rating}
    </span>
  );
};
